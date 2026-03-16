"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createBrowserClient } from "@supabase/ssr";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

type Specialty =
  | "stress"
  | "sommeil"
  | "confiance"
  | "douleur"
  | "sport"
  | "grossesse"
  | "enfants"
  | "preparation"
  | "arret_tabac"
  | "autres";

type DayKey = "lundi" | "mardi" | "mercredi" | "jeudi" | "vendredi" | "samedi";

type SessionType = {
  id: number;
  name: string;
  duration: "30" | "45" | "60" | "90";
  price: string;
};

type OnboardingState = {
  // Étape 1
  bio: string;
  specialties: Specialty[];
  rpps?: string;
  teleconsultationUrl?: string;
  // Étape 2
  address: string;
  city: string;
  postalCode: string;
  phone: string;
  // Étape 3
  availability: Record<
    DayKey,
    {
      enabled: boolean;
      start: string;
      end: string;
    }
  >;
  sessionTypes: SessionType[];
  minBookingDelay: "6" | "12" | "24" | "48";
};

const INITIAL_STATE: OnboardingState = {
  bio: "",
  specialties: [],
  rpps: "",
  teleconsultationUrl: "",
  address: "",
  city: "",
  postalCode: "",
  phone: "",
  availability: {
    lundi: { enabled: false, start: "09:00", end: "18:00" },
    mardi: { enabled: false, start: "09:00", end: "18:00" },
    mercredi: { enabled: false, start: "09:00", end: "18:00" },
    jeudi: { enabled: false, start: "09:00", end: "18:00" },
    vendredi: { enabled: false, start: "09:00", end: "18:00" },
    samedi: { enabled: false, start: "09:00", end: "13:00" },
  },
  sessionTypes: [],
  minBookingDelay: "24",
};

const SPECIALTY_OPTIONS: { value: Specialty; label: string }[] = [
  { value: "stress", label: "Stress" },
  { value: "sommeil", label: "Sommeil" },
  { value: "confiance", label: "Confiance en soi" },
  { value: "douleur", label: "Douleur" },
  { value: "sport", label: "Sport" },
  { value: "grossesse", label: "Grossesse" },
  { value: "enfants", label: "Enfants" },
  { value: "preparation", label: "Préparation mentale" },
  { value: "arret_tabac", label: "Arrêt tabac" },
  { value: "autres", label: "Autres" },
];

const DAYS: { key: DayKey; label: string }[] = [
  { key: "lundi", label: "Lundi" },
  { key: "mardi", label: "Mardi" },
  { key: "mercredi", label: "Mercredi" },
  { key: "jeudi", label: "Jeudi" },
  { key: "vendredi", label: "Vendredi" },
  { key: "samedi", label: "Samedi" },
];

const STEP_TITLES = [
  "Profil public",
  "Cabinet",
  "Disponibilités et tarifs",
  "Récapitulatif",
] as const;

