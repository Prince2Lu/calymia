# CLAUDE.md — Calymia

Fichier de contexte pour Claude Code. À lire en priorité avant toute modification du repo.

Dernière mise à jour : 31 juillet 2026

---

## 1. Vue d'ensemble du projet

Calymia est une plateforme SaaS B2B2C pour les sophrologues en France.
- **Sophrologue** : page publique SEO + outils de gestion (agenda, clients, paiements)
- **Client** : trouve un sophrologue via Google, réserve et paie en ligne
- **Calymia** : prélève 3% de commission sur chaque réservation + abonnement mensuel sophrologue

**Repo GitHub** : `github.com/Prince2Lu/calymia`
**Stack** : Next.js 14 App Router, Supabase (PostgreSQL + RLS), Stripe Connect + Billing, Resend, n8n

---

## 2. Environnements — CRITIQUE

| | DEV | PROD |
|---|---|---|
| **URL app** | `calymia.vercel.app` | `app.calymia.com` |
| **Supabase projet** | `cdfltpuzlkyoymjgdhcr` | `tsydrlqcshgnblgiacow` |
| **Stripe** | TEST (clés test) | LIVE (clés live) ✅ actif |
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
Checklist avant tout merge `develop` → `main` : `npx tsc --noEmit` et `npm run build` sans
erreur, pas de nouveau `console.error` dans les logs Vercel DEV récents, migrations Supabase
déjà validées sur DEV **et** appliquées sur PROD.

---

## 3. Structure du projet

