import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { buildCronPostSeanceEmail } from "@/lib/email-templates/cron-build";
import { sendEmail } from "@/lib/emails/send";
import { formatParisTime } from "@/lib/timezone";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

function assertCronAuthorized(request: Request): NextResponse | null {
  if (
    request.headers.get("authorization") !==
    `Bearer ${process.env.CRON_SECRET}`
  ) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return null;
}

type PatientEmbed = {
  email: string | null;
  prenom: string | null;
  nom: string | null;
} | null;

type SophrologueEmbed = {
  prenom: string | null;
  nom: string | null;
  email_pro: string | null;
} | null;

type TypeSeanceEmbed = { nom: string | null } | null;

type SeancePostRow = {
  id: string;
  debut_at: string;
  fin_at: string;
  patient_id: string | null;
  sophrologue_id: string;
  type_seance_id: string | null;
  patient: PatientEmbed | PatientEmbed[];
  sophrologue: SophrologueEmbed | SophrologueEmbed[];
  type_seance: TypeSeanceEmbed | TypeSeanceEmbed[];
};

function one<T>(v: T | T[] | null | undefined): T | null {
  if (v == null) return null;
  return Array.isArray(v) ? (v[0] ?? null) : v;
}

async function runPostSeance(): Promise<NextResponse> {
  try {
    const nowIso = new Date().toISOString();

    const { data: rows, error } = await supabase
      .from("seances")
      .select(
        `id, debut_at, fin_at, patient_id, sophrologue_id, type_seance_id,
         patient:patients(email, prenom, nom),
         sophrologue:sophrologues(prenom, nom, email_pro),
         type_seance:types_seances(nom)`,
      )
      .eq("statut", "confirmee")
      .lt("fin_at", nowIso)
      .or("post_seance_envoye.is.null,post_seance_envoye.eq.false")
      .returns<SeancePostRow[]>();

    if (error) {
      console.error("[post-seance] Erreur lecture séances:", error);
      return NextResponse.json(
        { error: error.message, sent_count: 0 },
        { status: 500 },
      );
    }

    const list = rows ?? [];
    let sent_count = 0;

    for (const row of list) {
      const patient = one(row.patient);
      const sophrologue = one(row.sophrologue);
      const typeSeance = one(row.type_seance);

      const email = patient?.email?.trim();
      if (!email) {
        console.warn("[post-seance] Pas d’email patient — séance:", row.id);
        continue;
      }

      const prenomClient = (patient?.prenom ?? "").trim() || "cher client";
      const nomClient = (patient?.nom ?? "").trim();
      const prenom_sophrologue = sophrologue?.prenom ?? "";
      const nom_sophrologue = sophrologue?.nom ?? "";

      const { data: sophrologueAccount, error: sophLookupErr } = await supabase
        .from("sophrologues")
        .select("user_id, plan")
        .eq("id", row.sophrologue_id)
        .maybeSingle();

      if (sophLookupErr) {
        console.warn(
          "[post-seance] Lecture sophrologue:",
          row.sophrologue_id,
          sophLookupErr.message,
        );
      }

      const authUserId = sophrologueAccount?.user_id ?? null;
      const plan = sophrologueAccount?.plan ?? null;

      const date_seance = formatParisTime(row.debut_at, "date");
      const heure_seance = formatParisTime(row.debut_at, "HH:mm");
      const typeNom = typeSeance?.nom ?? "Séance de sophrologie";

      const { subject, html } = await buildCronPostSeanceEmail(supabase, {
        plan,
        authUserId,
        prenomClient,
        nomClient,
        dateParis: date_seance,
        heureParis: heure_seance,
        prenomSophro: prenom_sophrologue,
        nomSophro: nom_sophrologue,
        typeSeance: typeNom,
      });

      const result = await sendEmail({
        to: email,
        subject,
        html,
        log: {
          sophrologue_id: String(row.sophrologue_id),
          patient_id: row.patient_id ? String(row.patient_id) : null,
          seance_id: String(row.id),
          type: "post_seance",
          destinataire_nom:
            [patient?.prenom, patient?.nom].filter(Boolean).join(" ").trim() ||
            null,
        },
      });

      if (!result.success) {
        console.error(
          "[post-seance] Échec envoi séance",
          row.id,
          result.error,
        );
        continue;
      }

      const { error: upErr } = await supabase
        .from("seances")
        .update({ post_seance_envoye: true, statut: "terminee" })
        .eq("id", row.id);

      if (upErr) {
        console.error(
          "[post-seance] Erreur mise à jour séance:",
          row.id,
          upErr,
        );
        continue;
      }

      sent_count += 1;
    }

    console.log(`[post-seance] Terminé — ${sent_count} email(s) envoyé(s)`);
    return NextResponse.json({ sent_count });
  } catch (err) {
    console.error("[post-seance] Erreur inattendue:", err);
    return NextResponse.json(
      { error: "Erreur interne.", sent_count: 0 },
      { status: 500 },
    );
  }
}

export async function GET(request: Request) {
  const unauthorized = assertCronAuthorized(request);
  if (unauthorized) return unauthorized;
  return runPostSeance();
}

export async function POST(request: Request) {
  const unauthorized = assertCronAuthorized(request);
  if (unauthorized) return unauthorized;
  return runPostSeance();
}
