# CLAUDE.md — Calymia

Fichier de contexte pour Claude Code. À lire en priorité avant toute modification du repo.

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
| **Stripe** | TEST (clés test) | LIVE (clés live) |
| **Branche Git** | `develop` | `main` |
| **Projet Vercel** | `calymia` | `calymia-prod` |

### Règle absolue
**Toujours travailler sur la branche `develop`.** Ne jamais commiter directement sur `main`.  
Le merge `develop` → `main` est fait manuellement par Eric après validation sur DEV.

### Déploiement DEV
```bash
git add .
git commit -m "feat/fix: description"
git push origin develop
vercel link  # sélectionner le projet "calymia" (pas "calymia-prod")
vercel --prod
```

---

## 3. Structure du projet

```
src/
├── app/
│   ├── (auth)/              # Dashboard sophrologue (protégé)
│   │   ├── dashboard/       # KPIs + agenda
│   │   ├── seances/         # Agenda semaine + drawer détail
│   │   ├── clients/         # Liste + fiche client [id]
│   │   ├── patient/         # Espace client
│   │   ├── parametres/      # 4 onglets dont Cabinet/Vitrine
│   │   ├── emails/          # Templates emails (Pro+)
│   │   ├── communications/  # Journal (Pro+)
│   │   └── abonnement/      # Plans & abonnement
│   ├── (public)/
│   │   └── sophrologues/[dept]/[ville]/[slug]/  # Page publique SSR
│   │       └── reserver/    # Tunnel réservation 4 étapes
│   ├── onboarding/          # Wizard 5 étapes
│   ├── inscription/         # Création compte
│   ├── connexion/           # Login
│   └── api/
│       ├── stripe/          # Webhooks Stripe
│       ├── sophrologue/     # CRUD sophrologue
│       ├── reservations/    # Gestion réservations
│       └── cron/            # Endpoints n8n (rappels-j1, post-seance, cleanup-seances)
├── components/
│   ├── factures/            # BoutonFacture.tsx
│   ├── public/              # SophrologueRppsLine.tsx (infobulle RPPS, "use client")
│   ├── ui/                  # Composants partagés
│   └── ...
├── hooks/
│   ├── useFacture.ts        # Récupère facture_url depuis paiements
│   ├── usePlan.ts           # Restrictions selon plan sophrologue
│   └── ...
└── lib/
    ├── factures/
    │   └── generate.tsx     # Génération PDF reçu de paiement
    ├── emails/
    │   └── templates.ts     # Templates emails Resend
    ├── horaires.ts          # normalizeHoraires(), resolvePublicHoraires(), horairesFromDisponibilites()
    ├── supabase/            # Clients Supabase (browser + server)
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

### Tables principales
| Table | Colonnes clés | Notes |
|---|---|---|
| `sophrologues` | `id`, `user_id`, `slug`, `plan`, `horaires` (JSONB), `photos_cabinet` | `plan` = 'essentiel' / 'professionnel' / 'cabinet' |
| `patients` | `id`, `user_id`, `sophrologue_id` | Pas `clients` — toujours `patients` |
| `seances` | `id`, `sophrologue_id`, `patient_id`, `debut_at`, `fin_at`, `statut` | `statut` = 'confirmee' / 'terminee' / 'annulee' |
| `paiements` | `id`, `seance_id`, `sophrologue_id`, `statut`, `montant_total`, `facture_url` | `statut` = 'reussi' / 'rembourse' |
| `types_seances` | `id`, `sophrologue_id`, `nom`, `duree_minutes`, `tarif`, `actif` | |
| `disponibilites` | `id`, `sophrologue_id`, `date_heure_debut`, `date_heure_fin`, `est_reserve` | |
| `email_templates` | `id`, `sophrologue_id`, `type`, `sujet`, `contenu_html` | FK sur `sophrologues.user_id` (pas `.id`) |

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
| `factures` | Public | Reçus PDF (`CAL-{année}-{seq}.pdf`) |

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

### SSR — obligatoire sur les pages publiques
Toutes les pages sous `(public)/` doivent être en SSR (Server Side Rendering).  
Ne jamais ajouter `"use client"` sur les pages publiques sophrologues.

### Plans et restrictions
```typescript
import { usePlan } from "@/hooks/usePlan"
import { PlanGuard } from "@/components/PlanGuard"

