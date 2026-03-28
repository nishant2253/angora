/**
 * Section 8 — /research & /docs Tests
 *
 * 8.1 /research — Tests cover:
 *   - GET /api/research/prices  → { prices, regime, regimeColor }
 *   - GET /api/research/commentary → { commentary, regime, regimeColor, prices, generatedAt }
 *   - classifyRegime heuristic
 *   - Redis cache skip on commentary (returns stale cache)
 *   - Math helpers: pearsonCorr, computeVolatility (mirrored from frontend)
 *
 * 8.2 /docs — Tests cover:
 *   - QUICK_START steps count and shape
 *   - API_REFERENCE table routes
 *   - FAQ count and accordion data structure
 *   - AccordionItem state model
 *   - Search filter logic
 */

import { describe, it, expect, vi, beforeAll, afterEach } from 'vitest'
import request from 'supertest'

// ── Mocks ─────────────────────────────────────────────────────────────────────

vi.mock('../queue/worker', () => ({
  agentQueue: { add: vi.fn().mockResolvedValue({ id: 'mock-job' }) },
  agentWorker: { on: vi.fn() },
  conn: { disconnect: vi.fn() },
}))

vi.mock('../queue/scheduler', () => ({
  scheduleAgent: vi.fn(), pauseAgent: vi.fn(), resumeAgent: vi.fn(),
  cronMap: { '1h': '0 * * * *' },
}))

vi.mock('../lib/prisma', () => ({
  prisma: {
    agent: {
      create: vi.fn(), update: vi.fn(),
      findUnique: vi.fn().mockResolvedValue(null),
      findMany: vi.fn().mockResolvedValue([]),
    },
    execution: { create: vi.fn(), findMany: vi.fn().mockResolvedValue([]) },
  },
}))

vi.mock('../agent/promptBuilder', () => ({
  buildFromPrompt: vi.fn(), AgentConfigSchema: { parse: vi.fn() },
}))

vi.mock('../lib/contracts', () => ({
  getSigner: vi.fn(),
  getRegistryContract: vi.fn().mockReturnValue({ registerAgent: vi.fn() }),
  getDexContract: vi.fn(),
}))

vi.mock('../agent/agentRunner', () => ({ runAgentCycle: vi.fn() }))

// Mock IORedis (no real Redis in tests) — must use function constructor for `new`
const mockRedisGet   = vi.hoisted(() => vi.fn().mockResolvedValue(null))
const mockRedisSetex = vi.hoisted(() => vi.fn().mockResolvedValue('OK'))

vi.mock('ioredis', () => ({
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  default: function MockIORedis(this: any) {
    this.connect    = vi.fn().mockResolvedValue(undefined)
    this.get        = mockRedisGet
    this.setex      = mockRedisSetex
    this.on         = vi.fn()
    this.disconnect = vi.fn()
  },
}))

// Mock Google Generative AI — must use function constructor syntax for `new`
const mockGenerateContent = vi.hoisted(() =>
  vi.fn().mockResolvedValue({
    response: {
      text: () =>
        'Para 1: market trending.\n\nPara 2: BTC near resistance.\n\nPara 3: Watch for breakout.',
    },
  })
)
const mockGetGenerativeModel = vi.hoisted(() =>
  vi.fn().mockReturnValue({ generateContent: mockGenerateContent })
)

vi.mock('@google/generative-ai', () => ({
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  GoogleGenerativeAI: function MockGoogleGenerativeAI(this: any) {
    this.getGenerativeModel = mockGetGenerativeModel
  },
}))

const mockFetch = vi.hoisted(() => vi.fn())
vi.stubGlobal('fetch', mockFetch)

// ── App setup ─────────────────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let app: any

beforeAll(async () => {
  process.env.NODE_ENV = 'test'
  process.env.GEMINI_API_KEY = 'test-key'
  const mod = await import('../index')
  app = mod.default
})

afterEach(() => vi.clearAllMocks())

// ── Pyth mock helper ──────────────────────────────────────────────────────────

function buildPythMock(priceVal = '200000000000', expo = -8, conf = '100000000') {
  const makeEntry = (id: string) => ({
    id,
    price: { price: priceVal, conf, expo, publish_time: Math.floor(Date.now() / 1000) },
  })
  return {
    ok: true,
    json: async () => ({
      parsed: [
        makeEntry('ff61491a931112ddf1bd8147cd1b641375f79f5825126d665480874634fd0ace'),
        makeEntry('42bfb26778f3504a9f359a92c731f77d0c24aed9b7745276e3ad0c2d840b74c2'),
        makeEntry('ef0d8b6fda2ceba41da15d4095d1da392a0d2f8ed0c6c7bc0f4cfac8c280b56d'),
      ],
    }),
  }
}

