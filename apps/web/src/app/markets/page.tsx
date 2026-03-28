'use client'
import { useState, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import { GlassCard } from '@/components/ui/GlassCard'
import { SparklineChart } from '@/components/charts/SparklineChart'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'

// ── Types ──────────────────────────────────────────────────────────────────────

interface PriceData {
  price: number
  confidence: number
  timestamp: number
  change24h: number
  history: number[]
}

interface PriceResponse {
  [key: string]: PriceData
}

// ── Assets — includes feedId as per Section 7 spec ────────────────────────────
// Full Pyth feed IDs sourced from apps/api/src/oracle/pyth.ts

const ASSETS = [
  {
    symbol: 'MON/USD',
    feedId: '0xff61491a931112ddf1bd8147cd1b641375f79f5825126d665480874634fd0ace',
    icon: 'M',
    color: '#836EF9',
  },
  {
    symbol: 'ETH/USD',
    feedId: '0xff61491a931112ddf1bd8147cd1b641375f79f5825126d665480874634fd0ace',
    icon: 'Ξ',
    color: '#627EEA',
  },
  {
    symbol: 'BTC/USD',
    feedId: '0x42bfb26778f3504a9f359a92c731f77d0c24aed9b7745276e3ad0c2d840b74c2',
    icon: '₿',
    color: '#F7931A',
  },
  {
    symbol: 'SOL/USD',
    feedId: '0xef0d8b6fda2ceba41da15d4095d1da392a0d2f8ed0c6c7bc0f4cfac8c280b56d',
    icon: '◎',
    color: '#9945FF',
  },
]

// ── Price Card ─────────────────────────────────────────────────────────────────

function PriceCard({
  asset,
  priceData,
  index,
}: {
  asset: (typeof ASSETS)[number]
  priceData: PriceData | undefined
  index: number
}) {
  // change24h and history now come directly from the API (Section 7 spec)
  const change24h = priceData?.change24h ?? 0
  const isPositive = change24h >= 0

  return (
    <motion.div
      key={asset.symbol}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.08 }}
    >
      <GlassCard className="p-4">
        <div className="flex justify-between items-start mb-3">
          <div>
            <span className="text-2xl font-bold" style={{ color: asset.color }}>
              {asset.icon}
            </span>
            <h3 className="text-white font-bold text-sm mt-1">{asset.symbol}</h3>
          </div>
          <span
            className={`text-xs font-bold ${
              isPositive ? 'text-emerald-400' : 'text-red-400'
            }`}
          >
            {isPositive ? '+' : ''}
            {change24h.toFixed(2)}%
          </span>
        </div>

        {priceData ? (
          <>
            <p className="text-2xl font-bold font-mono text-white mb-1">
              ${priceData.price.toLocaleString(undefined, { maximumFractionDigits: 2 })}
            </p>
            <p className="text-xs text-angora-muted mb-3">
              Conf ±{priceData.confidence.toFixed(4)}
            </p>
            {/* Mini sparkline — history sourced from API */}
            <SparklineChart data={priceData.history ?? []} positive={isPositive} />
          </>
        ) : (
          <div className="space-y-2">
            <div className="h-8 bg-angora-surface/40 rounded animate-pulse" />
            <div className="h-12 bg-angora-surface/40 rounded animate-pulse" />
          </div>
        )}
      </GlassCard>
    </motion.div>
  )
}

// ── Market Stats Table ─────────────────────────────────────────────────────────

