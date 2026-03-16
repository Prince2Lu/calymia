import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export default function DashboardPage() {
  return (
    <main className="min-h-screen bg-slate-50">
      <div className="mx-auto flex max-w-5xl flex-col gap-6 px-4 py-10">
        <div className="space-y-2">
          <Badge>Calymia</Badge>
          <h1 className="text-3xl font-semibold text-primary">
            Tableau de bord
          </h1>
          <p className="text-sm text-slate-600">
            Vue d’ensemble de votre activité de sophrologue.
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardTitle>Prochaines séances</CardTitle>
            <CardDescription>
              Résumé des rendez-vous à venir avec vos patients.
            </CardDescription>
          </Card>
          <Card>
            <CardTitle>Nouveaux patients</CardTitle>
            <CardDescription>
              Aperçu des nouveaux contacts et demandes de rendez-vous.
            </CardDescription>
          </Card>
          <Card>
            <CardTitle>Statistiques</CardTitle>
            <CardDescription>
              Indicateurs clés sur vos séances et votre récurrence.
            </CardDescription>
          </Card>
        </div>
      </div>
    </main>
  );
}

