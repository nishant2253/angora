import { describe, it, expect, vi, afterEach } from 'vitest'
import { fetchPrices, isFresh, FEEDS } from '../pyth'

describe('Pyth oracle', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  // ── isFresh ──────────────────────────────────────────────────────────────

  it('isFresh — recent ts returns true', () => {
    expect(isFresh(Date.now() / 1000 - 30)).toBe(true)
  })

  it('isFresh — stale ts returns false', () => {
    expect(isFresh(Date.now() / 1000 - 120)).toBe(false)
  })

  it('isFresh — exactly at maxAge boundary returns false', () => {
    expect(isFresh(Date.now() / 1000 - 60)).toBe(false)
  })

  it('isFresh — custom maxAge respected', () => {
    expect(isFresh(Date.now() / 1000 - 30, 60)).toBe(true)
    expect(isFresh(Date.now() / 1000 - 200, 60)).toBe(false)
  })

  // ── fetchPrices ───────────────────────────────────────────────────────────

  it('fetchPrices batches multiple feeds and returns correct price', async () => {
    vi.stubGlobal('fetch', async () => ({
      ok: true,
      json: async () => ({
        parsed: [
          {
            id: FEEDS.ETH_USD,
            price: {
              price: '200000000000',
              expo: -8,
              conf: '100000',
              publish_time: Math.floor(Date.now() / 1000),
            },
          },
        ],
      }),
    }))

    const prices = await fetchPrices([FEEDS.ETH_USD])
    expect(prices).toHaveLength(1)
    expect(prices[0].price).toBeCloseTo(2000, 0)
    expect(prices[0].feedId).toBe(FEEDS.ETH_USD)
    expect(prices[0].confidence).toBeGreaterThan(0)
  })

  it('fetchPrices throws on HTTP error', async () => {
    vi.stubGlobal('fetch', async () => ({ ok: false, status: 500 }))
    await expect(fetchPrices([FEEDS.ETH_USD])).rejects.toThrow('Pyth HTTP 500')
  })

  it('fetchPrices throws when confidence exceeds 2%', async () => {
    vi.stubGlobal('fetch', async () => ({
      ok: true,
      json: async () => ({
        parsed: [
          {
            id: FEEDS.ETH_USD,
            price: {
              price: '200000000000', // $2000
              expo: -8,
              conf: '5000000000', // $50 conf = 2.5% — over threshold
              publish_time: Math.floor(Date.now() / 1000),
            },
          },
        ],
      }),
    }))

    await expect(fetchPrices([FEEDS.ETH_USD])).rejects.toThrow(
      'Confidence too low'
    )
  })

  it('fetchPrices handles multiple feeds in one call', async () => {
    vi.stubGlobal('fetch', async () => ({
      ok: true,
      json: async () => ({
        parsed: [
          {
            id: FEEDS.ETH_USD,
            price: {
              price: '200000000000',
              expo: -8,
              conf: '50000',
              publish_time: Math.floor(Date.now() / 1000),
            },
          },
          {
            id: FEEDS.BTC_USD,
            price: {
              price: '8500000000000',
              expo: -8,
              conf: '100000',
              publish_time: Math.floor(Date.now() / 1000),
            },
          },
        ],
      }),
    }))

    const prices = await fetchPrices([FEEDS.ETH_USD, FEEDS.BTC_USD])
    expect(prices).toHaveLength(2)
    expect(prices[0].price).toBeCloseTo(2000, 0)
    expect(prices[1].price).toBeCloseTo(85000, 0)
  })
})
