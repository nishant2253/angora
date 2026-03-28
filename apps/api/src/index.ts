import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import { agentsRouter } from './routes/agents'
import { pricesRouter } from './routes/prices'
import { researchRouter } from './routes/research'
import { walletRouter } from './routes/wallet'

// Initialize BullMQ worker only when running as a server (not in tests)
if (process.env.NODE_ENV !== 'test') {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  require('./queue/worker')
}

const app = express()
const PORT = process.env.PORT || 3001

app.use(cors())
app.use(express.json())

// ── Routes ────────────────────────────────────────────────────────────────────
app.use('/api/agents', agentsRouter)
app.use('/api/prices', pricesRouter)
app.use('/api/research', researchRouter)
app.use('/api/wallet', walletRouter)

// Health check — available at both /health and /api/health (Section 11 checklist)
const healthHandler = (_req: express.Request, res: express.Response) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() })
}
app.get('/health', healthHandler)
app.get('/api/health', healthHandler)

// ── Start ─────────────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`[Angora API] listening on http://localhost:${PORT}`)
})

export default app
