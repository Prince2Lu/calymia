"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import Image from "next/image";
import { createBrowserClient } from "@supabase/ssr";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { PaymentForm } from "@/components/booking/PaymentForm";
import {
  addParisCalendarDays,
  formatParisTime,
  getParisJsDayOfWeek,
  getParisYMD,
  isSameParisCalendarDay,
  startOfParisCalendarDay,
} from "@/lib/timezone";
import {
  dispoByJsDayFromHoraires,
  normalizeHoraires,
  type DispoWindow,
} from "@/lib/horaires";
import {
  SLOT_GRID_STEP_MS,
  buildSlotsFromDispo,
  type BookedInterval,
} from "@/lib/booking/slots";

type Step = 1 | 2 | 3 | 4 | 5;

/** Type de séance choisi (tarif = colonne `tarif` en BDD) */
type SelectedTypeSeance = {
  id: string;
  nom: string;
  duree_minutes: number;
  tarif: number;
  mode: "presentiel" | "visio";
};

type SophrologueLite = {
  id: string | number;
  prenom: string | null;
  nom: string | null;
  horaires: unknown;
  adresse: string | null;
  ville: string | null;
  code_postal: string | null;
};

type PatientInfo = {
  prenom: string;
  nom: string;
  email: string;
  telephone: string;
  consent: boolean;
};

type AvailabilityData = {
  // JS getDay() → DispoWindow[] (multiple slots per day, e.g. 09-12 and 14-18)
  dispoByJsDay: Map<number, DispoWindow[]>;
  // séances déjà réservées sous forme d'intervalles (dates locales)
  bookedIntervals: BookedInterval[];
  // délai minimum en heures avant réservation
  delaiMinHeures: number;
};

// ─── Date helpers (créneaux & affichage = Europe/Paris ; stockage = UTC) ─────

const VISIO_LIEU_MESSAGE =
  "Séance en visioconférence — le lien de connexion vous sera envoyé par email après confirmation";

function formatCabinetAdresse(s: {
  adresse: string | null;
  ville: string | null;
  code_postal: string | null;
} | null): string | null {
  if (!s) return null;
  const adr = s.adresse?.trim() ?? "";
  const villeCp = [s.code_postal?.trim(), s.ville?.trim()]
    .filter(Boolean)
    .join(" ");
  const full = [adr, villeCp].filter(Boolean).join(", ");
  return full || null;
}

