import { uploadAndParseDocument } from "@/lib/actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { redirect } from "next/navigation";

export default async function UploadPage({ params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params;

  async function handleUpload(formData: FormData) {
    "use server";
    await uploadAndParseDocument(projectId, formData);
    redirect(`/dashboard/${projectId}`);
  }

  return (
    <div className="container mx-auto p-6 max-w-2xl">
      <Card>
        <CardHeader>
          <CardTitle>Carica Documento di Supporto</CardTitle>
          <CardDescription>
            Il sistema utilizzerà l'AI per estrarre automaticamente i dati e mapparli sui datapoint VSME.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form action={handleUpload} className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="type">Tipo Documento</Label>
              <select 
                id="type" 
                name="type" 
                className="flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                required
              >
                <option value="bolletta">Bolletta Energetica (Luce/Gas)</option>
                <option value="hr">Report Risorse Umane / Libro Unico</option>
                <option value="rifiuti">Registro Rifiuti / Formulario MUD</option>
              </select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="file">Seleziona PDF</Label>
              <Input id="file" name="file" type="file" accept=".pdf" required />
            </div>

            <div className="pt-4 flex gap-4">
              <Button type="submit" className="w-full">Avvia Analisi AI</Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
