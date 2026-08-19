"use client";

import Script from "next/script";
import { useEffect, useState } from "react";
import { isProductionSite } from "@/lib/config/site-url";
import {
  CONSENT_CHANGED_EVENT,
  getStoredConsent,
} from "@/lib/consent/cookie-consent";

const GA_MEASUREMENT_ID = "G-XZQPVRGT3P";

export function GoogleAnalytics() {
  const [shouldLoad, setShouldLoad] = useState(false);

  useEffect(() => {
    const sync = () => {
      if (!isProductionSite()) {
        setShouldLoad(false);
        return;
      }
      setShouldLoad(getStoredConsent() === "accepted");
    };

    sync();
    window.addEventListener(CONSENT_CHANGED_EVENT, sync);
    return () => window.removeEventListener(CONSENT_CHANGED_EVENT, sync);
  }, []);

  if (!shouldLoad) return null;

  return (
    <>
      <Script
        src={`https://www.googletagmanager.com/gtag/js?id=${GA_MEASUREMENT_ID}`}
        strategy="afterInteractive"
      />
      <Script id="ga4-init" strategy="afterInteractive">
        {`
          window.dataLayer = window.dataLayer || [];
          function gtag(){dataLayer.push(arguments);}
          gtag('js', new Date());
          gtag('config', '${GA_MEASUREMENT_ID}');
        `}
      </Script>
    </>
  );
}
