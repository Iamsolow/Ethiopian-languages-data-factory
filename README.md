# Ethiopian Languages Data factory

A Next.js + Supabase pilot for consent-based collection of Ethiopian language audio, transcripts, translations, and quality reviews.

## Pilot languages
- Kaffa
- Wolaytta
- Sidama

## Stack
- Next.js App Router / React / TypeScript
- Supabase Auth, Postgres, and private Storage
- GitHub for source control
- Notion for project planning

## Run locally
1. Install Node.js LTS (Node 20.9+ for Next.js 15).
2. Clone this repository.
3. Run `npm install`.
4. Copy `.env.example` to `.env.local`.
5. Set `NEXT_PUBLIC_SUPABASE_URL` to the dedicated project URL.
6. Set `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` to the project's publishable key (never a service-role/secret key).
7. Run `npm run dev` and open http://localhost:3000.

## Supabase project
Project ref: `dycmszjxgvqaeywfxwdg`

Do not collect real participant recordings until the SQL migration in `supabase/migrations/202610100001_initial_schema_and_security.sql` has been reviewed/applied, the private `language-audio` bucket exists, and the access policies have been verified.

## Data protection
- Audio bucket must be private.
- Never commit `.env.local`, access tokens, or service-role keys.
- AI training consent and commercial-use consent are separate.
- Keep participant identity separate from any exported dataset where practical.
- Only approved records should be exported.
- Establish a clear withdrawal/deletion process and retention policy before collecting production data.
- Do not publicly release audio or personal/sensitive content without explicit, informed permission.

## Current limitations
This is a starter pilot, not a production-ready platform. It includes a landing page, sign-up/sign-in, language list, and consent-aware upload form. Admin roles, transcription/translation work queues, reviewer dashboard, deletion workflow, rate limits, monitoring, and export tooling still need to be built and tested before public launch.