# Angora — End-to-End Client Walkthrough

**Product:** AI Trading Agents on Monad Blockchain  
**Version:** v3.0 Refinements  
**Network:** Monad Testnet (Chain ID 10143)

This document walks you through the complete Angora experience as a client — from starting the servers to deploying AI trading agents, managing them through the control panel, exploring live market data, and verifying everything on-chain.

---

## Prerequisites

Before starting, make sure you have:

- [Phantom Wallet](https://phantom.app) browser extension installed
- Phantom configured on **Monad Testnet** (the app will prompt you to switch if needed)
- MON testnet tokens in your Phantom wallet — get them free at [faucet.monad.xyz](https://faucet.monad.xyz)

---

## Step 1 — Start the Servers

Open **three terminal tabs** from the monorepo root (`/Users/mac/angora`).

**Terminal 1 — Redis (job queue):**
```bash
npm run redis:start
npm run redis:ping
# Expected output: PONG
```

**Terminal 2 — API backend:**
```bash
npm run dev:api
# Expected: [Angora API] listening on http://localhost:3001
```

**Terminal 3 — Frontend:**
```bash
# Clear stale build cache (important after code changes)
npm run clean:web

# Start the dev server
npm run dev:web
# Expected: ▲ Next.js 15.3 (Turbopack) — Local: http://localhost:3000
```

**Verify everything is running:**
```bash
# API health check (both routes work)
curl http://localhost:3001/health
curl http://localhost:3001/api/health
# Expected: {"status":"ok","timestamp":"..."}

# Live prices
curl http://localhost:3001/api/prices
# Expected: JSON object with MON, BTC, ETH, SOL prices + change24h + history[]
```

---

## Step 2 — Open the App

Navigate to [http://localhost:3000](http://localhost:3000) in your browser.

**What you should see:**
- Dark hero page with a **3D rotating particle sphere** in the background
- "CORE V.9 ACTIVE" badge with a pulsing cyan dot
- Large heading: **"Algorithmic / Supremacy."**
- Three animated stat cards on the right (Execution Latency 24ms, Signal Confidence 96.4%, Active Agents 847)
- "Initialize Sequence →" button and "View Backtests" button
- Navbar with ANGORA logo and **"Connect Phantom"** button

**Navbar links (left to right):**
`Agents` · `Markets` · `Strategies` · `Research` · `Docs` · `Wallet`

> If the particle canvas is not animating, try a hard refresh (Cmd+Shift+R).

---

## Step 3 — Connect Your Phantom Wallet

Click **"Connect Phantom"** in the top-right navbar.

**What happens:**
1. Phantom popup opens asking for connection approval
2. If you're not on Monad Testnet, a second popup asks you to switch networks — approve it
3. The button transforms to show your **wallet address** (e.g. `0x1234...abcd`) and your **MON balance**
4. A green pulse dot confirms the connection
5. Clicking the wallet address button navigates you to the `/wallet` page

> If you don't have MON tokens yet, visit [faucet.monad.xyz](https://faucet.monad.xyz), paste your Phantom EVM address, and request tokens. Wait ~30 seconds and refresh.

---

## Step 4 — Create Your First AI Trading Agent

Click **"Initialize Sequence →"** on the hero page (or navigate to [http://localhost:3000/create](http://localhost:3000/create)).

### Step 4a — Describe Your Strategy (Step 1 of 3)

You'll see a `GlassCard` with a textarea and three **example strategy chips**:

- `EMA crossover 20/60 on MON/USDT, 3% stop loss…`
- `RSI mean reversion — buy below 30, sell above 70…`
- `Momentum breakout BTC/USDT daily, 5% position…`

**Option A:** Click any chip to auto-fill the textarea with that strategy.

**Option B:** Type your own strategy in natural language, for example:
```
Swing trader on MON/USDT using 20/60 EMA crossover with RSI confirmation.
Max 5% position size, 3% stop loss, 8% take profit. Trade on 1h timeframe.
```

> **Tip:** You can also navigate to `/strategies`, pick a pre-built strategy, and click **"Deploy as Agent"** — this opens `/create` with the prompt pre-filled.

The **"Build Agent with Gemini →"** button is disabled until your wallet is connected and the textarea has text. Once both conditions are met, click it.

**What happens:**
- Button shows a spinner: "Building with Gemini…"
- A `POST` request goes to `http://localhost:3001/api/agents/build-from-prompt`
- Gemini 2.5 Flash parses your natural language into a structured trading config
- Completes in **1–3 seconds**

### Step 4b — Review the Config (Step 2 of 3)

A review card slides in showing the parsed config:

| Field | Example Value |
|---|---|
| Name | `EMA Trend Follower MON/USDT` |
| Strategy Type | `TREND_FOLLOW` |
| Asset | `MON/USDT` |
| Timeframe | `1h` |
| EMA | `Fast 20 / Slow 60` |
| Risk | `5% pos · 3% SL · 8% TP` |
| Config Hash | `0xa1b2c3d4…` (32-byte keccak256) |

Review the config. If it doesn't match your intent, click **"← Back"** and refine your prompt.

When ready, click **"Deploy On-Chain →"**.

**What happens:**
1. Phantom popup opens showing the `registerAgent` transaction
2. It shows the gas cost in MON (typically very small on testnet)
3. Click **"Approve"** in Phantom
4. Monad confirms the transaction in ~1 second (single-slot finality)

### Step 4c — Success Screen (Step 3 of 3)

A success card appears with a green checkmark:

- **Agent ID** — a UUID identifying your agent (e.g. `3f2e1d0c-…`)
- **Transaction hash** — click it to open [Monad Explorer](https://testnet.monadexplorer.com) and see the `AgentRegistered` event in the contract logs

Click **"View Dashboard →"** to go to your agent's live dashboard.

---

## Step 5 — View Your Agent Dashboard

You'll be redirected to `/dashboard/{agentId}` (also reachable via `/agents/{agentId}`).

**Header row:**
- `LIVE DASHBOARD` label in cyan monospace font
- Agent name and ID on the left
- **`AgentTriggerPanel`** on the right — shows the current interval, live countdown timer, and a **"Run Now"** button (triggers via Phantom — no curl needed)

**Stats row (4 cards):**
- Win Rate — percentage of profitable trades
- Total Trades — execution count
- Avg Confidence — mean Gemini confidence score
- Latest Price — most recent MON/USD price from Pyth oracle

**Latest Signal card:**
- Shows `BUY`, `SELL`, or `HOLD` badge
- Confidence bar (e.g. 78%)
- Gemini's reasoning text
- Explorer link to the on-chain `AgentExecuted` event

**PnL Chart:**
- Recharts AreaChart with purple gradient fill
- Shows cumulative profit/loss across all executions

**Execution History table:**
- Last 20 executions
- Columns: Time, Signal (colored badge), Price, Confidence, Reasoning, Tx link

> The dashboard **auto-refreshes every 30 seconds** — you don't need to reload the page.

---

## Step 6 — Trigger Your Agent via Phantom

In the dashboard's `AgentTriggerPanel` (top-right of the header), click **"Run Now"**.

**What happens:**
1. A loading toast appears: "Waiting for Phantom approval…"
2. Phantom popup opens — approve the `logExecution` transaction
3. The `txHash` from the approval is sent to the backend trigger API
4. Gemini analyzes live Pyth prices and returns a signal
5. A success toast appears: e.g. **"BUY · 78% confidence"** (within ~5 seconds)

**If you reject in Phantom:**
- An error toast appears: "Transaction rejected"
- No crash, no state change — you can try again

**You can also trigger via curl for quick testing:**
```bash
curl -X POST http://localhost:3001/api/agents/YOUR_AGENT_ID/trigger \
  -H 'Content-Type: application/json' \
  -d '{"txHash":"0xoptional"}'
```

**Expected response:**
```json
{
  "signal": "BUY",
  "confidence": 76,
  "reasoning": "EMA 20 crossed above EMA 60, RSI at 45 (neutral zone)...",
  "price": 20.45,
  "txHash": "0xabc123..."
}
```

**What happened under the hood:**
1. Pyth oracle fetched the live MON/USD price from Hermes
2. Synthetic OHLCV data was generated for indicator calculation
3. EMA and RSI values were computed
4. Gemini 2.5 Flash analyzed the indicators and returned a structured decision
5. If confidence > 55% and signal is BUY or SELL, a MockDEX trade was executed on Monad
6. `AgentRegistry.logExecution()` was called, emitting an `AgentExecuted` on-chain event
7. The execution was persisted to Supabase via Prisma

Within 35 seconds, the new execution will appear on your dashboard automatically.

---

## Step 7 — Manage Agents from the Control Panel

Navigate to [http://localhost:3000/agents](http://localhost:3000/agents).

**What you should see:**
- A grid of all your deployed agents as `AgentCard` components
- Each card shows: agent name, strategy type, current interval, countdown timer, active/paused status, latest signal, confidence, and price

**Per-agent actions (on each card):**

| Action | How | Result |
|--------|-----|--------|
| Run Now | Click "Run Now" button | Phantom popup → toast with BUY/SELL/HOLD + confidence |
| Change interval | Click interval pill (5m / 15m / 1h / 4h / 24h) | Countdown resets, toast confirms new schedule |
| Pause | Click "Pause" | Green dot turns grey, countdown disappears, agent stops auto-running |
| Resume | Click "Resume" | Green dot returns, countdown reappears, auto-run resumes |

**Run All button (top of page):**
- Click **"Run All Agents"**
- A single Phantom popup opens for one batch transaction
- All active agents fire in **parallel** — all transactions land in the same Monad block
- A toast shows the batch result

**API equivalents (for testing):**
```bash
# Schedule / change interval
curl -X POST http://localhost:3001/api/agents/AGENT_ID/schedule \
  -H 'Content-Type: application/json' -d '{"interval":"5m"}'

# Pause
curl -X POST http://localhost:3001/api/agents/AGENT_ID/pause

# Resume
curl -X POST http://localhost:3001/api/agents/AGENT_ID/resume

# List all your agents
curl 'http://localhost:3001/api/agents?owner=0xYOUR_WALLET_ADDRESS'
```

---

## Step 8 — Explore the Wallet Page

Navigate to [http://localhost:3000/wallet](http://localhost:3000/wallet) (or click your address in the navbar).

**What you should see:**

**Balance cards (`StatCard` components):**
- **MON Balance** — your native Monad token balance with animated count-up
- **mUSDT Balance** — your Mock USDT balance with animated count-up

**Faucet:**
- Click **"Claim 10k mUSDT"**
- Phantom opens for `faucet()` approval
- After confirmation, your mUSDT balance updates

**Transaction History table:**
- Last 20 transactions fetched live from Monad Explorer
- Columns: Hash (linked to explorer), From, To, Value, Time

---

## Step 9 — Browse the Strategy Catalogue

Navigate to [http://localhost:3000/strategies](http://localhost:3000/strategies).

**What you should see:**
- 4 pre-built strategy cards with `SignalBadge` (BUY / HOLD)
- Each card shows: Win Rate, Total Trades, Avg Return, Max Drawdown, Sharpe Ratio

**Filter by type:**
Click any filter pill: `ALL` · `TREND_FOLLOW` · `MEAN_REVERT` · `BREAKOUT` · `MOMENTUM`

**Deploy a strategy:**
Click **"Deploy as Agent"** on any card → redirected to `/create` with the prompt pre-filled in the textarea.

---

## Step 10 — View Live Market Data

Navigate to [http://localhost:3000/markets](http://localhost:3000/markets).

**What you should see:**
- 4 price cards: **MON**, **BTC**, **ETH**, **SOL**
- Each card shows: current price, 24h change percentage (green/red), and a **sparkline chart** of recent price history
- Prices **auto-refresh every 5 seconds** from the Pyth oracle via the backend `/api/prices` endpoint

**Market Stats table** (below the cards):
- Columns: Asset, Price, 24h Change, Feed ID
- 24h Change column is color-coded green/red

---

## Step 11 — Read AI Research

Navigate to [http://localhost:3000/research](http://localhost:3000/research).

**What you should see:**

**AI Commentary section:**
- Powered by Gemini 2.5 Flash (`gemini-2.5-flash`)
- Market regime badge: `BULL`, `BEAR`, or `SIDEWAYS`
- Detailed AI analysis of current market conditions (cached 4 hours in Redis — first load may take 2–3s)

**Signal Heatmap:**
- Color-coded grid showing BUY/SELL/HOLD signals for each asset

**Correlation Matrix:**
- 4×4 heatmap showing Pearson correlation between MON, BTC, ETH, SOL price histories
- Color scale: green (positive) → red (negative)

**Volatility Index:**
- Bar chart showing rolling log-return standard deviation for each asset
- Color-coded: green (low) → orange (medium) → red (high)

---

## Step 12 — Read the Docs

Navigate to [http://localhost:3000/docs](http://localhost:3000/docs).

**What you should see:**
- **Search bar** at the top — type any keyword to filter sections in real time
- **Quick Start** — 4-step numbered guide
- **API Reference** table — all endpoints with methods and descriptions
- **Strategy Guide** — descriptions of each strategy type
- **Smart Contracts** — registry and DEX contract details
- **FAQ accordion** — click any question to expand/collapse the answer (animated)

---

## Step 13 — Deploy Multiple Agents (Parallel Demo)

Deploy 2–3 more agents with different strategies to see Monad's parallel execution in action.

**Agent 2 — RSI Mean Reversion:**
```
RSI mean reversion strategy. Buy when RSI drops below 30, sell when above 70.
Use 1h timeframe on MON/USDT. Conservative risk: 3% position, 2% stop, 6% target.
```

**Agent 3 — Momentum Breakout:**
```
Momentum breakout on BTC/USDT daily chart. Enter on 4h breakout confirmation.
5% position size, tight 2% stop loss, 15% take profit target.
```

Then go to `/agents` and click **"Run All Agents"** — a single Phantom tx fires all agents in parallel. All transactions land in the **same Monad block**.

---

## Step 14 — Verify On Monad Explorer

Open [https://testnet.monadexplorer.com](https://testnet.monadexplorer.com) and:

1. Search for your **Agent Registry contract**: `0x194512aF160A2507928546DCE31a6aD5448B8E77`
2. Click **"Events"** tab — you'll see `AgentRegistered` and `AgentExecuted` events
3. Search for any **transaction hash** from your dashboard — it shows full input data and gas used
4. The **block** containing all parallel agent txs shows multiple Angora transactions

---

## Troubleshooting

| Symptom | Fix |
|---|---|
| "Build Agent" button stays disabled | Make sure Phantom wallet is connected (green dot in navbar) |
| Dev server shows ENOENT `.next` errors | Run `npm run clean:web` then restart `npm run dev:web` |
| Phantom popup doesn't appear | Disable other wallet extensions; ensure Phantom is set to EVM mode |
| API returns 500 on `/deploy` | Check that `npm run dev:api` is running on port 3001 |
| Dashboard shows no executions | Click "Run Now" in the `AgentTriggerPanel` on the dashboard |
| Wrong network error in Phantom | Click the red "Switch to Monad" button shown in the navbar |
| Redis not running | Run `npm run redis:start` then `npm run redis:ping` (expect `PONG`) |
| `trigger` returns stale price HOLD | Pyth confidence check failed — retry in 30 seconds |
| `/research` shows loading for >5s | Gemini AI is cold-starting — Redis cache is empty, wait for first response |
| `/markets` prices not refreshing | Check that `npm run dev:api` is running; prices refresh every 5s automatically |
| `/wallet` tx history empty | Connect wallet first; history requires a valid Phantom address |
| Interval change has no effect | Agent may be paused — click "Resume" first, then change the interval |
| Toast not appearing after Run Now | Check that `sonner` `<Toaster />` is in `providers.tsx` (it is by default) |

---

## Quick Reference

```bash
# ── Start everything ──────────────────────────────────────
npm run redis:start
npm run dev:api       # terminal 1: localhost:3001
npm run dev:web       # terminal 2: localhost:3000

# Clean start (if you see .next errors)
npm run clean:web && npm run dev:web

# ── Health checks ─────────────────────────────────────────
curl http://localhost:3001/health
curl http://localhost:3001/api/health

# ── Agent management ──────────────────────────────────────
# List agents for a wallet
curl 'http://localhost:3001/api/agents?owner=0xYOUR_ADDRESS'

# Trigger an agent (with optional txHash from Phantom)
curl -X POST http://localhost:3001/api/agents/AGENT_ID/trigger \
  -H 'Content-Type: application/json' -d '{"txHash":"0xoptional"}'

# Schedule / change interval (valid: 5m, 15m, 1h, 4h, 24h)
curl -X POST http://localhost:3001/api/agents/AGENT_ID/schedule \
  -H 'Content-Type: application/json' -d '{"interval":"5m"}'

# Pause / Resume
curl -X POST http://localhost:3001/api/agents/AGENT_ID/pause
curl -X POST http://localhost:3001/api/agents/AGENT_ID/resume

# View executions
curl http://localhost:3001/api/agents/AGENT_ID/executions

# ── Market data ───────────────────────────────────────────
curl http://localhost:3001/api/prices
# Returns: MON, BTC, ETH, SOL with price, change24h, history[]

# ── Research / AI ─────────────────────────────────────────
curl http://localhost:3001/api/research/commentary
# Returns: regime, commentary, signals, cached 4h in Redis

# ── Wallet history ────────────────────────────────────────
curl 'http://localhost:3001/api/wallet/history?address=0xYOUR_ADDRESS'

# ── Build agent config (test Gemini directly) ─────────────
curl -X POST http://localhost:3001/api/agents/build-from-prompt \
  -H 'Content-Type: application/json' \
  -d '{"prompt":"EMA crossover 20/60 MON/USDT 1h 3% stop 8% target"}'

# ── Run all tests ─────────────────────────────────────────
cd apps/api && npx vitest run src/__tests__     # 214 tests (9 suites)
cd packages/contracts && forge test --fork-url https://testnet-rpc.monad.xyz -vv
cd packages/contracts && npx hardhat test
```

---

## Page Route Map

| Route | Description |
|---|---|
| `/` | Hero landing page with 3D particle sphere |
| `/create` | AI agent builder — 3-step flow (prompt → review → deploy) |
| `/agents` | Agent Control Panel — grid of all your agents with Run Now / schedule / pause |
| `/agents/[agentId]` | Redirects to `/dashboard/[agentId]` |
| `/dashboard/[agentId]` | Live agent dashboard — stats, signal, PnL chart, execution history |
| `/wallet` | Wallet dashboard — MON/mUSDT balances, faucet, tx history |
| `/strategies` | Strategy catalogue — 4 pre-built strategies with filter + deploy CTA |
| `/markets` | Live market data — Pyth prices, sparklines, 24h change |
| `/research` | AI research — Gemini commentary, regime badge, correlation matrix, volatility |
| `/docs` | Documentation — quick start, API reference, FAQ accordion, search |

---

## Key URLs

| Resource | URL |
|---|---|
| App (local) | http://localhost:3000 |
| API (local) | http://localhost:3001 |
| Monad Explorer | https://testnet.monadexplorer.com |
| MON Faucet | https://faucet.monad.xyz |
| Pyth Hermes | https://hermes.pyth.network |
| AgentRegistry contract | [0x1945…E77](https://testnet.monadexplorer.com/address/0x194512aF160A2507928546DCE31a6aD5448B8E77) |
| MockDEX contract | [0xD7EF…5Df](https://testnet.monadexplorer.com/address/0xD7EF5fA9b2e48f24A1961E50E3a0b99cF9f9C5Df) |
| MockUSDT contract | [0x1B62…Db3](https://testnet.monadexplorer.com/address/0x1B625A368Dbd7439d4ED274787301472958A4Db3) |