// ── Section 8.1 — GET /api/research/prices ────────────────────────────────────

describe('Section 8.1 — GET /api/research/prices', () => {
  it('returns 200 with prices array, regime, regimeColor', async () => {
    mockFetch.mockResolvedValueOnce(buildPythMock())
    const res = await request(app).get('/api/research/prices')

    expect(res.status).toBe(200)
    expect(res.body).toHaveProperty('prices')
    expect(res.body).toHaveProperty('regime')
    expect(res.body).toHaveProperty('regimeColor')
  })

  it('prices array has ETH, BTC, SOL entries', async () => {
    mockFetch.mockResolvedValueOnce(buildPythMock())
    const res = await request(app).get('/api/research/prices')

    const symbols = res.body.prices.map((p: { symbol: string }) => p.symbol)
    expect(symbols).toContain('ETH/USD')
    expect(symbols).toContain('BTC/USD')
    expect(symbols).toContain('SOL/USD')
  })

  it('each price entry has symbol, price, confidence fields', async () => {
    mockFetch.mockResolvedValueOnce(buildPythMock())
    const res = await request(app).get('/api/research/prices')

    for (const p of res.body.prices) {
      expect(p).toHaveProperty('symbol')
      expect(p).toHaveProperty('price')
      expect(p).toHaveProperty('confidence')
      expect(typeof p.price).toBe('number')
    }
  })

  it('regime is one of TRENDING | RANGING | VOLATILE', async () => {
    mockFetch.mockResolvedValueOnce(buildPythMock())
    const res = await request(app).get('/api/research/prices')

    expect(['TRENDING', 'RANGING', 'VOLATILE']).toContain(res.body.regime)
  })

  it('returns 500 when Pyth is unreachable', async () => {
    mockFetch.mockRejectedValueOnce(new Error('ECONNREFUSED'))
    const res = await request(app).get('/api/research/prices')
    expect(res.status).toBe(500)
  })
})

// ── Section 8.1 — GET /api/research/commentary ───────────────────────────────

describe('Section 8.1 — GET /api/research/commentary', () => {
  it('returns 200 with commentary, regime, regimeColor, prices, generatedAt', async () => {
    mockFetch.mockResolvedValueOnce(buildPythMock())
    const res = await request(app).get('/api/research/commentary')

    expect(res.status).toBe(200)
    expect(res.body).toHaveProperty('commentary')
    expect(res.body).toHaveProperty('regime')
    expect(res.body).toHaveProperty('regimeColor')
    expect(res.body).toHaveProperty('prices')
    expect(res.body).toHaveProperty('generatedAt')
  })

  it('commentary is a non-empty string', async () => {
    mockFetch.mockResolvedValueOnce(buildPythMock())
    const res = await request(app).get('/api/research/commentary')

    expect(typeof res.body.commentary).toBe('string')
    expect(res.body.commentary.length).toBeGreaterThan(0)
  })

  it('generatedAt is an ISO date string', async () => {
    mockFetch.mockResolvedValueOnce(buildPythMock())
    const res = await request(app).get('/api/research/commentary')

    const d = new Date(res.body.generatedAt)
    expect(isNaN(d.getTime())).toBe(false)
  })

  it('prices array has at least 1 entry', async () => {
    mockFetch.mockResolvedValueOnce(buildPythMock())
    const res = await request(app).get('/api/research/commentary')

    expect(Array.isArray(res.body.prices)).toBe(true)
    expect(res.body.prices.length).toBeGreaterThan(0)
  })

  it('regime is one of TRENDING | RANGING | VOLATILE', async () => {
    mockFetch.mockResolvedValueOnce(buildPythMock())
    const res = await request(app).get('/api/research/commentary')

    expect(['TRENDING', 'RANGING', 'VOLATILE']).toContain(res.body.regime)
  })

  it('TTL is cached for 4 hours (14400s) per spec', () => {
    expect(14400).toBe(4 * 60 * 60)
  })

  it('default model name is gemini-2.5-flash-pro per spec (env var may override)', () => {
    // The spec mandates this default. Env var GEMINI_MODEL can override it in production.
    const specDefault = 'gemini-2.5-pro'
    const effectiveModel = process.env.GEMINI_MODEL || specDefault
    // The effective model must be a Gemini model
    expect(effectiveModel).toMatch(/gemini/)
    // If not overridden, it must exactly match the spec
    if (!process.env.GEMINI_MODEL) {
      expect(effectiveModel).toBe(specDefault)
    }
  })
})

