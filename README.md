# Calymia

Plateforme SaaS à double entrée pour les sophrologues en France.

**Pour le sophrologue** : page publique SEO-optimisée générée automatiquement, réservation en ligne 24h/24, paiements sécurisés Stripe, rappels automatiques, dashboard de gestion.

**Pour le client** : trouver un sophrologue via Google, réserver et payer en ligne, rappels automatiques de RDV.

---

## Stack technique

| Couche | Technologie |
|---|---|
| Frontend | Next.js 14 App Router (SSR obligatoire) |
| Base de données | Supabase (PostgreSQL + RLS) |
| Paiement | Stripe Connect (commission 3%) |
| Automations | n8n sur Hetzner |
| Emails | SendGrid |
| SMS | Twilio (Pro+) |
| Hosting | Vercel |
| Site vitrine | WordPress + Elementor (calymia.com) |

## URLs

| Environnement | URL |
|---|---|
| Dev (preview) | https://calymia.vercel.app |
| Prod | https://app.calymia.com |
| Site vitrine | https://calymia.com |

---

## Installation

```bash
git clone https://github.com/Prince2Lu/calymia.git
cd calymia
npm install
cp .env.example .env.local
# Remplir les variables dans .env.local
npm run dev
```

## Variables d'environnement

Copier `.env.example` en `.env.local` et remplir toutes les valeurs :

```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=
SENDGRID_API_KEY=
TWILIO_ACCOUNT_SID=
TWILIO_AUTH_TOKEN=
TWILIO_PHONE_NUMBER=
CRON_SECRET=
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

> **Stripe webhook en local** : utiliser la Stripe CLI `stripe listen --forward-to localhost:3000/api/stripe/webhook`. Le secret généré est différent de celui de Vercel.

---

## Branches

| Branche | Rôle | Déploiement |
|---|---|---|
| `main` | Production — code validé uniquement | app.calymia.com |
| `develop` | Développement et tests | calymia.vercel.app (preview) |

**Workflow** : toujours développer sur `develop` → tester → PR vers `main`.

---

## Structure du projet

```
calymia/
├── src/
│   ├── app/                 # Next.js App Router
│   │   ├── (auth)/          # Routes dashboard protégées
│   │   ├── (public)/        # Pages publiques sophrologues (SSR)
│   │   ├── onboarding/      # Wizard onboarding 5 étapes
│   │   └── api/             # API Routes
│   ├── components/          # Composants React
│   │   ├── plan/            # PlanGuard, badges plan
│   │   ├── public/          # Composants page publique
│   │   └── ui/              # Composants UI génériques
│   ├── hooks/               # Custom hooks (usePlan, etc.)
│   ├── lib/                 # Utilitaires (booking, supabase, timezone)
│   └── types/               # Types TypeScript
├── supabase/
│   └── migrations/          # Migrations SQL
├── n8n-workflows/           # Workflows n8n (JSON exportés)
│   ├── README.md
│   ├── Calymia — Rappels J-1.json
│   ├── Calymia — Post-séance.json
│   ├── Calymia — Cleanup séances.json
│   └── Calymia — Generation Articles v2.json
└── public/                  # Assets statiques
```

---

## Commandes utiles

```bash
npm run dev          # Serveur de développement
npm run build        # Build de production
npm run lint         # Vérification ESLint
npx tsc --noEmit     # Vérification TypeScript
```

---

## Plans tarifaires

| Plan | Prix | Cible |
|---|---|---|
| Essentiel | 29 €/mois | Sophrologues débutants |
| Professionnel | 59 €/mois | Sophrologues actifs |
| Cabinet | 139 €/mois | Multi-praticiens (V2) |

Commission : 3% sur chaque réservation payée en ligne. Essai gratuit 14 jours.

---

## Comptes de test

```
Sophrologue : scarpinoeric@gmail.com
Slug : test-sophrologue-sarreguemines (57-moselle/sarreguemines)

Client : patient.test@calymia.com / Test1234!

Carte Stripe test : 4242 4242 4242 4242 / 12/26 / 123
```

---

## n8n Workflows

4 workflows déployés sur `automation.kls3-dev.com` :

| Workflow | Déclencheur | Rôle |
|---|---|---|
| Rappels J-1 | Cron 8h00 | Emails rappel veille de RDV |
| Post-séance | Cron 20h00 | Emails post-séance (Pro+) |
| Cleanup séances | Toutes les 15 min | Supprime les créneaux expirés |
| Génération articles | Manuel | Génère articles blog via Claude API |

---

*Calymia — Projet confidentiel — Avril 2026*
