import { NextResponse } from "next/server";
import { getServiceRoleClient } from "@/lib/supabase/service-role";
import { fetchAuthUserIdByEmail } from "@/lib/supabase/fetch-auth-user-id-by-email";
import { checkEtNotifierDepassementLimite } from "@/lib/notifications/limite-clients-alerte";
import { assertPrimaryCalendarSlotAvailable } from "@/lib/google/freebusy";
import { upsertSeanceEvent } from "@/lib/google/calendar-sync";
import { createDailyRoom } from "@/lib/visio/daily";
import { sendEmail } from "@/lib/emails/send";
import { confirmationSeanceManuelle, lienPaiementManuel } from "@/lib/emails/templates";
import { getSiteUrl } from "@/lib/config/site-url";
import { formatParisTime } from "@/lib/timezone";

/** Délai pendant lequel un créneau manuel en attente de paiement reste bloqué. */
export const MANUAL_LINK_EXPIRY_DAYS = 7;

type ModeReglement = "hors_plateforme" | "lien_en_ligne";

type PatientPayload = {
  id?: string;
  prenom?: string;
  nom?: string;
  email?: string;
  telephone?: string;
};

type Payload = {
  sophrologue_id?: string;
  type_seance_id?: string;
  debut_at?: string;
  patient?: PatientPayload;
  mode_reglement?: ModeReglement;
  montant_declare?: number;
};

type TypeSeanceRow = {
  id: string;
  sophrologue_id: string;
  duree_minutes: number;
  tarif: number;
  mode: string | null;
  nom: string | null;
  actif: boolean;
};

type PatientRow = {
  id: string;
  prenom: string | null;
  nom: string | null;
  email: string | null;
  telephone: string | null;
  user_id: string | null;
};

function trimOrNull(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const t = value.trim();
  return t.length > 0 ? t : null;
}

