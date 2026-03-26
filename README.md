## Pattern Foundry

Pattern Foundry turns rough ideas into durable assets. The app currently supports:

- post drafting and refinement
- books and story-focused manuscript building
- patent drafting
- distribution workflows
- trading and strategy workspaces

## Local Setup

Install dependencies, set your environment variables, run migrations, then start the app:

```bash
npm install
npm run db:generate
npm run dev
npm run categories:seed
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

## AI Draft Setup

The platform includes optional low-cost OpenAI helpers for:

- post draft generation
- trading journal assist
- admin AI usage cost estimates
- admin AI capacity controls

Add these environment variables:

```bash
DATABASE_URL=file:./dev.db
AUTH_SECRET=replace_with_a_long_random_secret
NEXTAUTH_URL=http://localhost:3000

ADMIN_USERNAME=admin
ADMIN_PASSWORD=change-me

GEMINI_API_KEY=your_gemini_api_key_here
GEMINI_MODEL=gemini-2.5-flash-lite

OPENAI_API_KEY=your_openai_api_key_here
OPENAI_ARTICLE_MODEL=gpt-5-mini
OPENAI_POST_DRAFT_MODEL=gpt-5-mini
```

Notes:

- The admin AI control center lets you choose between Gemini and OpenAI.
- `GEMINI_API_KEY` enables Gemini when Gemini is the selected provider.
- `OPENAI_API_KEY` enables OpenAI when OpenAI is the selected provider.
- `OPENAI_POST_DRAFT_MODEL` and `GEMINI_MODEL` are optional manual overrides.
- Both AI flows cap input size and output length so you can test the feature without opening the door to runaway spend.

## Alpaca Paper Trading Setup

This repo now includes a small Alpaca paper-trading scaffold built around a
very conservative moving-average example. It is intended as a safe starting
point, not a finished production strategy.

Add these environment variables before running it:

```bash
ALPACA_API_KEY=your_alpaca_key
ALPACA_API_SECRET=your_alpaca_secret

# optional overrides
ALPACA_ENVIRONMENT=paper
ALPACA_SYMBOL=SPY
ALPACA_DATA_FEED=iex
ALPACA_AUTOMATION_SECRET=replace_with_a_shared_secret
ALPACA_FAST_SMA=5
ALPACA_SLOW_SMA=20
ALPACA_MAX_NOTIONAL=100
ALPACA_MAX_DAILY_LOSS=25
```

Useful commands:

```bash
# inspect the signal, account guardrails, and latest quote without placing orders
npm run alpaca:check

# place a paper-trading order only when the signal and guardrails allow it
npm run alpaca:paper
```

Behavior:

- `npm run alpaca:check` never submits an order.
- `npm run alpaca:paper` is blocked unless `ALPACA_ENVIRONMENT=paper`.
- The sample strategy only handles long entries and exits for one symbol.
- Order size is capped by `ALPACA_MAX_NOTIONAL`.
- Trading stops for the run if daily PnL is below `ALPACA_MAX_DAILY_LOSS`.

The new integration lives in [lib/alpaca.ts](/Users/ali/Projects/content-platform/lib/alpaca.ts) and the sample entrypoint is [scripts/alpaca-paper-trade.ts](/Users/ali/Projects/content-platform/scripts/alpaca-paper-trade.ts).

## Deployment

For a first deployment:

```bash
npm install
npm run db:generate
npm run db:migrate:deploy
npm run build
npm run start
```

For a VPS deployment package tailored to this repo, see [docs/DEPLOY_VPS.md](/Users/ali/Projects/content-platform/docs/DEPLOY_VPS.md).

Recommended launch checklist:

- set `DATABASE_URL` to your production database path or connection string
- set `AUTH_SECRET` and `NEXTAUTH_URL`
- set `ADMIN_USERNAME` and `ADMIN_PASSWORD`
- set either `GEMINI_API_KEY` or `OPENAI_API_KEY`
- set Alpaca secrets only if you want trading automation live
- keep `ALPACA_AUTOMATION_SECRET` set if exposing the automation route
- verify the main flows:
  - home idea handoff
  - create post
  - create/edit book
  - novel/story mode
  - search

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
