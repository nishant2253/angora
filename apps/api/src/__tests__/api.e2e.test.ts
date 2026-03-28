/**
 * API E2E tests — self-contained, no Redis / DB / blockchain required.
 * All external dependencies (Gemini, Prisma, on-chain, BullMQ) are mocked.
 */

import { describe, it, expect, vi, beforeAll } from 'vitest'
import request from 'supertest'

// ── Mock external dependencies BEFORE importing app ──────────────────────────

// Prevent Redis connection at import time
vi.mock('../queue/worker', () => ({
  agentQueue: {
    add: vi.fn().mockResolvedValue({ id: 'mock-job-id' }),
  },
  agentWorker: { on: vi.fn() },
  conn: { disconnect: vi.fn() },
}))

// Prevent Prisma / DB connection
vi.mock('../lib/prisma', () => ({
  prisma: {
    agent: {
      create: vi.fn().mockResolvedValue({}),
      update: vi.fn().mockResolvedValue({}),
      findUnique: vi.fn().mockResolvedValue({
        id: 'mock-agent-id',
        active: true,
        config: {
          name: 'Test Agent',
          strategyType: 'TREND_FOLLOW',
          asset: 'MON/USDT',
          timeframe: '1h',
          indicators: { ema: { fast: 20, slow: 60 } },
          risk: { maxPositionPct: 5, stopLossPct: 3, takeProfitPct: 8 },
        },
      }),
    },
    execution: {
      create: vi.fn().mockResolvedValue({}),
      findMany: vi.fn().mockResolvedValue([
        {
          id: 'exec-1',
          agentId: 'mock-agent-id',
          signal: 'BUY',
          price: 20.5,
          confidence: 78,
          reasoning: 'EMA crossover detected',
          txHash: '0xabc123',
          pnlPct: 1.2,
          createdAt: new Date().toISOString(),
        },
      ]),
    },
  },
}))

// Mock Gemini / buildFromPrompt to return a valid config
vi.mock('../agent/promptBuilder', () => ({
  buildFromPrompt: vi.fn().mockResolvedValue({
    config: {
      name: 'EMA Crossover Trend Agent',
      strategyType: 'TREND_FOLLOW',
      asset: 'MON/USDT',
      timeframe: '1h',
      indicators: { ema: { fast: 20, slow: 60 } },
      risk: { maxPositionPct: 5, stopLossPct: 3, takeProfitPct: 8 },
    },
    configHash:
      '0xa1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2',
  }),
  AgentConfigSchema: { parse: vi.fn() },
}))

// Mock on-chain helpers (ethers + contract calls)
vi.mock('../lib/contracts', () => ({
  getSigner: vi.fn(),
  getRegistryContract: vi.fn().mockReturnValue({
    registerAgent: vi.fn().mockResolvedValue({
      wait: vi.fn().mockResolvedValue({ hash: '0xdeadbeef' }),
      hash: '0xdeadbeef',
    }),
    logExecution: vi.fn().mockResolvedValue({ wait: vi.fn() }),
  }),
  getDexContract: vi.fn().mockReturnValue({
    sellMON: vi.fn().mockResolvedValue({ wait: vi.fn() }),
    buyMON: vi.fn().mockResolvedValue({ wait: vi.fn() }),
  }),
}))

// Mock the agentRunner so trigger tests don't need Pyth / Gemini
vi.mock('../agent/agentRunner', () => ({
  runAgentCycle: vi.fn().mockResolvedValue({
    signal: 'BUY',
    confidence: 78,
    reasoning: 'Mock EMA crossover signal',
    price: 20.5,
    txHash: '0xdeadbeef',
  }),
}))

// ── Import app AFTER mocks are set up ────────────────────────────────────────

let app: any

beforeAll(async () => {
  process.env.NODE_ENV = 'test'
  const mod = await import('../index')
  app = mod.default
})

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('GET /health', () => {
  it('returns 200 with status ok', async () => {
    const res = await request(app).get('/health')
    expect(res.status).toBe(200)
    expect(res.body).toMatchObject({ status: 'ok' })
    expect(res.body.timestamp).toBeDefined()
  })
})

describe('POST /api/agents/build-from-prompt', () => {
  it('returns 200 with config and configHash for valid prompt', async () => {
    const res = await request(app)
      .post('/api/agents/build-from-prompt')
      .send({ prompt: 'EMA crossover 20/60 MON/USDT 1h 3% stop' })

    expect(res.status).toBe(200)
    expect(res.body).toHaveProperty('config')
    expect(res.body).toHaveProperty('configHash')
    // configHash must be a 66-char hex string (0x + 64 hex chars)
    expect(res.body.configHash).toMatch(/^0x[0-9a-fA-F]{64}$/)
    expect(res.body.config.strategyType).toBe('TREND_FOLLOW')
  })

  it('returns 400 when prompt is missing', async () => {
    const res = await request(app)
      .post('/api/agents/build-from-prompt')
      .send({})
    expect(res.status).toBe(400)
    expect(res.body).toHaveProperty('error')
  })

  it('returns 400 when prompt is empty string', async () => {
    const res = await request(app)
      .post('/api/agents/build-from-prompt')
      .send({ prompt: '   ' })
    expect(res.status).toBe(400)
    expect(res.body.error).toMatch(/required/)
  })
})

describe('POST /api/agents/deploy', () => {
  it('returns 200 with agentId (UUID) and configHash', async () => {
    const res = await request(app)
      .post('/api/agents/deploy')
      .send({
        prompt: 'Momentum strategy MON/USDT 5% position',
        ownerAddress: '0xa65822669C35c7bA98B8685C190c6021C6FCDE71',
      })

    expect(res.status).toBe(200)
    expect(res.body).toHaveProperty('agentId')
    // agentId must be a UUID
    expect(res.body.agentId).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/
    )
    expect(res.body).toHaveProperty('configHash')
    expect(res.body.configHash).toMatch(/^0x[0-9a-fA-F]{64}$/)
  })

  it('returns 400 when ownerAddress is missing', async () => {
    const res = await request(app)
      .post('/api/agents/deploy')
      .send({ prompt: 'some strategy' })
    expect(res.status).toBe(400)
    expect(res.body).toHaveProperty('error')
  })
})

describe('GET /api/agents/:id/executions', () => {
  it('returns 200 with an array of executions', async () => {
    const res = await request(app).get(
      '/api/agents/mock-agent-id/executions'
    )
    expect(res.status).toBe(200)
    expect(Array.isArray(res.body)).toBe(true)
    expect(res.body.length).toBeGreaterThan(0)
    expect(res.body[0]).toHaveProperty('signal')
    expect(res.body[0]).toHaveProperty('price')
    expect(res.body[0]).toHaveProperty('confidence')
  })
})