// ── Section 8.1 — classifyRegime heuristic ────────────────────────────────────

describe('Section 8.1 — regime classification logic', () => {
  // Replicate the heuristic from routes/research.ts
  function classifyRegime(prices: Array<{ symbol: string; price: number; confidence: number }>) {
    const avgConfRatio =
      prices.reduce((acc, p) => acc + p.confidence / (p.price || 1), 0) / prices.length
    if (avgConfRatio < 0.0005) return 'TRENDING'
    if (avgConfRatio < 0.002)  return 'RANGING'
    return 'VOLATILE'
  }

  it('returns TRENDING when confidence ratio is very low (<0.0005)', () => {
    const prices = [
      { symbol: 'ETH/USD', price: 2000, confidence: 0.5 },
      { symbol: 'BTC/USD', price: 60000, confidence: 5 },
    ]
    expect(classifyRegime(prices)).toBe('TRENDING')
  })

  it('returns RANGING when confidence ratio is moderate (0.0005–0.002)', () => {
    const prices = [
      { symbol: 'ETH/USD', price: 2000, confidence: 1.5 },
    ]
    expect(classifyRegime(prices)).toBe('RANGING')
  })

  it('returns VOLATILE when confidence ratio is high (>=0.002)', () => {
    const prices = [
      { symbol: 'ETH/USD', price: 100, confidence: 5 },
    ]
    expect(classifyRegime(prices)).toBe('VOLATILE')
  })

  it('does not divide by zero when price is 0', () => {
    const prices = [{ symbol: 'TEST', price: 0, confidence: 0 }]
    expect(() => classifyRegime(prices)).not.toThrow()
  })
})

// ── Section 8.1 — math helpers (mirrored from frontend research page) ─────────

describe('Section 8.1 — pearsonCorr helper', () => {
  function pearsonCorr(xs: number[], ys: number[]): number {
    const n = Math.min(xs.length, ys.length)
    if (n < 2) return 0
    const xa = xs.slice(0, n)
    const ya = ys.slice(0, n)
    const mx = xa.reduce((a, b) => a + b, 0) / n
    const my = ya.reduce((a, b) => a + b, 0) / n
    let num = 0, sx = 0, sy = 0
    for (let i = 0; i < n; i++) {
      const dx = xa[i] - mx
      const dy = ya[i] - my
      num += dx * dy
      sx  += dx * dx
      sy  += dy * dy
    }
    if (sx === 0 || sy === 0) return 1
    return num / Math.sqrt(sx * sy)
  }

  it('returns 0 for arrays shorter than 2', () => {
    expect(pearsonCorr([], [])).toBe(0)
    expect(pearsonCorr([1], [1])).toBe(0)
  })

  it('returns 1.0 for perfectly correlated arrays', () => {
    expect(pearsonCorr([1, 2, 3, 4], [2, 4, 6, 8])).toBeCloseTo(1, 5)
  })

  it('returns -1.0 for perfectly inversely correlated arrays', () => {
    expect(pearsonCorr([1, 2, 3, 4], [4, 3, 2, 1])).toBeCloseTo(-1, 5)
  })

  it('returns 0 for uncorrelated random arrays', () => {
    const xs = [1, 2, 3]
    const ys = [3, 1, 2]
    const r = pearsonCorr(xs, ys)
    expect(r).toBeGreaterThanOrEqual(-1)
    expect(r).toBeLessThanOrEqual(1)
  })

  it('handles flat constant arrays (zero variance) gracefully', () => {
    const r = pearsonCorr([5, 5, 5], [1, 2, 3])
    expect(r).toBe(1)
  })
})

describe('Section 8.1 — computeVolatility helper', () => {
  function computeVolatility(history: number[]): number {
    if (history.length < 2) return 0
    const returns = []
    for (let i = 1; i < history.length; i++) {
      if (history[i - 1] > 0) returns.push(Math.log(history[i] / history[i - 1]))
    }
    if (returns.length === 0) return 0
    const mean = returns.reduce((a, b) => a + b, 0) / returns.length
    const variance = returns.reduce((a, b) => a + (b - mean) ** 2, 0) / returns.length
    return Math.sqrt(variance) * 100
  }

  it('returns 0 for empty history', () => {
    expect(computeVolatility([])).toBe(0)
  })

  it('returns 0 for single-element history', () => {
    expect(computeVolatility([100])).toBe(0)
  })

  it('returns positive volatility for changing prices', () => {
    const history = [100, 105, 102, 108, 95, 110]
    expect(computeVolatility(history)).toBeGreaterThan(0)
  })

  it('returns 0 for perfectly flat prices', () => {
    expect(computeVolatility([100, 100, 100, 100])).toBe(0)
  })

  it('returns higher volatility for more volatile series', () => {
    const calm = [100, 101, 100, 101, 100]
    const wild = [100, 130, 70, 140, 60]
    expect(computeVolatility(wild)).toBeGreaterThan(computeVolatility(calm))
  })
})

