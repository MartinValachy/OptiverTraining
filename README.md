# Optiver OA Trainer

A personal, installable training app for the Optiver *Career Kickstarter – Trading 2027* online assessment.
It covers the whole battery — **Beat The Odds, NumberLogic, Likelihood-list, Intervals, Orderbooks, Zap-N** —
plus an optional mental-math warm-up. Every module has an **exam mode** (real timing, scoring and navigation,
review at the end) and a **training mode** (soft timer, hints, worked solution after each answer, adaptive difficulty).

All questions are generated procedurally from a seed and every answer key is computed by code (exact
`BigInt` fractions, enumeration, linear solves, solvers). The test suite re-derives each answer independently.

- Next.js (App Router, static export) + TypeScript + Tailwind — runs entirely in the browser
- Supabase (magic-link auth, Postgres with Row Level Security) for backup and sync between devices
- PWA with a precaching service worker: works offline; attempts queue in IndexedDB and sync when back online
- `@dnd-kit` (touch drag), `recharts`, Vitest, Playwright (iPhone 14 + desktop)

## 1. Supabase setup

1. Create a project at [supabase.com](https://supabase.com).
2. **SQL editor** → paste and run [`supabase/schema.sql`](supabase/schema.sql). It creates `attempts`,
   `item_results`, `skill` and `settings`, each with `user_id` and RLS policies `user_id = auth.uid()`.
3. **Authentication → Providers → Email**: enable email sign-in (magic link / OTP).
4. **Authentication → URL configuration**:
   - Site URL: your production URL, e.g. `https://oa-trainer.vercel.app`
   - Redirect URLs: add `https://oa-trainer.vercel.app/settings/` and `http://localhost:3000/settings/`
5. **Project settings → API**: copy the Project URL and the `anon` public key.

The anon key is safe in the browser: RLS limits every row to its owner. Without Supabase variables the
app still works fully, storing everything locally on the device.

## 2. Local development

```bash
npm install
cp .env.example .env.local      # fill in NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY
npm run dev                      # http://localhost:3000 (service worker disabled in dev)
npm run build && npm start       # production build in out/, served on :3000 with the service worker
```

Checks (all must pass with zero errors):

```bash
npm run lint
npm run test        # Vitest: ~2 min — verifies ≥1,000 generated items per family and difficulty
npm run build
npm run e2e         # Playwright against out/ (run npm run build first); iPhone 14 + desktop
```

Playwright uses `PW_CHROMIUM_PATH` or `/opt/pw-browsers/chromium` if present; otherwise run
`npx playwright install chromium` once.

Useful deep links: `/beat-the-odds/?mode=exam&quick=1&seed=42` (short exam, reproducible),
`/likelihood/?mode=training&family=scatter`, `/zap-n/dial/?start=1&sec=30`, `/mock/?quick=1`.

## 3. Deploy to Vercel

1. Push the repo to GitHub and **Import Project** in Vercel.
2. Framework preset **Next.js**; build command `npm run build` (it runs `next build` and then
   `scripts/build-sw.mjs`, which writes the precache manifest into `out/sw.js`); output directory `out`.
3. Add the environment variables `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   (Production and Preview), then deploy.
4. Put the deployed URL into Supabase's Site URL / Redirect URLs (step 1.4).

There are no API routes or server actions — the output is a static site plus the service worker.
`vercel.json` stops `/sw.js` from being cached so new deploys reach installed apps.

## 4. Install on iPhone

1. Open the deployed URL in **Safari** (other iOS browsers cannot install PWAs).
2. Tap **Share → Add to Home Screen → Add**.
3. Launch it once while online so everything is cached; after that it works offline.
4. Optional: **Settings → Account & sync → Send magic link**, open the email on the same device.
   Attempts made offline are queued and upload automatically when you are back online.

## What's inside

| Module | Exam defaults (all editable in Settings) | Generators |
| --- | --- | --- |
| Beat The Odds | 30 questions, 90 s each, 25 min cap (preset 30 × 90 s without cap); +1/−1/0; no going back; expired selection = skip | 14 families: dice, coins, cards, urns, birthday, Bayes/Monty Hall, waiting times, EV/fair price, gambler's ruin, random walks, Markov chains, linearity, martingale traps, divergent expectations |
| NumberLogic | 26 sequences, shared 25:00, 5 cards, BACK/SKIP, Save and submit; +1/−1/0 | 9 families; a rule library rejects sequences with a different, comparably simple continuation |
| Likelihood-list | 15 questions, 90 s, drag to rank, exact order only, auto-submit at 0 s | 8 families with tables/charts/diagrams; any two outcomes ≥ 3 pp apart (configurable) |
| Intervals | 18 questions, 60 s, score lower ÷ upper if the truth is inside | 7 families incl. SVG shape grids (80–200 shapes) and dot fields; calibration review |
| Orderbooks | 20 boards, shared 8:00, any valid arbitrage = 1 point | 3 phases (direct, bundle, ratio) verified by a solver; optional no-opportunity boards |
| Zap-N | 3-min sessions (configurable) | Balloon, Pincode, CodeCompare, The Switch, NumberBox, Skyscraper, Shapeshift, Grill Master, Pattern Guess, Stock Indicator |
| Mental math | 80 in 8: 80 questions, 8:00, 4 options, tap advances, no skip/back, +1/−1. Sprint: typed, auto-advance on a correct answer (Zetamac style), 60/120/300 s | +, −, ×, ÷ on integers, decimals and fractions, missing-number forms (66 × ? = 138.6); or Zetamac default ranges |

Around the modules: an Elo-style rating per family with adaptive difficulty (targets ~75% accuracy),
a daily **Today** session driven by spaced repetition of weak/slow/overdue families, a **dashboard**
(exam trends, accuracy × speed heatmap, weakest five, streak, minutes this week), a **plan** view
counting down to the target date (default 2026-11-30), and a **full mock battery** with a combined report.

### Format details that had to be assumed

Optiver rotates details and the public reports are incomplete, so these are config values or best guesses:

- **Beat The Odds**: the 25-minute invite is modelled as 30 questions at 90 s with a 25-minute overall cap
  (unanswered questions at the cap score 0). Options are shown as percentages with 3 significant figures
  and sorted ascending; the exact answer is omitted in 10/15/25% of items by difficulty.
- **Intervals**: on timeout a valid typed interval is submitted, otherwise the question scores 0.
  `lower = 0` scores 0 even when the truth is 0 (truths are always positive here).
- **Likelihood-list**: forward-only navigation; ground truth is exact or analytic (normal/Poisson/binomial)
  rather than simulated; Monte Carlo (200k paths) is used only in tests as a cross-check.
- **Orderbooks**: the solver searches 0–4 clicks per price and ≤ 12 clicks in total; "Buy"/"Sell" are from
  your perspective; a wrong "No opportunity" press behaves like a wrong submit (error, costs time).
- **NumberLogic**: "comparable complexity" = complexity ≤ the rule's own + 1 on a fixed scale:
  arithmetic/geometric 1; quadratic, affine, second-order recurrence, products, special sequences and digit
  rules 2; cubic and 3-step operation cycles 3; 4-step cycles 4; composite rules (interleaved, alternating
  sign, fraction pairs, difference/ratio sequences) = 1 + their inner rule. Operation cycles are shown with
  at least two instances of every step.
- **80 in 8**: candidate reports (not Optiver) describe 4-option multiple choice, +1/−1, no going back; skip
  rules are disputed, so the drill has no skip and unreached questions score 0. Percentages are not included
  because no report lists them. It may no longer be part of the 2026/27 battery.
- **Zap-N**: all ten game mechanics are reconstructions from candidate reports; parameters are in
  `src/modules/zapn/config.ts`. Exam mode for Zap-N = a timed session that is recorded.

## Project layout

```
src/lib/          fraction.ts (BigInt rationals), rng.ts (mulberry32), math.ts (combinatorics, linear solves),
                  clock.ts (performance.now() exam clock), db/ (IndexedDB + Supabase sync), engine/ (Elo, Today, stats, plan)
src/modules/      one folder per module: generator + scoring (pure TS) and module.tsx (views)
src/components/   exam shell (ExamRunner, TrainingRunner, Review), charts, Zap-N game shell and games
src/app/          routes (static export)
supabase/         schema.sql
e2e/              Playwright specs
```
