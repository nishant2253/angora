const HERMES = 'https://hermes.pyth.network'

// Full 32-byte Pyth price feed IDs
// MON/USD uses ETH/USD as proxy on Monad testnet (no native MON feed yet)
export const FEEDS = {
  MON_USD:
    '0xff61491a931112ddf1bd8147cd1b641375f79f5825126d665480874634fd0ace',
  ETH_USD:
    '0xff61491a931112ddf1bd8147cd1b641375f79f5825126d665480874634fd0ace',
  BTC_USD:
    '0x42bfb26778f3504a9f359a92c731f77d0c24aed9b7745276e3ad0c2d840b74c2',
  SOL_USD:
    '0xef0d8b6fda2ceba41da15d4095d1da392a0d2f8ed0c6c7bc0f4cfac8c280b56d',
}

export interface PriceData {
  price: number
  confidence: number
  timestamp: number
  feedId: string
}

/**
 * Batch-fetch multiple Pyth price feeds in a single Hermes request.
 * Throws if any feed has confidence > 2% of price (too noisy to trade on).
 */
export async function fetchPrices(feedIds: string[]): Promise<PriceData[]> {
  const params = feedIds.map((id) => `ids[]=${id}`).join('&')
  const res = await fetch(`${HERMES}/v2/updates/price/latest?${params}`)
  if (!res.ok) throw new Error(`Pyth HTTP ${res.status}`)

  const data = await res.json()

  return data.parsed.map((p: any) => {
    const price = Number(p.price.price) * Math.pow(10, p.price.expo)
    const conf = Number(p.price.conf) * Math.pow(10, p.price.expo)

    const confPct = (conf / price) * 100
    if (confPct > 2) {
      throw new Error(
        `Confidence too low for feed ${p.id.slice(0, 10)}...: ${confPct.toFixed(2)}%`
      )
    }

    return {
      price,
      confidence: conf,
      timestamp: p.price.publish_time,
      feedId: p.id,
    }
  })
}

/**
 * Returns true if the price timestamp is within maxAge seconds of now.
 * Default maxAge = 60 seconds.
 */
export const isFresh = (ts: number, maxAge = 60): boolean =>
  Date.now() / 1000 - ts < maxAge

/**
 * Helper: get the Pyth feed ID for a given asset symbol (e.g. "MON/USDT").
 */
export function getFeedId(asset: string): string {
  const key = asset.replace('/', '_').replace('USDT', 'USD')
  const feedId = FEEDS[key as keyof typeof FEEDS]
  if (!feedId) {
    // fallback to ETH/USD proxy
    return FEEDS.ETH_USD
  }
  return feedId
}
