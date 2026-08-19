"use client";

import Link from "next/link";
import { trackEvent } from "@/lib/analytics/gtag";

export function ReserverButton({
  href,
  sophrologueId,
  className,
}: {
  href: string;
  sophrologueId: string;
  className: string;
}) {
  return (
    <Link
      href={href}
      className={className}
      onClick={() => trackEvent("click_prendre_rdv", { sophrologue_id: sophrologueId })}
    >
      Prendre rendez-vous
    </Link>
  );
}
