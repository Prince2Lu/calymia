"use client";

import { useEffect, useState } from "react";
import { Download, Loader2 } from "lucide-react";

type InvoiceRow = {
  id: string;
  number: string | null;
  status: string | null;
  amount_paid: number;
  currency: string;
  created: number;
  invoice_pdf: string | null;
  hosted_invoice_url: string | null;
};

function formatAmount(amountCents: number, currency: string) {
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: currency.toUpperCase(),
  }).format(amountCents / 100);
}

function formatDate(unixSeconds: number) {
  return new Date(unixSeconds * 1000).toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
}

function StatusBadge({ status }: { status: string | null }) {
  if (status === "paid") {
    return (
      <span className="inline-flex rounded-full bg-[#F0F7F4] px-2.5 py-0.5 text-xs font-semibold text-[#426F59]">
        Payée
      </span>
    );
  }
  if (status === "open") {
    return (
      <span className="inline-flex rounded-full bg-orange-50 px-2.5 py-0.5 text-xs font-semibold text-orange-700">
        En attente
      </span>
    );
  }
  return (
    <span className="inline-flex rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-semibold text-slate-500">
      {status ?? "—"}
    </span>
  );
}

export default function InvoiceHistoryTable() {
  const [invoices, setInvoices] = useState<InvoiceRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch("/api/stripe/invoices");
        const data = (await res.json().catch(() => null)) as
          | { invoices?: InvoiceRow[]; error?: string }
          | null;

        if (!res.ok) {
          if (!cancelled) {
            setError(
              data?.error ?? "Impossible de charger l’historique de facturation.",
            );
            setInvoices([]);
          }
          return;
        }

        if (!cancelled) {
          setInvoices(data?.invoices ?? []);
        }
      } catch {
        if (!cancelled) {
          setError("Impossible de charger l’historique de facturation.");
          setInvoices([]);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-100 px-6 py-4">
        <h2 className="text-lg font-semibold text-[#1E3A5F]">
          Historique de facturation
        </h2>
        <p className="mt-1 text-sm text-slate-500">
          Vos factures d&apos;abonnement Calymia (12 dernières).
        </p>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-[#426F59]" />
        </div>
      ) : error ? (
        <p className="px-6 py-8 text-center text-sm text-red-600">{error}</p>
      ) : invoices.length === 0 ? (
        <p className="px-6 py-8 text-center text-sm text-slate-500">
          Aucune facture pour le moment
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[480px] border-collapse text-sm">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50">
                <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-400">
                  Date
                </th>
                <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-400">
                  Montant
                </th>
                <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-400">
                  Statut
                </th>
                <th className="px-6 py-3 text-right text-xs font-semibold uppercase tracking-wide text-slate-400">
                  Téléchargement
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {invoices.map((inv) => {
                const downloadUrl = inv.invoice_pdf ?? inv.hosted_invoice_url;
                return (
                  <tr key={inv.id} className="hover:bg-slate-50">
                    <td className="px-6 py-3 text-slate-700">
                      {formatDate(inv.created)}
                      {inv.number ? (
                        <span className="mt-0.5 block text-xs text-slate-400">
                          {inv.number}
                        </span>
                      ) : null}
                    </td>
                    <td className="px-6 py-3 font-medium text-slate-900">
                      {formatAmount(inv.amount_paid, inv.currency)}
                    </td>
                    <td className="px-6 py-3">
                      <StatusBadge status={inv.status} />
                    </td>
                    <td className="px-6 py-3 text-right">
                      {downloadUrl ? (
                        <a
                          href={downloadUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1.5 rounded-lg border border-[#d1d5db] bg-white px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50"
                        >
                          <Download className="h-3.5 w-3.5 shrink-0" />
                          Télécharger
                        </a>
                      ) : (
                        <span
                          className="inline-flex cursor-not-allowed items-center gap-1.5 rounded-lg border border-slate-100 bg-slate-50 px-2.5 py-1 text-xs font-medium text-slate-400"
                          title="PDF non disponible pour cette facture"
                        >
                          <Download className="h-3.5 w-3.5 shrink-0" />
                          Télécharger
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
