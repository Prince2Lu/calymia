import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";

export default function ClientsPage() {
  return (
    <main className="min-h-screen bg-slate-50">
      <div className="mx-auto flex max-w-5xl flex-col gap-6 px-4 py-10">
        <div className="space-y-2">
          <Badge>Calymia</Badge>
          <h1 className="text-3xl font-semibold text-primary">Patients</h1>
          <p className="text-sm text-slate-600">
            Gérez votre base de patients, leurs coordonnées et leur suivi.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Input placeholder="Rechercher un patient par nom ou email..." />
        </div>

        <Card>
          <CardTitle>Liste des patients</CardTitle>
          <CardDescription>
            Cette section affichera la liste paginée de vos patients, leurs
            informations principales et un accès rapide à leur dossier.
          </CardDescription>
        </Card>
      </div>
    </main>
  );
}

