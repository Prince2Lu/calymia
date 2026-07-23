"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import Image from "next/image";
import {
  LayoutDashboard,
  Calendar,
  Users,
  MessageSquare,
  Mail,
  Settings,
  CreditCard,
  Star,
  LogOut,
} from "lucide-react";
import { getSidebarPlanBadge } from "@/lib/billing/trial-status";
import { useSophrologue } from "@/components/providers/SophrologueProvider";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

// ─── Types ────────────────────────────────────────────────────────────────────

type NavItem = {
  label: string;
  href: string;
  icon: React.ReactNode;
};

const AVIS_HREF = "/dashboard/avis";
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
    label: "Avis",
    href: AVIS_HREF,
    icon: <Star className="h-4 w-4" />,
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
  const sophrologue = useSophrologue();
  const [avisEnAttente, setAvisEnAttente] = useState(0);
  const [signingOut, setSigningOut] = useState(false);

  // Badge avis seulement — user/sophrologue viennent du layout (SSR + contexte)
  useEffect(() => {
    let cancelled = false;
    const supabase = createSupabaseBrowserClient();
    const load = async () => {
      const { count } = await supabase
        .from("avis")
        .select("id", { count: "exact", head: true })
        .eq("sophrologue_id", sophrologue.id)
        .eq("statut", "en_attente");

      if (!cancelled) setAvisEnAttente(count ?? 0);
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, [sophrologue.id]);

  const handleSignOut = async () => {
    setSigningOut(true);
    const supabase = createSupabaseBrowserClient();
    await supabase.auth.signOut();
    router.push("/connexion");
  };

  const isActive = (href: string) => {
    if (href === "/dashboard") return pathname === "/dashboard";
    return pathname === href || pathname.startsWith(`${href}/`);
  };

  const fullName =
    `${sophrologue.prenom ?? ""} ${sophrologue.nom ?? ""}`.trim() ||
    "Mon compte";

  const planBadge = getSidebarPlanBadge(
    sophrologue.plan,
    sophrologue.trial_ends_at,
  );

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
                  {item.href === AVIS_HREF && avisEnAttente > 0 && (
                    <span className="ml-auto inline-flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-red-500 px-1.5 text-xs font-semibold text-white">
                      {avisEnAttente > 9 ? "9+" : avisEnAttente}
                    </span>
                  )}
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
              className={`inline-flex max-w-[9.5rem] items-center justify-end rounded-full px-2 py-1 text-right leading-tight ${planBadge.className}`}
            >
              {planBadge.label}
            </span>
          </div>
        </div>

        {/* Infos utilisateur */}
        <div className="mb-3 flex items-center gap-3">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#F0F7F4] text-xs font-bold text-[#426F59]">
            {(sophrologue.prenom?.[0] ?? "?").toUpperCase()}
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
