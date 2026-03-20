"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { planAllowsSeanceNotes } from "@/lib/email-templates/placeholders";
import { seanceNoteHtmlIsNonEmpty } from "@/lib/seance-notes";
import RichTextEditor from "@/components/dashboard/RichTextEditor";
import { Button } from "@/components/ui/button";

export interface NoteSeanceProps {
  seanceId: string;
  patientId: string;
  sophrologueId: string;
  plan: string | null;
  /** Après enregistrement réussi (ex. rafraîchir les badges sur la liste). */
  onSaved?: () => void;
}

export default function NoteSeance({
  seanceId,
  patientId: _patientId,
  sophrologueId: _sophrologueId,
  plan,
  onSaved,
}: NoteSeanceProps) {
  const allowed = planAllowsSeanceNotes(plan);

  const [html, setHtml] = useState("");
  const [editorEpoch, setEditorEpoch] = useState(0);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);
  const [savedSnapshotNonEmpty, setSavedSnapshotNonEmpty] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/dashboard/seance-notes/${seanceId}`, {
        credentials: "include",
      });
      if (res.status === 403 || res.status === 401) {
        setHtml("");
        setSavedSnapshotNonEmpty(false);
        setEditorEpoch((e) => e + 1);
        return;
      }
      const j = (await res.json()) as {
        note?: { contenu_html?: string } | null;
        error?: string;
      };
      if (!res.ok) {
        setToast({ msg: j.error ?? "Chargement impossible.", ok: false });
        setHtml("");
        setSavedSnapshotNonEmpty(false);
        setEditorEpoch((e) => e + 1);
        return;
      }
      const raw = j.note?.contenu_html ?? "";
      setHtml(raw);
      setSavedSnapshotNonEmpty(seanceNoteHtmlIsNonEmpty(raw));
      setEditorEpoch((e) => e + 1);
    } catch {
      setToast({ msg: "Impossible de charger la note.", ok: false });
    } finally {
      setLoading(false);
    }
  }, [seanceId]);

  useEffect(() => {
    void load();
  }, [load]);

  const save = async () => {
    setSaving(true);
    setToast(null);
    try {
      const res = await fetch(`/api/dashboard/seance-notes/${seanceId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ contenu_html: html }),
      });
      const j = (await res.json().catch(() => null)) as {
        error?: string;
      } | null;
      if (!res.ok) {
        setToast({ msg: j?.error ?? "Enregistrement impossible.", ok: false });
        return;
      }
      setToast({ msg: "Note enregistrée", ok: true });
      setSavedSnapshotNonEmpty(seanceNoteHtmlIsNonEmpty(html));
      onSaved?.();
      window.setTimeout(() => setToast(null), 2500);
    } catch {
      setToast({ msg: "Erreur réseau.", ok: false });
    } finally {
      setSaving(false);
    }
  };

  if (!allowed) {
    return (
      <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
        Disponible à partir du plan <strong>Professionnel</strong>.
      </div>
    );
  }

  const showExistingBadge =
    savedSnapshotNonEmpty || seanceNoteHtmlIsNonEmpty(html);

  return (
    <div className="space-y-3 rounded-lg border border-[#d1d5db] bg-slate-50/80 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-[#1E3A5F]">Notes de séance</h3>
        {showExistingBadge && (
          <span className="inline-flex rounded-full bg-[#426F59]/15 px-2.5 py-0.5 text-xs font-medium text-[#426F59] ring-1 ring-[#426F59]/25">
            Note existante
          </span>
        )}
      </div>

      {loading ? (
        <div className="flex items-center gap-2 py-8 text-sm text-slate-500">
          <Loader2 className="h-5 w-5 animate-spin text-[#426F59]" />
          Chargement…
        </div>
      ) : (
        <>
          <RichTextEditor
            key={`${seanceId}-${editorEpoch}`}
            editorKey={`${seanceId}-${editorEpoch}`}
            value={html}
            onChange={setHtml}
          />
          <Button
            type="button"
            className="bg-[#426F59] text-white hover:bg-[#355a49]"
            disabled={saving}
            onClick={() => void save()}
          >
            {saving ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Enregistrement…
              </>
            ) : (
              "Enregistrer"
            )}
          </Button>
        </>
      )}

      {toast && (
        <p
          className={`text-sm font-medium ${toast.ok ? "text-[#426F59]" : "text-red-600"}`}
        >
          {toast.msg}
        </p>
      )}
    </div>
  );
}
