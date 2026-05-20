# Workflows n8n — Calymia

Ce dossier contient les exports JSON de tous les workflows n8n utilisés par Calymia.

## Structure

```
n8n-workflows/
├── Calymia — Cleanup séances.json         # Nettoyage des séances expirées (cron toutes les 15 min)
├── Calymia — Post-séance.json             # Email post-séance au client (cron 20h UTC)
├── Calymia — Rappels J-1.json             # Email rappel J-1 au client (cron 17h UTC)
├── Calymia — Génération Articles v14.json # Génération articles blog via Claude API + WordPress
├── Calymia — Génération Sujets Blog v3.json # Génération sujets blog hebdomadaire (dimanche)
├── Dev/
│   ├── DEV — Calymia — Cleanup séances.json
│   ├── DEV — Calymia — Post-séance.json
│   └── DEV — Calymia — Rappels J-1.json
└── Prospection/
    ├── Calymia — Prospection Toutes Villes v13.json  # Workflow principal multi-villes
    ├── Calymia — Prospection Bordeaux.json
    ├── Calymia — Prospection Grenoble.json
    ├── Calymia — Prospection Lille.json
    ├── Calymia — Prospection Lyon.json
    ├── Calymia — Prospection Marseille.json
    ├── Calymia — Prospection Metz.json
    ├── Calymia — Prospection Montpellier.json
    ├── Calymia — Prospection Nancy.json
    ├── Calymia — Prospection Nantes.json
    ├── Calymia — Prospection Nice.json
    ├── Calymia — Prospection Paris.json
    ├── Calymia — Prospection Rennes.json
    ├── Calymia — Prospection Rouen.json
    ├── Calymia — Prospection Strasbourg.json
    └── Calymia — Prospection Toulouse.json
```

## Environnements

| Dossier | Environnement | URL de base |
|---|---|---|
| Racine | Production | `https://app.calymia.com` |
| `Dev/` | Développement | `https://calymia.vercel.app` |
| `Prospection/` | Production | Google Places API + Google Sheets |

## Serveur n8n

- URL : `https://automation.kls3-dev.com`
- Hébergement : Hetzner

## Import d'un workflow

1. Ouvrir n8n → **Workflows → Import from file**
2. Sélectionner le fichier `.json` correspondant
3. Vérifier les credentials (Resend, Supabase, Google Sheets)
4. Activer le workflow

## Règles prospection

- Dépiner le nœud "Lire Sheet" avant chaque run
- Vider le Google Sheet (garder ligne 1) avant un run complet
- Dédoublonnage par numéro de téléphone sans espaces
- Merge node en mode **append**
- En cas d'erreur 429 (quota Google Places) : attendre ~1 min entre les runs
- Google Sheet ID : `1LeCLK26cUEdlwiU4zO1gA_hhB6phDwNUzirNVn3uZfk` — onglet `🎯 Prospection`
