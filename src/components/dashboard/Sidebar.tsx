"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import Image from "next/image";
import { createBrowserClient } from "@supabase/ssr";
import {
  LayoutDashboard,
  Calendar,
  Users,
  MessageSquare,
  Mail,
  Settings,
  CreditCard,
  LogOut,
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

type NavItem = {
  label: string;
  href: string;
  icon: React.ReactNode;
};

type SophrologueInfo = {
  prenom: string | null;
  nom: string | null;
  plan: string | null;
};

// ─── Nav items ────────────────────────────────────────────────────────────────

const NAV_ITEMS: NavItem[] = [
  {
    label: "Tableau de bord",
    href: "/dashboard",
    icon: <LayoutDashboard className="h-4 w-4" />,
  },
  {
    label: "Mon agenda",
    href: "/seances",
    icon: <Calendar className="h-4 w-4" />,
  },
  {
    label: "Mes clients",
    href: "/clients",
    icon: <Users className="h-4 w-4" />,
  },
  {
    label: "Communications",
    href: "/communications",
    icon: <MessageSquare className="h-4 w-4" />,
  },
  {
    label: "Modèles d'emails",
    href: "/dashboard/emails",
    icon: <Mail className="h-4 w-4" />,
  },
  {
    label: "Abonnement",
    href: "/dashboard/abonnement",
    icon: <CreditCard className="h-4 w-4" />,
  },
  {
    label: "Paramètres",
    href: "/parametres",
    icon: <Settings className="h-4 w-4" />,
  },
];

// ─── Sidebar ──────────────────────────────────────────────────────────────────

export default function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const [sophrologue, setSophrologue] = useState<SophrologueInfo | null>(null);
  const [signingOut, setSigningOut] = useState(false);

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user || cancelled) return;

      const { data } = await supabase
        .from("sophrologues")
        .select("prenom, nom, plan")
        .eq("user_id", user.id)
        .maybeSingle<SophrologueInfo>();

      if (!cancelled) setSophrologue(data ?? null);
    };
    load();
    return () => {
      cancelled = true;
    };
  }, [supabase]);

  const handleSignOut = async () => {
    setSigningOut(true);
    await supabase.auth.signOut();
    router.push("/connexion");
  };

  const isActive = (href: string) => {
    if (href === "/dashboard") return pathname === "/dashboard";
    return pathname === href || pathname.startsWith(`${href}/`);
  };

  const fullName =
    `${sophrologue?.prenom ?? ""} ${sophrologue?.nom ?? ""}`.trim() ||
    "Mon compte";

  return (
    <aside className="fixed inset-y-0 left-0 z-40 flex w-60 flex-col border-r border-[#E5E7EB] bg-white">
      {/* ── Logo ─────────────────────────────────────────────────── */}
      <div className="flex items-center justify-center border-b border-[#E5E7EB] px-6 py-6">
        <Image
          src="/logo.webp"
          alt="Calymia"
          width={160}
          height={48}
          priority
          className="object-contain"
        />
      </div>

      {/* ── Navigation ───────────────────────────────────────────── */}
      <nav className="flex-1 overflow-y-auto px-3 py-4">
        <ul className="space-y-0.5">
          {NAV_ITEMS.map((item) => {
            const active = isActive(item.href);
            return (
              <li key={item.href}>
                <a
                  href={item.href}
                  className={`group flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors ${
                    active
                      ? "border-l-[3px] border-[#426F59] bg-[#F0F7F4] pl-[9px] font-semibold text-[#426F59]"
                      : "font-medium text-[#426F59]/70 hover:bg-[#F0F7F4] hover:text-[#426F59]"
                  }`}
                >
                  <span
                    className={`shrink-0 ${
                      active
                        ? "text-[#426F59]"
                        : "text-[#426F59]/50 group-hover:text-[#426F59]"
                    }`}
                  >
                    {item.icon}
                  </span>
                  <span className="flex-1 truncate">{item.label}</span>
                </a>
              </li>
            );
          })}
        </ul>
      </nav>

      {/* ── Pied de sidebar ──────────────────────────────────────── */}
      <div className="border-t border-[#E5E7EB] px-4 py-4">
        <div className="mb-3 border-b border-gray-100 px-0 py-3">
          <div className="flex items-center justify-between">
            <span className="text-xs text-gray-500">Plan actuel</span>
            <span
              className={`rounded-full px-2 py-1 text-xs font-medium capitalize ${
                (sophrologue?.plan ?? "").toLowerCase() === "essentiel"
                  ? "bg-gray-100 text-gray-600"
                  : (sophrologue?.plan ?? "").toLowerCase() === "professionnel"
                    ? "bg-[#EAF3DE] text-[#3B6D11]"
                    : (sophrologue?.plan ?? "").toLowerCase() === "cabinet"
                      ? "bg-[#EEF2FF] text-[#4338CA]"
                      : "bg-gray-100 text-gray-600"
              }`}
            >
              {sophrologue?.plan ?? "—"}
            </span>
          </div>
        </div>

        {/* Infos utilisateur */}
        <div className="mb-3 flex items-center gap-3">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#F0F7F4] text-xs font-bold text-[#426F59]">
            {(sophrologue?.prenom?.[0] ?? "?").toUpperCase()}
          </div>
          <div className="min-w-0 flex-1 space-y-0.5">
            <p className="truncate text-sm font-medium text-[#426F59]">
              {fullName}
            </p>
          </div>
        </div>

        {/* Bouton déconnexion */}
        <button
          onClick={handleSignOut}
          disabled={signingOut}
          className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-[#426F59]/60 transition-colors hover:bg-red-50 hover:text-red-600 disabled:opacity-50"
        >
          <LogOut className="h-4 w-4 shrink-0" />
          {signingOut ? "Déconnexion…" : "Se déconnecter"}
        </button>
      </div>
    </aside>
  );
}
