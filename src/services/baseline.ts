import { db } from "@/db";
import { companies, datapoints, datapointValues, auditEvents, sectorCoefficients } from "@/db/schema";
import { eq, like, or } from "drizzle-orm";

export async function generateBaseline(projectId: string, companyId: string) {
  // 1. Recupera i dati dell'azienda
  const companyRecord = await db.query.companies.findFirst({
    where: eq(companies.id, companyId),
  });

  if (!companyRecord) {
    throw new Error("Azienda non trovata");
  }

  // P1 Fix: Rimosso default silenzioso (|| 10, || 500)
  const employees = companyRecord.employeesCount;
  const industry = companyRecord.industry || "generic";
  const facilityArea = companyRecord.facilityArea;
  const isProduction = companyRecord.hasProductionSite === "yes";
  const fleetSize = companyRecord.fleetSize || 0;
  const heatingSource = companyRecord.heatingSource || "gas";
  const renewableElectricity = companyRecord.renewableElectricity === "yes";
  const logisticsIntensity = companyRecord.logisticsIntensity || "low";

  // Determiniamo se i dati base sono presenti
  const hasEmployees = employees !== null && employees !== undefined;
  const hasArea = facilityArea !== null && facilityArea !== undefined;

  // 2. Regole di stima (Lettura da sector_coefficients DB)
  // Determiniamo il prefisso ATECO (prime due cifre)
  const atecoPrefixMatch = industry.match(/^(\d{2})/);
  const atecoPrefix = atecoPrefixMatch ? atecoPrefixMatch[1] : "generic";

  // Recupera i coefficienti dal DB per l'ATECO specifico, o fa fallback su 'generic'
  const dbCoeffs = await db.query.sectorCoefficients.findMany({
    where: or(eq(sectorCoefficients.atecoPrefix, atecoPrefix), eq(sectorCoefficients.atecoPrefix, "generic"))
  });

  // Funzione helper per ottenere il coefficiente migliore (specifico > generic > default)
  const getCoeff = (type: string, fallback: number) => {
    const specific = dbCoeffs.find(c => c.atecoPrefix === atecoPrefix && c.coefficientType === type);
    if (specific) return Number(specific.value);
    const generic = dbCoeffs.find(c => c.atecoPrefix === "generic" && c.coefficientType === type);
    if (generic) return Number(generic.value);
    return fallback;
  };

  const baseKWhPerSqM = getCoeff("kwh_per_sqm", 50);
  const operationalKWhPerEmployee = getCoeff("kwh_per_employee", 3000);
  const wastePerEmployee = getCoeff("waste_per_employee", 0.04);
  const waterPerEmployee = getCoeff("water_per_employee", 20);
  const fGasEmissionsRate = getCoeff("fgas_per_100sqm", 0);

  // Calcoli stime con gestione dati mancanti
  const fGasEmissions = hasArea ? (facilityArea! / 100) * fGasEmissionsRate : 0;
  const estimatedEnergy = (hasArea && hasEmployees) 
    ? Math.round((facilityArea! * baseKWhPerSqM) + (employees! * operationalKWhPerEmployee))
    : null;

  // -- SCOPE 1 (VSME-B2-S1) Emissioni Dirette --
  const fleetEmissions = fleetSize * 3.5;
  const heatingEmissions = (hasArea && heatingSource === "gas") ? (facilityArea! * 0.02) : 0;
  const estimatedScope1 = (hasArea || fleetSize > 0)
    ? Math.round((fleetEmissions + heatingEmissions + fGasEmissions) * 10) / 10
    : null;

  // -- SCOPE 2 (VSME-B2-S2) Emissioni Indirette da Energia Acquistata --
  const scope2Factor = renewableElectricity ? 0.01 : 0.25;
  const estimatedScope2 = estimatedEnergy 
    ? Math.round(estimatedEnergy * scope2Factor / 1000 * 100) / 100
    : null;

  // -- RIFIUTI e ACQUA --
  const estimatedWaste = hasEmployees ? Math.round(employees! * wastePerEmployee * 10) / 10 : null;
  const estimatedWater = hasEmployees ? Math.round(employees! * waterPerEmployee) : null;

  // 3. Mappatura Datapoints con Logic "Non determinabile"
  const estimates = [
    {
      dpId: "VSME-B1",
      value: estimatedEnergy?.toString() || null,
      state: estimatedEnergy ? "estimated" : "manual_review_required",
      confidence: estimatedEnergy ? "Bassa" : "Non determinabile",
      notes: estimatedEnergy 
        ? `Stima profilata da DB (ATECO ${atecoPrefix}): Edificio (${facilityArea} mq) + Operatività (${employees} addetti)`
        : `Dati insufficienti (Area: ${facilityArea}, Addetti: ${employees}) per stima energetica.`
    },
    {
      dpId: "VSME-B2-S1",
      value: estimatedScope1?.toString() || null, 
      state: estimatedScope1 ? "estimated" : "manual_review_required",
      confidence: estimatedScope1 ? "Bassa" : "Non determinabile",
      notes: estimatedScope1
        ? `Scope 1 stimato: ${fleetSize} veicoli, riscaldamento a ${heatingSource}, più proxy F-Gases industriali.`
        : `Dati insufficienti per stima Scope 1.`
    },
    {
      dpId: "VSME-B2-S2-LB",
      value: estimatedEnergy ? Math.round(estimatedEnergy * 0.25 / 1000 * 100) / 100 + "" : null,
      state: estimatedEnergy ? "estimated" : "manual_review_required",
      confidence: estimatedEnergy ? "Bassa" : "Non determinabile",
      notes: `Scope 2 Location-Based stimato sull'energia totale.`
    },
    {
      dpId: "VSME-B2-S2-MB",
      value: estimatedScope2?.toString() || null,
      state: estimatedScope2 ? "estimated" : "manual_review_required",
      confidence: estimatedScope2 ? "Bassa" : "Non determinabile",
      notes: `Scope 2 Market-Based stimato sull'energia totale. Rinnovabile dichiarata: ${renewableElectricity ? 'Sì' : 'No'}`
    },
    { 
      dpId: "VSME-B3", 
      value: estimatedWater?.toString() || null, 
      state: estimatedWater ? "estimated" : "manual_review_required",
      confidence: estimatedWater ? "Bassa" : "Non determinabile",
      notes: hasEmployees ? `Stima base idrica per ${employees} dipendenti` : `Dato mancante: Numero dipendenti`
    },
    { 
      dpId: "VSME-B4", 
      value: estimatedWaste?.toString() || null, 
      state: estimatedWaste ? "estimated" : "manual_review_required",
      confidence: estimatedWaste ? "Bassa" : "Non determinabile",
      notes: hasEmployees ? `Stima rifiuti basata su settore e addetti` : `Dato mancante: Numero dipendenti`
    },
    { 
      dpId: "VSME-B5", 
      value: employees?.toString() || null, 
      state: hasEmployees ? "declared_by_company" : "manual_review_required",
      confidence: hasEmployees ? "Media" : "Non determinabile",
      notes: hasEmployees ? `Dato anagrafico dichiarato` : `Dato mancante: Numero dipendenti`
    }
  ];

  // 4. Inserimento nel Database e Tracciamento Audit (IDEMPOTENTE)
  for (const est of estimates) {
    // Inserisci o aggiorna il valore stimato (Idempotenza tramite Upsert)
    const [newValue] = await db.insert(datapointValues).values({
      projectId,
      datapointId: est.dpId,
      value: est.value,
      state: est.state as any,
      confidence: est.confidence as any,
      evidenceNotes: est.notes,
      updatedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: [datapointValues.projectId, datapointValues.datapointId],
      set: {
        value: est.value,
        state: est.state as any,
        confidence: est.confidence as any,
        evidenceNotes: est.notes,
        updatedAt: new Date(),
      }
    })
    .returning();

    // Registra l'evento di audit (lineage)
    await db.insert(auditEvents).values({
      organizationId: companyRecord.organizationId!,
      projectId: projectId,
      entityType: "datapoint_value",
      entityId: newValue.id,
      action: "generate_baseline",
      newValue: newValue,
      metadata: { reason: "Database-driven rule estimation", atecoPrefix, version: "v1.1-integrity" }
    });
  }

  return { success: true, message: "Baseline generata con successo", data: estimates };
}
