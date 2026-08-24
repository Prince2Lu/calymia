import type { Metadata } from "next";
import Image from "next/image";
import { PaiementManuelCheckout } from "@/components/public/PaiementManuelCheckout";
import {
  resolvePaiementManuelByToken,
  toPaiementManuelPublic,
} from "@/lib/booking/paiement-manuel";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  robots: "noindex, nofollow",
  title: "Paiement de votre séance — Calymia",
};

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <main className="flex min-h-screen flex-col items-center bg-[#FAF8F5] px-4 py-12">
      <div className="mb-8">
        <Image
          src="/logo.webp"
          alt="Calymia"
          width={140}
          height={46}
          priority
          className="object-contain"
        />
      </div>
      <div className="w-full max-w-lg rounded-2xl bg-white p-8 shadow-[0_2px_16px_rgba(0,0,0,0.06)]">
        {children}
      </div>
    </main>
  );
}

function StateMessage({ title, detail }: { title: string; detail?: string }) {
  return (
    <div className="flex flex-col items-center gap-3 py-6 text-center">
      <p className="text-lg font-semibold text-[#1E3A5F]">{title}</p>
      {detail ? (
        <p className="text-sm leading-relaxed text-slate-500">{detail}</p>
      ) : null}
    </div>
  );
}

export default async function PaiementManuelPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token: rawToken } = await params;
  const token = rawToken?.trim() ?? "";

  if (!token) {
    return (
      <Shell>
        <StateMessage title="Lien invalide" />
      </Shell>
    );
  }

  const recap = toPaiementManuelPublic(
    await resolvePaiementManuelByToken(token),
  );

  if (recap.statut === "introuvable") {
    return (
      <Shell>
        <StateMessage title="Lien invalide" />
      </Shell>
    );
  }

  if (recap.statut === "deja_paye") {
    return (
      <Shell>
        <StateMessage
          title="Cette séance a déjà été confirmée"
          detail="Aucun paiement supplémentaire n'est nécessaire."
        />
      </Shell>
    );
  }

  if (recap.statut === "expire") {
    return (
      <Shell>
        <StateMessage
          title="Ce lien a expiré"
          detail="Contactez directement votre sophrologue pour convenir d'un nouveau rendez-vous."
        />
      </Shell>
    );
  }

  if (
    !recap.sophrologue_nom ||
    !recap.type_seance_nom ||
    !recap.debut_at ||
    recap.montant == null ||
    !recap.seance_id
  ) {
    return (
      <Shell>
        <StateMessage title="Lien invalide" />
      </Shell>
    );
  }

  return (
    <Shell>
      <PaiementManuelCheckout
        token={token}
        recap={{
          sophrologue_nom: recap.sophrologue_nom,
          type_seance_nom: recap.type_seance_nom,
          debut_at: recap.debut_at,
          montant: recap.montant,
          seance_id: recap.seance_id,
        }}
      />
    </Shell>
  );
}
