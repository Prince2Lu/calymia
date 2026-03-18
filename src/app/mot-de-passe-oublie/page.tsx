"use client";

import { useState } from "react";
import Image from "next/image";
import { createBrowserClient } from "@supabase/ssr";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export default function MotDePasseOubliePage() {
  const [email, setEmail] = useState("");
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
    const trimmed = email.trim();
    if (!trimmed) {
      setError("Merci de saisir votre email.");
      return;
    }
    setLoading(true);
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(
      trimmed,
      {
        redirectTo:
          window.location.origin + "/reinitialiser-mot-de-passe",
      },
    );
    setLoading(false);
    if (resetError) {
      setError("Une erreur est survenue. Vérifiez votre email et réessayez.");
    } else {
      setSuccess(true);
    }
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
          <CardTitle>Mot de passe oublié</CardTitle>
          <CardDescription>
            Entrez votre email pour recevoir un lien de réinitialisation.
          </CardDescription>

          <div className="mt-6">
            {success ? (
              <div className="space-y-4">
                <div className="rounded-xl bg-[#F0F7F4] px-4 py-3 text-sm font-medium text-[#426F59]">
                  Email envoyé ! Vérifiez votre boîte mail.
                </div>
                <p className="text-xs text-slate-500">
                  Si cet email est associé à un compte Calymia, vous recevrez
                  un lien valable 1 heure.
                </p>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-1">
                  <label
                    htmlFor="email"
                    className="text-sm font-medium text-slate-800"
                  >
                    Email
                  </label>
                  <Input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="votre@email.com"
                    required
                    autoFocus
                  />
                </div>

                {error && (
                  <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">
                    {error}
                  </p>
                )}

                <Button type="submit" className="w-full" disabled={loading}>
                  {loading ? "Envoi en cours…" : "Envoyer le lien"}
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
