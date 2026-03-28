/**
 * Section 4 — Phantom Approval for Trigger Tests
 * Covers the 4-step trigger flow:
 *   1. txHash received from frontend (Phantom approval)
 *   2. Optional STRICT_TX_VERIFY on-chain check
 *   3. AI cycle runs and returns structured result
 *   4. Invalid/failed tx rejected in strict mode
 */

import { describe, it, expect, vi, beforeAll, afterEach } from 'vitest'
import request from 'supertest'

// ── Mocks ─────────────────────────────────────────────────────────────────────

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
    '1m': '* * * * *', '5m': '*/5 * * * *', '15m': '*/15 * * * *',
    '1h': '0 * * * *', '4h': '0 */4 * * *', '1d': '0 0 * * *',
  },
}))

vi.mock('../lib/prisma', () => ({
  prisma: {
    agent: {
      create: vi.fn().mockResolvedValue({}),
      update: vi.fn().mockResolvedValue({}),
      findUnique: vi.fn().mockResolvedValue({
        id: 'agent-xyz',
        ownerAddress: '0xUser',
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
      findMany: vi.fn().mockResolvedValue([]),
    },
    execution: {
      create: vi.fn().mockResolvedValue({}),
      findMany: vi.fn().mockResolvedValue([]),
    },
  },
}))

vi.mock('../agent/promptBuilder', () => ({
  buildFromPrompt: vi.fn().mockResolvedValue({
    config: { name: 'Test', strategyType: 'TREND_FOLLOW', asset: 'MON/USDT', timeframe: '1h',
      indicators: {}, risk: { maxPositionPct: 5, stopLossPct: 3, takeProfitPct: 8 } },
    configHash: '0xa1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2',
  }),
  AgentConfigSchema: { parse: vi.fn() },
}))

vi.mock('../lib/contracts', () => ({
  getSigner: vi.fn(),
  getRegistryContract: vi.fn().mockReturnValue({
    registerAgent: vi.fn().mockResolvedValue({ wait: vi.fn().mockResolvedValue({ hash: '0xabc' }), hash: '0xabc' }),
    logExecution: vi.fn().mockResolvedValue({ wait: vi.fn() }),
  }),
  getDexContract: vi.fn().mockReturnValue({
    sellMON: vi.fn().mockResolvedValue({ wait: vi.fn() }),
    buyMON: vi.fn().mockResolvedValue({ wait: vi.fn() }),
  }),
}))

// Mock agentRunner for the AI cycle
const mockRunAgentCycle = vi.fn().mockResolvedValue({
  agentId: 'agent-xyz',
  signal: 'BUY',
  confidence: 85,
  reasoning: 'EMA crossover confirmed. Strong upward momentum.',
  price: 22.4,
  txHash: '0xcycle-tx-hash',
})

vi.mock('../agent/agentRunner', () => ({
  runAgentCycle: mockRunAgentCycle,
}))

// Hoist the receipt mock so it's available inside vi.mock factory (which runs before module scope)
const mockGetTransactionReceipt = vi.hoisted(() => vi.fn())

// Mock ethers so JsonRpcProvider is a proper constructor (not an arrow fn)
vi.mock('ethers', () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  function MockJsonRpcProvider(_url: string): any {
    return { getTransactionReceipt: mockGetTransactionReceipt }
  }
  return {
    ethers: { JsonRpcProvider: MockJsonRpcProvider },
  }
})

// ── App setup ─────────────────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let app: any

beforeAll(async () => {
  process.env.NODE_ENV = 'test'
  process.env.MONAD_RPC_URL = 'https://testnet-rpc.monad.xyz'
  const mod = await import('../index')
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  app = mod.default as any
})

afterEach(() => {
  delete process.env.STRICT_TX_VERIFY
  vi.clearAllMocks()
  // Restore default mocks after each test
  mockRunAgentCycle.mockResolvedValue({
    agentId: 'agent-xyz', signal: 'BUY', confidence: 85,
    reasoning: 'EMA crossover confirmed.', price: 22.4, txHash: '0xcycle-tx-hash',
  })
})

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('Section 4.2 — POST /api/agents/:id/trigger with txHash', () => {
  it('returns 200 with signal/confidence/reasoning/price/txHash (no txHash in body)', async () => {
    const res = await request(app).post('/api/agents/agent-xyz/trigger').send({})

    expect(res.status).toBe(200)
    expect(res.body).toHaveProperty('signal')
    expect(res.body).toHaveProperty('confidence')
    expect(res.body).toHaveProperty('reasoning')
    expect(res.body).toHaveProperty('price')
    expect(res.body).toHaveProperty('txHash')
  })

  it('accepts txHash from Phantom in the request body and still returns 200', async () => {
    const phantomTxHash = '0xdeadbeef1234567890abcdef1234567890abcdef1234567890abcdef12345678'

    const res = await request(app)
      .post('/api/agents/agent-xyz/trigger')
      .send({ txHash: phantomTxHash })

    expect(res.status).toBe(200)
    expect(res.body.signal).toBe('BUY')
    expect(res.body.confidence).toBe(85)
    expect(res.body.reasoning).toContain('EMA crossover')
  })

  it('response shape exactly matches Section 4.2 spec: signal, confidence, reasoning, price, txHash', async () => {
    const res = await request(app)
      .post('/api/agents/agent-xyz/trigger')
      .send({ txHash: '0xabc123' })

    const { signal, confidence, reasoning, price, txHash } = res.body
    expect(['BUY', 'SELL', 'HOLD']).toContain(signal)
    expect(typeof confidence).toBe('number')
    expect(typeof reasoning).toBe('string')
    expect(typeof price).toBe('number')
    // txHash is from the on-chain cycle result (may be null or string)
    expect(txHash === null || typeof txHash === 'string').toBe(true)
  })

  it('runs the agent cycle after receiving txHash — runAgentCycle is called once', async () => {
    await request(app)
      .post('/api/agents/agent-xyz/trigger')
      .send({ txHash: '0xphantom-tx' })

    expect(mockRunAgentCycle).toHaveBeenCalledTimes(1)
    expect(mockRunAgentCycle).toHaveBeenCalledWith('agent-xyz', expect.objectContaining({
      strategyType: 'TREND_FOLLOW',
    }))
  })
})

describe('Section 4.2 — STRICT_TX_VERIFY mode', () => {
  it('skips verification when STRICT_TX_VERIFY is not set (default)', async () => {
    const res = await request(app)
      .post('/api/agents/agent-xyz/trigger')
      .send({ txHash: '0xanytx' })

    expect(res.status).toBe(200)
    expect(mockGetTransactionReceipt).not.toHaveBeenCalled()
  })

  it('verifies tx on Monad when STRICT_TX_VERIFY=true and tx is confirmed', async () => {
    process.env.STRICT_TX_VERIFY = 'true'
    mockGetTransactionReceipt.mockResolvedValueOnce({ status: 1, hash: '0xconfirmed' })

    const res = await request(app)
      .post('/api/agents/agent-xyz/trigger')
      .send({ txHash: '0xconfirmed-tx' })

    expect(res.status).toBe(200)
    expect(mockGetTransactionReceipt).toHaveBeenCalledWith('0xconfirmed-tx')
    expect(res.body.signal).toBe('BUY')
  })

  it('returns 400 when STRICT_TX_VERIFY=true and tx receipt is null (not found)', async () => {
    process.env.STRICT_TX_VERIFY = 'true'
    mockGetTransactionReceipt.mockResolvedValueOnce(null)

    const res = await request(app)
      .post('/api/agents/agent-xyz/trigger')
      .send({ txHash: '0xmissing-tx' })

    expect(res.status).toBe(400)
    expect(res.body.error).toMatch(/invalid|failed|not confirmed/i)
  })

  it('returns 400 when STRICT_TX_VERIFY=true and tx status is 0 (reverted)', async () => {
    process.env.STRICT_TX_VERIFY = 'true'
    mockGetTransactionReceipt.mockResolvedValueOnce({ status: 0, hash: '0xreverted' })

    const res = await request(app)
      .post('/api/agents/agent-xyz/trigger')
      .send({ txHash: '0xreverted-tx' })

    expect(res.status).toBe(400)
    expect(res.body.error).toMatch(/invalid|failed/i)
  })

  it('does NOT verify when txHash is omitted, even in strict mode', async () => {
    process.env.STRICT_TX_VERIFY = 'true'

    const res = await request(app)
      .post('/api/agents/agent-xyz/trigger')
      .send({})

    expect(res.status).toBe(200)
    expect(mockGetTransactionReceipt).not.toHaveBeenCalled()
  })
})

describe('Section 4.1 — Trigger Flow edge cases', () => {
  it('returns 404 when agent does not exist', async () => {
    const { prisma } = await import('../lib/prisma')
    vi.mocked(prisma.agent.findUnique).mockResolvedValueOnce(null)

    const res = await request(app)
      .post('/api/agents/ghost-agent/trigger')
      .send({ txHash: '0xabc' })

    expect(res.status).toBe(404)
    expect(res.body.error).toMatch(/not found/i)
  })

  it('returns 400 when agent is inactive (Phantom approval blocked)', async () => {
    const { prisma } = await import('../lib/prisma')
    vi.mocked(prisma.agent.findUnique).mockResolvedValueOnce({
      id: 'paused-agent',
      ownerAddress: '0xUser',
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

    const res = await request(app)
      .post('/api/agents/paused-agent/trigger')
      .send({ txHash: '0xabc' })

    expect(res.status).toBe(400)
    expect(res.body.error).toMatch(/inactive/i)
  })

  it('returns BUY, SELL, or HOLD signal — never any other value', async () => {
    for (const signal of ['BUY', 'SELL', 'HOLD'] as const) {
      mockRunAgentCycle.mockResolvedValueOnce({
        agentId: 'agent-xyz', signal, confidence: 70,
        reasoning: `Mock ${signal} signal`, price: 20, txHash: null,
      })

      const res = await request(app)
        .post('/api/agents/agent-xyz/trigger')
        .send({ txHash: '0xtesthash' })

      expect(res.status).toBe(200)
      expect(res.body.signal).toBe(signal)
    }
  })

  it('confidence is always a number between 0 and 100', async () => {
    const res = await request(app)
      .post('/api/agents/agent-xyz/trigger')
      .send({ txHash: '0xtest' })

    const { confidence } = res.body
    expect(typeof confidence).toBe('number')
    expect(confidence).toBeGreaterThanOrEqual(0)
    expect(confidence).toBeLessThanOrEqual(100)
  })
})
