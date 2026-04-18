# Calymia — Document de Vision
*Version 1.0 — Mars 2026*

## 1. Vision du produit

Calymia est une plateforme SaaS à double entrée pour les sophrologues en France.

> **Vision en une phrase** : Permettre à chaque sophrologue de développer sa clientèle sans effort commercial, grâce à une page publique optimisée Google et un système de réservation en ligne intégré.

### 1.1 Le problème

Les sophrologues font face à trois défis majeurs :

- **Visibilité insuffisante** : introuvables sur Google sans investissement SEO
- **Gestion manuelle** : emails, appels téléphoniques, oublis de RDV
- **Absence d'outils adaptés** : solutions existantes trop génériques ou trop chères

### 1.2 La solution

Calymia crée automatiquement une page publique SEO-optimisée pour chaque sophrologue lors de son inscription, permettant aux clients de le trouver sur Google, voir ses disponibilités et réserver/payer en ligne.

### 1.3 Proposition de valeur

| Pour le sophrologue | Pour le client |
|---|---|
| Page Google sans effort SEO | Trouver un sophrologue via Google |
| Réservations automatiques 24h/24 | Réserver en ligne 24h/24 |
| Rappels automatiques (0 oubli) | Payer en sécurité |
| Dashboard de gestion complet | Rappels automatiques de RDV |
| Paiements sécurisés Stripe | |

---

## 2. Marché & Positionnement

### 2.1 Marché cible

- ~15 000 sophrologues en France (estimation 2025)
- Marché fragmenté, peu d'outils spécialisés
- Maturité numérique croissante
- Acquisition inbound via Google ou bouche-à-oreille

### 2.2 Concurrents

| Concurrent | Forces | Faiblesses |
|---|---|---|
| Doctolib | Notoriété, large base | Trop médical, cher, pas SEO dédié |
| Resalib | Spécialisé bien-être | Design vieillissant, peu de SEO |
| Google My Business | Gratuit, SEO natif | Pas de réservation intégrée |
| Site WordPress perso | Personnalisable | Coûteux à créer et maintenir |

### 2.3 Avantage concurrentiel

- **SEO structurel** : URL optimisées par département/ville/nom, JSON-LD, Open Graph
- **Tout-en-un** : page publique + réservation + paiement + dashboard
- **Prix accessible** : dès 29€/mois vs plusieurs centaines pour un site custom
- **3 minutes** pour créer son profil

---

## 3. Modèle Économique

### 3.1 Abonnements mensuels

| Plan | Prix | Cible | Statut |
|---|---|---|---|
| Essentiel | 29 €/mois | Débutants | MVP ✓ |
| Professionnel | 59 €/mois | Actifs | MVP ✓ |
| Cabinet | 139 €/mois | Multi-praticiens | V2 |

### 3.2 Commission sur réservations

- 3% sur chaque réservation payée en ligne via Stripe Connect
- Aucune commission sur les séances annulées ou remboursées
- Essai gratuit 14 jours sur tous les plans, sans carte bancaire

---

## 4. Parcours Utilisateurs

### 4.1 Parcours Sophrologue

1. **Découverte** via Google ou bouche-à-oreille
2. **Inscription** email + mot de passe
3. **Onboarding 5 étapes** : Infos → Spécialités → Disponibilités → Vitrine → Confirmation
4. **Page publique créée** : `calymia.com/sophrologues/{dept}/{ville}/{slug}`
5. **Dashboard** : agenda, gestion clients, paramètres
6. **Réception de RDV** : notification email à chaque nouvelle réservation
7. **Paiement** : reversement automatique Stripe sous 2-7 jours

### 4.2 Parcours Client

1. Cherche "sophrologue + ville" sur Google
2. Tombe sur la page publique Calymia
3. Consulte le profil : spécialités, tarifs, horaires, photos
4. Choisit un créneau disponible
5. Crée un compte simplifié ou se connecte
6. Paie en ligne via Stripe
7. Reçoit un email de confirmation
8. Reçoit un rappel automatique J-1 par email (et SMS sur plan Pro+)

---

## 5. Objectifs & Métriques

### 5.1 Objectifs de lancement

- 10 premiers sophrologues payants dans les 30 jours
- 50 sophrologues actifs à 3 mois
- Premières réservations organiques à 60 jours
- Taux de churn < 10% mensuel

### 5.2 Métriques clés

| Métrique | Objectif M3 | Objectif M6 |
|---|---|---|
| Sophrologues actifs payants | 50 | 200 |
| MRR | 2 500 € | 10 000 € |
| Réservations en ligne / mois | 150 | 800 |
| Taux conversion essai → payant | > 30% | > 40% |
| Pages publiques indexées Google | 50 | 200 |

---

## 6. Roadmap

### 6.1 MVP — Disponible au lancement

- Authentification & inscription
- Onboarding wizard 5 étapes
- Page publique SSR avec SEO complet
- Tunnel de réservation avec créneaux en temps réel
- Paiement Stripe Connect avec commission automatique
- Dashboard sophrologue : KPIs, agenda, gestion clients
- Emails automatiques : confirmation, rappel J-1, post-séance (Pro+)
- Workflows n8n déployés sur Hetzner
- Site vitrine calymia.com (WordPress)

### 6.2 V2 — Post-lancement

- Plan Cabinet : multi-praticiens (jusqu'à 5)
- Articles blog pour les sophrologues (SEO longue traîne)
- Annuaire / recherche par ville et spécialité
- Avis clients : formulaire token, modération
- Synchronisation Google Agenda
- Stripe Billing self-service

---

## 7. Contraintes & Risques

### 7.1 Contraintes techniques

- SSR obligatoire pour l'indexation Google
- Multi-tenant strict via RLS Supabase
- RGPD : données personnelles stockées en France (Supabase EU)
- Stripe Connect : onboarding obligatoire pour recevoir des paiements

### 7.2 Risques identifiés

| Risque | Impact | Mitigation |
|---|---|---|
| Adoption lente | Élevé | Blog SEO pour trafic organique |
| Concurrence Doctolib | Moyen | Prix inférieur, SEO dédié |
| Résistance paiement en ligne | Moyen | Option CB/Chèque/Espèces |
| Problèmes RGPD | Élevé | RLS Supabase, données EU, CGU |

---

## 8. Équipe & Méthodologie

Développé en solo par Eric Scarpino avec Claude + Cursor. Méthodologie BMAD (Analyst → PM → Architect → Developer). ~10-15h/semaine.

*Collaborateurs potentiels V2 : Lilian, Damien, Paul*
