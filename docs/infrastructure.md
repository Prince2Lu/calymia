# Calymia — Infrastructure Dev & Production
*Version 2.0 — Avril 2026 — Relu par Architecte + Release Manager*

## Résumé des changements V2

| Point | Correction apportée |
|---|---|
| WordPress prod unique | Une seule version prod — pas de staging WP |
| CRON_SECRET distinct dev/prod | Deux secrets séparés |
| Stripe Connect non transférable | Section 6.3 — procédure reconnexion sophrologues |
| Migration SQL manuelle → CLI | `npx supabase db push` |
| Rollback documenté | Section 11 |
| Monitoring n8n | Section 7.3 |
| Critères de validation | Section 9 |
| Ordre de mise en prod | Section 10 avec ordre strict |
| Smoke tests | Section 10.3 |

---

## 1. Vue d'ensemble

| | Dev | Prod |
|---|---|---|
| URL app | calymia.vercel.app | app.calymia.com |
| URL sophrologues | calymia.vercel.app/sophrologues/... | app.calymia.com/sophrologues/... |
| URL vitrine + blog | calymia.com (prod unique) | calymia.com (prod unique) |
| Branche Git | develop | main |
| Stripe | Mode test — cartes 4242 | Mode live — vrais paiements |
| Supabase | cdfltpuzlkyoymjgdhcr (existant) | Nouveau projet à créer |
| CRON_SECRET | Secret dev (unique) | Secret prod (unique) |
| n8n CALYMIA_BASE_URL | https://calymia.vercel.app | https://app.calymia.com |

> ⛔ **RÈGLE ABSOLUE** : ne jamais utiliser les clés Stripe live en dev. Ne jamais partager CRON_SECRET entre dev et prod.

---

## 2. Git — Stratégie de branches

| Branche | Rôle | Déploiement |
|---|---|---|
| `develop` | Développement, tests, démo clients | calymia.vercel.app |
| `main` | Production — code validé uniquement | app.calymia.com |

**Workflow quotidien** :
1. Toujours développer sur `develop`
2. Tester sur calymia.vercel.app
3. Quand critères de validation remplis : PR develop → main
4. Le merge déclenche le déploiement sur app.calymia.com

```bash
git checkout -b develop
git push -u origin develop
```

---

## 3. DNS

### calymia.com → WordPress (prod unique)
Aucun changement — reste pointé vers Hetzner.

> ⚠️ WordPress est en production directe. Toute modification est immédiatement visible.

### app.calymia.com → Vercel (Next.js)

| Type | Nom | Valeur | TTL |
|---|---|---|---|
| CNAME | app | cname.vercel-dns.com | 3600 |

Ensuite : Vercel → Settings → Domains → ajouter app.calymia.com → branche main.

---

## 4. Vercel — Variables d'environnement

| Variable | Dev (Preview) | Prod (Production) | Statut |
|---|---|---|---|
| `NEXT_PUBLIC_APP_URL` | https://calymia.vercel.app | https://app.calymia.com | À mettre à jour |
| `NEXT_PUBLIC_SUPABASE_URL` | https://cdfltpuzl....supabase.co | https://[nouveau].supabase.co | Nouveau projet |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Clé actuelle | Clé nouveau projet | Nouveau projet |
| `SUPABASE_SERVICE_ROLE_KEY` | Clé actuelle | Clé nouveau projet | Nouveau projet |
| `STRIPE_SECRET_KEY` | sk_test_... | sk_live_... | À remplacer |
| `STRIPE_WEBHOOK_SECRET` | whsec_dev_... | whsec_prod_... | À créer |
| `SENDGRID_API_KEY` | Même clé | Même clé | OK |
| `CRON_SECRET` | Secret DEV | Secret PROD | À générer |
| `TWILIO_*` | Même compte | Même compte | OK |

**Générer un CRON_SECRET** : `openssl rand -hex 32`

---

## 5. Supabase — Deux projets