function normalizeEmail(value: unknown): string | null {
  const t = trimOrNull(value);
  return t ? t.toLowerCase() : null;
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as Payload;
    const sophrologueId = trimOrNull(body.sophrologue_id);
    const typeSeanceId = trimOrNull(body.type_seance_id);
    const debutAtRaw = trimOrNull(body.debut_at);
    const modeReglement = body.mode_reglement;
    const patientIn = body.patient ?? {};

    if (!sophrologueId || !typeSeanceId || !debutAtRaw) {
      return NextResponse.json(
        {
          error:
            "sophrologue_id, type_seance_id et debut_at sont requis.",
        },
        { status: 400 },
      );
    }

    if (
      modeReglement !== "hors_plateforme" &&
      modeReglement !== "lien_en_ligne"
    ) {
      return NextResponse.json(
        {
          error:
            "mode_reglement doit être 'hors_plateforme' ou 'lien_en_ligne'.",
        },
        { status: 400 },
      );
    }

    const debut = new Date(debutAtRaw);
    if (Number.isNaN(debut.getTime())) {
      return NextResponse.json(
        { error: "debut_at n'est pas une date ISO valide." },
        { status: 400 },
      );
    }

    if (modeReglement === "lien_en_ligne" && debut.getTime() < Date.now()) {
      return NextResponse.json(
        {
          error:
            "Impossible de créer une séance dans le passé avec paiement en ligne",
        },
        { status: 400 },
      );
    }

    const prenom = trimOrNull(patientIn.prenom);
    const nom = trimOrNull(patientIn.nom);
    const patientIdIn = trimOrNull(patientIn.id);
    const emailIn = normalizeEmail(patientIn.email);
    const telephoneIn = trimOrNull(patientIn.telephone);

    if (!patientIdIn && (!prenom || !nom)) {
      return NextResponse.json(
        { error: "Prénom et nom du patient sont requis." },
        { status: 400 },
      );
    }

    if (!patientIdIn && !emailIn && !telephoneIn) {
      return NextResponse.json(
        {
          error:
            "Indiquez un patient existant (id) ou au moins un email ou un téléphone.",
        },
        { status: 400 },
      );
    }

    const supabase = getServiceRoleClient();

    // ── 1) Type de séance ────────────────────────────────────────────────────
    const { data: typeRow, error: typeErr } = await supabase
      .from("types_seances")
      .select("id, sophrologue_id, duree_minutes, tarif, mode, nom, actif")
      .eq("id", typeSeanceId)
      .eq("sophrologue_id", sophrologueId)
      .eq("actif", true)
      .maybeSingle<TypeSeanceRow>();

    if (typeErr || !typeRow) {
      return NextResponse.json(
        { error: "Type de séance invalide ou inactif pour ce sophrologue." },
        { status: 400 },
      );
    }

    const dureeMinutes = Number(typeRow.duree_minutes) || 60;
    const tarifEuros = Number(typeRow.tarif);
    if (!Number.isFinite(tarifEuros) || tarifEuros < 0) {
      console.error("[seances/create] tarif invalide:", typeRow.tarif);
      return NextResponse.json(
        { error: "Tarif de la séance invalide." },
        { status: 500 },
      );
    }

    const fin = new Date(debut.getTime() + dureeMinutes * 60 * 1000);
    const debutAt = debut.toISOString();
    const finAt = fin.toISOString();
    const typeMode = typeRow.mode === "visio" ? "visio" : "presentiel";

    // ── 2) Résoudre le patient ───────────────────────────────────────────────
    let patient: PatientRow;
    let isNewPatient = false;

    if (patientIdIn) {
      const { data: existingById, error: byIdErr } = await supabase
        .from("patients")
        .select("id, prenom, nom, email, telephone, user_id")
        .eq("id", patientIdIn)
        .eq("sophrologue_id", sophrologueId)
        .maybeSingle<PatientRow>();

      if (byIdErr || !existingById) {
        return NextResponse.json(
          { error: "Patient introuvable pour ce sophrologue." },
          { status: 404 },
        );
      }
      patient = existingById;
    } else if (emailIn) {
      const { data: existingByEmail } = await supabase
        .from("patients")
        .select("id, prenom, nom, email, telephone, user_id")
        .eq("sophrologue_id", sophrologueId)
        .eq("email", emailIn)
        .maybeSingle<PatientRow>();

      if (existingByEmail) {
        patient = existingByEmail;
      } else {
        const created = await insertPatient({
          sophrologueId,
          prenom: prenom!,
          nom: nom!,
          email: emailIn,
          telephone: telephoneIn,
        });
        if (!created.ok) return created.response;
        patient = created.patient;
        isNewPatient = true;
      }
    } else {
      const { data: existingByPhone } = await supabase
        .from("patients")
        .select("id, prenom, nom, email, telephone, user_id")
        .eq("sophrologue_id", sophrologueId)
        .eq("telephone", telephoneIn)
        .maybeSingle<PatientRow>();

      if (existingByPhone) {
        patient = existingByPhone;
      } else {
        const created = await insertPatient({
          sophrologueId,
          prenom: prenom!,
          nom: nom!,
          email: null,
          telephone: telephoneIn,
        });
        if (!created.ok) return created.response;
        patient = created.patient;
        isNewPatient = true;
      }
    }

    const emailPourLien = patient.email?.trim().toLowerCase() || emailIn;
    if (modeReglement === "lien_en_ligne" && !emailPourLien) {
      return NextResponse.json(
        { error: "email requis pour envoyer un lien de paiement" },
        { status: 400 },
      );
    }

    // ── 3) Conflits Calymia + FreeBusy Google ────────────────────────────────
    const { data: conflict } = await supabase
      .from("seances")
      .select("id")
      .eq("sophrologue_id", sophrologueId)
      .in("statut", ["confirmee", "en_attente"])
      .lt("debut_at", finAt)
      .gt("fin_at", debutAt)
      .or(`expire_at.is.null,expire_at.gt.${new Date().toISOString()}`)
      .limit(1)
      .maybeSingle();

    if (conflict) {
      console.log(
        "[seances/create] Conflit Calymia:",
        debutAt,
        "seance:",
        conflict.id,
      );
      return NextResponse.json(
        { error: "Ce créneau vient d'être réservé. Veuillez en choisir un autre." },
        { status: 409 },
      );
    }

    const googleCheck = await assertPrimaryCalendarSlotAvailable(
      sophrologueId,
      debut,
      fin,
    );
    if (!googleCheck.ok) {
      console.log(
        "[seances/create] FreeBusy Google:",
        googleCheck.httpStatus,
        debutAt,
      );
      return NextResponse.json(
        { error: googleCheck.error },
        { status: googleCheck.httpStatus },
      );
    }

    // ── 4) Insert séance ─────────────────────────────────────────────────────
    const horsPlateforme = modeReglement === "hors_plateforme";
    const montantDeclare = horsPlateforme
      ? Number.isFinite(body.montant_declare) &&
        (body.montant_declare as number) >= 0
        ? Number(body.montant_declare)
        : tarifEuros
      : null;

    const tokenPaiement = horsPlateforme ? null : crypto.randomUUID();
    const expireAt = horsPlateforme
      ? null
      : new Date(
          Date.now() + MANUAL_LINK_EXPIRY_DAYS * 24 * 60 * 60 * 1000,
        ).toISOString();

    const { data: seance, error: insertErr } = await supabase
      .from("seances")
      .insert({
        sophrologue_id: sophrologueId,
        type_seance_id: typeSeanceId,
        patient_id: patient.id,
        debut_at: debutAt,
        fin_at: finAt,
        statut: horsPlateforme ? "confirmee" : "en_attente",
        origine: "manuelle",
        expire_at: expireAt,
        montant_declare: montantDeclare,
        token_paiement_manuel: tokenPaiement,
      })
      .select("id, statut")
      .single<{ id: string; statut: string }>();

    if (insertErr || !seance) {
      console.error("[seances/create] Insert séance:", insertErr);
      return NextResponse.json(
        { error: "Impossible de créer la séance. Merci de réessayer." },
        { status: 500 },
      );
    }

    if (isNewPatient) {
      void (async () => {
        try {
          await checkEtNotifierDepassementLimite(sophrologueId);
        } catch (err) {
          console.error("[seances/create] limite-clients (avalée):", err);
        }
      })();
    }

    // ── 5) hors_plateforme : visio + Google (isolés) ─────────────────────────
    if (horsPlateforme) {
      if (typeMode === "visio") {
        try {
          const url = await createDailyRoom(finAt);
          const { error: lienErr } = await supabase
            .from("seances")
            .update({ lien_teleconsultation: url })
            .eq("id", seance.id);
          if (lienErr) {
            console.error(
              "[seances/create] Échec update lien_teleconsultation:",
              lienErr,
            );
          } else {
            console.log("[seances/create] Salle Daily.co créée:", url);
          }
        } catch (dailyErr) {
          const msg =
            dailyErr instanceof Error ? dailyErr.message : String(dailyErr);
          console.error("[seances/create] Génération lien visio échouée:", msg);

          try {
            const { data: sophroRow } = await supabase
              .from("sophrologues")
              .select("lien_teleconsultation")
              .eq("id", sophrologueId)
              .maybeSingle<{ lien_teleconsultation: string | null }>();
            const fallback = sophroRow?.lien_teleconsultation?.trim() || null;
            if (fallback) {
              const { error: fbErr } = await supabase
                .from("seances")
                .update({ lien_teleconsultation: fallback })
                .eq("id", seance.id);
              if (fbErr) {
                console.error(
                  "[seances/create] Fallback lien profil échoué:",
                  fbErr,
                );
              } else {
                console.log(
                  "[seances/create] Fallback lien_teleconsultation profil appliqué",
                );
              }
            }
          } catch (fbOuter) {
            console.error("[seances/create] Fallback visio inattendu:", fbOuter);
          }
        }
      }

      try {
        await upsertSeanceEvent(seance.id);
      } catch (googleErr) {
        console.error("[seances/create] Google Agenda:", googleErr);
      }

      const emailConfirm = patient.email?.trim().toLowerCase() || emailIn;
      if (emailConfirm) {
        try {
          const { data: sophrologue } = await supabase
            .from("sophrologues")
            .select("prenom, nom")
            .eq("id", sophrologueId)
            .maybeSingle<{ prenom: string | null; nom: string | null }>();

          let lienVisio: string | null = null;
          if (typeMode === "visio") {
            const { data: seanceLien } = await supabase
              .from("seances")
              .select("lien_teleconsultation")
              .eq("id", seance.id)
              .maybeSingle<{ lien_teleconsultation: string | null }>();
            lienVisio = seanceLien?.lien_teleconsultation?.trim() || null;
          }

          const html = confirmationSeanceManuelle({
            prenom_client:
              (patient.prenom ?? prenom ?? "").trim() || "cher client",
            prenom_sophrologue: sophrologue?.prenom ?? "",
            nom_sophrologue: sophrologue?.nom ?? "",
            type_seance: typeRow.nom ?? "Séance",
            date_heure: formatParisTime(debutAt, "dateTimeLong"),
            lien_visio: lienVisio,
          });

          const sent = await sendEmail({
            to: emailConfirm,
            subject: "Votre séance a été enregistrée sur Calymia",
            html,
            log: {
              sophrologue_id: sophrologueId,
              patient_id: patient.id,
              seance_id: seance.id,
              type: "confirmation_seance_manuelle",
              destinataire_nom:
                [patient.prenom, patient.nom].filter(Boolean).join(" ").trim() ||
                null,
            },
          });
          if (!sent.success) {
            console.error(
              "[seances/create] Envoi email confirmation manuelle:",
              sent.error,
            );
          }
        } catch (emailErr) {
          console.error(
            "[seances/create] Email confirmation manuelle:",
            emailErr,
          );
        }
      }
    }

    // ── 6) lien_en_ligne : email (page de paiement = étape 3) ────────────────
    if (!horsPlateforme && tokenPaiement && emailPourLien) {
      try {
        const { data: sophrologue } = await supabase
          .from("sophrologues")
          .select("prenom, nom")
          .eq("id", sophrologueId)
          .maybeSingle<{ prenom: string | null; nom: string | null }>();

        const dateHeure = formatParisTime(debutAt, "dateTimeLong");
        const url = `${getSiteUrl()}/paiement/${tokenPaiement}`;
        const prenomClient =
          (patient.prenom ?? prenom ?? "").trim() || "cher client";
        const prenomSophro = sophrologue?.prenom ?? "";
        const nomSophro = sophrologue?.nom ?? "";

        const html = lienPaiementManuel({
          prenom_client: prenomClient,
          prenom_sophrologue: prenomSophro,
          nom_sophrologue: nomSophro,
          type_seance: typeRow.nom ?? "Séance",
          date_heure: dateHeure,
          montant: tarifEuros,
          url,
        });

        const sent = await sendEmail({
          to: emailPourLien,
          subject: "Lien de paiement pour votre séance Calymia",
          html,
          log: {
            sophrologue_id: sophrologueId,
            patient_id: patient.id,
            seance_id: seance.id,
            type: "lien_paiement_manuel",
            destinataire_nom:
              [patient.prenom, patient.nom].filter(Boolean).join(" ").trim() ||
              null,
          },
        });
        if (!sent.success) {
          console.error(
            "[seances/create] Envoi email lien de paiement:",
            sent.error,
          );
        }
      } catch (emailErr) {
        console.error("[seances/create] Email lien de paiement:", emailErr);
      }
    }

    return NextResponse.json({
      seance_id: seance.id,
      statut: seance.statut,
    });
  } catch (err) {
    console.error("[seances/create] Erreur inattendue:", err);
    return NextResponse.json({ error: "Erreur interne." }, { status: 500 });
  }
}

