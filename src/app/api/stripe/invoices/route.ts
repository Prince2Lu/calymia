import { NextResponse } from "next/server";
import { getSophrologueSession } from "@/lib/auth/sophrologue-session";
import { stripe } from "@/lib/stripe";

export type StripeInvoiceDto = {
  id: string;
  number: string | null;
  status: string | null;
  amount_paid: number;
  currency: string;
  created: number;
  invoice_pdf: string | null;
  hosted_invoice_url: string | null;
};

export async function GET() {
  const session = await getSophrologueSession();

  if (!session?.sophrologue) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }

  const customerId = session.sophrologue.stripe_customer_id;
  if (!customerId) {
    return NextResponse.json({ invoices: [] satisfies StripeInvoiceDto[] });
  }

  try {
    const result = await stripe.invoices.list({
      customer: customerId,
      limit: 12,
    });

    const invoices: StripeInvoiceDto[] = result.data.map((inv) => ({
      id: inv.id,
      number: inv.number,
      status: inv.status,
      amount_paid: inv.amount_paid,
      currency: inv.currency,
      created: inv.created,
      invoice_pdf: inv.invoice_pdf ?? null,
      hosted_invoice_url: inv.hosted_invoice_url ?? null,
    }));

    return NextResponse.json({ invoices });
  } catch (err) {
    console.error("[stripe/invoices] Erreur list:", err);
    return NextResponse.json(
      { error: "Impossible de récupérer l’historique de facturation." },
      { status: 500 },
    );
  }
}
