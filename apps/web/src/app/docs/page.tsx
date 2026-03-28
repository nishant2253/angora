'use client'
import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import Link from 'next/link'
import { GlassCard } from '@/components/ui/GlassCard'

// ── Data ─────────────────────────────────────────────────────────────────────

const QUICK_START = [
  {
    step: 1,
    title: 'Connect Wallet',
    desc: 'Click "Connect Wallet" in the top-right and approve the Phantom connection. Make sure you are on Monad Testnet (chain ID 10143).',
  },
  {
    step: 2,
    title: 'Describe Your Strategy',
    desc: 'Go to /create, type your strategy in plain English (e.g. "EMA crossover MON/USDT 1h"), choose an interval, and click Deploy.',
  },
  {
    step: 3,
    title: 'Approve & Monitor',
    desc: 'Phantom opens for on-chain registration. After approval your agent is live — view it in /agents and watch executions in /dashboard/:id.',
  },
]

const API_REFERENCE = [
  { method: 'GET', route: '/api/agents?owner=:addr', params: 'owner (address)', response: 'Agent[]' },
  { method: 'POST', route: '/api/agents/deploy', params: '{ prompt, strategyType, asset, timeframe }', response: '{ agentId, txHash }' },
  { method: 'POST', route: '/api/agents/:id/trigger', params: '{ txHash? }', response: '{ signal, confidence, reasoning, price }' },
  { method: 'GET', route: '/api/agents/:id/executions', params: 'limit?, offset?', response: 'Execution[]' },
  { method: 'POST', route: '/api/agents/:id/schedule', params: '{ interval }', response: '{ success, interval }' },
  { method: 'POST', route: '/api/agents/:id/pause', params: '—', response: '{ success }' },
  { method: 'POST', route: '/api/agents/:id/resume', params: '—', response: '{ success }' },
  { method: 'GET', route: '/api/prices', params: '—', response: '{ "ETH/USD": { price, confidence, timestamp }, … }' },
  { method: 'GET', route: '/api/research/commentary', params: '—', response: '{ commentary, regime, prices, generatedAt }' },
  { method: 'GET', route: '/api/wallet/history?address=:addr', params: 'address', response: 'TxRecord[]' },
  { method: 'GET', route: '/api/health', params: '—', response: '{ status, timestamp }' },
]

const STRATEGIES_GUIDE = [
  {
    type: 'TREND_FOLLOW',
    color: 'text-[#836EF9]',
    title: 'Trend Following',
    desc: 'Uses EMA or MACD crossovers to enter in the direction of the trend. Best in markets with sustained directional moves. Example: EMA 20/60 crossover on 1h chart.',
  },
  {
    type: 'MEAN_REVERT',
    color: 'text-emerald-400',
    title: 'Mean Reversion',
    desc: 'Buys oversold conditions and sells overbought using RSI or Bollinger Bands. Works well in ranging, sideways markets. Example: RSI < 30 buy, RSI > 70 sell.',
  },
  {
    type: 'BREAKOUT',
    color: 'text-yellow-400',
    title: 'Breakout',
    desc: 'Catches price breakouts above resistance with volume confirmation. Higher reward/risk ratio but lower win rate. Example: EMA 50/200 golden cross with volume surge.',
  },
  {
    type: 'MOMENTUM',
    color: 'text-cyan-400',
    title: 'Momentum',
    desc: 'Follows assets with strong recent performance. Captures continuation of price moves. Works in trending markets with low drawdowns on the run.',
  },
]

const FAQ = [
  {
    q: 'What is an Angora agent?',
    a: 'An AI trading agent built on Monad — it fetches live prices from Pyth, runs indicator calculations, sends the data to Gemini 2.5 Flash for a BUY/SELL/HOLD signal, and executes the trade on MockDEX — all on-chain.',
  },
  {
    q: 'How does autonomous scheduling work?',
    a: 'BullMQ stores a repeatable cron job for each agent. The interval you choose (1m–1d) sets when BullMQ fires. Each fire runs the full Pyth → Gemini → MockDEX cycle automatically without any user input.',
  },
  {
    q: 'Why does triggering require Phantom approval?',
    a: 'Each manual trigger signs a logExecution() call on the AgentRegistry contract — creating an immutable on-chain audit trail. This is the Web3 UX principle: user intent is always signed.',
  },
  {
    q: 'What is MockDEX?',
    a: 'A simulated AMM deployed on Monad testnet. It accepts MON as input and returns mUSDT at a synthetic price derived from the Pyth feed. Used for safe strategy testing without real funds.',
  },
  {
    q: 'What is mUSDT?',
    a: 'A testnet ERC-20 token representing USD. You can claim 10,000 mUSDT for free from the faucet on the /wallet page. It has no real value.',
  },
  {
    q: 'What chain does Angora run on?',
    a: 'Monad Testnet (chain ID 10143). Monad offers EVM-compatible parallel execution with ~1s single-slot finality, making it ideal for high-frequency agent strategies.',
  },
  {
    q: 'How do I change my agent interval?',
    a: 'Go to /agents, find your agent card, and click any interval pill (1m, 5m, 15m, 1h, 4h, 1d). The change takes effect immediately — the BullMQ cron job is rescheduled in the backend.',
  },
  {
    q: 'Can I run multiple agents in parallel?',
    a: 'Yes. Click "Run All" on the /agents page for a single Phantom approval that fires all active agents simultaneously — demonstrating Monad\'s parallel block execution.',
  },
]

