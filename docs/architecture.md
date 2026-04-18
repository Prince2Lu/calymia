# Calymia — Architecture Document
*Version 1.0 — Mars 2026*

## 1. Stack Technique

| Couche | Technologie | Justification |
|---|---|---|
| Frontend | Next.js 14 App Router | SSR natif — critique pour l'indexation Google |
| Base de données | Supabase (PostgreSQL) | RLS multi-tenant, auth intégrée, storage |
| Paiement | Stripe Connect | Marketplace avec split automatique + commission |
| Automations | n8n (Hetzner) | Workflows rappels, post-séance, cleanup |
| Emails | SendGrid | Emails transactionnels |
| SMS | Twilio | Rappels SMS J-1 (plan Pro+) |
| Hosting app | Vercel | Déploiement Next.js, CI/CD GitHub |
| Site vitrine | WordPress (Hetzner) | calymia.com, blog SEO |
| CSS/UI | Tailwind CSS | Utility-first, mobile responsive |

> **Décision critique — SSR obligatoire** : Lovable et WeWeb ont été explicitement rejetés car ils génèrent des SPA incompatibles avec l'indexation Google. Next.js 14 avec SSR est non négociable.

---

## 2. Architecture des Domaines

### 2.1 Structure URL

- Site vitrine : `calymia.com` → WordPress
- Application : `app.calymia.com` → Next.js (Vercel)
- Pages publiques : `app.calymia.com/sophrologues/{dept}/{ville}/{slug}`
- Articles blog : `calymia.com/articles/{slug}` (V2)
- Blog WordPress : `calymia.com/blog/`

### 2.2 Routing Next.js

```
src/app/
├── (auth)/              # Routes protégées dashboard
│   ├── dashboard/
│   ├── agenda/
│   ├── clients/
│   ├── parametres/
│   ├── emails/          # Pro+
│   ├── communications/  # Pro+
│   └── abonnement/
├── (public)/            # Pages publiques SSR
│   └── sophrologues/[dept]/[ville]/[slug]/
│       ├── page.tsx
│       └── reserver/
├── (client)/
│   ├── mes-rdv/
│   └── profil/
├── onboarding/          # Wizard 5 étapes
├── inscription/
├── connexion/
└── api/
    ├── stripe/
    ├── sophrologue/
    ├── reservations/
    └── cron/
```

---

## 3. Schéma Base de Données

### 3.1 Tables principales

| Table | Colonnes clés | Description |
|---|---|---|
| `sophrologues` | id, user_id, slug, nom, prenom, bio, photo_url, plan, photos_cabinet, horaires (JSONB), modes_paiement, formations, certifications | Profil complet |
| `patients` | id, user_id, sophrologue_id, nom, prenom, email, telephone | Clients |
| `seances` | id, sophrologue_id, patient_id, type_seance_id, debut_at, fin_at, statut, stripe_payment_intent_id | Réservations |
| `types_seances` | id, sophrologue_id, nom, duree_minutes, tarif, actif | Catalogue séances |
| `disponibilites` | id, sophrologue_id, jour_semaine, heure_debut, heure_fin, actif | Créneaux |
| `parametres_cabinet` | id, sophrologue_id, delai_min_reservation_heures | Paramètres |
| `seance_notes` | id, seance_id, sophrologue_id, contenu (JSON Tiptap) | Notes Pro+ |
| `email_templates` | id, sophrologue_id, type, sujet, contenu_html | Templates Pro+ |
| `communications_log` | id, sophrologue_id, patient_id, type, statut, sent_at | Journal |

### 3.2 Points d'attention DB

> ⚠️ La table `sophrologues` a **deux clés** : `id` (FK interne) et `user_id` (auth.users) — source récurrente de bugs. Toujours vérifier lequel utiliser.

> ⚠️ La table s'appelle `patients` (pas `clients`). Les colonnes séances sont `debut_at`/`fin_at`, statut `confirmee`.

> ⚠️ Format JSONB horaires multi-plages : `{lundi: [{debut, fin}]}` — `normalizeHoraires()` requis pour rétrocompatibilité.

### 3.3 Row Level Security (RLS)

