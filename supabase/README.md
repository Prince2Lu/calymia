# Supabase (Calymia)

## Storage — bucket `avatars`

Profile photos for sophrologues are stored in a **public** bucket named `avatars`.

- **Apply migration:** run `supabase db push` (or paste SQL from `migrations/*_avatars_bucket.sql` in the SQL Editor).
- **Or create manually:** Dashboard → **Storage** → **New bucket** → name `avatars` → enable **Public bucket** → create. Then run only the **policy** section of the migration in the SQL Editor (RLS on `storage.objects`).

Without the bucket and policies, browser uploads from onboarding/paramètres will fail.
