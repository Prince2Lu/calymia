import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export default function SeancesPage() {
  return (
    <main className="min-h-screen bg-slate-50">
      <div className="mx-auto flex max-w-5xl flex-col gap-6 px-4 py-10">
        <div className="space-y-2">
          <Badge>Calymia</Badge>
          <h1 className="text-3xl font-semibold text-primary">Séances</h1>
          <p className="text-sm text-slate-600">
            Planifiez, suivez et documentez vos séances de sophrologie.
          </p>
        </div>

        <Card>
          <CardTitle>Agenda et historique</CardTitle>
          <CardDescription>
            Cette page affichera votre agenda, les prochaines séances et
            l’historique des rendez-vous passés.
          </CardDescription>
        </Card>
      </div>
    </main>
  );
}

