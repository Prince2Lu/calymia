import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { buildCronPostSeanceEmail } from "@/lib/email-templates/cron-build";
import { sendEmail } from "@/lib/emails/send";
import { sendAvisEmail, sendAvisNotificationSophrologue } from "@/lib/emails/avis";
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

type SeanceAvisRow = {
  id: string;
  patient_id: string | null;
  sophrologue_id: string;
  patient: PatientEmbed | PatientEmbed[];
  sophrologue: SophrologueEmbed | SophrologueEmbed[];
};

/** Renvoie [début, fin] UTC de la journée d'hier (00:00 → 23:59:59.999) en ISO. */
function yesterdayUtcRange(): { start: string; end: string } {
  const now = new Date();
  const start = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - 1, 0, 0, 0, 0),
  );
  const end = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - 1, 23, 59, 59, 999),
  );
  return { start: start.toISOString(), end: end.toISOString() };
}

/** Génère et envoie les demandes d'avis pour les séances terminées hier. */
async function processAvisEmails(): Promise<number> {
  const { start, end } = yesterdayUtcRange();

  const { data: rows, error } = await supabase
    .from("seances")
    .select(
      `id, patient_id, sophrologue_id,
       patient:patients(email, prenom, nom),
       sophrologue:sophrologues(prenom, nom, email_pro)`,
    )
    .eq("statut", "terminee")
    .gte("fin_at", start)
    .lte("fin_at", end)
    .returns<SeanceAvisRow[]>();

  if (error) {
    console.error("[post-seance][avis] Erreur lecture séances:", error);
    return 0;
  }

  let avis_sent = 0;

  for (const row of rows ?? []) {
    const { count: existing, error: countErr } = await supabase
      .from("avis")
      .select("id", { count: "exact", head: true })
      .eq("seance_id", row.id);

    if (countErr) {
      console.error("[post-seance][avis] Erreur vérification avis:", row.id, countErr.message);
      continue;
    }
    if ((existing ?? 0) > 0) continue;

    const patient = one(row.patient);
    const sophrologue = one(row.sophrologue);

    const patientEmail = patient?.email?.trim();
    if (!patientEmail) {
      console.warn("[post-seance][avis] Pas d'email patient — séance:", row.id);
      continue;
    }

    const { data: inserted, error: insertErr } = await supabase
      .from("avis")
      .insert({
        sophrologue_id: row.sophrologue_id,
        patient_id: row.patient_id,
        seance_id: row.id,
      })
      .select("id, token")
      .single();

    if (insertErr || !inserted) {
      console.error("[post-seance][avis] Erreur insertion avis:", row.id, insertErr?.message);
      continue;
    }

    const result = await sendAvisEmail({
      patientEmail,
      patientPrenom: (patient?.prenom ?? "").trim() || "cher client",
      sophrologuePrenom: (sophrologue?.prenom ?? "").trim() || "votre sophrologue",
      token: inserted.token,
    });

    if (!result.success) {
      console.error("[post-seance][avis] Échec envoi email:", row.id, result.error);
      continue;
    }

    const { error: updErr } = await supabase
      .from("avis")
      .update({ email_envoye: true })
      .eq("id", inserted.id);

    if (updErr) {
      console.error("[post-seance][avis] Erreur maj email_envoye:", inserted.id, updErr.message);
    }

    const sophrologueEmail = sophrologue?.email_pro?.trim();
    if (sophrologueEmail) {
      const notif = await sendAvisNotificationSophrologue({
        sophrologueEmail,
        sophrologuePrenom: (sophrologue?.prenom ?? "").trim() || "cher praticien",
        patientPrenom: (patient?.prenom ?? "").trim() || "Un client",
      });
      if (!notif.success) {
        console.error(
          "[post-seance][avis] Échec notification sophrologue:",
          row.id,
          notif.error,
        );
      }
    } else {
      console.warn(
        "[post-seance][avis] Pas d'email sophrologue (email_pro) — séance:",
        row.id,
      );
    }

    const { error: logErr } = await supabase.from("communications").insert({
      sophrologue_id: row.sophrologue_id,
      patient_id: row.patient_id,
      seance_id: row.id,
      type: "avis_email",
      statut: "envoye",
      destinataire_email: patientEmail,
      destinataire_nom:
        [patient?.prenom, patient?.nom].filter(Boolean).join(" ").trim() || null,
      sent_at: new Date().toISOString(),
    });

    if (logErr) {
      console.error("[post-seance][avis] Erreur journal communications:", row.id, logErr.message);
    }

    avis_sent += 1;
  }

  return avis_sent;
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
      .or("email_post_envoye.is.null,email_post_envoye.eq.false")
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
        .update({ email_post_envoye: true, statut: "terminee" })
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

    const avis_sent = await processAvisEmails();

    console.log(
      `[post-seance] Terminé — ${sent_count} email(s) post-séance, ${avis_sent} demande(s) d'avis`,
    );
    return NextResponse.json({ sent_count, avis_sent });
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
