"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { createBrowserClient } from "@supabase/ssr";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

type SignUpState = {
  error?: string;
};

function slugify(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function SignUpForm() {
  const [state, setState] = useState<SignUpState>({});
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setState({});
    setLoading(true);

    const formData = new FormData(event.currentTarget);

    const email = (formData.get("email") ?? "").toString().trim();
    const password = (formData.get("password") ?? "").toString();
    const prenom = (formData.get("prenom") ?? "").toString().trim();
    const nom = (formData.get("nom") ?? "").toString().trim();
    const ville = (formData.get("ville") ?? "").toString().trim();
    const departement = (formData.get("departement") ?? "")
      .toString()
      .trim();
    const plan = (formData.get("plan") ?? "essentiel").toString();

    if (!email || !password || !prenom || !nom || !ville || !departement) {
      setState({
        error: "Merci de remplir tous les champs obligatoires.",
      });
      setLoading(false);
      return;
    }

    if (password.length < 8) {
      setState({
        error: "Le mot de passe doit contenir au moins 8 caractères.",
      });
      setLoading(false);
      return;
    }

    const {
      data: { user },
      error: signUpError,
    } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          prenom,
          nom,
          ville,
          departement,
          plan,
          role: "sophrologue",
        },
      },
    });

    if (signUpError || !user) {
      setState({
        error:
          signUpError?.message ??
          "Une erreur est survenue lors de la création du compte.",
      });
      setLoading(false);
      return;
    }

    const slug = slugify(`${prenom}-${nom}-${ville}`);

    const response = await fetch("/api/auth/register", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        userId: user.id,
        email,
        prenom,
        nom,
        ville,
        departement,
        plan,
        slug,
      }),
    });

    if (!response.ok) {
      const data = (await response.json().catch(() => null)) as
        | { error?: string }
        | null;

      setState({
        error:
          data?.error ??
          "Le compte a été créé mais une erreur est survenue lors de l’enregistrement du profil sophrologue.",
      });
      setLoading(false);
      return;
    }

    router.push("/dashboard");
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="space-y-5"
    >
      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-1">
          <label
            htmlFor="prenom"
            className="text-sm font-medium text-slate-800"
          >
            Prénom
          </label>
          <Input id="prenom" name="prenom" required />
        </div>
        <div className="space-y-1">
          <label htmlFor="nom" className="text-sm font-medium text-slate-800">
            Nom
          </label>
          <Input id="nom" name="nom" required />
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-1">
          <label htmlFor="ville" className="text-sm font-medium text-slate-800">
            Ville
          </label>
          <Input id="ville" name="ville" required />
        </div>
        <div className="space-y-1">
          <label
            htmlFor="departement"
            className="text-sm font-medium text-slate-800"
          >
            Département
          </label>
          <Input id="departement" name="departement" required />
        </div>
      </div>

      <div className="space-y-1">
        <label htmlFor="email" className="text-sm font-medium text-slate-800">
          Email professionnel
        </label>
        <Input id="email" name="email" type="email" required />
      </div>

      <div className="space-y-1">
        <label
          htmlFor="password"
          className="text-sm font-medium text-slate-800"
        >
          Mot de passe
        </label>
        <Input id="password" name="password" type="password" required />
        <p className="text-xs text-slate-500">
          Minimum 8 caractères. Évitez d’utiliser un mot de passe déjà utilisé
          ailleurs.
        </p>
      </div>

      {state.error ? (
        <p className="text-sm text-red-600">{state.error}</p>
      ) : null}

      <div className="space-y-2">
        <p className="text-sm font-medium text-slate-800">Choisissez votre plan</p>
        <div className="grid gap-3 md:grid-cols-3">
          <label className="flex cursor-pointer flex-col rounded-xl border border-slate-200 bg-white p-3 text-sm shadow-sm hover:border-primary/60">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-slate-900">Essentiel</span>
              <input
                type="radio"
                name="plan"
                value="essentiel"
                defaultChecked
                className="h-4 w-4 text-primary"
              />
            </div>
            <span className="mt-1 text-lg font-semibold text-primary">
              29€ / mois
            </span>
          </label>

          <label className="flex cursor-pointer flex-col rounded-xl border border-slate-200 bg-white p-3 text-sm shadow-sm hover:border-primary/60">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-slate-900">
                Professionnel
              </span>
              <input
                type="radio"
                name="plan"
                value="professionnel"
                className="h-4 w-4 text-primary"
              />
            </div>
            <span className="mt-1 text-lg font-semibold text-primary">
              59€ / mois
            </span>
          </label>

          <label className="flex cursor-pointer flex-col rounded-xl border border-slate-200 bg-white p-3 text-sm shadow-sm hover:border-primary/60">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-slate-900">Cabinet</span>
              <input
                type="radio"
                name="plan"
                value="cabinet"
                className="h-4 w-4 text-primary"
              />
            </div>
            <span className="mt-1 text-lg font-semibold text-primary">
              139€ / mois
            </span>
          </label>
        </div>
        <p className="text-xs font-medium text-emerald-600">
          14 jours gratuits, sans carte bancaire.
        </p>
      </div>

      <Button
        type="submit"
        className="w-full"
        disabled={loading}
      >
        Créer mon compte Calymia
      </Button>
    </form>
  );
}

export default function InscriptionPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50">
      <div className="mx-4 w-full max-w-xl">
        <div className="mb-8 flex justify-center">
          <Image
            src="/logo.webp"
            alt="Calymia"
            width={200}
            height={80}
            priority
            className="object-contain"
          />
        </div>
        <Card>
          <CardTitle>Créer votre compte Calymia</CardTitle>
          <CardDescription>
            Plateforme dédiée aux sophrologues pour gérer vos clients,
            séances et activité.
          </CardDescription>
          <div className="mt-2">
            <Badge>14 jours gratuits, sans carte bancaire</Badge>
          </div>
          <div className="mt-6">
            <SignUpForm />
          </div>
        </Card>
      </div>
    </main>
  );
}

