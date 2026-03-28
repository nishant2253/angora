/**
 * Section 3 — Agent Control Panel Route Tests
 * Covers the routes introduced for the /agents page:
 *   GET  /api/agents?owner=           (agent list by wallet)
 *   POST /api/agents/:id/trigger      (manual run → Pyth → Gemini → DEX)
 *   POST /api/agents/:id/schedule     (change BullMQ cron interval)
 *   POST /api/agents/:id/pause        (remove repeatable job, active=false)
 *   POST /api/agents/:id/resume       (re-schedule, active=true)
 *
 * All external services (Prisma, BullMQ, Gemini, Pyth, on-chain) are mocked.
 */

import { describe, it, expect, vi, beforeAll } from 'vitest'
import request from 'supertest'

// ── Mock external dependencies BEFORE importing app ──────────────────────────

vi.mock('../queue/worker', () => ({
  agentQueue: {
    add: vi.fn().mockResolvedValue({ id: 'mock-job-id' }),
    getRepeatableJobs: vi.fn().mockResolvedValue([]),
    removeRepeatableByKey: vi.fn().mockResolvedValue(undefined),
  },
  agentWorker: { on: vi.fn() },
  conn: { disconnect: vi.fn() },
}))

vi.mock('../queue/scheduler', () => ({
  scheduleAgent: vi.fn().mockResolvedValue(undefined),
  pauseAgent: vi.fn().mockResolvedValue(undefined),
  resumeAgent: vi.fn().mockResolvedValue(undefined),
  cronMap: {
    '1m': '* * * * *',
    '5m': '*/5 * * * *',
    '15m': '*/15 * * * *',
    '1h': '0 * * * *',
    '4h': '0 */4 * * *',
    '1d': '0 0 * * *',
  },
}))

vi.mock('../lib/prisma', () => ({
  prisma: {
    agent: {
      create: vi.fn().mockResolvedValue({}),
      update: vi.fn().mockResolvedValue({}),
      findUnique: vi.fn().mockResolvedValue({
        id: 'agent-abc',
        ownerAddress: '0xOwner1234',
        strategyType: 'TREND_FOLLOW',
        active: true,
        cronInterval: '1h',
        nextRunAt: new Date(Date.now() + 3600_000).toISOString(),
        lastRunAt: null,
        config: {
          name: 'EMA Crossover',
          strategyType: 'TREND_FOLLOW',
          asset: 'MON/USDT',
          timeframe: '1h',
          indicators: { ema: { fast: 20, slow: 60 } },
          risk: { maxPositionPct: 5, stopLossPct: 3, takeProfitPct: 8 },
        },
      }),
      findMany: vi.fn().mockResolvedValue([
        {
          id: 'agent-abc',
          ownerAddress: '0xOwner1234',
          strategyType: 'TREND_FOLLOW',
          active: true,
          cronInterval: '1h',
          nextRunAt: new Date(Date.now() + 3600_000).toISOString(),
          lastRunAt: null,
          createdAt: new Date().toISOString(),
          executions: [
            {
              id: 'exec-1',
              signal: 'BUY',
              confidence: 82,
              price: 21.5,
              createdAt: new Date().toISOString(),
            },
          ],
        },
        {
          id: 'agent-def',
          ownerAddress: '0xOwner1234',
          strategyType: 'MEAN_REVERT',
          active: false,
          cronInterval: '15m',
          nextRunAt: null,
          lastRunAt: null,
          createdAt: new Date().toISOString(),
          executions: [],
        },
      ]),
    },
    execution: {
      create: vi.fn().mockResolvedValue({}),
      findMany: vi.fn().mockResolvedValue([]),
    },
  },
}))

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
    configHash: '0xa1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2',
  }),
  AgentConfigSchema: { parse: vi.fn() },
}))

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

vi.mock('../agent/agentRunner', () => ({
  runAgentCycle: vi.fn().mockResolvedValue({
    agentId: 'agent-abc',
    signal: 'BUY',
    confidence: 82,
    reasoning: 'EMA 20 crossed above EMA 60 — strong bullish momentum detected.',
    price: 21.5,
    txHash: '0xdeadbeef123',
  }),
}))

// ── Import app after mocks ────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let app: any

beforeAll(async () => {
  process.env.NODE_ENV = 'test'
  const mod = await import('../index')
  app = mod.default
})

// ── GET /api/agents?owner= ────────────────────────────────────────────────────

describe('GET /api/agents?owner=:address', () => {
  it('returns 200 with array of agents for the given owner', async () => {
    const res = await request(app).get('/api/agents?owner=0xOwner1234')
    expect(res.status).toBe(200)
    expect(Array.isArray(res.body)).toBe(true)
    expect(res.body).toHaveLength(2)
  })

  it('each agent has required Section 3 fields', async () => {
    const res = await request(app).get('/api/agents?owner=0xOwner1234')
    const agent = res.body[0]
    expect(agent).toHaveProperty('id')
    expect(agent).toHaveProperty('active')
    expect(agent).toHaveProperty('cronInterval')
    expect(agent).toHaveProperty('nextRunAt')
    expect(agent).toHaveProperty('strategyType')
    expect(agent).toHaveProperty('executions')
    expect(Array.isArray(agent.executions)).toBe(true)
  })

  it('returns active and paused agents correctly', async () => {
    const res = await request(app).get('/api/agents?owner=0xOwner1234')
    const active = res.body.filter((a: { active: boolean }) => a.active)
    const paused = res.body.filter((a: { active: boolean }) => !a.active)
    expect(active).toHaveLength(1)
    expect(paused).toHaveLength(1)
  })

  it('returns 200 with empty array when no agents exist', async () => {
    const { prisma } = await import('../lib/prisma')
    vi.mocked(prisma.agent.findMany).mockResolvedValueOnce([])
    const res = await request(app).get('/api/agents?owner=0xNobody')
    expect(res.status).toBe(200)
    expect(res.body).toEqual([])
  })
})

