# Pattern Foundry Project Spec

## Overview

Pattern Foundry is a multi-surface Next.js application for publishing content,
capturing trading ideas, reviewing executed trades, generating media
derivatives, and experimenting with Alpaca-powered paper trading workflows.

The product combines:

- a publishing system for posts and categories
- a message inbox and conversation operating system
- a private/public trading workspace
- a trading journal and pipeline
- AI-assisted drafting flows
- a studio for generating derivatives from saved content
- a patent-record workspace
- Alpaca paper-trading tools, algo checks, and a simple stock screener

This document is a current-state implementation spec for the repository in
`/Users/ali/Projects/content-platform`.

## Primary Goals

- Give a signed-in user a private workspace for developing trading ideas.
- Let strong trading setups become public-facing frameworks with author credit.
- Support post creation, content repackaging, and AI-assisted drafting.
- Provide lightweight trading tools and live market-data helpers.
- Enable safe Alpaca paper trading from inside the website before considering
  any live execution workflow.

## Tech Stack

- Framework: Next.js 16 App Router
- Language: TypeScript
- UI: React 19
- Auth: `next-auth` v5 beta
- Database: SQLite
- ORM: Prisma with `better-sqlite3`
- Styling: global CSS in `app/globals.css`
- Scripts: `tsx`

## Runtime Model

- Local development runs through `npm run dev`.
- The application uses server components, server actions, and selected client
  components for interactive tools.
- The main database file is `dev.db`.
- Some trading-adjacent tables are created lazily with raw SQL instead of being
  defined in the main Prisma schema.

## Core Areas

### 1. Publishing

Purpose:

- create and edit posts
- organize posts into categories
- support AI-assisted draft generation

Primary routes:

- `/`
- `/posts`
- `/posts/new`
- `/posts/[slug]`
- `/posts/[slug]/edit`
- `/categories`
- `/categories/[name]`

Key data:

- `Post`
- `Category`

### 2. Trading Workspace

Purpose:

- create trading-session records
- store structured setups
- surface personalized insights from repeated patterns
- publish selected setups publicly

Primary routes:

- `/trading`
- `/trading/new`
- `/trading/[slug]`
- `/trading/[slug]/edit`
- `/trading/recommendations`
- `/trading/recommendations/[market]`
- `/trading/chart`
- `/trading/tools`
- `/trading/pipeline`
- `/trading/journal`
- `/trading/algo`
- `/trading/screener`

Key data:

- `TradingSession`
- `TradingJournalEntry`

### 3. Message Inbox And Conversation OS

Purpose:

- import AI conversations and chat exports
- keep source threads as durable reusable records
- protect against exact duplicate imports with content fingerprints
- group conversations into inferred themes
- surface output pipelines such as posts, books, websites, research hubs, and media packs

Primary routes:

- `/inbox/messages`
- `/os`
- `/posts/new?inboxId=...`

Key implementation files:

- `lib/message-inbox.ts`
- `lib/conversation-os.ts`
- `app/inbox/messages/page.tsx`
- `app/inbox/messages/actions.ts`
- `app/os/page.tsx`

Lightweight SQL-managed table:

- `message_inbox_items`

Current behavior:

- users can paste or upload text-based conversations into the inbox
- imports are dedupe-aware using a content hash
- saved inbox items can prefill the post editor
- `/os` provides a first-pass dashboard over themes and output candidates

### 4. Trading Journal

Purpose:

- record actual executed trades separately from setup ideas
- capture mistakes, execution notes, and lessons learned

Primary routes:

- `/trading/journal`
- `/trading/journal/new`
- `/trading/journal/[slug]`
- `/trading/journal/[slug]/edit`

### 5. Trading Pipeline

Purpose:

- track screening candidates
- track open positions outside the main setup/journal flow

Primary route:

- `/trading/pipeline`

Lightweight SQL-managed tables:

- `screening_candidates`
- `tracked_positions`

Implementation:

- created lazily in `lib/trading-pipeline.ts`
- not currently represented in `prisma/schema.prisma`

### 6. Alpaca Integration

Purpose:

- connect to Alpaca paper trading
- inspect account state and market data
- run a simple strategy check
- submit manual paper `buy`/`sell` market orders from the website
- log website-submitted orders
- rank simple stock picks from Alpaca screener endpoints

Primary routes:

- `/trading/algo`
- `/trading/screener`

Key implementation files:

- `lib/alpaca.ts`
- `lib/alpaca-paper-trading.ts`
- `lib/alpaca-order-log.ts`
- `lib/alpaca-screener.ts`
- `app/trading/algo/actions.ts`
- `app/trading/algo/alpaca-bot-panel.tsx`
- `app/trading/screener/page.tsx`
- `scripts/alpaca-paper-trade.ts`

Lightweight SQL-managed table:

- `alpaca_order_logs`

Current behavior:

