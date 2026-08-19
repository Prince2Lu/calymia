"use client";

import { GA_MEASUREMENT_ID } from "@/lib/analytics/config";

type GtagEventParams = Record<string, string | number | boolean | undefined>;

type GtagFn = {
  (command: "event", eventName: string, params?: GtagEventParams): void;
  (
    command: "get",
    targetId: string,
    fieldName: string,
    callback: (value: string | undefined) => void,
  ): void;
};

function getGtag(): GtagFn | undefined {
  if (typeof window === "undefined") return undefined;
  const gtag = (window as Window & { gtag?: GtagFn }).gtag;
  return typeof gtag === "function" ? gtag : undefined;
}

export function trackEvent(eventName: string, params?: GtagEventParams): void {
  const gtag = getGtag();
  if (!gtag) return;
  gtag("event", eventName, params ?? {});
}

export function getGaClientId(): Promise<string | null> {
  return new Promise((resolve) => {
    const gtag = getGtag();
    if (!gtag) {
      resolve(null);
      return;
    }
    const timeout = setTimeout(() => resolve(null), 1000);
    gtag("get", GA_MEASUREMENT_ID, "client_id", (clientId) => {
      clearTimeout(timeout);
      resolve(clientId ?? null);
    });
  });
}
