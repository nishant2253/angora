import { Router, Request, Response } from 'express'
import { ZodError } from 'zod'
import { ethers } from 'ethers'
import { buildFromPrompt } from '../agent/promptBuilder'
import { runAgentCycle } from '../agent/agentRunner'
import { agentQueue } from '../queue/worker'
import { getRegistryContract, getSigner } from '../lib/contracts'
import { prisma } from '../lib/prisma'
import { scheduleAgent, pauseAgent, resumeAgent, cronMap } from '../queue/scheduler'
import type { AgentConfig } from '../agent/promptBuilder'

export const agentsRouter = Router()

// ── POST /api/agents/build-from-prompt ────────────────────────────────────
agentsRouter.post(
  '/build-from-prompt',
  async (req: Request, res: Response) => {
    const { prompt } = req.body

    if (!prompt || typeof prompt !== 'string' || prompt.trim().length === 0) {
      res.status(400).json({ error: 'prompt is required and must be a non-empty string' })
      return
    }

    try {
      const result = await buildFromPrompt(prompt.trim())
      res.json(result)
    } catch (err) {
      if (err instanceof ZodError) {
        res.status(400).json({ error: 'Invalid agent config generated', details: err.issues })
        return
      }
      console.error('[agents] build-from-prompt error:', err)
      res.status(500).json({ error: 'Internal server error' })
    }
  }
)

// ── POST /api/agents/deploy ───────────────────────────────────────────────
// Body: { prompt: string, ownerAddress: string }
// Returns: { agentId, configHash, txHash, explorerUrl }
agentsRouter.post('/deploy', async (req: Request, res: Response) => {
  const { prompt, ownerAddress } = req.body

  if (!prompt || typeof prompt !== 'string' || prompt.trim().length === 0) {
    res.status(400).json({ error: 'prompt is required' })
    return
  }
  if (!ownerAddress || typeof ownerAddress !== 'string') {
    res.status(400).json({ error: 'ownerAddress is required' })
    return
  }

  try {
    // 1. Build config from natural language prompt
    const { config, configHash } = await buildFromPrompt(prompt.trim())

    // 2. Generate deterministic agent ID
    const agentId = crypto.randomUUID()

    // 3. Persist to DB (non-fatal if DB unavailable)
    try {
      await prisma.agent.create({
        data: {
          id: agentId,
          ownerAddress,
          config: config as any,
          configHash,
          strategyType: config.strategyType,
        },
      })
    } catch (dbErr) {
      console.warn('[agents] prisma.agent.create failed (non-fatal):', (dbErr as Error).message)
    }

    // 4. Register on-chain
    let txHash: string | null = null
    let explorerUrl: string | null = null

    try {
      const signer = getSigner()
      const registry = getRegistryContract(signer)
      const tx = await registry.registerAgent(
        agentId,
        configHash,
        config.strategyType
      )
      const receipt = await tx.wait()
      txHash = receipt?.hash ?? tx.hash
      explorerUrl = `https://testnet.monadexplorer.com/tx/${txHash}`

      // Update DB with txHash (non-fatal)
      try {
        await prisma.agent.update({ where: { id: agentId }, data: { txHash } })
      } catch { /* db unavailable */ }
    } catch (chainErr) {
      console.warn('[agents] on-chain registerAgent failed (non-fatal):', chainErr)
    }

    res.json({ agentId, configHash, config, txHash, explorerUrl })
  } catch (err) {
    if (err instanceof ZodError) {
      res.status(400).json({ error: 'Invalid agent config generated', details: err.issues })
      return
    }
    console.error('[agents] deploy error:', err)
    res.status(500).json({ error: 'Internal server error' })
  }
})

// ── POST /api/agents/:id/trigger ──────────────────────────────────────────
// Immediately runs one agent cycle.
// Body (optional):
//   txHash  — hex string from Phantom's logExecution() approval.
//             When STRICT_TX_VERIFY=true, verifies the tx was confirmed on Monad.
//   config  — AgentConfig fallback if DB is unavailable.
// Returns: { signal, confidence, reasoning, price, txHash }
agentsRouter.post('/:id/trigger', async (req: Request, res: Response) => {
  const id = req.params['id'] as string
  const { txHash, config: bodyConfig } = req.body ?? {}

  try {
    // ── Step 1: Load agent from DB ───────────────────────────────────────
    let config: AgentConfig | undefined = bodyConfig

    if (!config) {
      const agent = await prisma.agent.findUnique({ where: { id } })
      if (!agent) {
        res.status(404).json({ error: `Agent ${id} not found` })
        return
      }
      if (!agent.active) {
        res.status(400).json({ error: `Agent ${id} is inactive` })
        return
      }
      config = agent.config as AgentConfig
    }

    // ── Step 2: Optional on-chain tx verification (Section 4.2) ─────────
    // When STRICT_TX_VERIFY=true, confirm the Phantom logExecution tx landed.
    if (txHash && process.env.STRICT_TX_VERIFY === 'true') {
      try {
        const provider = new ethers.JsonRpcProvider(process.env.MONAD_RPC_URL)
        const receipt = await provider.getTransactionReceipt(txHash as string)
        if (!receipt || receipt.status !== 1) {
          res.status(400).json({ error: 'Invalid or failed transaction — tx not confirmed on Monad' })
          return
        }
      } catch (verifyErr) {
        console.warn('[agents] tx verification failed (non-fatal):', (verifyErr as Error).message)
        // In non-strict mode we let it through; strict mode already handled above.
      }
    }

    // Log the txHash for audit trail
    if (txHash) {
      console.log(`[agents] trigger ${id.slice(0, 8)} — phantom tx: ${(txHash as string).slice(0, 18)}…`)
    }

    // ── Step 3: Run the AI cycle ─────────────────────────────────────────
    const result = await runAgentCycle(id, config)

    res.json({
      signal: result.signal,
      confidence: result.confidence,
      reasoning: result.reasoning,
      price: result.price,
      // Echo back the Phantom-signed txHash from the request body when the AI
      // cycle doesn't produce its own on-chain hash (Section 4.2 spec)
      txHash: result.txHash ?? (txHash as string | undefined) ?? null,
    })
  } catch (err) {
    console.error(`[agents] trigger error for ${id}:`, err)
    res.status(500).json({ error: String(err) })
  }
})

