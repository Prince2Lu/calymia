import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";

export default function ParametresPage() {
  return (
    <main className="min-h-screen bg-slate-50">
      <div className="mx-auto flex max-w-3xl flex-col gap-6 px-4 py-10">
        <div className="space-y-2">
          <Badge>Calymia</Badge>
          <h1 className="text-3xl font-semibold text-primary">Paramètres</h1>
          <p className="text-sm text-slate-600">
            Configurez votre compte, votre profil public et vos préférences.
          </p>
        </div>

        <Card>
          <CardTitle>Identité professionnelle</CardTitle>
          <CardDescription>
            Nom affiché, spécialités, présentation courte, etc.
          </CardDescription>
          <div className="mt-4 space-y-3">
            <Input placeholder="Nom complet du sophrologue" />
            <Input placeholder="Spécialités (stress, sommeil, préparation...)" />
          </div>
        </Card>
      </div>
    </main>
  );
}

