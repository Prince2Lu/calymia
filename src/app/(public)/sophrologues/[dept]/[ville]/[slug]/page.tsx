"use client";

import { useParams } from "next/navigation";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export default function SophrologueProfilPage() {
  const params = useParams<{
    dept: string;
    ville: string;
    slug: string;
  }>();

  const { dept, ville, slug } = params;

  return (
    <main className="min-h-screen bg-slate-50">
      <div className="mx-auto flex max-w-4xl flex-col gap-6 px-4 py-10">
        <div className="space-y-2">
          <Badge>Calymia · Sophrologue</Badge>
          <h1 className="text-3xl font-semibold text-primary">
            Profil du sophrologue
          </h1>
          <p className="text-sm text-slate-600">
            Département&nbsp;: <span className="font-medium">{dept}</span> ·
            Ville&nbsp;: <span className="font-medium capitalize">{ville}</span>{" "}
            · Identifiant&nbsp;: <span className="font-mono text-xs">{slug}</span>
          </p>
        </div>

        <Card>
          <CardTitle>Informations principales</CardTitle>
          <CardDescription>
            Cette page affichera le profil détaillé du sophrologue, son
            agenda, ses spécialités et les options de prise de rendez-vous.
          </CardDescription>
        </Card>
      </div>
    </main>
  );
}