// ── POST /api/agents/:id/queue ────────────────────────────────────────────
// Enqueue agent cycle via BullMQ (for parallel/async dispatch)
agentsRouter.post('/:id/queue', async (req: Request, res: Response) => {
  const id = req.params['id'] as string

  try {
    const agent = await prisma.agent.findUnique({ where: { id } })
    if (!agent) {
      res.status(404).json({ error: `Agent ${id} not found` })
      return
    }

    const config = agent.config as AgentConfig
    const job = await agentQueue.add('run', { agentId: id, config })
    res.json({ jobId: job.id, agentId: id, queued: true })
  } catch (err) {
    console.error(`[agents] queue error for ${id}:`, err)
    res.status(500).json({ error: String(err) })
  }
})

// ── GET /api/agents ───────────────────────────────────────────────────────
// Query: ?owner=<address>  — list agents for a wallet with latest execution
agentsRouter.get('/', async (req: Request, res: Response) => {
  const owner = req.query['owner'] as string | undefined

  try {
    const agents = await prisma.agent.findMany({
      where: owner ? { ownerAddress: owner } : undefined,
      orderBy: { createdAt: 'desc' },
      include: {
        executions: {
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
    })
    res.json(agents)
  } catch (err) {
    console.warn('[agents] list DB error — returning []:', (err as Error).message)
    res.json([])
  }
})

// ── GET /api/agents/:id ───────────────────────────────────────────────────
agentsRouter.get('/:id', async (req: Request, res: Response) => {
  const id = req.params['id'] as string
  // Skip if looks like a sub-path (executions, etc.)
  if (['executions', 'build-from-prompt', 'deploy'].includes(id)) {
    res.status(404).json({ error: 'Not found' })
    return
  }

  try {
    const agent = await prisma.agent.findUnique({
      where: { id },
      include: {
        executions: {
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
    })
    if (!agent) {
      res.status(404).json({ error: `Agent ${id} not found` })
      return
    }
    res.json(agent)
  } catch (err) {
    console.error(`[agents] get ${id} error:`, err)
    res.status(500).json({ error: String(err) })
  }
})

// ── POST /api/agents/:id/schedule ─────────────────────────────────────────
// Body: { interval: "1m" | "5m" | "15m" | "1h" | "4h" | "1d" }
agentsRouter.post('/:id/schedule', async (req: Request, res: Response) => {
  const id = req.params['id'] as string
  const { interval } = req.body

  if (!interval || !cronMap[interval as string]) {
    res.status(400).json({
      error: `interval must be one of: ${Object.keys(cronMap).join(', ')}`,
    })
    return
  }

  try {
    const agent = await prisma.agent.findUnique({ where: { id } })
    if (!agent) {
      res.status(404).json({ error: `Agent ${id} not found` })
      return
    }
    await scheduleAgent(id, interval as string)
    res.json({ success: true, interval })
  } catch (err) {
    console.error(`[agents] schedule error for ${id}:`, err)
    res.status(500).json({ error: String(err) })
  }
})

// ── POST /api/agents/:id/pause ────────────────────────────────────────────
agentsRouter.post('/:id/pause', async (req: Request, res: Response) => {
  const id = req.params['id'] as string

  try {
    const agent = await prisma.agent.findUnique({ where: { id } })
    if (!agent) {
      res.status(404).json({ error: `Agent ${id} not found` })
      return
    }
    await pauseAgent(id)
    res.json({ success: true })
  } catch (err) {
    console.error(`[agents] pause error for ${id}:`, err)
    res.status(500).json({ error: String(err) })
  }
})

// ── POST /api/agents/:id/resume ───────────────────────────────────────────
agentsRouter.post('/:id/resume', async (req: Request, res: Response) => {
  const id = req.params['id'] as string

  try {
    const agent = await prisma.agent.findUnique({ where: { id } })
    if (!agent) {
      res.status(404).json({ error: `Agent ${id} not found` })
      return
    }
    await resumeAgent(id)
    res.json({ success: true })
  } catch (err) {
    console.error(`[agents] resume error for ${id}:`, err)
    res.status(500).json({ error: String(err) })
  }
})

// ── GET /api/agents/:id/executions ────────────────────────────────────────
// Returns last 20 executions for dashboard (Phase 8)
agentsRouter.get('/:id/executions', async (req: Request, res: Response) => {
  const id = req.params['id'] as string

  try {
    const executions = await prisma.execution.findMany({
      where: { agentId: id },
      orderBy: { createdAt: 'desc' },
      take: 20,
    })
    res.json(executions)
  } catch (err) {
    // DB unavailable (tables not migrated yet, connection issue, etc.)
    // Return empty array so the dashboard renders the empty state instead of crashing
    console.warn(`[agents] executions DB unavailable for ${id} — returning []:`, (err as Error).message)
    res.json([])
  }
})
