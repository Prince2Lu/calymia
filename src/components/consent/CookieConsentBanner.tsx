"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { isProductionSite } from "@/lib/config/site-url";
import {
  getStoredConsent,
  setStoredConsent,
  type CookieConsent,
} from "@/lib/consent/cookie-consent";

const PRIVACY_POLICY_URL = "https://calymia.com/politique-de-confidentialite/";

export function CookieConsentBanner() {
  const [ready, setReady] = useState(false);
  const [consent, setConsent] = useState<CookieConsent | null>(null);
  const [editing, setEditing] = useState(false);

  useEffect(() => {
    if (!isProductionSite()) return;
    setConsent(getStoredConsent());
    setReady(true);
  }, []);

  if (!ready) return null;

  const choose = (value: CookieConsent) => {
    const previous = getStoredConsent();
    setStoredConsent(value);
    setConsent(value);
    setEditing(false);
    if (value === "refused" && previous === "accepted") {
      window.location.reload();
    }
  };

  if (consent !== null && !editing) {
    return (
      <button
        type="button"
        onClick={() => setEditing(true)}
        className="fixed bottom-3 left-1/2 z-40 -translate-x-1/2 text-[11px] text-slate-400 underline-offset-2 hover:text-[#426F59] hover:underline"
      >
        Gérer les cookies
      </button>
    );
  }

  return (
    <div
      role="region"
      aria-label="Consentement cookies"
      className="fixed inset-x-4 bottom-4 z-50 mx-auto max-w-lg rounded-xl border border-[#426F59]/20 bg-white p-4 shadow-lg sm:bottom-5"
    >
      <p className="text-sm leading-relaxed text-slate-700">
        Nous utilisons des cookies pour mesurer l&apos;audience du site. Vous
        pouvez accepter ou refuser.{" "}
        <a
          href={PRIVACY_POLICY_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="font-medium text-[#426F59] underline-offset-2 hover:underline"
        >
          Politique de confidentialité
        </a>
      </p>
      <div className="mt-3 flex flex-wrap items-center justify-end gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => choose("refused")}
        >
          Refuser
        </Button>
        <Button type="button" size="sm" onClick={() => choose("accepted")}>
          Accepter
        </Button>
      </div>
    </div>
  );
}
