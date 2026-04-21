"use client";

import { X } from "lucide-react";
import type { HorairesSophrologue, JourSemaine } from "@/types/horaires";
import { JOURS_LABELS, JOURS_SEMAINE } from "@/types/horaires";

const MAX_PLAGES_PAR_JOUR = 3;

function timeToMinutes(t: string): number {
  const [h, m] = t.split(":").map((x) => Number(x));
  if (!Number.isFinite(h) || !Number.isFinite(m)) return NaN;
  return h * 60 + m;
}

export function isPlageHoraireValide(debut: string, fin: string): boolean {
  if (!debut || !fin) return true;
  const a = timeToMinutes(debut);
  const b = timeToMinutes(fin);
  if (Number.isNaN(a) || Number.isNaN(b)) return true;
  return a < b;
}

type Props = {
  horaires: HorairesSophrologue;
  onChange: (next: HorairesSophrologue) => void;
};

export function HorairesPlagesEditor({ horaires, onChange }: Props) {
  const setDayPlages = (jour: JourSemaine, plages: { debut: string; fin: string }[]) => {
    onChange({ ...horaires, [jour]: plages });
  };

  const addPlage = (jour: JourSemaine) => {
    const cur = horaires[jour] ?? [];
    if (cur.length >= MAX_PLAGES_PAR_JOUR) return;
    setDayPlages(jour, [...cur, { debut: "", fin: "" }]);
  };

  const removePlage = (jour: JourSemaine, index: number) => {
    const cur = horaires[jour] ?? [];
    setDayPlages(
      jour,
      cur.filter((_, i) => i !== index),
    );
  };

  const updatePlage = (
    jour: JourSemaine,
    index: number,
    field: "debut" | "fin",
    value: string,
  ) => {
    const cur = [...(horaires[jour] ?? [])];
    const row = { ...cur[index]!, [field]: value };
    cur[index] = row;
    setDayPlages(jour, cur);
  };

  return (
    <div className="space-y-6">
      {JOURS_SEMAINE.map((jour) => {
        const plages = horaires[jour] ?? [];
        const canAdd = plages.length < MAX_PLAGES_PAR_JOUR;

        return (
          <div
            key={jour}
            className="rounded-lg border border-slate-200 bg-slate-50/50 px-3 py-3 sm:px-4"
          >
            <p className="mb-2 text-sm font-semibold text-slate-800">
              {JOURS_LABELS[jour] ?? jour}
            </p>

            {plages.length === 0 ? (
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <span className="text-sm text-slate-400">Fermé</span>
                <button
                  type="button"
                  onClick={() => addPlage(jour)}
                  className="text-left text-xs font-medium text-[#426F59] hover:underline sm:text-right"
                >
                  + Ajouter une plage
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                {plages.map((p, idx) => {
                  const ok = isPlageHoraireValide(p.debut, p.fin);
                  return (
                    <div key={idx} className="space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-xs text-slate-500">
                          Plage {idx + 1}
                        </span>
                        <input
                          type="time"
                          value={p.debut}
                          onChange={(e) =>
                            updatePlage(jour, idx, "debut", e.target.value)
                          }
                          className="h-9 rounded-lg border border-slate-200 bg-white px-2 text-sm text-slate-900"
                        />
                        <span className="text-slate-400">—</span>
                        <input
                          type="time"
                          value={p.fin}
                          onChange={(e) =>
                            updatePlage(jour, idx, "fin", e.target.value)
                          }
                          className="h-9 rounded-lg border border-slate-200 bg-white px-2 text-sm text-slate-900"
                        />
                        <button
                          type="button"
                          onClick={() => removePlage(jour, idx)}
                          className="ml-auto flex h-8 w-8 items-center justify-center rounded-full text-slate-400 hover:bg-slate-200 hover:text-slate-700"
                          aria-label="Supprimer la plage"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </div>
                      {!ok && (
                        <p className="text-xs text-amber-700">
                          L&apos;heure de début doit être avant l&apos;heure de fin.
                        </p>
                      )}
                    </div>
                  );
                })}
                {canAdd && (
                  <button
                    type="button"
                    onClick={() => addPlage(jour)}
                    className="text-xs font-medium text-[#426F59] hover:underline"
                  >
                    + Ajouter une plage
                  </button>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
