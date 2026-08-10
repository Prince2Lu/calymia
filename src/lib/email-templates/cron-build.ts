import type { SupabaseClient } from "@supabase/supabase-js";
import {
  postSeance,
  rappelJ1,
  buildLienVisioBlock,
  wrapSophrologueEmailHtml,
} from "@/lib/emails/templates";
import {
  applyEmailTemplatePlaceholders,
  planAllowsCustomEmailTemplates,
  type EmailPlaceholderValues,
} from "@/lib/email-templates/placeholders";

const RAPPEL_FALLBACK_SUJET = "Votre séance de sophrologie est demain 🌿";
const RAPPEL_FALLBACK_CORPS =
  "<p>Bonjour,</p><p>Rappel : votre séance est demain à {{seance.heure}}.</p>";

const POST_FALLBACK_SUJET = "Merci pour votre séance 🌿";
const POST_FALLBACK_CORPS =
  "<p>Bonjour,</p><p>Merci pour votre séance du {{seance.date}} à {{seance.heure}}.</p>";

function withOptionalVisioFragment(
  fragment: string,
  lienTeleconsultation?: string | null,
): string {
  const block = buildLienVisioBlock(lienTeleconsultation);
  if (!block) return fragment;
  return `${fragment}${block}`;
}

export async function buildCronRappelJ1Email(
  admin: SupabaseClient,
  args: {
    plan: string | null | undefined;
    authUserId: string | null | undefined;
    prenomClient: string;
    nomClient: string;
    dateParis: string;
    heureParis: string;
    prenomSophro: string;
    nomSophro: string;
    typeSeance: string;
    lienTeleconsultation?: string | null;
  },
): Promise<{ subject: string; html: string }> {
  const v: EmailPlaceholderValues = {
    clientPrenom: args.prenomClient,
    clientNom: args.nomClient,
    seanceDate: args.dateParis,
    seanceHeure: args.heureParis,
  };

  if (
    !planAllowsCustomEmailTemplates(args.plan) ||
    !args.authUserId
  ) {
    const sophro =
      `${args.prenomSophro} ${args.nomSophro}`.trim() || "votre sophrologue";
    return {
      subject: `Rappel : votre séance demain avec ${sophro}`,
      html: rappelJ1({
        prenom_client: args.prenomClient,
        prenom_sophrologue: args.prenomSophro,
        nom_sophrologue: args.nomSophro,
        date_seance: args.dateParis,
        heure_seance: args.heureParis,
        type_seance: args.typeSeance,
        lien_teleconsultation: args.lienTeleconsultation,
      }),
    };
  }

  const { data: template } = await admin
    .from("email_templates")
    .select("sujet, corps_html")
    .eq("sophrologue_id", args.authUserId)
    .eq("type", "rappel")
    .eq("actif", true)
    .maybeSingle();

  if (template?.sujet && template?.corps_html) {
    return {
      subject: applyEmailTemplatePlaceholders(template.sujet, v),
      html: wrapSophrologueEmailHtml(
        withOptionalVisioFragment(
          applyEmailTemplatePlaceholders(template.corps_html, v),
          args.lienTeleconsultation,
        ),
      ),
    };
  }

  return {
    subject: applyEmailTemplatePlaceholders(RAPPEL_FALLBACK_SUJET, v),
    html: wrapSophrologueEmailHtml(
      withOptionalVisioFragment(
        applyEmailTemplatePlaceholders(RAPPEL_FALLBACK_CORPS, v),
        args.lienTeleconsultation,
      ),
    ),
  };
}

export function buildAvisEmail(args: {
  prenomClient: string;
  prenomSophro: string;
  nomSophro: string;
  avisUrl: string;
}): { subject: string; html: string } {
  const sophro =
    `${args.prenomSophro} ${args.nomSophro}`.trim() || "votre sophrologue";
  const prenomSophro = args.prenomSophro.trim() || "Votre sophrologue";

  const content = `
    <p style="margin:0 0 16px;">Bonjour ${args.prenomClient},</p>
    <p style="margin:0 0 16px;">J'espère que votre séance s'est bien passée. Votre retour m'aiderait beaucoup et permettrait à d'autres personnes de me découvrir.</p>
    <p style="margin:0 0 24px;">Auriez-vous quelques instants pour partager votre avis ?</p>
    <table role="presentation" cellspacing="0" cellpadding="0" style="margin:0 auto 24px;">
      <tr>
        <td align="center" style="border-radius:8px;background:#3D6B2F;">
          <a href="${args.avisUrl}" style="display:inline-block;padding:14px 32px;color:#ffffff!important;text-decoration:none;font-weight:600;font-size:15px;border-radius:8px;">Laisser mon avis</a>
        </td>
      </tr>
    </table>
    <p style="margin:0 0 24px;text-align:center;font-size:13px;color:#9ca3af;">Ce lien est valable 30 jours.</p>
    <p style="margin:24px 0 0;">Merci et prenez soin de vous,<br><strong>${prenomSophro}</strong><br><span style="color:#6b7280;font-size:13px;">via Calymia</span></p>
  `;

  return {
    subject: `${args.prenomClient}, partagez votre avis sur votre séance avec ${sophro} 🌿`,
    html: wrapSophrologueEmailHtml(content),
  };
}

export async function buildCronPostSeanceEmail(
  admin: SupabaseClient,
  args: {
    plan: string | null | undefined;
    authUserId: string | null | undefined;
    prenomClient: string;
    nomClient: string;
    dateParis: string;
    heureParis: string;
    prenomSophro: string;
    nomSophro: string;
    typeSeance: string;
  },
): Promise<{ subject: string; html: string }> {
  const v: EmailPlaceholderValues = {
    clientPrenom: args.prenomClient,
    clientNom: args.nomClient,
    seanceDate: args.dateParis,
    seanceHeure: args.heureParis,
  };

  if (
    !planAllowsCustomEmailTemplates(args.plan) ||
    !args.authUserId
  ) {
    const sophro =
      `${args.prenomSophro} ${args.nomSophro}`.trim() || "votre sophrologue";
    return {
      subject: `Merci pour votre séance avec ${sophro}`,
      html: postSeance({
        prenom_client: args.prenomClient,
        prenom_sophrologue: args.prenomSophro,
        nom_sophrologue: args.nomSophro,
        type_seance: args.typeSeance,
        date_seance: args.dateParis,
        heure_seance: args.heureParis,
      }),
    };
  }

  const { data: template } = await admin
    .from("email_templates")
    .select("sujet, corps_html")
    .eq("sophrologue_id", args.authUserId)
    .eq("type", "post_seance")
    .eq("actif", true)
    .maybeSingle();

  if (template?.sujet && template?.corps_html) {
    return {
      subject: applyEmailTemplatePlaceholders(template.sujet, v),
      html: wrapSophrologueEmailHtml(
        applyEmailTemplatePlaceholders(template.corps_html, v),
      ),
    };
  }

  return {
    subject: applyEmailTemplatePlaceholders(POST_FALLBACK_SUJET, v),
    html: wrapSophrologueEmailHtml(
      applyEmailTemplatePlaceholders(POST_FALLBACK_CORPS, v),
    ),
  };
}
