import type { Metadata } from "next";
import {
  AvisPageShell,
  AvisStateMessage,
  AvisTokenView,
} from "@/components/avis/AvisTokenView";

export const metadata: Metadata = {
  robots: "noindex, nofollow",
};

export default async function AvisTokenPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token: rawToken } = await params;
  const token = rawToken?.trim();

  if (!token) {
    return (
      <AvisPageShell>
        <AvisStateMessage title="Lien invalide." />
      </AvisPageShell>
    );
  }

  return <AvisTokenView token={token} />;
}
