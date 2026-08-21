import { NextResponse } from "next/server";
import { classifySpecialitesCategories } from "@/lib/ai/classify-specialites";
import { getServiceRoleClient } from "@/lib/supabase/service-role";

function assertCronAuthorized(request: Request): NextResponse | null {
  if (
    request.headers.get("authorization") !==
    `Bearer ${process.env.CRON_SECRET}`
  ) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return null;
}

type SophrologueRow = {
  id: string;
  slug: string | null;
  specialites: string[] | null;
};

export async function GET(request: Request) {
  const unauthorized = assertCronAuthorized(request);
  if (unauthorized) return unauthorized;

  try {
    const supabase = getServiceRoleClient();

    const { data: rows, error: selectError } = await supabase
      .from("sophrologues")
      .select("id, slug, specialites")
      .not("specialites", "is", null)
      .not("specialites", "eq", "{}")
      .or(
        "specialites_categories.is.null,specialites_categories.eq.{}",
      );

    if (selectError) {
      console.error(
        "[backfill-specialites-categories] SELECT échoué:",
        selectError.message,
      );
      return NextResponse.json(
        { error: selectError.message },
        { status: 500 },
      );
    }

    const aTraiter = ((rows ?? []) as SophrologueRow[]).filter(
      (row) => Array.isArray(row.specialites) && row.specialites.length > 0,
    );

    const resultats: Array<{
      slug: string | null;
      specialites: string[];
      categoriesAssignees: string[] | null;
    }> = [];

    for (const row of aTraiter) {
      const specialites = row.specialites ?? [];
      await classifySpecialitesCategories(row.id, specialites.join(", "));

      const { data: updated, error: rereadError } = await supabase
        .from("sophrologues")
        .select("specialites_categories")
        .eq("id", row.id)
        .maybeSingle<{ specialites_categories: string[] | null }>();

      if (rereadError) {
        console.error(
          "[backfill-specialites-categories] Relire échoué:",
          row.id,
          rereadError.message,
        );
      }

      const cats = updated?.specialites_categories;
      resultats.push({
        slug: row.slug,
        specialites,
        categoriesAssignees:
          Array.isArray(cats) && cats.length > 0 ? cats : null,
      });
    }

    return NextResponse.json({
      total: resultats.length,
      resultats,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[backfill-specialites-categories]", err);
    return NextResponse.json(
      { error: "Erreur inattendue.", detail: message },
      { status: 500 },
    );
  }
}