function MarketStatsTable({ prices }: { prices: PriceResponse | undefined }) {
  if (!prices) return null

  const rows = ASSETS.map((a) => {
    const p = prices[a.symbol]
    return {
      ...a,
      price: p?.price,
      confidence: p?.confidence,
      change24h: p?.change24h,
      timestamp: p?.timestamp,
    }
  })

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-angora-border text-left">
            <th className="pb-3 text-angora-muted text-xs uppercase tracking-wider font-medium">
              Asset
            </th>
            <th className="pb-3 text-angora-muted text-xs uppercase tracking-wider font-medium text-right">
              Price
            </th>
            <th className="pb-3 text-angora-muted text-xs uppercase tracking-wider font-medium text-right">
              Change
            </th>
            <th className="pb-3 text-angora-muted text-xs uppercase tracking-wider font-medium text-right">
              Confidence
            </th>
            <th className="pb-3 text-angora-muted text-xs uppercase tracking-wider font-medium text-right">
              Updated
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-angora-border/50">
          {rows.map((r) => (
            <tr key={r.symbol} className="hover:bg-angora-surface/30 transition-colors">
              <td className="py-3 flex items-center gap-2">
                <span className="font-bold text-base" style={{ color: r.color }}>
                  {r.icon}
                </span>
                <span className="text-white font-medium">{r.symbol}</span>
              </td>
              <td className="py-3 text-right font-mono text-white font-semibold">
                {r.price != null
                  ? `$${r.price.toLocaleString(undefined, { maximumFractionDigits: 2 })}`
                  : '—'}
              </td>
              <td className="py-3 text-right font-mono text-xs">
                {r.change24h != null ? (
                  <span className={r.change24h >= 0 ? 'text-emerald-400' : 'text-red-400'}>
                    {r.change24h >= 0 ? '+' : ''}
                    {r.change24h.toFixed(2)}%
                  </span>
                ) : (
                  <span className="text-angora-muted">—</span>
                )}
              </td>
              <td className="py-3 text-right font-mono text-angora-muted text-xs">
                {r.confidence != null ? `±${r.confidence.toFixed(4)}` : '—'}
              </td>
              <td className="py-3 text-right text-angora-muted text-xs">
                {r.timestamp != null
                  ? new Date(r.timestamp * 1000).toLocaleTimeString()
                  : '—'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// ── Page ───────────────────────────────────────────────────────────────────────

export default function MarketsPage() {
  const { data: prices, isLoading, dataUpdatedAt } = useQuery<PriceResponse>({
    queryKey: ['prices'],
    queryFn: () => fetch(`${API_URL}/api/prices`).then((r) => r.json()),
    refetchInterval: 5_000,
  })

  const [lastUpdate, setLastUpdate] = useState<string>('')
  useEffect(() => {
    if (dataUpdatedAt) {
      setLastUpdate(new Date(dataUpdatedAt).toLocaleTimeString())
    }
  }, [dataUpdatedAt])

  return (
    <div className="min-h-screen bg-angora-bg px-6 py-10">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex items-center gap-2 mb-3">
          <span className="w-2 h-2 bg-angora-cyan rounded-full animate-pulse" />
          <span className="text-angora-cyan text-xs font-mono uppercase tracking-widest">
            Live · Pyth Network
          </span>
        </div>
        <div className="flex items-end justify-between mb-2">
          <h1 className="text-4xl font-bold text-white">Markets.</h1>
          {lastUpdate && (
            <p className="text-angora-muted text-xs font-mono pb-1">
              Last update: {lastUpdate}
            </p>
          )}
        </div>
        <p className="text-angora-muted mb-8">
          Real-time price feeds from Pyth oracle. Refreshes every 5 seconds.
        </p>

        {/* Price cards grid */}
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-10">
          {ASSETS.map((asset, i) => (
            <PriceCard
              key={asset.symbol}
              asset={asset}
              priceData={prices?.[asset.symbol]}
              index={i}
            />
          ))}
        </div>

        {/* Market stats table */}
        <GlassCard className="p-5">
          <h2 className="text-white font-bold mb-4">Market Overview</h2>
          {isLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="h-10 bg-angora-surface/40 rounded animate-pulse" />
              ))}
            </div>
          ) : (
            <MarketStatsTable prices={prices} />
          )}
        </GlassCard>
      </div>
    </div>
  )
}
