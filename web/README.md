# Featherbound web app

The production app (Next.js 16 on Vercel). The design reference is `../prototype` (tag `prototype-v1`); the plan is `../docs/BUILD_PLAN.md`.

## Setup

```bash
npm install
npx vercel@latest env pull .env.local --yes   # Neon + Blob credentials from the linked Vercel project
npm run db:migrate
npm run db:seed
npm run dev
```

## Scripts

- `npm run dev`: local dev server at http://localhost:3000
- `npm run typecheck` · `npm run lint` · `npm test` · `npm run build`
- `npm run db:generate`: create a migration from `src/db/schema.ts`
- `npm run db:migrate` · `npm run db:seed` · `npm run db:studio`
