"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { createBrowserClient } from "@supabase/ssr";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export default function ReinitialiserMotDePassePage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (password.length < 8) {
      setError("Le mot de passe doit contenir au moins 8 caractères.");
      return;
    }
    if (password !== confirm) {
      setError("Les mots de passe ne correspondent pas.");
      return;
    }

    setLoading(true);
    const { error: updateError } = await supabase.auth.updateUser({
      password,
    });
    setLoading(false);

    if (updateError) {
      setError(
        updateError.message.includes("session")
          ? "Lien expiré ou invalide. Demandez un nouveau lien depuis la page de connexion."
          : updateError.message,
      );
      return;
    }

    setSuccess(true);
    setTimeout(() => router.push("/connexion"), 2500);
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50">
      <div className="mx-4 w-full max-w-md">
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
          <CardTitle>Nouveau mot de passe</CardTitle>
          <CardDescription>
            Choisissez un nouveau mot de passe pour votre compte.
          </CardDescription>

          <div className="mt-6">
            {success ? (
              <div className="space-y-3">
                <div className="rounded-xl bg-[#F0F7F4] px-4 py-3 text-sm font-medium text-[#426F59]">
                  ✓ Mot de passe mis à jour ! Redirection en cours…
                </div>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-1">
                  <label
                    htmlFor="password"
                    className="text-sm font-medium text-slate-800"
                  >
                    Nouveau mot de passe
                  </label>
                  <Input
                    id="password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Minimum 8 caractères"
                    required
                    autoFocus
                  />
                </div>

                <div className="space-y-1">
                  <label
                    htmlFor="confirm"
                    className="text-sm font-medium text-slate-800"
                  >
                    Confirmer le mot de passe
                  </label>
                  <Input
                    id="confirm"
                    type="password"
                    value={confirm}
                    onChange={(e) => setConfirm(e.target.value)}
                    placeholder="Répétez le mot de passe"
                    required
                  />
                </div>

                {error && (
                  <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">
                    {error}
                  </p>
                )}

                <Button type="submit" className="w-full" disabled={loading}>
                  {loading
                    ? "Mise à jour…"
                    : "Mettre à jour mon mot de passe"}
                </Button>
              </form>
            )}

            <div className="mt-5 text-center">
              <a
                href="/connexion"
                className="text-sm text-[#426F59] hover:underline"
              >
                ← Retour à la connexion
              </a>
            </div>
          </div>
        </Card>
      </div>
    </main>
  );
}
