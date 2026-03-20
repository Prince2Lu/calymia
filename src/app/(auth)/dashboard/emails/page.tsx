"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Editor } from "@tiptap/core";
import { ArrowUpRight, Mail, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import RichTextEditor from "@/components/dashboard/RichTextEditor";

type EmailTemplateRow = {
  id: string;
  type: string;
  nom: string;
  sujet: string;
  corps_html: string;
  actif: boolean;
  created_at?: string;
  updated_at?: string;
};

const PLACEHOLDERS = [
  "{{client.prenom}}",
  "{{client.nom}}",
  "{{seance.date}}",
  "{{seance.heure}}",
] as const;

const formatTemplateType = (type: string) => {
  const labels: Record<string, string> = {
    rappel: "Rappel",
    post_seance: "Post-séance",
  };
  return labels[type] ?? type;
};

export default function DashboardEmailsPage() {
  const [loading, setLoading] = useState(true);
  const [locked, setLocked] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [templates, setTemplates] = useState<EmailTemplateRow[]>([]);
  const [toast, setToast] = useState<string | null>(null);
  const [editing, setEditing] = useState<EmailTemplateRow | null>(null);
  const [saving, setSaving] = useState(false);

  const [formNom, setFormNom] = useState("");
  const [formSujet, setFormSujet] = useState("");
  const [formCorps, setFormCorps] = useState("");
  const [formActif, setFormActif] = useState(true);

  const tiptapEditorRef = useRef<Editor | null>(null);

  const insertPlaceholder = (placeholder: string) => {
    tiptapEditorRef.current?.chain().focus().insertContent(placeholder).run();
  };

  const showToast = (msg: string) => {
    setToast(msg);
    window.setTimeout(() => setToast(null), 2200);
  };

  const loadTemplates = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/dashboard/email-templates", {
        credentials: "include",
      });
      if (res.status === 403) {
        setLocked(true);
        setTemplates([]);
        return;
      }
      if (res.status === 401) {
        setError("Session expirée. Reconnectez-vous.");
        return;
      }
      if (!res.ok) {
        const j = (await res.json().catch(() => null)) as { error?: string } | null;
        setError(j?.error ?? "Chargement impossible.");
        return;
      }
      setLocked(false);
      const data = (await res.json()) as { templates: EmailTemplateRow[] };
      setTemplates(data.templates ?? []);
    } catch {
      setError("Erreur réseau.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadTemplates();
  }, [loadTemplates]);

  const openEdit = (t: EmailTemplateRow) => {
    setEditing(t);
    setFormNom(t.nom);
    setFormSujet(t.sujet);
    setFormCorps(t.corps_html);
    setFormActif(t.actif);
  };

  const closeEdit = () => {
    setEditing(null);
    setSaving(false);
  };

  const saveEdit = async () => {
    if (!editing) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/dashboard/email-templates/${editing.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          nom: formNom,
          sujet: formSujet,
          corps_html:
            tiptapEditorRef.current?.getHTML() ?? formCorps,
          actif: formActif,
        }),
      });
      const j = (await res.json().catch(() => null)) as {
        error?: string;
        template?: EmailTemplateRow;
      } | null;
      if (!res.ok) {
        showToast(j?.error ?? "Enregistrement impossible.");
        setSaving(false);
        return;
      }
      if (j?.template) {
        setTemplates((prev) =>
          prev.map((x) => (x.id === j.template!.id ? j.template! : x)),
        );
      }
      showToast("Modèle enregistré.");
      closeEdit();
      await loadTemplates();
    } catch {
      showToast("Erreur réseau.");
    } finally {
      setSaving(false);
    }
  };

  const toggleActif = async (t: EmailTemplateRow) => {
    try {
      const res = await fetch(`/api/dashboard/email-templates/${t.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ actif: !t.actif }),
      });
      const j = (await res.json().catch(() => null)) as {
        error?: string;
        template?: EmailTemplateRow;
      } | null;
      if (!res.ok) {
        showToast(j?.error ?? "Mise à jour impossible.");
        return;
      }
      if (j?.template) {
        setTemplates((prev) =>
          prev.map((x) => (x.id === j.template!.id ? j.template! : x)),
        );
      }
    } catch {
      showToast("Erreur réseau.");
    }
  };

  const copyPlaceholder = async (ph: string) => {
    try {
      await navigator.clipboard.writeText(ph);
      showToast("Copié !");
    } catch {
      showToast("Copie impossible.");
    }
  };

  if (loading && !locked && templates.length === 0 && !error) {
    return (
      <main className="min-h-screen bg-slate-50">
        <div className="mx-auto max-w-6xl px-4 py-10">
          <p className="text-sm text-slate-500">Chargement…</p>
        </div>
      </main>
    );
  }

  if (locked) {
    return (
      <main className="min-h-screen bg-slate-50">
        <div className="mx-auto max-w-6xl space-y-6 px-4 py-10">
          <div>
            <h1 className="text-3xl font-semibold text-[#1E3A5F]">
              Modèles d&apos;emails
            </h1>
            <p className="mt-1 text-sm text-slate-500">
              Personnalisez les emails automatiques envoyés à vos clients.
            </p>
          </div>
          <div className="flex flex-col gap-4 rounded-xl border border-amber-200 bg-amber-50 px-6 py-5 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm font-medium text-amber-900">
              Cette fonctionnalité est disponible à partir du plan{" "}
              <strong>Professionnel</strong>.
            </p>
            <a
              href="/parametres"
              className="inline-flex shrink-0 items-center justify-center gap-2 rounded-lg bg-[#426F59] px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-[#355a49]"
            >
              Upgrader
              <ArrowUpRight className="h-4 w-4" />
            </a>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-50">
      <div className="mx-auto max-w-6xl space-y-8 px-4 py-10">
        <div>
          <h1 className="text-3xl font-semibold text-[#1E3A5F]">
            Modèles d&apos;emails
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Rappel J-1 et message après séance — un modèle par type, avec
            placeholders.
          </p>
        </div>

        {error && (
          <p className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
            {error}
          </p>
        )}

        <div className="grid gap-6 md:grid-cols-2">
          {templates.map((t) => (
            <article
              key={t.id}
              className="flex flex-col rounded-xl border border-slate-200 bg-white p-6 shadow-sm"
            >
              <div className="mb-4 flex items-start gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[#F0F7F4] text-[#426F59]">
                  <Mail className="h-5 w-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <h2 className="font-bold text-[#1E3A5F]">{t.nom}</h2>
                  <p className="mt-1 line-clamp-2 text-sm text-slate-500">
                    {t.sujet}
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <span
                      className={
                        t.type === "rappel"
                          ? "inline-flex rounded-full bg-sky-50 px-2.5 py-0.5 text-xs font-medium text-sky-700 ring-1 ring-sky-200"
                          : "inline-flex rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-medium text-emerald-800 ring-1 ring-emerald-200"
                      }
                    >
                      {t.type === "rappel" ? "Rappel" : "Post-séance"}
                    </span>
                    <span
                      className={
                        t.actif
                          ? "inline-flex rounded-full bg-[#426F59]/15 px-2.5 py-0.5 text-xs font-semibold text-[#426F59] ring-1 ring-[#426F59]/25"
                          : "inline-flex rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-600 ring-1 ring-slate-200"
                      }
                    >
                      {t.actif ? "Actif" : "Inactif"}
                    </span>
                  </div>
                </div>
              </div>
              <div className="mt-auto flex flex-wrap gap-2 border-t border-slate-100 pt-4">
                <Button
                  type="button"
                  onClick={() => openEdit(t)}
                  className="bg-[#426F59] text-white hover:bg-[#355a49]"
                >
                  Modifier
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => void toggleActif(t)}
                  className="border-slate-300 text-slate-700 hover:bg-slate-50"
                >
                  {t.actif ? "Désactiver" : "Activer"}
                </Button>
              </div>
            </article>
          ))}
        </div>

        {editing && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
            role="dialog"
            aria-modal="true"
            aria-labelledby="modal-email-title"
          >
            <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-xl border border-slate-200 bg-white shadow-xl">
              <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
                <h2
                  id="modal-email-title"
                  className="text-lg font-semibold text-[#1E3A5F]"
                >
                  Modifier le template
                </h2>
                <button
                  type="button"
                  onClick={closeEdit}
                  className="rounded-lg p-2 text-slate-500 hover:bg-slate-100"
                  aria-label="Fermer"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
              <div className="space-y-4 px-6 py-5">
                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">
                    Nom du template
                  </label>
                  <input
                    type="text"
                    value={formNom}
                    onChange={(e) => setFormNom(e.target.value)}
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none ring-[#426F59]/30 focus:ring-2"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">
                    Type
                  </label>
                  <input
                    type="text"
                    readOnly
                    value={formatTemplateType(editing.type)}
                    className="w-full cursor-not-allowed rounded-lg border border-slate-100 bg-slate-50 px-3 py-2 text-sm text-slate-600"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">
                    Sujet
                  </label>
                  <input
                    type="text"
                    value={formSujet}
                    onChange={(e) => setFormSujet(e.target.value)}
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none ring-[#426F59]/30 focus:ring-2"
                  />
                </div>
                <div>
                  <p className="mb-2 text-sm font-medium text-slate-700">
                    Placeholders (cliquer pour insérer dans le corps)
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {PLACEHOLDERS.map((ph) => (
                      <button
                        key={ph}
                        type="button"
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => insertPlaceholder(ph)}
                        className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 font-mono text-xs text-slate-700 hover:border-[#426F59]/40 hover:bg-[#F0F7F4]"
                      >
                        {ph}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">
                    Corps de l&apos;email
                  </label>
                  <RichTextEditor
                    key={editing.id}
                    editorKey={editing.id}
                    value={formCorps}
                    onChange={setFormCorps}
                    onEditorReady={(ed) => {
                      tiptapEditorRef.current = ed;
                    }}
                  />
                </div>
                <label className="flex cursor-pointer items-center gap-3">
                  <input
                    type="checkbox"
                    checked={formActif}
                    onChange={(e) => setFormActif(e.target.checked)}
                    className="h-4 w-4 rounded border-slate-300 text-[#426F59] focus:ring-[#426F59]"
                  />
                  <span className="text-sm font-medium text-slate-700">
                    Template actif
                  </span>
                </label>
              </div>
              <div className="flex justify-end gap-2 border-t border-slate-100 px-6 py-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={closeEdit}
                  className="border-slate-300 text-slate-700"
                >
                  Annuler
                </Button>
                <Button
                  type="button"
                  disabled={saving}
                  onClick={() => void saveEdit()}
                  className="bg-[#426F59] text-white hover:bg-[#355a49]"
                >
                  {saving ? "Enregistrement…" : "Modifier template"}
                </Button>
              </div>
            </div>
          </div>
        )}

        {toast && (
          <div className="fixed bottom-6 left-1/2 z-[60] -translate-x-1/2 rounded-xl bg-[#426F59] px-5 py-3 text-sm font-medium text-white shadow-lg">
            {toast}
          </div>
        )}
      </div>
    </main>
  );
}
