# Calymia — Product Requirements Document
*Version 1.0 — Mars 2026*

| Statut | Description |
|---|---|
| ✅ Fait | Implémenté |
| 🔄 En cours | En cours |
| ⚠️ À faire | Avant lancement |
| 📋 V2 | Post-lancement |

---

## Épic 1 — Authentification & Comptes

### US-01 — Créer un compte sophrologue
**Plan** : Tous | **Statut** : ✅ Fait  
Critères : Email unique validé, mot de passe sécurisé, rôle 'sophrologue' assigné, redirect vers onboarding.

### US-02 — Créer un compte client lors d'une réservation
**Plan** : Tous | **Statut** : ✅ Fait  
Critères : Compte créé automatiquement à la première réservation, email de bienvenue envoyé.

### US-03 — Réinitialiser son mot de passe
**Plan** : Tous | **Statut** : ✅ Fait  
Critères : Email de reset envoyé, lien valide 24h, nouveau mot de passe fonctionnel.

### US-04 — Se déconnecter
**Plan** : Tous | **Statut** : ✅ Fait  
Critères : Session détruite, redirect vers page de connexion.

---

## Épic 2 — Onboarding Sophrologue

### US-05 — Wizard d'onboarding en 5 étapes
**Plan** : Tous | **Statut** : ✅ Fait  
Critères : 5 étapes : Infos → Spécialités → Disponibilités → Vitrine → Confirmation. Progression sauvegardée.

### US-06 — Voir son URL publique dès la fin de l'onboarding
**Plan** : Tous | **Statut** : ⚠️ À faire  
Critères : URL `calymia.com/sophrologues/{dept}/{ville}/{slug}` affichée à l'étape 5 et dans l'email de bienvenue.

### US-07 — Uploader des photos de cabinet lors de l'onboarding
**Plan** : Tous | **Statut** : ✅ Fait  
Critères : Upload jusqu'à 5 photos (Pro), stockées sur Supabase Storage.

### US-08 — Configurer des horaires avec plusieurs plages par jour
**Plan** : Tous | **Statut** : ✅ Fait  
Critères : Jusqu'à 3 plages horaires par jour, format HH:MM, max 7 jours.

---

## Épic 3 — Page Publique & SEO

### US-09 — Page publique indexée sur Google
**Plan** : Tous | **Statut** : ✅ Fait  
Critères : URL SEO, rendu SSR, JSON-LD Person, canonical, Open Graph.

### US-10 — Voir le profil complet du sophrologue
**Plan** : Tous | **Statut** : ✅ Fait  
Critères : Nom, bio, spécialités, photos, horaires, infos pratiques, modes de paiement, formations, séances et tarifs.

### US-11 — Voir le prochain créneau disponible
**Plan** : Tous | **Statut** : ✅ Fait  
Critères : Badge "Prochain disponible : Demain · 14h00" dans la sidebar sticky.

### US-12 — Personnaliser les modes de paiement acceptés
**Plan** : Tous | **Statut** : ✅ Fait  
Critères : CB / Chèque / Espèces configurables dans Paramètres, affichés sur page publique.

---

## Épic 4 — Tunnel de Réservation

### US-13 — Réserver un créneau en ligne
**Plan** : Tous | **Statut** : ✅ Fait  
Critères : Tunnel 4 étapes : créneau → infos → paiement → confirmation. Blocage temporaire 15 min anti-doublon.

### US-14 — Payer en ligne de manière sécurisée
**Plan** : Tous | **Statut** : ✅ Fait  
Critères : Stripe Elements, 3D Secure, facture PDF automatique, confirmation email.

### US-15 — Annuler sa réservation et être remboursé automatiquement
**Plan** : Tous | **Statut** : ✅ Fait  
Critères : Annulation possible jusqu'à X heures avant, remboursement Stripe automatique, email de confirmation.

### US-16 — Sophrologue : annuler une réservation
**Plan** : Tous | **Statut** : ✅ Fait  
Critères : Annulation depuis le dashboard, remboursement Stripe automatique, email client.

---

## Épic 5 — Dashboard Sophrologue

### US-17 — Voir ses KPIs en temps réel
**Plan** : Tous | **Statut** : ✅ Fait  
Critères : CA du mois, nombre de séances, clients actifs, taux d'occupation.