export default function OnboardingPage() {
  const [step, setStep] = useState(1);
  const [state, setState] = useState<OnboardingState>(INITIAL_STATE);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );

  const goNext = () => setStep((s) => Math.min(4, s + 1));
  const goBack = () => setStep((s) => Math.max(1, s - 1));

  const toggleSpecialty = (value: Specialty) => {
    setState((prev) => {
      const exists = prev.specialties.includes(value);
      return {
        ...prev,
        specialties: exists
          ? prev.specialties.filter((s) => s !== value)
          : [...prev.specialties, value],
      };
    });
  };

  const updateAvailability = (
    day: DayKey,
    field: "enabled" | "start" | "end",
    value: boolean | string,
  ) => {
    setState((prev) => ({
      ...prev,
      availability: {
        ...prev.availability,
        [day]: {
          ...prev.availability[day],
          [field]: value,
        },
      },
    }));
  };

  const addSessionType = () => {
    setState((prev) => ({
      ...prev,
      sessionTypes: [
        ...prev.sessionTypes,
        {
          id: Date.now(),
          name: "",
          duration: "60",
          price: "",
        },
      ],
    }));
  };

  const updateSessionType = (
    id: number,
    field: keyof Omit<SessionType, "id">,
    value: string,
  ) => {
    setState((prev) => ({
      ...prev,
      sessionTypes: prev.sessionTypes.map((s) =>
        s.id === id ? { ...s, [field]: value } : s,
      ),
    }));
  };

  const removeSessionType = (id: number) => {
    setState((prev) => ({
      ...prev,
      sessionTypes: prev.sessionTypes.filter((s) => s.id !== id),
    }));
  };

  const handleFinish = async () => {
    setLoading(true);
    setError(null);

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      setError(
        "Impossible de récupérer votre compte. Merci de vous reconnecter.",
      );
      setLoading(false);
      return;
    }

    const response = await fetch("/api/sophrologue/update", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        userId: user.id,
        bio: state.bio,
        specialties: state.specialties,
        rpps: state.rpps,
        teleconsultationUrl: state.teleconsultationUrl,
        address: state.address,
        city: state.city,
        postalCode: state.postalCode,
        phone: state.phone,
        availability: state.availability,
        sessionTypes: state.sessionTypes,
        minBookingDelay: state.minBookingDelay,
      }),
    });

    if (!response.ok) {
      const data = (await response.json().catch(() => null)) as
        | { error?: string }
        | null;
      setError(
        data?.error ??
          "Une erreur est survenue lors de la sauvegarde de votre profil. Merci de réessayer.",
      );
      setLoading(false);
      return;
    }

    router.push("/dashboard");
  };

  const progress = (step / 4) * 100;

  return (
    <main className="flex min-h-screen justify-center bg-slate-50 py-10">
      <div className="w-full max-w-4xl px-4">
        <div className="mb-6 space-y-2">
          <Badge>Onboarding Calymia</Badge>
          <h1 className="text-3xl font-semibold text-[#1E3A5F]">
            Configurez votre espace en quelques étapes
          </h1>
          <p className="text-sm text-slate-600">
            Vous pourrez modifier ces informations ultérieurement dans vos
            paramètres.
          </p>
        </div>

        <div className="mb-6">
          <div className="flex items-center justify-between text-xs font-medium text-slate-600">
            {STEP_TITLES.map((title, index) => {
              const stepNumber = index + 1;
              const isActive = stepNumber === step;
              const isDone = stepNumber < step;
              return (
                <div key={title} className="flex flex-1 items-center">
                  <div
                    className={`flex h-8 w-8 items-center justify-center rounded-full text-white ${
                      isDone
                        ? "bg-[#27AE60]"
                        : isActive
                          ? "bg-[#2E75B6]"
                          : "bg-slate-200 text-slate-700"
                    }`}
                  >
                    {stepNumber}
                  </div>
                  <span className="ml-2 hidden text-xs text-slate-700 sm:inline">
                    {title}
                  </span>
                  {stepNumber < 4 && (
                    <div className="ml-2 hidden h-0.5 flex-1 rounded bg-slate-200 sm:block">
                      <div
                        className={`h-0.5 rounded ${
                          step > stepNumber ? "bg-[#27AE60]" : "bg-transparent"
                        }`}
                      />
                    </div>
                  )}
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
          <CardTitle>{STEP_TITLES[step - 1]}</CardTitle>
          <CardDescription className="mt-1">
            {step === 1 &&
              "Présentez votre activité et ce qui vous distingue en tant que sophrologue."}
            {step === 2 &&
              "Indiquez les informations principales de votre cabinet."}
            {step === 3 &&
              "Définissez vos créneaux d’ouverture et vos types de séances."}
            {step === 4 &&
              "Vérifiez les informations avant d’accéder à votre tableau de bord."}
          </CardDescription>

          <div className="mt-6 space-y-6">
            {step === 1 && (
              <section className="space-y-4">
                <div className="space-y-1">
                  <label className="text-sm font-medium text-slate-800">
                    Photo de profil
                  </label>
                  <input
                    type="file"
                    accept="image/*"
                    className="block w-full text-sm text-slate-600 file:mr-4 file:rounded-lg file:border-0 file:bg-[#2E75B6] file:px-4 file:py-2 file:text-sm file:font-medium file:text-white hover:file:bg-[#1E3A5F]"
                  />
                  <p className="text-xs text-slate-500">
                    Formats recommandés : JPG ou PNG, minimum 400x400px.
                  </p>
                </div>

                <div className="space-y-1">
                  <label className="text-sm font-medium text-slate-800">
                    Bio
                  </label>
                  <textarea
                    className="min-h-[120px] w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1E3A5F] focus-visible:ring-offset-2"
                    value={state.bio}
                    onChange={(e) =>
                      setState((prev) => ({ ...prev, bio: e.target.value }))
                    }
                    placeholder="Expliquez votre approche, votre expérience et votre accompagnement."
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-800">
                    Spécialités
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {SPECIALTY_OPTIONS.map((option) => {
                      const active = state.specialties.includes(option.value);
                      return (
                        <button
                          key={option.value}
                          type="button"
                          onClick={() => toggleSpecialty(option.value)}
                          className={`rounded-full border px-3 py-1 text-xs font-medium ${
                            active
                              ? "border-[#2E75B6] bg-[#2E75B6] text-white"
                              : "border-slate-200 bg-white text-slate-700 hover:border-[#2E75B6]"
                          }`}
                        >
                          {option.label}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-1">
                    <label className="text-sm font-medium text-slate-800">
                      Numéro RPPS (optionnel)
                    </label>
                    <Input
                      value={state.rpps ?? ""}
                      onChange={(e) =>
                        setState((prev) => ({ ...prev, rpps: e.target.value }))
                      }
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-sm font-medium text-slate-800">
                      Lien de téléconsultation (optionnel)
                    </label>
                    <Input
                      value={state.teleconsultationUrl ?? ""}
                      onChange={(e) =>
                        setState((prev) => ({
                          ...prev,
                          teleconsultationUrl: e.target.value,
                        }))
                      }
                      placeholder="https://..."
                    />
                  </div>
                </div>
              </section>
            )}

            {step === 2 && (
              <section className="space-y-4">
                <div className="space-y-1">
                  <label className="text-sm font-medium text-slate-800">
                    Adresse complète
                  </label>
                  <Input
                    value={state.address}
                    onChange={(e) =>
                      setState((prev) => ({ ...prev, address: e.target.value }))
                    }
                    placeholder="Numéro, rue, complément..."
                  />
                </div>
                <div className="grid gap-4 md:grid-cols-3">
                  <div className="space-y-1 md:col-span-2">
                    <label className="text-sm font-medium text-slate-800">
                      Ville
                    </label>
                    <Input
                      value={state.city}
                      onChange={(e) =>
                        setState((prev) => ({ ...prev, city: e.target.value }))
                      }
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-sm font-medium text-slate-800">
                      Code postal
                    </label>
                    <Input
                      value={state.postalCode}
                      onChange={(e) =>
                        setState((prev) => ({
                          ...prev,
                          postalCode: e.target.value,
                        }))
                      }
                    />
                  </div>
                </div>
                <div className="space-y-1">
                  <label className="text-sm font-medium text-slate-800">
                    Téléphone
                  </label>
                  <Input
                    value={state.phone}
                    onChange={(e) =>
                      setState((prev) => ({ ...prev, phone: e.target.value }))
                    }
                    placeholder="06..."
                  />
                </div>
              </section>
            )}

            {step === 3 && (
              <section className="space-y-6">
                <div className="space-y-2">
                  <h2 className="text-sm font-medium text-slate-800">
                    Jours d’ouverture
                  </h2>
                  <div className="grid gap-3 md:grid-cols-3">
                    {DAYS.map((day) => {
                      const config = state.availability[day.key];
                      return (
                        <div
                          key={day.key}
                          className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs shadow-sm"
                        >
                          <label className="flex items-center gap-2">
                            <input
                              type="checkbox"
                              checked={config.enabled}
                              onChange={(e) =>
                                updateAvailability(
                                  day.key,
                                  "enabled",
                                  e.target.checked,
                                )
                              }
                            />
                            <span className="font-medium text-slate-800">
                              {day.label}
                            </span>
                          </label>
                          {config.enabled && (
                            <div className="mt-2 flex items-center gap-2">
                              <Input
                                type="time"
                                value={config.start}
                                onChange={(e) =>
                                  updateAvailability(
                                    day.key,
                                    "start",
                                    e.target.value,
                                  )
                                }
                                className="h-8"
                              />
                              <span className="text-slate-500">à</span>
                              <Input
                                type="time"
                                value={config.end}
                                onChange={(e) =>
                                  updateAvailability(
                                    day.key,
                                    "end",
                                    e.target.value,
                                  )
                                }
                                className="h-8"
                              />
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h2 className="text-sm font-medium text-slate-800">
                      Types de séances
                    </h2>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="border-[#2E75B6] text-[#2E75B6]"
                      onClick={addSessionType}
                    >
                      Ajouter une séance
                    </Button>
                  </div>
                  <div className="space-y-3">
                    {state.sessionTypes.length === 0 && (
                      <p className="text-xs text-slate-500">
                        Ajoutez au moins un type de séance (ex. séance
                        individuelle, téléconsultation, groupe...).
                      </p>
                    )}
                    {state.sessionTypes.map((session) => (
                      <div
                        key={session.id}
                        className="grid gap-3 rounded-lg border border-slate-200 bg-white p-3 text-xs shadow-sm md:grid-cols-[2fr,1fr,1fr,auto]"
                      >
                        <Input
                          placeholder="Nom de la séance"
                          value={session.name}
                          onChange={(e) =>
                            updateSessionType(
                              session.id,
                              "name",
                              e.target.value,
                            )
                          }
                        />
                        <select
                          className="h-10 rounded-lg border border-slate-200 bg-white px-2 text-xs text-slate-800"
                          value={session.duration}
                          onChange={(e) =>
                            updateSessionType(
                              session.id,
                              "duration",
                              e.target.value,
                            )
                          }
                        >
                          <option value="30">30 min</option>
                          <option value="45">45 min</option>
                          <option value="60">60 min</option>
                          <option value="90">90 min</option>
                        </select>
                        <div className="flex items-center gap-1">
                          <Input
                            type="number"
                            min="0"
                            step="1"
                            placeholder="Tarif"
                            value={session.price}
                            onChange={(e) =>
                              updateSessionType(
                                session.id,
                                "price",
                                e.target.value,
                              )
                            }
                          />
                          <span className="text-slate-500">€</span>
                        </div>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => removeSessionType(session.id)}
                        >
                          Suppr.
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-sm font-medium text-slate-800">
                    Délai minimum avant réservation
                  </label>
                  <select
                    className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-800"
                    value={state.minBookingDelay}
                    onChange={(e) =>
                      setState((prev) => ({
                        ...prev,
                        minBookingDelay: e.target.value as
                          | "6"
                          | "12"
                          | "24"
                          | "48",
                      }))
                    }
                  >
                    <option value="6">6 heures</option>
                    <option value="12">12 heures</option>
                    <option value="24">24 heures</option>
                    <option value="48">48 heures</option>
                  </select>
                </div>
              </section>
            )}

            {step === 4 && (
              <section className="space-y-4 text-sm text-slate-800">
                <div>
                  <h2 className="text-sm font-semibold text-[#1E3A5F]">
                    Profil public
                  </h2>
                  <p className="mt-1 whitespace-pre-line text-slate-700">
                    {state.bio || "Aucune bio renseignée pour le moment."}
                  </p>
                  <p className="mt-1 text-xs text-slate-600">
                    Spécialités :{" "}
                    {state.specialties.length > 0
                      ? state.specialties
                          .map(
                            (s) =>
                              SPECIALTY_OPTIONS.find((o) => o.value === s)
                                ?.label ?? s,
                          )
                          .join(", ")
                      : "Non renseignées"}
                  </p>
                  <p className="mt-1 text-xs text-slate-600">
                    RPPS : {state.rpps || "Non renseigné"} · Téléconsultation :{" "}
                    {state.teleconsultationUrl || "Non renseignée"}
                  </p>
                </div>

                <div>
                  <h2 className="text-sm font-semibold text-[#1E3A5F]">
                    Cabinet
                  </h2>
                  <p className="mt-1 text-xs text-slate-700">
                    {state.address && (
                      <>
                        {state.address}
                        <br />
                      </>
                    )}
                    {state.postalCode} {state.city}
                  </p>
                  <p className="mt-1 text-xs text-slate-600">
                    Téléphone : {state.phone || "Non renseigné"}
                  </p>
                </div>

                <div>
                  <h2 className="text-sm font-semibold text-[#1E3A5F]">
                    Disponibilités
                  </h2>
                  <ul className="mt-1 space-y-1 text-xs text-slate-700">
                    {DAYS.map((day) => {
                      const config = state.availability[day.key];
                      if (!config.enabled) return null;
                      return (
                        <li key={day.key}>
                          {day.label} : {config.start} – {config.end}
                        </li>
                      );
                    })}
                    {!Object.values(state.availability).some(
                      (d) => d.enabled,
                    ) && <li>Aucune disponibilité renseignée.</li>}
                  </ul>
                  <p className="mt-1 text-xs text-slate-600">
                    Délai minimum avant réservation : {state.minBookingDelay}h
                  </p>
                </div>

                <div>
                  <h2 className="text-sm font-semibold text-[#1E3A5F]">
                    Types de séances
                  </h2>
                  {state.sessionTypes.length === 0 ? (
                    <p className="mt-1 text-xs text-slate-700">
                      Aucun type de séance défini.
                    </p>
                  ) : (
                    <ul className="mt-1 space-y-1 text-xs text-slate-700">
                      {state.sessionTypes.map((s) => (
                        <li key={s.id}>
                          {s.name || "Sans nom"} — {s.duration} min —{" "}
                          {s.price || "Tarif non défini"} €
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </section>
            )}

            {error && (
              <p className="text-sm text-red-600">
                {error}
              </p>
            )}
          </div>

          <div className="mt-8 flex justify-between">
            <Button
              type="button"
              variant="outline"
              onClick={goBack}
              disabled={step === 1 || loading}
            >
              Retour
            </Button>
            {step < 4 ? (
              <Button
                type="button"
                className="bg-[#1E3A5F] hover:bg-[#2E75B6]"
                onClick={goNext}
                disabled={loading}
              >
                Continuer
              </Button>
            ) : (
              <Button
                type="button"
                className="bg-[#27AE60] hover:bg-emerald-600"
                onClick={handleFinish}
                disabled={loading}
              >
                Terminer et accéder à mon dashboard
              </Button>
            )}
          </div>
        </Card>
      </div>
    </main>
  );
}

