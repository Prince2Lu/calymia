"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { createBrowserClient } from "@supabase/ssr";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatParisTime } from "@/lib/timezone";

type SeanceRow = {
  id: string;
  debut_at: string;
  fin_at: string;
  statut: string;
  sophrologue: {
    prenom: string | null;
    nom: string | null;
  } | null;
};

type PaiementRow = {
  montant_total: number;
  stripe_payment_intent_id: string | null;
};

type Phase = "loading" | "ready" | "confirming" | "done" | "error";

function formatDateFR(iso: string) {
  return formatParisTime(iso, "dateTimeLong");
}

function calcRefundInfo(debutAt: string): {
  ratio: number;
  label: string;
  colorClass: string;
} {
  const heuresAvant =
    (new Date(debutAt).getTime() - Date.now()) / (1000 * 60 * 60);

  if (heuresAvant > 24) {
    return {
      ratio: 1,
      label: "Annulation > 24h avant la séance : remboursement intégral (100%)",
      colorClass: "bg-[#27AE60]/10 border-[#27AE60]/25 text-[#1E3A5F]",
    };
  }
  if (heuresAvant > 12) {
    return {
      ratio: 0.5,
      label: "Annulation entre 12h et 24h avant la séance : remboursement à 50%",
      colorClass: "bg-amber-50 border-amber-200 text-amber-900",
    };
  }
  return {
    ratio: 0,
    label: "Annulation moins de 12h avant la séance : aucun remboursement",
    colorClass: "bg-red-50 border-red-200 text-red-900",
  };
}

