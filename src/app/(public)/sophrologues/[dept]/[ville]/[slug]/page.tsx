import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { cache } from "react";
import { createClient } from "@supabase/supabase-js";
import { CreditCard, Info, MapPin } from "lucide-react";
import { SophrologueBioExpandable } from "@/components/public/SophrologueBioExpandable";
import { SophrologueRppsLine } from "@/components/public/SophrologueRppsLine";
import { ProchainCreneauBadge } from "@/components/public/ProchainCreneauBadge";
import { CabinetPhotoGallery } from "@/components/public/PhotoLightbox";
import { AvisPublicList } from "@/components/avis/AvisPublicList";
import { AvisStars } from "@/components/avis/AvisStars";
import { getParisJsDayOfWeek } from "@/lib/timezone";
import {
  hasHorairesContenu,
  JOURS_LABELS,
  JOURS_SEMAINE,
  normalizeHoraires,
  type HorairesSophrologue,
  type JourSemaine,
} from "@/lib/horaires";
import { getSophrologueUrl } from "@/lib/config/site-url";

export const revalidate = 3600;

const getSupabase = () =>
  createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );

type TypeSeanceRow = {
  id: string | number;
  nom: string | null;
  duree_minutes: number | null;
  tarif: number | null;
  actif: boolean | null;
};

type SophrologuePublicRow = {
  id: string;
  user_id: string;
  slug: string;
  nom: string | null;
  prenom: string | null;
  bio: string | null;
  photo_url: string | null;
  adresse: string | null;
  ville: string | null;
  departement: string | null;
  code_postal: string | null;
  actif: boolean;
  photos_cabinet: string[] | null;
  horaires: unknown;
  horaires_texte: string | null;
  infos_pratiques: string | null;
  modes_paiement: string[] | null;
  formations: string[] | null;
  certifications: string[] | null;
  syndicats: string[] | null;
  specialites: string[] | null;
  numero_rpps: string | null;
  types_seances: TypeSeanceRow[] | null;
};

const PUBLIC_SELECT = `
  id,
  user_id,
  slug,
  nom,
  prenom,
  bio,
  photo_url,
  adresse,
  ville,
  departement,
  code_postal,
  actif,
  photos_cabinet,
  horaires,
  horaires_texte,
  infos_pratiques,
  modes_paiement,
  formations,
  certifications,
  syndicats,
  specialites,
  numero_rpps,
  types_seances ( id, nom, duree_minutes, tarif, actif )
`;

const fetchSophrologuePublic = cache(async (slug: string) => {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("sophrologues")
    .select(PUBLIC_SELECT)
    .eq("slug", slug)
    .eq("actif", true)
    .maybeSingle<SophrologuePublicRow>();

  if (error || !data) return null;
  return data;
});

const MODES_LABELS: Record<string, string> = {
  cb: "Carte bancaire",
  cheque: "Chèque",
  especes: "Espèces",
};

/** getParisJsDayOfWeek : 0 = dimanche … 6 = samedi */
const JS_TO_JOUR: JourSemaine[] = [
  "dimanche",
  "lundi",
  "mardi",
  "mercredi",
  "jeudi",
  "vendredi",
  "samedi",
];

const SCHEMA_DAY: Record<JourSemaine, string> = {
  lundi: "Monday",
  mardi: "Tuesday",
  mercredi: "Wednesday",
  jeudi: "Thursday",
  vendredi: "Friday",
  samedi: "Saturday",
  dimanche: "Sunday",
};

function buildOpeningHoursSpecification(horaires: HorairesSophrologue) {
  return JOURS_SEMAINE.flatMap((jour) =>
    (horaires[jour] ?? [])
      .filter((p) => p.debut && p.fin)
      .map((p) => ({
        "@type": "OpeningHoursSpecification" as const,
        dayOfWeek: `https://schema.org/${SCHEMA_DAY[jour]}`,
        opens: p.debut,
        closes: p.fin,
      })),
  );
}