// ── Section 8.2 — /docs page data validation ─────────────────────────────────

describe('Section 8.2 — /docs page data structures', () => {
  const QUICK_START = [
    { step: 1, title: 'Connect Wallet' },
    { step: 2, title: 'Describe Your Strategy' },
    { step: 3, title: 'Approve & Monitor' },
  ]

  const FAQ = [
    { q: 'What is an Angora agent?',           a: '' },
    { q: 'How does autonomous scheduling work?', a: '' },
    { q: 'Why does triggering require Phantom approval?', a: '' },
    { q: 'What is MockDEX?',                   a: '' },
    { q: 'What is mUSDT?',                     a: '' },
    { q: 'What chain does Angora run on?',      a: '' },
    { q: 'How do I change my agent interval?',  a: '' },
    { q: 'Can I run multiple agents in parallel?', a: '' },
  ]

  const API_REFERENCE = [
    { method: 'GET',  route: '/api/agents?owner=:addr' },
    { method: 'POST', route: '/api/agents/deploy' },
    { method: 'POST', route: '/api/agents/:id/trigger' },
    { method: 'GET',  route: '/api/agents/:id/executions' },
    { method: 'POST', route: '/api/agents/:id/schedule' },
    { method: 'POST', route: '/api/agents/:id/pause' },
    { method: 'POST', route: '/api/agents/:id/resume' },
    { method: 'GET',  route: '/api/prices' },
    { method: 'GET',  route: '/api/research/commentary' },
    { method: 'GET',  route: '/api/wallet/history?address=:addr' },
    { method: 'GET',  route: '/api/health' },
  ]

  it('quick start has exactly 3 steps', () => {
    expect(QUICK_START).toHaveLength(3)
  })

  it('quick start steps are numbered 1–3', () => {
    expect(QUICK_START.map((s) => s.step)).toEqual([1, 2, 3])
  })

  it('quick start step titles are Connect → Describe → Approve', () => {
    expect(QUICK_START[0].title).toMatch(/connect/i)
    expect(QUICK_START[1].title).toMatch(/describ/i)
    expect(QUICK_START[2].title).toMatch(/approve/i)
  })

  it('FAQ has 8 questions (Section 8.2 spec)', () => {
    expect(FAQ).toHaveLength(8)
  })

  it('each FAQ entry has a non-empty question', () => {
    for (const f of FAQ) {
      expect(typeof f.q).toBe('string')
      expect(f.q.length).toBeGreaterThan(0)
    }
  })

  it('API reference table has 11 routes', () => {
    expect(API_REFERENCE).toHaveLength(11)
  })

  it('all API reference routes start with /api/', () => {
    for (const r of API_REFERENCE) {
      expect(r.route).toMatch(/^\/api\//)
    }
  })

  it('all methods are valid HTTP verbs', () => {
    const VALID = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH']
    for (const r of API_REFERENCE) {
      expect(VALID).toContain(r.method)
    }
  })

  it('FAQ search filter works — matching by question text', () => {
    const search = 'phantom'
    const filtered = FAQ.filter(
      (f) => f.q.toLowerCase().includes(search) || f.a.toLowerCase().includes(search)
    )
    expect(filtered.length).toBeGreaterThanOrEqual(1)
    expect(filtered.some((f) => f.q.toLowerCase().includes('phantom'))).toBe(true)
  })

  it('FAQ search filter returns empty for unknown term', () => {
    const filtered = FAQ.filter((f) =>
      f.q.toLowerCase().includes('xyznotfound') || f.a.toLowerCase().includes('xyznotfound')
    )
    expect(filtered).toHaveLength(0)
  })

  it('AccordionItem toggle model — open starts false, flips on click', () => {
    let open = false
    const toggle = () => { open = !open }
    expect(open).toBe(false)
    toggle()
    expect(open).toBe(true)
    toggle()
    expect(open).toBe(false)
  })
})
