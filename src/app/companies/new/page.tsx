import { db } from "@/db";
import { organizations, companies, projects } from "@/db/schema";
import { generateBaseline } from "@/services/baseline";
import { redirect } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";

export default function NewCompanyPage() {
  async function createCompany(formData: FormData) {
    "use server";

    const name = formData.get("name") as string;
    const vatNumber = formData.get("vatNumber") as string;
    const industry = formData.get("industry") as string;
    const location = formData.get("location") as string;
    const employeesCount = parseInt(formData.get("employeesCount") as string) || 0;
    const facilityArea = parseInt(formData.get("facilityArea") as string) || 0;
    const hasProductionSite = formData.get("hasProductionSite") as string || "no";
    const fleetSize = parseInt(formData.get("fleetSize") as string) || 0;
    const heatingSource = formData.get("heatingSource") as string || "gas";
    const renewableElectricity = formData.get("renewableElectricity") as string || "no";
    const logisticsIntensity = formData.get("logisticsIntensity") as string || "low";

    // 1. Crea Organizzazione e Azienda
    const [org] = await db.insert(organizations).values({ name: `Org: ${name}` }).returning();
    
    const [company] = await db.insert(companies).values({
      organizationId: org.id,
      name,
      vatNumber,
      industry,
      location,
      employeesCount,
      facilityArea,
      hasProductionSite,
      fleetSize,
      heatingSource,
      renewableElectricity,
      logisticsIntensity,
    }).returning();

    // 2. Crea un Progetto ESG per l'anno in corso
    const [project] = await db.insert(projects).values({
      organizationId: org.id,
      companyId: company.id,
      name: "Bilancio Sostenibilità VSME 2026",
      year: 2026,
      status: "in_progress",
    }).returning();

    // 3. Esegui la Baseline Automatica (il "Preparation Layer")
    await generateBaseline(project.id, company.id);

    // Reindirizza alla Dashboard passando il Project ID (per vederlo in azione)
    redirect(`/dashboard/${project.id}`);
  }

  return (
    <div className="flex justify-center items-center min-h-screen bg-slate-50">
      <Card className="w-full max-w-lg">
        <form action={createCompany}>
          <CardHeader>
            <CardTitle>Nuova Azienda</CardTitle>
            <CardDescription>Inserisci i dati anagrafici per avviare la stima ESG.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Ragione Sociale</Label>
              <Input id="name" name="name" placeholder="Es. Officina Meccanica S.r.l." required />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="vatNumber">Partita IVA</Label>
                <Input id="vatNumber" name="vatNumber" placeholder="IT00000000000" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="industry">Codice ATECO</Label>
                <Input id="industry" name="industry" placeholder="Es. 25.62" />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="location">Sede Principale</Label>
              <Input id="location" name="location" placeholder="Città, Provincia" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="employeesCount">Dipendenti</Label>
                <Input id="employeesCount" name="employeesCount" type="number" placeholder="Es. 40" required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="facilityArea">Superficie (mq)</Label>
                <Input id="facilityArea" name="facilityArea" type="number" placeholder="Es. 1500" required />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="hasProductionSite">Sito Produttivo?</Label>
              <select 
                id="hasProductionSite" 
                name="hasProductionSite" 
                className="flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                required
              >
                <option value="no">No, solo uffici / magazzino</option>
                <option value="yes">Sì, ho processi produttivi in sede</option>
              </select>
            </div>
            <div className="grid grid-cols-2 gap-4 border-t pt-4 mt-2">
              <div className="space-y-2">
                <Label htmlFor="fleetSize">Veicoli Aziendali (n°)</Label>
                <Input id="fleetSize" name="fleetSize" type="number" placeholder="Es. 3" defaultValue={0} required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="heatingSource">Fonte Riscaldamento</Label>
                <select 
                  id="heatingSource" 
                  name="heatingSource" 
                  className="flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                >
                  <option value="gas">Gas Metano</option>
                  <option value="electric">Pompe di Calore (Elettrico)</option>
                  <option value="none">Nessuno / Altro</option>
                </select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="renewableElectricity">Energia Rinnovabile al 100%?</Label>
                <select 
                  id="renewableElectricity" 
                  name="renewableElectricity" 
                  className="flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                >
                  <option value="no">No / Non so</option>
                  <option value="yes">Sì, con garanzia d'origine</option>
                </select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="logisticsIntensity">Intensità Logistica</Label>
                <select 
                  id="logisticsIntensity" 
                  name="logisticsIntensity" 
                  className="flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                >
                  <option value="low">Bassa (Servizi / Uffici)</option>
                  <option value="medium">Media (Produzione locale)</option>
                  <option value="high">Alta (Import/Export, Trasporti frequenti)</option>
                </select>
              </div>
            </div>
          </CardContent>
          <CardFooter>
            <Button type="submit" className="w-full">Crea Profilo ed Esegui Baseline</Button>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}