const formatPrix = (prix: number) =>
  new Intl.NumberFormat("fr-FR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(prix) + " €";

function slugifyVille(ville: string) {
  return ville
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function normalizeSpecialites(value: string[] | null | undefined): string[] {
  if (!value?.length) return [];
  return value.filter(Boolean);
}

function specialtyLabel(raw: string) {
  const map: Record<string, string> = {
    stress: "Stress",
    sommeil: "Sommeil",
    confiance: "Confiance en soi",
    douleur: "Douleur",
    sport: "Sport",
    grossesse: "Grossesse",
    enfants: "Enfants",
    preparation: "Préparation mentale",
    arret_tabac: "Arrêt tabac",
    autres: "Autres",
  };
  return map[raw] ?? raw;
}

function initials(prenom?: string | null, nom?: string | null) {
  const p = (prenom ?? "").trim();
  const n = (nom ?? "").trim();
  const a = p ? p[0] : "";
  const b = n ? n[0] : "";
  return `${a}${b}`.toUpperCase() || "S";
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ dept: string; ville: string; slug: string }>;
}): Promise<Metadata> {
  const { dept, ville, slug } = await params;
  const data = await fetchSophrologuePublic(slug);

  if (!data) {
    return {
      title: "Sophrologue — Calymia",
      description: "Trouvez un sophrologue sur Calymia.",
    };
  }

  const prenom = data.prenom ?? "";
  const nom = data.nom ?? "";
  const city = data.ville ?? "";
  const bio = data.bio?.trim() ?? "";
  const desc =
    bio.length > 0
      ? bio.slice(0, 155) + (bio.length > 155 ? "…" : "")
      : `Prenez rendez-vous avec ${prenom} ${nom}, sophrologue à ${city}. Séances en cabinet et à distance.`;

  const canonical = getSophrologueUrl(dept, ville, slug);

  return {
    title: `${prenom} ${nom} – Sophrologue à ${city} | Calymia`.trim(),
    description: desc,
    openGraph: {
      title: `${prenom} ${nom} – Sophrologue à ${city}`.trim(),
      description: desc,
      images: data.photo_url
        ? [{ url: data.photo_url, width: 800, height: 600 }]
        : [],
      type: "profile",
      locale: "fr_FR",
    },
    alternates: {
      canonical,
    },
  };
}

