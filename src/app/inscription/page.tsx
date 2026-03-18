"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { createBrowserClient } from "@supabase/ssr";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Briefcase, CalendarDays } from "lucide-react";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function slugify(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

// ─── Sophrologue sign-up form ─────────────────────────────────────────────────

function SophrologueForm({ onBack }: { onBack: () => void }) {
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setLoading(true);

    const fd = new FormData(event.currentTarget);
    const email = fd.get("email")?.toString().trim() ?? "";
    const password = fd.get("password")?.toString() ?? "";
    const prenom = fd.get("prenom")?.toString().trim() ?? "";
    const nom = fd.get("nom")?.toString().trim() ?? "";
    const ville = fd.get("ville")?.toString().trim() ?? "";
    const departement = fd.get("departement")?.toString().trim() ?? "";
    const plan = fd.get("plan")?.toString() ?? "essentiel";

    if (!email || !password || !prenom || !nom || !ville || !departement) {
      setError("Merci de remplir tous les champs obligatoires.");
      setLoading(false);
      return;
    }
    if (password.length < 8) {
      setError("Le mot de passe doit contenir au moins 8 caractères.");
      setLoading(false);
      return;
    }

    const { data: { user }, error: signUpError } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { prenom, nom, ville, departement, plan, role: "sophrologue" } },
    });

    if (signUpError || !user) {
      setError(signUpError?.message ?? "Une erreur est survenue lors de la création du compte.");
      setLoading(false);
      return;
    }

    const slug = slugify(`${prenom}-${nom}-${ville}`);
    const res = await fetch("/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: user.id, email, prenom, nom, ville, departement, plan, slug }),
    });

    if (!res.ok) {
      const data = (await res.json().catch(() => null)) as { error?: string } | null;
      setError(data?.error ?? "Le compte a été créé mais une erreur est survenue lors de l'enregistrement du profil.");
      setLoading(false);
      return;
    }

    router.push("/dashboard");
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <button
        type="button"
        onClick={onBack}
        className="flex items-center gap-1 text-xs text-slate-400 hover:text-slate-600"
      >
        ← Retour au choix du rôle
      </button>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-1">
          <label htmlFor="prenom" className="text-sm font-medium text-slate-800">Prénom</label>
          <Input id="prenom" name="prenom" required />
        </div>
        <div className="space-y-1">
          <label htmlFor="nom" className="text-sm font-medium text-slate-800">Nom</label>
          <Input id="nom" name="nom" required />
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-1">
          <label htmlFor="ville" className="text-sm font-medium text-slate-800">Ville</label>
          <Input id="ville" name="ville" required />
        </div>
        <div className="space-y-1">
          <label htmlFor="departement" className="text-sm font-medium text-slate-800">Département</label>
          <Input id="departement" name="departement" required />
        </div>
      </div>

      <div className="space-y-1">
        <label htmlFor="email" className="text-sm font-medium text-slate-800">Email professionnel</label>
        <Input id="email" name="email" type="email" required />
      </div>

      <div className="space-y-1">
        <label htmlFor="password" className="text-sm font-medium text-slate-800">Mot de passe</label>
        <Input id="password" name="password" type="password" required />
        <p className="text-xs text-slate-500">Minimum 8 caractères.</p>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="space-y-2">
        <p className="text-sm font-medium text-slate-800">Choisissez votre plan</p>
        <div className="grid gap-3 md:grid-cols-3">
          {[
            { value: "essentiel", label: "Essentiel", price: "29€ / mois" },
            { value: "professionnel", label: "Professionnel", price: "59€ / mois" },
            { value: "cabinet", label: "Cabinet", price: "139€ / mois" },
          ].map((p, i) => (
            <label
              key={p.value}
              className="flex cursor-pointer flex-col rounded-xl border border-slate-200 bg-white p-3 text-sm shadow-sm hover:border-[#426F59]/60 transition-colors"
            >
              <div className="flex items-center justify-between">
                <span className="font-semibold text-slate-900">{p.label}</span>
                <input
                  type="radio"
                  name="plan"
                  value={p.value}
                  defaultChecked={i === 0}
                  className="h-4 w-4"
                />
              </div>
              <span className="mt-1 text-lg font-semibold text-[#426F59]">{p.price}</span>
            </label>
          ))}
        </div>
        <p className="text-xs font-medium text-emerald-600">
          14 jours gratuits, sans carte bancaire.
        </p>
      </div>

      <Button type="submit" className="w-full" disabled={loading}>
        Créer mon compte Calymia
      </Button>
    </form>
  );
}

// ─── Client sign-up form ──────────────────────────────────────────────────────

