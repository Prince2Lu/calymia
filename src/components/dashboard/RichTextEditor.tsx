"use client";

import { useEditor, EditorContent, useEditorState } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import type { Editor } from "@tiptap/core";
import styles from "./RichTextEditor.module.css";

function Toolbar({ editor }: { editor: Editor }) {
  const { bold, italic, bulletList } = useEditorState({
    editor,
    selector: (snap) => ({
      bold: snap.editor.isActive("bold"),
      italic: snap.editor.isActive("italic"),
      bulletList: snap.editor.isActive("bulletList"),
    }),
  });

  const btnClass = (active: boolean) =>
    `px-2 py-1 rounded text-sm transition-colors ${
      active
        ? "bg-[#426F59] text-white"
        : "text-slate-800 hover:bg-gray-200"
    }`;

  return (
    <div className="flex flex-wrap gap-2 border-b border-[#d1d5db] bg-gray-50 p-2">
      <button
        type="button"
        className={btnClass(bold)}
        onClick={() => editor.chain().focus().toggleBold().run()}
      >
        Gras
      </button>
      <button
        type="button"
        className={btnClass(italic)}
        onClick={() => editor.chain().focus().toggleItalic().run()}
      >
        Italique
      </button>
      <button
        type="button"
        className={btnClass(bulletList)}
        onClick={() => editor.chain().focus().toggleBulletList().run()}
      >
        Liste à puces
      </button>
      <button
        type="button"
        className={btnClass(false)}
        title="Insère un saut de ligne dans le paragraphe"
        onClick={() => editor.chain().focus().setHardBreak().run()}
      >
        Ligne / paragraphe
      </button>
    </div>
  );
}

export type RichTextEditorProps = {
  value: string;
  onChange: (html: string) => void;
  /** Change quand on ouvre un autre template → recrée l’éditeur avec le bon HTML */
  editorKey: string;
  onEditorReady?: (editor: Editor | null) => void;
};

export default function RichTextEditor({
  value,
  onChange,
  editorKey,
  onEditorReady,
}: RichTextEditorProps) {
  const editor = useEditor(
    {
      immediatelyRender: false,
      extensions: [StarterKit],
      content: value,
      editorProps: {
        attributes: {
          class: `tiptap ${styles.proseMirror} max-w-none min-h-[250px] p-3 bg-white text-sm text-slate-900 focus:outline-none rounded-b-md`,
        },
      },
      onUpdate: ({ editor: ed }) => {
        onChange(ed.getHTML());
      },
      onCreate: ({ editor: ed }) => {
        onEditorReady?.(ed);
      },
      onDestroy: () => {
        onEditorReady?.(null);
      },
    },
    [editorKey],
  );

  if (!editor) {
    return (
      <div className="min-h-[250px] rounded-md border border-[#d1d5db] bg-white p-3 text-sm text-slate-500">
        Chargement de l&apos;éditeur…
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-md border border-[#d1d5db] bg-white">
      <Toolbar editor={editor} />
      <EditorContent editor={editor} />
    </div>
  );
}
