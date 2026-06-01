import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function Home() {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-slate-50 space-y-6 text-center">
      <h1 className="text-5xl font-extrabold text-slate-900 tracking-tight">SustainChain <span className="text-blue-600">Demo</span></h1>
      <p className="text-xl text-slate-600 max-w-2xl">
        Il motore per convertire le richieste ESG frammentate in una Data Room documentata e verificabile.
      </p>
      
      <div className="pt-8">
        <Button size="lg" className="text-lg px-8 py-6">
          <Link href="/companies/new">
            Avvia Demo (Nuova Azienda)
          </Link>
        </Button>
      </div>

      <div className="mt-12 text-sm text-slate-400 max-w-lg">
        <p>Fase -1: Baseline Stimata &rarr; Estrazione AI &rarr; Validazione (Human in the loop) &rarr; Output VSME.</p>
      </div>
    </div>
  );
}