export default async function SophrologueProfilPage({
  params,
}: {
  params: Promise<{ dept: string; ville: string; slug: string }>;
}) {
  const { dept, ville, slug } = await params;
  const sophrologue = await fetchSophrologuePublic(slug);

  if (!sophrologue) notFound();

  const supabase = getSupabase();

  const { data: avisNotes } = await supabase
    .from("avis")
    .select("note")
    .eq("sophrologue_id", sophrologue.id)
    .eq("statut", "approuve")
    .returns<{ note: number | null }[]>();

  const notesApprouvees = (avisNotes ?? [])
    .map((a) => a.note)
    .filter((n): n is number => typeof n === "number");
  const avisCount = notesApprouvees.length;
  const avisMoyenne =
    avisCount > 0
      ? Math.round(
          (notesApprouvees.reduce((sum, n) => sum + n, 0) / avisCount) * 10,
        ) / 10
      : 0;

  const horaires = normalizeHoraires(sophrologue.horaires);
  const prenom = sophrologue.prenom ?? "";
  const nom = sophrologue.nom ?? "";
  const fullName = `${prenom} ${nom}`.trim() || "Sophrologue";
  const city = sophrologue.ville ?? "";
  const deptSlug = sophrologue.departement ?? dept;
  const villeSlug = city ? slugifyVille(city) : ville;
  const reserverHref = `/sophrologues/${deptSlug}/${villeSlug}/${sophrologue.slug}/reserver`;

  const typesActifs =
    sophrologue.types_seances?.filter((t) => t.actif !== false) ?? [];
  const tarifsNum = typesActifs
    .map((t) => Number(t.tarif))
    .filter((n) => Number.isFinite(n) && n >= 0);
  const prixMin = tarifsNum.length > 0 ? Math.min(...tarifsNum) : null;

  const specialites = normalizeSpecialites(sophrologue.specialites).map(
    specialtyLabel,
  );
  const photos = (sophrologue.photos_cabinet ?? []).filter(Boolean);
  const modes = (sophrologue.modes_paiement ?? []).filter(Boolean);

  const hasAdresse = Boolean(sophrologue.adresse?.trim());
  const hasInfosPratiques = Boolean(sophrologue.infos_pratiques?.trim());
  const numeroRpps = sophrologue.numero_rpps?.trim() ?? "";
  const hasRpps = numeroRpps.length > 0;
  const showInfos = hasAdresse || hasInfosPratiques || modes.length > 0;

  const showHorairesBloc =
    hasHorairesContenu(horaires) ||
    Boolean(sophrologue.horaires_texte?.trim());

  const formations = sophrologue.formations ?? [];
  const certifications = sophrologue.certifications ?? [];
  const syndicats = sophrologue.syndicats ?? [];
  const showTags =
    formations.length > 0 ||
    certifications.length > 0 ||
    syndicats.length > 0;

  const showGallery = photos.length > 0;
  const showSeances = typesActifs.length > 0;

  const todayJour = JS_TO_JOUR[getParisJsDayOfWeek(new Date())];

  const openingSpecs = buildOpeningHoursSpecification(horaires);

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Person",
    name: fullName,
    jobTitle: "Sophrologue",
    ...(sophrologue.bio?.trim()
      ? { description: sophrologue.bio.trim() }
      : {}),
    ...(sophrologue.photo_url ? { image: sophrologue.photo_url } : {}),
    ...(sophrologue.adresse
      ? {
          address: {
            "@type": "PostalAddress",
            streetAddress: sophrologue.adresse,
            addressLocality: city,
            ...(sophrologue.code_postal
              ? { postalCode: sophrologue.code_postal }
              : {}),
            addressCountry: "FR",
          },
        }
      : {}),
    url: getSophrologueUrl(dept, ville, slug),
    ...(prixMin != null
      ? { priceRange: `À partir de ${formatPrix(prixMin)}` }
      : {}),
    ...(openingSpecs.length > 0
      ? { openingHoursSpecification: openingSpecs }
      : {}),
  };

  const sectionMeta = [
    { id: "rpps", show: hasRpps },
    { id: "gallery", show: showGallery },
    { id: "seances", show: showSeances },
    { id: "infos", show: showInfos },
    { id: "horaires", show: showHorairesBloc },
    { id: "tags", show: showTags },
    { id: "avis", show: avisCount > 0 },
  ];
  const visibleIdx = sectionMeta
    .map((s, i) => (s.show ? i : -1))
    .filter((i) => i >= 0);
  const sepBefore = (idx: number) => visibleIdx.indexOf(idx) > 0;

  return (
    <main className="min-h-screen bg-white">
      <script
        type="application/ld+json"
        // eslint-disable-next-line react/no-danger
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6 sm:py-10">
        {/* Deux enfants DIRECTS : colonne + sidebar (classe CSS globals pour colonnes lg garanties) */}
        <div className="sophro-public-profile-grid">
          {/* ── Colonne gauche ───────────────────────────────────────── */}
          <div className="min-w-0 max-w-full space-y-8">
            <header className="mb-5 flex flex-col gap-4 sm:flex-row sm:items-start sm:gap-4">
              {sophrologue.photo_url ? (
                <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-full ring-1 ring-slate-200">
                  <Image
                    src={sophrologue.photo_url}
                    alt=""
                    fill
                    className="object-cover"
                    sizes="64px"
                  />
                </div>
              ) : (
                <div
                  className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full text-xl font-semibold text-[#426F59] font-[family-name:var(--font-playfair)]"
                  style={{ backgroundColor: "#EAF3DE" }}
                >
                  {initials(prenom, nom)}
                </div>
              )}
              <div className="min-w-0 flex-1 space-y-2">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-[#426F59]">
                  {city || "France"}
                </p>
                <h1 className="text-[32px] font-semibold leading-tight text-slate-900 font-[family-name:var(--font-playfair)]">
                  {fullName}
                </h1>
                {sophrologue.bio?.trim() ? (
                  <SophrologueBioExpandable bio={sophrologue.bio} />
                ) : (
                  <p className="text-sm italic text-slate-400">
                    Présentation à venir.
                  </p>
                )}
              </div>
            </header>

            {specialites.length > 0 && (
              <div className="mb-8 flex flex-wrap gap-2">
                {specialites.map((s, i) => (
                  <span
                    key={`${s}-${i}`}
                    className="rounded-full bg-[#EAF3DE] px-3 py-1 text-xs font-medium text-[#3B6D11]"
                  >
                    {s}
                  </span>
                ))}
              </div>
            )}

            {sepBefore(0) && <hr className="my-10 border-slate-200" />}
            {hasRpps && (
              <div className={showGallery ? "mb-6" : ""}>
                <SophrologueRppsLine numero={numeroRpps} />
              </div>
            )}

            {sepBefore(1) && <hr className="my-10 border-slate-200" />}
            {showGallery && (
              <section className="space-y-3">
                <h2 className="text-lg font-semibold text-slate-900 font-[family-name:var(--font-playfair)]">
                  Le cabinet
                </h2>
                <CabinetPhotoGallery urls={photos} />
              </section>
            )}

            {sepBefore(2) && <hr className="my-10 border-slate-200" />}
            {showSeances && (
              <section className="space-y-3">
                <h2 className="text-lg font-semibold text-slate-900 font-[family-name:var(--font-playfair)]">
                  Séances &amp; tarifs
                </h2>
                <ul className="divide-y divide-slate-200 border-y border-slate-200">
                  {typesActifs.map((t) => {
                    const duree = Number(t.duree_minutes) || 0;
                    const tarif = Number(t.tarif);
                    return (
                      <li
                        key={String(t.id)}
                        className="flex items-center justify-between gap-4 py-3 text-sm"
                      >
                        <span className="text-slate-800">
                          {t.nom ?? "Séance"} · {duree} min
                        </span>
                        <span className="shrink-0 font-medium text-[#426F59]">
                          {Number.isFinite(tarif) ? formatPrix(tarif) : "—"}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              </section>
            )}

            {sepBefore(3) && <hr className="my-10 border-slate-200" />}
            {showInfos && (
              <section className="space-y-4">
                <h2 className="text-lg font-semibold text-slate-900 font-[family-name:var(--font-playfair)]">
                  Informations pratiques
                </h2>
                {hasAdresse && (
                  <div className="flex gap-3 text-sm text-slate-700">
                    <MapPin
                      className="mt-0.5 h-5 w-5 shrink-0 text-[#426F59]"
                      aria-hidden
                    />
                    <p>
                      {sophrologue.adresse}
                      <br />
                      {sophrologue.code_postal
                        ? `${sophrologue.code_postal} `
                        : ""}
                      {city}
                    </p>
                  </div>
                )}
                {hasInfosPratiques && (
                  <div className="flex gap-3 text-sm text-slate-700">
                    <Info
                      className="mt-0.5 h-5 w-5 shrink-0 text-[#426F59]"
                      aria-hidden
                    />
                    <p className="whitespace-pre-line">
                      {sophrologue.infos_pratiques}
                    </p>
                  </div>
                )}
                {modes.length > 0 && (
                  <div className="flex gap-3 text-sm text-slate-700">
                    <CreditCard
                      className="mt-0.5 h-5 w-5 shrink-0 text-[#426F59]"
                      aria-hidden
                    />
                    <div className="flex flex-wrap gap-2">
                      {modes.map((m) => (
                        <span
                          key={m}
                          className="rounded-full bg-slate-100 px-2.5 py-1 text-xs text-slate-700"
                        >
                          {MODES_LABELS[m] ?? m}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </section>
            )}

            {sepBefore(4) && <hr className="my-10 border-slate-200" />}
            {showHorairesBloc && (
              <section className="space-y-3">
                <h2 className="text-lg font-semibold text-slate-900 font-[family-name:var(--font-playfair)]">
                  Horaires
                </h2>
                <ul className="space-y-1 text-sm">
                  {JOURS_SEMAINE.map((j) => {
                    const plages = horaires[j] ?? [];
                    const isToday = j === todayJour;
                    return (
                      <li
                        key={j}
                        className={`flex flex-col gap-0.5 rounded-lg px-2 py-2 sm:flex-row sm:justify-between sm:gap-4 ${
                          isToday ? "bg-[#EAF3DE]/60" : ""
                        }`}
                      >
                        <span className="font-medium text-slate-800">
                          {JOURS_LABELS[j]}
                        </span>
                        {plages.length === 0 ? (
                          <span className="text-slate-400 italic">Fermé</span>
                        ) : (
                          <span className="text-slate-700">
                            {plages.map((p, i) => (
                              <span key={i}>
                                {i > 0 && " · "}
                                {p.debut} – {p.fin}
                              </span>
                            ))}
                          </span>
                        )}
                      </li>
                    );
                  })}
                </ul>
                {sophrologue.horaires_texte?.trim() && (
                  <p className="text-sm italic text-slate-500">
                    {sophrologue.horaires_texte}
                  </p>
                )}
              </section>
            )}

            {sepBefore(5) && <hr className="my-10 border-slate-200" />}
            {showTags && (
              <section className="space-y-6">
                {formations.length > 0 && (
                  <div className="space-y-2">
                    <h3 className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                      Formations
                    </h3>
                    <div className="flex flex-wrap gap-2">
                      {formations.map((f, i) => (
                        <span
                          key={`${f}-${i}`}
                          className="rounded-full bg-[#426F59] px-3 py-1 text-xs font-medium text-white"
                        >
                          {f}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
                {certifications.length > 0 && (
                  <div className="space-y-2">
                    <h3 className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                      Certifications
                    </h3>
                    <div className="flex flex-wrap gap-2">
                      {certifications.map((c, i) => (
                        <span
                          key={`${c}-${i}`}
                          className="rounded-full bg-[#426F59] px-3 py-1 text-xs font-medium text-white"
                        >
                          {c}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
                {syndicats.length > 0 && (
                  <div className="space-y-2">
                    <h3 className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                      Syndicats
                    </h3>
                    <div className="flex flex-wrap gap-2">
                      {syndicats.map((s, i) => (
                        <span
                          key={`${s}-${i}`}
                          className="rounded-full bg-[#426F59] px-3 py-1 text-xs font-medium text-white"
                        >
                          {s}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </section>
            )}

            {sepBefore(6) && <hr className="my-10 border-slate-200" />}
            {avisCount > 0 && (
              <AvisPublicList
                sophrologueId={sophrologue.id}
                noteMoyenne={avisMoyenne}
                avisCount={avisCount}
              />
            )}
          </div>

          {/* ── Sidebar : enfant direct du grid (pas dans la colonne gauche) ─ */}
          <div className="w-full space-y-4 lg:sticky lg:top-8">
            <div className="space-y-4 rounded-2xl border border-gray-200 p-5">
              <div className="relative aspect-[3/4] w-full overflow-hidden rounded-xl bg-gray-100">
                {sophrologue.photo_url ? (
                  <Image
                    src={sophrologue.photo_url}
                    alt={`Portrait de ${fullName}`}
                    fill
                    className="object-cover"
                    sizes="280px"
                    priority
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-4xl font-semibold text-[#426F59] font-[family-name:var(--font-playfair)]">
                    {initials(prenom, nom)}
                  </div>
                )}
              </div>

              {prixMin != null && (
                <div className="text-center">
                  <p className="text-[11px] text-slate-500">À partir de</p>
                  <p className="text-[28px] font-semibold text-[#426F59] font-[family-name:var(--font-playfair)]">
                    {formatPrix(prixMin)}
                  </p>
                </div>
              )}

              <ProchainCreneauBadge sophrologueId={String(sophrologue.id)} />

              <Link
                href={reserverHref}
                className="flex w-full items-center justify-center rounded-full bg-[#426F59] py-3 text-center text-sm font-medium text-white transition hover:bg-[#355849]"
              >
                Prendre rendez-vous
              </Link>

              {avisCount > 0 && (
                <div className="flex flex-col items-center gap-1 border-t border-gray-100 pt-4 text-center">
                  <AvisStars
                    mode="display"
                    value={avisMoyenne}
                    count={avisCount}
                  />
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
