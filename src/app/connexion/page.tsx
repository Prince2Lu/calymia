"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createBrowserClient } from "@supabase/ssr";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

type SignInState = {
  error?: string;
};

function SignInForm() {
  const [state, setState] = useState<SignInState>({});
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

    if (!email || !password) {
      setState({
        error: "Merci de renseigner votre email et votre mot de passe.",
      });
      setLoading(false);
      return;
    }

    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error || !data.user) {
      setState({
        error:
          "Identifiants incorrects. Vérifiez votre email et votre mot de passe.",
      });
      setLoading(false);
      return;
    }

    const role =
      (data.user.user_metadata as { role?: string } | null | undefined)
        ?.role ?? "sophrologue";

    if (role === "patient") {
      router.push("/patient");
    } else {
      router.push("/dashboard");
    }
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="space-y-5"
    >
      <div className="space-y-1">
        <label htmlFor="email" className="text-sm font-medium text-slate-800">
          Email
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
      </div>

      {state.error ? (
        <p className="text-sm text-red-600">{state.error}</p>
      ) : (
        <p className="text-xs text-slate-500">
          En cas de difficulté de connexion, vérifiez que votre email a bien
          été confirmé.
        </p>
      )}

      <div className="flex items-center justify-between text-xs">
        <a href="/mot-de-passe-oublie" className="text-[#2E75B6]">
          Mot de passe oublié
        </a>
        <span className="text-slate-500">
          Pas encore de compte ?{" "}
          <a href="/inscription" className="text-[#2E75B6] font-medium">
            S’inscrire
          </a>
        </span>
      </div>

      <Button
        type="submit"
        className="w-full bg-[#1E3A5F] hover:bg-[#2E75B6]"
        disabled={loading}
      >
        Se connecter
      </Button>
    </form>
  );
}

export default function ConnexionPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50">
      <div className="mx-4 w-full max-w-md">
        <Card>
          <CardTitle>Connexion</CardTitle>
          <CardDescription>
            Accédez à votre espace Calymia pour gérer vos patients et séances.
          </CardDescription>
          <div className="mt-2">
            <Badge>Pour sophrologues et patients</Badge>
          </div>
          <div className="mt-6">
            <SignInForm />
          </div>
        </Card>
      </div>
    </main>
  );
}

