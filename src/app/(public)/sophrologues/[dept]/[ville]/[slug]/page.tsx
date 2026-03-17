import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { cache } from "react";
import { createClient } from "@supabase/supabase-js";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

type SophrologueRow = {
  id: string | number;
  slug: string;
  actif: boolean;
  prenom: string | null;
  nom: string | null;
  ville: string | null;
  departement: string | null;
  bio: string | null;
  photo_url: string | null;
  specialites: string[] | string | null;
  numero_rpps: string | null;
  lien_teleconsultation: string | null;
  adresse: string | null;
  code_postal: string | null;
  telephone: string | null;
};

const getSupabase = () =>
  createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );

const fetchSophrologueBySlug = cache(async (slug: string) => {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("sophrologues")
    .select("*")
    .eq("slug", slug)
    .eq("actif", true)
    .maybeSingle<SophrologueRow>();

  if (error) {
    // Pour l'instant, on masque l'erreur côté public
    return { data: null as SophrologueRow | null };
  }

  return { data };
});

function normalizeSpecialites(value: SophrologueRow["specialites"]): string[] {
  if (!value) return [];
  if (Array.isArray(value)) return value.filter(Boolean);
  return value
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

function initials(prenom?: string | null, nom?: string | null) {
  const p = (prenom ?? "").trim();
  const n = (nom ?? "").trim();
  const a = p ? p[0] : "";
  const b = n ? n[0] : "";
  const result = `${a}${b}`.toUpperCase();
  return result || "C";
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

function specialtyColorClass(index: number) {
  const classes = [
    "bg-[#2E75B6]/10 text-[#1E3A5F] ring-[#2E75B6]/30",
    "bg-[#27AE60]/10 text-[#1E3A5F] ring-[#27AE60]/30",
    "bg-[#1E3A5F]/10 text-[#1E3A5F] ring-[#1E3A5F]/30",
  ];
  return classes[index % classes.length];
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ dept: string; ville: string; slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const { data } = await fetchSophrologueBySlug(slug);

  if (!data) {
    return {
      title: "Sophrologue — Calymia",
      description: "Trouvez un sophrologue sur Calymia.",
    };
  }

  const prenom = data.prenom ?? "";
  const nom = data.nom ?? "";
  const ville = data.ville ?? "";
  const specialites = normalizeSpecialites(data.specialites)
    .map(specialtyLabel)
    .join(", ");

  return {
    title: `${prenom} ${nom} — Sophrologue à ${ville}`.trim(),
    description: `Prenez RDV avec ${prenom} ${nom}, sophrologue à ${ville}. Spécialités : ${specialites}.`.trim(),
  };
}

export default async function SophrologueProfilPage({
  params,
}: {
  params: Promise<{ dept: string; ville: string; slug: string }>;
}) {
  const { slug } = await params;
  const { data } = await fetchSophrologueBySlug(slug);

  if (!data) notFound();

  const prenom = data.prenom ?? "";
  const nom = data.nom ?? "";
  const fullName = `${prenom} ${nom}`.trim();
  const city = data.ville ?? "";
  const specialites = normalizeSpecialites(data.specialites);

  const description = `Prenez RDV avec ${fullName}, sophrologue à ${city}. Spécialités : ${specialites
    .map(specialtyLabel)
    .join(", ")}.`;

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "MedicalBusiness",
    name: fullName,
    description,
    url: `https://calymia.fr/sophrologues/${data.departement ?? ""}/${(
      data.ville ?? ""
    ).toLowerCase()}/${data.slug}`,
    image: data.photo_url || undefined,
    telephone: data.telephone || undefined,
    address: {
      "@type": "PostalAddress",
      streetAddress: data.adresse || undefined,
      addressLocality: data.ville || undefined,
      postalCode: data.code_postal || undefined,
      addressCountry: "FR",
    },
    sameAs: data.lien_teleconsultation ? [data.lien_teleconsultation] : undefined,
  };

  return (
    <main className="min-h-screen bg-white">
      <script
        type="application/ld+json"
        // eslint-disable-next-line react/no-danger
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <div className="bg-gradient-to-b from-slate-50 to-white">
        <div className="mx-auto max-w-5xl px-4 py-10">
          <div className="grid gap-8 md:grid-cols-[240px,1fr] md:items-center">
            <div className="flex items-center justify-center">
              {data.photo_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={data.photo_url}
                  alt={`Photo de ${fullName}`}
                  className="h-44 w-44 rounded-2xl object-cover ring-1 ring-slate-200"
                />
              ) : (
                <div className="flex h-44 w-44 items-center justify-center rounded-2xl bg-[#1E3A5F] text-5xl font-semibold text-white ring-1 ring-slate-200">
                  {initials(prenom, nom)}
                </div>
              )}
            </div>

            <div className="space-y-4">
              <div className="space-y-2">
                <Badge>Calymia</Badge>
                <h1 className="text-3xl font-semibold tracking-tight text-[#1E3A5F] sm:text-4xl">
                  {fullName || "Sophrologue"}
                </h1>
                <p className="text-sm text-slate-600">
                  Sophrologue à{" "}
                  <span className="font-medium text-slate-800">{city}</span>
                </p>
              </div>

              <div className="flex flex-wrap gap-2">
                {specialites.length > 0 ? (
                  specialites.map((s, i) => (
                    <span
                      key={`${s}-${i}`}
                      className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-medium ring-1 ${specialtyColorClass(
                        i,
                      )}`}
                    >
                      {specialtyLabel(s)}
                    </span>
                  ))
                ) : (
                  <span className="text-xs text-slate-500">
                    Spécialités non renseignées
                  </span>
                )}
              </div>

              <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                <a
                  href="#planning"
                  className="inline-flex items-center justify-center rounded-md font-medium bg-[#27AE60] text-white hover:bg-green-700 h-10 px-6 py-2 text-sm"
                >
                  Prendre rendez-vous
                </a>
                {data.lien_teleconsultation ? (
                  <a
                    href={data.lien_teleconsultation}
                    className="text-sm font-medium text-[#2E75B6]"
                    target="_blank"
                    rel="noreferrer"
                  >
                    Téléconsultation disponible
                  </a>
                ) : null}
              </div>
            </div>
          </div>

          {data.lien_teleconsultation ? (
            <div className="mt-8 rounded-2xl border border-[#2E75B6]/20 bg-[#2E75B6]/5 px-5 py-4">
              <p className="text-sm text-slate-800">
                <span className="font-semibold text-[#1E3A5F]">
                  Téléconsultation
                </span>{" "}
                : prenez rendez-vous en visioconférence via{" "}
                <a
                  className="font-medium text-[#2E75B6] underline underline-offset-2"
                  href={data.lien_teleconsultation}
                  target="_blank"
                  rel="noreferrer"
                >
                  ce lien
                </a>
                .
              </p>
            </div>
          ) : null}
        </div>
      </div>

      <div className="mx-auto max-w-5xl space-y-6 px-4 pb-14">
        <Card>
          <CardTitle>À propos</CardTitle>
          <CardDescription className="mt-2 whitespace-pre-line">
            {data.bio?.trim()
              ? data.bio
              : "La bio n’est pas encore renseignée."}
          </CardDescription>
          {data.numero_rpps ? (
            <div className="mt-4">
              <span className="inline-flex items-center gap-2 rounded-full bg-[#27AE60]/10 px-3 py-1 text-xs font-medium text-[#1E3A5F] ring-1 ring-[#27AE60]/30">
                RPPS vérifié · {data.numero_rpps}
              </span>
            </div>
          ) : null}
        </Card>

        <Card>
          <CardTitle>Spécialités</CardTitle>
          <CardDescription className="mt-2">
            {specialites.length > 0
              ? "Domaines d’accompagnement."
              : "Spécialités non renseignées."}
          </CardDescription>
          <div className="mt-4 flex flex-wrap gap-2">
            {specialites.map((s, i) => (
              <span
                key={`${s}-list-${i}`}
                className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-medium ring-1 ${specialtyColorClass(
                  i,
                )}`}
              >
                {specialtyLabel(s)}
              </span>
            ))}
          </div>
        </Card>

        <Card>
          <CardTitle>Tarifs</CardTitle>
          <CardDescription className="mt-2">
            Tarifs disponibles sur demande.
          </CardDescription>
        </Card>

        <Card>
          <CardTitle>Localisation</CardTitle>
          <CardDescription className="mt-2">
            {data.adresse ? (
              <>
                {data.adresse}
                <br />
                {data.code_postal ? `${data.code_postal} ` : ""}
                {data.ville ?? ""}
              </>
            ) : (
              "Adresse du cabinet non renseignée."
            )}
          </CardDescription>
        </Card>

        <Card>
          <CardTitle id="planning">Planning</CardTitle>
          <CardDescription className="mt-2">
            Le planning de réservation sera ajouté prochainement.
          </CardDescription>
        </Card>
      </div>
    </main>
  );
}

