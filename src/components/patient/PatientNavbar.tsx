"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { createBrowserClient } from "@supabase/ssr";
import { LogOut } from "lucide-react";

export default function PatientNavbar() {
  const router = useRouter();
  const [signingOut, setSigningOut] = useState(false);

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );

  const handleSignOut = async () => {
    setSigningOut(true);
    await supabase.auth.signOut();
    router.push("/connexion");
  };

  return (
    <header className="sticky top-0 z-40 flex h-16 items-center border-b border-[#E5E7EB] bg-white px-6">
      {/* Logo */}
      <div className="flex-1">
        <Image
          src="/logo.webp"
          alt="Calymia"
          width={120}
          height={40}
          priority
          className="object-contain"
        />
      </div>

      {/* Centre */}
      <span className="text-sm font-semibold text-[#426F59]">Mon espace</span>

      {/* Déconnexion */}
      <div className="flex flex-1 justify-end">
        <button
          onClick={handleSignOut}
          disabled={signingOut}
          className="flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm font-medium text-slate-500 transition-colors hover:bg-red-50 hover:text-red-600 disabled:opacity-50"
        >
          <LogOut className="h-4 w-4 shrink-0" />
          {signingOut ? "Déconnexion…" : "Se déconnecter"}
        </button>
      </div>
    </header>
  );
}
