/**
 * Section 5 — /wallet Route Tests
 * Covers GET /api/wallet/history:
 *   - Input validation (address required, valid hex)
 *   - Successful response with tx list from Monad Explorer
 *   - Graceful fallback when explorer returns no results (new wallet)
 *   - Graceful fallback when explorer is unreachable
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
  scheduleAgent: vi.fn(),
  pauseAgent: vi.fn(),
  resumeAgent: vi.fn(),
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
  buildFromPrompt: vi.fn(),
  AgentConfigSchema: { parse: vi.fn() },
}))

vi.mock('../lib/contracts', () => ({
  getSigner: vi.fn(),
  getRegistryContract: vi.fn().mockReturnValue({ registerAgent: vi.fn() }),
  getDexContract: vi.fn(),
}))

vi.mock('../agent/agentRunner', () => ({
  runAgentCycle: vi.fn(),
}))

// Mock fetch for Monad Explorer calls
const mockFetch = vi.hoisted(() => vi.fn())
vi.stubGlobal('fetch', mockFetch)

// ── App setup ─────────────────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let app: any

beforeAll(async () => {
  process.env.NODE_ENV = 'test'
  const mod = await import('../index')
  app = mod.default
})

afterEach(() => {
  vi.clearAllMocks()
})

// ── Helper ────────────────────────────────────────────────────────────────────

const VALID_ADDRESS = '0xa65822669C35c7bA98B8685C190c6021C6FCDE71'

const MOCK_TX_LIST = [
  {
    hash: '0xdeadbeef1234567890abcdef1234567890abcdef1234567890abcdef12345678',
    from: VALID_ADDRESS,
    to: '0x194512aF160A2507928546DCE31a6aD5448B8E77',
    value: '10000000000000000',
    timeStamp: '1710000000',
    isError: '0',
    functionName: 'logExecution',
  },
  {
    hash: '0xfeedface1234567890abcdef1234567890abcdef1234567890abcdef12345678',
    from: VALID_ADDRESS,
    to: '0x1B625A368Dbd7439d4ED274787301472958A4Db3',
    value: '0',
    timeStamp: '1710000100',
    isError: '0',
    functionName: 'faucet',
  },
]

function mockExplorerSuccess(txList = MOCK_TX_LIST) {
  mockFetch.mockResolvedValueOnce({
    ok: true,
    json: async () => ({ status: '1', message: 'OK', result: txList }),
  })
}

function mockExplorerNoResults() {
  mockFetch.mockResolvedValueOnce({
    ok: true,
    json: async () => ({ status: '0', message: 'No transactions found', result: [] }),
  })
}

function mockExplorerDown() {
  mockFetch.mockRejectedValueOnce(new Error('ECONNREFUSED'))
}

function mockExplorer4xx() {
  mockFetch.mockResolvedValueOnce({ ok: false, status: 429 })
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('Section 5 — GET /api/wallet/history', () => {
  describe('input validation', () => {
    it('returns 400 when address query param is missing', async () => {
      const res = await request(app).get('/api/wallet/history')
      expect(res.status).toBe(400)
      expect(res.body.error).toMatch(/address/i)
    })

    it('returns 400 for an invalid Ethereum address (too short)', async () => {
      const res = await request(app).get('/api/wallet/history?address=0x1234')
      expect(res.status).toBe(400)
      expect(res.body.error).toMatch(/invalid/i)
    })

    it('returns 400 for non-hex address', async () => {
      const res = await request(app).get('/api/wallet/history?address=not-an-address')
      expect(res.status).toBe(400)
    })

    it('returns 400 for address without 0x prefix', async () => {
      const res = await request(app).get(
        '/api/wallet/history?address=a65822669C35c7bA98B8685C190c6021C6FCDE71'
      )
      expect(res.status).toBe(400)
    })

    it('accepts a valid 40-hex-char 0x-prefixed address', async () => {
      mockExplorerNoResults()
      const res = await request(app).get(`/api/wallet/history?address=${VALID_ADDRESS}`)
      expect(res.status).toBe(200)
    })
  })

  describe('successful response from Monad Explorer', () => {
    it('returns 200 with tx array when Explorer returns results', async () => {
      mockExplorerSuccess()
      const res = await request(app).get(`/api/wallet/history?address=${VALID_ADDRESS}`)

      expect(res.status).toBe(200)
      expect(Array.isArray(res.body)).toBe(true)
      expect(res.body).toHaveLength(2)
    })

    it('each tx record has hash, from, to, value, timeStamp, isError', async () => {
      mockExplorerSuccess()
      const res = await request(app).get(`/api/wallet/history?address=${VALID_ADDRESS}`)

      const tx = res.body[0]
      expect(tx).toHaveProperty('hash')
      expect(tx).toHaveProperty('from')
      expect(tx).toHaveProperty('to')
      expect(tx).toHaveProperty('value')
      expect(tx).toHaveProperty('timeStamp')
      expect(tx).toHaveProperty('isError')
    })

    it('hash is a 0x-prefixed hex string', async () => {
      mockExplorerSuccess()
      const res = await request(app).get(`/api/wallet/history?address=${VALID_ADDRESS}`)
      expect(res.body[0].hash).toMatch(/^0x[0-9a-fA-F]+$/)
    })

    it('isError field is "0" for successful txs', async () => {
      mockExplorerSuccess()
      const res = await request(app).get(`/api/wallet/history?address=${VALID_ADDRESS}`)
      const successTxs = res.body.filter((t: { isError: string }) => t.isError === '0')
      expect(successTxs).toHaveLength(2)
    })

    it('passes the correct address to Monad Explorer', async () => {
      mockExplorerSuccess()
      await request(app).get(`/api/wallet/history?address=${VALID_ADDRESS}`)

      expect(mockFetch).toHaveBeenCalledOnce()
      const [url] = mockFetch.mock.calls[0] as [string]
      expect(url).toContain(VALID_ADDRESS)
      expect(url).toContain('module=account')
      expect(url).toContain('action=txlist')
    })
  })

  describe('graceful fallbacks (Section 5 UX requirement)', () => {
    it('returns 200 with empty array when Explorer reports no txs (new wallet)', async () => {
      mockExplorerNoResults()
      const res = await request(app).get(`/api/wallet/history?address=${VALID_ADDRESS}`)

      expect(res.status).toBe(200)
      expect(res.body).toEqual([])
    })

    it('returns 200 with empty array when Explorer is down (ECONNREFUSED)', async () => {
      mockExplorerDown()
      const res = await request(app).get(`/api/wallet/history?address=${VALID_ADDRESS}`)

      expect(res.status).toBe(200)
      expect(res.body).toEqual([])
    })

    it('returns 200 with empty array when Explorer returns 4xx (rate limit)', async () => {
      mockExplorer4xx()
      const res = await request(app).get(`/api/wallet/history?address=${VALID_ADDRESS}`)

      expect(res.status).toBe(200)
      expect(res.body).toEqual([])
    })

    it('returns 200 with empty array when Explorer returns non-array result', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ status: '0', message: 'NOTOK', result: 'Max rate limit reached' }),
      })
      const res = await request(app).get(`/api/wallet/history?address=${VALID_ADDRESS}`)

      expect(res.status).toBe(200)
      expect(res.body).toEqual([])
    })
  })

  describe('Section 5 wallet page spec alignment', () => {
    it('only returns up to 20 txs (offset=20 in Explorer URL)', async () => {
      // The route limits to 20 with offset=20 in the Monad Explorer URL
      mockExplorerSuccess()
      await request(app).get(`/api/wallet/history?address=${VALID_ADDRESS}`)

      const [url] = mockFetch.mock.calls[0] as [string]
      expect(url).toContain('offset=20')
    })

    it('returns results sorted by desc (newest first)', async () => {
      mockExplorerSuccess()
      await request(app).get(`/api/wallet/history?address=${VALID_ADDRESS}`)

      const [url] = mockFetch.mock.calls[0] as [string]
      expect(url).toContain('sort=desc')
    })
  })
})