Toutes les tables sont protégées par des policies RLS :
- Un sophrologue ne peut lire/modifier que ses propres données
- Un patient ne peut voir que ses propres réservations
- Les pages publiques utilisent des requêtes anonymes sur données publiques uniquement

### 3.4 Storage Supabase

| Bucket | Accès | Contenu |
|---|---|---|
| `avatars` | Public | Photos de profil |
| `cabinet-photos` | Public | Photos du cabinet ({user_id}/{filename}) |
| `invoices` | Privé | Factures PDF |

---

## 4. Architecture Paiement — Stripe Connect

### 4.1 Flux de paiement

1. Client sélectionne un créneau
2. Calymia crée un PaymentIntent avec `application_fee_amount` (3%)
3. Paiement capturé sur le compte Connect du sophrologue
4. Commission Calymia prélevée automatiquement
5. Webhook `payment_intent.succeeded` → confirmation, séance, facture PDF
6. Reversement sophrologue sous 2-7 jours ouvrés

### 4.2 Webhooks Stripe

| Événement | Action |
|---|---|
| `payment_intent.succeeded` | Confirmer séance, email confirmation, facture PDF |
| `payment_intent.payment_failed` | Libérer créneau, notifier client |
| `charge.refunded` | Mettre à jour statut séance |
| `account.updated` | Mettre à jour statut Connect sophrologue |

> ⚠️ Le webhook secret diffère entre local (stripe listen) et Vercel. Ne jamais confondre.

---

## 5. Workflows n8n (Hetzner)

| Workflow | Déclencheur | Action |
|---|---|---|
| `rappels-j1` | Cron 8h00 | Emails rappel J-1 via SendGrid |
| `post-seance` | Cron 20h00 | Emails post-séance (Pro+) |
| `cleanup-seances` | Cron toutes les 15 min | Supprime séances en_attente expirées |
| `generation-articles` | Manuel | Génère articles blog via Claude API |

### Endpoints API cron

- `POST /api/cron/rappels-j1`
- `POST /api/cron/post-seance`
- `POST /api/reservations/cleanup`
- Authentification : Bearer token `CRON_SECRET`

---

## 6. Architecture SEO

### 6.1 Structure des URLs publiques

```
app.calymia.com/sophrologues/{departement}/{ville}/{slug}
Exemple : app.calymia.com/sophrologues/57-moselle/sarreguemines/marie-dupont-sophrologue
```

### 6.2 Données structurées JSON-LD

- `@type` : Person
- `name`, `jobTitle`, `description`, `image`
- `address` : PostalAddress
- `openingHoursSpecification` : depuis les horaires multi-plages
- `priceRange` : depuis le tarif minimum

### 6.3 Balises meta

- `title` : `{Prénom} {Nom} – Sophrologue à {Ville} | Calymia`
- `description` : 155 chars max, extraite de la bio
- `canonical` : URL absolue
- `og:type` : profile
- `og:locale` : fr_FR

---

## 7. Sécurité & Conformité

### 7.1 Authentification

- Supabase Auth : JWT tokens, sessions côté serveur
- Middleware Next.js : vérification session sur toutes les routes (auth)
- Rôles : 'sophrologue' et 'client'

### 7.2 Variables d'environnement critiques

| Variable | Usage |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | URL projet Supabase |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Clé publique (lecture RLS) |
| `SUPABASE_SERVICE_ROLE_KEY` | Clé admin (API routes uniquement) |
| `STRIPE_SECRET_KEY` | Clé secrète Stripe |
| `STRIPE_WEBHOOK_SECRET` | Secret webhook (différent local vs Vercel) |
| `SENDGRID_API_KEY` | Emails transactionnels |
| `CRON_SECRET` | Token Bearer endpoints cron n8n |

---

## 8. Infrastructure & Déploiement

| Env | URL | Notes |
|---|---|---|
| Dev | calymia.vercel.app | Stripe test, Supabase dev |
| Prod | app.calymia.com | Stripe live, Supabase prod, n8n Hetzner |

### CI/CD

- Push sur `main` → déploiement automatique Vercel (prod)
- Push sur `develop` → déploiement preview Vercel (dev)
- Migrations Supabase : `npx supabase db push`
