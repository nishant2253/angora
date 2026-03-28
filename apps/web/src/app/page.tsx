'use client'
import { motion } from 'framer-motion'
import Link from 'next/link'
import { ParticleCanvas } from '@/components/3d/ParticleCanvas'
import { StatCard } from '@/components/ui/StatCard'
import { GlassCard } from '@/components/ui/GlassCard'

// ── Hero Section ──────────────────────────────────────────────────────────────

function HeroSection() {
  return (
    <section className="relative h-screen flex items-center overflow-hidden">
      <ParticleCanvas />

      {/* Gradient overlays */}
      <div className="absolute inset-0 bg-gradient-to-r from-angora-bg via-angora-bg/80 to-transparent pointer-events-none" />
      <div className="absolute inset-0 bg-gradient-to-t from-angora-bg via-transparent to-transparent pointer-events-none" />

      {/* Hero content */}
      <div className="relative z-10 max-w-7xl mx-auto px-6 w-full">
        <div className="max-w-2xl">
          {/* Live badge */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-angora-primary/30 bg-angora-primary/10 mb-6"
          >
            <div className="w-1.5 h-1.5 rounded-full bg-angora-cyan animate-pulse" />
            <span className="text-angora-accent text-xs font-mono tracking-wider">
              CORE V.9 ACTIVE
            </span>
          </motion.div>

          {/* Heading */}
          <motion.h1
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="text-6xl md:text-7xl font-bold leading-tight mb-6"
          >
            <span className="text-white">Algorithmic</span>
            <br />
            <span className="text-angora-primary">Supremacy.</span>
          </motion.h1>

          {/* Subtext */}
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="text-angora-muted max-w-md text-lg mb-10 leading-relaxed"
          >
            The apex predictive market matrix. Deploy AI-powered trading agents
            on Monad — 10,000 TPS, sub-second finality.
          </motion.p>

          {/* CTA buttons */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.3 }}
            className="flex gap-4 flex-wrap"
          >
            <Link
              href="/create"
              className="px-6 py-3 bg-white text-black font-semibold rounded-lg hover:bg-white/90 transition-all flex items-center gap-2"
            >
              Initialize Sequence →
            </Link>
            <Link
              href="/backtests"
              className="px-6 py-3 border border-angora-border rounded-lg text-white hover:border-angora-primary/50 transition-all flex items-center gap-2"
            >
              View Backtests
            </Link>
          </motion.div>
        </div>

        {/* Floating stat cards — desktop only */}
        <motion.div
          initial={{ opacity: 0, x: 40 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.6, delay: 0.4 }}
          className="hidden lg:flex absolute right-12 top-1/2 -translate-y-1/2 flex-col gap-4 w-64"
        >
          <StatCard label="Execution Latency" value="24" unit="ms" color="#22D3EE" />
          <StatCard
            label="Signal Confidence"
            value="96.4"
            unit="%"
            color="#836EF9"
            trend={2.1}
          />
          <StatCard label="Active Agents" value="847" color="#34D399" trend={18.2} />
        </motion.div>
      </div>
    </section>
  )
}

// ── Workflow Section ──────────────────────────────────────────────────────────

const WORKFLOW_STEPS = [
  {
    step: '01',
    title: 'Describe Strategy',
    desc: 'Write your trading idea in plain English. Gemini 2.5 Flash parses it into a production config with indicators and risk params.',
    color: '#836EF9',
  },
  {
    step: '02',
    title: 'Deploy On-Chain',
    desc: 'Your strategy config is hashed and registered on Monad via AgentRegistry. Phantom signs the transaction in one click.',
    color: '#22D3EE',
  },
  {
    step: '03',
    title: 'Auto-Trade in Parallel',
    desc: 'BullMQ workers run up to 10 agents simultaneously. Each cycle: Pyth price → indicators → Gemini decision → MockDEX execution.',
    color: '#34D399',
  },
]

function WorkflowSection() {
  return (
    <section className="py-24 px-6 max-w-7xl mx-auto">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.5 }}
        className="text-center mb-16"
      >
        <h2 className="text-4xl font-bold text-white mb-3">
          Three Steps to Execution.
        </h2>
        <p className="text-angora-muted max-w-lg mx-auto">
          From natural language to on-chain trade in under 10 seconds.
        </p>
      </motion.div>

      <div className="grid md:grid-cols-3 gap-6">
        {WORKFLOW_STEPS.map((item, i) => (
          <motion.div
            key={item.step}
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: i * 0.1 }}
          >
            <GlassCard hover className="p-6 h-full">
              <div
                className="text-4xl font-bold font-mono mb-4 opacity-30"
                style={{ color: item.color }}
              >
                {item.step}
              </div>
              <div
                className="w-8 h-0.5 mb-4 rounded-full"
                style={{ background: item.color }}
              />
              <h3 className="text-lg font-bold text-white mb-2">{item.title}</h3>
              <p className="text-angora-muted text-sm leading-relaxed">
                {item.desc}
              </p>
            </GlassCard>
          </motion.div>
        ))}
      </div>
    </section>
  )
}

