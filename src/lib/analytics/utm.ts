const UTM_STORAGE_KEY = "calymia_utm_params";

export type UtmParams = {
  utm_source?: string;
  utm_medium?: string;
  utm_campaign?: string;
  utm_content?: string;
  utm_term?: string;
};

const UTM_KEYS: (keyof UtmParams)[] = [
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_content",
  "utm_term",
];

export function captureUtmFromUrl(searchParams: URLSearchParams): void {
  if (typeof window === "undefined") return;
  const found: UtmParams = {};
  let hasAny = false;
  for (const key of UTM_KEYS) {
    const value = searchParams.get(key);
    if (value) {
      found[key] = value;
      hasAny = true;
    }
  }
  if (hasAny) {
    sessionStorage.setItem(UTM_STORAGE_KEY, JSON.stringify(found));
  }
}

export function getStoredUtm(): UtmParams {
  if (typeof window === "undefined") return {};
  const raw = sessionStorage.getItem(UTM_STORAGE_KEY);
  if (!raw) return {};
  try {
    return JSON.parse(raw) as UtmParams;
  } catch {
    return {};
  }
}
