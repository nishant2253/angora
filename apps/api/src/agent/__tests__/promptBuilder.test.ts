import { describe, it, expect, vi, afterEach } from 'vitest'
import { ethers } from 'ethers'

// ── Top-level mock — hoisted before module imports ────────────────────────────
vi.mock('@google/generative-ai', () => {
  const mockText = vi.fn(() =>
    JSON.stringify({
      name: 'EMA Crossover',
      strategyType: 'TREND_FOLLOW',
      asset: 'MON/USDT',
      timeframe: '1h',
      indicators: { ema: { fast: 20, slow: 60 } },
      risk: { maxPositionPct: 5, stopLossPct: 3, takeProfitPct: 8 },
    })
  )

  const mockGenerateContent = vi.fn().mockResolvedValue({
    response: { text: mockText },
  })

  const mockGetGenerativeModel = vi.fn().mockReturnValue({
    generateContent: mockGenerateContent,
  })

  return {
    GoogleGenerativeAI: vi.fn().mockImplementation(function (this: any) {
      this.getGenerativeModel = mockGetGenerativeModel
    }),
  }
})

import {
  AgentConfigSchema,
  buildFromPrompt,
  type AgentConfig,
} from '../promptBuilder'

afterEach(() => {
  vi.clearAllMocks()
})

// ── AgentConfigSchema — Zod validation ───────────────────────────────────────

describe('AgentConfigSchema', () => {
  const validConfig = {
    name: 'EMA Crossover Strategy',
    strategyType: 'TREND_FOLLOW' as const,
    asset: 'MON/USDT',
    timeframe: '1h' as const,
    indicators: {
      ema: { fast: 20, slow: 60 },
    },
    risk: {
      maxPositionPct: 5,
      stopLossPct: 3,
      takeProfitPct: 8,
    },
  }

  it('accepts a fully valid config', () => {
    const result = AgentConfigSchema.parse(validConfig)
    expect(result.name).toBe('EMA Crossover Strategy')
    expect(result.strategyType).toBe('TREND_FOLLOW')
    expect(result.risk.stopLossPct).toBe(3)
  })

  it('applies default asset = MON/USDT when omitted', () => {
    const { asset: _asset, ...noAsset } = validConfig
    const result = AgentConfigSchema.parse(noAsset)
    expect(result.asset).toBe('MON/USDT')
  })

  it('rejects stopLossPct: 15 — over max 10', () => {
    expect(() =>
      AgentConfigSchema.parse({
        ...validConfig,
        risk: { ...validConfig.risk, stopLossPct: 15 },
      })
    ).toThrow()
  })

  it('rejects stopLossPct: 0.1 — under min 0.5', () => {
    expect(() =>
      AgentConfigSchema.parse({
        ...validConfig,
        risk: { ...validConfig.risk, stopLossPct: 0.1 },
      })
    ).toThrow()
  })

  it('rejects maxPositionPct: 25 — over max 20', () => {
    expect(() =>
      AgentConfigSchema.parse({
        ...validConfig,
        risk: { ...validConfig.risk, maxPositionPct: 25 },
      })
    ).toThrow()
  })

  it('rejects unknown strategyType', () => {
    expect(() =>
      AgentConfigSchema.parse({ ...validConfig, strategyType: 'SCALP' })
    ).toThrow()
  })

  it('rejects unknown timeframe', () => {
    expect(() =>
      AgentConfigSchema.parse({ ...validConfig, timeframe: '2h' })
    ).toThrow()
  })

  it('rejects name shorter than 3 chars', () => {
    expect(() =>
      AgentConfigSchema.parse({ ...validConfig, name: 'AB' })
    ).toThrow()
  })

  it('accepts RSI indicators', () => {
    const result = AgentConfigSchema.parse({
      ...validConfig,
      indicators: { rsi: { period: 14, oversold: 30, overbought: 70 } },
    })
    expect(result.indicators.rsi?.period).toBe(14)
  })

  it('accepts empty indicators', () => {
    const result = AgentConfigSchema.parse({
      ...validConfig,
      indicators: {},
    })
    expect(result.indicators.ema).toBeUndefined()
    expect(result.indicators.rsi).toBeUndefined()
  })
})

// ── buildFromPrompt — Gemini mocked ──────────────────────────────────────────

describe('buildFromPrompt', () => {
  it('returns a validated config and configHash', async () => {
    const { config, configHash } = await buildFromPrompt(
      'EMA crossover 20/60 on MON/USDT, 3% stop loss, 8% take profit'
    )
    expect(config.strategyType).toBe('TREND_FOLLOW')
    expect(config.risk.stopLossPct).toBe(3)
    expect(configHash).toBeDefined()
  })

  it('configHash is a 66-character 0x-prefixed hex string', async () => {
    const { configHash } = await buildFromPrompt('any prompt')
    expect(configHash).toMatch(/^0x[0-9a-fA-F]{64}$/)
    expect(configHash).toHaveLength(66)
  })

  it('configHash matches manually computed keccak256', async () => {
    const { config, configHash } = await buildFromPrompt('prompt A')
    const expected = ethers.keccak256(
      ethers.toUtf8Bytes(JSON.stringify(config))
    )
    expect(configHash).toBe(expected)
  })

  it('configHash raw hex is 64 chars (32 bytes)', async () => {
    const { configHash } = await buildFromPrompt('prompt B')
    expect(configHash.slice(2)).toHaveLength(64)
  })
})
