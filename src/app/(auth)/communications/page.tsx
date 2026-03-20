"use client";

import { useCallback, useEffect, useState } from "react";
import { createBrowserClient } from "@supabase/ssr";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

const PAGE_SIZE = 20;

type CommRow = {
  id: string;
  sent_at: string;
  type: string;
  objet: string | null;
  statut: string;
  destinataire_email: string | null;
  destinataire_nom: string | null;
};

type TypeFilter = "tous" | "confirmation" | "annulation" | "rappel";

function labelType(type: string) {
  const map: Record<string, string> = {
    confirmation_reservation: "Confirmation (client)",
    confirmation_reservation_praticien: "Confirmation (praticien)",
    annulation_client: "Annulation (client)",
    annulation_praticien: "Annulation (praticien)",
    bienvenue_sophrologue: "Bienvenue praticien",
    bienvenue_client: "Bienvenue client",
    rappel_j1: "Rappel J-1",
    post_seance: "Après séance",
  };
  return map[type] ?? type.replace(/_/g, " ");
}

function badgeTypeClass(type: string) {
  if (type.startsWith("confirmation"))
    return "bg-[#426F59]/15 text-[#426F59] ring-1 ring-[#426F59]/25";
  if (type.startsWith("annulation"))
    return "bg-red-50 text-red-700 ring-1 ring-red-200";
  if (type.includes("rappel"))
    return "bg-[#2E75B6]/10 text-[#2E75B6] ring-1 ring-[#2E75B6]/20";
  if (type.startsWith("bienvenue"))
    return "bg-emerald-50 text-emerald-800 ring-1 ring-emerald-200";
  return "bg-slate-100 text-slate-700 ring-1 ring-slate-200";
}

function badgeStatutClass(statut: string) {
  if (statut === "envoye")
    return "bg-[#426F59]/15 text-[#426F59] ring-1 ring-[#426F59]/20";
  return "bg-red-50 text-red-700 ring-1 ring-red-200";
}

