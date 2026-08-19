import type { MetadataRoute } from "next";
import { getSiteUrl, isProductionSite } from "@/lib/config/site-url";

export default function robots(): MetadataRoute.Robots {
  if (!isProductionSite()) {
    return {
      rules: [{ userAgent: "*", disallow: "/" }],
    };
  }

  const siteUrl = getSiteUrl();
  return {
    rules: [
      {
        userAgent: "*",
        allow: ["/sophrologues/"],
        disallow: [
          "/dashboard",
          "/onboarding",
          "/parametres",
          "/abonnement",
          "/emails",
          "/communications",
          "/clients",
          "/seances",
          "/patient",
          "/api/",
          "/connexion",
          "/inscription",
          "/mot-de-passe-oublie",
          "/reinitialiser-mot-de-passe",
          "/auth/",
        ],
      },
    ],
    sitemap: `${siteUrl}/sitemap.xml`,
  };
}
