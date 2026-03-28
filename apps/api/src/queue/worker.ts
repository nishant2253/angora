import 'dotenv/config'
import { Queue, Worker } from 'bullmq'
import IORedis from 'ioredis'
import { runAgentCycle } from '../agent/agentRunner'
import type { AgentConfig } from '../agent/promptBuilder'
import { prisma } from '../lib/prisma'
import { cronMap, getNextCronDate } from './cronUtils'

export interface AgentJobData {
  agentId: string
  config: AgentConfig
}

const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379'

// Shared connection used by both Queue and Worker (BullMQ requirement)
export const conn = new IORedis(REDIS_URL, {
  maxRetriesPerRequest: null, // required by BullMQ
  retryStrategy: (times) => {
    // Cap retry delay at 10s; suppress log spam after first attempt
    if (times === 1) console.warn('[worker] Redis not available — retrying in background…')
    return Math.min(times * 1000, 10_000)
  },
})

export const agentQueue = new Queue<AgentJobData>('agents', {
  connection: conn,
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: 'exponential', delay: 2000 },
    removeOnComplete: 100,
    removeOnFail: 200,
  },
})

export const agentWorker = new Worker<AgentJobData>(
  'agents',
  async (job) => {
    const { agentId, config } = job.data
    console.log(`[worker] processing job ${job.id} for agent ${agentId}`)
    const result = await runAgentCycle(agentId, config)
    console.log(
      `[worker] job ${job.id} done: ${result.signal} confidence=${result.confidence}`
    )
    return result
  },
  {
    connection: conn,
    concurrency: 10,
  }
)

agentWorker.on('completed', async (job) => {
  const { agentId } = job.data as AgentJobData
  try {
    const agent = await prisma.agent.findUnique({ where: { id: agentId } })
    if (agent?.cronInterval && cronMap[agent.cronInterval]) {
      const next = getNextCronDate(cronMap[agent.cronInterval])
      await prisma.agent.update({
        where: { id: agentId },
        data: { nextRunAt: next, lastRunAt: new Date() },
      })
    }
  } catch (err) {
    console.warn('[worker] could not update nextRunAt:', (err as Error).message)
  }
})

agentWorker.on('failed', (job, err) => {
  console.error(`[worker] job ${job?.id} failed:`, err.message)
})

agentWorker.on('error', (err: NodeJS.ErrnoException) => {
  // Suppress repeated ECONNREFUSED noise — retryStrategy handles logging
  if (err.code !== 'ECONNREFUSED') {
    console.error('[worker] error:', err.message)
  }
})
