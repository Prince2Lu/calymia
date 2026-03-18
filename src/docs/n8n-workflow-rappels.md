# WF_CALYMIA_RAPPEL_24H — Workflow n8n : rappels automatiques par email

## Vue d'ensemble

Ce workflow s'exécute chaque matin à 8h00 et envoie un email de rappel à chaque patient ayant une séance confirmée le lendemain, puis met à jour le flag `rappel_email_envoye` dans Supabase pour éviter les doublons.

```
[Cron 8h00]
     │
     ▼
[HTTP Request → Supabase] — récupère les séances du lendemain (confirmées, rappel non envoyé)
     │
     ▼
[IF] — aucune séance ?
  └─► [NoOp / log "Rien à envoyer"]
     │
     ▼
[SplitInBatches] — traite une séance à la fois
     │
     ├─► [HTTP Request → SendGrid] — envoie l'email de rappel
     │
     └─► [HTTP Request → Supabase PATCH] — marque rappel_email_envoye = true
     │
     ▼
[Set] — construit le résumé final
     │
     ▼
[NoOp / log résumé]
```

---

## Prérequis

| Variable n8n (credentials) | Description |
|---|---|
| `SUPABASE_URL` | URL de votre projet Supabase (ex : `https://xxxx.supabase.co`) |
| `SUPABASE_SERVICE_KEY` | Clé `service_role` Supabase (bypasse RLS) |
| `SENDGRID_API_KEY` | Clé API SendGrid (commence par `SG.`) |
| `SENDGRID_FROM_EMAIL` | Email expéditeur vérifié dans SendGrid (ex : `noreply@calymia.fr`) |
| `SENDGRID_FROM_NAME` | Nom affiché (ex : `Calymia`) |

Créez ces credentials dans **n8n → Settings → Credentials** en tant que variables d'environnement ou Header Auth.

---

## Nœud 1 — Schedule Trigger (Cron)

| Champ | Valeur |
|---|---|
| **Trigger** | Schedule |
| **Rule** | Every Day |
| **Hour** | `8` |
| **Minute** | `0` |
| **Timezone** | `Europe/Paris` |

Expression cron équivalente : `0 8 * * *`

---

## Nœud 2 — HTTP Request : récupérer les séances

| Champ | Valeur |
|---|---|
| **Method** | GET |
| **URL** | `={{ $vars.SUPABASE_URL }}/rest/v1/seances` |

### Query Parameters

| Paramètre | Valeur |
|---|---|
| `select` | `*,patients(*),sophrologues(*)` |
| `statut` | `eq.confirmee` |
| `rappel_email_envoye` | `eq.false` |
| `debut_at` | `gte.{{ new Date(new Date().setDate(new Date().getDate()+1)).toISOString().split('T')[0] }}T08:00:00` |
| `debut_at` | `lte.{{ new Date(new Date().setDate(new Date().getDate()+1)).toISOString().split('T')[0] }}T20:00:00` |

> **Note** : Pour filtrer sur deux valeurs du même paramètre (`debut_at` gte et lte), ajoutez-les comme deux entrées distinctes dans la liste Query Parameters — PostgREST les accepte les deux.

### Headers

| Header | Valeur |
|---|---|
| `apikey` | `={{ $vars.SUPABASE_SERVICE_KEY }}` |
| `Authorization` | `Bearer {{ $vars.SUPABASE_SERVICE_KEY }}` |
| `Content-Type` | `application/json` |
| `Prefer` | `return=representation` |

### Options

- **Response Format** : JSON
- Activer **"Continue on Fail"** pour ne pas bloquer si Supabase est indisponible.

---

## Nœud 3 — IF : y a-t-il des séances ?

| Champ | Valeur |
|---|---|
| **Condition** | `{{ $json.length }}` |
| **Operation** | Greater than |
| **Value** | `0` |

- **True** → continue vers SplitInBatches
- **False** → branche vers un nœud **NoOp** avec note "Aucun rappel à envoyer"

---

## Nœud 4 — SplitInBatches

| Champ | Valeur |
|---|---|
| **Batch Size** | `1` |
| **Options → Reset** | désactivé |

Chaque itération expose une séance dans `$json`.

---

## Nœud 5 — HTTP Request : envoyer l'email via SendGrid

| Champ | Valeur |
|---|---|
| **Method** | POST |
| **URL** | `https://api.sendgrid.com/v3/mail/send` |

### Headers

| Header | Valeur |
|---|---|
| `Authorization` | `Bearer {{ $vars.SENDGRID_API_KEY }}` |
| `Content-Type` | `application/json` |

### Body (JSON brut)