### Projet dev (existant)
- Project ID : `cdfltpuzlkyoymjgdhcr`
- Site URL : https://calymia.vercel.app

### Projet prod (à créer)
- Nom : calymia-prod
- Région : eu-central-1 (Frankfurt) — RGPD
- Site URL : https://app.calymia.com
- Redirect URLs : https://app.calymia.com/**

### Procédure migration SQL (CLI)

```bash
npm install -g supabase
npx supabase link --project-ref [ID_PROJET_PROD]
npx supabase db diff
npx supabase db push
```

> ⛔ Désactiver la migration UPDATE essentiel→professionnel AVANT d'appliquer en prod.

---

## 6. Stripe — Deux modes

### Mode test (dev)
- Clé : `sk_test_...`
- Webhook : `calymia.vercel.app/api/stripe/webhook`
- Cartes de test : `4242 4242 4242 4242`

### Mode live (prod)

1. Activer le compte Stripe live
2. Créer webhook → `https://app.calymia.com/api/stripe/webhook`
3. Événements : `payment_intent.succeeded`, `charge.refunded`, `account.updated`
4. Copier `whsec_prod_...` → Vercel `STRIPE_WEBHOOK_SECRET` (Production)
5. Copier `sk_live_...` → Vercel `STRIPE_SECRET_KEY` (Production)
6. Tester un paiement réel de 1€

> ⚠️ Le webhook secret est **différent** entre dev et prod. Ne jamais utiliser le même.

### Stripe Connect — Point critique au lancement

> ⛔ Les comptes Stripe Connect de test ne sont PAS transférables en mode live. Chaque sophrologue devra reconnecter son compte Stripe lors du passage en prod.

---

## 7. n8n — Un seul serveur, deux configurations

| Variable | Dev | Prod |
|---|---|---|
| `CALYMIA_BASE_URL` | https://calymia.vercel.app | https://app.calymia.com |
| `CRON_SECRET` | Secret DEV | Secret PROD (différent) |
| `N8N_BLOCK_ENV_ACCESS_IN_NODE` | false | false |

**Basculer vers prod** :
```bash
nano /opt/n8n/docker-compose.yml
# Changer CALYMIA_BASE_URL et CRON_SECRET
docker compose down && docker compose up -d
```

### Monitoring et alertes

- Activer les notifications d'échec : Settings → Workflows → Error Workflow
- Créer un workflow d'alerte email si un workflow Calymia échoue
- Vérifier les logs manuellement une fois par semaine au lancement

### Procédure si n8n est hors service

```bash
ssh root@automation.kls3-dev.com
cd /opt/n8n && docker compose up -d
docker logs n8n-n8n-1 --tail 50
```

---

## 8. WordPress — Production unique

> ⚠️ WordPress est en production directe. Toute modification est immédiatement visible. Tester dans les DevTools avant d'appliquer.

### CTAs à mettre à jour pour la prod

| Emplacement | URL actuelle (dev) | URL prod |
|---|---|---|
| Header HFCM — Connexion | calymia.vercel.app/connexion | app.calymia.com/connexion |
| Footer HFCM — Connexion | calymia.vercel.app/connexion | app.calymia.com/connexion |
| Article CTA — Créer mon profil | calymia.vercel.app/inscription | app.calymia.com/inscription |
| Article CTA — Trouver un sophrologue | calymia.vercel.app/inscription | app.calymia.com/inscription |

---

## 9. Critères de validation avant merge develop → main

> ⛔ Un merge vers main n'est autorisé que si TOUS ces critères sont satisfaits.

### Fonctionnel
- [ ] Parcours sophrologue complet : inscription → onboarding → page publique
- [ ] Parcours client : réservation → paiement → email confirmation
- [ ] Annulation : remboursement + email client
- [ ] Dashboard : KPIs, agenda, gestion clients
- [ ] Notes de séance (Pro+)

