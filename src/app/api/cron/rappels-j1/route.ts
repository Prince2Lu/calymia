import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { buildCronRappelJ1Email } from "@/lib/email-templates/cron-build";
import { sendEmail } from "@/lib/emails/send";
import {
  addParisCalendarDays,
  formatParisTime,
  startOfParisCalendarDay,
} from "@/lib/timezone";

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
} | null;

type TypeSeanceEmbed = { nom: string | null } | null;

type SeanceRappelRow = {
  id: string;
  debut_at: string;
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

async function runRappelsJ1(): Promise<NextResponse> {
  try {
    const now = new Date();
    const todayParisStart = startOfParisCalendarDay(now);
    const tomorrowParisStart = addParisCalendarDays(todayParisStart, 1);
    const dayAfterTomorrowParisStart = addParisCalendarDays(todayParisStart, 2);

    const fromIso = tomorrowParisStart.toISOString();
    const toIso = dayAfterTomorrowParisStart.toISOString();

    console.log(
      "[rappels-j1] Fenêtre Paris (demain) debut_at:",
      fromIso,
      "→",
      toIso,
    );

    const { data: rows, error } = await supabase
      .from("seances")
      .select(
        `id, debut_at, patient_id, sophrologue_id, type_seance_id,
         patient:patients(email, prenom, nom),
         sophrologue:sophrologues(prenom, nom),
         type_seance:types_seances(nom)`,
      )
      .eq("statut", "confirmee")
      .gte("debut_at", fromIso)
      .lt("debut_at", toIso)
      .or("rappel_email_envoye.is.null,rappel_email_envoye.eq.false")
      .returns<SeanceRappelRow[]>();

    if (error) {
      console.error("[rappels-j1] Erreur lecture séances:", error);
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
        console.warn("[rappels-j1] Pas d’email patient — séance:", row.id);
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
          "[rappels-j1] Lecture sophrologue:",
          row.sophrologue_id,
          sophLookupErr.message,
        );
      }

      const authUserId = sophrologueAccount?.user_id ?? null;
      const plan = sophrologueAccount?.plan ?? null;

      console.log("Sophrologue:", sophrologueAccount);

      let template: { sujet: string; corps_html: string } | null = null;
      if (authUserId) {
        const { data: templateRow } = await supabase
          .from("email_templates")
          .select("sujet, corps_html")
          .eq("sophrologue_id", authUserId)
          .eq("type", "rappel")
          .eq("actif", true)
          .maybeSingle();
        template = templateRow;
      }
      console.log("Template trouvé:", template);

      const date_seance = formatParisTime(row.debut_at, "date");
      const heure_seance = formatParisTime(row.debut_at, "HH:mm");
      const typeNom = typeSeance?.nom ?? "Séance de sophrologie";

      const { subject, html } = await buildCronRappelJ1Email(supabase, {
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
          type: "rappel_j1",
          destinataire_nom:
            [patient?.prenom, patient?.nom].filter(Boolean).join(" ").trim() ||
            null,
        },
      });

      if (!result.success) {
        console.error(
          "[rappels-j1] Échec envoi séance",
          row.id,
          result.error,
        );
        continue;
      }

      const { error: upErr } = await supabase
        .from("seances")
        .update({ rappel_email_envoye: true })
        .eq("id", row.id);

      if (upErr) {
        console.error(
          "[rappels-j1] Erreur mise à jour rappel_email_envoye:",
          row.id,
          upErr,
        );
        continue;
      }

      sent_count += 1;
    }

    console.log(`[rappels-j1] Terminé — ${sent_count} email(s) envoyé(s)`);
    return NextResponse.json({ sent_count });
  } catch (err) {
    console.error("[rappels-j1] Erreur inattendue:", err);
    return NextResponse.json(
      { error: "Erreur interne.", sent_count: 0 },
      { status: 500 },
    );
  }
}

export async function GET(request: Request) {
  const unauthorized = assertCronAuthorized(request);
  if (unauthorized) return unauthorized;
  return runRappelsJ1();
}

export async function POST(request: Request) {
  const unauthorized = assertCronAuthorized(request);
  if (unauthorized) return unauthorized;
  return runRappelsJ1();
}
