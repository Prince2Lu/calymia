import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export default function PatientPage() {
  return (
    <main className="min-h-screen bg-slate-50">
      <div className="mx-auto flex max-w-4xl flex-col gap-6 px-4 py-10">
        <div className="space-y-2">
          <Badge>Calymia</Badge>
          <h1 className="text-3xl font-semibold text-primary">
            Dossier patient
          </h1>
          <p className="text-sm text-slate-600">
            Vue détaillée d’un patient, de ses séances et de ses objectifs.
          </p>
        </div>

        <Card>
          <CardTitle>Informations patient</CardTitle>
          <CardDescription>
            Cette page affichera les informations complètes du patient,
            l’historique des séances et vos notes.
          </CardDescription>
        </Card>
      </div>
    </main>
  );
}