// Toute nouvelle feature Pro+ doit être protégée
<PlanGuard feature="notes">
  <NotesSeance />
</PlanGuard>
```

Plans : `essentiel` (29€, max 15 clients) / `professionnel` (59€, illimité) / `cabinet` (139€, V2)

### Stripe — deux secrets distincts
- `STRIPE_WEBHOOK_SECRET` est différent entre DEV et PROD
- Ne jamais utiliser la même valeur dans les deux environnements
- Le webhook est dans `src/app/api/stripe/webhook/route.ts`

### Client Supabase
```typescript
// Côté client (composants "use client")
import { createSupabaseBrowserClient } from "@/lib/supabase/client"

// Côté serveur (API routes, Server Components)
import { createClient } from "@supabase/supabase-js"
// avec SUPABASE_SERVICE_ROLE_KEY pour les opérations admin
```

---

## 6. Patterns établis

### Facture PDF
- Générée dans `src/lib/factures/generate.tsx` via `@react-pdf/renderer`
- Déclenchée par le webhook `payment_intent.succeeded`
- Stockée dans bucket `factures`, URL sauvegardée dans `paiements.facture_url`
- Accessible au sophrologue via `<BoutonFacture seanceId={...} />` ou `factureUrl` passé directement
- Accessible dans l'espace client (`/patient`) sur prochains RDV et historique
- Email sophrologue inclut le lien facture après chaque paiement réussi
- Email client inclut les coordonnées du sophrologue (tél, email, adresse) dans un encadré vert

### Horaires — deux sources, une logique de résolution
- `sophrologues.horaires` (JSONB) : horaires affichés sur la page publique, configurables dans Paramètres → Cabinet/vitrine
- `disponibilites` : créneaux réservables en ligne, configurables dans Paramètres → Disponibilités et onboarding étape 3
- Sur la page publique SSR : `resolvePublicHoraires(sophrologue.horaires, disponibilites)` depuis `src/lib/horaires.ts` — priorité au JSONB, sinon dérivé des disponibilités
- **Ne jamais afficher les horaires dans l'onboarding étape 4 (vitrine)** — supprimé car redondant avec étape 3

### Composants SSR avec interaction client
- Les pages publiques restent en SSR (`(public)/`)
- Si un bloc nécessite un état client (ex: infobulle toggle sur mobile), l'isoler dans un petit composant `"use client"` dédié
- Exemple : `src/components/public/SophrologueRppsLine.tsx` (infobulle RPPS)

### Page publique — champs affichés
- `numero_rpps` : affiché au-dessus de la section photos cabinet, uniquement si renseigné, avec infobulle définition
- Tél, email, adresse : **non affichés** sur la page publique (force la réservation en ligne, protège la commission 3%)
- Ces coordonnées sont transmises uniquement dans l'email de confirmation client

### Suppression d'un compte sophrologue en base (ordre FK)
```sql
DELETE FROM paiements WHERE sophrologue_id = (SELECT id FROM sophrologues WHERE user_id = '...');
DELETE FROM communications WHERE seance_id IN (SELECT id FROM seances WHERE sophrologue_id = (SELECT id FROM sophrologues WHERE user_id = '...'));
DELETE FROM seances WHERE sophrologue_id = (SELECT id FROM sophrologues WHERE user_id = '...');
DELETE FROM disponibilites WHERE sophrologue_id = (SELECT id FROM sophrologues WHERE user_id = '...');
DELETE FROM types_seances WHERE sophrologue_id = (SELECT id FROM sophrologues WHERE user_id = '...');
DELETE FROM patients WHERE sophrologue_id = (SELECT id FROM sophrologues WHERE user_id = '...');
DELETE FROM sophrologues WHERE user_id = '...';
-- Puis supprimer l'user dans Supabase → Authentication → Users
```

### n8n — workflows déployés sur Hetzner (`automation.kls3-dev.com`)
| Workflow | Déclencheur | Action |
|---|---|---|
| `rappels-j1` | Cron 17h UTC | Emails rappel J-1 aux clients |
| `post-seance` | Cron 20h UTC | Emails post-séance (Pro+) |
| `cleanup-seances` | Cron /15min | Supprime séances en_attente expirées |

Les workflows appellent les endpoints `/api/cron/*` avec un Bearer token (`CRON_SECRET`).  
**Ne jamais modifier les endpoints cron sans mettre à jour les workflows n8n.**

### URLs publiques
```
calymia.com/sophrologues/{dept}/{ville}/{slug}
Exemple : calymia.com/sophrologues/57-moselle/sarreguemines/marie-dupont-sophrologue
```
Toujours utiliser `NEXT_PUBLIC_APP_URL` — jamais hardcoder `app.calymia.com` ou `calymia.vercel.app`.

---

## 7. Comptes de test (DEV uniquement — calymia.vercel.app)

**Mot de passe universel : `Test123456!`**

### Sophrologues

| | Sophie Marchand | Thomas Petit |
|---|---|---|
| **Email** | `scarpinoeric@gmail.com` | `eric@calymia.com` |
| **Plan** | Essentiel (29€) | Professionnel (59€) |
| **Ville** | Lyon (69) | Paris (75) |
| **sophrologue_id** | `1375cd38-9a25-4dd6-b876-d41feea6c2b5` | `dd607be9-4aa9-44b7-a7ab-19c4b7e59027` |
| **URL publique DEV** | `calymia.vercel.app/sophrologues/69-rhone/lyon/sophie-marchand-lyon` | `calymia.vercel.app/sophrologues/75-paris/paris/thomas-petit-sophrologie` |
| **Cas** | 14/15 clients, limite Essentiel | 3 clients, notes séance Pro |

### Clients

| Prénom & Nom | Email | Sophrologue | Cas testé |
|---|---|---|---|
| Marie Dupont | `contact@kls3-dev.com` | Sophie | 6 séances, post-séance hier |
| Camille Aubert | `scarpinolisa@gmail.com` | Sophie | RDV dans 3 jours |
| Jean-Paul Renaud | `scarpinolilian@gmail.com` | Sophie | RDV demain → rappel J-1 |
| Amandine Roux | `scarpinoveronique@gmail.com` | Sophie | Séance annulée |
| Lucas Bernard | `scarpi.business@gmail.com` | Thomas | Post-séance + notes Pro |

### Cartes Stripe TEST
- `4242 4242 4242 4242` / `12/26` / `123` → paiement réussi
- `4000 0025 0000 3155` / `12/26` / `123` → 3D Secure
- `4000 0000 0000 9995` / `12/26` / `123` → paiement refusé

### Tests emails manuels (curl)
```bash
# Rappel J-1
curl -X POST https://calymia.vercel.app/api/cron/rappels-j1 \
  -H "Authorization: Bearer {CRON_SECRET}"

# Post-séance
curl -X POST https://calymia.vercel.app/api/cron/post-seance \
  -H "Authorization: Bearer {CRON_SECRET}"
```

### URLs utiles DEV
- Inscription : `calymia.vercel.app/inscription`
- Connexion : `calymia.vercel.app/connexion`
- Page démo (noindex) : `calymia.com/demo`

---

## 8. Ce qui est en V2 (ne pas implémenter maintenant)

- SMS Twilio rappels J-1
- Avis clients (table + token + modération)
- Multi-praticiens plan Cabinet
- Annuaire sophrologues / recherche
- Google Agenda sync
- Articles blog sophrologues (Tiptap déjà en place, URL `/articles/{slug}`)

---

## 9. Checklist avant chaque PR develop → main

- [ ] `npx tsc --noEmit` passe sans erreur
- [ ] Testé sur `calymia.vercel.app` (DEV)
- [ ] Aucun `console.log` de debug laissé
- [ ] `NEXT_PUBLIC_APP_URL` utilisé (jamais d'URL hardcodée)
- [ ] Resend utilisé pour les emails (jamais SendGrid)
- [ ] Branche `develop` uniquement (jamais commit direct sur `main`)