async function insertPatient(args: {
  sophrologueId: string;
  prenom: string;
  nom: string;
  email: string | null;
  telephone: string | null;
}): Promise<
  | { ok: true; patient: PatientRow }
  | { ok: false; response: NextResponse }
> {
  const supabase = getServiceRoleClient();
  let canonicalPrenom = args.prenom;
  let canonicalNom = args.nom;
  let canonicalTelephone = args.telephone;
  let authUserId: string | null = null;

  if (args.email) {
    authUserId = await fetchAuthUserIdByEmail(args.email);
    if (authUserId) {
      const { data: canonical } = await supabase
        .from("patients")
        .select("prenom, nom, telephone")
        .eq("user_id", authUserId)
        .is("sophrologue_id", null)
        .maybeSingle<{
          prenom: string | null;
          nom: string | null;
          telephone: string | null;
        }>();
      if (canonical) {
        canonicalPrenom = canonical.prenom || args.prenom;
        canonicalNom = canonical.nom || args.nom;
        canonicalTelephone = canonical.telephone || args.telephone;
      }
    }
  }

  const { data: created, error } = await supabase
    .from("patients")
    .insert({
      sophrologue_id: args.sophrologueId,
      prenom: canonicalPrenom,
      nom: canonicalNom,
      email: args.email,
      telephone: canonicalTelephone,
      ...(authUserId ? { user_id: authUserId } : {}),
    })
    .select("id, prenom, nom, email, telephone, user_id")
    .single<PatientRow>();

  if (error || !created) {
    console.error("[seances/create] Insert patient:", error);
    return {
      ok: false,
      response: NextResponse.json(
        { error: "Impossible de créer le client. Merci de réessayer." },
        { status: 500 },
      ),
    };
  }

  return { ok: true, patient: created };
}
