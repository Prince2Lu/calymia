-- ============================================================
-- CALYMIA — Migration initiale (schéma complet)
-- À appliquer sur le projet PROD avant toutes les autres migrations
-- ============================================================

-- Extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================
-- TABLE : sophrologues
-- ============================================================
CREATE TABLE IF NOT EXISTS public.sophrologues (
  id                      uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id                 uuid,
  slug                    text NOT NULL,
  prenom                  text NOT NULL,
  nom                     text NOT NULL,
  email                   text NOT NULL,
  telephone               text,
  bio                     text,
  photo_url               text,
  specialites             text[] DEFAULT '{}',
  numero_rpps             text,
  adresse                 text,
  ville                   text NOT NULL,
  departement             text NOT NULL,
  code_postal             text,
  latitude                numeric,
  longitude               numeric,
  lien_teleconsultation   text,
  plan                    text NOT NULL DEFAULT 'essentiel',
  stripe_account_id       text,
  stripe_customer_id      text,
  stripe_subscription_id  text,
  essai_expire_at         timestamp with time zone DEFAULT (now() + '14 days'::interval),
  trial_ends_at           timestamp with time zone,
  actif                   boolean DEFAULT true,
  onboarding_completed    boolean DEFAULT false,
  email_pro               text,
  photos_cabinet          text[] DEFAULT '{}',
  horaires                jsonb DEFAULT '{}',
  horaires_texte          text DEFAULT '',
  infos_pratiques         text DEFAULT '',
  modes_paiement          text[] DEFAULT '{}',
  formations              text[] DEFAULT '{}',
  certifications          text[] DEFAULT '{}',
  syndicats               text[] DEFAULT '{}',
  created_at              timestamp with time zone DEFAULT now(),
  updated_at              timestamp with time zone DEFAULT now(),
  PRIMARY KEY (id)
);

-- ============================================================
-- TABLE : types_seances
-- ============================================================
CREATE TABLE IF NOT EXISTS public.types_seances (
  id              uuid NOT NULL DEFAULT gen_random_uuid(),
  sophrologue_id  uuid NOT NULL,
  nom             text NOT NULL,
  duree_minutes   smallint NOT NULL,
  tarif           numeric NOT NULL,
  description     text,
  actif           boolean DEFAULT true,
  created_at      timestamp with time zone DEFAULT now(),
  PRIMARY KEY (id),
  FOREIGN KEY (sophrologue_id) REFERENCES public.sophrologues(id) ON DELETE CASCADE
);

-- ============================================================
-- TABLE : patients
-- ============================================================
CREATE TABLE IF NOT EXISTS public.patients (
  id              uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id         uuid,
  sophrologue_id  uuid,
  prenom          text NOT NULL,
  nom             text NOT NULL,
  email           text NOT NULL,
  telephone       text,
  notes           text,
  actif           boolean DEFAULT true,
  created_at      timestamp with time zone DEFAULT now(),
  updated_at      timestamp with time zone DEFAULT now(),
  PRIMARY KEY (id),
  FOREIGN KEY (sophrologue_id) REFERENCES public.sophrologues(id) ON DELETE SET NULL
);

-- ============================================================
-- TABLE : seances
-- ============================================================
CREATE TABLE IF NOT EXISTS public.seances (
  id                      uuid NOT NULL DEFAULT gen_random_uuid(),
  sophrologue_id          uuid NOT NULL,
  patient_id              uuid,
  type_seance_id          uuid NOT NULL,
  debut_at                timestamp with time zone NOT NULL,
  fin_at                  timestamp with time zone NOT NULL,
  statut                  text NOT NULL DEFAULT 'en_attente',
  origine                 text NOT NULL DEFAULT 'en_ligne',
  lien_teleconsultation   text,
  notes                   text,
  rappel_email_envoye     boolean DEFAULT false,
  rappel_sms_envoye       boolean DEFAULT false,
  email_post_envoye       boolean DEFAULT false,
  rappel_envoye           boolean,
  post_seance_envoye      boolean,
  expire_at               timestamp with time zone,
  created_at              timestamp with time zone DEFAULT now(),
  updated_at              timestamp with time zone DEFAULT now(),
  PRIMARY KEY (id),
  FOREIGN KEY (sophrologue_id) REFERENCES public.sophrologues(id) ON DELETE CASCADE,
  FOREIGN KEY (patient_id) REFERENCES public.patients(id) ON DELETE SET NULL,
  FOREIGN KEY (type_seance_id) REFERENCES public.types_seances(id) ON DELETE RESTRICT
);