// ── POST /api/agents/:id/trigger ──────────────────────────────────────────────

describe('POST /api/agents/:id/trigger', () => {
  it('returns 200 with signal, confidence, reasoning, price, txHash', async () => {
    const res = await request(app)
      .post('/api/agents/agent-abc/trigger')
      .send({})

    expect(res.status).toBe(200)
    expect(res.body).toHaveProperty('signal')
    expect(['BUY', 'SELL', 'HOLD']).toContain(res.body.signal)
    expect(res.body).toHaveProperty('confidence')
    expect(typeof res.body.confidence).toBe('number')
    expect(res.body).toHaveProperty('reasoning')
    expect(res.body).toHaveProperty('price')
    expect(typeof res.body.price).toBe('number')
  })

  it('signal is BUY with 82% confidence (from mock)', async () => {
    const res = await request(app).post('/api/agents/agent-abc/trigger').send({})
    expect(res.body.signal).toBe('BUY')
    expect(res.body.confidence).toBe(82)
  })

  it('returns 404 when agent does not exist', async () => {
    const { prisma } = await import('../lib/prisma')
    vi.mocked(prisma.agent.findUnique).mockResolvedValueOnce(null)
    const res = await request(app).post('/api/agents/nonexistent/trigger').send({})
    expect(res.status).toBe(404)
    expect(res.body).toHaveProperty('error')
  })

  it('returns 400 when agent is inactive (paused)', async () => {
    const { prisma } = await import('../lib/prisma')
    vi.mocked(prisma.agent.findUnique).mockResolvedValueOnce({
      id: 'agent-paused',
      ownerAddress: '0xOwner',
      active: false,
      cronInterval: '1h',
      nextRunAt: null,
      lastRunAt: null,
      config: {},
      configHash: '0x0',
      strategyType: 'TREND_FOLLOW',
      txHash: null,
      createdAt: new Date(),
    })
    const res = await request(app).post('/api/agents/agent-paused/trigger').send({})
    expect(res.status).toBe(400)
    expect(res.body.error).toMatch(/inactive/i)
  })
})

// ── POST /api/agents/:id/schedule ─────────────────────────────────────────────

describe('POST /api/agents/:id/schedule', () => {
  it('returns 200 with success and updated interval', async () => {
    const res = await request(app)
      .post('/api/agents/agent-abc/schedule')
      .send({ interval: '5m' })

    expect(res.status).toBe(200)
    expect(res.body).toMatchObject({ success: true, interval: '5m' })
  })

  it('accepts all valid intervals', async () => {
    for (const interval of ['1m', '5m', '15m', '1h', '4h', '1d']) {
      const res = await request(app)
        .post('/api/agents/agent-abc/schedule')
        .send({ interval })
      expect(res.status).toBe(200)
      expect(res.body.interval).toBe(interval)
    }
  })

  it('returns 400 for invalid interval', async () => {
    const res = await request(app)
      .post('/api/agents/agent-abc/schedule')
      .send({ interval: '2h' })
    expect(res.status).toBe(400)
    expect(res.body).toHaveProperty('error')
  })

  it('returns 400 when interval is missing', async () => {
    const res = await request(app)
      .post('/api/agents/agent-abc/schedule')
      .send({})
    expect(res.status).toBe(400)
    expect(res.body).toHaveProperty('error')
  })

  it('calls scheduleAgent with correct agentId and interval', async () => {
    const { scheduleAgent } = await import('../queue/scheduler')
    vi.mocked(scheduleAgent).mockClear()

    await request(app)
      .post('/api/agents/agent-abc/schedule')
      .send({ interval: '1h' })

    expect(vi.mocked(scheduleAgent)).toHaveBeenCalledWith('agent-abc', '1h')
  })
})

// ── POST /api/agents/:id/pause ────────────────────────────────────────────────

describe('POST /api/agents/:id/pause', () => {
  it('returns 200 with success: true', async () => {
    const res = await request(app).post('/api/agents/agent-abc/pause').send({})
    expect(res.status).toBe(200)
    expect(res.body).toMatchObject({ success: true })
  })

  it('calls pauseAgent with the correct agentId', async () => {
    const { pauseAgent } = await import('../queue/scheduler')
    vi.mocked(pauseAgent).mockClear()

    await request(app).post('/api/agents/agent-abc/pause').send({})
    expect(vi.mocked(pauseAgent)).toHaveBeenCalledWith('agent-abc')
  })
})

// ── POST /api/agents/:id/resume ───────────────────────────────────────────────

describe('POST /api/agents/:id/resume', () => {
  it('returns 200 with success: true', async () => {
    const res = await request(app).post('/api/agents/agent-abc/resume').send({})
    expect(res.status).toBe(200)
    expect(res.body).toMatchObject({ success: true })
  })

  it('calls resumeAgent with the correct agentId', async () => {
    const { resumeAgent } = await import('../queue/scheduler')
    vi.mocked(resumeAgent).mockClear()

    await request(app).post('/api/agents/agent-abc/resume').send({})
    expect(vi.mocked(resumeAgent)).toHaveBeenCalledWith('agent-abc')
  })
})