function ClientForm({ onBack }: { onBack: () => void }) {
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setLoading(true);

    const fd = new FormData(event.currentTarget);
    const prenom = fd.get("prenom")?.toString().trim() ?? "";
    const nom = fd.get("nom")?.toString().trim() ?? "";
    const email = fd.get("email")?.toString().trim() ?? "";
    const password = fd.get("password")?.toString() ?? "";

    if (!prenom || !nom || !email || !password) {
      setError("Merci de remplir tous les champs.");
      setLoading(false);
      return;
    }
    if (password.length < 8) {
      setError("Le mot de passe doit contenir au moins 8 caractères.");
      setLoading(false);
      return;
    }

    // Create the auth account via the API route (service role auto-confirms)
    const res = await fetch("/api/auth/create-client-account", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password, patient_email: email }),
    });
    const data = (await res.json().catch(() => null)) as
      | { success?: boolean; error?: string }
      | null;

    if (data?.error === "exists") {
      setError("Un compte existe déjà avec cet email. Connectez-vous depuis la page de connexion.");
      setLoading(false);
      return;
    }
    if (!res.ok || !data?.success) {
      setError(data?.error ?? "Une erreur est survenue. Merci de réessayer.");
      setLoading(false);
      return;
    }

    // Sign in so the session cookie is set
    const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
    if (signInError) {
      // Account created but sign-in failed — send to connexion
      router.push("/connexion");
      return;
    }

    router.push("/patient");
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <button
        type="button"
        onClick={onBack}
        className="flex items-center gap-1 text-xs text-slate-400 hover:text-slate-600"
      >
        ← Retour au choix du rôle
      </button>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-1">
          <label htmlFor="c-prenom" className="text-sm font-medium text-slate-800">Prénom</label>
          <Input id="c-prenom" name="prenom" required />
        </div>
        <div className="space-y-1">
          <label htmlFor="c-nom" className="text-sm font-medium text-slate-800">Nom</label>
          <Input id="c-nom" name="nom" required />
        </div>
      </div>

      <div className="space-y-1">
        <label htmlFor="c-email" className="text-sm font-medium text-slate-800">Email</label>
        <Input id="c-email" name="email" type="email" required />
      </div>

      <div className="space-y-1">
        <label htmlFor="c-password" className="text-sm font-medium text-slate-800">Mot de passe</label>
        <Input id="c-password" name="password" type="password" required />
        <p className="text-xs text-slate-500">Minimum 8 caractères.</p>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <Button type="submit" className="w-full" disabled={loading}>
        {loading ? "Création en cours…" : "Créer mon espace client"}
      </Button>
    </form>
  );
}

// ─── Role picker ──────────────────────────────────────────────────────────────

type Role = "sophrologue" | "client" | null;

function RolePicker({ onSelect }: { onSelect: (r: "sophrologue" | "client") => void }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <button
        type="button"
        onClick={() => onSelect("sophrologue")}
        className="group flex flex-col items-start gap-3 rounded-2xl border-2 border-transparent bg-white p-6 text-left shadow-sm ring-1 ring-slate-200 transition-all hover:border-[#426F59] hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#426F59]"
      >
        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[#F0F7F4]">
          <Briefcase className="h-6 w-6 text-[#426F59]" />
        </div>
        <div>
          <p className="text-base font-semibold text-slate-900">Je suis sophrologue</p>
          <p className="mt-1 text-sm text-slate-500">
            Je veux gérer mon cabinet et trouver de nouveaux clients.
          </p>
        </div>
      </button>

      <button
        type="button"
        onClick={() => onSelect("client")}
        className="group flex flex-col items-start gap-3 rounded-2xl border-2 border-transparent bg-white p-6 text-left shadow-sm ring-1 ring-slate-200 transition-all hover:border-[#426F59] hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#426F59]"
      >
        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[#F0F7F4]">
          <CalendarDays className="h-6 w-6 text-[#426F59]" />
        </div>
        <div>
          <p className="text-base font-semibold text-slate-900">Je suis client</p>
          <p className="mt-1 text-sm text-slate-500">
            Je veux réserver des séances en ligne.
          </p>
        </div>
      </button>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function InscriptionPage() {
  const [role, setRole] = useState<Role>(null);

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 py-12">
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
          {role === null && (
            <>
              <CardTitle>Créer votre compte Calymia</CardTitle>
              <CardDescription>Vous êtes…</CardDescription>
              <div className="mt-6">
                <RolePicker onSelect={setRole} />
              </div>
              <p className="mt-6 text-center text-xs text-slate-400">
                Déjà un compte ?{" "}
                <a href="/connexion" className="font-medium text-[#426F59] hover:underline">
                  Se connecter
                </a>
              </p>
            </>
          )}

          {role === "sophrologue" && (
            <>
              <CardTitle>Inscription sophrologue</CardTitle>
              <CardDescription>
                Gérez votre cabinet et développez votre activité.
              </CardDescription>
              <div className="mt-2">
                <Badge>14 jours gratuits, sans carte bancaire</Badge>
              </div>
              <div className="mt-6">
                <SophrologueForm onBack={() => setRole(null)} />
              </div>
            </>
          )}

          {role === "client" && (
            <>
              <CardTitle>Créer mon espace client</CardTitle>
              <CardDescription>
                Suivez vos réservations et gérez vos séances en ligne.
              </CardDescription>
              <div className="mt-6">
                <ClientForm onBack={() => setRole(null)} />
              </div>
            </>
          )}
        </Card>
      </div>
    </main>
  );
}
