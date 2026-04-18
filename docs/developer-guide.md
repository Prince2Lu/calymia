# Calymia — Developer Guide
*Version 1.0 — Mars 2026*

## 1. Setup & Installation

### 1.1 Prérequis

- Node.js >= 18.x
- npm ou yarn
- Compte Supabase (projet : `cdfltpuzlkyoymjgdhcr`)
- Compte Stripe (mode test pour le dev)
- Cursor Pro avec modèle claude-sonnet

### 1.2 Installation locale

```bash
git clone https://github.com/Prince2Lu/calymia.git
cd calymia
git checkout develop
npm install
cp .env.example .env.local
# Remplir toutes les valeurs dans .env.local
npm run dev
```

> ⚠️ **Stripe Webhook en local** : utiliser `stripe listen --forward-to localhost:3000/api/stripe/webhook`. Le secret généré est différent de celui de Vercel.

---

## 2. Commandes Quotidiennes

```bash
npm run dev          # Serveur local
npm run build        # Build de production
npm run lint         # Vérifier ESLint
npx tsc --noEmit     # Vérifier TypeScript
```

### Git & Déploiement

```bash
git checkout develop     # Toujours développer sur develop
git add .
git commit -m 'feat: description'
git push                 # → déploiement preview calymia.vercel.app
```

**Convention de commits** :
- `feat:` nouvelle fonctionnalité
- `fix:` correction de bug
- `chore:` maintenance, config, docs
- `refactor:` refactoring sans changement fonctionnel

### Supabase

```bash
npx supabase link --project-ref [ID]
npx supabase db push
```

---

## 3. Structure du Projet

```
calymia/
├── src/
│   ├── app/                 # Next.js App Router
│   ├── components/
│   │   ├── plan/            # PlanGuard, badges plan
│   │   ├── public/          # Composants page publique
│   │   ├── cabinet-vitrine/ # Composants paramètres vitrine
│   │   ├── onboarding/      # Composants wizard onboarding
│   │   └── ui/              # Composants UI génériques
│   ├── hooks/
│   │   └── usePlan.ts       # Hook gestion plans
│   ├── lib/
│   │   ├── booking/         # Logique créneaux
│   │   ├── cabinet-photos-storage.ts
│   │   └── supabase/        # Clients Supabase
│   └── types/
│       └── horaires.ts      # Types horaires multi-plages
├── supabase/
│   └── migrations/          # Fichiers SQL migrations
├── n8n-workflows/           # Workflows n8n exportés
├── docs/                    # Documentation BMAD
└── public/                  # Assets statiques
```

### Composants clés

| Composant | Rôle |
|---|---|
| `PlanGuard` | Bloque l'accès aux features Pro+ avec message d'upgrade |
| `usePlan()` | Hook retournant les features du plan actuel |
| `HorairesPlagesEditor` | Éditeur multi-plages horaires |
| `VitrineTagListBlock` | Tag input réutilisable (formations, certifications) |
| `PhotoLightbox` + `CabinetPhotoGallery` | Galerie photos cabinet |
| `SophrologueBioExpandable` | Bio tronquée avec "Lire plus" |

---

## 4. Patterns & Conventions

### 4.1 Accès Supabase

```typescript
// Côté client (composants React)
import { createBrowserClient } from '@supabase/ssr'

// Côté serveur (Server Components, API Routes)
import { createServerClient } from '@supabase/ssr'
```

### 4.2 Protection des features par plan

```typescript
// Hook dans les composants client
const { notesSeance, plan, loading } = usePlan()

// Composant PlanGuard
<PlanGuard requiredPlan='professionnel' currentPlan={plan} featureName='Notes de séance'>
  <NoteSeance ... />
</PlanGuard>
```

### 4.3 Format horaires multi-plages

```typescript
// Type : HorairesSophrologue
// { lundi: [{ debut: '09:00', fin: '12:00' }, { debut: '14:00', fin: '18:00' }] }

import { normalizeHoraires } from '@/types/horaires'
const horaires = normalizeHoraires(sophrologue.horaires)
```

### 4.4 TypeScript strict

- Pas de `any` sauf si absolument inévitable
- `npx tsc --noEmit` doit toujours passer avant un commit
- Les Server Components n'ont pas `'use client'`
- Seuls les composants interactifs sont `'use client'`

