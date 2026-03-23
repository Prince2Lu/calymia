"use client";

import { useState } from "react";
import { usePlan } from "@/hooks/usePlan";

const TOAST_MSG =
  "Bientôt disponible — contactez nous à contact@calymia.com";

export default function AbonnementPage() {
  const { plan, loading } = usePlan();
  const [toast, setToast] = useState<string | null>(null);

  const showStubToast = () => {
    setToast(TOAST_MSG);
    window.setTimeout(() => setToast(null), 3200);
  };

  if (loading) {
    return (
      <main className="min-h-screen bg-slate-50">
        <div className="mx-auto max-w-4xl px-4 py-10">
          <p className="text-sm text-slate-500">Chargement…</p>
        </div>
      </main>
    );
  }

  const tierIds = ["essentiel", "professionnel", "cabinet"] as const;

  return (
    <main className="min-h-screen bg-slate-50">
      <div className="mx-auto max-w-5xl space-y-8 px-4 py-10">
        <div>
          <h1 className="text-3xl font-semibold text-[#1E3A5F]">Abonnement</h1>
          <p className="mt-1 text-sm text-slate-500">
            Votre formule actuelle :{" "}
            <span className="font-medium capitalize text-[#426F59]">{plan}</span>
          </p>
        </div>

        {/* Tableau comparatif */}
        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
          <table className="w-full min-w-[520px] border-collapse text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50">
                <th className="px-4 py-3 text-left font-semibold text-slate-600">
                  Formule
                </th>
                <th className="px-4 py-3 text-left font-semibold text-[#1E3A5F]">
                  Essentiel — 29 € / mois
                </th>
                <th className="px-4 py-3 text-left font-semibold text-[#1E3A5F]">
                  Professionnel — 59 € / mois
                </th>
                <th className="px-4 py-3 text-left font-semibold text-[#1E3A5F]">
                  Cabinet — 139 € / mois
                </th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-b border-slate-100">
                <td className="px-4 py-3 font-medium text-slate-600">Clients</td>
                <td className="px-4 py-3 text-slate-700">15 max</td>
                <td className="px-4 py-3 text-slate-700">Illimités</td>
                <td className="px-4 py-3 text-slate-700">Illimités</td>
              </tr>
              <tr className="border-b border-slate-100">
                <td className="px-4 py-3 font-medium text-slate-600">
                  Notes de séance
                </td>
                <td className="px-4 py-3 text-slate-700">—</td>
                <td className="px-4 py-3 text-slate-700">Inclus</td>
                <td className="px-4 py-3 text-slate-700">Inclus</td>
              </tr>
              <tr className="border-b border-slate-100">
                <td className="px-4 py-3 font-medium text-slate-600">
                  Modèles d&apos;emails
                </td>
                <td className="px-4 py-3 text-slate-700">—</td>
                <td className="px-4 py-3 text-slate-700">Inclus</td>
                <td className="px-4 py-3 text-slate-700">Inclus</td>
              </tr>
              <tr className="border-b border-slate-100">
                <td className="px-4 py-3 font-medium text-slate-600">
                  Photos vitrine
                </td>
                <td className="px-4 py-3 text-slate-700">3</td>
                <td className="px-4 py-3 text-slate-700">5</td>
                <td className="px-4 py-3 text-slate-700">10</td>
              </tr>
              <tr>
                <td className="px-4 py-4 font-medium text-slate-600"> </td>
                {tierIds.map((id) => (
                  <td key={id} className="px-4 py-4 align-top">
                    <button
                      type="button"
                      onClick={showStubToast}
                      className={`w-full min-w-[140px] rounded-full px-4 py-2 text-xs font-semibold transition-colors ${
                        plan === id
                          ? "border border-[#426F59] bg-[#F0F7F4] text-[#426F59]"
                          : "bg-[#426F59] text-white hover:bg-[#355748]"
                      }`}
                    >
                      {plan === id ? "Formule actuelle" : "Choisir ce plan"}
                    </button>
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>

        <p className="text-center text-xs text-slate-500">
          Paiement sécurisé via Stripe — bientôt disponible. En attendant, écrivez-nous à{" "}
          <a
            href="mailto:contact@calymia.com"
            className="font-medium text-[#426F59] underline"
          >
            contact@calymia.com
          </a>
          .
        </p>
      </div>

      {toast && (
        <div className="fixed bottom-6 left-1/2 z-[60] max-w-md -translate-x-1/2 rounded-xl bg-[#426F59] px-5 py-3 text-center text-sm font-medium text-white shadow-lg">
          {toast}
        </div>
      )}
    </main>
  );
}
