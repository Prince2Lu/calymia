-- Modèles d'emails personnalisables (rappel / post-séance), indexés par compte auth (sophrologue_id = auth.users.id)

CREATE TABLE IF NOT EXISTS email_templates (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  sophrologue_id UUID NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('rappel', 'post_seance')),
  nom TEXT NOT NULL,
  sujet TEXT NOT NULL,
  corps_html TEXT NOT NULL,
  actif BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (sophrologue_id, type)
);

CREATE INDEX IF NOT EXISTS email_templates_sophrologue_id_idx ON email_templates (sophrologue_id);

ALTER TABLE email_templates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS sophrologue_own_templates ON email_templates;

CREATE POLICY sophrologue_own_templates ON email_templates
  FOR ALL
  TO authenticated
  USING (auth.uid() = sophrologue_id)
  WITH CHECK (auth.uid() = sophrologue_id);

COMMENT ON TABLE email_templates IS 'Modèles email rappel / post-séance par praticien (sophrologue_id = auth user id).';

-- ── Backfill : sophrologues existants sans ligne (avant seed applicatif) ──
INSERT INTO email_templates (sophrologue_id, type, nom, sujet, corps_html, actif)
SELECT
  s.user_id,
  'rappel',
  'Rappel 24h Standard',
  'Votre moment de détente vous attend demain 🌿',
  $html_rappel$<p>Bonjour {{client.prenom}},</p>
<p>Un petit message pour vous rappeler que votre séance de sophrologie aura lieu demain, le {{seance.date}}, à {{seance.heure}}.</p>
<p>Prenez un instant pour vous préparer à ce moment rien qu'à vous : respiration calme, tenue confortable, hydratation légère...<br>
Nous avancerons ensemble selon votre énergie du jour.</p>
<p>En cas d'empêchement, n'hésitez pas à me prévenir.</p>
<p>Belle journée à vous,<br>Votre sophrologue 🌱</p>$html_rappel$,
  true
FROM sophrologues s
WHERE s.user_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM email_templates e
    WHERE e.sophrologue_id = s.user_id AND e.type = 'rappel'
  );

INSERT INTO email_templates (sophrologue_id, type, nom, sujet, corps_html, actif)
SELECT
  s.user_id,
  'post_seance',
  'Post séance Standard',
  'Merci pour votre séance 🌿',
  $html_post$<p>Bonjour {{client.prenom}},</p>
<p>Merci d'avoir pris ce moment pour vous aujourd'hui.<br>
Votre séance de sophrologie du {{seance.date}} à {{seance.heure}} est maintenant derrière vous — prenez encore quelques instants pour laisser votre corps et votre esprit intégrer ce travail.</p>
<p>Pour prolonger les bénéfices de la séance, vous pouvez :<br>
- respirer calmement pendant 2 à 3 minutes,<br>
- boire un verre d'eau,<br>
- éviter de repartir immédiatement dans un rythme intense.</p>
<p>Si vous ressentez des effets particuliers, positifs ou inconfortables, n'hésitez pas à me le partager : cela m'aidera à ajuster les prochaines séances selon vos besoins.</p>
<p>À bientôt,<br>Votre sophrologue 🌱</p>$html_post$,
  true
FROM sophrologues s
WHERE s.user_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM email_templates e
    WHERE e.sophrologue_id = s.user_id AND e.type = 'post_seance'
  );