### Technique
- [ ] `npx tsc --noEmit` passe sans erreur
- [ ] `npm run build` passe sans erreur
- [ ] Pas de console.error dans les logs Vercel

### Sécurité
- [ ] RLS Supabase vérifié
- [ ] Variables sensibles non exposées côté client
- [ ] Webhook Stripe : signature validée

---

## 10. Ordre strict de mise en production

> ⚠️ Prévenir les sophrologues de test J-1 — ils devront reconnecter Stripe.

| Ordre | Action | Durée | Vérification |
|---|---|---|---|
| 1 | Créer projet Supabase prod + migrations | 30 min | Toutes les tables présentes |
| 2 | Configurer Supabase : URL + Redirect + Buckets | 10 min | Auth fonctionne |
| 3 | Générer CRON_SECRET prod | 2 min | Clé générée |
| 4 | Configurer Stripe live + webhook prod | 15 min | Webhook actif |
| 5 | Mettre à jour variables Vercel (Production) | 10 min | Variables sauvées |
| 6 | Ajouter CNAME app → cname.vercel-dns.com | 5 min | DNS en propagation |
| 7 | Ajouter app.calymia.com dans Vercel → Domains | 5 min | Domaine vérifié |
| 8 | Attendre propagation DNS | Variable | app.calymia.com accessible |
| 9 | Merger develop → main (PR GitHub) | 2 min | Déploiement Vercel lancé |
| 10 | Mettre à jour n8n : CALYMIA_BASE_URL + CRON_SECRET | 5 min | 3 workflows actifs |
| 11 | Mettre à jour CTAs WordPress (HFCM) | 10 min | Liens vérifiés |
| 12 | Smoke tests | 15 min | Tous les tests passent |

### Smoke tests post-déploiement

| # | Test | Résultat attendu |
|---|---|---|
| 1 | Ouvrir app.calymia.com | Page connexion visible |
| 2 | Créer un compte sophrologue | Onboarding lancé |
| 3 | Compléter l'onboarding | Page publique accessible |
| 4 | Réserver + paiement réel | Email confirmation reçu |
| 5 | Vérifier webhook Stripe | Event payment_intent.succeeded |
| 6 | Vérifier dans le dashboard | Séance visible et confirmée |
| 7 | Annuler la séance | Remboursement + email client |
| 8 | Vérifier CTAs calymia.com/blog | Liens → app.calymia.com |

---

## 11. Procédures de rollback

### Vercel (code Next.js)
Vercel Dashboard → Deployments → dernier déploiement stable → Promote to Production. Rétabli en < 30 secondes.

### Supabase
> ⚠️ Supabase ne supporte pas le rollback natif. Toujours écrire une down migration avant d'appliquer en prod.

### WordPress
Console Hetzner → Backups → snapshot antérieur → Restore.
> ⚠️ Un rollback Hetzner remet aussi n8n à son état. Vérifier les 3 workflows Calymia après.

### n8n
Les workflows sont versionnés dans `n8n-workflows/`. Importer le JSON depuis GitHub : Add workflow → Import from file.

---

## 12. Résumé final — qui pointe où

| Service | Dev | Prod |
|---|---|---|
| Site vitrine | calymia.com | calymia.com |
| Blog | calymia.com/blog/ | calymia.com/blog/ |
| App Next.js | calymia.vercel.app | app.calymia.com |
| Pages sophrologues | calymia.vercel.app/sophrologues/... | app.calymia.com/sophrologues/... |
| Dashboard | calymia.vercel.app/dashboard | app.calymia.com/dashboard |
| Inscription | calymia.vercel.app/inscription | app.calymia.com/inscription |
| n8n | automation.kls3-dev.com | automation.kls3-dev.com |
| Stripe webhook | calymia.vercel.app/api/stripe/webhook | app.calymia.com/api/stripe/webhook |
| Supabase | cdfltpuzlkyoymjgdhcr | nouveau projet prod |
