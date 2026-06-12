import { db } from "@/db";
import { documents, extractedFields, extractionCandidates, extractionRuns, datapointValues, datapoints, users } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { notFound, redirect } from "next/navigation";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { validateExtractedField } from "@/services/validation";

export default async function ValidationPage({
  params,
}: {
  params: Promise<{ projectId: string; documentId: string }>;
}) {
  const { projectId, documentId } = await params;

  // 1. Recupera Documento ed Estrazioni
  const docRows = await db.select().from(documents).where(eq(documents.id, documentId)).limit(1);
  if (docRows.length === 0) notFound();
  const document = docRows[0];

  const runs = await db.select().from(extractionRuns).where(eq(extractionRuns.documentId, documentId)).limit(1);
  if (runs.length === 0) notFound();
  const extractionRun = runs[0];

  // Recuperiamo sia i vecchi extractedFields (legacy) sia i nuovi extractionCandidates (V8)
  const legacyFields = await db.select().from(extractedFields).where(eq(extractedFields.extractionRunId, extractionRun.id));
  const candidates = await db.select().from(extractionCandidates).where(eq(extractionCandidates.extractionRunId, extractionRun.id));

  // Mappa unificata per la UI
  const displayFields = [
    ...candidates.map(c => ({
      id: c.id,
      datapointId: c.datapointId,
      fieldName: `Candidato ${c.datapointId}`,
      value: c.rawValue,
      unit: c.unitRaw,
      confidence: c.confidence,
      pageReference: c.pageReference,
      sourceSnippet: c.evidenceText,
      isVerifiedPage: true, // V8 Canonical Layer garantisce la pagina dal chunk
      flags: (c.metadata as any)?.rejection_flags || [],
      rank: (c.metadata as any)?.rank || 1
    })),
    ...legacyFields.map(f => ({
      id: f.id,
      datapointId: f.datapointId,
      fieldName: f.fieldName,
      value: f.value,
      unit: "N/A",
      confidence: f.confidence,
      pageReference: f.pageReference,
      sourceSnippet: f.sourceSnippet,
      isVerifiedPage: !(f.metadata as any)?.page_unverified,
      flags: [],
      rank: 1
    }))
  ];

  // 2. Recupera i Datapoint Stimati (Baseline)
  const baselineValues = await db
    .select({
      id: datapointValues.id,
      value: datapointValues.value,
      state: datapointValues.state,
      dpId: datapoints.id,
      dpName: datapoints.name,
      dpUnit: datapoints.unit,
    })
    .from(datapointValues)
    .innerJoin(datapoints, eq(datapointValues.datapointId, datapoints.id))
    .where(eq(datapointValues.projectId, projectId));

  // Action per la validazione
  async function confirmValidation(formData: FormData) {
    "use server";
    const valueId = formData.get("datapointValueId") as string;
    const extractedFieldId = formData.get("extractedFieldId") as string;

    const project = await db.query.projects.findFirst({
      where: (projects, { eq }) => eq(projects.id, projectId)
    });

    if (!project) throw new Error("Progetto non trovato");

    let user = await db.query.users.findFirst({
      where: (users, { eq }) => eq(users.organizationId, project.organizationId!)
    });

    if (!user) {
      [user] = await db.insert(users).values({
        email: "demo@sustainchain.it",
        fullName: "Demo User",
        organizationId: project.organizationId
      }).returning();
    }

    // validateExtractedField al momento usa extractedFields, ma andrebbe esteso per supportare extractionCandidates
    // Per ora usiamo l'ID, andrebbe aggiornato il servizio validation.ts per leggere anche da extractionCandidates.
    await validateExtractedField(projectId, valueId, extractedFieldId, user.id);

    redirect(`/dashboard/${projectId}`);
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Validazione Dati</h1>
        <p className="text-muted-foreground">
          Documento: {document.name} | Tipo: {document.type} | Modello: {extractionRun.model}
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {displayFields.map((field) => {
          // Trova il matching nella baseline
          const baselineMatch = baselineValues.find(b => b.dpId === field.datapointId);

          return (
            <Card key={field.id} className="border-blue-200 shadow-sm">
              <CardHeader className="bg-blue-50">
                <div className="flex justify-between items-start">
                  <div>
                    <CardTitle className="text-lg">{field.fieldName}</CardTitle>
                    <CardDescription>Datapoint VSME: {field.datapointId}</CardDescription>
                  </div>
                  {field.flags.length > 0 && (
                    <div className="bg-red-100 text-red-700 text-xs font-bold px-2 py-1 rounded">
                      Flags: {field.flags.join(", ")}
                    </div>
                  )}
                </div>
              </CardHeader>
              <CardContent className="pt-4 space-y-4">

                <div className="grid grid-cols-2 gap-4">
                  <div className="p-3 bg-slate-50 rounded-md border">
                    <p className="text-xs font-semibold text-slate-500 uppercase mb-1">Baseline Attuale</p>
                    {baselineMatch ? (
                      <>
                        <p className="text-2xl font-bold">{baselineMatch.value} <span className="text-sm font-normal">{baselineMatch.dpUnit}</span></p>
                        <p className="text-sm text-amber-600 font-medium">Stato: {baselineMatch.state}</p>
                      </>
                    ) : (
                      <p className="text-sm text-slate-400">Nessuna baseline per questo dato.</p>
                    )}
                  </div>

                  <div className="p-3 bg-blue-50/50 rounded-md border border-blue-100">
                    <p className="text-xs font-semibold text-blue-500 uppercase mb-1">Valore Estratto (AI)</p>
                    <p className="text-2xl font-bold text-blue-700">{field.value} <span className="text-sm font-normal">{field.unit}</span></p>
                    <p className="text-sm text-blue-600 font-medium">Confidenza: {field.confidence}</p>
                  </div>
                </div>

                <div className="bg-slate-100 p-3 rounded-md text-sm font-mono text-slate-600">
                  <span className="font-semibold block mb-1">
                    Snippet dal documento (Pagina {field.pageReference}
                    {field.isVerifiedPage ? (
                      <span className="text-green-600 ml-1 text-xs uppercase border border-green-600 rounded px-1">Pagina verificata (chunk)</span>
                    ) : (
                      <span className="text-orange-500 ml-1 text-xs uppercase border border-orange-500 rounded px-1">Pagina indicativa (LLM legacy)</span>
                    )}
                    ):
                  </span>
                  "{field.sourceSnippet}"
                </div>

                {baselineMatch && (
                  <form action={confirmValidation}>
                    <input type="hidden" name="datapointValueId" value={baselineMatch.id} />
                    <input type="hidden" name="extractedFieldId" value={field.id} />

                    <Button type="submit" className="w-full bg-blue-600 hover:bg-blue-700">
                      Accetta e Sovrascrivi Baseline
                    </Button>
                  </form>
                )}
              </CardContent>
            </Card>
          );
        })}
        {displayFields.length === 0 && (
          <p className="text-muted-foreground">Nessun dato estratto dal documento.</p>
        )}
      </div>
    </div>
  );
}