# CLAUDE.md — Calymia

Fichier de contexte pour Claude Code. À lire en priorité avant toute modification du repo.

Dernière mise à jour : 24 juillet 2026

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

### Déploiement PROD
```bash
git checkout main
git pull origin main
git merge develop
git push origin main
git checkout develop
```

---

## 3. Structure du projet

```
src/
├── app/
│   ├── (auth)/              # Dashboard sophrologue (protégé)
│   │   ├── dashboard/       # KPIs + agenda + score complétude profil
│   │   ├── seances/         # Agenda semaine + drawer détail
│   │   ├── clients/         # Liste + fiche client [id]
│   │   ├── patient/         # Espace client
│   │   ├── parametres/      # 4 onglets dont Cabinet/Vitrine
│   │   ├── emails/          # Templates emails (Pro+)
│   │   ├── communications/  # Journal (Pro+)
│   │   └── abonnement/      # Plans & abonnement ✅ Stripe Billing actif
│   ├── (public)/
│   │   └── sophrologues/[dept]/[ville]/[slug]/  # Page publique SSR
│   │       └── reserver/    # Tunnel réservation 4 étapes
│   ├── onboarding/          # Wizard 5 étapes
│   ├── inscription/         # Création compte
│   ├── connexion/           # Login
│   └── api/
│       ├── auth/            # create-client-account, check-email
│       ├── stripe/          # Webhooks Stripe
│       ├── sophrologue/     # CRUD sophrologue
│       ├── reservations/    # create-payment-intent, annuler
│       └── cron/            # Endpoints n8n (rappels-j1, post-seance, cleanup-seances)
├── components/
│   ├── dashboard/
│   │   ├── ProfileScoreCard.tsx         # Widget score complétude (Server Component)
│   │   └── ProfileScoreCardWrapper.tsx  # Wrapper client pour ProfileScoreCard
│   ├── factures/            # BoutonFacture.tsx
│   ├── providers/           # SophrologueProvider.tsx
│   ├── public/              # SophrologueRppsLine.tsx (infobulle RPPS, "use client")
│   ├── seances/             # SeancesCalendar.tsx, types.ts
│   ├── ui/                  # Composants partagés (attention : cn() sans twMerge, voir section 8)
│   └── ...
├── hooks/
│   ├── useFacture.ts        # Récupère facture_url depuis paiements
│   ├── usePlan.ts           # Restrictions selon plan sophrologue
│   └── ...
└── lib/
    ├── auth/
    │   └── sophrologue-session.ts  # getSophrologueSession() avec cache() React
    ├── billing/
    │   └── trial-status.ts  # computeTrialDaysRemaining(), getSidebarPlanBadge()
    ├── config/
    │   └── site-url.ts      # getSiteUrl(), getSophrologueProfileUrl()
    ├── factures/
    │   └── generate.tsx     # Génération PDF reçu de paiement
    ├── emails/
    │   └── templates.ts     # Templates emails Resend
    ├── profile-score.ts     # computeProfileScore(), ProfileScoreItem, SophrologueRow
    ├── horaires.ts          # normalizeHoraires(), resolvePublicHoraires(), horairesFromDisponibilites()
    ├── supabase/            # Clients Supabase (browser + server)
    ├── utils.ts             # cn() — ⚠️ simple join(), pas de twMerge (voir section 8)
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

### Tables principales
| Table | Colonnes clés | Notes |
|---|---|---|
| `sophrologues` | `id`, `user_id`, `slug`, `plan`, `horaires` (JSONB), `photos_cabinet` | `plan` = 'essentiel' / 'professionnel' / 'cabinet' |
| `patients` | `id`, `user_id`, `sophrologue_id` | Pas `clients` — toujours `patients`. Voir modèle d'identité ci-dessus |
| `seances` | `id`, `sophrologue_id`, `patient_id`, `debut_at`, `fin_at`, `statut` | `statut` = 'confirmee' / 'terminee' / 'annulee' |
| `paiements` | `id`, `seance_id`, `sophrologue_id`, `statut`, `montant_total`, `facture_url` | `statut` = 'reussi' / 'rembourse' |
| `types_seances` | `id`, `sophrologue_id`, `nom`, `duree_minutes`, `tarif`, `actif` | |
| `disponibilites` | `id`, `sophrologue_id`, `date_heure_debut`, `date_heure_fin`, `est_reserve` | |
| `communications` | `id`, `sophrologue_id`, `patient_id`, `seance_id`, `type`, `statut` | ⚠️ Pas `communications_log` |
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
| `factures` | Privé (URL signée) | Reçus PDF (`CAL-{année}-{seq}.pdf`) |

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

### SSR — obligatoire sur les pages publiques
Toutes les pages sous `(public)/` doivent être en SSR (Server Side Rendering).
Ne jamais ajouter `"use client"` sur les pages publiques sophrologues. Si un bloc nécessite
un état client (ex: infobulle toggle sur mobile), l'isoler dans un petit composant
`"use client"` dédié — exemple : `src/components/public/SophrologueRppsLine.tsx`.

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

### Trial Stripe Billing
- Nouveaux inscrits → `plan = 'professionnel'` + `trial_ends_at = now + 14j`
- Après 14j sans paiement → downgrade vers `essentiel` via webhook Stripe
- Ne jamais modifier `plan` manuellement en dehors des webhooks Stripe (sauf offre fondateur,
  voir mémoire commerciale : 3 mois gratuits pour les 10 premiers clients, `trial_ends_at`
  modifié manuellement dans ce cas précis)

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

### Performance — session partagée (22 juillet 2026)
Utiliser `getSophrologueSession()` (`src/lib/auth/sophrologue-session.ts`, avec `cache()`
React) plutôt que d'appeler `getUser()` plusieurs fois dans une même requête. Les pages
protégées lourdes doivent être des Server Components avec fetch SSR plutôt que des
`useEffect` côté client — a permis de faire passer la page Agenda de 2,88s à ~1,1s.

⚠️ **Attention Vercel serverless** : le fire-and-forget async (`waitUntil`) ne fonctionne
que s'il est appelé directement depuis un Request handler, pas depuis une fonction utilitaire.
Dans les fonctions cron, utiliser des `await` explicites.

---

## 6. Patterns établis

### Score de complétude du profil
- Calcul dans `src/lib/profile-score.ts` — fonction `computeProfileScore(sophrologue, supabase)`
- 10 critères × 10 points = score 0–100
- Affiché dans le dashboard via `ProfileScoreCardWrapper` (Client Component) → `ProfileScoreCard`
- Critères : photo_url, bio (>50 chars), specialites, types_seances actifs, disponibilites, horaires JSONB, photos_cabinet, formations, numero_rpps, syndicats
- Liens directs vers `/parametres?tab={profil|seances|disponibilites|vitrine}` — ⚠️ **pas**
  `/dashboard/parametres` (bug corrigé le 24 juillet 2026 : `/parametres` est un sibling de
  `/dashboard`, pas un sous-dossier)
- `SophrologueRow` : type structurel défini dans `profile-score.ts` (pas de type centralisé pour l'instant)

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
⚠️ En attente (24 juillet 2026) : `Génération Articles Blog v14` et `Génération Sujets Blog v3`
existent sur n8n mais ne sont pas encore poussés vers ce dossier.

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

⚠️ **Bug connu et non corrigé** : `cn()` dans `src/lib/utils.ts` est un simple `join()`, sans
`tailwind-merge`. Un `className` conditionnel peut ne pas s'appliquer visuellement si Tailwind
génère les classes par défaut du composant après celles injectées (`bg-white` du composant
`Input` peut visuellement l'emporter sur un `bg-slate-100` injecté). Contournement actuel :
classes avec `!important` (`!bg-slate-100`) sur les cas ponctuels déjà touchés
(`reserver/page.tsx`). **Fix de fond à prévoir** : installer `tailwind-merge` et réécrire
`cn()` — impact potentiellement large sur toute l'app (tout composant avec `className`
conditionnel), à faire dans une session dédiée avec vérification visuelle globale, pas en
urgence.

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

---

## Note finale

Ce fichier est un document vivant. Il doit être mis à jour à chaque session avec les
nouvelles décisions techniques, les bugs résolus et les patterns établis.
