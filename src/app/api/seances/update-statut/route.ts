import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { waitUntil } from "@vercel/functions";
import { sendAvisEmail, sendAvisNotificationSophrologue } from "@/lib/emails/avis";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

const ALLOWED_STATUTS = ["confirmee", "terminee", "annulee", "en_attente"];

type PatientEmbed = {
  email: string | null;
  prenom: string | null;
  nom: string | null;
} | null;

type SophrologueEmbed = {
  prenom: string | null;
  email_pro: string | null;
} | null;

type SeanceAvisRow = {
  sophrologue_id: string;
  patient_id: string | null;
  patient: PatientEmbed | PatientEmbed[];
  sophrologue: SophrologueEmbed | SophrologueEmbed[];
};

function one<T>(v: T | T[] | null | undefined): T | null {
  if (v == null) return null;
  return Array.isArray(v) ? (v[0] ?? null) : v;
}

/**
 * Déclenche le flux avis après qu'une séance passe à "terminee".
 * Best-effort : toute erreur est loguée mais n'impacte pas la réponse du handler.
 */
async function triggerAvisFlow(seanceId: string): Promise<void> {
  try {
    const { data, error } = await supabase
      .from("seances")
      .select(
        `sophrologue_id, patient_id,
         patient:patients(email, prenom, nom),
         sophrologue:sophrologues(prenom, email_pro)`,
      )
      .eq("id", seanceId)
      .maybeSingle<SeanceAvisRow>();

    if (error || !data) {
      console.error("[update-statut][avis] Lecture séance échouée:", seanceId, error?.message);
      return;
    }

    const patient = one(data.patient);
    const sophrologue = one(data.sophrologue);

    const patientEmail = patient?.email?.trim();
    if (!patientEmail) {
      console.warn("[update-statut][avis] Pas d'email patient — séance:", seanceId);
      return;
    }

    const { count: existing, error: countErr } = await supabase
      .from("avis")
      .select("id", { count: "exact", head: true })
      .eq("seance_id", seanceId);

    if (countErr) {
      console.error("[update-statut][avis] Vérification avis échouée:", seanceId, countErr.message);
      return;
    }
    if ((existing ?? 0) > 0) return;

    const { data: inserted, error: insertErr } = await supabase
      .from("avis")
      .insert({
        sophrologue_id: data.sophrologue_id,
        patient_id: data.patient_id,
        seance_id: seanceId,
      })
      .select("id, token")
      .single();

    if (insertErr || !inserted) {
      console.error("[update-statut][avis] Insertion avis échouée:", seanceId, insertErr?.message);
      return;
    }

    const sophrologuePrenom = (sophrologue?.prenom ?? "").trim() || "votre sophrologue";
    const patientPrenom = (patient?.prenom ?? "").trim() || "cher client";

    const result = await sendAvisEmail({
      patientEmail,
      patientPrenom,
      sophrologuePrenom,
      token: inserted.token,
    });

    if (result.success) {
      const { error: updErr } = await supabase
        .from("avis")
        .update({ email_envoye: true })
        .eq("id", inserted.id);
      if (updErr) {
        console.error("[update-statut][avis] Maj email_envoye échouée:", inserted.id, updErr.message);
      }
    } else {
      console.error("[update-statut][avis] Échec envoi email patient:", seanceId, result.error);
    }

    const sophrologueEmail = sophrologue?.email_pro?.trim();
    if (sophrologueEmail) {
      const notif = await sendAvisNotificationSophrologue({
        sophrologueEmail,
        sophrologuePrenom: (sophrologue?.prenom ?? "").trim() || "cher praticien",
        patientPrenom,
      });
      if (!notif.success) {
        console.error("[update-statut][avis] Échec notification sophrologue:", seanceId, notif.error);
      }
    } else {
      console.warn("[update-statut][avis] Pas d'email sophrologue (email_pro) — séance:", seanceId);
    }

    const { error: logErr } = await supabase.from("communications").insert({
      sophrologue_id: data.sophrologue_id,
      patient_id: data.patient_id,
      seance_id: seanceId,
      type: "avis_email",
      statut: "envoye",
      destinataire_email: patientEmail,
      destinataire_nom:
        [patient?.prenom, patient?.nom].filter(Boolean).join(" ").trim() || null,
      sent_at: new Date().toISOString(),
    });

    if (logErr) {
      console.error("[update-statut][avis] Journal communications échoué:", seanceId, logErr.message);
    }
  } catch (err) {
    console.error("[update-statut][avis] Erreur inattendue flux avis:", seanceId, err);
  }
}

export async function POST(request: NextRequest) {
  try {
    const { seance_id, statut } = await request.json();

    if (!seance_id || !statut) {
      return NextResponse.json(
        { error: "seance_id et statut sont requis." },
        { status: 400 },
      );
    }

    if (!ALLOWED_STATUTS.includes(statut)) {
      return NextResponse.json(
        { error: `Statut invalide. Valeurs acceptées : ${ALLOWED_STATUTS.join(", ")}` },
        { status: 400 },
      );
    }

    const { error } = await supabase
      .from("seances")
      .update({ statut })
      .eq("id", seance_id);

    if (error) {
      console.error("[seances/update-statut] Erreur Supabase:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    if (statut === "terminee") {
      waitUntil(triggerAvisFlow(String(seance_id)));
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[seances/update-statut] Erreur inattendue:", err);
    return NextResponse.json({ error: "Erreur interne du serveur." }, { status: 500 });
  }
}
