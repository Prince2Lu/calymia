"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
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

    console.log("Login successful, user:", data.user?.id, data.user?.email);

    try {
      const response = await fetch("/api/auth/check-role", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user_id: data.user.id,
          email: data.user.email ?? "",
        }),
      });

      console.log("check-role HTTP status:", response.status);
      const result = (await response.json()) as { role?: string; error?: string };
      console.log("check-role result:", result);

      if (result.role === "sophrologue") {
        router.push("/dashboard");
      } else {
        // patient, unknown, or any error → client space
        router.push("/patient");
      }
    } catch (err) {
      console.error("check-role fetch failed:", err);
      // Safe fallback: send to patient space
      router.push("/patient");
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
        className="w-full"
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
        <div className="mb-8 flex justify-center">
          <Image
            src="/logo.webp"
            alt="Calymia"
            width={260}
            height={104}
            priority
            className="object-contain"
          />
        </div>
        <Card>
          <CardTitle>Connexion</CardTitle>
          <CardDescription>
            Accédez à votre espace Calymia pour gérer vos clients et séances.
          </CardDescription>
          <div className="mt-2">
            <Badge>Pour sophrologues et clients</Badge>
          </div>
          <div className="mt-6">
            <SignInForm />
          </div>
        </Card>
      </div>
    </main>
  );
}

