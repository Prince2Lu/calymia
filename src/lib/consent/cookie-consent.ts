export const CONSENT_KEY = "calymia_cookie_consent";
export const CONSENT_CHANGED_EVENT = "consent-changed";

export type CookieConsent = "accepted" | "refused";

export function getStoredConsent(): CookieConsent | null {
  if (typeof window === "undefined") return null;
  const value = localStorage.getItem(CONSENT_KEY);
  return value === "accepted" || value === "refused" ? value : null;
}

export function setStoredConsent(value: CookieConsent): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(CONSENT_KEY, value);
  window.dispatchEvent(new Event(CONSENT_CHANGED_EVENT));
}
