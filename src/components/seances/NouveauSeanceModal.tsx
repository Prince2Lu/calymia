"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AlertCircle, Loader2, Plus, Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { parisYmdHmToUtc } from "@/lib/timezone";
import { cn } from "@/lib/utils";
import { SEANCES_SELECT, type Seance } from "@/components/seances/types";
import type {
  ExtractionConfiance,
  ExtractionResult,
} from "@/lib/ai/extract-seance-from-message";

type PatientLite = {
  id: string;
  prenom: string | null;
  nom: string | null;
  email: string | null;
  telephone: string | null;
};

type TypeSeanceLite = {
  id: string;
  nom: string;
  duree_minutes: number;
  tarif: number;
  mode: "presentiel" | "visio";
};

type ModeReglement = "hors_plateforme" | "lien_en_ligne";
type EntryMode = "manuel" | "coller";

const EMPTY_CONFIANCE: ExtractionConfiance = {
  prenom: false,
  nom: false,
  email: false,
  telephone: false,
  date: false,
  heure: false,
  type_seance_id: false,
};

function digitsOnly(value: string | null | undefined) {
  return (value ?? "").replace(/\D/g, "");
}

function DetectedHint({ show }: { show: boolean }) {
  if (!show) return null;
  return (
    <span className="ml-1.5 text-[10px] font-medium text-[#426F59]">
      détecté — à vérifier
    </span>
  );
}

function detectedInputClass(detected: boolean) {
  return detected ? "ring-1 ring-[#426F59]/50" : undefined;
}

type Props = {
  sophrologueId: string;
  onClose: () => void;
  onCreated: (seance: Seance) => void;
};

function fullName(prenom: string | null, nom: string | null) {
  return `${prenom ?? ""} ${nom ?? ""}`.trim() || "—";
}

function defaultDateParis(): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Paris",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const y = parts.find((p) => p.type === "year")?.value ?? "2026";
  const m = parts.find((p) => p.type === "month")?.value ?? "01";
  const d = parts.find((p) => p.type === "day")?.value ?? "01";
  return `${y}-${m}-${d}`;
}

function isPastSlot(date: string, time: string): boolean {
  const [y, m, d] = date.split("-").map(Number);
  const [hh, mm] = (time || "00:00").split(":").map(Number);
  if (!y || !m || !d || Number.isNaN(hh) || Number.isNaN(mm)) return false;
  return parisYmdHmToUtc(y, m, d, hh, mm).getTime() < Date.now();
}