export default function ReserverPage() {
  const params = useParams<{
    dept: string;
    ville: string;
    slug: string;
  }>();
  const router = useRouter();

  const [step, setStep] = useState<Step>(1);
  const [selectedDay, setSelectedDay] = useState<Date>(() =>
    startOfParisCalendarDay(new Date()),
  );
  const [selectedSlot, setSelectedSlot] = useState<Date | null>(null);
  const [patient, setPatient] = useState<PatientInfo>({
    prenom: "",
    nom: "",
    email: "",
    telephone: "",
    consent: false,
  });
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const [sophrologue, setSophrologue] = useState<SophrologueLite | null>(null);
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [seanceId, setSeanceId] = useState<string | number | null>(null);
  // Temporary block held while patient fills their info (step 3)
  const [blockedSeanceId, setBlockedSeanceId] = useState<string | number | null>(null);
  // Slots confirmed taken by a concurrent booking (show as unavailable)
  const [blockedSlots, setBlockedSlots] = useState<number[]>([]); // slot.getTime() values
  const [availability, setAvailability] = useState<AvailabilityData | null>(null);
  const [availabilityLoading, setAvailabilityLoading] = useState(true);
  const [noAvailability, setNoAvailability] = useState(false);
  const [sessionTypes, setSessionTypes] = useState<SelectedTypeSeance[]>([]);
  const [typesLoading, setTypesLoading] = useState(true);
  const [selectedTypeSeance, setSelectedTypeSeance] = useState<SelectedTypeSeance | null>(
    null,
  );

  // ── Account detection & inline login (étape infos client) ────────────────
  type EmailStatus = "idle" | "checking" | "exists" | "new";
  const [emailStatus, setEmailStatus] = useState<EmailStatus>("idle");
  const [loginPassword, setLoginPassword] = useState("");
  const [loginError, setLoginError] = useState<string | null>(null);
  const [loginLoading, setLoginLoading] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  // ── Account creation (step 4) ───────────────────────────────────────────────
  const [accountPassword, setAccountPassword] = useState("");
  const [accountPasswordConfirm, setAccountPasswordConfirm] = useState("");
  const [accountError, setAccountError] = useState<string | null>(null);
  const [accountLoading, setAccountLoading] = useState(false);
  const [accountDone, setAccountDone] = useState(false);

  const supabase = useMemo(
    () =>
      createBrowserClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      ),
    [],
  );

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      const slug = params.slug;
      if (!slug) return;

      // 1) Sophrologue de base (+ horaires JSONB = source des créneaux)
      const { data: sophroData } = await supabase
        .from("sophrologues")
        .select("id, prenom, nom, horaires, adresse, ville, code_postal")
        .eq("slug", slug)
        .eq("actif", true)
        .maybeSingle<SophrologueLite>();

      if (!sophroData || cancelled) {
        if (!cancelled) {
          setTypesLoading(false);
          setAvailabilityLoading(false);
        }
        return;
      }
      setSophrologue(sophroData);

      const sid = sophroData.id;
      const horizon = addParisCalendarDays(
        startOfParisCalendarDay(new Date()),
        29,
      ).toISOString();

      // 2) Séances déjà réservées dans les 4 prochaines semaines
      // Exclude temporary blocks that have already expired
      const nowIso = new Date().toISOString();
      const googleBusyPromise = fetch(
        `/api/public/google-busy?sophrologue_id=${encodeURIComponent(String(sid))}&timeMin=${encodeURIComponent(nowIso)}&timeMax=${encodeURIComponent(horizon)}`,
      )
        .then(async (res) => {
          if (!res.ok) return [] as { start: string; end: string }[];
          const json = (await res.json().catch(() => null)) as {
            intervals?: { start: string; end: string }[];
          } | null;
          return json?.intervals ?? [];
        })
        .catch(() => [] as { start: string; end: string }[]);

      const { data: seances } = await supabase
        .from("seances_disponibilite")
        .select("debut_at, fin_at")
        .eq("sophrologue_id", sid)
        .in("statut", ["confirmee", "en_attente"])
        .gt("debut_at", nowIso)
        .lt("debut_at", horizon)
        .or(`expire_at.is.null,expire_at.gt.${nowIso}`)
        .returns<{ debut_at: string; fin_at: string }[]>();

      console.log(`[reserver] Séances réservées récupérées : ${seances?.length ?? 0}`, seances);

      // 3) Paramètres cabinet (délai minimum)
      const { data: params_cabinet } = await supabase
        .from("parametres_cabinet")
        .select("delai_min_reservation_heures")
        .eq("sophrologue_id", sid)
        .maybeSingle<{ delai_min_reservation_heures: number }>();

      if (cancelled) return;

      const dispoByJsDay = dispoByJsDayFromHoraires(
        normalizeHoraires(sophroData.horaires),
      );

      // Construire les intervalles de séances réservées (+ FreeBusy Google, best-effort)
      const bookedIntervals: BookedInterval[] = (seances ?? []).map((s) => ({
        debut: new Date(s.debut_at),
        fin: new Date(s.fin_at),
      }));
      const googleBusy = await googleBusyPromise;
      for (const interval of googleBusy) {
        const debut = new Date(interval.start);
        const fin = new Date(interval.end);
        if (Number.isNaN(debut.getTime()) || Number.isNaN(fin.getTime())) continue;
        bookedIntervals.push({ debut, fin });
      }

      const delaiMinHeures = params_cabinet?.delai_min_reservation_heures ?? 24;

      const { data: typesRows } = await supabase
        .from("types_seances")
        .select("id, nom, duree_minutes, tarif, mode")
        .eq("sophrologue_id", sid)
        .eq("actif", true)
        .order("nom");

      if (cancelled) return;

      const types: SelectedTypeSeance[] = (typesRows ?? []).map((r) => ({
        id: String(r.id),
        nom: r.nom ?? "Séance",
        duree_minutes: Number(r.duree_minutes) || 60,
        tarif: Number(r.tarif) || 0,
        mode: r.mode === "visio" ? "visio" : "presentiel",
      }));

      setSessionTypes(types);
      setTypesLoading(false);

      const avail: AvailabilityData = { dispoByJsDay, bookedIntervals, delaiMinHeures };
      setAvailability(avail);
      setNoAvailability(dispoByJsDay.size === 0);
      setAvailabilityLoading(false);
    };
    run();
    return () => { cancelled = true; };
  }, [params.slug, supabase]);

  /** Premier jour avec au moins un créneau pour le type choisi */
  useEffect(() => {
    if (!availability || !selectedTypeSeance) return;
    const durationMs = selectedTypeSeance.duree_minutes * 60 * 1000;
    const today = startOfParisCalendarDay(new Date());
    for (let i = 0; i < 28; i++) {
      const d = addParisCalendarDays(today, i);
      const dayDispos = availability.dispoByJsDay.get(getParisJsDayOfWeek(d));
      if (!dayDispos?.length) continue;
      const slots = buildSlotsFromDispo(
        d,
        dayDispos,
        availability.bookedIntervals,
        availability.delaiMinHeures,
        durationMs,
      );
      if (slots.length > 0) {
        setSelectedDay(d);
        return;
      }
    }
  }, [availability, selectedTypeSeance]);

  const sophrologueName = useMemo(() => {
    const prenom = sophrologue?.prenom ?? "";
    const nom = sophrologue?.nom ?? "";
    const full = `${prenom} ${nom}`.trim();
    return full || "le sophrologue";
  }, [sophrologue]);

  const cabinetAdresse = useMemo(
    () => formatCabinetAdresse(sophrologue),
    [sophrologue],
  );

  const lieuSeanceLabel = useMemo(() => {
    if (!selectedTypeSeance) return null;
    if (selectedTypeSeance.mode === "visio") return VISIO_LIEU_MESSAGE;
    return cabinetAdresse;
  }, [selectedTypeSeance, cabinetAdresse]);

  const days = useMemo(() => {
    const today = startOfParisCalendarDay(new Date());
    const out: Date[] = [];
    for (let i = 0; i < 28; i += 1) out.push(addParisCalendarDays(today, i));
    return out;
  }, []);

  const weeks = useMemo(() => {
    const out: Date[][] = [];
    for (let i = 0; i < days.length; i += 7) out.push(days.slice(i, i + 7));
    return out;
  }, [days]);

  const slotsForSelectedDay = useMemo(() => {
    if (!availability || !selectedTypeSeance) return [];
    const dayDispos = availability.dispoByJsDay.get(
      getParisJsDayOfWeek(selectedDay),
    );
    if (!dayDispos || dayDispos.length === 0) return [];
    const durationMs = selectedTypeSeance.duree_minutes * 60 * 1000;
    return buildSlotsFromDispo(
      selectedDay,
      dayDispos,
      availability.bookedIntervals,
      availability.delaiMinHeures,
      durationMs,
    );
  }, [availability, selectedDay, selectedTypeSeance]);

  const progress = (step / 5) * 100;

  const releaseBlock = async (id: string | number) => {
    try {
      await fetch("/api/reservations/liberer-creneau", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ seance_id: id }),
      });
      console.log("[reserver] Créneau libéré:", id);
    } catch {
      // Non-blocking — block will expire on its own after 15 min
    }
    setBlockedSeanceId(null);
  };

  const goBack = () => {
    setError(null);
    if (step === 1) {
      router.push(`/sophrologues/${params.dept}/${params.ville}/${params.slug}`);
      return;
    }
    if (step === 3 && blockedSeanceId != null) {
      void releaseBlock(blockedSeanceId);
    }
    setStep((s) => (s - 1) as Step);
  };

  const goNext = async () => {
    setError(null);
    if (step === 1) {
      if (!selectedTypeSeance) {
        setError("Merci de choisir un type de séance.");
        return;
      }
      setSelectedSlot(null);
      setStep(2);
      return;
    }
    if (step === 2) {
      if (!selectedSlot) {
        setError("Merci de sélectionner un créneau.");
        return;
      }
      if (!sophrologue?.id || !selectedTypeSeance) {
        setError("Impossible d'identifier le sophrologue ou le type de séance. Merci de réessayer.");
        return;
      }

      setLoading(true);
      const durationMs = selectedTypeSeance.duree_minutes * 60 * 1000;
      const finAt = new Date(selectedSlot.getTime() + durationMs);
      const res = await fetch("/api/reservations/bloquer-creneau", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sophrologue_id: sophrologue.id,
          type_seance_id: selectedTypeSeance.id,
          debut_at: selectedSlot.toISOString(),
          fin_at: finAt.toISOString(),
        }),
      });

      const data = (await res.json().catch(() => null)) as
        | { seance_id?: string | number; error?: string }
        | null;

      setLoading(false);

      if (!res.ok || !data?.seance_id) {
        if (res.status === 409) {
          setBlockedSlots((prev) => [...prev, selectedSlot.getTime()]);
          setSelectedSlot(null);
        }
        setError(data?.error ?? "Impossible de réserver ce créneau. Merci de réessayer.");
        return;
      }

      console.log("[reserver] Créneau bloqué:", data.seance_id);
      setBlockedSeanceId(data.seance_id);
      setStep(3);
      return;
    }
    if (step === 3) return;
  };

  const createPaymentIntent = async () => {
    setError(null);
    if (!selectedSlot) {
      setError("Merci de sélectionner un créneau.");
      return;
    }
    if (
      !patient.prenom.trim() ||
      !patient.nom.trim() ||
      !patient.email.trim() ||
      !patient.telephone.trim()
    ) {
      setError("Merci de renseigner toutes les informations client.");
      return;
    }
    if (!patient.consent) {
      setError("Merci d’accepter le consentement RGPD pour continuer.");
      return;
    }
    if (!sophrologue?.id) {
      setError("Impossible d’identifier le sophrologue. Merci de réessayer.");
      return;
    }

    if (!selectedTypeSeance) {
      setError("Type de séance manquant. Recommencez depuis l’étape 1.");
      return;
    }

    if (blockedSeanceId == null) {
      setError("Le créneau n'est plus réservé. Veuillez recommencer.");
      return;
    }

    setLoading(true);
    const payload = {
      seance_id: blockedSeanceId,
      sophrologue_id: sophrologue.id,
      type_seance_id: selectedTypeSeance.id,
      debut_at: selectedSlot.toISOString(),
      patient_prenom: patient.prenom,
      patient_nom: patient.nom,
      patient_email: patient.email,
      patient_telephone: patient.telephone,
    };

    const res = await fetch("/api/reservations/create-payment-intent", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    const data = (await res.json().catch(() => null)) as
      | { clientSecret?: string; seance_id?: string | number; error?: string }
      | null;

    if (!res.ok || !data?.clientSecret || data.seance_id == null) {
      setError(
        data?.error ??
          "Impossible d'initialiser le paiement. Merci de réessayer.",
      );
      setLoading(false);
      return;
    }

    setClientSecret(data.clientSecret);
    setSeanceId(data.seance_id);
    setLoading(false);
    setStep(4);
  };

  // ── Email blur: check if account exists ────────────────────────────────────
  const handleEmailBlur = async () => {
    const email = patient.email.trim();
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return;
    if (isLoggedIn) return;
    setEmailStatus("checking");
    setLoginError(null);
    try {
      const res = await fetch("/api/auth/check-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = (await res.json()) as { exists: boolean };
      setEmailStatus(data.exists ? "exists" : "new");
    } catch {
      setEmailStatus("idle");
    }
  };

  // ── Inline login ───────────────────────────────────────────────────────────
  const handleInlineLogin = async () => {
    setLoginError(null);
    setLoginLoading(true);
    const { data, error } = await supabase.auth.signInWithPassword({
      email: patient.email.trim(),
      password: loginPassword,
    });
    if (error || !data.user) {
      setLoginError("Mot de passe incorrect. Vérifiez et réessayez.");
      setLoginLoading(false);
      return;
    }
    // Pre-fill from canonical patient row (user_id + sophrologue_id IS NULL)
    const { data: patientData } = await supabase
      .from("patients")
      .select("prenom, nom, telephone")
      .eq("user_id", data.user.id)
      .is("sophrologue_id", null)
      .maybeSingle<{ prenom: string | null; nom: string | null; telephone: string | null }>();
    if (patientData) {
      setPatient((p) => ({
        ...p,
        prenom: patientData.prenom || p.prenom,
        nom: patientData.nom || p.nom,
        telephone: patientData.telephone || p.telephone,
      }));
    }
    setIsLoggedIn(true);
    setLoginLoading(false);
  };

  // ── Account creation after payment ────────────────────────────────────────
  const handleCreateAccount = async () => {
    setAccountError(null);
    if (!accountPassword) {
      setAccountError("Choisissez un mot de passe.");
      return;
    }
    if (accountPassword.length < 8) {
      setAccountError("Le mot de passe doit contenir au moins 8 caractères.");
      return;
    }
    if (accountPassword !== accountPasswordConfirm) {
      setAccountError("Les mots de passe ne correspondent pas.");
      return;
    }
    setAccountLoading(true);
    const res = await fetch("/api/auth/create-client-account", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: patient.email.trim(),
        password: accountPassword,
        patient_email: patient.email.trim(),
        prenom: patient.prenom.trim(),
        nom: patient.nom.trim(),
        create_patient_record: true,
      }),
    });
    const data = (await res.json()) as { success?: boolean; error?: string };
    if (data.error === "exists") {
      setAccountError(
        "Un compte existe déjà pour cet email. Connectez-vous depuis la page de connexion.",
      );
      setAccountLoading(false);
      return;
    }
    if (!data.success) {
      setAccountError("Une erreur est survenue. Merci de réessayer.");
      setAccountLoading(false);
      return;
    }
    setAccountDone(true);
    setAccountLoading(false);

    try {
      await fetch("/api/emails/welcome-client", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: patient.email.trim(),
          prenom: patient.prenom.trim() || "Client",
        }),
      });
    } catch {
      /* non bloquant */
    }
  };

  /** Si l’email n’a pas été vérifié à l’étape infos (pas de blur), re-vérifier à la confirmation */
  useEffect(() => {
    if (step !== 5 || isLoggedIn) return;
    const email = patient.email.trim();
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return;
    if (emailStatus !== "idle") return;

    let cancelled = false;
    setEmailStatus("checking");
    (async () => {
      try {
        const res = await fetch("/api/auth/check-email", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email }),
        });
        const data = (await res.json()) as { exists?: boolean };
        if (cancelled) return;
        if (!res.ok) {
          setEmailStatus("new");
          return;
        }
        setEmailStatus(data.exists ? "exists" : "new");
      } catch {
        if (!cancelled) setEmailStatus("new");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [step, patient.email, isLoggedIn, emailStatus]);

  return (
    <main className="min-h-screen bg-white">
      <div className="mx-auto max-w-5xl px-4 py-10">
        <div className="mb-6 space-y-2">
          <Image src="/logo.webp" alt="Calymia" width={120} height={48} style={{ height: "auto" }} />
          <h1 className="text-3xl font-semibold text-[#1E3A5F]">
            Prendre rendez-vous
          </h1>
          <p className="text-sm text-slate-600">
            Réservez un créneau avec{" "}
            <span className="font-medium text-slate-900">
              {sophrologueName}
            </span>
            .
          </p>
        </div>

        <div className="mb-6">
          <div className="flex items-center justify-between text-xs font-medium">
            {[
              "Type de séance",
              "Créneau",
              "Infos client",
              "Paiement",
              "Confirmation",
            ].map((t, i) => {
              const n = (i + 1) as Step;
              const active = n === step;
              const done = n < step;
              return (
                <div key={t} className="flex flex-1 items-center">
                  <div
                    className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full border text-xs font-semibold ${
                      done || active
                        ? "border-[#426F59] bg-[#426F59] text-white"
                        : "border-[#C5D9CC] bg-[#E8F0EC] text-[#426F59]"
                    }`}
                  >
                    {n}
                  </div>
                  <span
                    className={`ml-2 hidden sm:inline ${
                      active
                        ? "font-semibold text-[#426F59]"
                        : done
                          ? "text-[#426F59]"
                          : "text-[#9CA3AF]"
                    }`}
                  >
                    {t}
                  </span>
                  {n < 5 ? (
                    <div className="ml-2 hidden h-0.5 flex-1 rounded bg-[#C5D9CC] sm:block">
                      <div
                        className={`h-0.5 rounded transition-all ${
                          step > n ? "w-full bg-[#426F59]" : "w-0"
                        }`}
                      />
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
          <div className="mt-3 h-1 w-full rounded-full bg-[#C5D9CC]">
            <div
              className="h-1 rounded-full bg-[#426F59] transition-all"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>

        <Card>
          <CardTitle>
            {step === 1 && "Étape 1 — Type de séance"}
            {step === 2 && "Étape 2 — Choix du créneau"}
            {step === 3 && "Étape 3 — Informations client"}
            {step === 4 && "Étape 4 — Paiement"}
            {step === 5 && "Étape 5 — Confirmation"}
          </CardTitle>
          <CardDescription className="mt-1">
            {step === 1 &&
              "Choisissez la formule : durée et tarif s’appliquent à votre réservation."}
            {step === 2 &&
              "Sélectionnez un créneau sur les 4 prochaines semaines."}
            {step === 3 &&
              "Renseignez vos informations pour confirmer la réservation."}
            {step === 4 &&
              "Procédez au paiement sécurisé pour confirmer la séance."}
            {step === 5 && "Votre réservation est confirmée."}
          </CardDescription>

          <div className="mt-6 space-y-6">
            {step === 1 ? (
              <section className="space-y-4">
                {typesLoading ? (
                  <div className="flex items-center gap-3 py-8 text-sm text-slate-500">
                    <svg className="h-5 w-5 animate-spin text-[#2E75B6]" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                    </svg>
                    Chargement des types de séance…
                  </div>
                ) : sessionTypes.length === 0 ? (
                  <div className="rounded-xl border border-amber-200 bg-amber-50 px-5 py-6 text-center">
                    <p className="text-sm font-medium text-amber-800">
                      Aucun type de séance disponible
                    </p>
                    <p className="mt-1 text-xs text-amber-700">
                      Ce sophrologue n’a pas encore configuré de séances. Revenez plus tard ou contactez-le directement.
                    </p>
                  </div>
                ) : (
                  <div className="grid gap-3 sm:grid-cols-2">
                    {sessionTypes.map((t) => {
                      const selected = selectedTypeSeance?.id === t.id;
                      return (
                        <button
                          key={t.id}
                          type="button"
                          onClick={() => setSelectedTypeSeance(t)}
                          className={`rounded-xl border p-4 text-left transition-colors ${
                            selected
                              ? "border-[#426F59] bg-[#F0F7F4] ring-2 ring-[#426F59]/30"
                              : "border-slate-200 bg-white hover:border-[#426F59]/40 hover:bg-slate-50"
                          }`}
                        >
                          <p className="font-semibold text-[#1E3A5F]">
                            {t.nom}
                            {t.mode === "visio" && (
                              <span className="ml-2 inline-block rounded-full bg-[#EAF3DE] px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-[#426F59]">
                                Visio
                              </span>
                            )}
                          </p>
                          <p className="mt-1 text-sm text-slate-600">
                            Durée : {t.duree_minutes} min
                            {t.mode === "visio"
                              ? " · En visioconférence"
                              : cabinetAdresse
                                ? " · Au cabinet"
                                : ""}
                          </p>
                          <p className="mt-2 text-lg font-semibold text-[#426F59]">
                            {t.tarif.toFixed(2)}&nbsp;€
                          </p>
                        </button>
                      );
                    })}
                  </div>
                )}
              </section>
            ) : null}

            {step === 2 ? (
              <section className="space-y-4">
                {availabilityLoading ? (
                  <div className="flex items-center gap-3 py-8 text-sm text-slate-500">
                    <svg className="h-5 w-5 animate-spin text-[#2E75B6]" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                    </svg>
                    Chargement des disponibilités…
                  </div>
                ) : noAvailability ? (
                  <div className="rounded-xl border border-amber-200 bg-amber-50 px-5 py-6 text-center">
                    <p className="text-sm font-medium text-amber-800">
                      Aucune disponibilité configurée
                    </p>
                    <p className="mt-1 text-xs text-amber-700">
                      Ce sophrologue n'a pas encore renseigné ses créneaux. Contactez-le directement.
                    </p>
                  </div>
                ) : (
                  <div className="grid gap-6 lg:grid-cols-[1.2fr,1fr]">
                    {/* ── Calendrier ──────────────────────────────────── */}
                    <div className="space-y-3">
                      <h2 className="text-sm font-semibold text-slate-800">
                        Calendrier (4 semaines)
                      </h2>
                      <div className="space-y-3">
                        {weeks.map((week, wi) => (
                          <div key={`w-${wi}`} className="grid grid-cols-7 gap-1.5">
                            {week.map((d) => {
                              const dayDispos = availability?.dispoByJsDay.get(d.getDay());
                              const durationMs = selectedTypeSeance
                                ? selectedTypeSeance.duree_minutes * 60 * 1000
                                : 0;
                              const hasSlots =
                                availability != null &&
                                selectedTypeSeance != null &&
                                dayDispos != null &&
                                dayDispos.length > 0 &&
                                buildSlotsFromDispo(
                                  d,
                                  dayDispos,
                                  availability.bookedIntervals,
                                  availability.delaiMinHeures,
                                  durationMs,
                                ).length > 0;
                              const isSelected = isSameParisCalendarDay(
                                d,
                                selectedDay,
                              );
                              const isDisabled = !hasSlots;
                              const titleText = isDisabled
                                ? "Aucun créneau disponible"
                                : (dayDispos ?? [])
                                    .map((dp) => `${dp.heure_debut} – ${dp.heure_fin}`)
                                    .join(", ");
                              return (
                                <button
                                  key={d.toISOString()}
                                  type="button"
                                  onClick={() => {
                                    if (isDisabled) return;
                                    setSelectedDay(startOfParisCalendarDay(d));
                                    setSelectedSlot(null);
                                  }}
                                  className={`rounded-lg border px-1 py-2 text-xs transition-colors ${
                                    isSelected
                                      ? "border-[#2E75B6] bg-[#2E75B6]/10 text-[#1E3A5F] font-semibold"
                                      : hasSlots
                                        ? "border-slate-200 bg-white text-slate-700 hover:border-[#2E75B6]/40 hover:bg-slate-50"
                                        : "border-slate-100 bg-slate-50 text-slate-300 cursor-not-allowed"
                                  }`}
                                  aria-disabled={isDisabled}
                                  title={titleText}
                                >
                                  <div className="font-medium">
                                    {formatParisTime(d, "weekdayShort")}
                                  </div>
                                  <div className="text-sm font-semibold">
                                    {getParisYMD(d).d}
                                  </div>
                                  {hasSlots && !isSelected && (
                                    <div className="mx-auto mt-1 h-1 w-1 rounded-full bg-[#27AE60]" />
                                  )}
                                </button>
                              );
                            })}
                          </div>
                        ))}
                      </div>
                      <p className="text-xs text-slate-400">
                        ● Créneau disponible · Jours grisés = aucun créneau libre
                      </p>
                    </div>

                    {/* ── Créneaux du jour sélectionné ────────────────── */}
                    <div className="space-y-3">
                      <h2 className="text-sm font-semibold text-slate-800">
                        Créneaux du {formatParisTime(selectedDay, "date")}
                      </h2>
                      {slotsForSelectedDay.length === 0 ? (
                        <p className="text-sm text-slate-500">
                          Aucun créneau disponible ce jour-là. Choisissez une autre date.
                        </p>
                      ) : (
                        <div className="grid grid-cols-2 gap-2">
                          {slotsForSelectedDay.map((slot) => {
                            const selected = selectedSlot?.getTime() === slot.getTime();
                            const isBlocked = blockedSlots.includes(slot.getTime());
                            return (
                              <button
                                key={slot.toISOString()}
                                type="button"
                                disabled={isBlocked}
                                onClick={() => !isBlocked && setSelectedSlot(slot)}
                                className={`rounded-lg border px-3 py-2 text-sm font-medium transition-colors flex flex-col items-center gap-0.5 ${
                                  isBlocked
                                    ? "opacity-40 cursor-not-allowed bg-gray-100 border-gray-200 text-gray-400"
                                    : selected
                                      ? "border-[#27AE60] bg-[#27AE60]/15 text-[#1E3A5F]"
                                      : "border-slate-200 bg-white text-slate-800 hover:bg-slate-50"
                                }`}
                              >
                                <span>{formatParisTime(slot, "HH:mm")}</span>
                                {isBlocked && (
                                  <span className="text-xs font-normal text-gray-400">
                                    Indisponible
                                  </span>
                                )}
                              </button>
                            );
                          })}
                        </div>
                      )}

                      {selectedSlot && selectedTypeSeance && (
                        <div className="rounded-xl border border-[#27AE60]/30 bg-[#27AE60]/5 p-3">
                          <p className="text-sm text-slate-800">
                            <span className="font-semibold text-[#1E3A5F]">
                              Créneau sélectionné
                            </span>{" "}
                            : {formatParisTime(selectedSlot, "date")} de{" "}
                            {formatParisTime(selectedSlot, "HH:mm")} à{" "}
                            {formatParisTime(
                              new Date(
                                selectedSlot.getTime() +
                                  selectedTypeSeance.duree_minutes * 60 * 1000,
                              ),
                              "HH:mm",
                            )}
                          </p>
                          <p className="mt-1 text-xs text-slate-600">
                            {selectedTypeSeance.nom} · {selectedTypeSeance.tarif.toFixed(2)}&nbsp;€
                          </p>
                          {lieuSeanceLabel && (
                            <p className="mt-2 text-xs text-slate-600">
                              <span className="font-semibold text-[#1E3A5F]">
                                Lieu
                              </span>{" "}
                              : {lieuSeanceLabel}
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </section>
            ) : null}

            {step === 3 ? (
              <section className="space-y-4">
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-1">
                    <label className="text-sm font-medium text-slate-800">
                      Prénom
                    </label>
                    <Input
                      value={patient.prenom}
                      onChange={(e) =>
                        setPatient((p) => ({ ...p, prenom: e.target.value }))
                      }
                      readOnly={isLoggedIn}
                      className={isLoggedIn ? "bg-slate-100 text-slate-500" : undefined}
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-sm font-medium text-slate-800">
                      Nom
                    </label>
                    <Input
                      value={patient.nom}
                      onChange={(e) =>
                        setPatient((p) => ({ ...p, nom: e.target.value }))
                      }
                      readOnly={isLoggedIn}
                      className={isLoggedIn ? "bg-slate-100 text-slate-500" : undefined}
                    />
                  </div>
                </div>
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-1">
                    <label className="text-sm font-medium text-slate-800">
                      Email
                    </label>
                    <Input
                      type="email"
                      value={patient.email}
                      onChange={(e) => {
                        setPatient((p) => ({ ...p, email: e.target.value }));
                        if (emailStatus !== "idle") setEmailStatus("idle");
                      }}
                      onBlur={handleEmailBlur}
                    />
                    {emailStatus === "checking" && (
                      <p className="text-xs text-slate-400">Vérification…</p>
                    )}
                  </div>
                  <div className="space-y-1">
                    <label className="text-sm font-medium text-slate-800">
                      Téléphone
                    </label>
                    <Input
                      value={patient.telephone}
                      onChange={(e) =>
                        setPatient((p) => ({ ...p, telephone: e.target.value }))
                      }
                      readOnly={isLoggedIn}
                      className={isLoggedIn ? "bg-slate-100 text-slate-500" : undefined}
                    />
                  </div>
                </div>

                {/* ── Inline login si compte détecté ───────────────────── */}
                {emailStatus === "exists" && !isLoggedIn && (
                  <div className="rounded-xl border border-[#426F59]/30 bg-[#F0F7F4] p-4 space-y-3">
                    <p className="text-sm font-semibold text-[#426F59]">
                      ✓ Vous avez déjà un espace client Calymia
                    </p>
                    <p className="text-xs text-slate-600">
                      Connectez-vous pour retrouver votre historique de réservations.
                    </p>
                    <Input
                      type="password"
                      placeholder="Mot de passe"
                      value={loginPassword}
                      onChange={(e) => setLoginPassword(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && handleInlineLogin()}
                    />
                    {loginError && (
                      <p className="text-xs text-red-600">{loginError}</p>
                    )}
                    <div className="flex items-center gap-4">
                      <Button
                        type="button"
                        size="sm"
                        onClick={handleInlineLogin}
                        disabled={loginLoading || !loginPassword}
                      >
                        {loginLoading ? "Connexion…" : "Me connecter et continuer"}
                      </Button>
                      <button
                        type="button"
                        className="text-xs text-slate-500 underline hover:text-slate-700"
                        onClick={() => setEmailStatus("new")}
                      >
                        Continuer sans connexion
                      </button>
                    </div>
                  </div>
                )}
                {emailStatus === "exists" && isLoggedIn && (
                  <p className="text-xs font-medium text-[#426F59]">
                    ✓ Connecté — vos informations ont été pré-remplies
                  </p>
                )}

                <label className="flex items-start gap-3 rounded-xl border border-slate-200 bg-white p-3 text-sm text-slate-700">
                  <input
                    type="checkbox"
                    checked={patient.consent}
                    onChange={(e) =>
                      setPatient((p) => ({ ...p, consent: e.target.checked }))
                    }
                    className="mt-1"
                  />
                  <span>
                    J&apos;accepte que mes données soient utilisées pour gérer mes
                    rendez-vous
                  </span>
                </label>

                <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 space-y-1">
                  <p className="text-sm text-slate-800">
                    <span className="font-semibold text-[#1E3A5F]">
                      Type de séance
                    </span>{" "}
                    :{" "}
                    {selectedTypeSeance
                      ? `${selectedTypeSeance.nom} (${selectedTypeSeance.duree_minutes} min, ${selectedTypeSeance.tarif.toFixed(2)} €)`
                      : "—"}
                  </p>
                  <p className="text-sm text-slate-800">
                    <span className="font-semibold text-[#1E3A5F]">
                      Créneau
                    </span>{" "}
                    :{" "}
                    {selectedSlot && selectedTypeSeance
                      ? `${formatParisTime(selectedSlot, "date")} de ${formatParisTime(selectedSlot, "HH:mm")} à ${formatParisTime(
                          new Date(
                            selectedSlot.getTime() +
                              selectedTypeSeance.duree_minutes * 60 * 1000,
                          ),
                          "HH:mm",
                        )}`
                      : "Non sélectionné"}
                  </p>
                  {lieuSeanceLabel && (
                    <p className="text-sm text-slate-800">
                      <span className="font-semibold text-[#1E3A5F]">Lieu</span>{" "}
                      : {lieuSeanceLabel}
                    </p>
                  )}
                </div>

                <Button
                  type="button"
                  className="w-full"
                  onClick={createPaymentIntent}
                  disabled={loading}
                >
                  {loading ? "Initialisation du paiement..." : "Continuer vers le paiement"}
                </Button>
              </section>
            ) : null}

            {step === 4 ? (
              <section className="space-y-4">
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-800 space-y-1">
                  <p>
                    <span className="font-semibold text-[#1E3A5F]">Type</span>{" "}
                    :{" "}
                    {selectedTypeSeance
                      ? `${selectedTypeSeance.nom} — ${selectedTypeSeance.tarif.toFixed(2)} €`
                      : "—"}
                  </p>
                  <p>
                    <span className="font-semibold text-[#1E3A5F]">Créneau</span>{" "}
                    :{" "}
                    {selectedSlot && selectedTypeSeance
                      ? `${formatParisTime(selectedSlot, "date")} de ${formatParisTime(selectedSlot, "HH:mm")} à ${formatParisTime(
                          new Date(
                            selectedSlot.getTime() +
                              selectedTypeSeance.duree_minutes * 60 * 1000,
                          ),
                          "HH:mm",
                        )}`
                      : "—"}
                  </p>
                  <p className="mt-1">
                    <span className="font-semibold text-[#1E3A5F]">
                      Sophrologue
                    </span>{" "}
                    : {sophrologueName}
                  </p>
                  {lieuSeanceLabel && (
                    <p>
                      <span className="font-semibold text-[#1E3A5F]">Lieu</span>{" "}
                      : {lieuSeanceLabel}
                    </p>
                  )}
                </div>

                {clientSecret && seanceId != null && selectedTypeSeance ? (
                  <PaymentForm
                    amount={selectedTypeSeance.tarif}
                    clientSecret={clientSecret}
                    seanceId={seanceId}
                    onSuccess={() => setStep(5)}
                  />
                ) : (
                  <p className="text-sm text-slate-600">
                    Initialisation du paiement en cours…
                  </p>
                )}
              </section>
            ) : null}

            {step === 5 ? (
              <section className="space-y-4">
                <div className="rounded-2xl border border-[#27AE60]/25 bg-[#27AE60]/10 p-4">
                  <p className="text-lg font-semibold text-[#1E3A5F]">
                    Votre réservation est confirmée !
                  </p>
                  <p className="mt-1 text-sm text-slate-700">
                    Vous recevrez prochainement un email de confirmation.
                  </p>
                </div>

                <div className="space-y-2 text-sm text-slate-800">
                  <p>
                    <span className="font-semibold text-[#1E3A5F]">
                      Sophrologue
                    </span>{" "}
                    : {sophrologueName}
                  </p>
                  <p>
                    <span className="font-semibold text-[#1E3A5F]">
                      Type de séance
                    </span>{" "}
                    :{" "}
                    {selectedTypeSeance
                      ? `${selectedTypeSeance.nom} (${selectedTypeSeance.tarif.toFixed(2)} €)`
                      : "—"}
                  </p>
                  <p>
                    <span className="font-semibold text-[#1E3A5F]">
                      Date &amp; heure
                    </span>{" "}
                    :{" "}
                    {selectedSlot && selectedTypeSeance
                      ? `${formatParisTime(selectedSlot, "date")} de ${formatParisTime(selectedSlot, "HH:mm")} à ${formatParisTime(
                          new Date(
                            selectedSlot.getTime() +
                              selectedTypeSeance.duree_minutes * 60 * 1000,
                          ),
                          "HH:mm",
                        )}`
                      : "—"}
                  </p>
                  {lieuSeanceLabel && (
                    <>
                      <p>
                        <span className="font-semibold text-[#1E3A5F]">Lieu</span>{" "}
                        : {lieuSeanceLabel}
                      </p>
                      {selectedTypeSeance?.mode === "visio" && (
                        <p className="text-xs text-slate-500">
                          Pensez à vérifier vos spams si vous ne recevez pas
                          l&apos;email de confirmation dans les prochaines
                          minutes.
                        </p>
                      )}
                    </>
                  )}
                </div>

                {/* ── Compte existant (check-email → emailStatus === "exists") ── */}
                {!isLoggedIn && emailStatus === "exists" && (
                  <div className="rounded-xl border border-[#2E75B6]/25 bg-[#EBF4FB] p-5 space-y-4">
                    <p className="font-semibold text-[#1E3A5F]">
                      Vous avez déjà un espace client Calymia.
                    </p>
                    <p className="text-sm text-slate-600">
                      Connectez-vous avec votre email et votre mot de passe pour retrouver vos
                      rendez-vous et vos documents.
                    </p>
                    <Link
                      href="/connexion"
                      className="inline-flex h-10 w-full items-center justify-center rounded-md bg-[#426F59] text-sm font-medium text-white transition hover:bg-[#355849] sm:w-auto sm:px-8"
                    >
                      Accéder à mon espace client
                    </Link>
                  </div>
                )}

                {/* ── Vérification email à l’étape 4 (si pas de blur étape 2) ── */}
                {!isLoggedIn && emailStatus === "checking" && (
                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
                    Vérification de votre compte…
                  </div>
                )}

                {/* ── Création de compte post-paiement (nouveaux clients) ───────── */}
                {!isLoggedIn &&
                  !accountDone &&
                  emailStatus === "new" && (
                  <div className="rounded-xl border border-[#426F59]/25 bg-[#F0F7F4] p-5 space-y-4">
                    <div>
                      <p className="font-semibold text-[#426F59]">
                        Suivez vos rendez-vous en ligne
                      </p>
                      <p className="mt-1 text-xs text-slate-600">
                        Créez votre espace client pour gérer vos réservations et télécharger vos factures.
                      </p>
                    </div>
                    <div className="space-y-3">
                      <div className="space-y-1">
                        <label className="text-xs font-medium text-slate-700">
                          Email
                        </label>
                        <Input
                          value={patient.email}
                          readOnly
                          className="bg-slate-100 text-slate-500"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-xs font-medium text-slate-700">
                          Mot de passe <span className="text-slate-400">(min. 8 caractères)</span>
                        </label>
                        <Input
                          type="password"
                          placeholder="Choisissez un mot de passe"
                          value={accountPassword}
                          onChange={(e) => setAccountPassword(e.target.value)}
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-xs font-medium text-slate-700">
                          Confirmer le mot de passe
                        </label>
                        <Input
                          type="password"
                          placeholder="Répétez le mot de passe"
                          value={accountPasswordConfirm}
                          onChange={(e) =>
                            setAccountPasswordConfirm(e.target.value)
                          }
                        />
                      </div>
                      {accountError && (
                        <p className="text-sm text-red-600">{accountError}</p>
                      )}
                      <Button
                        type="button"
                        className="w-full"
                        onClick={handleCreateAccount}
                        disabled={accountLoading}
                      >
                        {accountLoading
                          ? "Création en cours…"
                          : "Créer mon espace client"}
                      </Button>
                      <button
                        type="button"
                        className="block w-full text-center text-xs text-slate-400 underline hover:text-slate-600"
                        onClick={() => setAccountDone(true)}
                      >
                        Non merci
                      </button>
                    </div>
                  </div>
                )}

                {!isLoggedIn && accountDone && (
                  <div className="rounded-xl border border-[#426F59]/30 bg-[#F0F7F4] p-4">
                    <p className="text-sm font-semibold text-[#426F59]">
                      ✓ Votre espace client a été créé !
                    </p>
                    <p className="mt-1 text-xs text-slate-600">
                      Connectez-vous sur{" "}
                      <a href="/connexion" className="underline">
                        calymia.com/connexion
                      </a>{" "}
                      pour accéder à votre espace.
                    </p>
                  </div>
                )}

                <Button
                  type="button"
                  variant="outline"
                  onClick={() => router.push("/")}
                >
                  Retour à l&apos;accueil
                </Button>
              </section>
            ) : null}

            {error ? <p className="text-sm text-red-600">{error}</p> : null}
          </div>

          <div className="mt-8 flex justify-between">
            <Button
              type="button"
              variant="outline"
              onClick={goBack}
              disabled={loading}
            >
              Retour
            </Button>
            {step === 1 ? (
              <Button
                type="button"
                onClick={goNext}
                disabled={
                  loading ||
                  typesLoading ||
                  !selectedTypeSeance ||
                  sessionTypes.length === 0
                }
              >
                Continuer
              </Button>
            ) : step === 2 ? (
              <Button
                type="button"
                onClick={goNext}
                disabled={loading}
              >
                Continuer
              </Button>
            ) : step === 3 ? (
              <Button
                type="button"
                variant="ghost"
                onClick={() => {
                  setError(null);
                  if (blockedSeanceId != null) {
                    void releaseBlock(blockedSeanceId);
                  }
                  setSelectedSlot(null);
                  setStep(2);
                }}
                disabled={loading}
              >
                Modifier le créneau
              </Button>
            ) : step === 4 ? (
              <Button
                type="button"
                variant="ghost"
                onClick={() => {
                  setError(null);
                  setStep(3);
                }}
                disabled={loading}
              >
                Modifier les infos
              </Button>
            ) : (
              <Button
                type="button"
                variant="ghost"
                onClick={() => {
                  if (blockedSeanceId != null) {
                    void releaseBlock(blockedSeanceId);
                  }
                  setStep(1);
                  setSelectedTypeSeance(null);
                  setSelectedSlot(null);
                  setError(null);
                  setClientSecret(null);
                  setSeanceId(null);
                  setBlockedSlots([]);
                }}
              >
                Nouvelle réservation
              </Button>
            )}
          </div>
        </Card>
      </div>
    </main>
  );
}