const DOCS_SECTIONS = [
  { id: 'quickstart', title: 'Quick Start' },
  { id: 'api', title: 'API Reference' },
  { id: 'strategies', title: 'Strategy Guide' },
  { id: 'contracts', title: 'Smart Contracts' },
  { id: 'faq', title: 'FAQ' },
]

// ── Components ────────────────────────────────────────────────────────────────

function AccordionItem({ question, answer }: { question: string; answer: string }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="border-b border-angora-border">
      <button
        onClick={() => setOpen(!open)}
        className="w-full text-left py-4 flex justify-between items-center text-white hover:text-[#836EF9] transition-colors"
      >
        <span className="font-medium text-sm pr-4">{question}</span>
        <span className="text-angora-muted shrink-0 text-lg leading-none">{open ? '−' : '+'}</span>
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <p className="text-angora-muted text-sm pb-4 leading-relaxed">{answer}</p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

const METHOD_STYLES: Record<string, string> = {
  GET: 'bg-emerald-400/10 text-emerald-400',
  POST: 'bg-[#836EF9]/10 text-[#836EF9]',
  DELETE: 'bg-red-400/10 text-red-400',
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function DocsPage() {
  const [search, setSearch] = useState('')
  const [activeSection, setActiveSection] = useState('quickstart')

  const searchLower = search.toLowerCase()

  const filteredFAQ = FAQ.filter(
    (f) =>
      f.q.toLowerCase().includes(searchLower) || f.a.toLowerCase().includes(searchLower)
  )

  const filteredAPI = API_REFERENCE.filter(
    (r) =>
      r.route.toLowerCase().includes(searchLower) || r.response.toLowerCase().includes(searchLower)
  )

  return (
    <main className="min-h-screen pt-24 pb-16 px-4 max-w-6xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-xs font-mono text-[#836EF9] uppercase tracking-widest">Documentation</span>
        </div>
        <h1 className="text-4xl font-bold text-white mb-2">Docs.</h1>
        <p className="text-angora-muted mb-6">
          Everything you need to build, deploy, and monitor AI trading agents on Monad.
        </p>

        {/* Search */}
        <input
          type="text"
          placeholder="Search docs, API routes, FAQ..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full max-w-md px-4 py-2.5 rounded-lg bg-angora-surface border border-angora-border text-white placeholder:text-angora-muted text-sm focus:outline-none focus:border-[#836EF9]/60 transition-colors"
        />
      </div>

      <div className="flex gap-8">
        {/* Sidebar nav */}
        {!search && (
          <aside className="hidden lg:flex flex-col gap-1 w-40 shrink-0">
            {DOCS_SECTIONS.map((s) => (
              <button
                key={s.id}
                onClick={() => setActiveSection(s.id)}
                className={`text-left px-3 py-2 rounded-lg text-sm transition-all ${
                  activeSection === s.id
                    ? 'bg-[#836EF9]/10 text-white font-semibold border-l-2 border-[#836EF9]'
                    : 'text-angora-muted hover:text-white'
                }`}
              >
                {s.title}
              </button>
            ))}
          </aside>
        )}

        {/* Content */}
        <div className="flex-1 space-y-8 min-w-0">
          {/* Quick Start */}
          {(!search || activeSection === 'quickstart') && (
            <motion.section
              id="quickstart"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
            >
              <h2 className="text-2xl font-bold text-white mb-4">Quick Start</h2>
              <div className="grid md:grid-cols-3 gap-4">
                {QUICK_START.map((s) => (
                  <GlassCard key={s.step} className="p-5">
                    <div className="w-8 h-8 rounded-full bg-[#836EF9]/20 border border-[#836EF9]/40 flex items-center justify-center text-[#836EF9] font-bold text-sm mb-3">
                      {s.step}
                    </div>
                    <h3 className="text-white font-bold mb-2">{s.title}</h3>
                    <p className="text-angora-muted text-sm leading-relaxed">{s.desc}</p>
                  </GlassCard>
                ))}
              </div>
            </motion.section>
          )}

          {/* API Reference */}
          {(!search || activeSection === 'api') && (
            <motion.section
              id="api"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.05 }}
            >
              <h2 className="text-2xl font-bold text-white mb-4">API Reference</h2>
              <GlassCard className="p-0 overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="border-b border-angora-border">
                      <tr>
                        <th className="px-4 py-3 text-left text-angora-muted font-medium text-xs uppercase tracking-wider">Method</th>
                        <th className="px-4 py-3 text-left text-angora-muted font-medium text-xs uppercase tracking-wider">Route</th>
                        <th className="px-4 py-3 text-left text-angora-muted font-medium text-xs uppercase tracking-wider hidden md:table-cell">Params</th>
                        <th className="px-4 py-3 text-left text-angora-muted font-medium text-xs uppercase tracking-wider hidden lg:table-cell">Response</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-angora-border/50">
                      {filteredAPI.map((row) => (
                        <tr key={row.route} className="hover:bg-angora-surface/30 transition-colors">
                          <td className="px-4 py-3">
                            <span className={`text-xs font-bold px-2 py-0.5 rounded ${METHOD_STYLES[row.method] ?? 'bg-gray-400/10 text-gray-400'}`}>
                              {row.method}
                            </span>
                          </td>
                          <td className="px-4 py-3 font-mono text-white text-xs break-all">{row.route}</td>
                          <td className="px-4 py-3 text-angora-muted text-xs hidden md:table-cell">{row.params}</td>
                          <td className="px-4 py-3 font-mono text-angora-muted text-xs hidden lg:table-cell">{row.response}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </GlassCard>
            </motion.section>
          )}

          {/* Strategy Guide */}
          {(!search || activeSection === 'strategies') && (
            <motion.section
              id="strategies"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
            >
              <h2 className="text-2xl font-bold text-white mb-4">Strategy Guide</h2>
              <div className="grid md:grid-cols-2 gap-4">
                {STRATEGIES_GUIDE.map((s) => (
                  <GlassCard key={s.type} className="p-5">
                    <span className={`text-xs font-mono font-bold uppercase tracking-wider ${s.color}`}>
                      {s.type.replace(/_/g, ' ')}
                    </span>
                    <h3 className="text-white font-bold mt-1 mb-2">{s.title}</h3>
                    <p className="text-angora-muted text-sm leading-relaxed">{s.desc}</p>
                  </GlassCard>
                ))}
              </div>
              <p className="text-angora-muted text-sm mt-4">
                Browse and deploy pre-built strategies on the{' '}
                <Link href="/strategies" className="text-[#836EF9] hover:underline">
                  Strategies
                </Link>{' '}
                page.
              </p>
            </motion.section>
          )}

          {/* Smart Contracts */}
          {(!search || activeSection === 'contracts') && (
            <motion.section
              id="contracts"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.15 }}
            >
              <h2 className="text-2xl font-bold text-white mb-4">Smart Contracts</h2>
              <div className="space-y-4">
                {[
                  {
                    name: 'AgentRegistry',
                    desc: 'Registers agent configs on-chain and logs each execution. Used by Phantom approval flow.',
                    functions: ['registerAgent(agentId, configHash, strategyType)', 'logExecution(agentId, signal, price)'],
                    env: 'NEXT_PUBLIC_AGENT_REGISTRY',
                  },
                  {
                    name: 'MockDEX',
                    desc: 'Simulated AMM on Monad testnet. Accepts MON, returns mUSDT at Pyth-derived price.',
                    functions: ['swap(amountIn, minAmountOut)', 'getPrice()'],
                    env: 'NEXT_PUBLIC_MOCK_DEX',
                  },
                  {
                    name: 'MockUSDT',
                    desc: 'Testnet ERC-20 stablecoin. Faucet function lets users claim 10k mUSDT for free.',
                    functions: ['faucet(to, amount)', 'balanceOf(account)', 'transfer(to, amount)'],
                    env: 'NEXT_PUBLIC_MOCK_USDT',
                  },
                ].map((c) => (
                  <GlassCard key={c.name} className="p-5">
                    <div className="flex items-start justify-between mb-2 flex-wrap gap-2">
                      <h3 className="text-white font-bold">{c.name}</h3>
                      <span className="text-xs font-mono text-angora-muted bg-angora-surface px-2 py-0.5 rounded border border-angora-border">
                        {c.env}
                      </span>
                    </div>
                    <p className="text-angora-muted text-sm mb-3">{c.desc}</p>
                    <div className="flex flex-wrap gap-2">
                      {c.functions.map((fn) => (
                        <code key={fn} className="text-xs bg-angora-surface/60 border border-angora-border text-[#836EF9] px-2 py-0.5 rounded">
                          {fn}
                        </code>
                      ))}
                    </div>
                  </GlassCard>
                ))}
              </div>
            </motion.section>
          )}

          {/* FAQ */}
          {(!search || activeSection === 'faq') && (
            <motion.section
              id="faq"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
            >
              <h2 className="text-2xl font-bold text-white mb-4">FAQ</h2>
              <GlassCard className="p-5">
                {filteredFAQ.length > 0 ? (
                  filteredFAQ.map((f) => (
                    <AccordionItem key={f.q} question={f.q} answer={f.a} />
                  ))
                ) : (
                  <p className="text-angora-muted text-sm text-center py-4">
                    No FAQ results for &quot;{search}&quot;
                  </p>
                )}
              </GlassCard>
            </motion.section>
          )}
        </div>
      </div>
    </main>
  )
}