-- ============================================================
-- TABLE : paiements
-- ============================================================
CREATE TABLE IF NOT EXISTS public.paiements (
  id                        uuid NOT NULL DEFAULT gen_random_uuid(),
  seance_id                 uuid NOT NULL,
  sophrologue_id            uuid NOT NULL,
  patient_id                uuid NOT NULL,
  stripe_payment_intent_id  text,
  montant_total             numeric NOT NULL,
  commission_calymia        numeric NOT NULL,
  montant_sophrologue       numeric NOT NULL,
  statut                    text NOT NULL DEFAULT 'en_attente',
  type                      text NOT NULL DEFAULT 'total',
  facture_url               text,
  created_at                timestamp with time zone DEFAULT now(),
  updated_at                timestamp with time zone DEFAULT now(),
  PRIMARY KEY (id),
  FOREIGN KEY (seance_id) REFERENCES public.seances(id) ON DELETE CASCADE,
  FOREIGN KEY (sophrologue_id) REFERENCES public.sophrologues(id) ON DELETE CASCADE,
  FOREIGN KEY (patient_id) REFERENCES public.patients(id) ON DELETE CASCADE
);

-- ============================================================
-- TABLE : disponibilites
-- ============================================================
CREATE TABLE IF NOT EXISTS public.disponibilites (
  id              uuid NOT NULL DEFAULT gen_random_uuid(),
  sophrologue_id  uuid NOT NULL,
  jour_semaine    smallint NOT NULL,
  heure_debut     time without time zone NOT NULL,
  heure_fin       time without time zone NOT NULL,
  actif           boolean DEFAULT true,
  created_at      timestamp with time zone DEFAULT now(),
  PRIMARY KEY (id),
  FOREIGN KEY (sophrologue_id) REFERENCES public.sophrologues(id) ON DELETE CASCADE
);

-- ============================================================
-- TABLE : indisponibilites
-- ============================================================
CREATE TABLE IF NOT EXISTS public.indisponibilites (
  id              uuid NOT NULL DEFAULT gen_random_uuid(),
  sophrologue_id  uuid NOT NULL,
  debut_at        timestamp with time zone NOT NULL,
  fin_at          timestamp with time zone NOT NULL,
  motif           text,
  created_at      timestamp with time zone DEFAULT now(),
  PRIMARY KEY (id),
  FOREIGN KEY (sophrologue_id) REFERENCES public.sophrologues(id) ON DELETE CASCADE
);

-- ============================================================
-- TABLE : parametres_cabinet
-- ============================================================
CREATE TABLE IF NOT EXISTS public.parametres_cabinet (
  id                              uuid NOT NULL DEFAULT gen_random_uuid(),
  sophrologue_id                  uuid NOT NULL,
  politique_annulation            text NOT NULL DEFAULT 'flexible',
  delai_annulation_heures         smallint DEFAULT 24,
  paiement_type                   text NOT NULL DEFAULT 'total',
  acompte_pourcentage             smallint DEFAULT 30,
  delai_min_reservation_heures    smallint DEFAULT 24,
  couleur_theme                   text DEFAULT '#2E75B6',
  updated_at                      timestamp with time zone DEFAULT now(),
  PRIMARY KEY (id),
  FOREIGN KEY (sophrologue_id) REFERENCES public.sophrologues(id) ON DELETE CASCADE
);

