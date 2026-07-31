import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'
import { createClient } from '@supabase/supabase-js'
import { generateAndStoreFacture } from '@/lib/factures/generate'
import { PRICE_ID_TO_PLAN } from '@/lib/stripe/billing'
import { stripe } from '@/lib/stripe'
import {
  confirmationReservation,
  confirmationReservationSophrologue,
} from '@/lib/emails/templates'
import { sendEmail } from '@/lib/emails/send'
import { formatParisTime } from '@/lib/timezone'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

function formatDateFR(iso: string): string {
  return formatParisTime(iso, 'date')
}

function formatTimeFR(iso: string): string {
  return formatParisTime(iso, 'HH:mm')
}

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

      let factureUrl: string | null = null

      // Génération automatique de la facture PDF (appel direct, sans HTTP)
      try {
        console.log('[Webhook] Démarrage génération facture pour séance:', seance_id)
        const result = await generateAndStoreFacture(seance_id)
        if (result.success) {
          factureUrl = result.facture_url
          console.log('[Webhook] Facture générée avec succès:', factureUrl)
        } else {
          console.error('[Webhook] Échec génération facture:', result.error)
        }
      } catch (factureErr) {
        console.error('[Webhook] Erreur inattendue lors de la génération de facture:', factureErr)
      }

      // Emails de confirmation (patient + sophrologue)
      try {
        const { data: seance } = await supabase
          .from('seances')
          .select('debut_at, fin_at, type_seance_id, patient_id, sophrologue_id')
          .eq('id', seance_id)
          .single()

        if (seance) {
          const [{ data: patient }, { data: sophrologue }, { data: typeSeance }] = await Promise.all([
            supabase.from('patients').select('prenom, nom, email').eq('id', seance.patient_id).single(),
            supabase
              .from('sophrologues')
              .select(
                'prenom, nom, email, telephone, adresse, ville, code_postal',
              )
              .eq('id', seance.sophrologue_id)
              .single(),
            supabase.from('types_seances').select('nom').eq('id', seance.type_seance_id).single(),
          ])

          const dateSeance = formatDateFR(seance.debut_at)
          const heureSeance = formatTimeFR(seance.debut_at)
          const montant = montant_total

          if (patient?.email) {
            const html = confirmationReservation({
              prenom_client: patient.prenom ?? '',
              prenom_sophrologue: sophrologue?.prenom ?? '',
              nom_sophrologue: sophrologue?.nom ?? '',
              date_seance: dateSeance,
              heure_seance: heureSeance,
              type_seance: typeSeance?.nom ?? 'Séance',
              montant,
              facture_url: factureUrl,
              sophrologue_telephone: sophrologue?.telephone ?? null,
              sophrologue_email: sophrologue?.email ?? null,
              sophrologue_adresse: sophrologue?.adresse ?? null,
              sophrologue_ville: sophrologue?.ville ?? null,
              sophrologue_code_postal: sophrologue?.code_postal ?? null,
            })
            await sendEmail({
              to: patient.email,
              subject: 'Confirmation de votre réservation Calymia',
              html,
              log: {
                sophrologue_id: String(seance.sophrologue_id),
                patient_id: seance.patient_id
                  ? String(seance.patient_id)
                  : null,
                seance_id: String(seance_id),
                type: 'confirmation_reservation',
                destinataire_nom:
                  [patient.prenom, patient.nom].filter(Boolean).join(' ').trim() ||
                  null,
              },
            })
          }

          if (sophrologue?.email) {
            const html = confirmationReservationSophrologue({
              prenom_sophrologue: sophrologue.prenom ?? '',
              prenom_client: patient?.prenom ?? '',
              nom_client: patient?.nom ?? '',
              date_seance: dateSeance,
              heure_seance: heureSeance,
              type_seance: typeSeance?.nom ?? 'Séance',
              montant,
              facture_url: factureUrl,
            })
            await sendEmail({
              to: sophrologue.email,
              subject: 'Nouvelle réservation confirmée',
              html,
              log: {
                sophrologue_id: String(seance.sophrologue_id),
                patient_id: seance.patient_id
                  ? String(seance.patient_id)
                  : null,
                seance_id: String(seance_id),
                type: 'confirmation_reservation_praticien',
                destinataire_nom:
                  [sophrologue.prenom, sophrologue.nom]
                    .filter(Boolean)
                    .join(' ')
                    .trim() || null,
              },
            })
          }
        }
      } catch (emailErr) {
        console.error('[Webhook] Erreur envoi emails confirmation:', emailErr)
      }
    }
  }
  else if (event.type === 'checkout.session.completed') {
    const session = event.data.object as Stripe.Checkout.Session

    if (session.mode === 'setup') {
      const priceId = session.metadata?.priceId?.trim()
      const customerId =
        typeof session.customer === 'string'
          ? session.customer
          : session.customer?.id

      if (!priceId || !customerId) {
        console.warn(
          '[Webhook] checkout.session.completed (setup) ignoré: priceId ou customer manquant',
          { priceId, customerId, sessionId: session.id }
        )
      } else if (!PRICE_ID_TO_PLAN[priceId]) {
        console.warn(
          '[Webhook] checkout.session.completed (setup) ignoré: price_id non mappé',
          { priceId }
        )
      } else {
        try {
          // Attacher le moyen de paiement collecté comme défaut du customer
          const setupIntentId =
            typeof session.setup_intent === 'string'
              ? session.setup_intent
              : session.setup_intent?.id

          let paymentMethodId: string | null = null
          if (setupIntentId) {
            const setupIntent = await stripe.setupIntents.retrieve(setupIntentId)
            paymentMethodId =
              typeof setupIntent.payment_method === 'string'
                ? setupIntent.payment_method
                : setupIntent.payment_method?.id ?? null

            if (paymentMethodId) {
              await stripe.customers.update(customerId, {
                invoice_settings: {
                  default_payment_method: paymentMethodId,
                },
              })
            }
          }

          const subs = await stripe.subscriptions.list({
            customer: customerId,
            status: 'all',
            limit: 10,
          })

          const existing =
            subs.data.find((s) => s.status === 'trialing') ??
            subs.data.find((s) => s.status === 'active') ??
            subs.data.find((s) => s.status === 'paused') ??
            null

          if (!existing) {
            console.error(
              '[Webhook] checkout.session.completed (setup): aucun abonnement existant pour le customer',
              { customerId }
            )
          } else {
            const currentItemId = existing.items.data[0]?.id
            if (!currentItemId) {
              console.error(
                '[Webhook] checkout.session.completed (setup): item d’abonnement introuvable',
                { subscriptionId: existing.id }
              )
            } else {
              // Fin de trial immédiate + bascule prix, sans créer de 2e abonnement.
              // proration_behavior: "none" = facturation du prix plein dès le changement (MVP).
              const updated = await stripe.subscriptions.update(existing.id, {
                items: [{ id: currentItemId, price: priceId }],
                trial_end: 'now',
                proration_behavior: 'none',
                ...(paymentMethodId
                  ? { default_payment_method: paymentMethodId }
                  : {}),
              })

              const mappedPlan = PRICE_ID_TO_PLAN[priceId]
              const { error: upgradeError } = await supabase
                .from('sophrologues')
                .update({
                  plan: mappedPlan,
                  trial_ends_at: null,
                  stripe_subscription_id: updated.id,
                })
                .eq('stripe_customer_id', customerId)

              if (upgradeError) {
                console.error(
                  '[Webhook] erreur sync Supabase après upgrade setup:',
                  upgradeError
                )
              } else {
                console.log(
                  '[Webhook] upgrade trial → payé OK',
                  {
                    customerId,
                    subscriptionId: updated.id,
                    plan: mappedPlan,
                  }
                )
              }
            }
          }
        } catch (setupUpgradeErr) {
          console.error(
            '[Webhook] erreur upgrade après checkout setup:',
            setupUpgradeErr
          )
        }
      }
    }
  } else if (
    event.type === 'customer.subscription.updated'
  ) {
    const subscription = event.data.object as Stripe.Subscription
    const customerId =
      typeof subscription.customer === 'string'
        ? subscription.customer
        : subscription.customer.id
    const priceId = subscription.items.data[0]?.price?.id

    if (!customerId || !priceId) {
      console.warn(
        '[Webhook] customer.subscription.updated ignoré: customer ou price manquant',
        { customerId, priceId }
      )
    } else {
      const mappedPlan = PRICE_ID_TO_PLAN[priceId]

      if (!mappedPlan) {
        console.warn(
          '[Webhook] customer.subscription.updated ignoré: price_id non mappé',
          { priceId }
        )
      } else {
        // Lire le plan actuel avant update pour détecter un downgrade Pro/Cabinet → Essentiel
        const { data: currentSophro } = await supabase
          .from('sophrologues')
          .select('plan')
          .eq('stripe_customer_id', customerId)
          .maybeSingle<{ plan: string | null }>()

        const previousPlan = (currentSophro?.plan ?? '').toLowerCase()
        const isDowngradeToEssentiel =
          mappedPlan === 'essentiel' &&
          (previousPlan === 'professionnel' || previousPlan === 'cabinet')

        const trialEndsAt =
          subscription.status === 'active'
            ? null
            : subscription.trial_end
              ? new Date(subscription.trial_end * 1000).toISOString()
              : null

        const updatePayload: {
          plan: typeof mappedPlan
          trial_ends_at: string | null
          stripe_subscription_id: string
          limite_clients_alerte_envoyee_at?: null
        } = {
          plan: mappedPlan,
          trial_ends_at: trialEndsAt,
          stripe_subscription_id: subscription.id,
        }

        if (isDowngradeToEssentiel) {
          // Autorise une nouvelle alerte si le compte repasse Essentiel avec >15 clients
          updatePayload.limite_clients_alerte_envoyee_at = null
        }

        const { error: planError } = await supabase
          .from('sophrologues')
          .update(updatePayload)
          .eq('stripe_customer_id', customerId)

        if (planError) {
          console.error(
            '[Webhook] erreur mise à jour plan depuis customer.subscription.updated:',
            planError
          )
        } else {
          console.log(
            '[Webhook] plan/trial synchronisés depuis subscription.updated:',
            {
              mappedPlan,
              trialEndsAt,
              subscriptionId: subscription.id,
              limiteAlerteReset: isDowngradeToEssentiel,
            }
          )
        }
      }
    }
  } else if (event.type === 'customer.subscription.deleted') {
    const subscription = event.data.object as Stripe.Subscription
    const customerId =
      typeof subscription.customer === 'string'
        ? subscription.customer
        : subscription.customer.id

    if (!customerId) {
      console.warn(
        '[Webhook] customer.subscription.deleted ignoré: customer manquant'
      )
    } else {
      const { data: currentSophro } = await supabase
        .from('sophrologues')
        .select('plan')
        .eq('stripe_customer_id', customerId)
        .maybeSingle<{ plan: string | null }>()

      const previousPlan = (currentSophro?.plan ?? '').toLowerCase()
      const wasProPlus =
        previousPlan === 'professionnel' || previousPlan === 'cabinet'

      const { error: resetPlanError } = await supabase
        .from('sophrologues')
        .update({
          plan: 'essentiel',
          ...(wasProPlus ? { limite_clients_alerte_envoyee_at: null } : {}),
        })
        .eq('stripe_customer_id', customerId)

      if (resetPlanError) {
        console.error(
          '[Webhook] erreur reset plan depuis customer.subscription.deleted:',
          resetPlanError
        )
      } else {
        console.log(
          "[Webhook] plan réinitialisé à 'essentiel' après suppression d'abonnement",
          { limiteAlerteReset: wasProPlus }
        )
      }
    }
  } else if (event.type === 'customer.subscription.trial_will_end') {
    console.log('[Webhook] Subscription trial will end event received')
  }

  return NextResponse.json({ received: true })
}
