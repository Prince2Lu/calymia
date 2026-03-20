import type { SupabaseClient } from "@supabase/supabase-js";
import {
  postSeance,
  rappelJ1,
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
        applyEmailTemplatePlaceholders(template.corps_html, v),
      ),
    };
  }

  return {
    subject: applyEmailTemplatePlaceholders(RAPPEL_FALLBACK_SUJET, v),
    html: wrapSophrologueEmailHtml(
      applyEmailTemplatePlaceholders(RAPPEL_FALLBACK_CORPS, v),
    ),
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