function formatDateTime(iso: string) {
  return new Intl.DateTimeFormat("fr-FR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(iso));
}

/** Affichage colonne client : nom préféré, sinon email */
function displayDestinataire(row: CommRow) {
  const nom = row.destinataire_nom?.trim();
  if (nom) return nom;
  const email = row.destinataire_email?.trim();
  if (email) return email;
  return "—";
}

export default function CommunicationsPage() {
  const [sophrologueId, setSophrologueId] = useState<string | null>(null);
  const [notSophrologue, setNotSophrologue] = useState(false);
  const [rows, setRows] = useState<CommRow[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [page, setPage] = useState(1);
  const [typeFilter, setTypeFilter] = useState<TypeFilter>("tous");
  const [loading, setLoading] = useState(true);

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );

  const load = useCallback(
    async (sid: string, filter: TypeFilter, pageIndex: number) => {
      setLoading(true);
      const from = (pageIndex - 1) * PAGE_SIZE;
      const to = from + PAGE_SIZE - 1;

      let q = supabase
        .from("communications")
        .select(
          "id, sent_at, type, objet, statut, destinataire_email, destinataire_nom",
          { count: "exact" },
        )
        .eq("sophrologue_id", sid)
        .order("sent_at", { ascending: false });

      if (filter === "confirmation") {
        q = q.like("type", "confirmation%");
      } else if (filter === "annulation") {
        q = q.like("type", "annulation%");
      } else if (filter === "rappel") {
        q = q.ilike("type", "%rappel%");
      }

      const { data, error, count } = await q.range(from, to);

      if (error) {
        console.error("[communications]", error);
        setRows([]);
        setTotalCount(0);
      } else {
        setRows((data ?? []) as CommRow[]);
        setTotalCount(count ?? 0);
      }
      setLoading(false);
    },
    [supabase],
  );

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user || cancelled) {
        setLoading(false);
        return;
      }

      const { data: sophrologue } = await supabase
        .from("sophrologues")
        .select("id")
        .eq("user_id", user.id)
        .maybeSingle<{ id: string }>();

      if (cancelled) return;

      if (!sophrologue) {
        setNotSophrologue(true);
        setLoading(false);
        return;
      }

      setSophrologueId(sophrologue.id);
    })();
    return () => {
      cancelled = true;
    };
  }, [supabase]);

  useEffect(() => {
    if (!sophrologueId) return;
    void load(sophrologueId, typeFilter, page);
  }, [sophrologueId, typeFilter, page, load]);

  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));

  const filterButtons: { key: TypeFilter; label: string }[] = [
    { key: "tous", label: "Tous" },
    { key: "confirmation", label: "Confirmation" },
    { key: "annulation", label: "Annulation" },
    { key: "rappel", label: "Rappel" },
  ];

  if (notSophrologue) {
    return (
      <main className="min-h-screen bg-slate-50">
        <div className="mx-auto max-w-4xl px-4 py-10">
          <p className="rounded-xl border border-slate-200 bg-white p-6 text-sm text-slate-600">
            Ce journal est réservé aux comptes praticien.
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-50">
      <div className="mx-auto max-w-6xl space-y-6 px-4 py-10">
        <div>
          <h1 className="text-3xl font-semibold text-[#1E3A5F]">
            Communications
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Journal des emails envoyés à vos clients et à vous-même.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          {filterButtons.map(({ key, label }) => (
            <button
              key={key}
              type="button"
              onClick={() => {
                setTypeFilter(key);
                setPage(1);
              }}
              className={`rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
                typeFilter === key
                  ? "bg-[#426F59] text-white shadow-sm"
                  : "bg-white text-[#426F59] ring-1 ring-[#426F59]/30 hover:bg-[#F0F7F4]"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-[#F0F7F4] text-[#426F59]">
                  <th className="px-4 py-3 font-semibold">Date</th>
                  <th className="px-4 py-3 font-semibold">Client / Destinataire</th>
                  <th className="px-4 py-3 font-semibold">Type</th>
                  <th className="px-4 py-3 font-semibold">Objet</th>
                  <th className="px-4 py-3 font-semibold">Statut</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-16 text-center text-slate-500">
                      <Loader2 className="mx-auto h-8 w-8 animate-spin text-[#426F59]" />
                    </td>
                  </tr>
                ) : rows.length === 0 ? (
                  <tr>
                    <td
                      colSpan={5}
                      className="px-4 py-12 text-center text-slate-500"
                    >
                      Aucune communication pour ce filtre.
                    </td>
                  </tr>
                ) : (
                  rows.map((row) => (
                    <tr
                      key={row.id}
                      className="border-b border-slate-100 last:border-0 hover:bg-slate-50/80"
                    >
                      <td className="whitespace-nowrap px-4 py-3 text-slate-700">
                        {formatDateTime(row.sent_at)}
                      </td>
                      <td className="max-w-[200px] truncate px-4 py-3 text-slate-800">
                        {displayDestinataire(row)}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${badgeTypeClass(row.type)}`}
                        >
                          {labelType(row.type)}
                        </span>
                      </td>
                      <td className="max-w-[240px] truncate px-4 py-3 text-slate-600">
                        {row.objet?.trim() || "—"}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium capitalize ${badgeStatutClass(row.statut)}`}
                        >
                          {row.statut === "envoye" ? "Envoyé" : "Échec"}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {totalCount > PAGE_SIZE && (
          <div className="flex flex-wrap items-center justify-between gap-4">
            <p className="text-sm text-slate-500">
              {totalCount} entrée{totalCount > 1 ? "s" : ""} · page {page} /{" "}
              {totalPages}
            </p>
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={page <= 1 || loading}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="border-[#426F59]/40 text-[#426F59] hover:bg-[#F0F7F4]"
              >
                Précédent
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={page >= totalPages || loading}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                className="border-[#426F59]/40 text-[#426F59] hover:bg-[#F0F7F4]"
              >
                Suivant
              </Button>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
