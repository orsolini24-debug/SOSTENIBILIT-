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

  const employees = companyRecord.employeesCount || 10;
  const industry = companyRecord.industry || "generic";
  const facilityArea = companyRecord.facilityArea || 500;
  const isProduction = companyRecord.hasProductionSite === "yes";
  const fleetSize = companyRecord.fleetSize || 0;
  const heatingSource = companyRecord.heatingSource || "gas";
  const renewableElectricity = companyRecord.renewableElectricity === "yes";
  const logisticsIntensity = companyRecord.logisticsIntensity || "low";

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

  const fGasEmissions = (facilityArea / 100) * fGasEmissionsRate;

  const estimatedEnergy = Math.round((facilityArea * baseKWhPerSqM) + (employees * operationalKWhPerEmployee));

  // -- SCOPE 1 (VSME-B2-S1) Emissioni Dirette --
  // Veicoli: ~3.5 tCO2e per veicolo commerciale/auto aziendale
  const fleetEmissions = fleetSize * 3.5; 
  // Riscaldamento: Se a gas metano, stimiamo ~0.02 tCO2e per mq. Se elettrico, è Scope 2.
  const heatingEmissions = heatingSource === "gas" ? (facilityArea * 0.02) : 0;
  const estimatedScope1 = Math.round((fleetEmissions + heatingEmissions + fGasEmissions) * 10) / 10;

  // -- SCOPE 2 (VSME-B2-S2) Emissioni Indirette da Energia Acquistata --
  // Se l'azienda compra energia 100% rinnovabile (Market-based), le emissioni Scope 2 crollano (idealmente a 0, mettiamo un residuo minimo).
  // Se no, usiamo il mix nazionale (~0.25 kgCO2/kWh in Italia).
  const scope2Factor = renewableElectricity ? 0.01 : 0.25; 
  const estimatedScope2 = Math.round(estimatedEnergy * scope2Factor / 1000 * 100) / 100;

  // -- RIFIUTI e ACQUA --
  const estimatedWaste = Math.round(employees * wastePerEmployee * 10) / 10;
  const estimatedWater = Math.round(employees * waterPerEmployee);

  // 3. Mappatura Datapoints
  const estimates = [
    { 
      dpId: "VSME-B1", 
      value: estimatedEnergy.toString(), 
      notes: `Stima profilata da DB (ATECO ${atecoPrefix}): Edificio (${facilityArea} mq) + Operatività (${employees} addetti)` 
    },
    { 
      dpId: "VSME-B2-S1", 
      value: estimatedScope1.toString(), 
      notes: `Scope 1 stimato: ${fleetSize} veicoli, riscaldamento a ${heatingSource}, più proxy F-Gases industriali.` 
    },
    { 
      dpId: "VSME-B2-S2-LB", 
      value: Math.round(estimatedEnergy * 0.25 / 1000 * 100) / 100 + "", 
      notes: `Scope 2 Location-Based stimato sull'energia totale.` 
    },
    { 
      dpId: "VSME-B2-S2-MB", 
      value: estimatedScope2.toString(), 
      notes: `Scope 2 Market-Based stimato sull'energia totale. Rinnovabile dichiarata: ${renewableElectricity ? 'Sì' : 'No'}` 
    },
    { dpId: "VSME-B3", value: estimatedWater.toString(), notes: `Stima base idrica per ${employees} dipendenti` },
    { dpId: "VSME-B4", value: estimatedWaste.toString(), notes: `Stima rifiuti basata su settore e addetti` },
    { dpId: "VSME-B5", value: employees.toString(), notes: `Dato anagrafico dichiarato` }
  ];

  // 4. Inserimento nel Database e Tracciamento Audit
  for (const est of estimates) {
    // Inserisci il valore stimato
    const [newValue] = await db.insert(datapointValues).values({
      projectId,
      datapointId: est.dpId,
      value: est.value,
      state: est.dpId === "VSME-B5" ? "declared_by_company" : "estimated",
      confidence: est.dpId === "VSME-B5" ? "Media" : "Bassa",
      evidenceNotes: est.notes,
    }).returning();

    // Registra l'evento di audit (lineage)
    await db.insert(auditEvents).values({
      organizationId: companyRecord.organizationId!,
      projectId: projectId,
      entityType: "datapoint_value",
      entityId: newValue.id,
      action: "generate_baseline",
      newValue: newValue,
      metadata: { reason: "Database-driven rule estimation", atecoPrefix }
    });
  }

  return { success: true, message: "Baseline generata con successo", data: estimates };
}