export default function AnnulationPage() {
  const { seance_id } = useParams<{ seance_id: string }>();
  const router = useRouter();

  const [phase, setPhase] = useState<Phase>("loading");
  const [seance, setSeance] = useState<SeanceRow | null>(null);
  const [paiement, setPaiement] = useState<PaiementRow | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [montantRembourse, setMontantRembourse] = useState<number | null>(null);
  const [apiError, setApiError] = useState<string | null>(null);

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

      if (!user) {
        router.push("/connexion");
        return;
      }

      if (!cancelled) setUserId(user.id);

      const { data: seanceData } = await supabase
        .from("seances")
        .select(
          "id, debut_at, fin_at, statut, sophrologue:sophrologues(prenom, nom)",
        )
        .eq("id", seance_id)
        .maybeSingle<SeanceRow>();

      const { data: paiementData } = await supabase
        .from("paiements")
        .select("montant_total, stripe_payment_intent_id")
        .eq("seance_id", seance_id)
        .eq("statut", "reussi")
        .maybeSingle<PaiementRow>();

      if (!cancelled) {
        setSeance(seanceData ?? null);
        setPaiement(paiementData ?? null);
        setPhase(seanceData ? "ready" : "error");
      }
    };

    load();
    return () => {
      cancelled = true;
    };
  }, [seance_id, router, supabase]);

  const handleConfirm = async () => {
    if (!seance || !userId) return;
    setPhase("confirming");
    setApiError(null);

    const res = await fetch("/api/reservations/annuler", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ seance_id: seance.id, annule_par: userId }),
    });

    const data = (await res.json().catch(() => null)) as {
      success?: boolean;
      montant_rembourse?: number;
      error?: string;
    } | null;

    if (!res.ok || !data?.success) {
      setApiError(data?.error ?? "Une erreur est survenue. Merci de réessayer.");
      setPhase("ready");
      return;
    }

    setMontantRembourse(data.montant_rembourse ?? 0);
    setPhase("done");
  };

  const refundInfo = seance ? calcRefundInfo(seance.debut_at) : null;
  const montantPaye = paiement?.montant_total ?? null;
  const montantEstime =
    refundInfo && montantPaye != null
      ? Math.round(montantPaye * refundInfo.ratio * 100) / 100
      : null;

  const sophrologueName = seance?.sophrologue
    ? `${seance.sophrologue.prenom ?? ""} ${seance.sophrologue.nom ?? ""}`.trim()
    : "votre sophrologue";

  return (
    <main className="min-h-screen bg-slate-50">
      <div className="mx-auto max-w-lg px-4 py-10">
        <div className="mb-6 space-y-2">
          <Badge>Calymia · Annulation</Badge>
          <h1 className="text-3xl font-semibold text-[#1E3A5F]">
            Annuler une séance
          </h1>
        </div>

        {phase === "loading" && (
          <Card>
            <CardDescription>Chargement des informations…</CardDescription>
          </Card>
        )}

        {phase === "error" && (
          <Card>
            <CardTitle>Séance introuvable</CardTitle>
            <CardDescription className="mt-2">
              Impossible de trouver cette séance. Elle a peut-être déjà été
              annulée ou n'existe pas.
            </CardDescription>
            <Button
              variant="outline"
              className="mt-4"
              onClick={() => router.push("/patient")}
            >
              Retour à mon espace
            </Button>
          </Card>
        )}

        {(phase === "ready" || phase === "confirming") && seance && refundInfo && (
          <div className="space-y-4">
            <Card>
              <CardTitle>Détails de la séance</CardTitle>
              <div className="mt-4 space-y-2 text-sm text-slate-800">
                <p>
                  <span className="font-semibold text-[#1E3A5F]">
                    Sophrologue
                  </span>{" "}
                  : {sophrologueName}
                </p>
                <p>
                  <span className="font-semibold text-[#1E3A5F]">Date</span> :{" "}
                  {formatDateFR(seance.debut_at)}
                </p>
                {montantPaye != null && (
                  <p>
                    <span className="font-semibold text-[#1E3A5F]">
                      Montant payé
                    </span>{" "}
                    : {montantPaye.toFixed(2)}€
                  </p>
                )}
              </div>
            </Card>

            <div
              className={`rounded-xl border p-4 text-sm font-medium ${refundInfo.colorClass}`}
            >
              {refundInfo.label}
              {montantEstime != null && montantEstime > 0 && (
                <p className="mt-1 font-semibold">
                  Montant remboursé estimé : {montantEstime.toFixed(2)}€
                </p>
              )}
              {montantEstime === 0 && (
                <p className="mt-1 font-semibold">
                  Aucun remboursement ne sera effectué.
                </p>
              )}
            </div>

            {apiError && (
              <p className="text-sm text-red-600">{apiError}</p>
            )}

            <div className="flex gap-3">
              <Button
                variant="outline"
                onClick={() => router.back()}
                disabled={phase === "confirming"}
                className="flex-1"
              >
                Retour
              </Button>
              <Button
                onClick={handleConfirm}
                disabled={phase === "confirming"}
                className="flex-1 bg-red-600 text-white hover:bg-red-700"
              >
                {phase === "confirming"
                  ? "Annulation en cours…"
                  : "Confirmer l'annulation"}
              </Button>
            </div>
          </div>
        )}

        {phase === "done" && (
          <Card>
            <div className="rounded-xl border border-[#27AE60]/25 bg-[#27AE60]/10 p-4">
              <p className="text-lg font-semibold text-[#1E3A5F]">
                Séance annulée avec succès
              </p>
              <p className="mt-1 text-sm text-slate-700">
                {montantRembourse != null && montantRembourse > 0
                  ? `Un remboursement de ${montantRembourse.toFixed(2)}€ a été initié. Il apparaîtra sur votre compte dans 5 à 10 jours ouvrés.`
                  : "Aucun remboursement n'a été effectué selon notre politique d'annulation."}
              </p>
            </div>
            <div className="mt-4 flex gap-3">
              <Button
                variant="outline"
                onClick={() => router.push("/patient")}
                className="flex-1"
              >
                Retour à mon espace
              </Button>
              <Button
                onClick={() => router.push("/patient")}
                className="flex-1 bg-[#1E3A5F] hover:bg-[#2E75B6]"
              >
                Retour à mon espace
              </Button>
            </div>
          </Card>
        )}
      </div>
    </main>
  );
}
