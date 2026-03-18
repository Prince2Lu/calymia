"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { createBrowserClient } from "@supabase/ssr";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PaymentForm } from "@/components/booking/PaymentForm";

type Step = 1 | 2 | 3 | 4;

type SophrologueLite = {
  id: string | number;
  prenom: string | null;
  nom: string | null;
};

type PatientInfo = {
  prenom: string;
  nom: string;
  email: string;
  telephone: string;
  consent: boolean;
};

function pad2(n: number) {
  return n.toString().padStart(2, "0");
}

function formatDateFR(d: Date) {
  return new Intl.DateTimeFormat("fr-FR", {
    weekday: "long",
    day: "2-digit",
    month: "long",
    year: "numeric",
  }).format(d);
}

function formatTime(d: Date) {
  return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}

function startOfDay(d: Date) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function addDays(d: Date, days: number) {
  const x = new Date(d);
  x.setDate(x.getDate() + days);
  return x;
}

function isWeekend(d: Date) {
  const day = d.getDay(); // 0 Sun ... 6 Sat
  return day === 0 || day === 6;
}

function isSameDay(a: Date, b: Date) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function buildHourlySlots(day: Date) {
  // Lun-Ven 9:00 à 18:00, créneaux 60 minutes, dernier départ 17:00
  const slots: Date[] = [];
  const base = new Date(day);
  base.setHours(9, 0, 0, 0);
  for (let h = 9; h <= 17; h += 1) {
    const slot = new Date(day);
    slot.setHours(h, 0, 0, 0);
    slots.push(slot);
  }
  return slots;
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
    startOfDay(new Date()),
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
      const { data } = await supabase
        .from("sophrologues")
        .select("id, prenom, nom")
        .eq("slug", slug)
        .eq("actif", true)
        .maybeSingle<SophrologueLite>();
      if (!cancelled) setSophrologue(data ?? null);
    };
    run();
    return () => {
      cancelled = true;
    };
  }, [params.slug, supabase]);

  const sophrologueName = useMemo(() => {
    const prenom = sophrologue?.prenom ?? "";
    const nom = sophrologue?.nom ?? "";
    const full = `${prenom} ${nom}`.trim();
    return full || "le sophrologue";
  }, [sophrologue]);

  const days = useMemo(() => {
    const today = startOfDay(new Date());
    const out: Date[] = [];
    for (let i = 0; i < 28; i += 1) out.push(addDays(today, i));
    return out;
  }, []);

  const weeks = useMemo(() => {
    const out: Date[][] = [];
    for (let i = 0; i < days.length; i += 7) out.push(days.slice(i, i + 7));
    return out;
  }, [days]);

  const availableDaysSet = useMemo(() => {
    // Dispo par défaut : lun-ven
    return new Set<number>([1, 2, 3, 4, 5]);
  }, []);

  const slotsForSelectedDay = useMemo(() => {
    if (!availableDaysSet.has(selectedDay.getDay())) return [];
    return buildHourlySlots(selectedDay);
  }, [availableDaysSet, selectedDay]);

  const progress = (step / 4) * 100;

  const goBack = () => {
    setError(null);
    if (step === 1) {
      // Retour vers la page vitrine du sophrologue
      router.push(`/sophrologues/${params.dept}/${params.ville}/${params.slug}`);
      return;
    }
    setStep((s) => (s - 1) as Step);
  };

  const goNext = () => {
    setError(null);
    if (step === 1) {
      if (!selectedSlot) {
        setError("Merci de sélectionner un créneau.");
        return;
      }
      setStep(2);
      return;
    }
    if (step === 2) return;
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
      setError("Merci de renseigner toutes les informations patient.");
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

    setLoading(true);
    const montant = 60; // placeholder (types de séances à venir)
    const payload = {
      sophrologue_id: sophrologue.id,
      type_seance_nom: "Séance 60 min",
      montant,
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
    setStep(3);
  };

  return (
    <main className="min-h-screen bg-white">
      <div className="mx-auto max-w-5xl px-4 py-10">
        <div className="mb-6 space-y-2">
          <Badge>Réservation Calymia</Badge>
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
          <div className="flex items-center justify-between text-xs font-medium text-slate-600">
            {["Créneau", "Infos patient", "Paiement", "Confirmation"].map((t, i) => {
              const n = (i + 1) as Step;
              const active = n === step;
              const done = n < step;
              return (
                <div key={t} className="flex flex-1 items-center">
                  <div
                    className={`flex h-8 w-8 items-center justify-center rounded-full ${
                      done
                        ? "bg-[#27AE60] text-white"
                        : active
                          ? "bg-[#2E75B6] text-white"
                          : "bg-slate-200 text-slate-700"
                    }`}
                  >
                    {n}
                  </div>
                  <span className="ml-2 hidden text-slate-700 sm:inline">
                    {t}
                  </span>
                  {n < 4 ? (
                    <div className="ml-2 hidden h-0.5 flex-1 rounded bg-slate-200 sm:block">
                      <div
                        className={`h-0.5 rounded ${
                          step > n ? "bg-[#27AE60]" : "bg-transparent"
                        }`}
                      />
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
          <div className="mt-3 h-1 w-full rounded-full bg-slate-200">
            <div
              className="h-1 rounded-full bg-[#2E75B6] transition-all"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>

        <Card>
          <CardTitle>
            {step === 1 && "Étape 1 — Choix du créneau"}
            {step === 2 && "Étape 2 — Informations patient"}
            {step === 3 && "Étape 3 — Paiement"}
            {step === 4 && "Étape 4 — Confirmation"}
          </CardTitle>
          <CardDescription className="mt-1">
            {step === 1 && "Sélectionnez un créneau sur les 4 prochaines semaines."}
            {step === 2 &&
              "Renseignez vos informations pour confirmer la réservation."}
            {step === 3 && "Procédez au paiement sécurisé pour confirmer la séance."}
            {step === 4 && "Votre réservation est confirmée."}
          </CardDescription>

          <div className="mt-6 space-y-6">
            {step === 1 ? (
              <section className="grid gap-6 lg:grid-cols-[1.2fr,1fr]">
                <div className="space-y-3">
                  <h2 className="text-sm font-semibold text-slate-800">
                    Calendrier (4 semaines)
                  </h2>
                  <div className="space-y-3">
                    {weeks.map((week, wi) => (
                      <div
                        key={`w-${wi}`}
                        className="grid grid-cols-7 gap-2"
                      >
                        {week.map((d) => {
                          const isAvailable = availableDaysSet.has(d.getDay());
                          const isSelected = isSameDay(d, selectedDay);
                          const isDisabled = !isAvailable || isWeekend(d);
                          return (
                            <button
                              key={d.toISOString()}
                              type="button"
                              onClick={() => {
                                if (isDisabled) return;
                                setSelectedDay(startOfDay(d));
                                setSelectedSlot(null);
                              }}
                              className={`rounded-lg border px-2 py-2 text-xs transition-colors ${
                                isSelected
                                  ? "border-[#2E75B6] bg-[#2E75B6]/10 text-[#1E3A5F]"
                                  : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                              } ${isDisabled ? "opacity-40 cursor-not-allowed" : ""}`}
                              aria-disabled={isDisabled}
                            >
                              <div className="font-semibold">
                                {d.toLocaleDateString("fr-FR", {
                                  weekday: "short",
                                })}
                              </div>
                              <div className="text-sm font-semibold">
                                {d.getDate()}
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    ))}
                  </div>
                  <p className="text-xs text-slate-500">
                    Disponibilités par défaut : lundi à vendredi, 9h–18h.
                  </p>
                </div>

                <div className="space-y-3">
                  <h2 className="text-sm font-semibold text-slate-800">
                    Créneaux du {formatDateFR(selectedDay)}
                  </h2>
                  {slotsForSelectedDay.length === 0 ? (
                    <p className="text-sm text-slate-600">
                      Aucun créneau disponible ce jour-là.
                    </p>
                  ) : (
                    <div className="grid grid-cols-2 gap-2">
                      {slotsForSelectedDay.map((slot) => {
                        const selected =
                          selectedSlot?.getTime() === slot.getTime();
                        return (
                          <button
                            key={slot.toISOString()}
                            type="button"
                            onClick={() => setSelectedSlot(slot)}
                            className={`rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${
                              selected
                                ? "border-[#27AE60] bg-[#27AE60]/15 text-[#1E3A5F]"
                                : "border-slate-200 bg-white text-slate-800 hover:bg-slate-50"
                            }`}
                          >
                            {formatTime(slot)}
                          </button>
                        );
                      })}
                    </div>
                  )}

                  {selectedSlot ? (
                    <div className="rounded-xl border border-[#27AE60]/30 bg-[#27AE60]/5 p-3">
                      <p className="text-sm text-slate-800">
                        <span className="font-semibold text-[#1E3A5F]">
                          Créneau sélectionné
                        </span>{" "}
                        : {formatDateFR(selectedSlot)} à {formatTime(selectedSlot)}
                      </p>
                    </div>
                  ) : null}
                </div>
              </section>
            ) : null}

            {step === 2 ? (
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
                      onChange={(e) =>
                        setPatient((p) => ({ ...p, email: e.target.value }))
                      }
                    />
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
                    />
                  </div>
                </div>

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

                <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                  <p className="text-sm text-slate-800">
                    <span className="font-semibold text-[#1E3A5F]">
                      Créneau
                    </span>{" "}
                    :{" "}
                    {selectedSlot
                      ? `${formatDateFR(selectedSlot)} à ${formatTime(
                          selectedSlot,
                        )}`
                      : "Non sélectionné"}
                  </p>
                </div>

                <Button
                  type="button"
                  className="w-full bg-[#1E3A5F] hover:bg-[#2E75B6]"
                  onClick={createPaymentIntent}
                  disabled={loading}
                >
                  {loading ? "Initialisation du paiement..." : "Continuer vers le paiement"}
                </Button>
              </section>
            ) : null}

            {step === 3 ? (
              <section className="space-y-4">
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-800">
                  <p>
                    <span className="font-semibold text-[#1E3A5F]">Créneau</span>{" "}
                    :{" "}
                    {selectedSlot
                      ? `${formatDateFR(selectedSlot)} à ${formatTime(
                          selectedSlot,
                        )}`
                      : "—"}
                  </p>
                  <p className="mt-1">
                    <span className="font-semibold text-[#1E3A5F]">
                      Sophrologue
                    </span>{" "}
                    : {sophrologueName}
                  </p>
                </div>

                {clientSecret && seanceId != null ? (
                  <PaymentForm
                    amount={60}
                    clientSecret={clientSecret}
                    seanceId={seanceId}
                    onSuccess={() => setStep(4)}
                  />
                ) : (
                  <p className="text-sm text-slate-600">
                    Initialisation du paiement en cours…
                  </p>
                )}
              </section>
            ) : null}

            {step === 4 ? (
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
                      Date &amp; heure
                    </span>{" "}
                    :{" "}
                    {selectedSlot
                      ? `${formatDateFR(selectedSlot)} à ${formatTime(
                          selectedSlot,
                        )}`
                      : "—"}
                  </p>
                </div>

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
                className="bg-[#1E3A5F] hover:bg-[#2E75B6]"
                disabled={loading}
              >
                Continuer
              </Button>
            ) : step === 2 ? (
              <Button
                type="button"
                variant="ghost"
                onClick={() => setStep(1)}
                disabled={loading}
              >
                Modifier le créneau
              </Button>
            ) : step === 3 ? (
              <Button
                type="button"
                variant="ghost"
                onClick={() => setStep(2)}
                disabled={loading}
              >
                Modifier les infos
              </Button>
            ) : (
              <Button
                type="button"
                variant="ghost"
                onClick={() => {
                  setStep(1);
                  setSelectedSlot(null);
                  setError(null);
                  setClientSecret(null);
                  setSeanceId(null);
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

