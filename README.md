# Weaveflow

Weaveflow is a Weavy-style LLM workflow builder using Next.js App Router, React Flow, Clerk, Prisma/Postgres, and Trigger.dev task orchestration.

## Monorepo Layout

- `apps/web` — Next.js app (UI + API routes)
- `packages/sdk` — shared Zod payload schemas
- `packages/trigger-tasks` — Trigger.dev tasks (`llm`, `crop`, `extract-frame`)
- `packages/ui` — shared UI tokens

## Implemented Core Features

- Clerk-auth protected workflow builder route
- React Flow canvas with dot grid, minimap, pan/zoom, animated purple edges
- Left quick access sidebar with exactly 6 node buttons
- Right workflow history sidebar with expandable node-level details
- Node types: Text, Upload Image, Upload Video, Run Any LLM, Crop Image, Extract Frame
- Type-safe connection guard by handle data kind
- Connected-input behavior for disabling manual fields
- DAG validation/topological execution and concurrent branch execution
- Run scopes: full workflow, selected nodes, single node
- Workflow save/load API + run history persistence in PostgreSQL (Prisma)
- Export/import workflow JSON
- Sample workflow loader (Product Marketing Kit Generator)

## Required Environment Variables

Copy `apps/web/.env.example` to `apps/web/.env.local` and set:

- `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`
- `CLERK_SECRET_KEY`
- `DATABASE_URL`
- `GOOGLE_AI_API_KEY`
- `TRIGGER_API_KEY`
- `TRIGGER_PROJECT_REF`
- `TRIGGER_CALLBACK_SECRET`
- `NEXT_PUBLIC_APP_URL`
- `APP_URL`
- `TRANSLOADIT_KEY`
- `TRANSLOADIT_SECRET`

## Local Setup

```bash
npm install
npm run prisma:generate
npm run prisma:migrate
npm run dev
```

Open `http://localhost:3000`.

To test full Trigger task execution locally, run task workers in a second terminal:

```bash
npm run dev --workspace @weaveflow/trigger-tasks
```

## Trigger.dev Tasks

Task package: `packages/trigger-tasks/src/index.ts`.

- `llm-node-task`
- `crop-image-task`
- `extract-frame-task`

Deploy tasks from that workspace with Trigger CLI after configuring credentials.

## Phase 2 Integrations

- Real Trigger dispatch from execution engine in `apps/web/src/lib/executor.ts`
- Signed Trigger callback ingestion at `apps/web/src/app/api/trigger/callback/route.ts`
- Signed Transloadit assembly upload flow in `apps/web/src/lib/transloadit.ts`
- FFmpeg + Gemini + callback-aware Trigger tasks in `packages/trigger-tasks/src/index.ts`

## Important Notes

- Trigger tasks require valid `TRIGGER_API_KEY`, `TRIGGER_CALLBACK_SECRET`, and deployed task IDs.
- FFmpeg must be available in your Trigger runtime for crop/frame tasks.
- For true pixel-perfect match, inspect Weavy spacing, typography, and interaction details and tune tokens in `apps/web/src/app/globals.css` and `packages/ui`.