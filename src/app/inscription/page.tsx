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
import { DEPARTEMENTS } from "@/lib/departements";

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
  const [selectedDeptCode, setSelectedDeptCode] = useState("");
  const [villeInput, setVilleInput] = useState("");
  const [villeSuggestions, setVilleSuggestions] = useState<string[]>([]);
  const [villeSuggestionsOpen, setVilleSuggestionsOpen] = useState(false);
  const [villeLoading, setVilleLoading] = useState(false);
  const router = useRouter();
  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );

  const fetchVilles = async (codeDept: string, search: string) => {
    if (!codeDept || search.length < 2) {
      setVilleSuggestions([]);
      setVilleSuggestionsOpen(false);
      return;
    }
    setVilleLoading(true);
    try {
      const res = await fetch(
        `https://geo.api.gouv.fr/communes?codeDepartement=${codeDept}&fields=nom&format=json&limit=100`,
      );
      const data = (await res.json()) as { nom: string }[];
      const filtered = data
        .map((c) => c.nom)
        .filter((nom) => nom.toLowerCase().includes(search.toLowerCase()))
        .slice(0, 8);
      setVilleSuggestions(filtered);
      setVilleSuggestionsOpen(filtered.length > 0);
    } catch {
      setVilleSuggestions([]);
      setVilleSuggestionsOpen(false);
    } finally {
      setVilleLoading(false);
    }
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setLoading(true);

    const fd = new FormData(event.currentTarget);
    const email = fd.get("email")?.toString().trim() ?? "";
    const password = fd.get("password")?.toString() ?? "";
    const prenom = fd.get("prenom")?.toString().trim() ?? "";
    const nom = fd.get("nom")?.toString().trim() ?? "";
    const deptObj = DEPARTEMENTS.find((d) => d.code === selectedDeptCode);
    const departement = deptObj?.slug ?? "";
    const ville = villeInput.trim();
    const plan = "professionnel";

    if (!email || !password || !prenom || !nom) {
      setError("Merci de remplir tous les champs obligatoires.");
      setLoading(false);
      return;
    }
    if (!selectedDeptCode || !deptObj) {
      setError("Merci de sélectionner un département.");
      setLoading(false);
      return;
    }
    if (!ville) {
      setError("Merci de renseigner votre ville.");
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
    console.log("[Inscription] Appel /api/auth/register", {
      userId: user.id,
      email,
      plan,
      slug,
    });
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

    router.push("/onboarding");
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
        <div className="relative space-y-1">
          <label htmlFor="ville" className="text-sm font-medium text-slate-800">Ville</label>
          <Input
            id="ville"
            value={villeInput}
            autoComplete="off"
            required
            placeholder="Commencez à taper..."
            onChange={(e) => {
              setVilleInput(e.target.value);
              void fetchVilles(selectedDeptCode, e.target.value);
            }}
            onBlur={() => setTimeout(() => setVilleSuggestionsOpen(false), 150)}
            onFocus={() => {
              if (villeSuggestions.length > 0) setVilleSuggestionsOpen(true);
            }}
          />
          {villeSuggestionsOpen && villeSuggestions.length > 0 && (
            <ul className="absolute z-10 mt-1 w-full rounded-lg border border-slate-200 bg-white shadow-md">
              {villeLoading ? (
                <li className="px-3 py-2 text-xs text-slate-400">Chargement...</li>
              ) : (
                villeSuggestions.map((ville) => (
                  <li
                    key={ville}
                    className="cursor-pointer px-3 py-2 text-sm text-slate-700 hover:bg-[#F0F7F4] hover:text-[#426F59]"
                    onMouseDown={() => {
                      setVilleInput(ville);
                      setVilleSuggestionsOpen(false);
                    }}
                  >
                    {ville}
                  </li>
                ))
              )}
            </ul>
          )}
        </div>
        <div className="space-y-1">
          <label htmlFor="departement" className="text-sm font-medium text-slate-800">Département</label>
          <select
            id="departement"
            name="departement"
            required
            value={selectedDeptCode}
            onChange={(e) => {
              setSelectedDeptCode(e.target.value);
              setVilleInput("");
              setVilleSuggestions([]);
            }}
            className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#426F59]"
          >
            <option value="">Sélectionnez un département</option>
            {DEPARTEMENTS.map((dept) => (
              <option key={dept.code} value={dept.code}>
                {dept.code} — {dept.nom}
              </option>
            ))}
          </select>
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

      <div className="rounded-lg border border-[#426F59]/20 bg-[#F0F7F4] p-3">
        <p className="text-sm font-medium text-[#426F59]">
          Essai gratuit 14 jours — accès Professionnel complet, sans carte bancaire.
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

    // Create the auth account + patient record via service role
    const res = await fetch("/api/auth/create-client-account", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email,
        password,
        patient_email: email,
        prenom,
        nom,
        create_patient_record: true,
      }),
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