- website execution is blocked unless `ALPACA_ENVIRONMENT=paper`
- website order entry uses Alpaca market orders
- `/trading/algo` can inspect strategy state and submit manual paper orders
- `/trading/screener` ranks movers and active names into a shortlist

### 7. Studio

Purpose:

- generate derivative content from saved posts and trading sessions
- view and share generated outputs

Primary routes:

- `/studio`
- `/studio/share/[id]`
- `/studio/generate/route`

Key data:

- `ContentDerivative`

### 8. Patents

Purpose:

- store invention and disclosure records
- support early-stage patent packet drafting

Primary routes:

- `/patents`
- `/patents/new`
- `/patents/[slug]`

Key data:

- `PatentRecord`

### 9. Admin AI

Purpose:

- monitor AI usage
- control provider/model behavior

Primary route:

- `/admin/ai`

## Navigation Model

Global nav currently exposes:

- Posts
- Inbox
- OS
- Trading
- Studio
- Patents
- Categories
- AI Usage for admins

Within Trading, the workspace now branches into:

- manual session creation
- journal
- tools
- algo workspace
- screener
- recommendations
- pipeline

## Layout Rules

Base shell:

- `.site-shell` in `app/globals.css`
- optimized for narrower reading layouts

Wide shell:

- `.site-shell-wide`
- used on workspace-style pages such as trading, studio, screener, algo, and
  admin views

Intent:

- article and content pages remain readable
- data-heavy pages use more horizontal space on desktop

## Authentication and Roles

Current roles:

- `ADMIN`
- `USER`

Auth model:

- user accounts stored in SQLite
- session/auth flows wired through `auth.ts` and `next-auth`

Behavior:

- some live or private tools require sign-in
- admin AI screens are role-gated

## Main Persistent Data Model

Prisma-managed models:

- `User`
- `Post`
- `Category`
- `TradingSession`
- `TradingJournalEntry`
- `ContentDerivative`
- `PatentRecord`

Enums:

- `UserRole`
- `TradeDirection`
- `TradeOutcome`

Non-Prisma tables currently created dynamically:

- `screening_candidates`
- `tracked_positions`
- `alpaca_order_logs`

## Environment Variables

### AI

- `OPENAI_API_KEY`
- `OPENAI_POST_DRAFT_MODEL`
- `OPENAI_ARTICLE_MODEL`
- `GEMINI_API_KEY`
- `GEMINI_MODEL`

### Admin/Auth

- `ADMIN_USERNAME`
- `ADMIN_PASSWORD`

### Market Data

- `ALPHA_VANTAGE_API_KEY`

### Alpaca

- `ALPACA_API_KEY`
- `ALPACA_API_SECRET`
- `ALPACA_ENVIRONMENT`
- `ALPACA_SYMBOL`
- `ALPACA_DATA_FEED`
- `ALPACA_FAST_SMA`
- `ALPACA_SLOW_SMA`
- `ALPACA_MAX_NOTIONAL`
- `ALPACA_MAX_DAILY_LOSS`

## NPM Scripts

- `npm run dev`
- `npm run build`
- `npm run start`
- `npm run lint`
- `npm run db:generate`
- `npm run db:migrate`
- `npm run categories:seed`
- `npm run alpaca:check`
- `npm run alpaca:paper`

## Current Alpaca Workflow

### Algo page

`/trading/algo` currently supports:

- account and signal inspection
- manual quantity entry
- manual paper `buy` / `sell`
- in-app confirmation of the last submitted order
- website order-history display from `alpaca_order_logs`

### Screener page

`/trading/screener` currently supports:

- Alpaca movers
- Alpaca most-active stocks
- multi-symbol snapshot enrichment
- a simple ranking score
- direct handoff into `/trading/algo?symbol=...`

### CLI strategy script

The script in `scripts/alpaca-paper-trade.ts` currently supports:

- safe analysis-only checks
- optional paper execution via `--execute`
- a simple moving-average example with guardrails

## Known Architectural Notes

- Some trading features use raw SQL table creation instead of Prisma models.
- The repo contains both content-oriented and trading-oriented product surfaces.
- Market-data integrations are fetch-based and do not rely on a heavy SDK.
- The Alpaca execution path is intentionally limited to paper mode at the
  website layer.
- Workspace pages are wider than article pages by design.

## Suggested Next Milestones

- Add persistent Alpaca order-status sync from Alpaca back into local history.
- Add screener filters such as min price, min volume, and exclusion rules for
  low-priced symbols.
- Add explicit order confirmation and cancellation flows on the algo page.
- Move raw-SQL trading helper tables into first-class Prisma models if the
  product area stabilizes.
- Add a dedicated docs index so internal specs and product notes are easier to
  discover.

## Source Of Truth

This file is intended to be the high-level project reference. For exact
behavior, the implementation source remains the code in:

- `app/`
- `lib/`
- `prisma/`
- `scripts/`
