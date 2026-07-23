import { Loader2 } from "lucide-react";

export default function SeancesLoading() {
  return (
    <main className="min-h-screen bg-slate-50">
      <div className="mx-auto max-w-7xl space-y-5 px-4 py-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="h-8 w-40 animate-pulse rounded-lg bg-slate-200" />
          <div className="flex items-center gap-2">
            <div className="h-9 w-28 animate-pulse rounded-lg bg-slate-200" />
            <div className="h-9 w-52 animate-pulse rounded-lg bg-slate-200" />
          </div>
        </div>
        <div className="flex items-center justify-center rounded-2xl border border-slate-200 bg-white py-24 shadow-sm">
          <Loader2 className="h-8 w-8 animate-spin text-[#2E75B6]" />
        </div>
      </div>
    </main>
  );
}
