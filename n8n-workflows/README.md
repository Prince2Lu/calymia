# Workflows n8n — Calymia

Ce dossier contient des exports de workflows pour déclencher les jobs HTTP de Calymia (cleanup, rappels J-1, emails post-séance).

## Fichiers

| Fichier | Endpoint appelé |
|--------|------------------|
| `calymia-cleanup-seances.json` | `GET /api/reservations/cleanup` |
| `calymia-rappels-j1.json` | `GET /api/cron/rappels-j1` |
| `calymia-post-seance.json` | `GET /api/cron/post-seance` |

## Importer un workflow dans n8n

1. Ouvrir n8n → **Workflows**.
2. **⋯** (menu) ou **Add workflow** → **Import from File** (selon la version : **Import** depuis le menu).
3. Choisir le fichier `.json` correspondant.
4. Après import, ouvrir le workflow et vérifier les nœuds **Schedule** et **HTTP Request**.
5. Configurer les variables d’environnement (voir ci-dessous), puis **Save** et **Activate** si vous voulez l’exécution automatique.

> Les routes Next.js acceptent aussi **POST** avec le même en-tête ; vous pouvez changer la méthode dans le nœud HTTP si besoin.

## Variable `CRON_SECRET` et en-tête `Authorization`

L’API Calymia vérifie :

```http
Authorization: Bearer <CRON_SECRET>
```

où `<CRON_SECRET>` est **exactement** la valeur de `CRON_SECRET` dans l’environnement de l’app Next.js / Vercel.

Dans n8n, définissez une variable d’environnement nommée **`CRON_SECRET`** (même valeur que sur Calymia). Les workflows utilisent l’expression :

`Bearer ` + valeur de `CRON_SECRET`.

**Optionnel :** `CALYMIA_BASE_URL` — URL de base sans slash final (ex. `https://calymia.com`). Si elle est absente, l’URL par défaut dans le JSON est `https://calymia.com` : remplacez-la ou définissez `CALYMIA_BASE_URL` pour la prod / le staging.

## Planification (schedules) par workflow

| Workflow | Planification dans le JSON | Rôle |
|----------|----------------------------|------|
| **Cleanup séances** | `*/5 * * * *` — toutes les **5 minutes** | Supprime les créneaux `en_attente` expirés (aligné sur le hold ~15 min). |
| **Rappels J-1** | `0 9 * * *` — tous les jours à **09:00** | Envoi des rappels J-1 ; le workflow est réglé avec **timezone `Europe/Paris`** pour interpréter le cron à l’heure de Paris. |
| **Post-séance** | `*/15 * * * *` — toutes les **15 minutes** | Traite les séances terminées (`fin_at` passé) et envoie l’email post-séance. |

Vous pouvez modifier l’expression cron dans le nœud **Schedule Trigger** (ou l’équivalent selon votre version n8n) sans toucher au code Calymia.

## Sécurité

- Ne commitez pas `CRON_SECRET` dans le dépôt ; utilisez les secrets / env vars de n8n.
- Limitez l’accès au webhook ou à l’instance n8n si elle est exposée sur Internet.
