"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createBrowserClient } from "@supabase/ssr";
import { Loader2 } from "lucide-react";
import { uploadAvatarWithSession } from "@/lib/supabase/upload-avatar-client";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  OnboardingVitrineStep,
  createInitialVitrineData,
  type OnboardingVitrineData,
} from "@/components/onboarding/OnboardingVitrineStep";
import { usePlan } from "@/hooks/usePlan";

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
  /** Public URL after upload to Storage (`avatars` bucket) */
  photoUrl: string | null;
  bio: string;
  specialties: Specialty[];
  rpps?: string;
  teleconsultationUrl?: string;
  // Étape 2
  address: string;
  city: string;
  postalCode: string;
  phone: string;
  // Étape 3 — chaque jour peut avoir plusieurs plages horaires
  availability: Record<
    DayKey,
    {
      enabled: boolean;
      slots: { start: string; end: string }[];
    }
  >;
  sessionTypes: SessionType[];
  minBookingDelay: "6" | "12" | "24" | "48";
  /** Étape 4 — vitrine (optionnel) */
  vitrine: OnboardingVitrineData;
};

const INITIAL_STATE: OnboardingState = {
  photoUrl: null,
  bio: "",
  specialties: [],
  rpps: "",
  teleconsultationUrl: "",
  address: "",
  city: "",
  postalCode: "",
  phone: "",
  availability: {
    lundi: { enabled: false, slots: [{ start: "09:00", end: "18:00" }] },
    mardi: { enabled: false, slots: [{ start: "09:00", end: "18:00" }] },
    mercredi: { enabled: false, slots: [{ start: "09:00", end: "18:00" }] },
    jeudi: { enabled: false, slots: [{ start: "09:00", end: "18:00" }] },
    vendredi: { enabled: false, slots: [{ start: "09:00", end: "18:00" }] },
    samedi: { enabled: false, slots: [{ start: "09:00", end: "13:00" }] },
  },
  sessionTypes: [],
  minBookingDelay: "24",
  vitrine: createInitialVitrineData(),
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

// Maps the French day key to the DB jour_semaine value (1=lundi … 6=samedi)
const DAY_TO_JOUR: Record<DayKey, number> = {
  lundi: 1,
  mardi: 2,
  mercredi: 3,
  jeudi: 4,
  vendredi: 5,
  samedi: 6,
};

const STEP_TITLES = [
  "Profil public",
  "Cabinet",
  "Disponibilités et tarifs",
  "Votre vitrine",
  "Récapitulatif",
] as const;

const TOTAL_STEPS = STEP_TITLES.length;

export default function OnboardingPage() {
  const { maxPhotos } = usePlan();
  const [step, setStep] = useState(1);
  const [state, setState] = useState<OnboardingState>(INITIAL_STATE);
  const [photoPreviewLocal, setPhotoPreviewLocal] = useState<string | null>(null);
  const [photoUploading, setPhotoUploading] = useState(false);
  const [sophrologueId, setSophrologueId] = useState<string | null>(null);
  const [authUserId, setAuthUserId] = useState<string | null>(null);
  const [prenom, setPrenom] = useState("");
  const [nom, setNom] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  const photoInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    return () => {
      if (photoPreviewLocal) {
        URL.revokeObjectURL(photoPreviewLocal);
      }
    };
  }, [photoPreviewLocal]);

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user || cancelled) return;
      if (!cancelled) setAuthUserId(user.id);
      const { data } = await supabase
        .from("sophrologues")
        .select("id, prenom, nom")
        .eq("user_id", user.id)
        .maybeSingle<{ id: string; prenom: string | null; nom: string | null }>();
      if (!cancelled && data?.id) {
        setSophrologueId(data.id);
        setPrenom(data.prenom ?? "");
        setNom(data.nom ?? "");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [supabase]);

  const goNext = () => setStep((s) => Math.min(TOTAL_STEPS, s + 1));
  const skipVitrineStep = () => setStep(5);

  const vitrineOnChange = (field: keyof OnboardingVitrineData, value: unknown) => {
    setState((prev) => ({
      ...prev,
      vitrine: { ...prev.vitrine, [field]: value } as OnboardingVitrineData,
    }));
  };
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

  const updateDayEnabled = (day: DayKey, enabled: boolean) => {
    setState((prev) => ({
      ...prev,
      availability: {
        ...prev.availability,
        [day]: {
          ...prev.availability[day],
          enabled,
          slots: enabled && prev.availability[day].slots.length === 0
            ? [{ start: "09:00", end: "18:00" }]
            : prev.availability[day].slots,
        },
      },
    }));
  };

  const addSlot = (day: DayKey) => {
    setState((prev) => ({
      ...prev,
      availability: {
        ...prev.availability,
        [day]: {
          ...prev.availability[day],
          slots: [...prev.availability[day].slots, { start: "14:00", end: "18:00" }],
        },
      },
    }));
  };

  const updateSlot = (day: DayKey, slotIdx: number, field: "start" | "end", value: string) => {
    setState((prev) => ({
      ...prev,
      availability: {
        ...prev.availability,
        [day]: {
          ...prev.availability[day],
          slots: prev.availability[day].slots.map((s, i) =>
            i === slotIdx ? { ...s, [field]: value } : s,
          ),
        },
      },
    }));
  };

  const removeSlot = (day: DayKey, slotIdx: number) => {
    setState((prev) => {
      const slots = prev.availability[day].slots.filter((_, i) => i !== slotIdx);
      return {
        ...prev,
        availability: {
          ...prev.availability,
          [day]: {
            ...prev.availability[day],
            slots: slots.length === 0 ? [{ start: "09:00", end: "18:00" }] : slots,
          },
        },
      };
    });
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

  const handlePhotoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setError(null);
    if (photoPreviewLocal) {
      URL.revokeObjectURL(photoPreviewLocal);
    }
    const localUrl = URL.createObjectURL(file);
    setPhotoPreviewLocal(localUrl);
    setPhotoUploading(true);

    try {
      let sid = sophrologueId;
      if (!sid) {
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (!user) {
          URL.revokeObjectURL(localUrl);
          setPhotoPreviewLocal(null);
          setError("Session expirée. Reconnectez-vous pour ajouter une photo.");
          return;
        }
        const { data: row } = await supabase
          .from("sophrologues")
          .select("id")
          .eq("user_id", user.id)
          .maybeSingle<{ id: string }>();
        if (!row?.id) {
          URL.revokeObjectURL(localUrl);
          setPhotoPreviewLocal(null);
          setError("Profil introuvable. Réessayez dans un instant.");
          return;
        }
        sid = row.id;
        setSophrologueId(sid);
      }

      const result = await uploadAvatarWithSession(supabase, sid, file);
      if ("error" in result) {
        URL.revokeObjectURL(localUrl);
        setPhotoPreviewLocal(null);
        setState((prev) => ({ ...prev, photoUrl: null }));
        setError(result.error);
        return;
      }

      setState((prev) => ({ ...prev, photoUrl: result.publicUrl }));
      URL.revokeObjectURL(localUrl);
      setPhotoPreviewLocal(null);
    } catch {
      URL.revokeObjectURL(localUrl);
      setPhotoPreviewLocal(null);
      setState((prev) => ({ ...prev, photoUrl: null }));
      setError("Échec de l’envoi de la photo. Vérifiez votre connexion.");
    } finally {
      setPhotoUploading(false);
      e.target.value = "";
    }
  };

  const handleFinish = async () => {
    setLoading(true);
    setError(null);

    // ── 1) Auth user ───────────────────────────────────────────────────────
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      setError("Impossible de récupérer votre compte. Merci de vous reconnecter.");
      setLoading(false);
      return;
    }

    // ── 2) Fetch the sophrologue row to get its PK (needed for related tables)
    const { data: sophrologueRow, error: sophrologueError } = await supabase
      .from("sophrologues")
      .select("id, prenom, nom")
      .eq("user_id", user.id)
      .single<{ id: string; prenom: string | null; nom: string | null }>();

    if (sophrologueError || !sophrologueRow) {
      setError("Profil sophrologue introuvable. Merci de vous reconnecter.");
      setLoading(false);
      return;
    }

    const sophrologueId = sophrologueRow.id;
    const prenomPayload = prenom || sophrologueRow.prenom || "";
    const nomPayload = nom || sophrologueRow.nom || "";

    // ── 3) Save profile (bio, address, specialties, etc.) ─────────────────
    const profileRes = await fetch("/api/sophrologue/update", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        userId: user.id,
        prenom: prenomPayload,
        nom: nomPayload,
        bio: state.bio,
        specialties: state.specialties,
        rpps: state.rpps,
        teleconsultationUrl: state.teleconsultationUrl,
        address: state.address,
        city: state.city,
        postalCode: state.postalCode,
        phone: state.phone,
        ...(state.photoUrl ? { photo_url: state.photoUrl } : {}),
        photos_cabinet: state.vitrine.photos_cabinet,
        horaires: state.vitrine.horaires,
        horaires_texte: state.vitrine.horaires_texte,
        infos_pratiques: state.vitrine.infos_pratiques,
        modes_paiement: state.vitrine.modes_paiement,
        formations: state.vitrine.formations,
        certifications: state.vitrine.certifications,
        syndicats: state.vitrine.syndicats,
      }),
    });

    if (!profileRes.ok) {
      const d = (await profileRes.json().catch(() => null)) as { error?: string } | null;
      setError(d?.error ?? "Erreur lors de la sauvegarde du profil. Merci de réessayer.");
      setLoading(false);
      return;
    }

    // ── 4) Save availability (disponibilites + parametres_cabinet) ─────────
    const dispos = (Object.entries(state.availability) as [DayKey, { enabled: boolean; slots: { start: string; end: string }[] }][])
      .filter(([, cfg]) => cfg.enabled)
      .flatMap(([day, cfg]) =>
        cfg.slots.map((slot) => ({
          jour_semaine: DAY_TO_JOUR[day],
          heure_debut: slot.start,
          heure_fin: slot.end,
          actif: true,
        })),
      );

    console.log(`[onboarding] Saving disponibilites: ${dispos.length} days`, dispos);

    const dispoRes = await fetch("/api/sophrologue/disponibilites", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sophrologue_id: sophrologueId,
        dispos,
        delai: Number(state.minBookingDelay),
      }),
    });

    if (!dispoRes.ok) {
      const d = (await dispoRes.json().catch(() => null)) as { error?: string } | null;
      setError(d?.error ?? "Erreur lors de la sauvegarde des disponibilités. Merci de réessayer.");
      setLoading(false);
      return;
    }

    // ── 5) Save session types (types_seances) ──────────────────────────────
    const validSessionTypes = state.sessionTypes.filter(
      (s) => s.name.trim() !== "" && s.price !== "",
    );

    console.log(`[onboarding] Saving types_seances: ${validSessionTypes.length} types`, validSessionTypes);

    if (validSessionTypes.length > 0) {
      const results = await Promise.all(
        validSessionTypes.map((s) =>
          fetch("/api/types-seances/create", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              sophrologue_id: sophrologueId,
              nom: s.name.trim(),
              duree_minutes: Number(s.duration),
              tarif: Number(s.price),
            }),
          }),
        ),
      );

      const failed = results.find((r) => !r.ok);
      if (failed) {
        const d = (await failed.json().catch(() => null)) as { error?: string } | null;
        setError(d?.error ?? "Erreur lors de la sauvegarde des types de séances. Merci de réessayer.");
        setLoading(false);
        return;
      }
    }

    // ── 6) Mark onboarding as completed (direct client — bypasses RLS via
    //       the anon key; RLS must allow sophrologues to update their own row)
    const { error: flagError } = await supabase
      .from("sophrologues")
      .update({ onboarding_completed: true })
      .eq("user_id", user.id);

    if (flagError) {
      console.error("[onboarding] Failed to set onboarding_completed:", flagError);
      // Non-blocking: we still redirect — the middleware guard will loop the
      // user back here on next visit, but we don't want to block the UX now.
    } else {
      console.log("[onboarding] onboarding_completed set to true");

      // ── 6b) Envoi email de bienvenue (non bloquant) ─────────────────────
      try {
        await fetch("/api/emails/welcome-sophrologue", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sophrologue_id: sophrologueId }),
        });
      } catch {
        // Ignoré — l'email ne doit pas bloquer la redirection
      }
    }

    // ── 7) All good — go to dashboard ─────────────────────────────────────
    router.push("/dashboard");
  };

  const progress = (step / TOTAL_STEPS) * 100;

  return (
    <main className="flex min-h-screen justify-center bg-slate-50 py-10">
      <div className="w-full max-w-4xl px-4">
        <div className="mb-6 space-y-2">
          <Badge>Onboarding Calymia</Badge>
          <h1 className="text-3xl font-semibold text-[#426F59]">
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
                        ? "bg-[#426F59]"
                        : isActive
                          ? "bg-[#426F59]"
                          : "bg-slate-200 text-slate-700"
                    }`}
                  >
                    {stepNumber}
                  </div>
                  <span className="ml-2 hidden text-xs text-slate-700 sm:inline">
                    {title}
                  </span>
                  {stepNumber < TOTAL_STEPS && (
                    <div className="ml-2 hidden h-0.5 flex-1 rounded bg-slate-200 sm:block">
                      <div
                        className={`h-0.5 rounded ${
                          step > stepNumber ? "bg-[#426F59]" : "bg-transparent"
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
              className="h-1 rounded-full bg-[#426F59] transition-all"
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
              "Enrichissez votre page publique : photos, horaires affichés, infos pratiques… Tout est optionnel."}
            {step === 5 &&
              "Vérifiez les informations avant d’accéder à votre tableau de bord."}
          </CardDescription>

          <div className="mt-6 space-y-6">
            {step === 1 && (
              <section className="space-y-4">
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-1">
                    <label className="text-sm font-medium text-slate-800">
                      Prénom
                    </label>
                    <Input
                      value={prenom}
                      readOnly
                      disabled
                      className="cursor-default bg-slate-50 text-slate-700"
                      title="Renseigné à l’inscription — modifiable dans Paramètres après l’onboarding"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-sm font-medium text-slate-800">
                      Nom
                    </label>
                    <Input
                      value={nom}
                      readOnly
                      disabled
                      className="cursor-default bg-slate-50 text-slate-700"
                      title="Renseigné à l’inscription — modifiable dans Paramètres après l’onboarding"
                    />
                  </div>
                </div>
                <p className="text-xs text-slate-500">
                  Ces informations proviennent de votre inscription. Vous pourrez les modifier
                  dans les paramètres.
                </p>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-800">
                    Photo de profil
                  </label>
                  <div className="flex flex-wrap items-center gap-4">
                    <div
                      className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-full border-2 border-slate-200 bg-slate-100 text-xs text-slate-400"
                      aria-hidden
                    >
                      {photoPreviewLocal || state.photoUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={photoPreviewLocal ?? state.photoUrl ?? ""}
                          alt="Aperçu de votre photo de profil"
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <span className="px-2 text-center leading-tight">
                          Aperçu
                        </span>
                      )}
                    </div>
                    <div className="flex min-w-0 flex-1 flex-col gap-2">
                      <input
                        ref={photoInputRef}
                        type="file"
                        accept="image/*"
                        className="sr-only"
                        onChange={handlePhotoChange}
                        disabled={photoUploading}
                      />
                      <Button
                        type="button"
                        variant="outline"
                        className="w-fit border-[#426F59] text-[#426F59]"
                        onClick={() => photoInputRef.current?.click()}
                        disabled={photoUploading}
                      >
                        {photoUploading
                          ? "Envoi en cours…"
                          : state.photoUrl || photoPreviewLocal
                            ? "Changer la photo"
                            : "Choisir une photo"}
                      </Button>
                      {photoUploading && (
                        <p className="text-xs text-slate-500">
                          Téléversement vers Calymia…
                        </p>
                      )}
                    </div>
                  </div>
                  <p className="text-xs text-slate-500">
                    Formats recommandés : JPG ou PNG, minimum 400x400px (max. 5 Mo).
                  </p>
                </div>

                <div className="space-y-1">
                  <label className="text-sm font-medium text-slate-800">
                    Bio
                  </label>
                  <textarea
                    className="min-h-[120px] w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#426F59] focus-visible:ring-offset-2"
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
                              ? "border-[#426F59] bg-[#426F59] text-white"
                              : "border-slate-200 bg-white text-slate-700 hover:border-[#426F59]"
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
                              className="accent-[#426F59]"
                              checked={config.enabled}
                              onChange={(e) =>
                                updateDayEnabled(day.key, e.target.checked)
                              }
                            />
                            <span className="font-medium text-slate-800">
                              {day.label}
                            </span>
                          </label>
                          {config.enabled && (
                            <div className="mt-2 space-y-2">
                              {config.slots.map((slot, slotIdx) => (
                                <div
                                  key={slotIdx}
                                  className="flex items-center gap-2"
                                >
                                  <Input
                                    type="time"
                                    value={slot.start}
                                    onChange={(e) =>
                                      updateSlot(day.key, slotIdx, "start", e.target.value)
                                    }
                                    className="h-8"
                                  />
                                  <span className="text-slate-500">à</span>
                                  <Input
                                    type="time"
                                    value={slot.end}
                                    onChange={(e) =>
                                      updateSlot(day.key, slotIdx, "end", e.target.value)
                                    }
                                    className="h-8"
                                  />
                                  <button
                                    type="button"
                                    onClick={() => removeSlot(day.key, slotIdx)}
                                    disabled={config.slots.length <= 1}
                                    className="text-slate-400 hover:text-red-500 disabled:opacity-30 disabled:cursor-not-allowed"
                                    title="Supprimer la plage"
                                  >
                                    ×
                                  </button>
                                </div>
                              ))}
                              <button
                                type="button"
                                onClick={() => addSlot(day.key)}
                                className="text-xs font-medium text-[#426F59] hover:underline"
                              >
                                + Ajouter une plage
                              </button>
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
                      className="border-[#426F59] text-[#426F59]"
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
              <section>
                {!authUserId ? (
                  <div className="flex justify-center py-16">
                    <Loader2 className="h-8 w-8 animate-spin text-[#426F59]" />
                  </div>
                ) : (
                  <OnboardingVitrineStep
                    data={state.vitrine}
                    onChange={vitrineOnChange}
                    supabase={supabase}
                    userId={authUserId}
                    maxPhotos={maxPhotos}
                    onError={(msg) => setError(msg)}
                  />
                )}
              </section>
            )}

            {step === 5 && (
              <section className="space-y-4 text-sm text-slate-800">
                <div>
                  <h2 className="text-sm font-semibold text-[#426F59]">
                    Profil public
                  </h2>
                  {state.photoUrl && (
                    <div className="mb-3 flex items-center gap-3">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={state.photoUrl}
                        alt=""
                        className="h-14 w-14 rounded-full border border-slate-200 object-cover"
                      />
                      <span className="text-xs text-slate-600">Photo de profil</span>
                    </div>
                  )}
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
                  <h2 className="text-sm font-semibold text-[#426F59]">
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
                  <h2 className="text-sm font-semibold text-[#426F59]">
                    Disponibilités
                  </h2>
                  <ul className="mt-1 space-y-1 text-xs text-slate-700">
                    {DAYS.map((day) => {
                      const config = state.availability[day.key];
                      if (!config.enabled) return null;
                      return (
                        <li key={day.key}>
                          {day.label} :{" "}
                          {config.slots.map((s, i) => `${s.start} – ${s.end}`).join(", ")}
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
                  <h2 className="text-sm font-semibold text-[#426F59]">
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

                <div>
                  <h2 className="text-sm font-semibold text-[#426F59]">Vitrine</h2>
                  <p className="mt-1 text-xs text-slate-700">
                    {state.vitrine.photos_cabinet.length > 0
                      ? `${state.vitrine.photos_cabinet.length} photo(s) du cabinet`
                      : "Aucune photo du cabinet"}
                  </p>
                  {state.vitrine.horaires_texte.trim() !== "" && (
                    <p className="mt-1 text-xs text-slate-600">
                      Précisions horaires : {state.vitrine.horaires_texte}
                    </p>
                  )}
                  {state.vitrine.infos_pratiques.trim() !== "" && (
                    <p className="mt-1 whitespace-pre-line text-xs text-slate-700">
                      {state.vitrine.infos_pratiques}
                    </p>
                  )}
                  {state.vitrine.modes_paiement.length > 0 && (
                    <p className="mt-1 text-xs text-slate-600">
                      Paiements : {state.vitrine.modes_paiement.join(", ")}
                    </p>
                  )}
                  {(state.vitrine.formations.length > 0 ||
                    state.vitrine.certifications.length > 0 ||
                    state.vitrine.syndicats.length > 0) && (
                    <ul className="mt-1 list-inside list-disc text-xs text-slate-600">
                      {state.vitrine.formations.length > 0 && (
                        <li>Formations : {state.vitrine.formations.length}</li>
                      )}
                      {state.vitrine.certifications.length > 0 && (
                        <li>Certifications : {state.vitrine.certifications.length}</li>
                      )}
                      {state.vitrine.syndicats.length > 0 && (
                        <li>Syndicats : {state.vitrine.syndicats.length}</li>
                      )}
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

          <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <Button
              type="button"
              variant="outline"
              onClick={goBack}
              disabled={step === 1 || loading}
            >
              Retour
            </Button>
            <div className="flex flex-wrap items-center justify-end gap-2">
              {step === 4 && (
                <Button
                  type="button"
                  variant="ghost"
                  className="text-[#426F59]"
                  onClick={skipVitrineStep}
                  disabled={loading}
                >
                  Passer cette étape →
                </Button>
              )}
              {step < TOTAL_STEPS ? (
                <Button
                  type="button"
                  className="bg-[#426F59] hover:bg-[#355447]"
                  onClick={goNext}
                  disabled={loading || (step === 4 && !authUserId)}
                >
                  Continuer
                </Button>
              ) : (
                <Button
                  type="button"
                  className="bg-[#426F59] hover:bg-[#355447]"
                  onClick={handleFinish}
                  disabled={loading}
                >
                  Terminer et accéder à mon dashboard
                </Button>
              )}
            </div>
          </div>
        </Card>
      </div>
    </main>
  );
}

