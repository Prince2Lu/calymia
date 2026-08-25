# CLAUDE.md — Calymia

Fichier de contexte pour Claude Code. À lire en priorité avant toute modification du repo.

Dernière mise à jour : 24 août 2026

---

## 1. Vue d'ensemble du projet

Calymia est une plateforme SaaS B2B2C pour les sophrologues en France.
- **Sophrologue** : page publique SEO + outils de gestion (agenda, clients, paiements)
- **Client** : trouve un sophrologue via Google, réserve et paie en ligne
- **Calymia** : prélève 3% de commission sur chaque réservation + abonnement mensuel sophrologue

**Repo GitHub** : `github.com/Prince2Lu/calymia`
**Stack** : Next.js 14 App Router, Supabase (PostgreSQL + RLS), Stripe Connect + Billing, Resend, Daily.co (visio), n8n

---

## 2. Environnements — CRITIQUE

| | DEV | PROD |
|---|---|---|
| **URL app** | `calymia.vercel.app` | `app.calymia.com` |
| **Supabase projet** | `cdfltpuzlkyoymjgdhcr` | `tsydrlqcshgnblgiacow` |
| **Stripe** | TEST (clés test) | LIVE (clés live) ✅ actif |
| **Daily.co** | compte `calymia-dev` (`DAILY_API_KEY` sur Vercel `calymia`) | compte `calymia-prod` (`DAILY_API_KEY` sur Vercel `calymia-prod`) — même séparation que Stripe TEST/LIVE |
| **Branche Git** | `develop` | `main` |
| **Projet Vercel** | `calymia` | `calymia-prod` |
| **n8n CALYMIA_BASE_URL** | `https://calymia.vercel.app` | `https://app.calymia.com` ✅ actif |

### Règle absolue
**Toujours travailler sur la branche `develop`.** Ne jamais commiter directement sur `main`.
Le merge `develop` → `main` est fait manuellement par Eric après validation sur DEV.

### Déploiement DEV
Auto-deploy Git natif Vercel↔GitHub (fiable depuis le 24 juillet 2026 — voir section 9).
Il suffit de pousser sur `develop` :
```bash
git add .
git commit -m "feat/fix: description"
git push origin develop
```
Vercel déclenche automatiquement le build du projet `calymia` sur ce push. Un déploiement
manuel reste possible en secours :
```bash
vercel link  # sélectionner le projet "calymia" (pas "calymia-prod")
vercel --prod
```
⚠️ **Toujours se re-linker sur `calymia` (DEV) immédiatement après toute opération sur
`calymia-prod`** (`vercel link` → sélectionner `calymia`) pour éviter tout déploiement
accidentel en PROD depuis le CLI.

### Déploiement PROD
```bash
git checkout main
git pull origin main
git merge develop
git push origin main
git checkout develop
```

Checklist avant tout merge `develop` → `main` :
1. `npx tsc --noEmit` et `npm run build` sans erreur
2. Pas de nouveau `console.error` dans les logs Vercel DEV récents
3. Migrations Supabase déjà validées sur DEV
4. **Migrations Supabase appliquées sur PROD** (`tsydrlqcshgnblgiacow`) — étape **distincte et
   obligatoire AVANT** `git push origin main`. Vérifier en base (colonnes/tables attendues
   présentes) ; ne pas se contenter du fait que le code a été validé sur DEV. Un push Git
   déploie le code Next.js, **pas** les migrations SQL.

⚠️ **Incident août 2026** : le code visioconférence a été mergé/déployé en PROD sans appliquer
la migration `types_seances.mode` (`20260810180000_types_seances_mode.sql`) → erreur
« Could not find the 'mode' column » à la première utilisation. Toujours appliquer la
migration SQL PROD **avant** (ou au pire simultanément à) le déploiement du code qui en dépend.

---

## 3. Structure du projet

```
src/
├── app/
│   ├── (auth)/              # Dashboard sophrologue (protégé)
│   │   ├── dashboard/       # KPIs + agenda + score complétude profil
│   │   ├── seances/         # Agenda semaine + drawer détail (badge Visio + Copier/Régénérer)
│   │   ├── clients/         # Liste + fiche client [id] — suppression client ✅ (31/07)
│   │   ├── patient/         # Espace client — fix alignement grille séances ✅ livré PROD (août 2026,
│   │   │                    # confirmé mergé lors du diagnostic du 21/08 — voir section 12)
│   │   ├── parametres/      # 5 onglets : Profil (SIRET, checkbox certification RNCP — 21/08),
│   │   │                    # Séances, Disponibilités, Cabinet/Vitrine, Intégrations (Google Agenda)
│   │   ├── emails/          # Templates emails (Pro+)
│   │   ├── communications/  # Journal (Pro+)
│   │   ├── abonnement/      # Plans & abonnement + historique de facturation ✅ (31/07)
│   │   └── avis/            # Modération des avis clients (Pro+) — ✅ (voir section 6)
│   ├── (public)/
│   │   ├── sophrologues/[dept]/[ville]/[slug]/  # Page publique SSR
│   │   │   └── reserver/    # Tunnel réservation 5 étapes (+ rappel anti-spam visio à l'étape 5)
│   │   ├── avis/[token]/    # Formulaire avis client, accès par token unique post-séance
│   │   └── paiement/[token]/  # Page paiement création manuelle (24/08, noindex, voir section 6)
│   ├── onboarding/          # Wizard 5 étapes
│   ├── inscription/         # Création compte
│   ├── connexion/           # Login
│   ├── mot-de-passe-oublie/ # resetPasswordForEmail + next=/reinitialiser-mot-de-passe (fix août 2026)
│   ├── reinitialiser-mot-de-passe/  # Formulaire nouveau mot de passe (post-recovery)
│   ├── auth/
│   │   └── callback/        # Échange code PKCE ; priorise `next`, fallback `type=recovery`
│   └── api/
│       ├── auth/            # create-client-account, check-email
│       ├── stripe/
│       │   ├── webhook/         # payment_intent.succeeded (+ génération lien visio), checkout.session.completed (30/07),
│       │   │                    # customer.subscription.updated/deleted/trial_will_end
│       │   ├── checkout/        # Checkout Session mode "setup" (upgrade pendant trial, 30/07)
│       │   ├── billing-portal/  # Lien vers le Billing Portal Stripe
│       │   └── invoices/        # GET factures Stripe du sophrologue (31/07)
│       ├── sophrologue/     # CRUD sophrologue (dont certification_rncp depuis le 21/08)
│       ├── google/
│       │   └── oauth/           # OAuth Google Agenda : start, callback, disconnect (voir section 6)
│       ├── patients/
│       │   ├── create/          # Ajout manuel client (dashboard)
│       │   └── [id]/delete/     # Suppression client, RPC transactionnelle (31/07)
│       ├── seances/
│       │   ├── [id]/regenerer-visio/  # POST — recrée une salle Daily.co (août 2026)
│       │   ├── create/                # POST — création manuelle (24/08, voir section 6),
│       │   │                          # ne réutilise PAS bloquer-creneau (hold 15 min sans patient)
│       │   └── extract-from-message/  # POST — extraction Claude depuis message collé (24/08)
│       ├── avis/
│       │   └── moderer/         # POST — approuve/masque un avis client (Pro+, voir section 6)
│       ├── reservations/    # create-payment-intent, annuler,
│       │                    # bloquer-creneau/ (FreeBusy strict — PAS sous /api/seances/, erreur
│       │                    # d'arborescence corrigée le 24/08)
│       ├── public/          # prochain-creneau (force-dynamic), google-busy (FreeBusy souple, voir section 6),
│       │   └── paiement-manuel/[token]/  # GET affichage + create-intent (24/08, voir section 6)
│       ├── factures/        # generer (facture séance, redesign 30/07 — voir section 6)
│       ├── recus/
│       │   └── generer/         # POST — reçu PDF hors plateforme, distinct de factures/ (24/08, voir section 6)
│       └── cron/            # Endpoints n8n (rappels-j1, post-seance — filtre 48h anti-spam
│                             # depuis le 24/08, voir section 6 —, cleanup-seances)
├── components/
│   ├── dashboard/
│   │   ├── ProfileScoreCard.tsx         # Widget score complétude (Server Component)
│   │   ├── ProfileScoreCardWrapper.tsx  # Wrapper client pour ProfileScoreCard
│   │   ├── PlanCheckoutButtons.tsx      # Boutons "Choisir Essentiel/Professionnel"
│   │   └── InvoiceHistoryTable.tsx      # Historique de facturation abonnement (31/07)
│   ├── seances/
│   │   ├── SeancesCalendar.tsx      # Grille agenda + drawer détail (Client Component)
│   │   ├── NouveauSeanceModal.tsx   # Création manuelle (24/08, voir section 6) — extrait pour
│   │   │                            # ne pas alourdir SeancesCalendar.tsx (~750 lignes)
│   │   └── BoutonRecu.tsx           # Reçu PDF hors plateforme (24/08) — génère au clic si absent,
│   │                                # sinon télécharge (contrairement à BoutonFacture, display-only)
│   ├── factures/            # BoutonFacture.tsx — libellé "Télécharger la facture" (renommé 24/08,
│   │                        # évite la confusion avec BoutonRecu)
│   ├── providers/           # SophrologueProvider.tsx
│   ├── public/              # SophrologueInfoLine.tsx (générique, sert au SIRET ; renommé le 21/08,
│   │                        # remplaçait SophrologueRppsLine.tsx), ProchainCreneauBadge.tsx,
│   │                        # AvisPublicList.tsx, UtmCapture.tsx, PaiementManuelCheckout.tsx (24/08,
│   │                        # voir section 6) — tous "use client"
│   ├── seances/             # SeancesCalendar.tsx, types.ts
│   ├── ui/                  # Composants partagés (cn() avec twMerge depuis le 27/07, voir section 10)
│   └── ...
├── hooks/
│   ├── useFacture.ts        # Récupère facture_url depuis paiements
│   ├── usePlan.ts           # Restrictions selon plan sophrologue (feature flags uniquement,
│   │                        # pas de blocage réel sur la limite 15 clients — voir section 11)
│   └── ...
└── lib/
    ├── auth/
    │   └── sophrologue-session.ts  # getSophrologueSession() avec cache() React,
    │                                # inclut stripe_customer_id depuis le 31/07
    ├── billing/
    │   └── trial-status.ts  # computeTrialDaysRemaining(), getSidebarPlanBadge()
    ├── stripe/
    │   └── billing.ts       # createStripeCustomerForSophrologue() — preferred_locales: ['fr'] ;
    │                        # getPriceIdToPlan() lazy, mapping price_id → plan via env STRIPE_PRICE_*
    │                        # (voir section 6, plus de map hardcodée)
    ├── google/
    │   └── oauth.ts         # OAuth Google Agenda : tokens chiffrés AES-256-GCM, getBusyIntervals()
    │                        # (FreeBusy souple), assertPrimaryCalendarSlotAvailable() (FreeBusy strict),
    │                        # upsertSeanceEvent() (voir section 6)
    ├── booking/
    │   ├── compute-next-slot.ts  # computeNextAvailableSlotIso() — lit sophrologues.horaires
    │   ├── slots.ts          # SLOT_GRID_STEP_MS = 30 min (passé de 15 à 30 min, voir section 6)
    │   └── paiement-manuel.ts  # Helper token paiement différé (24/08, voir section 6)
    ├── ai/
    │   ├── classify-specialites.ts       # Classification specialites_categories via after()
    │   └── extract-seance-from-message.ts  # Extraction création manuelle (24/08, voir section 6) —
    │                                        # ATTENTION thinking: {type:"disabled"} obligatoire sur Sonnet 5
    ├── config/
    │   └── site-url.ts      # getSiteUrl(), getSophrologueProfileUrl(), isProductionSite() (voir section 6)
    ├── analytics/
    │   ├── config.ts         # GA4 (G-XZQPVRGT3P), chargé PROD only via isProductionSite() (voir section 6)
    │   └── cookie-consent.ts # Clé localStorage calymia_cookie_consent
    ├── utm.ts                # sessionStorage calymia_utm_params, lu par UtmCapture.tsx (voir section 6)
    ├── factures/
    │   ├── generate.tsx     # Génération PDF facture séance — redesign complet 30/07 (section 6)
    │   └── fonts/           # PlayfairDisplay-*.ttf, DMSans-*.ttf (committés, pas de fetch réseau)
    ├── recus/
    │   └── generate.tsx     # Reçu PDF hors plateforme (24/08) — réutilise fonts/palette de
    │                        # factures/ sans en réutiliser le contenu (voir section 6)
    ├── notifications/
    │   └── limite-clients-alerte.ts  # Alerte dépassement 15 clients (plan Essentiel) — 31/07
    ├── emails/
    │   ├── templates.ts     # Templates emails Resend
    │   └── send.ts          # sendEmail() — init Resend paresseuse via getResendClient() (31/07)
    ├── visio/
    │   └── daily.ts         # createDailyRoom() — salles Daily.co (août 2026)
    ├── profile-score.ts     # computeProfileScore(), ProfileScoreItem, SophrologueRow, PROFILE_SCORE_MAX
    │                        # (dérivé dynamiquement, voir section 6)
    ├── horaires.ts          # normalizeHoraires(), dispoByJsDayFromHoraires() — source unique horaires (voir section 10)
    ├── supabase/            # Clients Supabase (browser + server)
    ├── utils.ts             # cn() — twMerge (fixé le 27/07, voir section 10)
    └── timezone.ts          # formatParisTime()
```

