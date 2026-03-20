import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { formatParisTime } from "@/lib/timezone";

// ─── Supabase (service role — bypasse RLS) ────────────────────────────────────

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

// ─── Types ────────────────────────────────────────────────────────────────────

type SeanceRappel = {
  id: string;
  debut_at: string;
  fin_at: string;
  rappel_email_envoye: boolean;
  patient: {
    prenom: string | null;
    nom: string | null;
    email: string | null;
  } | null;
  sophrologue: {
    prenom: string | null;
    nom: string | null;
    adresse: string | null;
    ville: string | null;
    telephone: string | null;
  } | null;
  type_seance: { nom: string | null } | null;
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDateFR(iso: string) {
  return formatParisTime(iso, "date");
}

function formatTimeFR(iso: string) {
  return formatParisTime(iso, "HH:mm");
}

function buildEmailHtml(seance: SeanceRappel): string {
  const patient = seance.patient;
  const sophrologue = seance.sophrologue;
  const prenomPatient = patient?.prenom ?? "Patient";
  const nomSophrologue =
    `${sophrologue?.prenom ?? ""} ${sophrologue?.nom ?? ""}`.trim() || "votre sophrologue";
  const adresse = [sophrologue?.adresse, sophrologue?.ville]
    .filter(Boolean)
    .join(", ") || "Adresse non renseignée";
  const date = formatDateFR(seance.debut_at);
  const heure = formatTimeFR(seance.debut_at);
  const typeSeance =
    (Array.isArray(seance.type_seance)
      ? seance.type_seance[0]?.nom
      : seance.type_seance?.nom) ?? "Séance de sophrologie";

  return `<!DOCTYPE html>
<html lang="fr">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;background-color:#f8fafc;font-family:Arial,Helvetica,sans-serif;color:#1f2933">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f8fafc;padding:32px 16px">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 1px 4px rgba(0,0,0,0.08)">

          <!-- Header -->
          <tr>
            <td style="background-color:#1E3A5F;padding:28px 32px">
              <p style="margin:0;font-size:22px;font-weight:700;color:#ffffff;letter-spacing:-0.5px">Calymia</p>
              <p style="margin:4px 0 0;font-size:13px;color:#94b8d6">Plateforme de sophrologie</p>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding:32px">
              <h1 style="margin:0 0 8px;font-size:20px;color:#1E3A5F">Rappel de votre séance demain</h1>
              <p style="margin:0 0 24px;font-size:15px;color:#475569">Bonjour <strong>${prenomPatient}</strong>,</p>
              <p style="margin:0 0 20px;font-size:15px;color:#475569;line-height:1.6">
                Nous vous rappelons votre séance de sophrologie prévue <strong>demain</strong>.
              </p>

              <!-- Tableau récap -->
              <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;border-radius:8px;overflow:hidden;margin-bottom:24px">
                <tr>
                  <td style="padding:10px 16px;background:#f1f5f9;border:1px solid #e2e8f0;font-size:13px;font-weight:600;color:#64748b;width:40%">Sophrologue</td>
                  <td style="padding:10px 16px;border:1px solid #e2e8f0;font-size:14px;color:#1e293b">${nomSophrologue}</td>
                </tr>
                <tr>
                  <td style="padding:10px 16px;background:#f1f5f9;border:1px solid #e2e8f0;font-size:13px;font-weight:600;color:#64748b">Type</td>
                  <td style="padding:10px 16px;border:1px solid #e2e8f0;font-size:14px;color:#1e293b">${typeSeance}</td>
                </tr>
                <tr>
                  <td style="padding:10px 16px;background:#f1f5f9;border:1px solid #e2e8f0;font-size:13px;font-weight:600;color:#64748b">Date</td>
                  <td style="padding:10px 16px;border:1px solid #e2e8f0;font-size:14px;color:#1e293b">${date}</td>
                </tr>
                <tr>
                  <td style="padding:10px 16px;background:#f1f5f9;border:1px solid #e2e8f0;font-size:13px;font-weight:600;color:#64748b">Heure</td>
                  <td style="padding:10px 16px;border:1px solid #e2e8f0;font-size:14px;color:#1e293b;font-weight:600;color:#1E3A5F">${heure}</td>
                </tr>
                <tr>
                  <td style="padding:10px 16px;background:#f1f5f9;border:1px solid #e2e8f0;font-size:13px;font-weight:600;color:#64748b">Adresse</td>
                  <td style="padding:10px 16px;border:1px solid #e2e8f0;font-size:14px;color:#1e293b">${adresse}</td>
                </tr>
              </table>

              <p style="margin:0;font-size:13px;color:#94a3b8;line-height:1.6;border-top:1px solid #e2e8f0;padding-top:20px">
                En cas d'empêchement, merci de prévenir votre sophrologue au moins 24h à l'avance afin de permettre à un autre patient de prendre ce créneau.
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color:#f8fafc;padding:20px 32px;border-top:1px solid #e2e8f0">
              <p style="margin:0;font-size:12px;color:#94a3b8;text-align:center">
                Calymia — plateforme de gestion pour sophrologues<br>
                Cet email a été envoyé automatiquement, merci de ne pas y répondre.
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

// ─── Handler principal ────────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  try {
    const { seance_id } = await request.json();

    if (!seance_id) {
      return NextResponse.json(
        { error: "seance_id est requis." },
        { status: 400 },
      );
    }

    // 1) Récupérer la séance avec ses relations
    const { data: seance, error: seanceError } = await supabase
      .from("seances")
      .select(
        `id, debut_at, fin_at, rappel_email_envoye,
         patient:patients(prenom, nom, email),
         sophrologue:sophrologues(prenom, nom, adresse, ville, telephone),
         type_seance:types_seances(nom)`,
      )
      .eq("id", seance_id)
      .maybeSingle<SeanceRappel>();

    if (seanceError || !seance) {
      console.error("[rappels/test] Séance introuvable:", seanceError);
      return NextResponse.json(
        { error: "Séance introuvable." },
        { status: 404 },
      );
    }

    const patientEmail = seance.patient?.email;
    if (!patientEmail) {
      return NextResponse.json(
        { error: "Le patient n'a pas d'adresse email renseignée." },
        { status: 422 },
      );
    }

    const SENDGRID_API_KEY = process.env.SENDGRID_API_KEY;
    const FROM_EMAIL = process.env.SENDGRID_FROM_EMAIL ?? "noreply@calymia.fr";
    const FROM_NAME = process.env.SENDGRID_FROM_NAME ?? "Calymia";

    if (!SENDGRID_API_KEY) {
      console.error("[rappels/test] SENDGRID_API_KEY manquante");
      return NextResponse.json(
        { error: "Configuration email manquante (SENDGRID_API_KEY)." },
        { status: 500 },
      );
    }

    const nomSophrologue =
      `${seance.sophrologue?.prenom ?? ""} ${seance.sophrologue?.nom ?? ""}`.trim() ||
      "votre sophrologue";

    const prenomPatient = seance.patient?.prenom ?? "Patient";
    const nomPatient = seance.patient?.nom ?? "";

    // 2) Envoyer l'email via SendGrid
    const sendgridPayload = {
      personalizations: [
        {
          to: [
            {
              email: patientEmail,
              name: `${prenomPatient} ${nomPatient}`.trim(),
            },
          ],
          subject: `Rappel de votre séance demain avec ${nomSophrologue}`,
        },
      ],
      from: {
        email: FROM_EMAIL,
        name: FROM_NAME,
      },
      content: [
        {
          type: "text/html",
          value: buildEmailHtml(seance),
        },
      ],
    };

    const sgResponse = await fetch("https://api.sendgrid.com/v3/mail/send", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${SENDGRID_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(sendgridPayload),
    });

    if (!sgResponse.ok) {
      const sgError = await sgResponse.text();
      console.error("[rappels/test] Erreur SendGrid:", sgError);
      return NextResponse.json(
        { error: `Erreur SendGrid : ${sgResponse.status}`, detail: sgError },
        { status: 502 },
      );
    }

    console.log("[rappels/test] Email envoyé à:", patientEmail);

    // 3) Mettre à jour rappel_email_envoye = true
    const { error: updateError } = await supabase
      .from("seances")
      .update({ rappel_email_envoye: true })
      .eq("id", seance_id);

    if (updateError) {
      // Non-bloquant : l'email est parti, on logue mais on retourne succès
      console.error("[rappels/test] Erreur mise à jour rappel_email_envoye:", updateError);
    }

    return NextResponse.json({
      success: true,
      email_envoye_a: patientEmail,
      seance_id,
    });
  } catch (err) {
    console.error("[rappels/test] Erreur inattendue:", err);
    return NextResponse.json(
      { error: "Erreur interne du serveur." },
      { status: 500 },
    );
  }
}