export function NouveauSeanceModal({ sophrologueId, onClose, onCreated }: Props) {
  const overlayRef = useRef<HTMLDivElement>(null);
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);

  const [patients, setPatients] = useState<PatientLite[]>([]);
  const [types, setTypes] = useState<TypeSeanceLite[]>([]);
  const [loadingLists, setLoadingLists] = useState(true);

  const [search, setSearch] = useState("");
  const [selectedPatient, setSelectedPatient] = useState<PatientLite | null>(
    null,
  );
  const [newPatientOpen, setNewPatientOpen] = useState(false);
  const [newPatient, setNewPatient] = useState({
    prenom: "",
    nom: "",
    email: "",
    telephone: "",
  });

  const [typeId, setTypeId] = useState<string>("");
  const [date, setDate] = useState(defaultDateParis);
  const [time, setTime] = useState("10:00");
  const [modeReglement, setModeReglement] =
    useState<ModeReglement>("hors_plateforme");
  const [montantDeclare, setMontantDeclare] = useState("");

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [entryMode, setEntryMode] = useState<EntryMode>("manuel");
  const [pasteText, setPasteText] = useState("");
  const [analyzing, setAnalyzing] = useState(false);
  const [extractError, setExtractError] = useState<string | null>(null);
  const [detected, setDetected] = useState<ExtractionConfiance>(EMPTY_CONFIANCE);
  const [patientMatched, setPatientMatched] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      const [{ data: patientRows }, { data: typeRows }] = await Promise.all([
        supabase
          .from("patients")
          .select("id, prenom, nom, email, telephone")
          .eq("sophrologue_id", sophrologueId)
          .order("nom")
          .returns<PatientLite[]>(),
        supabase
          .from("types_seances")
          .select("id, nom, duree_minutes, tarif, mode")
          .eq("sophrologue_id", sophrologueId)
          .eq("actif", true)
          .order("nom"),
      ]);
      if (cancelled) return;
      setPatients(patientRows ?? []);
      const mapped: TypeSeanceLite[] = (typeRows ?? []).map((r) => ({
        id: String(r.id),
        nom: r.nom ?? "Séance",
        duree_minutes: Number(r.duree_minutes) || 60,
        tarif: Number(r.tarif) || 0,
        mode: r.mode === "visio" ? "visio" : "presentiel",
      }));
      setTypes(mapped);
      setLoadingLists(false);
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, [sophrologueId, supabase]);

  const selectedType = types.find((t) => t.id === typeId) ?? null;

  useEffect(() => {
    if (selectedType) {
      setMontantDeclare(selectedType.tarif.toFixed(2));
    }
  }, [selectedType]);

  const filteredPatients = useMemo(() => {
    const q = search.toLowerCase().trim();
    if (!q) return patients;
    return patients.filter(
      (p) =>
        `${p.prenom ?? ""} ${p.nom ?? ""}`.toLowerCase().includes(q) ||
        (p.email ?? "").toLowerCase().includes(q),
    );
  }, [patients, search]);

  const resolvedEmail = newPatientOpen
    ? newPatient.email.trim()
    : (selectedPatient?.email ?? "").trim();
  const hasEmailForLien = resolvedEmail.length > 0;
  const slotInPast = isPastSlot(date, time);
  const canLienEnLigne = hasEmailForLien && !slotInPast;

  useEffect(() => {
    if (modeReglement === "lien_en_ligne" && !canLienEnLigne) {
      setModeReglement("hors_plateforme");
    }
  }, [canLienEnLigne, modeReglement]);

  const canSubmit = Boolean(
    (selectedPatient ||
      (newPatientOpen &&
        newPatient.prenom.trim() &&
        newPatient.nom.trim() &&
        (newPatient.email.trim() || newPatient.telephone.trim()))) &&
      typeId &&
      date &&
      time &&
      (modeReglement === "hors_plateforme" || canLienEnLigne),
  );

  const clearDetected = (key: keyof ExtractionConfiance) => {
    setDetected((prev) => (prev[key] ? { ...prev, [key]: false } : prev));
  };

  const applyExtraction = (result: Extract<ExtractionResult, { ok: true }>) => {
    const email = result.patient.email?.toLowerCase() ?? "";
    const phone = digitsOnly(result.patient.telephone);
    const match =
      (email
        ? patients.find((p) => (p.email ?? "").toLowerCase() === email)
        : undefined) ??
      (phone.length >= 8
        ? patients.find((p) => digitsOnly(p.telephone) === phone)
        : undefined);

    if (match) {
      setSelectedPatient(match);
      setNewPatientOpen(false);
      setSearch("");
      setPatientMatched(true);
    } else {
      setSelectedPatient(null);
      setNewPatientOpen(true);
      setPatientMatched(false);
      setNewPatient({
        prenom: result.patient.prenom ?? "",
        nom: result.patient.nom ?? "",
        email: result.patient.email ?? "",
        telephone: result.patient.telephone ?? "",
      });
    }

    if (result.seance.date) setDate(result.seance.date);
    if (result.seance.heure) setTime(result.seance.heure);
    if (result.seance.type_seance_id) setTypeId(result.seance.type_seance_id);

    setDetected(result.confiance);
    setExtractError(null);
    setError(null);
    setEntryMode("manuel");
  };

  const handleAnalyze = async () => {
    setExtractError(null);
    const trimmed = pasteText.trim();
    if (!trimmed) {
      setExtractError("Message vide");
      return;
    }
    setAnalyzing(true);
    try {
      const res = await fetch("/api/seances/extract-from-message", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: pasteText }),
      });
      const json = (await res.json().catch(() => null)) as
        | ExtractionResult
        | { error?: string }
        | null;

      if (!json || typeof json !== "object") {
        setExtractError("Réponse invalide du serveur. Réessayez.");
        return;
      }
      if ("ok" in json && json.ok === true) {
        applyExtraction(json);
        return;
      }
      if ("ok" in json && json.ok === false) {
        setExtractError(json.error);
        return;
      }
      setExtractError(
        ("error" in json && typeof json.error === "string"
          ? json.error
          : null) ?? "L'analyse a échoué. Réessayez ou passez en saisie manuelle.",
      );
    } catch {
      setExtractError(
        "Erreur réseau. Réessayez ou passez en saisie manuelle.",
      );
    } finally {
      setAnalyzing(false);
    }
  };

  const handleOverlayClick = (e: React.MouseEvent) => {
    if (e.target === overlayRef.current && !submitting && !analyzing) onClose();
  };

  const stubSeance = useCallback(
    (id: string, statut: string, debutAt: string): Seance => ({
      id,
      patient_id: selectedPatient?.id ?? null,
      debut_at: debutAt,
      fin_at: debutAt,
      statut,
      lien_teleconsultation: null,
      patient: selectedPatient
        ? {
            prenom: selectedPatient.prenom,
            nom: selectedPatient.nom,
            email: selectedPatient.email,
            telephone: selectedPatient.telephone,
          }
        : {
            prenom: newPatient.prenom.trim() || null,
            nom: newPatient.nom.trim() || null,
            email: newPatient.email.trim() || null,
            telephone: newPatient.telephone.trim() || null,
          },
      type_seance: selectedType
        ? { nom: selectedType.nom, mode: selectedType.mode }
        : null,
      paiement: null,
    }),
    [newPatient, selectedPatient, selectedType],
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (entryMode !== "manuel" || !canSubmit || !selectedType) return;
    setError(null);

    const [y, m, d] = date.split("-").map(Number);
    const [hh, mm] = time.split(":").map(Number);
    if (!y || !m || !d || Number.isNaN(hh) || Number.isNaN(mm)) {
      setError("Date ou heure invalide.");
      return;
    }
    const debut = parisYmdHmToUtc(y, m, d, hh, mm);
    const debutAt = debut.toISOString();

    const patientPayload = selectedPatient
      ? {
          id: selectedPatient.id,
          prenom: selectedPatient.prenom ?? "",
          nom: selectedPatient.nom ?? "",
          email: selectedPatient.email ?? undefined,
          telephone: selectedPatient.telephone ?? undefined,
        }
      : {
          prenom: newPatient.prenom.trim(),
          nom: newPatient.nom.trim(),
          email: newPatient.email.trim() || undefined,
          telephone: newPatient.telephone.trim() || undefined,
        };

    const montant = Number(montantDeclare.replace(",", "."));

    setSubmitting(true);
    try {
      const res = await fetch("/api/seances/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sophrologue_id: sophrologueId,
          type_seance_id: selectedType.id,
          debut_at: debutAt,
          patient: patientPayload,
          mode_reglement: modeReglement,
          ...(modeReglement === "hors_plateforme" && Number.isFinite(montant)
            ? { montant_declare: montant }
            : {}),
        }),
      });
      const json = (await res.json().catch(() => null)) as {
        seance_id?: string;
        statut?: string;
        error?: string;
      } | null;

      if (res.status === 409) {
        setError("Ce créneau n'est plus disponible (conflit détecté)");
        return;
      }
      if (res.status === 503) {
        setError(
          "Impossible de vérifier votre agenda Google pour le moment, réessayez",
        );
        return;
      }
      if (!res.ok) {
        setError(json?.error ?? "Impossible de créer la séance.");
        return;
      }
      if (!json?.seance_id) {
        setError("Réponse invalide du serveur.");
        return;
      }

      const { data: created } = await supabase
        .from("seances")
        .select(SEANCES_SELECT)
        .eq("id", json.seance_id)
        .maybeSingle<Seance>();

      onCreated(created ?? stubSeance(json.seance_id, json.statut ?? "confirmee", debutAt));
    } catch {
      setError("Erreur réseau. Merci de réessayer.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      ref={overlayRef}
      onClick={handleOverlayClick}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
    >
      <div className="flex max-h-[90vh] w-full max-w-md flex-col rounded-2xl bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
          <h2 className="text-lg font-semibold text-[#1E3A5F]">
            Nouvelle séance
          </h2>
          <button
            type="button"
            onClick={onClose}
            disabled={submitting || analyzing}
            className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form
          onSubmit={handleSubmit}
          className="space-y-5 overflow-y-auto px-6 py-5"
        >
          {loadingLists ? (
            <div className="flex justify-center py-10">
              <Loader2 className="h-6 w-6 animate-spin text-[#2E75B6]" />
            </div>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-1 rounded-xl bg-slate-100 p-1">
                <button
                  type="button"
                  onClick={() => {
                    setEntryMode("manuel");
                    setExtractError(null);
                  }}
                  disabled={analyzing}
                  className={cn(
                    "rounded-lg px-3 py-1.5 text-xs font-medium transition-colors",
                    entryMode === "manuel"
                      ? "bg-white text-[#1E3A5F] shadow-sm"
                      : "text-slate-500 hover:text-slate-700",
                  )}
                >
                  Remplir manuellement
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setEntryMode("coller");
                    setExtractError(null);
                  }}
                  disabled={analyzing}
                  className={cn(
                    "rounded-lg px-3 py-1.5 text-xs font-medium transition-colors",
                    entryMode === "coller"
                      ? "bg-white text-[#1E3A5F] shadow-sm"
                      : "text-slate-500 hover:text-slate-700",
                  )}
                >
                  Coller un message client
                </button>
              </div>

              {entryMode === "coller" ? (
                <section className="space-y-3">
                  <p className="text-sm text-slate-600">
                    Collez un email, SMS ou message WhatsApp. Les champs du
                    formulaire seront pré-remplis — à vérifier avant de créer
                    la séance.
                  </p>
                  <textarea
                    value={pasteText}
                    onChange={(e) => setPasteText(e.target.value)}
                    disabled={analyzing}
                    rows={8}
                    placeholder="Bonjour, je m'appelle… je voudrais un rendez-vous jeudi prochain à 14h…"
                    className="w-full resize-y rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-800 placeholder:text-slate-400 focus:border-[#426F59] focus:outline-none focus:ring-1 focus:ring-[#426F59]/40 disabled:bg-slate-50"
                  />
                  {extractError && (
                    <div className="space-y-2 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">
                      <p>{extractError}</p>
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          className="text-xs font-medium text-[#426F59] hover:underline"
                          onClick={() => {
                            setExtractError(null);
                            void handleAnalyze();
                          }}
                          disabled={analyzing}
                        >
                          Réessayer
                        </button>
                        <button
                          type="button"
                          className="text-xs font-medium text-[#426F59] hover:underline"
                          onClick={() => {
                            setEntryMode("manuel");
                            setExtractError(null);
                          }}
                        >
                          Saisie manuelle
                        </button>
                      </div>
                    </div>
                  )}
                  <Button
                    type="button"
                    className="w-full"
                    onClick={() => void handleAnalyze()}
                    disabled={analyzing || !pasteText.trim()}
                  >
                    {analyzing ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Analyse en cours…
                      </>
                    ) : (
                      "Analyser"
                    )}
                  </Button>
                </section>
              ) : (
                <>
              <section className="space-y-2">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                  Patient
                </p>
                {selectedPatient && !newPatientOpen ? (
                  <div
                    className={cn(
                      "flex items-center justify-between rounded-xl border bg-slate-50 px-3 py-2",
                      patientMatched
                        ? "border-[#426F59] ring-1 ring-[#426F59]/40"
                        : "border-slate-200",
                    )}
                  >
                    <div>
                      <p className="text-sm font-medium text-slate-800">
                        {fullName(selectedPatient.prenom, selectedPatient.nom)}
                        {patientMatched ? (
                          <DetectedHint show />
                        ) : null}
                      </p>
                      <p className="text-xs text-slate-500">
                        {selectedPatient.email ||
                          selectedPatient.telephone ||
                          "Pas d'email"}
                      </p>
                    </div>
                    <button
                      type="button"
                      className="text-xs text-[#426F59] hover:underline"
                      onClick={() => {
                        setSelectedPatient(null);
                        setPatientMatched(false);
                      }}
                    >
                      Changer
                    </button>
                  </div>
                ) : (
                  <>
                    <div className="relative">
                      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                      <Input
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        placeholder="Rechercher un client…"
                        className="pl-9"
                      />
                    </div>
                    <div className="max-h-36 overflow-y-auto rounded-xl border border-slate-200">
                      {filteredPatients.length === 0 ? (
                        <p className="px-3 py-2 text-xs text-slate-400">
                          Aucun client correspondant.
                        </p>
                      ) : (
                        filteredPatients.map((p) => (
                          <button
                            key={p.id}
                            type="button"
                            onClick={() => {
                              setSelectedPatient(p);
                              setNewPatientOpen(false);
                              setSearch("");
                              setPatientMatched(false);
                            }}
                            className="flex w-full flex-col items-start border-b border-slate-100 px-3 py-2 text-left last:border-0 hover:bg-slate-50"
                          >
                            <span className="text-sm font-medium text-slate-800">
                              {fullName(p.prenom, p.nom)}
                            </span>
                            <span className="text-xs text-slate-500">
                              {p.email || p.telephone || "—"}
                            </span>
                          </button>
                        ))
                      )}
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="w-full"
                      onClick={() => {
                        setNewPatientOpen(true);
                        setSelectedPatient(null);
                        setPatientMatched(false);
                      }}
                    >
                      <Plus className="mr-1.5 h-3.5 w-3.5" />
                      Nouveau patient
                    </Button>
                  </>
                )}

                {newPatientOpen && (
                  <div className="space-y-3 rounded-xl border border-slate-200 p-3">
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <label className="text-xs font-medium text-slate-600">
                          Prénom <span className="text-red-500">*</span>
                          <DetectedHint show={detected.prenom} />
                        </label>
                        <Input
                          value={newPatient.prenom}
                          onChange={(e) => {
                            clearDetected("prenom");
                            setNewPatient({ ...newPatient, prenom: e.target.value });
                          }}
                          placeholder="Marie"
                          autoFocus
                          className={detectedInputClass(detected.prenom)}
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-xs font-medium text-slate-600">
                          Nom <span className="text-red-500">*</span>
                          <DetectedHint show={detected.nom} />
                        </label>
                        <Input
                          value={newPatient.nom}
                          onChange={(e) => {
                            clearDetected("nom");
                            setNewPatient({ ...newPatient, nom: e.target.value });
                          }}
                          placeholder="Dupont"
                          className={detectedInputClass(detected.nom)}
                        />
                      </div>
                    </div>
                    <div className="space-y-1">
                        <label className="text-xs font-medium text-slate-600">
                          Email
                          <DetectedHint show={detected.email} />
                        </label>
                        <Input
                          type="email"
                          value={newPatient.email}
                          onChange={(e) => {
                            clearDetected("email");
                            setNewPatient({ ...newPatient, email: e.target.value });
                          }}
                          placeholder="marie.dupont@email.com"
                          className={detectedInputClass(detected.email)}
                        />
                    </div>
                    <div className="space-y-1">
                        <label className="text-xs font-medium text-slate-600">
                          Téléphone
                          <DetectedHint show={detected.telephone} />
                        </label>
                        <Input
                          type="tel"
                          value={newPatient.telephone}
                          onChange={(e) => {
                            clearDetected("telephone");
                            setNewPatient({
                              ...newPatient,
                              telephone: e.target.value,
                            });
                          }}
                          placeholder="06 12 34 56 78"
                          className={detectedInputClass(detected.telephone)}
                        />
                    </div>
                    <p className="text-[11px] text-slate-400">
                      Email ou téléphone requis pour identifier le client.
                    </p>
                  </div>
                )}
              </section>

              <section className="space-y-2">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                  Type de séance
                </p>
                {types.length === 0 ? (
                  <p className="text-sm text-slate-500">
                    Aucun type de séance actif. Ajoutez-en dans Paramètres.
                  </p>
                ) : (
                  <div className="space-y-1.5">
                    {types.map((t) => {
                      const active = typeId === t.id;
                      return (
                        <button
                          key={t.id}
                          type="button"
                          onClick={() => {
                            clearDetected("type_seance_id");
                            setTypeId(t.id);
                          }}
                          className={cn(
                            "flex w-full items-center justify-between rounded-xl border px-3 py-2 text-left",
                            active
                              ? "border-[#426F59] bg-[#F0F7F4]"
                              : "border-slate-200 hover:bg-slate-50",
                            active && detected.type_seance_id && "ring-1 ring-[#426F59]/50",
                          )}
                        >
                          <span>
                            <span className="block text-sm font-medium text-slate-800">
                              {t.nom}
                              {active ? (
                                <DetectedHint show={detected.type_seance_id} />
                              ) : null}
                            </span>
                            <span className="text-xs text-slate-500">
                              {t.duree_minutes} min ·{" "}
                              {t.mode === "visio" ? "Visio" : "Présentiel"}
                            </span>
                          </span>
                          <span className="text-sm font-semibold text-[#1E3A5F]">
                            {t.tarif.toFixed(2)} €
                          </span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </section>

              <section className="space-y-2">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                  Date et heure
                </p>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-slate-600">
                      Date
                      <DetectedHint show={detected.date} />
                    </label>
                    <Input
                      type="date"
                      value={date}
                      onChange={(e) => {
                        clearDetected("date");
                        setDate(e.target.value);
                      }}
                      className={detectedInputClass(detected.date)}
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-slate-600">
                      Heure
                      <DetectedHint show={detected.heure} />
                    </label>
                    <Input
                      type="time"
                      value={time}
                      onChange={(e) => {
                        clearDetected("heure");
                        setTime(e.target.value);
                      }}
                      className={detectedInputClass(detected.heure)}
                    />
                  </div>
                </div>
                {slotInPast && (
                  <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
                    <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
                    <p>Vous enregistrez une séance déjà réalisée.</p>
                  </div>
                )}
              </section>

              <section className="space-y-2">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                  Règlement
                </p>
                <label
                  className={`flex cursor-pointer items-start gap-2 rounded-xl border px-3 py-2.5 ${
                    modeReglement === "hors_plateforme"
                      ? "border-[#426F59] bg-[#F0F7F4]"
                      : "border-slate-200"
                  }`}
                >
                  <input
                    type="radio"
                    name="mode_reglement"
                    className="mt-1"
                    checked={modeReglement === "hors_plateforme"}
                    onChange={() => setModeReglement("hors_plateforme")}
                  />
                  <span>
                    <span className="block text-sm font-medium text-slate-800">
                      Réglé hors plateforme
                    </span>
                    <span className="text-xs text-slate-500">
                      CB en personne, espèces, chèque
                    </span>
                  </span>
                </label>
                <label
                  className={`flex items-start gap-2 rounded-xl border px-3 py-2.5 ${
                    !canLienEnLigne
                      ? "cursor-not-allowed opacity-50"
                      : "cursor-pointer"
                  } ${
                    modeReglement === "lien_en_ligne"
                      ? "border-[#426F59] bg-[#F0F7F4]"
                      : "border-slate-200"
                  }`}
                >
                  <input
                    type="radio"
                    name="mode_reglement"
                    className="mt-1"
                    disabled={!canLienEnLigne}
                    checked={modeReglement === "lien_en_ligne"}
                    onChange={() => setModeReglement("lien_en_ligne")}
                  />
                  <span>
                    <span className="block text-sm font-medium text-slate-800">
                      Envoyer un lien de paiement par email
                    </span>
                    <span className="text-xs text-slate-500">
                      {slotInPast
                        ? "Non disponible pour une date passée"
                        : hasEmailForLien
                          ? "Le client reçoit un lien pour régler en ligne"
                          : "Email requis pour cette option"}
                    </span>
                  </span>
                </label>

                {modeReglement === "hors_plateforme" && (
                  <div className="space-y-1 pt-1">
                    <label className="text-xs font-medium text-slate-600">
                      Montant perçu
                    </label>
                    <Input
                      type="number"
                      min="0"
                      step="0.01"
                      value={montantDeclare}
                      onChange={(e) => setMontantDeclare(e.target.value)}
                    />
                    <p className="text-[11px] text-slate-400">
                      Cette séance n&apos;entrera pas dans votre CA en ligne
                      Calymia.
                    </p>
                  </div>
                )}
              </section>
                </>
              )}
            </>
          )}

          {error && entryMode === "manuel" && (
            <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">
              {error}
            </p>
          )}

          <div className="flex justify-end gap-3 pt-1">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={submitting || analyzing}
            >
              Annuler
            </Button>
            {entryMode === "manuel" && (
              <Button type="submit" disabled={!canSubmit || submitting}>
                {submitting ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  "Créer la séance"
                )}
              </Button>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}
