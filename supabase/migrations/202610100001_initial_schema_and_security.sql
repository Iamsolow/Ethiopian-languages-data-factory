-- Initial schema for Ethiopian Languages Data factory.
-- Apply only to the dedicated project: dycmszjxgvqaeywfxwdg.
-- Review before production use; keep the audio bucket private.

create extension if not exists pgcrypto;

create table if not exists public.languages (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name_en text not null,
  name_local text,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  role text not null default 'contributor' check (role in ('contributor','transcriber','translator','reviewer','admin')),
  created_at timestamptz not null default now()
);

create table if not exists public.submissions (
  id uuid primary key default gen_random_uuid(),
  contributor_id uuid not null references auth.users(id) on delete restrict,
  language_id uuid not null references public.languages(id) on delete restrict,
  audio_object_path text not null,
  duration_seconds integer check (duration_seconds is null or duration_seconds > 0),
  dialect_region text,
  consent_for_ai_training boolean not null default false,
  consent_for_commercial_use boolean not null default false,
  consent_given_at timestamptz,
  status text not null default 'submitted' check (status in ('submitted','transcribing','transcribed','reviewing','approved','rejected','needs_changes')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((consent_for_ai_training = false and consent_for_commercial_use = false) or consent_given_at is not null)
);

create table if not exists public.transcriptions (
  id uuid primary key default gen_random_uuid(),
  submission_id uuid not null references public.submissions(id) on delete cascade,
  transcriber_id uuid not null references auth.users(id) on delete restrict,
  transcript_text text not null,
  version integer not null default 1 check (version > 0),
  status text not null default 'draft' check (status in ('draft','submitted','approved','needs_changes','rejected')),
  created_at timestamptz not null default now(),
  unique (submission_id, transcriber_id, version)
);

create table if not exists public.translations (
  id uuid primary key default gen_random_uuid(),
  submission_id uuid not null references public.submissions(id) on delete cascade,
  transcriber_id uuid not null references auth.users(id) on delete restrict,
  target_language text not null check (target_language in ('amh','eng')),
  translation_text text not null,
  version integer not null default 1 check (version > 0),
  status text not null default 'draft' check (status in ('draft','submitted','approved','needs_changes','rejected')),
  created_at timestamptz not null default now(),
  unique (submission_id, transcriber_id, target_language, version)
);

create table if not exists public.quality_reviews (
  id uuid primary key default gen_random_uuid(),
  submission_id uuid not null references public.submissions(id) on delete cascade,
  reviewer_id uuid not null references auth.users(id) on delete restrict,
  transcription_id uuid references public.transcriptions(id) on delete set null,
  translation_id uuid references public.translations(id) on delete set null,
  audio_quality_score smallint check (audio_quality_score between 1 and 5),
  transcript_quality_score smallint check (transcript_quality_score between 1 and 5),
  translation_quality_score smallint check (translation_quality_score between 1 and 5),
  decision text not null check (decision in ('approved','needs_changes','rejected')),
  notes text,
  created_at timestamptz not null default now()
);

create index if not exists submissions_contributor_idx on public.submissions(contributor_id);
create index if not exists submissions_language_status_idx on public.submissions(language_id,status);
create index if not exists transcriptions_submission_idx on public.transcriptions(submission_id);
create index if not exists translations_submission_idx on public.translations(submission_id);
create index if not exists quality_reviews_submission_idx on public.quality_reviews(submission_id);

alter table public.languages enable row level security;
alter table public.profiles enable row level security;
alter table public.submissions enable row level security;
alter table public.transcriptions enable row level security;
alter table public.translations enable row level security;
alter table public.quality_reviews enable row level security;

grant select on public.languages to anon, authenticated;
drop policy if exists "Anyone can read active languages" on public.languages;
create policy "Anyone can read active languages" on public.languages for select to anon, authenticated using (is_active = true);

grant select, insert, update on public.profiles to authenticated;
drop policy if exists "Users read own profile" on public.profiles;
create policy "Users read own profile" on public.profiles for select to authenticated using (id = (select auth.uid()));
drop policy if exists "Users create own contributor profile" on public.profiles;
create policy "Users create own contributor profile" on public.profiles for insert to authenticated with check (id = (select auth.uid()) and role = 'contributor');
drop policy if exists "Users update own profile display name" on public.profiles;
create policy "Users update own profile display name" on public.profiles for update to authenticated using (id = (select auth.uid())) with check (id = (select auth.uid()) and role = (select p.role from public.profiles p where p.id = (select auth.uid())));

grant select, insert, update on public.submissions to authenticated;
drop policy if exists "Contributors read own submissions" on public.submissions;
create policy "Contributors read own submissions" on public.submissions for select to authenticated using (contributor_id = (select auth.uid()));
drop policy if exists "Contributors submit with consent" on public.submissions;
create policy "Contributors submit with consent" on public.submissions for insert to authenticated with check (contributor_id = (select auth.uid()) and consent_for_ai_training = true and consent_given_at is not null and status = 'submitted');
drop policy if exists "Contributors update own pending submission" on public.submissions;
create policy "Contributors update own pending submission" on public.submissions for update to authenticated using (contributor_id = (select auth.uid()) and status in ('submitted','needs_changes')) with check (contributor_id = (select auth.uid()) and status in ('submitted','needs_changes'));

grant select, insert, update on public.transcriptions to authenticated;
drop policy if exists "Users read own transcriptions" on public.transcriptions;
create policy "Users read own transcriptions" on public.transcriptions for select to authenticated using (transcriber_id = (select auth.uid()));
drop policy if exists "Users create own drafts" on public.transcriptions;
create policy "Users create own drafts" on public.transcriptions for insert to authenticated with check (transcriber_id = (select auth.uid()) and status in ('draft','submitted'));
drop policy if exists "Users update own drafts" on public.transcriptions;
create policy "Users update own drafts" on public.transcriptions for update to authenticated using (transcriber_id = (select auth.uid()) and status in ('draft','needs_changes')) with check (transcriber_id = (select auth.uid()) and status in ('draft','submitted'));

grant select, insert, update on public.translations to authenticated;
drop policy if exists "Users read own translations" on public.translations;
create policy "Users read own translations" on public.translations for select to authenticated using (transcriber_id = (select auth.uid()));
drop policy if exists "Users create own translations" on public.translations;
create policy "Users create own translations" on public.translations for insert to authenticated with check (transcriber_id = (select auth.uid()) and status in ('draft','submitted'));
drop policy if exists "Users update own translations" on public.translations;
create policy "Users update own translations" on public.translations for update to authenticated using (transcriber_id = (select auth.uid()) and status in ('draft','needs_changes')) with check (transcriber_id = (select auth.uid()) and status in ('draft','submitted'));

grant select, insert on public.quality_reviews to authenticated;
drop policy if exists "Reviewers read reviews" on public.quality_reviews;
create policy "Reviewers read reviews" on public.quality_reviews for select to authenticated using (reviewer_id = (select auth.uid()) and exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.role in ('reviewer','admin')));
drop policy if exists "Reviewers create reviews" on public.quality_reviews;
create policy "Reviewers create reviews" on public.quality_reviews for insert to authenticated with check (reviewer_id = (select auth.uid()) and exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.role in ('reviewer','admin')));

insert into public.languages (code,name_en,name_local) values
  ('kbr','Kaffa','Kaffa'),('wal','Wolaytta','Wolaytta'),('sid','Sidama','Sidama')
on conflict (code) do nothing;

-- Create the private language-audio bucket and storage policies from the Supabase
-- Dashboard after reviewing this migration. Do not make the bucket public.
