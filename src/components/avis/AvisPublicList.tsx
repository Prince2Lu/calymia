import { createClient } from "@supabase/supabase-js";
import { AvisStars } from "./AvisStars";
import { AvisCommentaire } from "./AvisCommentaire";

type AvisPublicRow = {
  id: string;
  note: number;
  commentaire: string | null;
  created_at: string;
};

function formatMoisAnnee(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const label = d.toLocaleDateString("fr-FR", { month: "long", year: "numeric" });
  return label.charAt(0).toUpperCase() + label.slice(1);
}

type AvisPublicListProps = {
  sophrologueId: string;
  noteMoyenne: number;
  avisCount: number;
};

export async function AvisPublicList({
  sophrologueId,
  noteMoyenne,
  avisCount,
}: AvisPublicListProps) {
  if (avisCount === 0) return null;

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );

  const { data } = await supabase
    .from("avis")
    .select("id, note, commentaire, created_at")
    .eq("sophrologue_id", sophrologueId)
    .eq("statut", "approuve")
    .order("created_at", { ascending: false })
    .limit(10)
    .returns<AvisPublicRow[]>();

  const avis = (data ?? []).filter((a) => typeof a.note === "number");

  if (avis.length === 0) return null;

  return (
    <section className="space-y-5">
      <div className="space-y-2">
        <h2 className="text-lg font-semibold text-slate-900 font-[family-name:var(--font-playfair)]">
          Avis patients
        </h2>
        <AvisStars mode="display" value={noteMoyenne} count={avisCount} />
      </div>

      <ul className="space-y-5">
        {avis.map((a) => (
          <li key={a.id} className="space-y-2 border-b border-slate-100 pb-5 last:border-0 last:pb-0">
            <div className="flex items-center justify-between gap-3">
              <AvisStars mode="display" value={a.note} />
              <span className="shrink-0 text-xs text-slate-400">
                {formatMoisAnnee(a.created_at)}
              </span>
            </div>
            {a.commentaire?.trim() && <AvisCommentaire texte={a.commentaire.trim()} />}
          </li>
        ))}
      </ul>
    </section>
  );
}
