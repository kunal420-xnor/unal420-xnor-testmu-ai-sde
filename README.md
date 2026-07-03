# TestMu AI — AI-Augmented Regression Testing

**Ticket:** _"We're spending too much time writing and fixing regression tests. Figure out where AI can actually help. Show us something working. Not a demo."_

This repo is my answer. It's a working Playwright + TypeScript framework that tests **Login, Dashboard, and a REST API**, with an **agentic AI layer** wired directly into the test run — not bolted on as a separate script.

The whole thing **runs with zero credentials** (deterministic mock mode), and the AI features get sharper the moment you add an API key.

---

## The thesis: where AI actually helps

The ticket says two things hurt: **writing** tests and **fixing** them. They're not equal.

| Cost | How much AI helps | What this repo does |
| --- | --- | --- |
| Writing tests | **Some.** LLMs draft cases fast but hallucinate selectors and miss edge cases. Best as a *first draft a human curates.* | `ai:generate` produces test-case tables + spec scaffolds you review, not auto-merged tests. |
| **Fixing / triaging** | **A lot.** The real time sink is deciding *why* a red build is red — app bug vs test bug vs flake — and chasing flaky tests across runs. This is judgement work AI genuinely accelerates. | An agentic **Failure Explainer** and a **Flaky Classifier** that runs on every build. |

So I spent the effort where the pain is: **triage and stability**, not just generation. That choice is the point of the ticket.

---

## Architecture

```
              ┌─────────────── playwright test ───────────────┐
   tests/     │  login.spec   dashboard.spec   api.spec        │
   (real      │        │            │              │           │
   targets)   │        └────────────┴──────────────┘           │
              │                     │ results + traces/screens  │
              │            ┌────────▼─────────┐                 │
              │            │   AI Reporter    │  (runs every build)
              │            └────────┬─────────┘                 │
              │        ┌────────────┼───────────────┐           │
              │        ▼            ▼               ▼            │
              │  history store   Failure        Flaky           │
              │  (.runs/*.json)  Explainer       Classifier     │
              │   "memory"       (agentic)      (learns/runs)    │
              └────────┬────────────┬───────────────┬───────────┘
                       ▼            ▼               ▼
                 persisted     .ai-reports/     .ai-reports/
                 history       failures.md      flaky.md

   Every LLM call → src/ai/client.ts  →  live (Anthropic) OR deterministic mock
```

- **Failure Explainer is agentic**, not a single prompt: on each failure it *autonomously gathers evidence first* — this test's pass/fail history, its flip-rate, recurring error signatures, which artifacts exist — then decides a **category + next action** (`retry`, `quarantine`, `file_app_bug`, `fix_test`, `investigate`). If the model is unreachable or replies badly, a rule-based fallback keeps the pipeline moving.
- **Flaky Classifier learns over runs**: results are persisted to `.runs/`, so with more history the stability signal (`passRatio`, `flipRate`) gets more reliable. A committed seed means it shows real verdicts on a fresh clone.

---

## Quickstart

```bash
npm install
npm run install:browsers        # chromium

cp .env.example .env            # optional — leave the key blank to stay in mock mode

npm test                        # runs Login + Dashboard + API, then the AI layer
npm run report                  # open the Playwright HTML report
cat .ai-reports/failures.md     # AI triage of any failures
cat .ai-reports/flaky.md        # stability verdicts across run history
```

**With an API key** (`ANTHROPIC_API_KEY=…` in `.env`) the diagnoses and notes are LLM-generated. **Without one**, everything still runs and produces useful heuristic output — so a reviewer can clone and `npm test` immediately.

### AI test generation

```bash
npm run ai:generate             # all modules → generated/*.cases.md + spec scaffolds
npm run ai:generate -- login    # one module
```

Generated specs come out as `test.fixme` stubs on purpose: **AI drafts, a human implements the assertion.** That's the safe division of labour.

### See the agents react live

```bash
DEMO_FLAKY=1 npx playwright test tests/flaky-demo.spec.ts --repeat-each=5
cat .ai-reports/flaky.md        # DEMO-001 gets labelled "flaky"
```

---

## Targets under test

Everything points at stable, public endpoints so the repo runs anywhere:

- **Login + Dashboard:** [SauceDemo](https://www.saucedemo.com) — login flows + inventory.
- **REST API:** [restful-booker](https://restful-booker.herokuapp.com) — token auth + full CRUD.

Override `SAUCE_BASE_URL` / `API_BASE_URL` in `.env` to point at your own environment.

---

## Design decisions (and honest tradeoffs)

- **Playwright over Selenium** — its first-class trace/screenshot/error artifacts *are* the fuel the Failure Explainer consumes, and one framework covers UI **and** API cleanly.
- **Why not a self-healing locator agent?** It's the flashy option, and I considered it — but auto-rewriting a locator that "broke" can silently **paper over a real regression** (the element moved because the app changed). For a *regression* suite, that's the wrong default. I chose triage + stability instead, which surfaces problems rather than hiding them. (Self-healing is on the roadmap as an *opt-in, human-approved suggestion*, never an automatic patch.)
- **Deterministic mock mode** — no reviewer should need my API key to see the framework work. Mock mode also makes CI free and the AI code unit-testable.
- **Heuristic fallback** — the LLM augments a rule-based core; it never becomes a single point of failure for the pipeline.

## Where AI does *not* help (and I didn't force it)

- Deciding **what** to assert on a brand-new feature — that's product understanding.
- **Deterministic** checks (status codes, exact counts) — plain code is faster, cheaper, and reliable.
- **Auto-fixing** production bugs — AI flags and explains; a human decides.

---

## Layout

```
src/pages/                  # page objects: Login / Inventory / Cart / Checkout
src/api/BookingApi.ts       # typed REST client (no raw URLs/headers in specs)
src/ai/client.ts            # one LLM choke-point: live/mock + safe JSON parsing
src/ai/generate-tests.ts    # LLM → structured test cases + spec scaffolds
src/ai/failure-explainer.ts # agentic triage: category + recommended action
src/ai/flaky-classifier.ts  # stability metrics + labels over run history
src/reporters/ai-reporter.ts# wires the agents into every test run
src/utils/history-store.ts  # persistent run memory (+ committed seed)
tests/fixtures.ts           # injects page objects + API client into every test
tests/                      # login / dashboard / checkout / api / flaky-demo
scripts/                    # ai:generate, ai:flaky CLIs
.github/workflows/ci.yml    # runs tests + AI layer, uploads reports
```

Tests import `{ test, expect }` from `./fixtures`, so page objects and the API
client arrive as fixtures — specs describe *intent*, selectors live in one place.

## Roadmap

- Opt-in, human-approved self-healing locator *suggestions* (diff, never auto-apply).
- Auto-open GitHub issues for high-confidence `app_bug` diagnoses.
- Trend dashboard over `.runs/` history (flake rate over time).
# testmu-ai-sdet
# unal420-xnor-testmu-ai-sde
