"use client";

import { useMemo, useState } from "react";
import { loadStripe } from "@stripe/stripe-js";
import {
  CardElement,
  Elements,
  useElements,
  useStripe,
} from "@stripe/react-stripe-js";
import { Button } from "@/components/ui/button";

type InnerProps = {
  amount: number;
  clientSecret: string;
  seanceId: string | number;
  onSuccess: (seanceId: string | number) => void;
};

function InnerPaymentForm({ amount, clientSecret, seanceId, onSuccess }: InnerProps) {
  const stripe = useStripe();
  const elements = useElements();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const pay = async () => {
    setError(null);
    if (!stripe || !elements) return;

    const card = elements.getElement(CardElement);
    if (!card) {
      setError("Le formulaire de carte bancaire n’est pas prêt. Réessayez.");
      return;
    }

    setLoading(true);
    const { error: stripeError, paymentIntent } = await stripe.confirmCardPayment(
      clientSecret,
      {
        payment_method: { card },
      },
    );
    setLoading(false);

    if (stripeError) {
      setError(
        stripeError.message ??
          "Le paiement a échoué. Vérifiez vos informations et réessayez.",
      );
      return;
    }

    if (paymentIntent?.status === "succeeded") {
      onSuccess(seanceId);
      return;
    }

    setError("Le paiement n’a pas été confirmé. Merci de réessayer.");
  };

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-slate-200 bg-white p-4">
        <div className="flex items-center justify-between">
          <p className="text-sm font-medium text-slate-800">Montant à payer</p>
          <p className="text-sm font-semibold text-[#1E3A5F]">{amount.toFixed(2)}€</p>
        </div>
        <div className="mt-3 rounded-lg border border-slate-200 bg-slate-50 p-3">
          <CardElement
            options={{
              style: {
                base: {
                  fontSize: "14px",
                  color: "#1E3A5F",
                  "::placeholder": { color: "#94a3b8" },
                },
              },
            }}
          />
        </div>
      </div>

      {error ? <p className="text-sm text-red-600">{error}</p> : null}

      <Button
        type="button"
        onClick={pay}
        disabled={!stripe || loading}
        className="w-full bg-[#27AE60] text-white hover:bg-green-700"
      >
        {loading ? "Traitement..." : `Payer ${amount.toFixed(2)}€`}
      </Button>
    </div>
  );
}

export function PaymentForm(props: InnerProps) {
  const stripePromise = useMemo(() => {
    const key = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY;
    return key ? loadStripe(key) : null;
  }, []);

  if (!stripePromise) {
    return (
      <p className="text-sm text-red-600">
        Clé Stripe publique manquante. Vérifiez
        `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`.
      </p>
    );
  }

  return (
    <Elements stripe={stripePromise} options={{ clientSecret: props.clientSecret }}>
      <InnerPaymentForm {...props} />
    </Elements>
  );
}

