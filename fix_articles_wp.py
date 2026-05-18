#!/usr/bin/env python3
"""
Calymia — Correction automatique des articles WordPress
Vérifie et corrige dans chaque article :
  1. Bio Marie Delorme → supprimée
  2. CTA href vers www.calymia.com ou calymia.vercel.app → app.calymia.com/inscription/
  3. Note éditoriale absente → ajoutée en fin d'article

Usage :
  python3 fix_articles_wp.py --url https://www.calymia.com --user VOTRE_LOGIN --password "VOTRE_APP_PASSWORD"

Pour lister uniquement sans modifier :
  python3 fix_articles_wp.py --url https://www.calymia.com --user VOTRE_LOGIN --password "VOTRE_APP_PASSWORD" --dry-run
"""

import argparse
import json
import re
import sys
import urllib.request
import urllib.parse
import base64
import ssl

# Bypass SSL verification (usage local uniquement)
ssl_ctx = ssl.create_default_context()
ssl_ctx.check_hostname = False
ssl_ctx.verify_mode = ssl.CERT_NONE
urllib.request.install_opener(
    urllib.request.build_opener(
        urllib.request.HTTPSHandler(context=ssl_ctx)
    )
)

# ─── Configuration des corrections ───────────────────────────────────────────

NOTE_EDITORIALE = (
    '<p style="font-size: 13px; color: #6b6860; border-top: 1px solid #E8E4DC; '
    'padding-top: 16px; margin-top: 32px;">'
    '<em><strong>Note de l\'éditeur :</strong> Cet article est fourni à titre informatif. '
    'La sophrologie ne remplace pas un avis ou un suivi médical. '
    'En cas de troubles persistants, consultez votre médecin traitant.</em></p>'
)

BIO_PATTERNS = [
    r'<div[^>]*class=["\']calymia-author-bio["\'][^>]*>.*?</div>\s*</div>\s*</div>',
    r'<div[^>]*calymia-author-bio[^>]*>[\s\S]*?(?=<(?:h[1-6]|p|div|section)|$)',
]

CTA_REPLACEMENTS = [
    # Bouton sophrologue : www.calymia.com seul
    (r'href=["\']https?://(?:www\.)?calymia\.com/?["\']',
     'href="https://app.calymia.com/inscription/"'),
    # Bouton client : calymia.vercel.app
    (r'href=["\']https?://calymia\.vercel\.app/inscription/?["\']',
     'href="https://app.calymia.com/inscription/"'),
    # Toute URL calymia.vercel.app
    (r'href=["\']https?://calymia\.vercel\.app[^"\']*["\']',
     'href="https://app.calymia.com/inscription/"'),
]

# ─── Helpers HTTP ─────────────────────────────────────────────────────────────

def wp_request(base_url, user, password, method, path, body=None):
    token = base64.b64encode(f"{user}:{password}".encode()).decode()
    url = f"{base_url.rstrip('/')}/wp-json/wp/v2{path}"
    headers = {
        "Authorization": f"Basic {token}",
        "Content-Type": "application/json",
        "User-Agent": "CalymiaFixScript/1.0",
    }
    data = json.dumps(body).encode() if body else None
    req = urllib.request.Request(url, data=data, headers=headers, method=method)
    try:
        with urllib.request.urlopen(req) as resp:
            return json.loads(resp.read().decode())
    except urllib.error.HTTPError as e:
        err = e.read().decode()
        raise RuntimeError(f"HTTP {e.code} sur {url}: {err[:300]}")

def get_all_posts(base_url, user, password):
    posts = []
    page = 1
    while True:
        batch = wp_request(base_url, user, password, "GET",
                           f"/posts?status=publish,draft&per_page=100&page={page}&_fields=id,title,content,status,link")
        if not batch:
            break
        posts.extend(batch)
        if len(batch) < 100:
            break
        page += 1
    return posts

# ─── Corrections ─────────────────────────────────────────────────────────────

