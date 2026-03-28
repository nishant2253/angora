import type { AgentConfig } from './promptBuilder'

export interface OHLCV {
  time: number
  open: number
  high: number
  low: number
  close: number
  volume: number
}

export interface Indicators {
  ema?: { fast: number; slow: number; trend: 'UP' | 'DOWN' | 'FLAT' }
  rsi?: number
}

// ── Synthetic OHLCV (deterministic random walk from live Pyth price) ───────
// Monad testnet has no real candle data; we simulate realistic price history
// seeded from the current live price so indicators are deterministic per call.

export function fetchOHLCV(
  _asset: string,
  _timeframe: string,
  limit = 60,
  currentPrice = 100
): OHLCV[] {
  const candles: OHLCV[] = []
  // Seed random walk from current price (deterministic within the same second)
  let price = currentPrice
  const seed = Math.floor(currentPrice * 100) % 9973
  let rng = seed

  const lcg = (): number => {
    rng = (rng * 1664525 + 1013904223) % 2 ** 32
    return rng / 2 ** 32
  }

  const now = Math.floor(Date.now() / 1000)
  const intervalSec = 60 // 1m candles

  for (let i = limit - 1; i >= 0; i--) {
    const drift = (lcg() - 0.49) * 0.004 // ±0.4% per candle
    const open = price
    const close = open * (1 + drift)
    const range = open * (lcg() * 0.003 + 0.001)
    const high = Math.max(open, close) + range
    const low = Math.min(open, close) - range
    const volume = 1000 + lcg() * 4000

    candles.push({
      time: now - i * intervalSec,
      open,
      high,
      low,
      close,
      volume,
    })
    price = close
  }

  return candles
}

// ── EMA ────────────────────────────────────────────────────────────────────

function ema(closes: number[], period: number): number[] {
  const k = 2 / (period + 1)
  const result: number[] = []
  let prev = closes.slice(0, period).reduce((a, b) => a + b, 0) / period
  result.push(prev)
  for (let i = period; i < closes.length; i++) {
    prev = closes[i] * k + prev * (1 - k)
    result.push(prev)
  }
  return result
}

// ── RSI ────────────────────────────────────────────────────────────────────

function rsi(closes: number[], period = 14): number {
  if (closes.length < period + 1) return 50
  let gains = 0
  let losses = 0
  for (let i = 1; i <= period; i++) {
    const diff = closes[i] - closes[i - 1]
    if (diff > 0) gains += diff
    else losses += Math.abs(diff)
  }
  let avgGain = gains / period
  let avgLoss = losses / period

  for (let i = period + 1; i < closes.length; i++) {
    const diff = closes[i] - closes[i - 1]
    avgGain = (avgGain * (period - 1) + Math.max(diff, 0)) / period
    avgLoss = (avgLoss * (period - 1) + Math.max(-diff, 0)) / period
  }

  if (avgLoss === 0) return 100
  const rs = avgGain / avgLoss
  return 100 - 100 / (1 + rs)
}

// ── calculateIndicators ────────────────────────────────────────────────────

export function calculateIndicators(
  candles: OHLCV[],
  config: AgentConfig
): Indicators {
  const closes = candles.map((c) => c.close)
  const result: Indicators = {}

  if (config.indicators.ema) {
    const { fast, slow } = config.indicators.ema
    if (closes.length >= slow + 1) {
      const fastEma = ema(closes, fast)
      const slowEma = ema(closes, slow)
      const lastFast = fastEma[fastEma.length - 1]
      const lastSlow = slowEma[slowEma.length - 1]
      const diff = lastFast - lastSlow
      const trend: 'UP' | 'DOWN' | 'FLAT' =
        Math.abs(diff) / lastSlow < 0.001
          ? 'FLAT'
          : diff > 0
            ? 'UP'
            : 'DOWN'
      result.ema = { fast: lastFast, slow: lastSlow, trend }
    }
  }

  if (config.indicators.rsi) {
    const { period } = config.indicators.rsi
    result.rsi = rsi(closes, period)
  }

  return result
}

// ── Decision prompt ────────────────────────────────────────────────────────

export function buildDecisionPrompt(
  config: AgentConfig,
  price: number,
  indicators: Indicators
): string {
  const parts: string[] = [
    `Strategy: ${config.strategyType} on ${config.asset} (${config.timeframe})`,
    `Current price: $${price.toFixed(4)}`,
  ]

  if (indicators.ema) {
    const { fast, slow, trend } = indicators.ema
    parts.push(
      `EMA(${config.indicators.ema!.fast})=${fast.toFixed(4)} ` +
        `EMA(${config.indicators.ema!.slow})=${slow.toFixed(4)} trend=${trend}`
    )
  }
  if (indicators.rsi !== undefined) {
    const cfg = config.indicators.rsi!
    parts.push(
      `RSI(${cfg.period})=${indicators.rsi.toFixed(2)} ` +
        `[oversold<${cfg.oversold} overbought>${cfg.overbought}]`
    )
  }
  parts.push(
    `Risk: maxPos=${config.risk.maxPositionPct}% SL=${config.risk.stopLossPct}% TP=${config.risk.takeProfitPct}%`
  )

  return (
    `You are a quant trading agent. Analyze the following market data and respond with ONLY valid JSON:\n` +
    `{"signal":"BUY"|"SELL"|"HOLD","confidence":0-100,"reasoning":"<one sentence>"}\n\n` +
    parts.join('\n')
  )
}
