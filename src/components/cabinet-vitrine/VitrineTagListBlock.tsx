"use client";

import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function VitrineTagListBlock({
  title,
  placeholder,
  items,
  onItemsChange,
  newItem,
  onNewItemChange,
  onAdd,
}: {
  title: string;
  placeholder: string;
  items: string[];
  onItemsChange: (items: string[]) => void;
  newItem: string;
  onNewItemChange: (v: string) => void;
  onAdd: () => void;
}) {
  const remove = (i: number) => {
    onItemsChange(items.filter((_, idx) => idx !== i));
  };

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-semibold text-slate-800">{title}</h3>
      <div className="flex flex-wrap gap-2">
        {items.map((t, i) => (
          <span
            key={`${t}-${i}`}
            title={t.length > 40 ? t : undefined}
            className="inline-flex max-w-[280px] items-center gap-1 rounded-full bg-[#426F59] px-3 py-1 text-xs font-medium text-white"
          >
            <span className="truncate">
              {t.length > 40 ? `${t.slice(0, 40)}…` : t}
            </span>
            <button
              type="button"
              onClick={() => remove(i)}
              className="shrink-0 rounded-full p-0.5 hover:bg-white/20"
              aria-label="Retirer"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </span>
        ))}
      </div>
      <div className="flex flex-col gap-2 sm:flex-row">
        <Input
          value={newItem}
          onChange={(e) => onNewItemChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              onAdd();
            }
          }}
          placeholder={placeholder}
          className="border-[#d1d5db] sm:flex-1"
        />
        <Button
          type="button"
          variant="outline"
          className="shrink-0 border-[#426F59] text-[#426F59]"
          onClick={onAdd}
        >
          Ajouter
        </Button>
      </div>
    </div>
  );
}
