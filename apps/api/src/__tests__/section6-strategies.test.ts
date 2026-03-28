/**
 * Section 6 — /strategies Strategy Catalogue Tests
 *
 * The strategies page is a pure-frontend static page with no API endpoint.
 * We test:
 *   1.  The STRATEGIES data constants — each entry has required fields
 *   2.  The filter logic (mirror the component's filter)
 *   3.  Deploy CTA prompt encoding
 *   4.  SignalBadge signal values are valid
 *   5.  All stats are within reasonable ranges
 */

import { describe, it, expect } from 'vitest'

// ── Replicate the strategies data ─────────────────────────────────────────────
// Keep in sync with apps/web/src/app/strategies/page.tsx

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
    description: 'Follows MACD histogram crossovers with signal line confirmation.',
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

// Mirror the page filter function
function applyFilter(filter: string): Strategy[] {
  return STRATEGIES.filter((s) => filter === 'ALL' || s.type === filter)
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('Section 6 — Strategy Catalogue data integrity', () => {
  it('has exactly 4 strategies defined', () => {
    expect(STRATEGIES).toHaveLength(4)
  })

  it('each strategy has all required fields', () => {
    const REQUIRED = [
      'id', 'name', 'type', 'asset', 'timeframe',
      'description', 'winRate', 'totalTrades', 'avgReturn',
      'maxDrawdown', 'sharpe', 'indicators', 'prompt', 'signal',
    ]
    for (const s of STRATEGIES) {
      for (const field of REQUIRED) {
        expect(s).toHaveProperty(field)
      }
    }
  })

  it('all strategy IDs are unique', () => {
    const ids = STRATEGIES.map((s) => s.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('strategy types are valid TYPES list values (excluding ALL)', () => {
    const validTypes = TYPES.filter((t) => t !== 'ALL')
    for (const s of STRATEGIES) {
      expect(validTypes).toContain(s.type)
    }
  })

  it('signal values are only BUY, SELL, or HOLD', () => {
    const VALID_SIGNALS: Signal[] = ['BUY', 'SELL', 'HOLD']
    for (const s of STRATEGIES) {
      expect(VALID_SIGNALS).toContain(s.signal)
    }
  })
})

describe('Section 6 — backtested stats ranges', () => {
  it('winRate is between 0 and 100 for every strategy', () => {
    for (const s of STRATEGIES) {
      expect(s.winRate).toBeGreaterThan(0)
      expect(s.winRate).toBeLessThanOrEqual(100)
    }
  })

  it('totalTrades is a positive integer', () => {
    for (const s of STRATEGIES) {
      expect(s.totalTrades).toBeGreaterThan(0)
      expect(Number.isInteger(s.totalTrades)).toBe(true)
    }
  })

  it('avgReturn is positive (profitable strategies)', () => {
    for (const s of STRATEGIES) {
      expect(s.avgReturn).toBeGreaterThan(0)
    }
  })

  it('maxDrawdown is a positive percentage', () => {
    for (const s of STRATEGIES) {
      expect(s.maxDrawdown).toBeGreaterThan(0)
      expect(s.maxDrawdown).toBeLessThan(100)
    }
  })

  it('sharpe ratio is > 1 for all strategies (quality threshold)', () => {
    for (const s of STRATEGIES) {
      expect(s.sharpe).toBeGreaterThan(1)
    }
  })
})

describe('Section 6 — filter logic', () => {
  it("filter='ALL' returns all 4 strategies", () => {
    expect(applyFilter('ALL')).toHaveLength(4)
  })

  it("filter='TREND_FOLLOW' returns only trend-follow strategies", () => {
    const result = applyFilter('TREND_FOLLOW')
    expect(result.length).toBeGreaterThan(0)
    for (const s of result) {
      expect(s.type).toBe('TREND_FOLLOW')
    }
  })

  it("filter='TREND_FOLLOW' returns exactly 2 strategies (EMA + MACD)", () => {
    const result = applyFilter('TREND_FOLLOW')
    expect(result).toHaveLength(2)
    expect(result.map((s) => s.id)).toContain('ema-crossover')
    expect(result.map((s) => s.id)).toContain('macd-trend')
  })

  it("filter='MEAN_REVERT' returns exactly 1 strategy (RSI)", () => {
    const result = applyFilter('MEAN_REVERT')
    expect(result).toHaveLength(1)
    expect(result[0].id).toBe('rsi-mean-revert')
  })

  it("filter='BREAKOUT' returns exactly 1 strategy (Momentum Breakout)", () => {
    const result = applyFilter('BREAKOUT')
    expect(result).toHaveLength(1)
    expect(result[0].id).toBe('momentum-break')
  })

  it("filter='MOMENTUM' returns 0 strategies (no MOMENTUM type defined yet)", () => {
    const result = applyFilter('MOMENTUM')
    expect(result).toHaveLength(0)
  })

  it('TYPES array has exactly 5 entries including ALL', () => {
    expect(TYPES).toHaveLength(5)
    expect(TYPES[0]).toBe('ALL')
  })
})

describe('Section 6 — deploy CTA prompt encoding', () => {
  it('each strategy prompt is a non-empty string', () => {
    for (const s of STRATEGIES) {
      expect(typeof s.prompt).toBe('string')
      expect(s.prompt.length).toBeGreaterThan(0)
    }
  })

  it('prompts survive URL encoding and decoding (round-trip)', () => {
    for (const s of STRATEGIES) {
      const encoded = encodeURIComponent(s.prompt)
      const decoded = decodeURIComponent(encoded)
      expect(decoded).toBe(s.prompt)
    }
  })

  it('EMA strategy prompt contains expected keywords', () => {
    const ema = STRATEGIES.find((s) => s.id === 'ema-crossover')!
    expect(ema.prompt).toContain('EMA')
    expect(ema.prompt.toLowerCase()).toContain('stop')
  })

  it('RSI strategy prompt contains expected keywords', () => {
    const rsi = STRATEGIES.find((s) => s.id === 'rsi-mean-revert')!
    expect(rsi.prompt).toContain('RSI')
    expect(rsi.prompt.toLowerCase()).toContain('stop')
  })

  it('CTA href is /create?prompt=<encoded> for each strategy', () => {
    for (const s of STRATEGIES) {
      const href = `/create?prompt=${encodeURIComponent(s.prompt)}`
      expect(href).toMatch(/^\/create\?prompt=/)
    }
  })
})
