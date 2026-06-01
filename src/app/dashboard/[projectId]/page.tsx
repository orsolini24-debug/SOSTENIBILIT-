import { db } from "@/db";
import { projects, companies, datapointValues, datapoints, extractedFields, extractionRuns, documents } from "@/db/schema";
import { eq, desc } from "drizzle-orm";
import { notFound } from "next/navigation";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { validateDatapoint } from "@/lib/actions";

export default async function ProjectDashboard({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;

  // 1. Recupero Dati Progetto e Azienda
  const projectRows = await db
    .select({
      project: projects,
      company: companies,
    })
    .from(projects)
    .innerJoin(companies, eq(projects.companyId, companies.id))
    .where(eq(projects.id, projectId))
    .limit(1);

  if (projectRows.length === 0) {
    notFound();
  }

  const { project, company } = projectRows[0];

  // 2. Recupero Valori ESG
  const values = await db
    .select({
      valueId: datapointValues.id,
      value: datapointValues.value,
      state: datapointValues.state,
      confidence: datapointValues.confidence,
      code: datapoints.code,
      name: datapoints.name,
      unit: datapoints.unit,
      datapointId: datapoints.id,
    })
    .from(datapointValues)
    .innerJoin(datapoints, eq(datapointValues.datapointId, datapoints.id))
    .where(eq(datapointValues.projectId, projectId));

  // 3. Recupero ultime estrazioni pendenti (suggerimenti AI)
  const suggestions = await db
    .select({
      id: extractedFields.id,
      datapointId: extractedFields.datapointId,
      fieldName: extractedFields.fieldName,
      value: extractedFields.value,
      confidence: extractedFields.confidence,
      snippet: extractedFields.sourceSnippet,
      docName: documents.name,
    })
    .from(extractedFields)
    .innerJoin(extractionRuns, eq(extractedFields.extractionRunId, extractionRuns.id))
    .innerJoin(documents, eq(extractionRuns.documentId, documents.id))
    .where(eq(documents.projectId, projectId))
    .orderBy(desc(extractedFields.createdAt));

  // Utility per il colore del badge di stato
  // Mappa stati canonici inglesi → variante badge UI
  const DATAPOINT_STATE_LABELS: Record<string, string> = {
    estimated:               "Stimato",
    declared_by_company:     "Dichiarato",
    auto_extracted_candidate:"Estratto AI",
    manual_review_required:  "Da validare",
    manually_validated:      "Validato",
    rule_validated:          "Validato (regola)",
    rejected:                "Scartato",
    conflict_review:         "Conflitto",
  };

  const getStateBadgeVariant = (state: string) => {
    switch (state) {
      case "manually_validated":
      case "rule_validated":
        return "default";
      case "auto_extracted_candidate":
        return "secondary";
      case "declared_by_company":
        return "outline";
      case "estimated":
        return "destructive";
      case "manual_review_required":
        return "outline";
      case "conflict_review":
        return "destructive";
      default:
        return "outline";
    }
  };

  return (
    <div className="container mx-auto p-6 space-y-8">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{company.name}</h1>
          <p className="text-muted-foreground">
            {project.name} - ATECO: {company.industry} | Dipendenti: {company.employeesCount}
          </p>
        </div>
        <div className="flex gap-3">
           <Link href="/">
              <Button variant="outline">Esci</Button>
           </Link>
           <Link href={`/dashboard/${projectId}/upload`}>
              <Button>Carica Documento</Button>
           </Link>
        </div>
      </div>

      {/* SEZIONE SUGGERIMENTI AI */}
      {suggestions.length > 0 && (
        <Card className="border-blue-200 bg-blue-50/30">
          <CardHeader>
            <CardTitle className="text-blue-700 flex items-center gap-2">
              <span className="relative flex h-3 w-3">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-3 w-3 bg-blue-500"></span>
              </span>
              Suggerimenti AI da Documenti Caricati
            </CardTitle>
            <CardDescription>
              L'AI ha identificato nuovi valori reali. Valida per sostituire la baseline stimata.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {suggestions.map((sug) => {
                const targetValue = values.find(v => v.datapointId === sug.datapointId);
                if (!targetValue || targetValue.state === "manually_validated" || targetValue.state === "rule_validated") return null;

                return (
                  <div key={sug.id} className="flex items-start justify-between p-4 bg-white rounded-lg border shadow-sm">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline">{sug.datapointId}</Badge>
                        <span className="font-semibold">{sug.fieldName}</span>
                      </div>
                      <p className="text-sm text-muted-foreground italic">"{sug.snippet}"</p>
                      <p className="text-xs text-slate-400">Fonte: {sug.docName}</p>
                    </div>
                    <div className="flex items-center gap-6">
                      <div className="text-right">
                        <div className="text-xs text-muted-foreground">Baseline Stimata</div>
                        <div className="line-through text-slate-400">{targetValue.value}</div>
                      </div>
                      <div className="text-right">
                        <div className="text-xs text-blue-600 font-bold">Dato Estratto AI</div>
                        <div className="text-xl font-bold text-blue-700">{sug.value}</div>
                      </div>
                      <form action={async () => {
                        "use server";
                        await validateDatapoint(projectId, targetValue.valueId, sug.id);
                      }}>
                        <Button size="sm" className="bg-blue-600 hover:bg-blue-700">Valida</Button>
                      </form>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Data Room ESG (Modulo VSME Basic)</CardTitle>
          <CardDescription>
            Visione unificata dei datapoint richiesti. I dati "Stimati" richiedono validazione documentale.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[100px]">Codice</TableHead>
                <TableHead>Indicatore</TableHead>
                <TableHead className="text-right">Valore</TableHead>
                <TableHead>Unità</TableHead>
                <TableHead>Stato</TableHead>
                <TableHead>Confidence</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {values.map((row) => (
                <TableRow key={row.valueId}>
                  <TableCell className="font-medium">{row.code}</TableCell>
                  <TableCell>{row.name}</TableCell>
                  <TableCell className="text-right font-mono">
                    {row.value ? Number(row.value).toLocaleString('it-IT') : "-"}
                  </TableCell>
                  <TableCell className="text-muted-foreground">{row.unit}</TableCell>
                  <TableCell>
                    <Badge variant={getStateBadgeVariant(row.state)}>
                      {row.state}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <span className="text-sm text-muted-foreground">{row.confidence}</span>
                  </TableCell>
                </TableRow>
              ))}
              {values.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-6 text-muted-foreground">
                    Nessun dato trovato. Esegui la baseline.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
