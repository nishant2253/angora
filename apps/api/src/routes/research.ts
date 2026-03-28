import { Router, Request, Response } from 'express'
import { GoogleGenerativeAI } from '@google/generative-ai'
import IORedis from 'ioredis'

export const researchRouter = Router()

const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379'
const CACHE_KEY = 'research:commentary'
const CACHE_TTL = 14400 // 4 hours

// Lazy Redis client — only connects when first request arrives
let redis: IORedis | null = null

function getRedis(): IORedis {
  if (!redis) {
    redis = new IORedis(REDIS_URL, {
      maxRetriesPerRequest: 1,
      retryStrategy: () => null, // don't retry — fall back to live Gemini on cache miss
      lazyConnect: true,
    })
    redis.on('error', () => {
      // Silently handle Redis errors — we fall back gracefully below
    })
  }
  return redis
}

interface AssetPrice {
  symbol: string
  price: number
  confidence: number
}

async function fetchAllCurrentPrices(): Promise<AssetPrice[]> {
  const HERMES = process.env.PYTH_HERMES_URL || 'https://hermes.pyth.network'
  const feeds = [
    { symbol: 'ETH/USD', id: '0xff61491a931112ddf1bd8147cd1b641375f79f5825126d665480874634fd0ace' },
    { symbol: 'BTC/USD', id: '0x42bfb26778f3504a9f359a92c731f77d0c24aed9b7745276e3ad0c2d840b74c2' },
    { symbol: 'SOL/USD', id: '0xef0d8b6fda2ceba41da15d4095d1da392a0d2f8ed0c6c7bc0f4cfac8c280b56d' },
  ]

  const params = feeds.map((f) => `ids[]=${f.id}`).join('&')
  const res = await fetch(`${HERMES}/v2/updates/price/latest?${params}`)
  if (!res.ok) throw new Error(`Pyth HTTP ${res.status}`)

  const data = await res.json() as {
    parsed: Array<{
      id: string
      price: { price: string; conf: string; expo: number }
    }>
  }

  const byId: Record<string, { price: number; confidence: number }> = {}
  for (const p of data.parsed) {
    const price = Number(p.price.price) * Math.pow(10, p.price.expo)
    const conf = Number(p.price.conf) * Math.pow(10, p.price.expo)
    byId[p.id.replace(/^0x/, '')] = { price, confidence: conf }
  }

  return feeds.map((f) => {
    const norm = f.id.replace(/^0x/, '')
    const entry = byId[norm]
    return { symbol: f.symbol, price: entry?.price ?? 0, confidence: entry?.confidence ?? 0 }
  })
}

function classifyRegime(prices: AssetPrice[]): { regime: string; color: string } {
  // Simple heuristic: if confidence is very low relative to price, market is stable/trending
  const avgConfRatio = prices.reduce((acc, p) => acc + (p.confidence / (p.price || 1)), 0) / prices.length
  if (avgConfRatio < 0.0005) return { regime: 'TRENDING', color: 'emerald' }
  if (avgConfRatio < 0.002) return { regime: 'RANGING', color: 'yellow' }
  return { regime: 'VOLATILE', color: 'red' }
}

// ── GET /api/research/commentary ────────────────────────────────────────────
researchRouter.get('/commentary', async (_req: Request, res: Response) => {
  const client = getRedis()

  // Try cache first
  try {
    await client.connect().catch(() => {}) // connect if not already
    const cached = await client.get(CACHE_KEY)
    if (cached) {
      res.json(JSON.parse(cached))
      return
    }
  } catch {
    // Redis unavailable — proceed to generate live
  }

  try {
    const prices = await fetchAllCurrentPrices()
    const regime = classifyRegime(prices)

    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!)
    const model = genAI.getGenerativeModel({
      model: process.env.GEMINI_MODEL || 'gemini-2.5-flash-preview-05-20',
      generationConfig: { temperature: 0.3 },
    })

    const prompt = `You are a professional crypto market analyst. Analyze these live market conditions from Pyth Network:

${prices.map((p) => `${p.symbol}: $${p.price.toFixed(2)} (confidence: ±$${p.confidence.toFixed(4)})`).join('\n')}

Market Regime: ${regime.regime}

Write a concise 3-paragraph market commentary covering:
1. Overall market regime and momentum (trending, ranging, or volatile)
2. Key levels and what traders should watch for in ETH and BTC
3. Trading opportunities and risk management advice for the current conditions

Keep each paragraph to 2-3 sentences. Be specific with price levels.`

    const result = await model.generateContent(prompt)
    const commentary = result.response.text()

    const payload = {
      commentary,
      regime: regime.regime,
      regimeColor: regime.color,
      prices,
      generatedAt: new Date().toISOString(),
    }

    // Cache for 4 hours if Redis is available
    try {
      await client.setex(CACHE_KEY, CACHE_TTL, JSON.stringify(payload))
    } catch {
      // Cache write failed — return result anyway
    }

    res.json(payload)
  } catch (err) {
    console.error('[research] commentary error:', (err as Error).message)
    res.status(500).json({ error: 'Failed to generate commentary' })
  }
})

// ── GET /api/research/prices ─────────────────────────────────────────────────
// Quick endpoint to get all prices for the regime analysis without AI
researchRouter.get('/prices', async (_req: Request, res: Response) => {
  try {
    const prices = await fetchAllCurrentPrices()
    const regime = classifyRegime(prices)
    res.json({ prices, regime: regime.regime, regimeColor: regime.color })
  } catch (err) {
    res.status(500).json({ error: (err as Error).message })
  }
})