// ── Architecture Section ──────────────────────────────────────────────────────

const TECH_STACK = [
  { label: 'Monad Testnet', sublabel: '10,000 TPS · Chain 10143' },
  { label: 'Gemini 2.5 Flash', sublabel: 'Thinking mode · JSON output' },
  { label: 'Pyth Network', sublabel: 'Real-time price feeds' },
  { label: 'BullMQ + Redis', sublabel: 'concurrency:10 parallel agents' },
  { label: 'wagmi v2 + viem', sublabel: 'Phantom EIP-6963 · Monad chain' },
  { label: 'Prisma + Supabase', sublabel: 'PostgreSQL · execution history' },
]

function ArchitectureSection() {
  return (
    <section className="py-24 px-6 bg-angora-surface/30">
      <div className="max-w-7xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="text-center mb-16"
        >
          <h2 className="text-4xl font-bold text-white mb-3">
            Production-Grade Stack.
          </h2>
          <p className="text-angora-muted max-w-lg mx-auto">
            Every layer purpose-built for Monad&apos;s parallel execution model.
          </p>
        </motion.div>

        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          {TECH_STACK.map((item, i) => (
            <motion.div
              key={item.label}
              initial={{ opacity: 0, scale: 0.95 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }}
              transition={{ duration: 0.4, delay: i * 0.05 }}
            >
              <GlassCard className="p-4">
                <p className="text-white font-semibold text-sm mb-1">
                  {item.label}
                </p>
                <p className="text-angora-muted text-xs">{item.sublabel}</p>
              </GlassCard>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  )
}

// ── Access Tiers Section ──────────────────────────────────────────────────────

const TIERS = [
  {
    name: 'Starter',
    desc: 'For independent traders',
    price: '99',
    features: ['1M Operations/mo', 'Standard Tick Data', '5 Active Agents', 'Community Support'],
    cta: 'Select Plan',
    recommended: false,
  },
  {
    name: 'Professional',
    desc: 'For proprietary teams',
    price: '499',
    features: ['10M Operations/mo', 'Level 2 Order Book', '50 Active Agents', 'Priority Support'],
    cta: 'Deploy Pro',
    recommended: true,
  },
  {
    name: 'Institution',
    desc: 'Unlimited access for enterprise',
    price: 'Custom',
    features: ['Unlimited Operations', 'Colocation Integration', 'Unlimited Agents', 'Dedicated SLA'],
    cta: 'Contact Sales',
    recommended: false,
  },
]

function AccessTiersSection() {
  return (
    <section className="py-24 px-6">
      <div className="max-w-5xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="text-center mb-16"
        >
          <h2 className="text-4xl font-bold text-white mb-3">Access Tiers.</h2>
          <p className="text-angora-muted">
            Select the appropriate execution matrix for your capital scale.
          </p>
        </motion.div>

        <div className="grid md:grid-cols-3 gap-6">
          {TIERS.map((tier, i) => (
            <motion.div
              key={tier.name}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: i * 0.1 }}
              whileHover={{ y: -4 }}
              className={`p-6 rounded-xl border transition-all ${
                tier.recommended
                  ? 'border-angora-primary bg-angora-surface shadow-glow-primary'
                  : 'border-angora-border bg-angora-surface/50'
              }`}
            >
              {tier.recommended && (
                <span className="text-xs font-bold text-angora-primary border border-angora-primary/30 rounded px-2 py-0.5 mb-3 inline-block">
                  RECOMMENDED
                </span>
              )}
              <h3 className="text-xl font-bold text-white mt-2">{tier.name}</h3>
              <p className="text-angora-muted text-sm mb-4">{tier.desc}</p>
              <div className="text-3xl font-bold text-white mb-1">
                {tier.price !== 'Custom' ? `$${tier.price}` : tier.price}
                {tier.price !== 'Custom' && (
                  <span className="text-sm font-normal text-angora-muted">
                    /mo
                  </span>
                )}
              </div>
              <ul className="space-y-2 mb-6 mt-4">
                {tier.features.map((f) => (
                  <li key={f} className="text-sm text-angora-muted flex gap-2">
                    <span className="text-angora-cyan">✓</span>
                    {f}
                  </li>
                ))}
              </ul>
              <button
                className={`w-full py-2.5 rounded-lg font-medium text-sm transition-all ${
                  tier.recommended
                    ? 'bg-white text-black hover:bg-white/90'
                    : 'border border-angora-border text-white hover:border-angora-primary/50'
                }`}
              >
                {tier.cta}
              </button>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  )
}

// ── Home Page ─────────────────────────────────────────────────────────────────

export default function HomePage() {
  return (
    <div className="min-h-screen bg-angora-bg">
      <HeroSection />
      <WorkflowSection />
      <ArchitectureSection />
      <AccessTiersSection />
    </div>
  )
}
