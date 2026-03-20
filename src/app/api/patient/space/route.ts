import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

async function getAuthUser() {
  const cookieStore = await cookies();
  const supabaseAuth = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch {
            /* ignore */
          }
        },
      },
    },
  );
  const {
    data: { user },
  } = await supabaseAuth.auth.getUser();
  return user;
}

const SEANCE_SELECT = `
  id, debut_at, fin_at, statut,
  sophrologue:sophrologues(prenom, nom, adresse, ville),
  type_seance:types_seances(nom),
  paiement:paiements(montant_total, facture_url)
`;

type PatientRow = {
  id: string;
  prenom: string | null;
  nom: string | null;
  email: string | null;
  telephone: string | null;
  user_id: string | null;
};

function normEmail(e: string | null | undefined) {
  return e?.trim().toLowerCase() ?? "";
}

function mergePatientsById(rows: PatientRow[]): PatientRow[] {
  const m = new Map<string, PatientRow>();
  for (const r of rows) {
    m.set(r.id, r);
  }
  return Array.from(m.values());
}

/**
 * GET — Données espace patient (fiche + séances) en contournant la RLS navigateur.
 * Vérifie la session via cookies, puis lit avec le service role.
 *
 * Recherche : user_id d’abord, puis email (eq + ilike), liaison automatique user_id si null.
 */
export async function GET() {
  try {
    const user = await getAuthUser();
    if (!user) {
      return NextResponse.json({ error: "Non authentifié." }, { status: 401 });
    }

    const emailNorm = normEmail(user.email);
    console.log("[patient/space] user:", user.id, "emailNorm:", emailNorm);

    const { data: byUserId, error: errUid } = await supabaseAdmin
      .from("patients")
      .select("id, prenom, nom, email, telephone, user_id")
      .eq("user_id", user.id)
      .returns<PatientRow[]>();

    if (errUid) {
      console.error("[patient/space] patients by user_id:", errUid);
      return NextResponse.json(
        { error: "Impossible de charger votre profil." },
        { status: 500 },
      );
    }

    const byId = new Map<string, PatientRow>();
    for (const r of byUserId ?? []) {
      byId.set(r.id, r);
    }

    if (emailNorm) {
      const { data: byEq, error: errEq } = await supabaseAdmin
        .from("patients")
        .select("id, prenom, nom, email, telephone, user_id")
        .eq("email", emailNorm)
        .returns<PatientRow[]>();

      if (errEq) {
        console.error("[patient/space] patients by email eq:", errEq);
      }

      const { data: byIlike, error: errIlike } = await supabaseAdmin
        .from("patients")
        .select("id, prenom, nom, email, telephone, user_id")
        .ilike("email", emailNorm)
        .returns<PatientRow[]>();

      if (errIlike) {
        console.error("[patient/space] patients by email ilike:", errIlike);
      }

      const emailCandidates = mergePatientsById([
        ...(byEq ?? []),
        ...(byIlike ?? []),
      ]);

      for (const p of emailCandidates) {
        if (normEmail(p.email) !== emailNorm) continue;

        if (p.user_id && p.user_id !== user.id) {
          console.warn(
            "[patient/space] fiche email déjà liée à un autre compte — ignorée:",
            p.id,
          );
          continue;
        }

        if (!p.user_id) {
          const { error: linkErr } = await supabaseAdmin
            .from("patients")
            .update({ user_id: user.id })
            .eq("id", p.id);
          if (linkErr) {
            console.warn("[patient/space] liaison user_id échouée:", p.id, linkErr.message);
          } else {
            p.user_id = user.id;
            console.log("[patient/space] user_id lié pour patient:", p.id);
          }
        }

        if (p.user_id === user.id) {
          byId.set(p.id, { ...p, user_id: user.id });
        }
      }
    }

    let rows = Array.from(byId.values()).filter((r) => r.user_id === user.id);

    if (rows.length === 0) {
      const { data: refreshed } = await supabaseAdmin
        .from("patients")
        .select("id, prenom, nom, email, telephone, user_id")
        .eq("user_id", user.id)
        .returns<PatientRow[]>();
      rows = refreshed ?? [];
    }

    console.log("[patient/space] fiches retenues:", rows.length, rows.map((r) => r.id));

    if (rows.length === 0) {
      return NextResponse.json({
        patient: null,
        upcoming: [],
        past: [],
      });
    }

    const primary =
      rows.find((r) => normEmail(r.email) === emailNorm) ?? rows[0];
    const patientIds = [...new Set(rows.map((r) => r.id))];
    const now = new Date().toISOString();

    const { data: upcoming, error: upErr } = await supabaseAdmin
      .from("seances")
      .select(SEANCE_SELECT)
      .in("patient_id", patientIds)
      .eq("statut", "confirmee")
      .gt("debut_at", now)
      .order("debut_at");

    if (upErr) {
      console.error("[patient/space] séances à venir:", upErr);
    }

    const { data: past, error: pastErr } = await supabaseAdmin
      .from("seances")
      .select(SEANCE_SELECT)
      .in("patient_id", patientIds)
      .lt("debut_at", now)
      .order("debut_at", { ascending: false });

    if (pastErr) {
      console.error("[patient/space] séances passées:", pastErr);
    }

    return NextResponse.json({
      patient: primary,
      upcoming: upcoming ?? [],
      past: past ?? [],
    });
  } catch (e) {
    console.error("[patient/space]", e);
    return NextResponse.json({ error: "Erreur serveur." }, { status: 500 });
  }
}
