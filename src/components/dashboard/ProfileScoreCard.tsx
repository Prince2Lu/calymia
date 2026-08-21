import {
  BookOpen,
  CalendarCheck,
  ShieldCheck,
  Check,
} from "lucide-react";
import {
  PROFILE_SCORE_MAX,
  type ProfileImpact,
  type ProfileScoreItem,
} from "@/lib/profile-score";

type Props = {
  score: number;
  items: ProfileScoreItem[];
};

function impactIcon(impact: ProfileImpact) {
  switch (impact) {
    case "SEO":
      return BookOpen;
    case "Conversion":
      return CalendarCheck;
    case "Confiance":
      return ShieldCheck;
  }
}

function impactBadgeClass(impact: ProfileImpact): string {
  switch (impact) {
    case "SEO":
      return "bg-green-100 text-green-800";
    case "Conversion":
      return "bg-blue-100 text-blue-800";
    case "Confiance":
      return "bg-slate-100 text-slate-600";
  }
}

function progressBarClass(percent: number): string {
  if (percent < 40) return "bg-red-500";
  if (percent < 70) return "bg-amber-500";
  if (percent < 100) return "bg-emerald-400";
  return "bg-emerald-500";
}

function buildAmberMessage(missing: ProfileScoreItem[]): string {
  const labels = missing.slice(0, 2).map((item) => item.shortLabel);
  const joined = labels.length === 2 ? `${labels[0]} et ${labels[1]}` : labels[0] ?? "";
  return `Ajoutez ${joined} pour améliorer votre référencement.`;
}

function ContextMessage({
  percent,
  missing,
}: {
  percent: number;
  missing: ProfileScoreItem[];
}) {
  if (percent >= 100) {
    return (
      <div className="rounded-r-md border-l-[3px] border-green-500 bg-green-50 px-4 py-3 text-sm text-green-800">
        Votre profil est complet à 100% — excellent pour votre référencement Google !
      </div>
    );
  }

  if (percent < 40) {
    return (
      <div className="rounded-r-md border-l-[3px] border-red-400 bg-red-50 px-4 py-3 text-sm text-red-800">
        Votre profil est incomplet — complétez-le pour apparaître dans les résultats Google.
      </div>
    );
  }

  if (percent < 70) {
    return (
      <div className="rounded-r-md border-l-[3px] border-amber-400 bg-amber-50 px-4 py-3 text-sm text-amber-800">
        {buildAmberMessage(missing)}
      </div>
    );
  }

  return (
    <div className="rounded-r-md border-l-[3px] border-green-500 bg-green-50 px-4 py-3 text-sm text-green-800">
      Votre profil est presque complet — encore un effort !
    </div>
  );
}

function MissingItem({ item }: { item: ProfileScoreItem }) {
  const Icon = impactIcon(item.impact);
  return (
    <li className="flex items-center gap-3">
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-500">
        <Icon className="h-4 w-4" aria-hidden />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-slate-700">{item.label}</p>
        <p className="text-xs text-slate-400">{item.sublabel}</p>
      </div>
      <span
        className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${impactBadgeClass(item.impact)}`}
      >
        {item.impact}
      </span>
      <a
        href={item.href}
        className="shrink-0 text-xs text-[#2D6A4F] hover:underline"
      >
        Compléter →
      </a>
    </li>
  );
}

function CompletedItem({
  item,
  dimmed,
}: {
  item: ProfileScoreItem;
  dimmed: boolean;
}) {
  return (
    <li className={`flex items-center gap-3 ${dimmed ? "opacity-50" : ""}`}>
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-green-100 text-green-700">
        <Check className="h-4 w-4" aria-hidden />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-slate-700">{item.label}</p>
        <p className="text-xs text-slate-400">{item.sublabel}</p>
      </div>
      <span
        className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${impactBadgeClass(item.impact)}`}
      >
        {item.impact}
      </span>
    </li>
  );
}

function scoreToPercent(score: number): number {
  if (PROFILE_SCORE_MAX <= 0) return 0;
  return Math.round((score / PROFILE_SCORE_MAX) * 100);
}

export default function ProfileScoreCard({ score, items }: Props) {
  const missing = items.filter((item) => !item.completed);
  const completed = items.filter((item) => item.completed);
  const percent = scoreToPercent(score);
  const isComplete = score >= PROFILE_SCORE_MAX;

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-6">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h2 className="font-medium text-slate-800">Complétude de votre profil</h2>
          <p className="text-sm text-slate-500">
            Un profil complet améliore votre visibilité sur Google
          </p>
        </div>
        <div className="shrink-0 text-right">
          <p className="text-3xl font-medium text-[#1E3A5F] leading-none">{percent}%</p>
          <p className="text-xs text-slate-400">/ 100</p>
        </div>
      </div>

      <div className="mt-4 h-2 w-full overflow-hidden rounded-full bg-slate-100">
        <div
          className={`h-2 rounded-full ${progressBarClass(percent)}`}
          style={{ width: `${percent}%` }}
        />
      </div>

      <div className="mt-4">
        <ContextMessage percent={percent} missing={missing} />
      </div>

      {missing.length > 0 && (
        <div className="mt-6">
          <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
            Éléments manquants
          </h3>
          <ul className="space-y-3">
            {missing.map((item) => (
              <MissingItem key={item.key} item={item} />
            ))}
          </ul>
        </div>
      )}

      {completed.length > 0 && (
        <div className="mt-6">
          {missing.length > 0 && <hr className="mb-6 border-slate-100" />}
          <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
            Déjà complétés
          </h3>
          <ul className="space-y-3">
            {completed.map((item) => (
              <CompletedItem key={item.key} item={item} dimmed={!isComplete} />
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
