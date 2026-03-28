'use client'
import { useState } from 'react'
import { motion } from 'framer-motion'
import Link from 'next/link'
import { GlassCard } from '@/components/ui/GlassCard'
import { SignalBadge } from '@/components/ui/SignalBadge'

type Signal = 'BUY' | 'SELL' | 'HOLD'

interface Strategy {
  id: string
  name: string
  type: string
  asset: string
  timeframe: string
  description: string
  winRate: number
  totalTrades: number
  avgReturn: number
  maxDrawdown: number
  sharpe: number
  indicators: string
  prompt: string
  signal: Signal
}

const STRATEGIES: Strategy[] = [
  {
    id: 'ema-crossover',
    name: 'EMA Crossover',
    type: 'TREND_FOLLOW',
    asset: 'MON/USDT',
    timeframe: '1h',
    description:
      'Classic 20/60 EMA crossover. Buys when fast crosses above slow, sells on crossunder.',
    winRate: 58.3,
    totalTrades: 247,
    avgReturn: 2.4,
    maxDrawdown: 12.1,
    sharpe: 1.42,
    indicators: 'EMA 20/60',
    prompt: 'EMA crossover 20/60 on MON/USDT 1h. 3% stop loss, 8% take profit.',
    signal: 'BUY',
  },
  {
    id: 'rsi-mean-revert',
    name: 'RSI Mean Reversion',
    type: 'MEAN_REVERT',
    asset: 'ETH/USDT',
    timeframe: '15m',
    description:
      'Buys oversold RSI (below 30), sells overbought (above 70). Works in ranging markets.',
    winRate: 62.1,
    totalTrades: 412,
    avgReturn: 1.8,
    maxDrawdown: 8.4,
    sharpe: 1.71,
    indicators: 'RSI 14',
    prompt: 'RSI mean reversion ETH/USDT 15m. Buy below 30, sell above 70. 2% stop.',
    signal: 'HOLD',
  },
  {
    id: 'momentum-break',
    name: 'Momentum Breakout',
    type: 'BREAKOUT',
    asset: 'BTC/USDT',
    timeframe: '4h',
    description:
      'Catches momentum breakouts with EMA confirmation. High confidence threshold.',
    winRate: 51.6,
    totalTrades: 134,
    avgReturn: 4.2,
    maxDrawdown: 18.2,
    sharpe: 1.18,
    indicators: 'EMA 50/200 + Volume',
    prompt: 'Momentum breakout BTC/USDT 4h. EMA 50/200 confirmation. 5% stop, 15% target.',
    signal: 'BUY',
  },
  {
    id: 'macd-trend',
    name: 'MACD Trend Follower',
    type: 'TREND_FOLLOW',
    asset: 'MON/USDT',
    timeframe: '1h',
    description:
      'Follows MACD histogram crossovers with signal line confirmation.',
    winRate: 54.8,
    totalTrades: 189,
    avgReturn: 3.1,
    maxDrawdown: 14.6,
    sharpe: 1.33,
    indicators: 'MACD 12/26/9',
    prompt: 'MACD trend follower MON/USDT 1h. Standard 12/26/9 settings. 3% stop.',
    signal: 'BUY',
  },
]

const TYPES = ['ALL', 'TREND_FOLLOW', 'MEAN_REVERT', 'BREAKOUT', 'MOMENTUM']

const TYPE_COLORS: Record<string, string> = {
  TREND_FOLLOW: 'text-[#836EF9]',
  MEAN_REVERT: 'text-emerald-400',
  BREAKOUT: 'text-yellow-400',
  MOMENTUM: 'text-cyan-400',
}

function StrategyCard({ strategy: st, index }: { strategy: Strategy; index: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.07, duration: 0.3 }}
    >
      <GlassCard className="p-5 h-full flex flex-col" hover>
        {/* Header */}
        <div className="flex justify-between items-start mb-3">
          <div className="flex-1 min-w-0">
            <span className={`text-xs font-mono font-semibold ${TYPE_COLORS[st.type] ?? 'text-[#836EF9]'}`}>
              {st.type.replace(/_/g, ' ')}
            </span>
            <h3 className="text-white font-bold text-base mt-0.5">{st.name}</h3>
            <p className="text-angora-muted text-xs">
              {st.asset} · {st.timeframe} · {st.indicators}
            </p>
          </div>
          <div className="text-right ml-3 shrink-0 flex flex-col items-end gap-1.5">
            <SignalBadge signal={st.signal} />
            <p className="text-2xl font-bold text-emerald-400">{st.winRate}%</p>
            <p className="text-xs text-angora-muted">Win Rate</p>
          </div>
        </div>

        <p className="text-angora-muted text-sm mb-4 flex-1">{st.description}</p>

        {/* Stats row */}
        <div className="grid grid-cols-4 gap-2 mb-4">
          {(
            [
              ['Trades', st.totalTrades, ''],
              ['Avg Return', `${st.avgReturn}`, '%'],
              ['Max DD', `${st.maxDrawdown}`, '%'],
              ['Sharpe', st.sharpe, ''],
            ] as [string, string | number, string][]
          ).map(([label, val, unit]) => (
            <div
              key={label}
              className="text-center px-2 py-1.5 rounded-lg bg-angora-card border border-angora-border"
            >
              <p className="text-white text-sm font-bold font-mono">
                {val}{unit}
              </p>
              <p className="text-angora-muted text-xs">{label}</p>
            </div>
          ))}
        </div>

        {/* Deploy CTA */}
        <Link
          href={`/create?prompt=${encodeURIComponent(st.prompt)}`}
          className="block w-full py-2.5 text-center rounded-lg bg-angora-primary text-white text-sm font-semibold hover:bg-angora-primary-dim transition-all"
        >
          Deploy as Agent →
        </Link>
      </GlassCard>
    </motion.div>
  )
}

export default function StrategiesPage() {
  const [filter, setFilter] = useState('ALL')

  const filtered = STRATEGIES.filter((s) => filter === 'ALL' || s.type === filter)

  return (
    <div className="min-h-screen bg-angora-bg px-6 py-10">
      <div className="max-w-6xl mx-auto">
        <div className="mb-3">
          <span className="text-angora-primary text-xs font-mono uppercase tracking-widest">
            Strategy Catalogue
          </span>
        </div>
        <h1 className="text-4xl font-bold text-white mb-2">Strategies.</h1>
        <p className="text-angora-muted mb-8">
          Pre-built, backtested strategies. Deploy any as an autonomous agent in one click.
        </p>

        {/* Filter pills */}
        <div className="flex gap-2 flex-wrap mb-8">
          {TYPES.map((t) => (
            <button
              key={t}
              onClick={() => setFilter(t)}
              className={`px-3 py-1.5 rounded-full text-xs font-bold transition-all ${
                filter === t
                  ? 'bg-angora-primary text-white'
                  : 'border border-angora-border text-angora-muted hover:border-angora-primary/40 hover:text-white'
              }`}
            >
              {t.replace(/_/g, ' ')}
            </button>
          ))}
        </div>

        {/* Strategy grid */}
        <div className="grid md:grid-cols-2 gap-5">
          {filtered.map((strat, i) => (
            <StrategyCard key={strat.id} strategy={strat} index={i} />
          ))}
        </div>

        {filtered.length === 0 && (
          <div className="text-center py-16">
            <p className="text-angora-muted">No strategies match this filter.</p>
          </div>
        )}
      </div>
    </div>
  )
}