-- ============================================================
-- TABLE : communications
-- ============================================================
CREATE TABLE IF NOT EXISTS public.communications (
  id                  uuid NOT NULL DEFAULT gen_random_uuid(),
  sophrologue_id      uuid NOT NULL,
  patient_id          uuid,
  seance_id           uuid,
  type                text NOT NULL,
  objet               text,
  contenu             text,
  statut              text NOT NULL DEFAULT 'envoye',
  sent_at             timestamp with time zone DEFAULT now(),
  destinataire_email  text,
  destinataire_nom    text,
  PRIMARY KEY (id),
  FOREIGN KEY (sophrologue_id) REFERENCES public.sophrologues(id) ON DELETE CASCADE,
  FOREIGN KEY (patient_id) REFERENCES public.patients(id) ON DELETE SET NULL,
  FOREIGN KEY (seance_id) REFERENCES public.seances(id) ON DELETE SET NULL
);

-- ============================================================
-- TABLE : email_templates
-- ============================================================
CREATE TABLE IF NOT EXISTS public.email_templates (
  id              uuid NOT NULL DEFAULT gen_random_uuid(),
  sophrologue_id  uuid NOT NULL,
  type            text NOT NULL,
  nom             text NOT NULL,
  sujet           text NOT NULL,
  corps_html      text NOT NULL,
  actif           boolean DEFAULT true,
  created_at      timestamp with time zone DEFAULT now(),
  updated_at      timestamp with time zone DEFAULT now(),
  PRIMARY KEY (id),
  FOREIGN KEY (sophrologue_id) REFERENCES public.sophrologues(id) ON DELETE CASCADE
);

-- ============================================================
-- TABLE : seance_notes
-- ============================================================
CREATE TABLE IF NOT EXISTS public.seance_notes (
  id              uuid NOT NULL DEFAULT gen_random_uuid(),
  sophrologue_id  uuid NOT NULL,
  patient_id      uuid NOT NULL,
  seance_id       uuid NOT NULL,
  contenu_html    text NOT NULL DEFAULT '',
  created_at      timestamp with time zone DEFAULT now(),
  updated_at      timestamp with time zone DEFAULT now(),
  PRIMARY KEY (id),
  FOREIGN KEY (sophrologue_id) REFERENCES public.sophrologues(id) ON DELETE CASCADE,
  FOREIGN KEY (patient_id) REFERENCES public.patients(id) ON DELETE CASCADE,
  FOREIGN KEY (seance_id) REFERENCES public.seances(id) ON DELETE CASCADE
);

-- ============================================================
-- RLS : activer sur toutes les tables
-- ============================================================
ALTER TABLE public.sophrologues ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.types_seances ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.patients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.seances ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.paiements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.disponibilites ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.indisponibilites ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.parametres_cabinet ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.communications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.email_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.seance_notes ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- RLS POLICIES : sophrologues
-- ============================================================
CREATE POLICY "Sophrologues peuvent lire leur propre profil"
  ON public.sophrologues FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Sophrologues peuvent modifier leur propre profil"
  ON public.sophrologues FOR UPDATE
  USING (user_id = auth.uid());

CREATE POLICY "Page publique — lecture par slug"
  ON public.sophrologues FOR SELECT
  USING (actif = true);

CREATE POLICY "Insertion lors de l'inscription"
  ON public.sophrologues FOR INSERT
  WITH CHECK (user_id = auth.uid());

-- ============================================================
-- RLS POLICIES : types_seances
-- ============================================================
CREATE POLICY "Sophrologues gèrent leurs types de séances"
  ON public.types_seances FOR ALL
  USING (sophrologue_id = (SELECT id FROM public.sophrologues WHERE user_id = auth.uid() LIMIT 1));

CREATE POLICY "Lecture publique des types de séances actifs"
  ON public.types_seances FOR SELECT
  USING (actif = true);

-- ============================================================
-- RLS POLICIES : patients
-- ============================================================
CREATE POLICY "Sophrologues gèrent leurs patients"
  ON public.patients FOR ALL
  USING (sophrologue_id = (SELECT id FROM public.sophrologues WHERE user_id = auth.uid() LIMIT 1));

CREATE POLICY "Patients accèdent à leur propre profil"
  ON public.patients FOR SELECT
  USING (user_id = auth.uid());

