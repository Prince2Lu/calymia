import type { MetadataRoute } from "next";
import { createClient } from "@supabase/supabase-js";
import {
  getSophrologueProfileUrl,
  isProductionSite,
} from "@/lib/config/site-url";

export const revalidate = 3600;

type SophrologueSitemapRow = {
  slug: string | null;
  departement: string | null;
  ville: string | null;
};

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  if (!isProductionSite()) {
    return [];
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );

  const { data: sophrologues } = await supabase
    .from("sophrologues")
    .select("slug, departement, ville")
    .eq("actif", true)
    .returns<SophrologueSitemapRow[]>();

  const entries: MetadataRoute.Sitemap = [];

  for (const row of sophrologues ?? []) {
    const url = getSophrologueProfileUrl(row);
    if (!url) continue;
    entries.push({
      url,
      changeFrequency: "weekly",
      priority: 0.8,
    });
  }

  return entries;
}
