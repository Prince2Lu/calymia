"use client";

import { X } from "lucide-react";
import type { HorairesSophrologue, JourSemaine } from "@/types/horaires";
import { JOURS_LABELS, JOURS_SEMAINE } from "@/types/horaires";

const MAX_PLAGES_PAR_JOUR = 3;
const HOUR_OPTIONS = Array.from({ length: 24 }, (_, i) =>
  String(i).padStart(2, "0"),
);
const MINUTE_OPTIONS = ["00", "15", "30", "45"] as const;

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

  const splitTime = (value: string): { hour: string; minute: string } => {
    if (!value || !value.includes(":")) return { hour: "", minute: "" };
    const [hour, minute] = value.split(":");
    return { hour: hour ?? "", minute: minute ?? "" };
  };

  const updateTimePart = (
    jour: JourSemaine,
    index: number,
    field: "debut" | "fin",
    part: "hour" | "minute",
    value: string,
  ) => {
    const current = horaires[jour]?.[index]?.[field] ?? "";
    const parsed = splitTime(current);
    const nextHour = part === "hour" ? value : parsed.hour;
    const nextMinute = part === "minute" ? value : parsed.minute;
    const nextTime =
      nextHour !== "" && nextMinute !== "" ? `${nextHour}:${nextMinute}` : "";
    updatePlage(jour, index, field, nextTime);
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
                        <div className="flex items-center gap-1">
                          <select
                            value={splitTime(p.debut).hour}
                            onChange={(e) =>
                              updateTimePart(
                                jour,
                                idx,
                                "debut",
                                "hour",
                                e.target.value,
                              )
                            }
                            className="h-9 rounded-lg border border-slate-200 bg-white px-2 text-sm text-slate-900"
                          >
                            <option value="">HH</option>
                            {HOUR_OPTIONS.map((h) => (
                              <option key={`start-hour-${h}`} value={h}>
                                {h}
                              </option>
                            ))}
                          </select>
                          <span className="text-slate-400">:</span>
                          <select
                            value={splitTime(p.debut).minute}
                            onChange={(e) =>
                              updateTimePart(
                                jour,
                                idx,
                                "debut",
                                "minute",
                                e.target.value,
                              )
                            }
                            className="h-9 rounded-lg border border-slate-200 bg-white px-2 text-sm text-slate-900"
                          >
                            <option value="">MM</option>
                            {MINUTE_OPTIONS.map((m) => (
                              <option key={`start-minute-${m}`} value={m}>
                                {m}
                              </option>
                            ))}
                          </select>
                        </div>
                        <span className="text-slate-400">—</span>
                        <div className="flex items-center gap-1">
                          <select
                            value={splitTime(p.fin).hour}
                            onChange={(e) =>
                              updateTimePart(
                                jour,
                                idx,
                                "fin",
                                "hour",
                                e.target.value,
                              )
                            }
                            className="h-9 rounded-lg border border-slate-200 bg-white px-2 text-sm text-slate-900"
                          >
                            <option value="">HH</option>
                            {HOUR_OPTIONS.map((h) => (
                              <option key={`end-hour-${h}`} value={h}>
                                {h}
                              </option>
                            ))}
                          </select>
                          <span className="text-slate-400">:</span>
                          <select
                            value={splitTime(p.fin).minute}
                            onChange={(e) =>
                              updateTimePart(
                                jour,
                                idx,
                                "fin",
                                "minute",
                                e.target.value,
                              )
                            }
                            className="h-9 rounded-lg border border-slate-200 bg-white px-2 text-sm text-slate-900"
                          >
                            <option value="">MM</option>
                            {MINUTE_OPTIONS.map((m) => (
                              <option key={`end-minute-${m}`} value={m}>
                                {m}
                              </option>
                            ))}
                          </select>
                        </div>
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