---

## 4. Base de données — Points critiques

### Table `sophrologues` — deux clés, ne jamais confondre
- `id` : clé interne, utilisée pour toutes les FK (seances, patients, paiements, etc.)
- `user_id` : référence vers `auth.users`, utilisée uniquement pour l'authentification

```sql
-- CORRECT : jointure via sophrologues.id
SELECT * FROM seances WHERE sophrologue_id = sophrologues.id

-- CORRECT : identifier le sophrologue connecté
SELECT * FROM sophrologues WHERE user_id = auth.uid()
```

### Table `patients` — modèle d'identité (mis à jour 24 juillet 2026)
Un même client (`user_id`) peut avoir **plusieurs fiches `patients`** : une par sophrologue
chez qui il a réservé (`sophrologue_id` renseigné), plus une fiche **canonique**
(`sophrologue_id IS NULL`) qui fait autorité sur son identité (`prenom`/`nom`/`telephone`).

- La fiche canonique alimente l'espace client (`/patient`)
- Les fiches par sophrologue sont des rattachements "cabinet" ; elles ne doivent plus être
  une source d'identité concurrente (voir section 8 pour le détail du fix)
- Toute nouvelle fiche cabinet créée reprend l'identité canonique si elle existe
- Une fiche cabinet existante n'est plus jamais écrasée sur `prenom`/`nom`/`telephone` par
  une réservation ultérieure — seul `user_id` peut encore être complété s'il manquait
- **Suppression d'un patient** (31/07) : RPC transactionnelle `delete_patient_cascade` (paiements
  → communications → seance_notes → seances → patient), appelée depuis
  `DELETE /api/patients/[id]/delete`. Bloque avec 409 si des séances futures non annulées existent.

