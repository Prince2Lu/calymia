"use client";

import { useCallback, useEffect, useState } from "react";
import { Link2, Loader2, RefreshCw, Unplug } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PlanGuard } from "@/components/plan/PlanGuard";
import { usePlan } from "@/hooks/usePlan";
import { formatParisTime } from "@/lib/timezone";

type GoogleStatus = {
  connected: boolean;
  google_email: string | null;
  last_synced_at: string | null;
  last_error: string | null;
};

type ShowToast = (msg: string, ok?: boolean | "neutral") => void;

type IntegrationsTabProps = {
  showToast: ShowToast;
};

function GoogleAgendaPanel({ showToast }: { showToast: ShowToast }) {
  const [status, setStatus] = useState<GoogleStatus | null>(null);
  const [statusLoading, setStatusLoading] = useState(true);
  const [resyncing, setResyncing] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);

  const loadStatus = useCallback(async () => {
    setStatusLoading(true);
    try {
      const res = await fetch("/api/google/status");
      const json = (await res.json().catch(() => null)) as
        | GoogleStatus
        | { error?: string }
        | null;
      if (!res.ok || !json || !("connected" in json)) {
        showToast(
          (json && "error" in json && json.error) ||
            "Impossible de lire le statut Google Agenda.",
          false,
        );
        setStatus({
          connected: false,
          google_email: null,
          last_synced_at: null,
          last_error: null,
        });
        return;
      }
      setStatus(json);
    } catch {
      showToast("Erreur réseau lors du statut Google Agenda.", false);
      setStatus({
        connected: false,
        google_email: null,
        last_synced_at: null,
        last_error: null,
      });
    } finally {
      setStatusLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    void loadStatus();
  }, [loadStatus]);

  const handleResync = async () => {
    setResyncing(true);
    try {
      const res = await fetch("/api/google/resync", { method: "POST" });
      const json = (await res.json().catch(() => null)) as
        | { total?: number; success?: number; errors?: number; error?: string }
        | null;
      if (!res.ok) {
        showToast(json?.error ?? "La resynchronisation a échoué.", false);
        return;
      }
      const total = json?.total ?? 0;
      const success = json?.success ?? 0;
      const errors = json?.errors ?? 0;
      if (total === 0) {
        showToast(
          "Aucune séance confirmée à synchroniser sur les 90 prochains jours.",
        );
      } else if (errors === 0) {
        showToast(
          `${success} séance${success > 1 ? "s" : ""} synchronisée${success > 1 ? "s" : ""}.`,
        );
      } else {
        showToast(
          `${success} OK, ${errors} erreur${errors > 1 ? "s" : ""} sur ${total}.`,
          false,
        );
      }
      await loadStatus();
    } catch {
      showToast("Erreur réseau lors de la resynchronisation.", false);
    } finally {
      setResyncing(false);
    }
  };

  const handleDisconnect = async () => {
    if (!confirm("Déconnecter Google Agenda ?")) return;
    setDisconnecting(true);
    try {
      const res = await fetch("/api/google/oauth/disconnect", {
        method: "POST",
      });
      const json = (await res.json().catch(() => null)) as
        | { error?: string }
        | null;
      if (!res.ok) {
        showToast(json?.error ?? "La déconnexion a échoué.", false);
        return;
      }
      showToast("Google Agenda déconnecté.");
      await loadStatus();
    } catch {
      showToast("Erreur réseau lors de la déconnexion.", false);
    } finally {
      setDisconnecting(false);
    }
  };

  if (statusLoading || !status) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-6 w-6 animate-spin text-[#2E75B6]" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="space-y-3 rounded-xl border border-slate-200 bg-slate-50/80 p-5">
        <h3 className="text-sm font-semibold text-slate-800">Google Agenda</h3>

        {status.connected ? (
          <>
            <p className="text-sm text-slate-800">
              <span className="font-medium text-[#1E3A5F]">Compte</span>
              {" : "}
              {status.google_email ?? "connecté"}
            </p>
            <p className="text-sm text-slate-800">
              <span className="font-medium text-[#1E3A5F]">
                Dernière synchronisation
              </span>
              {" : "}
              {status.last_synced_at
                ? formatParisTime(status.last_synced_at, "dateTimeLong")
                : "Jamais synchronisé"}
            </p>
            {status.last_error ? (
              <p className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-600">
                {status.last_error}
              </p>
            ) : null}
            <div className="flex flex-wrap gap-2 pt-1">
              <Button
                type="button"
                variant="outline"
                className="gap-2"
                onClick={() => void handleResync()}
                disabled={resyncing || disconnecting}
              >
                {resyncing ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <RefreshCw className="h-4 w-4" />
                )}
                Resynchroniser
              </Button>
              <Button
                type="button"
                variant="outline"
                className="gap-2 border-red-200 text-red-600 hover:bg-red-50"
                onClick={() => void handleDisconnect()}
                disabled={resyncing || disconnecting}
              >
                {disconnecting ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Unplug className="h-4 w-4" />
                )}
                Déconnecter
              </Button>
            </div>
          </>
        ) : (
          <Button
            type="button"
            className="gap-2"
            onClick={() => {
              window.location.assign("/api/google/oauth/start");
            }}
          >
            <Link2 className="h-4 w-4" />
            Connecter Google Agenda
          </Button>
        )}
      </div>

      <p className="text-sm text-slate-600">
        Vos séances confirmées apparaissent automatiquement dans un calendrier
        dédié « Calymia » sur votre Google Agenda.
      </p>
    </div>
  );
}

export function IntegrationsTab({ showToast }: IntegrationsTabProps) {
  const { plan, loading: planLoading } = usePlan();

  if (planLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-6 w-6 animate-spin text-[#2E75B6]" />
      </div>
    );
  }

  return (
    <PlanGuard
      requiredPlan="professionnel"
      currentPlan={plan}
      featureName="Google Agenda"
    >
      <GoogleAgendaPanel showToast={showToast} />
    </PlanGuard>
  );
}