def fix_content(content_raw):
    """Applique toutes les corrections. Retourne (nouveau_contenu, liste_des_changements)."""
    content = content_raw
    changes = []

    # 1. Supprimer bio Marie Delorme
    for pattern in BIO_PATTERNS:
        new_content, n = re.subn(pattern, '', content, flags=re.DOTALL | re.IGNORECASE)
        if n > 0:
            content = new_content
            changes.append(f"Bio auteur supprimée ({n} occurrence{'s' if n > 1 else ''})")

    # Vérif supplémentaire : Marie Delorme textuel
    if 'Marie Delorme' in content:
        # Supprimer le paragraphe ou div contenant Marie Delorme
        new_content = re.sub(
            r'<(?:p|div)[^>]*>(?:[^<]|<(?!/?(?:p|div)))*Marie Delorme[\s\S]*?</(?:p|div)>',
            '', content, flags=re.IGNORECASE
        )
        if new_content != content:
            content = new_content
            changes.append("Mention Marie Delorme supprimée")

    # 2. Corriger URLs CTA
    for pattern, replacement in CTA_REPLACEMENTS:
        new_content, n = re.subn(pattern, replacement, content, flags=re.IGNORECASE)
        if n > 0:
            content = new_content
            changes.append(f"URL CTA corrigée → app.calymia.com/inscription/ ({n}x)")

    # 3. Ajouter note éditoriale si absente
    if 'Note de l\'éditeur' not in content and 'Note de l&rsquo;éditeur' not in content:
        # Insérer avant la dernière balise fermante significative ou à la fin
        if '</div>' in content:
            # Insérer avant le dernier </div> du CTA si présent, sinon à la fin
            if 'calymia-cta-double' in content:
                # Insérer après le bloc CTA double
                content = re.sub(
                    r'(</div>\s*</div>\s*</div>\s*(?=\s*$|(?!.*calymia-cta)))',
                    r'\1\n' + NOTE_EDITORIALE + '\n',
                    content, count=1, flags=re.DOTALL
                )
            else:
                content += '\n' + NOTE_EDITORIALE
        else:
            content += '\n' + NOTE_EDITORIALE
        changes.append("Note éditoriale ajoutée")

    return content, changes

# ─── Main ─────────────────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(description="Correction automatique des articles Calymia")
    parser.add_argument("--url", required=True, help="URL WordPress ex: https://www.calymia.com")
    parser.add_argument("--user", required=True, help="Login WordPress")
    parser.add_argument("--password", required=True, help="Application Password WordPress")
    parser.add_argument("--dry-run", action="store_true", help="Affiche les corrections sans les appliquer")
    parser.add_argument("--post-id", type=int, help="Traiter un seul article (pour test)")
    args = parser.parse_args()

    mode = "DRY-RUN (aucune modification)" if args.dry_run else "LIVE (modifications appliquées)"
    print(f"\n{'='*60}")
    print(f"Calymia — Correction articles WordPress")
    print(f"Mode : {mode}")
    print(f"Site : {args.url}")
    print(f"{'='*60}\n")

    # Récupérer les articles
    if args.post_id:
        posts = [wp_request(args.url, args.user, args.password, "GET",
                            f"/posts/{args.post_id}?_fields=id,title,content,status,link")]
    else:
        print("Récupération des articles...")
        posts = get_all_posts(args.url, args.user, args.password)
        print(f"{len(posts)} articles trouvés\n")

    # Traiter chaque article
    total_modified = 0
    report = []

    for post in posts:
        post_id = post['id']
        title = post.get('title', {}).get('rendered', f'Article #{post_id}')
        status = post.get('status', '?')
        content_raw = post.get('content', {}).get('rendered', '')

        new_content, changes = fix_content(content_raw)

        if not changes:
            print(f"  ✓ #{post_id} [{status}] {title[:50]} — aucune correction nécessaire")
            report.append({"id": post_id, "title": title, "status": status, "changes": []})
            continue

        print(f"\n  ⚠ #{post_id} [{status}] {title[:50]}")
        for c in changes:
            print(f"      → {c}")

        if not args.dry_run:
            # Appliquer les corrections
            wp_request(args.url, args.user, args.password, "POST",
                       f"/posts/{post_id}",
                       {"content": new_content})
            print(f"      ✅ Corrigé")
            total_modified += 1
        else:
            print(f"      [dry-run — non modifié]")
            total_modified += 1

        report.append({"id": post_id, "title": title, "status": status, "changes": changes})

    # Rapport final
    print(f"\n{'='*60}")
    print(f"Résumé : {total_modified}/{len(posts)} articles {'à corriger' if args.dry_run else 'corrigés'}")
    print(f"{'='*60}\n")

    # Sauvegarder le rapport
    report_path = "fix_articles_report.json"
    with open(report_path, 'w') as f:
        json.dump(report, f, ensure_ascii=False, indent=2)
    print(f"Rapport sauvegardé : {report_path}\n")

if __name__ == "__main__":
    main()
