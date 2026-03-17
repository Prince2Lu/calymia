import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'
import { createClient } from '@supabase/supabase-js'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!)

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(request: NextRequest) {
  const body = await request.text()
  const signature = request.headers.get('stripe-signature')

  if (!signature) {
    return NextResponse.json({ error: 'No signature' }, { status: 400 })
  }

  let event: Stripe.Event

  try {
    event = stripe.webhooks.constructEvent(
      body,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET!
    )
  } catch (err) {
    console.error('Webhook signature verification failed:', err)
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })
  }

  console.log('Webhook event received:', event.type)

  if (event.type === 'payment_intent.succeeded') {
    const paymentIntent = event.data.object as Stripe.PaymentIntent
    const { seance_id, sophrologue_id, patient_id } = paymentIntent.metadata

    console.log('Payment succeeded for seance:', seance_id)

    const { error: seanceError } = await supabase
      .from('seances')
      .update({ statut: 'confirmee' })
      .eq('id', seance_id)

    if (seanceError) {
      console.error('Error updating seance:', seanceError)
    } else {
      console.log('Seance updated to confirmee')
    }

    const montant_total = paymentIntent.amount / 100
    const commission = montant_total * 0.03

    const { error: paiementError } = await supabase
      .from('paiements')
      .insert({
        seance_id,
        sophrologue_id,
        patient_id,
        stripe_payment_intent_id: paymentIntent.id,
        montant_total,
        commission_calymia: commission,
        montant_sophrologue: montant_total - commission,
        statut: 'reussi',
        type: 'total',
      })

    if (paiementError) {
      console.error('Error inserting paiement:', paiementError)
    } else {
      console.log('Paiement inserted successfully')
    }
  }

  return NextResponse.json({ received: true })
}
