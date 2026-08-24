"use client";

import { useState } from "react";
import { PaymentForm } from "@/components/booking/PaymentForm";
import { Button } from "@/components/ui/button";
import { formatParisTime } from "@/lib/timezone";

type PaiementRecap = {
  sophrologue_nom: string;
  type_seance_nom: string;
  debut_at: string;
  montant: number;
  seance_id: string;
};

export function PaiementManuelCheckout({
  token,
  recap,
}: {
  token: string;
  recap: PaiementRecap;
}) {
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [amount, setAmount] = useState(recap.montant);
  const [seanceId, setSeanceId] = useState<string>(recap.seance_id);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [paid, setPaid] = useState(false);

  const dateHeure = formatParisTime(recap.debut_at, "dateTimeLong");

  const startPayment = async () => {
    setError(null);
    setLoading(true);
    try {
      const res = await fetch(
        `/api/public/paiement-manuel/${encodeURIComponent(token)}/create-intent`,
        { method: "POST" },
      );
      const json = (await res.json().catch(() => null)) as {
        clientSecret?: string;
        seance_id?: string;
        amount?: number;
        error?: string;
      } | null;
      if (!res.ok || !json?.clientSecret || !json.seance_id) {
        setError(json?.error ?? "Impossible d'initialiser le paiement.");
        return;
      }
      setClientSecret(json.clientSecret);
      setSeanceId(String(json.seance_id));
      if (typeof json.amount === "number") setAmount(json.amount);
    } catch {
      setError("Erreur réseau. Merci de réessayer.");
    } finally {
      setLoading(false);
    }
  };

  if (paid) {
    return (
      <div className="space-y-3 text-center">
        <p className="text-lg font-semibold text-[#1E3A5F]">
          Paiement confirmé, votre séance est validée
        </p>
        <p className="text-sm text-slate-600">
          Vous recevrez un email de confirmation avec les détails du rendez-vous.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div>
        <p className="text-lg font-semibold text-[#1E3A5F]">Régler votre séance</p>
        <p className="mt-1 text-sm text-slate-600">
          {recap.sophrologue_nom} a noté ce rendez-vous pour vous. Réglez en ligne
          pour le confirmer.
        </p>
      </div>

      <div
        className="rounded-xl border border-[#C8DDD4] px-5 py-4 text-sm text-slate-800"
        style={{ background: "#EAF3DE" }}
      >
        <p className="mb-1">📅 {dateHeure}</p>
        <p className="mb-1">🧘 {recap.type_seance_nom}</p>
        <p className="mb-1">👤 {recap.sophrologue_nom}</p>
        <p>💶 {recap.montant.toFixed(2)} €</p>
      </div>

      {clientSecret ? (
        <PaymentForm
          amount={amount}
          clientSecret={clientSecret}
          seanceId={seanceId}
          onSuccess={() => setPaid(true)}
        />
      ) : (
        <>
          {error ? <p className="text-sm text-red-600">{error}</p> : null}
          <Button
            type="button"
            className="w-full bg-[#27AE60] text-white hover:bg-green-700"
            onClick={() => void startPayment()}
            disabled={loading}
          >
            {loading ? "Préparation…" : "Procéder au paiement"}
          </Button>
        </>
      )}
    </div>
  );
}
