import { db } from "@/db";
import { projects, companies, datapointValues, datapoints, evidenceLinks, documents } from "@/db/schema";
import { eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export default async function ReportPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;

  // 1. Recupero Progetto
  const projectRows = await db
    .select({ project: projects, company: companies })
    .from(projects)
    .innerJoin(companies, eq(projects.companyId, companies.id))
    .where(eq(projects.id, projectId))
    .limit(1);

  if (projectRows.length === 0) notFound();
  const { project, company } = projectRows[0];

  // 2. Recupero tutti i valori con le rispettive evidenze
  const values = await db
    .select({
      valueId: datapointValues.id,
      value: datapointValues.value,
      state: datapointValues.state,
      confidence: datapointValues.confidence,
      code: datapoints.code,
      name: datapoints.name,
      unit: datapoints.unit,
      docName: documents.name,
      pageRef: evidenceLinks.pageReference,
    })
    .from(datapointValues)
    .innerJoin(datapoints, eq(datapointValues.datapointId, datapoints.id))
    .leftJoin(documents, eq(datapointValues.sourceDocumentId, documents.id))
    .leftJoin(evidenceLinks, eq(datapointValues.id, evidenceLinks.datapointValueId))
    .where(eq(datapointValues.projectId, projectId));

  const DATAPOINT_STATE_LABELS: Record<string, string> = {
    estimated:                "Stimato",
    declared_by_company:      "Dichiarato",
    auto_extracted_candidate: "Estratto AI",
    manual_review_required:   "Da validare",
    manually_validated:       "Validato",
    rule_validated:           "Validato (regola)",
    rejected:                 "Scartato",
    conflict_review:          "Conflitto",
  };

  const isValidated = (state: string) =>
    state === "manually_validated" || state === "rule_validated";

  const validatedCount = values.filter(v => isValidated(v.state)).length;
  const estimatedCount = values.filter(v => v.state === "estimated" || v.state === "declared_by_company").length;

  return (
    <div className="container mx-auto p-6 max-w-4xl space-y-8 bg-white min-h-screen">
      {/* Header Stampa */}
      <div className="border-b pb-6 flex justify-between items-start">
        <div>
          <h1 className="text-4xl font-serif font-bold text-slate-900">{company.name}</h1>
          <p className="text-lg text-slate-600 mt-2">Scheda ESG / VSME Light</p>
          <p className="text-sm text-slate-500 mt-1">
            Partita IVA: {company.vatNumber || "N/D"} | Codice ATECO: {company.industry} | Dipendenti: {company.employeesCount}
          </p>
        </div>
        <div className="text-right">
          <p className="font-semibold text-slate-700">{project.name}</p>
          <p className="text-sm text-slate-500">Generato il: {new Date().toLocaleDateString('it-IT')}</p>
          <Button variant="outline" className="mt-4 print:hidden" onClick={() => {/* Simulazione stampa */}}>
            Stampa / PDF
          </Button>
        </div>
      </div>

      {/* Summary Recap */}
      <div className="grid grid-cols-3 gap-4">
        <div className="p-4 bg-slate-50 rounded-lg border text-center">
          <p className="text-sm text-slate-500 font-medium">Datapoint Analizzati</p>
          <p className="text-3xl font-bold">{values.length}</p>
        </div>
        <div className="p-4 bg-green-50 rounded-lg border border-green-100 text-center">
          <p className="text-sm text-green-600 font-medium">Dati Certificati</p>
          <p className="text-3xl font-bold text-green-700">{validatedCount}</p>
        </div>
        <div className="p-4 bg-amber-50 rounded-lg border border-amber-100 text-center">
          <p className="text-sm text-amber-600 font-medium">Dati da Verificare (Gap)</p>
          <p className="text-3xl font-bold text-amber-700">{estimatedCount}</p>
        </div>
      </div>

      {/* Dettaglio Dati */}
      <div className="space-y-6">
        <h2 className="text-2xl font-bold border-b pb-2">Sezione B - Modulo Base VSME</h2>
        
        {values.map(row => (
          <div key={row.valueId} className={`p-4 rounded-md border ${isValidated(row.state) ? 'bg-white border-green-200' : 'bg-slate-50 border-amber-200 border-dashed'}`}>
            <div className="flex justify-between items-start">
              <div>
                <p className="text-xs font-bold text-slate-400 mb-1">{row.code}</p>
                <p className="font-semibold text-lg">{row.name}</p>
              </div>
              <Badge variant={isValidated(row.state) ? "default" : "outline"} className={isValidated(row.state) ? "bg-green-600" : "text-amber-600 border-amber-300"}>
                {DATAPOINT_STATE_LABELS[row.state] ?? row.state}
              </Badge>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-slate-500">Valore Rilevato</p>
                <p className="text-xl font-bold font-mono">
                  {row.value ? Number(row.value).toLocaleString('it-IT') : "-"} <span className="text-sm font-normal">{row.unit}</span>
                </p>
              </div>
              <div>
                <p className="text-sm text-slate-500">Evidenza Documentale</p>
                {isValidated(row.state) ? (
                  <p className="text-sm font-medium text-slate-700">
                    📄 {row.docName} (Pag. {row.pageRef || 1})
                  </p>
                ) : (
                  <p className="text-sm text-amber-600 italic">
                    ⚠️ Manca documento. Attualmente basato su stima/benchmark settoriale.
                  </p>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="pt-8 border-t text-center text-sm text-slate-400 print:hidden">
        <Link href={`/dashboard/${projectId}`} className="hover:underline">
          &larr; Torna alla Dashboard
        </Link>
      </div>
    </div>
  );
}
