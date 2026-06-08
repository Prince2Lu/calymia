import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import {
  buildAvisEmail,
  buildCronPostSeanceEmail,
} from "@/lib/email-templates/cron-build";
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

type CommunicationRow = {
  seance_id: string | null;
  type: string;
};

function one<T>(v: T | T[] | null | undefined): T | null {
  if (v == null) return null;
  return Array.isArray(v) ? (v[0] ?? null) : v;
}

const DAY_MS = 24 * 60 * 60 * 1000;

/** Récupère l'ensemble des seance_id déjà présents dans `communications` pour les types donnés. */
async function fetchCommunicationSets(
  seanceIds: string[],
  types: string[],
): Promise<Map<string, Set<string>>> {
  const sets = new Map<string, Set<string>>();
  for (const t of types) sets.set(t, new Set<string>());
  if (seanceIds.length === 0) return sets;

  const { data, error } = await supabase
    .from("communications")
    .select("seance_id, type")
    .in("type", types)
    .in("seance_id", seanceIds)
    .returns<CommunicationRow[]>();

  if (error) {
    console.error("[post-seance] Erreur lecture communications:", error);
    return sets;
  }

  for (const row of data ?? []) {
    if (!row.seance_id) continue;
    sets.get(row.type)?.add(String(row.seance_id));
  }
  return sets;
}

/**
 * Passe 1 : email "post_seance" pour les séances confirmées terminées (fin_at < now).
 * Exclut celles déjà loguées dans `communications` avec type = 'post_seance'.
 */
async function sendPostSeanceMails(): Promise<number> {
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
    .returns<SeancePostRow[]>();

  if (error) {
    console.error("[post-seance] Erreur lecture séances:", error);
    return 0;
  }

  const all = rows ?? [];
  const sets = await fetchCommunicationSets(
    all.map((r) => String(r.id)),
    ["post_seance"],
  );
  const alreadySent = sets.get("post_seance") ?? new Set<string>();
  const list = all.filter((r) => !alreadySent.has(String(r.id)));

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
    });

    if (!result.success) {
      console.error("[post-seance] Échec envoi séance", row.id, result.error);
      continue;
    }

    const { error: logErr } = await supabase
      .from("communications")
      .insert({
        sophrologue_id: String(row.sophrologue_id),
        patient_id: row.patient_id ? String(row.patient_id) : null,
        seance_id: String(row.id),
        type: "post_seance",
        destinataire_email: email,
        destinataire_nom:
          [patient?.prenom, patient?.nom].filter(Boolean).join(" ").trim() ||
          null,
        objet: subject,
        contenu: html,
        sent_at: new Date().toISOString(),
        statut: "envoye",
      });

    if (logErr) {
      console.error(
        "[post-seance] Erreur log communications:",
        row.id,
        logErr.message,
      );
    }

    const { error: upErr } = await supabase
      .from("seances")
      .update({ email_post_envoye: true, statut: "terminee" })
      .eq("id", row.id);

    if (upErr) {
      console.error("[post-seance] Erreur mise à jour séance:", row.id, upErr);
      continue;
    }

    sent_count += 1;
  }

  console.log(`[post-seance] Terminé — ${sent_count} email(s) post-séance`);
  return sent_count;
}

/**
 * Passe 2 : email "avis" pour les séances terminées depuis plus de 24h
 * qui ont reçu un "post_seance" mais pas encore d'"avis".
 */
async function sendAvisMails(): Promise<number> {
  const now = new Date();
  const cutoffIso = new Date(now.getTime() - DAY_MS).toISOString();

  const { data: rows, error } = await supabase
    .from("seances")
    .select(
      `id, debut_at, fin_at, patient_id, sophrologue_id, type_seance_id,
       patient:patients(email, prenom, nom),
       sophrologue:sophrologues(prenom, nom, email_pro),
       type_seance:types_seances(nom)`,
    )
    .eq("statut", "terminee")
    .lt("fin_at", cutoffIso)
    .returns<SeancePostRow[]>();

  if (error) {
    console.error("[post-seance][avis] Erreur lecture séances:", error);
    return 0;
  }

  const all = rows ?? [];
  const sets = await fetchCommunicationSets(
    all.map((r) => String(r.id)),
    ["post_seance", "avis"],
  );
  const postSet = sets.get("post_seance") ?? new Set<string>();
  const avisSet = sets.get("avis") ?? new Set<string>();

  const eligibles = all.filter(
    (r) => postSet.has(String(r.id)) && !avisSet.has(String(r.id)),
  );

  const appUrl = (process.env.NEXT_PUBLIC_APP_URL ?? "https://calymia.com").replace(
    /\/$/,
    "",
  );
  let sent_count = 0;

  for (const row of eligibles) {
    const patient = one(row.patient);
    const sophrologue = one(row.sophrologue);

    const email = patient?.email?.trim();
    if (!email) {
      console.warn("[post-seance][avis] Pas d’email patient — séance:", row.id);
      continue;
    }

    const prenomClient = (patient?.prenom ?? "").trim() || "cher client";
    const prenomSophro = sophrologue?.prenom ?? "";
    const nomSophro = sophrologue?.nom ?? "";

    const token = crypto.randomUUID();
    const tokenExpireAt = new Date(now.getTime() + 30 * DAY_MS).toISOString();

    const { error: insertErr } = await supabase.from("avis").insert({
      seance_id: row.id,
      sophrologue_id: row.sophrologue_id,
      patient_id: row.patient_id,
      token,
      token_expire_at: tokenExpireAt,
      statut: "en_attente",
    });

    if (insertErr) {
      console.error(
        "[post-seance][avis] Erreur insertion avis:",
        row.id,
        insertErr.message,
      );
      continue;
    }

    const avisUrl = `${appUrl}/avis/${token}`;

    const { subject, html } = buildAvisEmail({
      prenomClient,
      prenomSophro,
      nomSophro,
      avisUrl,
    });

    const result = await sendEmail({
      to: email,
      subject,
      html,
    });

    if (!result.success) {
      console.error("[post-seance][avis] Échec envoi avis", row.id, result.error);
      continue;
    }

    const { error: logErr } = await supabase
      .from("communications")
      .insert({
        sophrologue_id: String(row.sophrologue_id),
        patient_id: row.patient_id ? String(row.patient_id) : null,
        seance_id: String(row.id),
        type: "avis",
        destinataire_email: email,
        destinataire_nom:
          [patient?.prenom, patient?.nom].filter(Boolean).join(" ").trim() ||
          null,
        objet: subject,
        contenu: html,
        sent_at: new Date().toISOString(),
        statut: "envoye",
      });

    if (logErr) {
      console.error("[post-seance][avis] Erreur log communications:", row.id, logErr.message);
    }

    sent_count += 1;
  }

  console.log(`[post-seance] Terminé — ${sent_count} email(s) avis`);
  return sent_count;
}

async function runPostSeance(): Promise<NextResponse> {
  try {
    const postSeanceCount = await sendPostSeanceMails();
    const avisCount = await sendAvisMails();
    return NextResponse.json({
      sent_post_seance: postSeanceCount,
      sent_avis: avisCount,
    });
  } catch (err) {
    console.error("[post-seance] Erreur inattendue:", err);
    return NextResponse.json(
      { error: "Erreur interne.", sent_post_seance: 0, sent_avis: 0 },
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
