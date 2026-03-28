import { Router, Request, Response } from 'express'

export const walletRouter = Router()

const MONAD_EXPLORER_API = 'https://testnet.monadexplorer.com/api'

// ── GET /api/wallet/history?address=:addr ────────────────────────────────────
// Proxies Monad Explorer API for the wallet's tx history.
walletRouter.get('/history', async (req: Request, res: Response) => {
  const { address } = req.query

  if (!address || typeof address !== 'string') {
    res.status(400).json({ error: 'address query param required' })
    return
  }

  // Basic address validation
  if (!/^0x[0-9a-fA-F]{40}$/.test(address)) {
    res.status(400).json({ error: 'Invalid Ethereum address' })
    return
  }

  try {
    const url = `${MONAD_EXPLORER_API}?module=account&action=txlist&address=${address}&startblock=0&endblock=99999999&page=1&offset=20&sort=desc`

    const explorerRes = await fetch(url, {
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(8000),
    })

    if (!explorerRes.ok) {
      // Return empty list if explorer is unavailable rather than erroring
      res.json([])
      return
    }

    const data = await explorerRes.json() as {
      status: string
      message: string
      result: unknown
    }

    if (data.status === '1' && Array.isArray(data.result)) {
      res.json(data.result)
    } else {
      // Explorer returned no results or an error (normal for new wallets)
      res.json([])
    }
  } catch (err) {
    const msg = (err as Error).message
    console.error('[wallet] history fetch error:', msg)
    // Return empty array instead of 500 — UI handles gracefully
    res.json([])
  }
})