```
src/
├── app/
│   ├── (auth)/              # Dashboard sophrologue (protégé)
│   │   ├── dashboard/       # KPIs + agenda + score complétude profil
│   │   ├── seances/         # Agenda semaine + drawer détail
│   │   ├── clients/         # Liste + fiche client [id] — suppression client ✅ (31/07)
│   │   ├── patient/         # Espace client
│   │   ├── parametres/      # 4 onglets dont Cabinet/Vitrine + champ SIRET (Profil, 30/07)
│   │   ├── emails/          # Templates emails (Pro+)
│   │   ├── communications/  # Journal (Pro+)
│   │   └── abonnement/      # Plans & abonnement + historique de facturation ✅ (31/07)
│   ├── (public)/
│   │   └── sophrologues/[dept]/[ville]/[slug]/  # Page publique SSR
│   │       └── reserver/    # Tunnel réservation 4 étapes
│   ├── onboarding/          # Wizard 5 étapes
│   ├── inscription/         # Création compte
│   ├── connexion/           # Login
│   └── api/
│       ├── auth/            # create-client-account, check-email
│       ├── stripe/
│       │   ├── webhook/         # payment_intent.succeeded, checkout.session.completed (30/07),
│       │   │                    # customer.subscription.updated/deleted/trial_will_end
│       │   ├── checkout/        # Checkout Session mode "setup" (upgrade pendant trial, 30/07)
│       │   ├── billing-portal/  # Lien vers le Billing Portal Stripe
│       │   └── invoices/        # GET factures Stripe du sophrologue (31/07)
│       ├── sophrologue/     # CRUD sophrologue
│       ├── patients/
│       │   ├── create/          # Ajout manuel client (dashboard)
│       │   └── [id]/delete/     # Suppression client, RPC transactionnelle (31/07)
│       ├── reservations/    # create-payment-intent, annuler
│       ├── public/          # prochain-creneau (badge temps réel, force-dynamic)
│       ├── factures/        # generer (facture séance, redesign 30/07 — voir section 6)
│       └── cron/            # Endpoints n8n (rappels-j1, post-seance, cleanup-seances)
├── components/
│   ├── dashboard/
│   │   ├── ProfileScoreCard.tsx         # Widget score complétude (Server Component)
│   │   ├── ProfileScoreCardWrapper.tsx  # Wrapper client pour ProfileScoreCard
│   │   ├── PlanCheckoutButtons.tsx      # Boutons "Choisir Essentiel/Professionnel"
│   │   └── InvoiceHistoryTable.tsx      # Historique de facturation abonnement (31/07)
│   ├── factures/            # BoutonFacture.tsx
│   ├── providers/           # SophrologueProvider.tsx
│   ├── public/              # SophrologueRppsLine.tsx, ProchainCreneauBadge.tsx (both "use client")
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
    │   └── billing.ts       # createStripeCustomerForSophrologue() — preferred_locales: ['fr']
    ├── booking/
    │   └── compute-next-slot.ts  # computeNextAvailableSlotIso() — lit sophrologues.horaires
    ├── config/
    │   └── site-url.ts      # getSiteUrl(), getSophrologueProfileUrl()
    ├── factures/
    │   ├── generate.tsx     # Génération PDF facture séance — redesign complet 30/07 (section 6)
    │   └── fonts/           # PlayfairDisplay-*.ttf, DMSans-*.ttf (committés, pas de fetch réseau)
    ├── notifications/
    │   └── limite-clients-alerte.ts  # Alerte dépassement 15 clients (plan Essentiel) — 31/07
    ├── emails/
    │   ├── templates.ts     # Templates emails Resend
    │   └── send.ts          # sendEmail() — init Resend paresseuse via getResendClient() (31/07)
    ├── profile-score.ts     # computeProfileScore(), ProfileScoreItem, SophrologueRow
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
| `sophrologues` | `id`, `user_id`, `slug`, `plan`, `horaires` (JSONB), `photos_cabinet`, `siret`, `stripe_customer_id`, `stripe_subscription_id`, `trial_ends_at`, `limite_clients_alerte_envoyee_at` | `plan` = 'essentiel' / 'professionnel' / 'cabinet'. `horaires` = **seule source de vérité** pour l'affichage ET le booking depuis le 27/07 (voir section 10). `siret` nullable, ajouté 30/07 (affiché sur la facture si renseigné). `limite_clients_alerte_envoyee_at` ajouté 31/07 (voir section 11) |
| `patients` | `id`, `user_id`, `sophrologue_id` | Pas `clients` — toujours `patients`. Voir modèle d'identité ci-dessus |
| `seances` | `id`, `sophrologue_id`, `patient_id`, `debut_at`, `fin_at`, `statut` | `statut` = 'confirmee' / 'terminee' / 'annulee' |
| `paiements` | `id`, `seance_id`, `sophrologue_id`, `statut`, `montant_total`, `facture_url` | `statut` = 'reussi' / 'rembourse' |
| `types_seances` | `id`, `sophrologue_id`, `nom`, `duree_minutes`, `tarif`, `actif` | |
| `disponibilites` | `id`, `sophrologue_id`, `jour_semaine`, `heure_debut`, `heure_fin`, `actif` | ⚠️ **Legacy** — plus lue ni écrite pour le booking depuis le 27/07 (voir section 10). Reste en base, non supprimée |
| `communications` | `id`, `sophrologue_id`, `patient_id`, `seance_id`, `type`, `statut`, `sent_at`, `destinataire_email`, `destinataire_nom`, `objet`, `contenu` | ⚠️ Pas `communications_log`. Colonne date = `sent_at` (pas `created_at`). Contrainte `communications_type_check` : liste fermée de valeurs autorisées pour `type` — **toujours vérifier/étendre cette contrainte** avant d'introduire un nouveau type d'email journalisé (ajouté `limite_clients_alerte` le 31/07 ; la contrainte réelle en base contenait déjà `avis`, absent du fichier de migration d'origine — écart base/repo à garder en tête) |
| `email_templates` | `id`, `sophrologue_id`, `type`, `sujet`, `contenu_html` | FK sur `sophrologues.user_id` (pas `.id`) |
| `seance_notes` | `id`, `sophrologue_id`, `patient_id`, `seance_id`, `contenu_html` | Pro+ uniquement |

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

### SSR — obligatoire sur les pages publiques
Toutes les pages sous `(public)/` doivent être en SSR (Server Side Rendering).
Ne jamais ajouter `"use client"` sur les pages publiques sophrologues. Si un bloc nécessite
un état client (ex: infobulle toggle sur mobile, ou badge temps réel), l'isoler dans un petit
composant `"use client"` dédié — exemples : `src/components/public/SophrologueRppsLine.tsx`,
`src/components/public/ProchainCreneauBadge.tsx`.

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

### Score de complétude du profil (mis à jour 27 juillet 2026)
- Calcul dans `src/lib/profile-score.ts` — fonction `computeProfileScore(sophrologue, supabase)`
- 9 critères, total toujours /100 : 8 critères × 10 points + 1 critère "Horaires" × 20 points
  (fusion des anciens critères séparés `disponibilites` + `horaires` — la table `disponibilites`
  n'étant plus lue nulle part, ce critère unique se base sur `hasHorairesContenu(normalizeHoraires(...))`)
- Formule : `items.reduce((sum, item) => sum + (item.completed ? (item.points ?? 10) : 0), 0)`
  — chaque `ProfileScoreItem` peut définir `points` (défaut 10) ; permet d'ajouter/retirer des
  critères sans casser le total /100
- Affiché dans le dashboard via `ProfileScoreCardWrapper` (Client Component) → `ProfileScoreCard`
- Critères : photo_url, bio (>50 chars), specialites, types_seances actifs, horaires JSONB (20 pts),
  photos_cabinet, formations, numero_rpps, syndicats
- Liens directs vers `/parametres?tab={profil|seances|disponibilites|vitrine}` — ⚠️ **pas**
  `/dashboard/parametres` (bug corrigé le 24 juillet 2026 : `/parametres` est un sibling de
  `/dashboard`, pas un sous-dossier)
- `SophrologueRow` : type structurel défini dans `profile-score.ts` (pas de type centralisé pour l'instant)

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
- `numero_rpps` : affiché au-dessus de la section photos cabinet, uniquement si renseigné, avec infobulle définition
- Tél, email, adresse : **non affichés** sur la page publique (force la réservation en ligne, protège la commission 3%)
- Ces coordonnées sont transmises uniquement dans l'email de confirmation client
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
| `rappels-j1` | Cron 17h UTC | Emails rappel J-1 aux clients |
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

---

## Note finale

Ce fichier est un document vivant. Il doit être mis à jour à chaque session avec les
nouvelles décisions techniques, les bugs résolus et les patterns établis.