### US-18 — Consulter son agenda en vue semaine
**Plan** : Tous | **Statut** : ✅ Fait  
Critères : Agenda 7 jours, drawer détail par séance, navigation semaine précédente/suivante.

### US-19 — Gérer ses clients depuis une page dédiée
**Plan** : Tous | **Statut** : ✅ Fait  
Critères : Liste clients, fiche détail, historique séances, limite 15 clients sur plan Essentiel.

### US-20 — Prendre des notes sur une séance
**Plan** : Pro+ | **Statut** : ✅ Fait  
Critères : Éditeur Tiptap par séance, sauvegarde automatique, visible uniquement par le sophrologue.

### US-21 — Consulter le journal des communications
**Plan** : Pro+ | **Statut** : ✅ Fait  
Critères : Tableau filtrable par type, date, destinataire, statut.

---

## Épic 6 — Communications Automatiques

### US-22 — Email de rappel J-1
**Plan** : Tous | **Statut** : ✅ Fait  
Critères : Email J-1 via SendGrid, contenu : nom sophrologue, date/heure, adresse.

### US-23 — Email post-séance
**Plan** : Pro+ | **Statut** : ✅ Fait  
Critères : Email post-séance via n8n, contenu personnalisable par le sophrologue.

### US-24 — SMS de rappel J-1
**Plan** : Pro+ | **Statut** : ⚠️ À faire  
Critères : SMS Twilio J-1, géré par workflow n8n.

### US-25 — Personnaliser ses templates d'emails
**Plan** : Pro+ | **Statut** : ✅ Fait  
Critères : Éditeur Tiptap WYSIWYG, placeholders dynamiques, preview en temps réel.

---

## Épic 7 — Plans & Abonnement

### US-26 — Voir son plan actuel et ses limitations
**Plan** : Tous | **Statut** : ✅ Fait  
Critères : Badge plan dans la sidebar, page Abonnement avec tableau comparatif.

### US-27 — Passer à un plan supérieur
**Plan** : Tous | **Statut** : ⚠️ À faire  
Critères : Page `/dashboard/abonnement` avec boutons de changement, intégration Stripe Billing.

### US-28 — Bénéficier de 14 jours d'essai gratuit
**Plan** : Tous | **Statut** : ⚠️ À faire  
Critères : Trial activé à l'inscription, email de fin de trial J-2 avant expiration.

---

## Épic 8 — Vitrine & Paramètres

### US-29 — Gérer sa vitrine depuis l'onglet Paramètres
**Plan** : Tous | **Statut** : ✅ Fait  
Critères : Onglet Cabinet/Vitrine : photos, horaires, infos pratiques, modes paiement, formations, certifications.

### US-30 — Configurer ses types de séances et tarifs
**Plan** : Tous | **Statut** : ✅ Fait  
Critères : Nom, durée, tarif, mode (présentiel/visio), actif/inactif.

---

## Épic 9 — Fonctionnalités V2

### US-31 — Rédiger des articles de blog
**Plan** : Cabinet (V2) | **Statut** : 📋 V2

### US-32 — Gérer un cabinet multi-praticiens
**Plan** : Cabinet (V2) | **Statut** : 📋 V2

### US-33 — Laisser un avis client
**Plan** : Tous (V2) | **Statut** : 📋 V2

### US-34 — Synchronisation Google Agenda
**Plan** : Pro+ (V2) | **Statut** : 📋 V2

---

## Exigences Non-Fonctionnelles

### Performance
- Page publique : First Contentful Paint < 2 secondes
- SSR obligatoire pour toutes les pages publiques
- Temps de réponse API < 500ms pour 95% des requêtes

### Sécurité
- Row Level Security (RLS) Supabase sur toutes les tables
- Données personnelles stockées sur serveurs EU (RGPD)
- HTTPS obligatoire sur tous les endpoints
- Tokens Stripe jamais stockés côté Calymia

### Compatibilité
- Navigateurs : Chrome, Firefox, Safari, Edge (versions N-1)
- Mobile responsive sur toutes les pages publiques et le dashboard
- Accessibilité : contraste suffisant, navigation clavier
