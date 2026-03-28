import { Router, Request, Response } from 'express'
import { FEEDS } from '../oracle/pyth'

export const pricesRouter = Router()

const HERMES = 'https://hermes.pyth.network'

// ── Types ─────────────────────────────────────────────────────────────────────

export interface PriceEntry {
  price: number
  confidence: number
  timestamp: number
  change24h: number
  history: number[]
}

// ── In-memory state ──────────────────────────────────────────────────────────

// Rolling price history: up to 30 samples per asset (1 per 5s = ~2.5 min window)
const priceHistory: Record<string, number[]> = {}

// Full response cache (5s TTL)
let cache: { data: Record<string, PriceEntry>; expiresAt: number } | null = null
const CACHE_TTL_MS = 5_000
const HISTORY_MAX = 30

const PRICE_FEEDS = [
  { label: 'MON/USD', id: FEEDS.MON_USD },
  { label: 'ETH/USD', id: FEEDS.ETH_USD },
  { label: 'BTC/USD', id: FEEDS.BTC_USD },
  { label: 'SOL/USD', id: FEEDS.SOL_USD },
]

// ── Helpers ───────────────────────────────────────────────────────────────────

async function fetchDisplayPrices(
  feedIds: string[]
): Promise<Array<{ feedId: string; price: number; confidence: number; timestamp: number }>> {
  const params = feedIds.map((id) => `ids[]=${id}`).join('&')
  const res = await fetch(`${HERMES}/v2/updates/price/latest?${params}`)
  if (!res.ok) throw new Error(`Pyth HTTP ${res.status}`)

  const data = await res.json() as {
    parsed: Array<{
      id: string
      price: { price: string; conf: string; expo: number; publish_time: number }
    }>
  }
  return data.parsed.map((p) => {
    const price = Number(p.price.price) * Math.pow(10, p.price.expo)
    const conf = Number(p.price.conf) * Math.pow(10, p.price.expo)
    return { feedId: p.id, price, confidence: conf, timestamp: p.price.publish_time }
  })
}

/**
 * Push price into rolling history for a label.
 * Returns the (possibly trimmed) history array.
 */
export function pushHistory(label: string, price: number): number[] {
  if (!priceHistory[label]) priceHistory[label] = []
  priceHistory[label] = [...priceHistory[label].slice(-(HISTORY_MAX - 1)), price]
  return priceHistory[label]
}

/**
 * Compute % change from first to last element in a history array.
 * Returns 0 if fewer than 2 samples.
 */
export function computeChange(history: number[]): number {
  if (history.length < 2) return 0
  const first = history[0]
  const last = history[history.length - 1]
  if (first === 0) return 0
  return ((last - first) / first) * 100
}

// ── GET /api/prices ──────────────────────────────────────────────────────────
// Returns latest prices for MON/ETH/BTC/SOL with rolling history + change24h.
// Cached for 5s.
pricesRouter.get('/', async (_req: Request, res: Response) => {
  // Serve from cache if still fresh
  if (cache && Date.now() < cache.expiresAt) {
    res.json(cache.data)
    return
  }

  try {
    // Deduplicate feed IDs
    const uniqueIds = [...new Set(PRICE_FEEDS.map((f) => f.id))]
    const prices = await fetchDisplayPrices(uniqueIds)

    // Build a feedId → raw price map (normalize by stripping leading 0x)
    const byId: Record<string, { price: number; confidence: number; timestamp: number }> = {}
    for (const p of prices) {
      byId[p.feedId.replace(/^0x/, '')] = {
        price: p.price,
        confidence: p.confidence,
        timestamp: p.timestamp,
      }
    }

    // Build the full result including history and change24h
    const result: Record<string, PriceEntry> = {}
    for (const feed of PRICE_FEEDS) {
      const norm = feed.id.replace(/^0x/, '')
      const raw = byId[norm]
      if (!raw) continue

      const history = pushHistory(feed.label, raw.price)
      const change24h = computeChange(history)

      result[feed.label] = {
        price: raw.price,
        confidence: raw.confidence,
        timestamp: raw.timestamp,
        change24h,
        history: [...history],
      }
    }

    cache = { data: result, expiresAt: Date.now() + CACHE_TTL_MS }
    res.json(result)
  } catch (err) {
    console.error('[prices] fetch error:', (err as Error).message)
    // Return stale cache if available
    if (cache) {
      res.json(cache.data)
      return
    }
    res.status(503).json({ error: 'Price feed unavailable' })
  }
})