---

## 5. Points d'attention critiques

### DB — id vs user_id

> ⚠️ La table `sophrologues` a deux clés : `id` (FK interne) et `user_id` (auth.users). Source récurrente de bugs — toujours vérifier lequel est nécessaire.

### Stripe Webhook

> ⚠️ Le webhook secret est **différent** entre l'environnement local et Vercel. Ne jamais utiliser la même valeur. Configurer `STRIPE_WEBHOOK_SECRET` séparément.

### Hooks React

> ⚠️ Les hooks React doivent être ordonnés **au-dessus** des retours conditionnels (règle des hooks).

### Vercel Hobby

> ⚠️ Le plan Hobby Vercel ne supporte pas les crons. Toutes les tâches planifiées passent par n8n sur Hetzner.

---

## 6. Tests End-to-End

### 6.1 Parcours sophrologue

1. Créer un compte avec email de test
2. Compléter l'onboarding 5 étapes
3. Vérifier la page publique générée
4. Configurer disponibilités et types de séances
5. Tester l'onglet Cabinet/Vitrine
6. Vérifier les restrictions plan Essentiel

### 6.2 Parcours réservation

1. Depuis la page publique → "Prendre rendez-vous"
2. Sélectionner un créneau
3. Renseigner les informations client
4. Payer avec la carte de test Stripe : `4242 4242 4242 4242 / 12/26 / 123`
5. Vérifier l'email de confirmation
6. Vérifier la séance dans le dashboard
7. Tester l'annulation et le remboursement

### 6.3 Cartes de test Stripe

| Numéro | Résultat | Expiry / CVV |
|---|---|---|
| 4242 4242 4242 4242 | ✅ Paiement réussi | 12/26 / 123 |
| 4000 0025 0000 3155 | 🔐 3D Secure requis | 12/26 / 123 |
| 4000 0000 0000 9995 | ❌ Paiement refusé | 12/26 / 123 |

---

## 7. Comptes & Identifiants de Test

```
Sophrologue test : scarpinoeric@gmail.com
Slug : test-sophrologue-sarreguemines (57-moselle/sarreguemines)
URL : calymia.vercel.app/sophrologues/57-moselle/sarreguemines/test-sophrologue-sarreguemines

Client test : patient.test@calymia.com / Test1234!

IDs Supabase :
sophrologues.id : 58f3e056-675d-48ee-9a1f-1afff1af7bfa
auth.users.id : 33adc32d-61be-4a2d-8e30-6fcf329189b4
```

---

## 8. Tâches Avant Lancement

| # | Tâche | Priorité |
|---|---|---|
| 1 | URL publique dans onboarding étape 5 + email bienvenue | 🔴 Critique |
| 2 | Stripe Billing — abonnements + essai 14j | 🔴 Critique |
| 3 | Connecter domaine app.calymia.com sur Vercel | 🔴 Critique |
| 4 | Passer Stripe en mode production | 🔴 Critique |
| 5 | Désactiver UPDATE essentiel→professionnel dans SQL | 🔴 Critique |
| 6 | Tests end-to-end complets | 🔴 Critique |
| 7 | SMS Twilio rappels J-1 (Pro+) | 🟡 Important |
| 8 | CGU + politique de confidentialité | 🟡 Important |
| 9 | Fix autofill tunnel réservation étape 3 | 🟡 Important |
| 10 | Gestion d'erreurs workflows n8n | 🟡 Important |

---

## 9. Roadmap V2

| Fonctionnalité | Plan | Notes |
|---|---|---|
| Articles blog sophrologues | Cabinet | Tiptap déjà en place |
| Multi-praticiens Cabinet | Cabinet | Jusqu'à 5, agenda partagé |
| Avis clients | Tous | Table, token unique, modération |
| Sync Google Agenda | Pro+ | OAuth Google |
| Annuaire sophrologues | Tous (public) | Recherche ville/spécialité |
| Stripe Billing self-service | Tous | Upgrade/downgrade sans support |
| Lightbox carousel photos | Tous | Navigation gauche/droite |
| SMS Twilio | Pro+ | Rappels J-1 |

*Document vivant — mettre à jour à chaque sprint.*