```json
{
  "personalizations": [
    {
      "to": [
        {
          "email": "={{ $json.patients.email }}",
          "name": "={{ $json.patients.prenom }} {{ $json.patients.nom }}"
        }
      ],
      "subject": "Rappel de votre séance demain avec {{ $json.sophrologues.prenom }} {{ $json.sophrologues.nom }}"
    }
  ],
  "from": {
    "email": "={{ $vars.SENDGRID_FROM_EMAIL }}",
    "name": "={{ $vars.SENDGRID_FROM_NAME }}"
  },
  "content": [
    {
      "type": "text/html",
      "value": "={{ '<html><body style=\"font-family:Arial,sans-serif;color:#1f2933;max-width:600px;margin:auto;padding:24px\"><img src=\"https://calymia.fr/logo.png\" alt=\"Calymia\" height=\"36\" style=\"margin-bottom:24px\"><h2 style=\"color:#1E3A5F\">Rappel de votre séance demain</h2><p>Bonjour ' + $json.patients.prenom + ',</p><p>Nous vous rappelons votre séance de sophrologie prévue <strong>demain</strong> :</p><table style=\"border-collapse:collapse;width:100%;margin:16px 0\"><tr><td style=\"padding:8px 12px;background:#f8fafc;border:1px solid #e2e8f0\"><strong>Sophrologue</strong></td><td style=\"padding:8px 12px;border:1px solid #e2e8f0\">' + $json.sophrologues.prenom + ' ' + $json.sophrologues.nom + '</td></tr><tr><td style=\"padding:8px 12px;background:#f8fafc;border:1px solid #e2e8f0\"><strong>Date</strong></td><td style=\"padding:8px 12px;border:1px solid #e2e8f0\">' + new Date($json.debut_at).toLocaleDateString(\"fr-FR\",{weekday:\"long\",day:\"2-digit\",month:\"long\",year:\"numeric\"}) + '</td></tr><tr><td style=\"padding:8px 12px;background:#f8fafc;border:1px solid #e2e8f0\"><strong>Heure</strong></td><td style=\"padding:8px 12px;border:1px solid #e2e8f0\">' + new Date($json.debut_at).toLocaleTimeString(\"fr-FR\",{hour:\"2-digit\",minute:\"2-digit\",timeZone:\"Europe/Paris\"}) + '</td></tr><tr><td style=\"padding:8px 12px;background:#f8fafc;border:1px solid #e2e8f0\"><strong>Adresse</strong></td><td style=\"padding:8px 12px;border:1px solid #e2e8f0\">' + ($json.sophrologues.adresse || '') + ', ' + ($json.sophrologues.ville || '') + '</td></tr></table><p style=\"color:#64748b;font-size:13px\">En cas d'empêchement, merci de prévenir votre sophrologue au moins 24h à l'avance.</p><hr style=\"border:none;border-top:1px solid #e2e8f0;margin:24px 0\"><p style=\"font-size:12px;color:#94a3b8\">Calymia — plateforme de gestion pour sophrologues<br>Cet email a été envoyé automatiquement, merci de ne pas y répondre.</p></body></html>' }}"
    }
  ]
}
```

> **Astuce** : Pour utiliser un template SendGrid Dynamic Template à la place du HTML inline, remplacez `content` par `template_id` et `dynamic_template_data`.

### Options

- **Response Format** : JSON
- Activer **"Continue on Fail"** pour traiter les autres séances si une adresse email est invalide.

---

## Nœud 6 — HTTP Request : marquer rappel_email_envoye = true

| Champ | Valeur |
|---|---|
| **Method** | PATCH |
| **URL** | `={{ $vars.SUPABASE_URL }}/rest/v1/seances?id=eq.{{ $json.id }}` |

### Headers

| Header | Valeur |
|---|---|
| `apikey` | `={{ $vars.SUPABASE_SERVICE_KEY }}` |
| `Authorization` | `Bearer {{ $vars.SUPABASE_SERVICE_KEY }}` |
| `Content-Type` | `application/json` |
| `Prefer` | `return=minimal` |

### Body (JSON)

```json
{
  "rappel_email_envoye": true
}
```

---

## Nœud 7 — Set : construire le résumé

Ajoute un nœud **Set** après la boucle pour agréger le résultat :

| Champ | Valeur |
|---|---|
| **Name** | `rappels_envoyes` |
| **Value** | `={{ $runIndex + 1 }} rappel(s) envoyé(s)` |

---

## Nœud 8 — NoOp / Log final

Nœud terminal. Connectez-y aussi la branche **False** du nœud IF.

Vous pouvez ajouter ici une notification Slack ou un log dans Supabase (table `logs_rappels`) si vous souhaitez un historique.

---

## Schéma de la table Supabase requise

Assurez-vous que la colonne `rappel_email_envoye` existe dans la table `seances` :

```sql
ALTER TABLE seances
  ADD COLUMN IF NOT EXISTS rappel_email_envoye BOOLEAN NOT NULL DEFAULT false;
```

---

## Test manuel

Pour tester sans attendre le cron, utilisez l'API route dédiée :

```bash
curl -X POST http://localhost:3000/api/rappels/test \
  -H "Content-Type: application/json" \
  -d '{"seance_id": "uuid-de-la-seance"}'
```

Réponse attendue :

```json
{
  "success": true,
  "email_envoye_a": "patient@email.com"
}
```

---

## Variables d'environnement à ajouter dans `.env.local`

```env
SENDGRID_API_KEY=SG.xxxxxxxxxxxxxxxxxxxx
SENDGRID_FROM_EMAIL=noreply@calymia.fr
SENDGRID_FROM_NAME=Calymia
```