-- ============================================================
-- RLS POLICIES : seances
-- ============================================================
CREATE POLICY "Sophrologues gèrent leurs séances"
  ON public.seances FOR ALL
  USING (sophrologue_id = (SELECT id FROM public.sophrologues WHERE user_id = auth.uid() LIMIT 1));

CREATE POLICY "Patients voient leurs séances"
  ON public.seances FOR SELECT
  USING (patient_id = (SELECT id FROM public.patients WHERE user_id = auth.uid() LIMIT 1));

-- ============================================================
-- RLS POLICIES : paiements
-- ============================================================
CREATE POLICY "Sophrologues voient leurs paiements"
  ON public.paiements FOR ALL
  USING (sophrologue_id = (SELECT id FROM public.sophrologues WHERE user_id = auth.uid() LIMIT 1));

CREATE POLICY "Patients voient leurs paiements"
  ON public.paiements FOR SELECT
  USING (patient_id = (SELECT id FROM public.patients WHERE user_id = auth.uid() LIMIT 1));

-- ============================================================
-- RLS POLICIES : disponibilites
-- ============================================================
CREATE POLICY "Sophrologues gèrent leurs disponibilités"
  ON public.disponibilites FOR ALL
  USING (sophrologue_id = (SELECT id FROM public.sophrologues WHERE user_id = auth.uid() LIMIT 1));

CREATE POLICY "Lecture publique des disponibilités"
  ON public.disponibilites FOR SELECT
  USING (actif = true);

-- ============================================================
-- RLS POLICIES : indisponibilites
-- ============================================================
CREATE POLICY "Sophrologues gèrent leurs indisponibilités"
  ON public.indisponibilites FOR ALL
  USING (sophrologue_id = (SELECT id FROM public.sophrologues WHERE user_id = auth.uid() LIMIT 1));

-- ============================================================
-- RLS POLICIES : parametres_cabinet
-- ============================================================
CREATE POLICY "Sophrologues gèrent leurs paramètres"
  ON public.parametres_cabinet FOR ALL
  USING (sophrologue_id = (SELECT id FROM public.sophrologues WHERE user_id = auth.uid() LIMIT 1));

-- ============================================================
-- RLS POLICIES : communications
-- ============================================================
CREATE POLICY "Sophrologues gèrent leurs communications"
  ON public.communications FOR ALL
  USING (sophrologue_id = (SELECT id FROM public.sophrologues WHERE user_id = auth.uid() LIMIT 1));

-- ============================================================
-- RLS POLICIES : email_templates
-- ============================================================
CREATE POLICY "Sophrologues gèrent leurs templates"
  ON public.email_templates FOR ALL
  USING (sophrologue_id = (SELECT id FROM public.sophrologues WHERE user_id = auth.uid() LIMIT 1));

-- ============================================================
-- RLS POLICIES : seance_notes
-- ============================================================
CREATE POLICY "Sophrologues gèrent leurs notes"
  ON public.seance_notes FOR ALL
  USING (sophrologue_id = (SELECT id FROM public.sophrologues WHERE user_id = auth.uid() LIMIT 1));

-- ============================================================
-- STORAGE BUCKETS
-- ============================================================
INSERT INTO storage.buckets (id, name, public)
VALUES 
  ('avatars', 'avatars', true),
  ('cabinet-photos', 'cabinet-photos', true),
  ('invoices', 'invoices', false)
ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- FUNCTION : updated_at auto-update
-- ============================================================
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers updated_at
CREATE TRIGGER set_updated_at_sophrologues
  BEFORE UPDATE ON public.sophrologues
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER set_updated_at_patients
  BEFORE UPDATE ON public.patients
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER set_updated_at_seances
  BEFORE UPDATE ON public.seances
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER set_updated_at_paiements
  BEFORE UPDATE ON public.paiements
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER set_updated_at_email_templates
  BEFORE UPDATE ON public.email_templates
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER set_updated_at_seance_notes
  BEFORE UPDATE ON public.seance_notes
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
