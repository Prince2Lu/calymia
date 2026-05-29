import type { Metadata } from "next";
import Image from "next/image";
import { createClient } from "@/lib/supabase/server";
import { AvisForm } from "@/components/avis/AvisForm";

export const metadata: Metadata = {
  robots: "noindex, nofollow",
};

type SophrologueEmbed = {
  prenom: string | null;
  nom: string | null;
  photo_url: string | null;
} | null;

type AvisRow = {
  token: string;
  token_utilise: boolean;
  token_expire_at: string;
  sophrologue: SophrologueEmbed | SophrologueEmbed[];
};

function one<T>(v: T | T[] | null | undefined): T | null {
  if (v == null) return null;
  return Array.isArray(v) ? (v[0] ?? null) : v;
}

function PageShell({ children }: { children: React.ReactNode }) {
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
      <span className="flex h-12 w-12 items-center justify-center rounded-full bg-[#F0EDE7] text-2xl text-[#2D6A4F]">
        ✦
      </span>
      <p className="text-lg font-semibold text-slate-800">{title}</p>
      {detail && <p className="text-sm leading-relaxed text-slate-500">{detail}</p>}
    </div>
  );
}

export default async function AvisPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string | string[] }>;
}) {
  const params = await searchParams;
  const rawToken = params.token;
  const token = (Array.isArray(rawToken) ? rawToken[0] : rawToken)?.trim();

  if (!token) {
    return (
      <PageShell>
        <StateMessage title="Lien invalide." />
      </PageShell>
    );
  }

  const supabase = await createClient();
  const { data } = await supabase
    .from("avis")
    .select(
      `token, token_utilise, token_expire_at,
       sophrologue:sophrologues(prenom, nom, photo_url)`,
    )
    .eq("token", token)
    .limit(1)
    .maybeSingle<AvisRow>();

  if (!data) {
    return (
      <PageShell>
        <StateMessage title="Lien invalide ou expiré." />
      </PageShell>
    );
  }

  if (data.token_utilise) {
    return (
      <PageShell>
        <StateMessage title="Merci ! Votre avis a déjà été enregistré." />
      </PageShell>
    );
  }

  if (new Date(data.token_expire_at) < new Date()) {
    return (
      <PageShell>
        <StateMessage
          title="Ce lien a expiré."
          detail="Les avis doivent être soumis dans les 7 jours suivant la séance."
        />
      </PageShell>
    );
  }

  const sophrologue = one(data.sophrologue);

  return (
    <PageShell>
      <AvisForm
        token={token}
        sophrologue={{
          prenom: sophrologue?.prenom ?? "",
          nom: sophrologue?.nom ?? "",
          photo_url: sophrologue?.photo_url ?? null,
        }}
      />
    </PageShell>
  );
}