### Tables principales
| Table | Colonnes clés | Notes |
|---|---|---|
| `sophrologues` | `id`, `user_id`, `slug`, `plan`, `horaires` (JSONB), `photos_cabinet`, `siret`, `certification_rncp` (boolean), `afficher_email`, `afficher_telephone`, `lien_teleconsultation`, `stripe_customer_id`, `stripe_subscription_id`, `trial_ends_at`, `limite_clients_alerte_envoyee_at` | `plan` = 'essentiel' / 'professionnel' / 'cabinet'. `horaires` = **seule source de vérité** pour l'affichage ET le booking depuis le 27/07 (voir section 10). `siret` nullable, ajouté 30/07 (affiché sur la facture si renseigné). `certification_rncp boolean NOT NULL DEFAULT false` remplace `numero_rpps` depuis le 21/08 — simple filtre déclaratif (pas de code, pas de critère de score profil), voir section 6. `afficher_email`/`afficher_telephone` : opt-in d'affichage des coordonnées sur la page publique (voir section 6). `lien_teleconsultation` = fallback profil si création Daily.co échoue (voir section 6 — Visioconférence). `limite_clients_alerte_envoyee_at` ajouté 31/07 (voir section 11) |
| `patients` | `id`, `user_id`, `sophrologue_id`, `email` (nullable depuis 24/08) | Pas `clients` — toujours `patients`. Voir modèle d'identité ci-dessus. `email` nullable depuis le chantier création manuelle (contact WhatsApp/SMS sans email, voir section 6) |
| `seances` | `id`, `sophrologue_id`, `patient_id`, `debut_at`, `fin_at`, `statut`, `origine`, `lien_teleconsultation`, `montant_declare`, `token_paiement_manuel`, `recu_url` | `statut` = 'confirmee' / 'terminee' / 'annulee' / 'en_attente'. `origine` = 'en_ligne' / 'manuelle' (contrainte `seances_origine_check`). `lien_teleconsultation` **activement lue/écrite** depuis août 2026 (lien Daily.co par séance, voir section 6). `montant_declare`, `token_paiement_manuel` et `recu_url` ajoutés le 24/08 pour la création manuelle de séance (voir section 6) |
| `paiements` | `id`, `seance_id`, `sophrologue_id`, `statut`, `montant_total`, `facture_url` | `statut` = 'reussi' / 'rembourse' |
| `types_seances` | `id`, `sophrologue_id`, `nom`, `duree_minutes`, `tarif`, `actif`, `mode` | `mode` = `'presentiel'` \| `'visio'` (défaut `presentiel`), migration `20260810180000_types_seances_mode.sql` — août 2026 |
| `disponibilites` | `id`, `sophrologue_id`, `jour_semaine`, `heure_debut`, `heure_fin`, `actif` | ⚠️ **Legacy** — plus lue ni écrite pour le booking depuis le 27/07 (voir section 10). Reste en base, non supprimée |
| `communications` | `id`, `sophrologue_id`, `patient_id`, `seance_id`, `type`, `statut`, `sent_at`, `destinataire_email`, `destinataire_nom`, `objet`, `contenu` | ⚠️ Pas `communications_log`. Colonne date = `sent_at` (pas `created_at`). Contrainte `communications_type_check` : liste fermée de valeurs autorisées pour `type` — **toujours vérifier/étendre cette contrainte** avant d'introduire un nouveau type d'email journalisé (ajouté `limite_clients_alerte` le 31/07 ; la contrainte réelle en base contenait déjà `avis`, absent du fichier de migration d'origine — écart base/repo à garder en tête) |
| `email_templates` | `id`, `sophrologue_id`, `type`, `sujet`, `contenu_html` | FK sur `sophrologues.user_id` (pas `.id`) |
| `seance_notes` | `id`, `sophrologue_id`, `patient_id`, `seance_id`, `contenu_html` | Pro+ uniquement |
| `avis` | `id`, `sophrologue_id`, `patient_id`, `seance_id`, `token`, `note`, `commentaire`, `statut`, `created_at` | Ajoutée `20260529120000_avis.sql`. Token unique généré au post-séance (Pro+), formulaire public `/avis/[token]`, modération sophrologue (`/dashboard/avis`, `POST /api/avis/moderer`), affichage public via `AvisPublicList.tsx`. Voir section 6 |
| `google_calendar_connections` | `id`, `sophrologue_id`, `access_token`, `refresh_token`, `calendar_id`, `created_at` | Ajoutée `20260814120000_...sql`. Tokens chiffrés AES-256-GCM. Voir section 6 — Google Agenda |

### Horaires — format JSONB
```typescript
// Format multi-plages — toujours utiliser normalizeHoraires() pour la rétrocompatibilité
{ lundi: [{ debut: "09:00", fin: "12:00" }, { debut: "14:00", fin: "18:00" }] }
import { normalizeHoraires } from "@/lib/horaires"
```

### Storage Supabase
| Bucket | Accès | Contenu |
|---|---|---|
| `avatars` | Public | Photos de profil |
| `cabinet-photos` | Public | Photos cabinet (`{user_id}/{filename}`) |
| `factures` | ⚠️ Upload/lecture actuels en `public` + `getPublicUrl()` dans le code, alors que ce bucket est documenté comme **privé avec URL signée** — écart constaté le 30/07, à vérifier/corriger (risque de confidentialité si non intentionnel) | Factures PDF (`CAL-{année}-{seq}.pdf`, numérotation via `Date.now()` — pas une vraie séquence incrémentale, à surveiller si le document doit un jour respecter une numérotation comptable stricte) |

### RLS — Règles de sécurité établies
- Les policies `service_insert_*` doivent être restreintes au rôle `service_role` (jamais `public`)
- Les buckets publics (`avatars`, `cabinet-photos`) : policy SELECT avec `USING (bucket_id = '...' AND name IS NOT NULL)` — pas de listing global
- Vérifier les warnings Supabase (Performance & Security Lints) avant chaque merge PROD
- Fonction `handle_updated_at` / `update_updated_at` : doit avoir `SET search_path = public, pg_catalog`

---

## 5. Règles techniques — CRITIQUE

### Emails — Resend uniquement
**Ne jamais utiliser SendGrid, nodemailer ou SMTP.**
Toujours utiliser Resend via HTTP POST :
```typescript
await fetch("https://api.resend.com/emails", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
  },
  body: JSON.stringify({ from, to, subject, html }),
})
```
Les templates sont dans `src/lib/emails/templates.ts`.
SMTP Supabase (emails d'auth : reset password, etc.) est également configuré via Resend
depuis le 22 juillet 2026.

⚠️ **Init paresseuse obligatoire (31/07)** : le client Resend dans `src/lib/emails/send.ts` doit
être créé via `getResendClient()` (lazy, avec garde sur `RESEND_API_KEY` absente), jamais via
`new Resend(...)` au niveau module. Une instanciation top-level fait planter **l'import entier**
du module dès que `RESEND_API_KEY` est absente (ex: en local sans `.env.local` complet), ce qui
peut casser en cascade toute route qui importe indirectement `send.ts` — y compris des routes
sans rapport comme `create-payment-intent` (bug vécu le 31/07 : 500 sur le paiement à cause d'un
crash d'import Resend).

`to` accepte `string | string[]` depuis le 31/07 (notifications internes à plusieurs destinataires).

⚠️ **TODO cleanup identifié le 21/08** : `src/app/api/rappels/test/route.ts` appelle encore
directement `api.sendgrid.com` (leftover, hors du chemin Resend décrit ci-dessus). Aucun email de
prod ne passe par SendGrid (confirmé), mais cette route de test doit être migrée vers Resend ou
supprimée. Des docs hors `CLAUDE.md` (README, `.env.example`, `docs/architecture.md`,
`docs/infrastructure.md`, `src/docs/n8n-workflow-rappels.md`) mentionnent aussi encore SendGrid —
non traité dans ce fichier, à corriger séparément.

### SSR — obligatoire sur les pages publiques
Toutes les pages sous `(public)/` doivent être en SSR (Server Side Rendering).
Ne jamais ajouter `"use client"` sur les pages publiques sophrologues. Si un bloc nécessite
un état client (ex: infobulle toggle sur mobile, ou badge temps réel), l'isoler dans un petit
composant `"use client"` dédié — exemples : `src/components/public/SophrologueInfoLine.tsx`
(renommé le 21/08, ex-`SophrologueRppsLine.tsx`), `src/components/public/ProchainCreneauBadge.tsx`.

### URLs — toujours centralisées
**Ne jamais hardcoder** `app.calymia.com` ou `calymia.vercel.app`. Toujours utiliser :
```typescript
import { getSiteUrl, getSophrologueProfileUrl } from "@/lib/config/site-url"
```
basé sur `NEXT_PUBLIC_APP_URL`. C'était la cause d'un bug critique corrigé le 22 juillet 2026
(liens publics et emails pointant vers le mauvais environnement).

### Plans et restrictions
```typescript
import { usePlan } from "@/hooks/usePlan"
import { PlanGuard } from "@/components/PlanGuard"

// Toute nouvelle feature Pro+ doit être protégée
<PlanGuard feature="notes">
  <NotesSeance />
</PlanGuard>
```
Plans : `essentiel` (29€, max 15 clients) / `professionnel` (59€, illimité) / `cabinet` (139€, V2 — grisé partout)

⚠️ **La limite de 15 clients (Essentiel) n'est pas techniquement bloquante** (diagnostic du
30/07) — ni sur le tunnel de réservation publique, ni sur l'API de création de patient. Elle
n'est appliquée qu'en soft-block UI (bouton "Nouveau client" masqué dans `clients/page.tsx`).
Décision produit : compensé par un système d'alerte email (voir section 11), pas par un blocage
réel. Ne pas supposer que `usePlan().maxClients` bloque quoi que ce soit — cette valeur n'est
que déclarative.

### Trial Stripe Billing
- Nouveaux inscrits → `plan = 'professionnel'` + `trial_ends_at = now + 14j`
- Après 14j sans paiement → downgrade vers `essentiel` via webhook Stripe
- Ne jamais modifier `plan` manuellement en dehors des webhooks Stripe (sauf offre fondateur,
  voir mémoire commerciale : 3 mois gratuits pour les 10 premiers clients, `trial_ends_at`
  modifié manuellement dans ce cas précis)
- **Upgrade pendant le trial (fix du 30/07)** : le bouton "Choisir Professionnel/Essentiel"
  déclenche une Checkout Session en **mode `setup`** (pas `subscription`) — elle ne sert qu'à
  enregistrer un moyen de paiement, le `priceId` cible est passé en `metadata`. Le webhook
  `checkout.session.completed` retrouve l'abonnement existant du customer et l'upgrade via
  `subscriptions.update(..., trial_end: "now", proration_behavior: "none")`, plutôt que de créer
  un second abonnement. **Avant ce fix, chaque upgrade créait un abonnement Stripe en doublon** —
  historique de bug à ne pas réintroduire si ce flow est retouché.
- `trial_ends_at` est resynchronisé (`null` si `status === 'active'`, sinon `trial_end` ISO) dans
  le handler `customer.subscription.updated`, en plus de `plan` et `stripe_subscription_id`.
- Nouveaux customers Stripe créés avec `preferred_locales: ['fr']` (`createStripeCustomerForSophrologue`,
  `src/lib/stripe/billing.ts`) — factures Stripe en français par défaut. Les comptes créés avant
  cette date restent en anglais sauf modification manuelle du customer dans Stripe Dashboard.
- **`getPriceIdToPlan()` lazy** (`src/lib/stripe/billing.ts`) : mapping price_id → plan lu depuis
  les env vars `STRIPE_PRICE_ESSENTIEL` / `STRIPE_PRICE_PROFESSIONNEL` / `STRIPE_PRICE_CABINET`,
  jamais hardcodé. Remplace un ancien mapping en dur (price_ids TEST codés en dur, qui faisait
  ignorer silencieusement les events webhook en PROD). Ne jamais réintroduire de map statique —
  TEST et LIVE ont des price_ids différents.
- **Pause / reprise self-service (Billing Portal)** : `trial_settings.end_behavior
  .missing_payment_method: "pause"` sur les abonnements — un sophrologue sans moyen de paiement à
  la fin du trial voit son abonnement passer en `paused` plutôt que d'échouer silencieusement. Le
  webhook sait retrouver un abonnement `paused` pour le reprendre après ajout de carte. Accès via
  `POST /api/stripe/billing-portal`. Flow confirmé fonctionnel en DEV (trial → suspension → ajout
  carte → reprise → paiement → plan synchronisé) — non encore revérifié avec les price_ids LIVE en
  PROD au moment d'écrire ces lignes, à valider au premier changement de formule d'un sophrologue réel.

### Stripe — deux secrets distincts
- `STRIPE_WEBHOOK_SECRET` est différent entre DEV et PROD
- Ne jamais utiliser la même valeur dans les deux environnements
- Le webhook est dans `src/app/api/stripe/webhook/route.ts`
- ⚠️ Vérifié le 30/07 : un environnement Stripe TEST peut avoir **plusieurs endpoints webhook**
  pointant vers la même URL si mal nettoyé (doublon constaté sur DEV) — vérifier
  Développeurs → Webhooks avant de diagnostiquer un event manquant, un endpoint fantôme sans
  trafic peut coexister avec le vrai.
- Le **branding Stripe** (logo, icône, couleurs `#1B3A2D`/`#426F59`) est un réglage **au niveau
  du compte**, pas dupliqué par mode Test/Live comme les clés API ou les webhooks — configuré une
  fois, actif dans les deux modes. Ne pas chercher à le reconfigurer séparément en Live après
  l'avoir fait en Test.

### Daily.co — deux comptes / deux clés (août 2026)
- Deux comptes séparés : `calymia-dev` (DEV) et `calymia-prod` (PROD) — même logique que Stripe
  TEST/LIVE. Ne jamais partager `DAILY_API_KEY` entre environnements.
- `DAILY_API_KEY` est **server-only** (jamais `NEXT_PUBLIC_*`), configurée séparément sur Vercel
  projet `calymia` et projet `calymia-prod`.
- Création de salle via `createDailyRoom()` (`src/lib/visio/daily.ts`) — voir section 6.
- ⚠️ **TODO opérationnel non résolu** : aucun des deux comptes Daily.co n'a de carte bancaire
  enregistrée. Sans CB, la création de salle via l'API fonctionne, mais le *join* échoue avec
  « Missing payment method ». Action requise : ajouter une CB sur **les deux** comptes (DEV et
  PROD) dans Daily Dashboard → Billing (15$ de crédit offert à l'ajout) avant que la feature
  soit utilisable de bout en bout, y compris en PROD.

### Client Supabase
```typescript
// Côté client (composants "use client")
import { createSupabaseBrowserClient } from "@/lib/supabase/client"

// Côté serveur (API routes, Server Components)
import { createClient } from "@supabase/supabase-js"
// avec SUPABASE_SERVICE_ROLE_KEY pour les opérations admin
```

### Performance — session partagée (22 juillet 2026)
Utiliser `getSophrologueSession()` (`src/lib/auth/sophrologue-session.ts`, avec `cache()`
React) plutôt que d'appeler `getUser()` plusieurs fois dans une même requête. Les pages
protégées lourdes doivent être des Server Components avec fetch SSR plutôt que des
`useEffect` côté client — a permis de faire passer la page Agenda de 2,88s à ~1,1s.

⚠️ **Attention Vercel serverless** : le fire-and-forget async (`waitUntil`) ne fonctionne
que s'il est appelé directement depuis un Request handler, pas depuis une fonction utilitaire.
Dans les fonctions cron, utiliser des `await` explicites. Pour les traitements best-effort qui
ne doivent **jamais** bloquer la réponse principale (ex: alerte limite clients après paiement),
préférer un `await` explicite enveloppé dans son propre `try/catch` local plutôt que `waitUntil`
seul — voir section 11.

### ISR et données temps réel — pattern établi (27 juillet 2026)
Une page publique en ISR (`export const revalidate = 3600`) peut afficher des données figées
pendant toute la durée du cache. Si une donnée doit rester temps réel (ex: prochain créneau
disponible) alors que le reste de la page peut rester en cache, **ne pas** baisser le
`revalidate` global de la page — isoler la donnée dans un Client Component dédié qui fetch une
route API `force-dynamic` à chaque affichage. Exemple : `ProchainCreneauBadge.tsx` +
`/api/public/prochain-creneau/route.ts`. Voir section 10 pour le contexte complet.

---

## 6. Patterns établis

### Score de complétude du profil (mis à jour 21 août 2026)
- Calcul dans `src/lib/profile-score.ts` — fonction `computeProfileScore(sophrologue, supabase)`,
  barème statique `PROFILE_SCORE_CRITERIA`
- **8 critères, max dynamique `PROFILE_SCORE_MAX`** = somme des poids réels (`points ?? 10`),
  dérivée par `.reduce()` sur le tableau des critères — **plus de `100` codé en dur** depuis le
  21/08 (voir ci-dessous, chantier RPPS → RNCP)
  - Actuellement 90 pts : 7 critères × 10 pts + 1 critère "Horaires" × 20 pts (fusion des anciens
    critères séparés `disponibilites` + `horaires` — la table `disponibilites` n'étant plus lue
    nulle part, ce critère unique se base sur `hasHorairesContenu(normalizeHoraires(...))`)
- Critères actuels : photo_url, bio (>50 chars), specialites, types_seances actifs, horaires JSONB
  (20 pts), photos_cabinet, formations, syndicats
- `ProfileScoreCard.tsx` consomme `PROFILE_SCORE_MAX` (jamais `100` en dur) : "complet" si
  `score >= PROFILE_SCORE_MAX`, pourcentage affiché = `Math.round(score / PROFILE_SCORE_MAX * 100)`
- Affiché dans le dashboard via `ProfileScoreCardWrapper` (Client Component) → `ProfileScoreCard`
- Liens directs vers `/parametres?tab={profil|seances|disponibilites|vitrine}` — ⚠️ **pas**
  `/dashboard/parametres` (bug corrigé le 24 juillet 2026 : `/parametres` est un sibling de
  `/dashboard`, pas un sous-dossier)
- `SophrologueRow` : type structurel défini dans `profile-score.ts` (pas de type centralisé pour l'instant)

⚠️ **Historique** : le critère `numero_rpps` (10 pts, catégorie Confiance) a été **retiré sans
remplacement** le 21/08 — RPPS est un identifiant réservé aux professions de santé réglementées,
ne concernait pas les sophrologues (voir "Certification RNCP" ci-dessous). Le nouveau champ
`certification_rncp` est un booléen de filtre pour un futur annuaire, pas un critère de score —
décision volontaire de ne pas le réintégrer dans le calcul.

### Certification RNCP (21 août 2026 — remplace RPPS)
- `sophrologues.certification_rncp boolean NOT NULL DEFAULT false` — remplace `numero_rpps`
  (colonne supprimée). Décision : RNCP identifie un **titre/diplôme**, pas un praticien (contrairement
  à RPPS) ; deux sophrologues peuvent partager le même code RNCP. Un simple booléen déclaratif
  suffit — pas de champ numérique.
- Checkbox "Je détiens une certification reconnue RNCP" dans l'onboarding étape 1 et Paramètres →
  Profil (même emplacement que l'ancien champ RPPS)
- Page publique : pill verte "✓ Certification RNCP" (même bloc que le SIRET, composant
  `SophrologueInfoLine.tsx` pour le SIRET uniquement — le badge RNCP est un élément séparé, pas
  une ligne texte+infobulle)
- Le détail (école, code RNCP, année) reste en texte libre dans la colonne `formations` existante
  — pas de duplication, pas de nouveau champ texte
- **N'entre pas dans le score de complétude du profil** (voir ci-dessus) — sert de futur filtre
  d'annuaire sophrologues (V2), pas de critère de confiance
- **JSON-LD non enrichi** pour ce champ — décision volontaire tant que l'annuaire n'existe pas
  (voir JSON-LD ci-dessous)

### Facture PDF séance — redesign complet (30 juillet 2026)
- Générée dans `src/lib/factures/generate.tsx` via `@react-pdf/renderer`, déclenchée par le
  webhook `payment_intent.succeeded`
- **Identité visuelle Calymia** : fond crème `#FAF8F5`, vert foncé `#1B3A2D` / vert moyen
  `#426F59`, polices **Playfair Display** (titres, "Facture", Total TTC) + **DM Sans** (corps) —
  fichiers `.ttf` committés dans `src/lib/factures/fonts/` et enregistrés via `Font.register()`,
  **jamais de fetch réseau Google Fonts au moment du render** (fiabilité webhook)
- **Le sophrologue est le vendeur légal**, pas Calymia — modèle de mandat de facturation
  (comme Uber/Deliveroo) : encadré mentionnant "Facture éditée par KLS3 SARL (SIRET
  949 563 340 00015, 14 allée du Fairway, 57200 Sarreguemines), pour le compte et au nom de
  {sophrologue}, dans le cadre du mandat de facturation Calymia"
- Ligne SIRET affichée dans le bloc vendeur **uniquement si `sophrologues.siret` est renseigné**
  (champ optionnel, ajouté dans Paramètres → Mon profil, **pas** dans l'onboarding — décision
  volontaire pour ne pas alourdir l'inscription)
- Mention TVA : `MENTION_TVA` constante ("TVA non applicable, art. 293 B du CGI") — hypothèse
  par défaut (auto-entrepreneur sous seuil), pas encore configurable par sophrologue
- Stockée dans bucket `factures`, URL sauvegardée dans `paiements.facture_url` — voir écart
  public/privé signalé section 4
- Accessible au sophrologue via `<BoutonFacture seanceId={...} />`, dans l'espace client
  (`/patient`), et en pièce jointe de l'email de confirmation
- Email sophrologue inclut le lien facture après chaque paiement réussi
- Email client inclut les coordonnées du sophrologue (tél, email, adresse) dans un encadré vert

### Facturation abonnement Stripe Billing (31 juillet 2026)
- Distincte de la facture séance ci-dessus : ici **Calymia (KLS3 SARL) est le vrai vendeur**
  (vente directe B2B), les factures sont **générées nativement par Stripe Invoicing** — aucun
  code Calymia ne les construit
- Branding configuré côté Stripe Dashboard (logo, couleurs) — voir section 5
- `InvoiceHistoryTable.tsx` sur `/dashboard/abonnement` affiche jusqu'à 12 dernières factures
  avec lien de téléchargement direct (`invoice_pdf`), sans obliger le sophrologue à passer par
  le Billing Portal juste pour consulter — route `GET /api/stripe/invoices`. Retourne liste vide
  (pas d'erreur) si `stripe_customer_id` est absent.

### Alerte dépassement limite clients (31 juillet 2026)
- Contexte : la limite 15 clients (plan Essentiel) n'est pas bloquante techniquement (voir
  section 5) — compensée par une notification, pas un blocage
- `checkEtNotifierDepassementLimite(sophrologueId)` dans `src/lib/notifications/limite-clients-alerte.ts` :
  ignore si `plan !== 'essentiel'`, si `count < 16`, ou si `limite_clients_alerte_envoyee_at`
  déjà renseigné (un seul envoi par dépassement)
  - Email au sophrologue (from `bonjour@calymia.com`)
  - Email interne à `eric@calymia.com`, `lilian@calymia.com`, `bonjour@calymia.com` pour relance
    commerciale manuelle
  - Marque `limite_clients_alerte_envoyee_at = now()` après envoi
- Déclencheurs (fire-and-forget isolé, jamais bloquant) : après création d'une **nouvelle** fiche
  patient dans `create-payment-intent/route.ts` **et** dans `patients/create/route.ts` — pas
  déclenché si une fiche existante est réutilisée (voir modèle d'identité client, section 4)
- Reset de `limite_clients_alerte_envoyee_at` à `null` dans le webhook Stripe quand un
  sophrologue redescend en `essentiel` depuis un plan supérieur
- **Piste V2/V3 notée mais non retenue pour le lancement** : facturation à l'usage
  (Stripe metered billing) au-delà de 15 clients, à envisager une fois du volume réel

### Visioconférence — Daily.co (août 2026)
- `types_seances.mode` : `'presentiel'` | `'visio'` (défaut `presentiel`), migration
  `supabase/migrations/20260810180000_types_seances_mode.sql`
- **`seances.lien_teleconsultation`** : lien de la salle pour la séance — **activement lu et
  écrit** (plus un champ legacy / dead code). Rempli à la confirmation de paiement, régénérable
  depuis l'agenda.
- **`sophrologues.lien_teleconsultation`** : fallback profil si `createDailyRoom()` échoue —
  plus un champ orphelin non branché (éditable dans Paramètres → profil).
- Génération : `createDailyRoom()` dans `src/lib/visio/daily.ts`, appelée depuis le webhook
  `payment_intent.succeeded` dans un `try/catch` isolé — **jamais bloquante** pour la
  confirmation du paiement. Régénération manuelle : `POST /api/seances/[id]/regenerer-visio`.
- Diffusion du lien : email confirmation client + sophrologue, rappel J-1 (`/api/cron/rappels-j1`),
  dashboard agenda (badge « Visio » + boutons Copier / Régénérer dans `SeancesCalendar`).
- Tunnel réservation : rappel anti-spam à l'étape 5 (confirmation finale), **uniquement** pour
  les séances `mode === 'visio'`.
- Infra / TODO CB : voir section 5 (Daily.co) — sans moyen de paiement sur les comptes Daily,
  le *join* échoue malgré une création de salle réussie.

### Google Agenda V1 (US-34, livré 19 août 2026)
- Sync **push uniquement** (Calymia → Google), pas encore bidirectionnelle — noté comme évolution
  future, pas dans le scope V1
- Table `google_calendar_connections` (migration `20260814120000_...sql`) : tokens OAuth chiffrés
  **AES-256-GCM**, jamais en clair en base
- OAuth : `src/lib/google/oauth.ts` + routes `POST /api/google/oauth/start|callback|disconnect`.
  Scopes : `calendar.events`, `calendar.calendarlist`, `calendar.app.created`, `calendar.freebusy`
- À la confirmation du paiement (webhook `payment_intent.succeeded`), `upsertSeanceEvent()` pousse
  la séance confirmée vers un calendrier secondaire "Calymia" dédié — jamais sur le calendrier
  principal du sophrologue
- **Deux niveaux de vérification FreeBusy** :
  - **Souple (affichage)** : `getBusyIntervals()`, utilisé par le tunnel de réservation et le badge
    "prochain créneau" (`/api/public/google-busy`) — best-effort, `[]` en cas d'échec (fail-soft)
  - **Strict (avant paiement)** : `assertPrimaryCalendarSlotAvailable()`, appelé dans
    `bloquer-creneau` et `create-payment-intent` — bloque **uniquement cette réservation**
    (409 sur conflit détecté, 503 si erreur Google), jamais toute la page (fail-explicit)
- UI : onglet Paramètres → Intégrations (5ᵉ onglet, voir section 3)
- Vérification Google : app approuvée (~24h de délai, confirmé le 19/08)

### JSON-LD — `ProfessionalService` + `Person` imbriqué (SEO)
- Page publique sophrologue : `@type: ProfessionalService`, avec un `Person` imbriqué via
  `employee` (`jobTitle: "Sophrologue"`, etc.) — validé par Google Rich Results Test
- Décision volontaire : **ne pas enrichir ce JSON-LD avec `certification_rncp`** tant que
  l'annuaire filtrable n'existe pas (voir "Certification RNCP" ci-dessus) — un booléen sans détail
  structuré n'apporte rien en `hasCredential`
- Si `afficher_email`/`afficher_telephone` sont activés (opt-in, voir "Page publique — champs
  affichés"), ces coordonnées apparaissent aussi dans le `Person`

### `robots.ts` / `sitemap.ts` dynamiques (SEO technique)
- `src/app/robots.ts` et `src/app/sitemap.ts` sont dynamiques, protégés par un guard
  `isProductionSite()` (`src/lib/config/site-url.ts`, teste `getSiteUrl() === "https://app.calymia.com"`)
- **Hors PROD** : `Disallow: /` et sitemap vide (empêche l'indexation de `calymia.vercel.app`)
- **En PROD** : sitemap liste tous les profils `actif=true`, soumis à Search Console
- ⚠️ Point de vigilance : ce guard compare `getSiteUrl()` à `app.calymia.com` en dur pour
  **détecter l'environnement**, ce qui est différent de la règle "ne jamais hardcoder
  `app.calymia.com`" (section 5, URLs) qui concerne la **construction de liens**. Les deux usages
  ne se contredisent pas mais peuvent porter à confusion — garder la distinction en tête.

### GA4 + consentement RGPD (Google Analytics)
- Bannière de consentement (`CookieConsentBanner`, Accepter/Refuser) + `GoogleAnalytics` dans
  `layout.tsx`, tous deux chargés **PROD only** via `isProductionSite()`
- Choix stocké en `localStorage`, clé `calymia_cookie_consent` (`src/lib/analytics/cookie-consent.ts`)
- GA4 (`G-XZQPVRGT3P`) ne se charge jamais hors PROD ni avant acceptation ; retrait du consentement
  → rechargement de page
- Config centralisée dans `src/lib/analytics/config.ts`

### Tracking UTM
- Composant `UtmCapture.tsx` ("use client") sur la page publique sophrologue, capture les
  paramètres UTM de l'URL d'arrivée
- Stockage en `sessionStorage`, clé `calymia_utm_params` (`src/lib/utm.ts`) — sert le suivi de
  conversion (canal d'acquisition → inscription)

### Avis clients (US-33, livré)
- Table `avis` (migration `20260529120000_avis.sql`), colonne `communications.type` incluait déjà
  `avis` en base avant même le fichier de migration d'origine (écart base/repo à garder en tête,
  voir section 4)
- **Pro+ uniquement** : le cron `post-seance` (20h UTC) génère un token unique et envoie le lien
  d'avis, **skip explicite pour le plan `essentiel`**
- Formulaire public `/avis/[token]` (accès par token, pas d'auth)
- Modération sophrologue : `/dashboard/avis` (approuver/masquer), `POST /api/avis/moderer`
- Affichage public : `AvisPublicList.tsx` sur la page publique sophrologue

### Reset mot de passe — callback PKCE (fix août 2026)
- Symptôme : lien email de reset → `/auth/callback` → redirection incorrecte vers `/dashboard`
  au lieu de `/reinitialiser-mot-de-passe`.
- Cause : le callback ne routait que sur `type=recovery`, paramètre **jamais posé** par
  `resetPasswordForEmail()` sur l'URL de retour PKCE.
- Fix : `redirectTo` de `resetPasswordForEmail()` inclut `next=/reinitialiser-mot-de-passe`
  (`src/app/mot-de-passe-oublie/page.tsx`) ; le callback (`src/app/auth/callback/route.ts`)
  lit `next` en priorité, conserve `type === "recovery"` en fallback.
- Déployé et validé en DEV et PROD.

### Horaires — source unique `sophrologues.horaires` (27 juillet 2026)
**Historique du bug** : jusqu'au 27/07, l'onboarding écrivait dans `disponibilites` (créneaux
bookables) tandis que l'onglet Paramètres → Cabinet/vitrine écrivait dans `horaires` (JSONB,
affiché sur la page publique). Aucun des deux ne réécrivait l'autre après l'inscription initiale
→ un sophrologue modifiant ses horaires après l'onboarding voyait son affichage changer sans que
le tunnel de réservation ni le badge "prochain créneau" ne suivent (créneaux "fantômes" ou horaires
affichés comme fermés mais réservables quand même).

- **`sophrologues.horaires` (JSONB) est désormais l'unique source de vérité**, à la fois pour
  l'affichage ET pour le calcul des créneaux réservables.
- `dispoByJsDayFromHoraires(horaires)` (`src/lib/horaires.ts`) convertit le JSONB en
  `Map<jsDay, DispoWindow[]>`, réutilisée par `compute-next-slot.ts` (badge) et `reserver/page.tsx`
  (tunnel).
- `resolvePublicHoraires()` existe toujours dans `src/lib/horaires.ts` mais n'est plus appelée
  (code mort, repli legacy sur `disponibilites`) — à nettoyer un jour.
- La table `disponibilites` n'est plus écrite ni lue nulle part dans l'app. Elle reste en base,
  non supprimée, en cas de besoin futur.
- L'onboarding étape 3 écrit désormais `horaires` via `/api/sophrologue/update` (au lieu de
  `disponibilites` via `/api/sophrologue/disponibilites`) ; le délai minimum de réservation reste
  géré séparément via ce dernier endpoint avec `{ delaiOnly: true }`.
- **Pas de grille des créneaux passé de 15 à 30 minutes** : constante partagée
  `SLOT_GRID_STEP_MS` extraite dans `src/lib/booking/slots.ts`, utilisée à la fois par
  `reserver/page.tsx` (tunnel) et `compute-next-slot.ts` (badge), pour éviter toute désynchronisation.
- **Le badge "prochain créneau"** sur la page publique est un Client Component dédié
  (`ProchainCreneauBadge.tsx`, route `/api/public/prochain-creneau`, `force-dynamic`) — la page
  publique elle-même reste en ISR (`revalidate: 3600`), mais ce badge recalcule en temps réel à
  chaque affichage pour ne jamais être désynchronisé du cache de la page.
- **Script de migration disponible** (non exécuté en PROD, aucun compte concerné au 27/07) :
  `scripts/migrate-horaires-from-disponibilites.ts` — reconstruit `horaires` depuis
  `disponibilites` pour tout compte où `horaires` est vide, en dry-run par défaut (`--apply`
  pour écrire). À lancer avant toute mise en prod si de nouveaux comptes historiques apparaissent
  avec `horaires` vide.
- **Ne jamais afficher les horaires dans l'onboarding étape 4 (vitrine)** — supprimé car redondant
  avec étape 3.

### Page publique — champs affichés
- `certification_rncp` : pill "✓ Certification RNCP" au-dessus de la section photos cabinet, dans
  le même bloc que le SIRET, uniquement si `true` (remplace l'ancien affichage `numero_rpps` —
  voir section 6)
- Tél, email, adresse : **masqués par défaut** — affichage conditionné à l'opt-in `afficher_email`
  / `afficher_telephone` (colonnes ajoutées sur `sophrologues`) réglable dans Paramètres → Vitrine.
  Par défaut ces coordonnées restent masquées (force la réservation en ligne, protège la commission
  3%) ; si le sophrologue active l'opt-in, elles apparaissent aussi dans le JSON-LD `Person`
- Ces coordonnées sont dans tous les cas transmises dans l'email de confirmation client
- URL publique affichée dans l'onboarding étape 5 (confirmation) ET dans l'email de bienvenue

### Statut trial Stripe
- Colonne utilisée : `trial_ends_at` (timestamp) sur la table `sophrologues` — pas de `stripe_status` en base
- Colonne `essai_expire_at` : ancienne colonne, ignorée — utiliser uniquement `trial_ends_at`
- Module centralisé : `src/lib/billing/trial-status.ts` avec `computeTrialDaysRemaining()` et `getSidebarPlanBadge()`
- Logique :
  - `trial_ends_at > now` → trial actif → badge vert "Essai gratuit — Xj"
  - Trial terminé + `plan === 'essentiel'` → "Essai expiré" badge rouge
  - Sinon → nom du plan (Essentiel / Professionnel / Cabinet)
- `usePlan()` ne gère que les feature flags — ne pas y ajouter la logique trial
- La sidebar charge `trial_ends_at` dans sa propre requête Supabase
- Voir section 5 pour le fix du 30/07 sur l'upgrade pendant le trial (mode `setup`)

### Création manuelle de séance (chantier complet, 24 août 2026)
Permet au sophrologue de créer une séance depuis son dashboard suite à un contact client hors
plateforme (email/SMS/WhatsApp) — pas d'intégration WhatsApp/email/SMS, copier-coller manuel
uniquement. Livré en 4 étapes + 1 KPI + 3 correctifs post-tests, tout en PROD.

**Schéma (migrations du 24/08)** :
- `patients.email` devient **nullable** (un contact WhatsApp/SMS n'a pas toujours d'email)
- `seances.montant_declare numeric(10,2)` — montant perçu hors plateforme, purement déclaratif,
  jamais vérifié, **jamais utilisé pour la commission Calymia**
- `seances.token_paiement_manuel text` (index unique partiel) — pour le lien de paiement différé
- `seances.origine` : `'manuelle'` déjà couverte par la contrainte `seances_origine_check`
  existante (pas de migration nécessaire sur ce point précis)
- `communications_type_check` étendue deux fois : `'lien_paiement_manuel'` puis
  `'confirmation_seance_manuelle'`

**`POST /api/seances/create`** — nouvelle route, ne réutilise pas `bloquer-creneau` (hold 15 min
sans patient, pas adapté). Logique : valide le type de séance (tarif **toujours** lu depuis
`types_seances`, jamais du payload client), résout le patient (lookup email/téléphone sur ce
`sophrologue_id`, ne réécrit jamais une fiche existante, création à la volée si besoin — email
optionnel désormais), vérifie les conflits (overlap Calymia + `assertPrimaryCalendarSlotAvailable()`
strict, jamais contourné même en création manuelle). Deux branches selon `mode_reglement` :
- **`hors_plateforme`** : `statut: "confirmee"` immédiat, `montant_declare` (saisi ou tarif par
  défaut). Visio (`createDailyRoom`) + push Google Agenda (`upsertSeanceEvent`) déclenchés
  **à la création**, chacun dans un `try/catch` isolé (jamais bloquant). Email de confirmation
  client (`confirmationSeanceManuelle`, voir plus bas) si le patient a un email.
  **Dates passées autorisées** — cas légitime : rattraper la saisie d'une séance déjà réalisée.
- **`lien_en_ligne`** : `statut: "en_attente"`, `expire_at: now + 7 jours` (constante
  `MANUAL_LINK_EXPIRY_DAYS`), token unique généré, email avec lien vers `/paiement/[token]`.
  **Email obligatoire** pour ce mode (400 explicite sinon). **Dates passées interdites**
  (400 explicite : "Impossible de créer une séance dans le passé avec paiement en ligne") —
  n'a pas de sens de bloquer un créneau ou d'envoyer un lien de paiement pour une séance déjà passée.

**Page publique `/paiement/[token]`** (`noindex`, SSR) — `GET /api/public/paiement-manuel/[token]`
pour l'affichage (4 états : introuvable / expiré / déjà payé / en attente), `POST
.../create-intent` pour générer le `PaymentIntent` (mêmes metadata que le tunnel classique).
Réutilise **`PaymentForm` tel quel** (déjà découplé du tunnel, props `{ amount, clientSecret,
seanceId, onSuccess }`) — pas de nouveau composant de paiement. Le webhook
`payment_intent.succeeded` existant n'a pas eu besoin d'être modifié : il traite déjà n'importe
quelle séance via `metadata.seance_id`, peu importe son `origine`.

**`NouveauSeanceModal.tsx`** (`src/components/seances/`, extrait pour ne pas alourdir
`SeancesCalendar.tsx`) — bouton "Nouvelle séance" dans le header agenda. Deux onglets : "Remplir
manuellement" / "Coller un message client". Recherche/sélection patient existant + création à la
volée (email optionnel, contrairement à l'ancien modal `Mes clients`). Rafraîchissement agenda
après création : `loadSeances(...)` (pas de mutation locale, la séance n'existe pas encore dans
le state), avec navigation automatique vers la semaine du créneau si hors de la semaine affichée.
Bandeau ambre "Vous enregistrez une séance dans le passé." sous les champs Date/Heure dès que
`isPastSlot()` est vrai, indépendamment du mode de règlement.

**Extraction Claude** (`src/lib/ai/extract-seance-from-message.ts`) — même squelette que
`classify-specialites.ts` (fetch brut, `claude-sonnet-5`) mais **ne reste jamais silencieuse**
(appelée en direct depuis l'UI, pas via `after()`) : retourne toujours `{ ok: true, ... }` ou
`{ ok: false, error }`. `thinking: { type: "disabled" }` **obligatoire** — sans ça, Sonnet 5
consomme son budget de tokens dans le raisonnement interne et l'extraction JSON reste vide.
Dates relatives ("jeudi prochain") résolues via `nowIso` (Europe/Paris) passé explicitement dans
le prompt. `type_seance_id` hors whitelist forcé à `null`, jamais halluciné. **Le texte brut du
message n'est jamais stocké ni loggé** (peut contenir des données de santé) — logs limités à la
longueur du texte et au code d'erreur. Pré-remplit le formulaire avec un liseré "détecté — à
vérifier" par champ ; le sophrologue reste seul maître de la soumission finale.

**Cron post-séance — filtre anti-spam (24/08)** : `src/app/api/cron/post-seance/route.ts` (n8n,
`*/15 * * * *`, deux passes : "merci pour votre séance" puis "demande d'avis" 24h après) ne
filtrait à l'origine ni sur `origine` ni sur l'ancienneté de la création. Une séance manuelle
très rétroactive (rattrapage de plusieurs jours/semaines) était donc éligible dès le tick
suivant sa création, déclenchant les deux passes en quelques minutes — spam pour le client, en
plus de l'email de confirmation immédiat. Correctif : `MAX_CREATION_DELAY_AFTER_SEANCE_HOURS = 48`,
appliqué en filtre applicatif (JS, pas de colonne générée) sur les deux passes — une séance dont
`created_at` dépasse 48h après `fin_at` est exclue du cron (reste un enregistrement historique,
seul l'email de création a été envoyé). Dates invalides/`created_at` absent → laissé passer
(fail-open, pour ne jamais casser un cas légitime par erreur).

**Nouveau template email** `confirmationSeanceManuelle` (`src/lib/emails/templates.ts`) — envoyé
au patient à la création d'une séance hors plateforme (si email dispo). Volontairement différent
de `confirmationReservation` : pas de politique d'annulation, pas de lien facture, lien visio
seulement si pertinent. Objet et corps : "Votre séance a été **enregistrée**..." — le mot
"notée" a été évité (collision avec la fonctionnalité Avis clients, où le client note
littéralement sa séance).

**KPI dashboard "CA total déclaré"** — 5e carte dans `src/app/(auth)/dashboard/page.tsx` (grille
`lg:grid-cols-3`, 3+2). `CA net` (existant) + somme de `seances.montant_declare` (`statut =
confirmee`, `origine = manuelle`, non null) sur le mois calendaire Paris. Comptabilisé au statut
`confirmee`, pas `terminee` — cohérent avec "CA net" qui compte dès la confirmation du paiement,
pas à la réalisation effective. ⚠️ Mélange deux colonnes de date par nécessité : `paiements.created_at`
pour la partie CA net, `seances.debut_at` pour la partie déclarée (pas de ligne `paiements` pour
une séance hors plateforme) — commenté explicitement dans le code pour ne pas être relu comme un bug.

### Reçu PDF pour les séances hors plateforme (24 août 2026)
Distinct de la facture — les séances `origine = 'manuelle'` avec un `montant_declare` (hors
plateforme) n'ont pas de ligne `paiements`, donc pas de vraie transaction vérifiée. Générer une
"facture" avec l'habillage officiel actuel (mandat KLS3, SIRET, TVA) aurait engagé KLS3 sur un
montant purement déclaratif — décision : un document séparé, plus simple, non fiscal.

- **`src/lib/recus/generate.tsx`** (nouveau module, ne touche pas `src/lib/factures/`) — réutilise
  les polices déjà committées (`src/lib/factures/fonts/*.ttf`, Playfair Display + DM Sans) et la
  palette de couleurs, mais contenu dédié : titre "Reçu", numérotation `REC-AAAA-xxxxx` (jamais
  `CAL-`), pas de carte Vendeur/SIRET/mandat, un seul "Montant déclaré" (pas de TVA/HT-TTC), et
  un bandeau d'avertissement explicite ("récapitulatif fourni par le praticien, pas une facture
  émise par Calymia, montant non vérifié")
- `seances.recu_url text` (nullable) — persistance séparée de `paiements.facture_url`
- `POST /api/recus/generer` : génère à la demande (pas automatique comme la facture au paiement),
  upload dans le bucket Storage `factures` existant, sous-chemin `recus/`
- `BoutonRecu.tsx` (`src/components/seances/`) : génère au clic si `recu_url` est absent, sinon
  télécharge directement — contrairement à `BoutonFacture` qui n'a jamais de logique de génération
- **`BoutonFacture` renommé** : "Télécharger le reçu" → "Télécharger la facture", pour lever
  l'ambiguïté avec le nouveau bouton reçu (les deux ne doivent jamais porter le même libellé)
- Affiché à deux endroits : drawer de l'agenda (`SeancesCalendar.tsx`) et historique de la fiche
  client (`src/app/(auth)/clients/[id]/page.tsx`) — ce dernier a son **propre** type `Seance`
  local et son propre `.select()`, distincts de `src/components/seances/types.ts` ; toute future
  évolution touchant les séances doit vérifier les deux endroits séparément (piège déjà rencontré
  deux fois dans ce chantier — `stubSeance()` dans `NouveauSeanceModal.tsx` et cette fiche client
  ont chacun leur propre construction d'objet `Seance`, pas de source unique)
- Label "· Séance manuelle" ajouté sous le type de séance (drawer agenda ET fiche client),
  visible dès que `origine === 'manuelle'`, indépendamment du mode de règlement. Le montant du
  mode hors plateforme s'affiche **sans** qualificatif ("Hors plateforme — 60.00 €", pas "...
  déclarés") pour éviter la redondance avec ce label

⚠️ **Incident PROD résolu (24/08)** : bucket Storage nommé `factures` sur DEV mais `invoices` sur
PROD — écart jamais détecté auparavant car aucune facture n'avait encore été générée en PROD
(`SELECT count(*) FROM paiements WHERE facture_url IS NOT NULL` = 0 au moment de l'incident).
Résolu en supprimant `invoices` (vide, sans risque) et recréant `factures` (public) en PROD.
**Leçon** : les noms de bucket Storage ne sont jamais garantis identiques entre DEV et PROD s'ils
ont été créés manuellement dans l'UI Supabase plutôt que documentés/scriptés — un audit de
config Storage (buckets, policies) entre les deux environnements est à prévoir avant le prochain
chantier qui introduit un nouveau bucket ou réutilise un bucket existant pour la première fois
en conditions réelles PROD.

### Suppression d'un compte sophrologue en base (ordre FK)
```sql
DO $$
DECLARE
  v_sophrologue_id UUID;
BEGIN
  SELECT id INTO v_sophrologue_id
  FROM sophrologues
  WHERE user_id = '...'; -- remplacer par le user_id

  DELETE FROM seance_notes WHERE sophrologue_id = v_sophrologue_id;
  DELETE FROM communications WHERE sophrologue_id = v_sophrologue_id;
  DELETE FROM email_templates WHERE sophrologue_id = v_sophrologue_id;
  DELETE FROM paiements WHERE seance_id IN (SELECT id FROM seances WHERE sophrologue_id = v_sophrologue_id);
  DELETE FROM seances WHERE sophrologue_id = v_sophrologue_id;
  DELETE FROM disponibilites WHERE sophrologue_id = v_sophrologue_id;
  DELETE FROM types_seances WHERE sophrologue_id = v_sophrologue_id;
  DELETE FROM parametres_cabinet WHERE sophrologue_id = v_sophrologue_id;
  DELETE FROM patients WHERE sophrologue_id = v_sophrologue_id;
  DELETE FROM sophrologues WHERE id = v_sophrologue_id;
END $$;
-- Puis supprimer l'user dans Supabase → Authentication → Users
-- Et supprimer les fichiers Storage : buckets avatars, cabinet-photos, factures
```
⚠️ Un bloc `DO $$ ... END $$;` renvoie toujours "Success. No rows returned", que la suppression
ait réellement eu lieu ou non (ex: `slug`/`user_id` ne correspondant à rien) — **toujours
vérifier après coup** avec un `SELECT` de confirmation, ne jamais se fier au seul message de
succès du bloc `DO`.

Pour supprimer un patient/client (pas un compte sophrologue), utiliser la RPC
`delete_patient_cascade` plutôt que de reproduire cette séquence manuellement (voir section 3 et 4).

### n8n — workflows déployés sur Hetzner (`automation.kls3-dev.com`)
| Workflow | Déclencheur | Action |
|---|---|---|
| `rappels-j1` | Cron 17h UTC | Emails rappel J-1 aux clients (inclut lien visio si `mode === 'visio'`) |
| `post-seance` | Cron 20h UTC | Emails post-séance + lien avis (Pro+) |
| `cleanup-seances` | Cron /15min | Supprime séances en_attente expirées |
| `génération-articles` | Manuel | Génère articles blog via Claude API + WordPress |
| `génération-sujets-blog` | Cron dimanche | Génère liste sujets hebdomadaire |
| `prospection-google-places` | Manuel | Recherche sophrologues via Google Places API → Google Sheet |

Les workflows appellent les endpoints `/api/cron/*` avec un Bearer token (`CRON_SECRET`).
**Ne jamais modifier les endpoints cron sans mettre à jour les workflows n8n.**
Exports JSON dans `n8n-workflows/` (prod), `n8n-workflows/Dev/` (dev), `n8n-workflows/Prospection/` (prospection).
⚠️ En attente : `Génération Articles Blog v14` et `Génération Sujets Blog v3` existent sur n8n
mais ne sont pas encore poussés vers ce dossier. Nœud email récap Resend dans "Génération Sujets
Blog" (envoi dimanche de la liste des sujets générés) encore à terminer — priorité basse.

### URLs publiques
```
calymia.com/sophrologues/{dept}/{ville}/{slug}
Exemple : calymia.com/sophrologues/57-moselle/sarreguemines/marie-dupont-sophrologue
```
Toujours utiliser `NEXT_PUBLIC_APP_URL` — jamais hardcoder `app.calymia.com` ou `calymia.vercel.app`.

---

## 7. Comptes de test (DEV uniquement — calymia.vercel.app)

**Mot de passe universel : `Test123456!`**

> ⚠️ Les données de test sont à recréer après chaque purge de la base DEV.
> Utiliser des emails réels accessibles à Eric pour recevoir les emails de test.

Comptes sophrologues DEV actifs au 31/07 : Sophie Marchand, Thomas Petit, Eric Test, Lilian
SCARPINO — tous avec `stripe_customer_id` valide. Compte legacy `eri-scarpino-sarreguemines`
**supprimé en PROD le 31 juillet 2026**.

Toujours nettoyer les données de test créées (patients, séances, paiements, communications) en
respectant l'ordre FK — voir section 6 pour l'ordre exact et le piège du message "Success. No
rows returned".

---

## 8. Identité client canonique (24 juillet 2026)

Un client peut réserver chez plusieurs sophrologues sous le même compte. Modèle retenu :
- La fiche `patients` avec `sophrologue_id IS NULL` est la fiche **canonique** — c'est elle
  qui fait autorité sur `prenom`/`nom`/`telephone`, et c'est elle qu'affiche l'espace client.
- Les fiches `patients` avec un `sophrologue_id` renseigné sont des rattachements par cabinet.
  Elles ne doivent plus être une source d'identité concurrente.
- Dans le tunnel de réservation (`reserver/page.tsx`), un client qui se connecte en inline
  (email détecté existant + mot de passe, via `handleInlineLogin`) voit ses champs
  Prénom/Nom/Téléphone pré-remplis depuis la fiche canonique **et verrouillés** (`readOnly`)
  — il ne peut plus les écraser.
- Une réservation chez un sophrologue jamais vu par ce client reprend l'identité canonique
  si elle existe (`create-payment-intent/route.ts`, branche `else`), au lieu des valeurs
  du formulaire.
- Une fiche patient **existante** pour un couple (email, sophrologue_id) n'est plus jamais
  écrasée sur `prenom`/`nom`/`telephone` par une réservation ultérieure — seul `user_id`
  peut encore être complété s'il manquait.
- Un client **non connecté** (checkout via "Continuer sans connexion") garde le comportement
  d'origine : les valeurs saisies dans le formulaire font foi, aucun verrouillage.
- ⚠️ Conséquence pratique pour les tests (constatée le 31/07) : réserver avec un email déjà
  utilisé chez le **même** sophrologue **réutilise** la fiche patient existante et ne crée pas
  de nouveau `patients.id` — important à savoir si un test dépend du comptage du nombre de
  clients (ex: alerte limite clients, section 6).

✅ **Résolu le 27 juillet 2026** — voir section 10 pour le détail du fix `cn()`/`tailwind-merge`
(qui touchait notamment les champs readOnly de ce même tunnel de réservation).

---

## 9. Déploiement DEV — historique (24 juillet 2026)

L'auto-deploy Git natif Vercel↔GitHub est fiable et suffisant pour `calymia` (DEV). Un
Deploy Hook + workflow GitHub Actions (`deploy-dev.yml`) avaient été mis en place en
parallèle puis retirés : les deux déclencheurs (Git natif + Deploy Hook) se déclenchaient
simultanément et s'annulaient mutuellement via l'Ignored Build Step du projet.

Le vrai bug, longtemps masqué : un `if` sans `else` dans l'Ignored Build Step du projet
`calymia` skippait **tous** les builds automatiques (Git natif comme Deploy Hook), quel
que soit le déclencheur — masqué jusque-là par l'usage de `vercel --prod` en CLI, qui
contourne ce réglage. Fix : ajouter le `else` manquant.

Conclusion : le Deploy Hook et le workflow GitHub Actions ont été supprimés. Un seul
mécanisme (auto-deploy Git natif) reste actif sur `calymia`.

### Auth SSH GitHub — rappel
La clé enregistrée côté GitHub est `~/.ssh/id_ed25519_calymia` (pas la clé par défaut
`id_ed25519`). Un fichier `~/.ssh/config` force désormais explicitement cette clé pour
`github.com` :
```
Host github.com
  HostName github.com
  User git
  IdentityFile ~/.ssh/id_ed25519_calymia
  IdentitiesOnly yes
```
Si le push SSH échoue de nouveau (`Permission denied (publickey)`) sur une nouvelle machine,
vérifier en premier que ce fichier de config existe et pointe vers la bonne clé, avant de
suspecter un problème côté GitHub.

⚠️ **Piège vécu le 30/07** : un retour Cursor annonçant une implémentation terminée ne veut pas
toujours dire que le code a été commité/poussé. Toujours vérifier `git status` avant de tester
en DEV/PROD — un test qui "ne montre pas le changement attendu" peut simplement signifier que
rien n'a été déployé, pas que le code est bugué.

---

## 10. cn() / tailwind-merge (27 juillet 2026)

`cn()` dans `src/lib/utils.ts` utilise désormais `twMerge` :
```typescript
import { twMerge } from "tailwind-merge";

export function cn(...classes: Array<string | false | null | undefined>) {
  return twMerge(classes.filter(Boolean).join(" "));
}
```

Contexte : l'ancienne implémentation (`join()` simple) ne résolvait pas les conflits entre
classes Tailwind touchant la même propriété (ex: `bg-white` par défaut d'`Input` vs
`bg-slate-100` injecté) — l'ordre de priorité dépendait de l'ordre de génération CSS de
Tailwind, pas de l'ordre des classes dans la chaîne. Contournement `!important` retiré
(3 occurrences dans `reserver/page.tsx`, champs readOnly du tunnel de réservation — voir
section 8).

Surface du bug : seuls 4 composants utilisent `cn()` — `button.tsx`, `badge.tsx`, `input.tsx`,
`card.tsx` (`src/components/ui/`). Vérifié par grep sur tout `src/` avant le fix.

Point de vigilance identifié pendant l'audit (à surveiller, pas de bug confirmé) :
`dashboard/page.tsx` utilise `<Card className="... p-0 ...">` pour écraser le `p-6` par
défaut — confirmé fonctionnel après le fix (`p-0` gagne bien via `twMerge`).

---

## 11. Session du 28 → 31 juillet 2026 — synthèse

Grosse session multi-jours centrée sur la facturation (séance + abonnement) et la conformité
commerciale du plan Essentiel. Détail des patterns techniques déjà intégré dans les sections
correspondantes (3, 4, 5, 6) ; résumé chronologique et décisions produit ci-dessous.

### Livré et déployé en PROD
- Refonte complète de la facture PDF séance (identité Calymia, mandat KLS3 SARL, SIRET
  conditionnel, vraies fonts Playfair Display / DM Sans)
- Fix du flow d'upgrade d'abonnement pendant le trial (mode `setup`, plus de doublon
  d'abonnement Stripe, synchronisation `trial_ends_at`)
- Tableau "Historique de facturation" sur `/dashboard/abonnement` (factures Stripe Billing,
  téléchargement direct)
- Système d'alerte de dépassement de la limite 15 clients (plan Essentiel) : email sophrologue +
  email interne (eric/lilian/bonjour) pour relance commerciale manuelle
- Suppression de client depuis le dashboard (bouton icône poubelle + confirmation + RPC
  transactionnelle, bloque si séances futures actives)
- Branding Stripe (logo, couleurs Calymia) configuré sur les 3 onglets (Reçus, Checkout,
  Portail client)
- `preferred_locales: ['fr']` pour les nouveaux customers Stripe
- Corrections associées : init Resend paresseuse (`getResendClient()`), extension de la
  contrainte `communications_type_check`, suppression du compte test
  `eri-scarpino-sarreguemines` en PROD

### Décisions produit actées
- **Limite 15 clients** : reste un soft-block incitatif, pas un blocage technique réel pour le
  lancement (option A retenue — email d'alerte). Facturation à l'usage au-delà de 15
  (Stripe metered billing) notée comme piste V2/V3, pas prioritaire.
- **Facture séance** : modèle de mandat de facturation (sophrologue = vendeur légal, Calymia =
  mandataire de facturation) plutôt que Calymia comme émetteur direct — nécessaire pour la
  conformité légale française sur la facturation.

### Backlog restant (non traité cette session)
- Templates email Supabase (Confirm signup, Invite, Magic Link, Change Email,
  Reauthentication) — écart DEV/PROD non encore audité
- Nœud email récap Resend dans le workflow n8n "Génération Sujets Blog" (priorité basse)
- Route API `disponibilites` (INSERT/DELETE) orpheline — à évaluer pour suppression
- Écart bucket `factures` public vs privé signalé (section 4) — à trancher
- Numérotation facture séance non réellement séquentielle (`Date.now()`) — à surveiller si besoin
  de conformité comptable stricte
- État de l'abonnement Stripe de Sophie Marchand (compte de test) à valider si réutilisé pour de
  futurs tests — nombreuses manipulations manuelles effectuées pendant cette session

✅ **Clos après cette session (août 2026)** : nettoyage des Redirect URLs Supabase DEV qui
pointaient à tort vers `app.calymia.com` — Site URL et Redirect URLs du projet DEV
`cdfltpuzlkyoymjgdhcr` corrigés vers `calymia.vercel.app` (voir section 12).

---

## 12. Session août 2026 — synthèse

Session centrée sur la visioconférence (Daily.co), corrections auth / UI, et durcissement du
processus de déploiement PROD. Détail technique déjà intégré dans les sections 2–6.

### Livré et déployé en PROD
- **Visioconférence** : `types_seances.mode`, génération de salles Daily.co au paiement,
  diffusion emails / rappel J-1 / agenda, fallback `sophrologues.lien_teleconsultation`,
  endpoint `POST /api/seances/[id]/regenerer-visio` (voir section 6)
- **Fix reset mot de passe** : `next=/reinitialiser-mot-de-passe` dans le `redirectTo` PKCE,
  lu en priorité par `/auth/callback` (voir section 6)
- Migration SQL `types_seances.mode` appliquée sur PROD **après** un premier deploy code-only
  (incident documenté section 2)

### Livré et déployé en PROD (mise à jour 21/08 — confirmé mergé depuis)
- **Fix alignement colonnes** « Historique des séances » (`src/app/(auth)/patient/page.tsx`) :
  grids par ligne indépendants remplacés par un grid CSS partagé (`display: contents`),
  padding par cellule (plus de `gap-x-4` créant des bandes blanches), titre « Reçu » centré
  sur la dernière colonne du header — confirmé présent sur `main` lors du diagnostic du 21/08,
  la mention "develop only" de l'arborescence (section 3) est corrigée en conséquence

### Infra / ops clos
- Redirect URLs Supabase DEV : Site URL + Redirect URLs du projet `cdfltpuzlkyoymjgdhcr`
  corrigés vers `calymia.vercel.app` (plus d'entrées erronées `app.calymia.com`)

### TODO opérationnel ouvert
- Ajouter une CB sur les comptes Daily.co `calymia-dev` **et** `calymia-prod` (Dashboard →
  Billing) — sans cela le *join* de salle échoue (« Missing payment method ») alors que la
  création API réussit (voir section 5)

### Leçon déploiement
- Ne jamais pousser sur `main` du code qui dépend d'une migration SQL tant que cette migration
  n'est pas appliquée et vérifiée sur la base PROD (checklist section 2, étape 4).

---

## 13. Session du 21 août 2026 — synthèse

Chantier RPPS → certification_rncp, suivi d'un diagnostic complet de l'écart entre ce fichier et
l'état réel du code (accumulé depuis le 12 août).

### Livré — chantier RPPS → certification_rncp
- Migration DEV validée : `DROP COLUMN numero_rpps`, `ADD COLUMN certification_rncp boolean
  NOT NULL DEFAULT false` — **migration PROD à confirmer/vérifier** (checklist section 2 avant
  tout merge `develop` → `main` incluant ce changement)
- Checkbox RNCP dans l'onboarding étape 1, récap étape 5, et Paramètres → Profil
- Badge public "✓ Certification RNCP" (SIRET inchangé)
- Score de complétude du profil : critère RPPS retiré **sans remplacement**, `PROFILE_SCORE_MAX`
  désormais dérivé dynamiquement (voir section 6) — corrige au passage un bug latent où
  `ProfileScoreCard` comparait à `100` en dur
- `SophrologueRppsLine.tsx` renommé `SophrologueInfoLine.tsx` (générique, ne sert plus qu'au SIRET)

### Diagnostic doc vs code — écarts comblés dans cette mise à jour
Fonctionnalités livrées en code depuis le 12 août mais absentes (ou mal décrites) dans ce fichier
jusqu'ici, toutes documentées dans les sections correspondantes ci-dessus :
- Google Agenda V1 (US-34) — section 6
- JSON-LD `ProfessionalService`/`Person`, `robots.ts`/`sitemap.ts` dynamiques — section 6
- GA4 + consentement RGPD, tracking UTM — section 6
- `getPriceIdToPlan()` lazy, pause/reprise Stripe Billing self-service — section 5
- Avis clients (US-33) — section 6
- Slot grid réservation 15 → 30 min — section 6
- Opt-in `afficher_email`/`afficher_telephone` — section 6
- 5ᵉ onglet Paramètres "Intégrations" — section 3
- Fix grille "Historique des séances" confirmé en PROD (n'était plus "develop only") — section 12

### Zones signalées mais non traitées dans cette mise à jour (hors scope `CLAUDE.md`)
- `src/app/api/rappels/test/route.ts` appelle encore directement l'API SendGrid — à migrer vers
  Resend ou supprimer (voir section 5)
- Mentions SendGrid dans des docs hors `CLAUDE.md` (README, `.env.example`,
  `docs/architecture.md`, `docs/infrastructure.md`, `src/docs/n8n-workflow-rappels.md`)
- Écart bucket `factures` public vs privé (déjà signalé section 4, toujours ouvert)
- `calymia-prd.docx` : US-33 et US-34 à recorriger (statuts `📋 V2` obsolètes), plusieurs US
  manquantes pour les livraisons ci-dessus — traité séparément, pas dans ce fichier
- `calymia-infrastructure-v2-final.docx` : document de bascule pré-lancement (avril 2026), décrit
  la création d'un "nouveau projet Supabase prod" déjà créé depuis — à considérer comme référence
  historique du jour de lancement plutôt qu'à corriger ligne par ligne

---

## 14. Session du 24 août 2026 — synthèse

Chantier complet "création manuelle de séance" (contact client hors plateforme), livré et
testé de bout en bout en DEV puis PROD, en 4 étapes + 1 KPI + 3 correctifs post-tests. Détail
technique complet en section 6 ("Création manuelle de séance").

### Livré et déployé
- Migration : `patients.email` nullable, `seances.montant_declare` + `token_paiement_manuel` +
  `recu_url`
- `POST /api/seances/create` : deux branches (hors plateforme / lien de paiement en ligne)
- Page publique `/paiement/[token]` — réutilise `PaymentForm` tel quel
- `NouveauSeanceModal.tsx` dans l'agenda, avec extraction Claude optionnelle depuis un message
  collé (`thinking` désactivé sur Sonnet 5 — sinon extraction vide)
- KPI dashboard "CA total déclaré" (5e carte, `lg:grid-cols-3`)
- Cron post-séance : filtre 48h anti-spam sur les séances manuelles rétroactives
- Template email `confirmationSeanceManuelle` ("enregistrée", pas "notée" — évite la collision
  avec la fonctionnalité Avis clients)
- Ligne "Règlement" dans le drawer agenda (hors plateforme / lien en attente / lien payé),
  dérivée de `origine` + `montant_declare`, sans nouvelle colonne dédiée
- **Reçu PDF** pour les séances hors plateforme — chantier complet, voir section 6 ("Reçu PDF")

### Corrections d'arborescence apportées à ce fichier à cette occasion
- `bloquer-creneau` est sous `/api/reservations/`, pas `/api/seances/` (erreur historique)

### Incident de process (sans conséquence, résolu)
Un `git merge develop → main` a semblé "Already up to date" de façon inattendue en fin de
chantier RPPS/RNCP (session du 21/08) — le commit avait en réalité déjà été fait et mergé plus
tôt sans confirmation explicite dans le fil. Vérifié via `git log --all` et `git reflog`, aucune
perte de travail. **Leçon** : en cas de doute sur l'état d'un merge, toujours vérifier
`git log --oneline --all` avant de supposer un problème — un stash oublié sans rapport (chantier
RPPS legacy jamais mergé, retrouvé au passage) a failli être appliqué par erreur ; il a été
identifié comme non pertinent et supprimé (`git stash drop`).

### Incident PROD — bucket Storage `factures` vs `invoices` (résolu)
Voir détail en section 6 ("Reçu PDF"). Le déploiement du reçu en PROD a échoué (`Bucket not
found`) car le bucket s'appelait `invoices` en PROD, `factures` en DEV — écart de config jamais
détecté faute d'usage antérieur en PROD. Résolu par suppression/recréation (bucket vide, sans
risque). Audit Storage DEV/PROD à prévoir en amont du prochain chantier touchant ce domaine.

### Backlog ouvert à l'issue de cette session
- Suppression sophrologue : pas d'équivalent de `delete_patient_cascade` — sujet ouvert pour le
  futur dashboard admin (voir ci-dessous)
- Reconnexion Google Agenda : un refresh token peut expirer/être révoqué (`invalid_grant`)
  même après une "resynchronisation" partielle — seule une déconnexion/reconnexion OAuth
  complète régénère un token valide. Pas de détection proactive de token mort côté produit
  aujourd'hui (le sophrologue le découvre seulement à l'échec d'une vérification FreeBusy)
- Audit config Storage (buckets, policies) DEV vs PROD — écart déjà trouvé une fois
  (`factures`/`invoices`), probablement pas le seul si les buckets ont tous été créés
  manuellement dans l'UI Supabase sans script/migration

### Prochain chantier identifié
Dashboard administrateur (Eric) : KPIs globaux plateforme (au-delà d'un sophrologue), gestion/
suppression de clients et de sophrologues. Points déjà identifiés comme sensibles avant de
commencer : authentification admin séparée du système de session sophrologue, absence totale
d'un flow de suppression/désactivation de compte sophrologue aujourd'hui (séances futures,
abonnement Stripe actif, page publique indexée), besoin d'un log d'audit sur les actions
destructrices.

## Note finale

Ce fichier est un document vivant. Il doit être mis à jour à chaque session avec les
nouvelles décisions techniques, les bugs résolus et les patterns établis.
