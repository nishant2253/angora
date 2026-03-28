import { agentQueue } from './worker'
import { prisma } from '../lib/prisma'
import { cronMap, getNextCronDate } from './cronUtils'

export { cronMap, getNextCronDate }

/**
 * Schedule (or reschedule) a BullMQ repeatable job for an agent.
 * Removes any existing repeatable job for this agent, then adds a new one.
 */
export async function scheduleAgent(agentId: string, interval: string): Promise<void> {
  const cron = cronMap[interval]
  if (!cron) throw new Error(`Unknown interval: ${interval}. Valid: ${Object.keys(cronMap).join(', ')}`)

  // Remove existing repeatable jobs for this agent
  const repeatableJobs = await agentQueue.getRepeatableJobs()
  for (const job of repeatableJobs) {
    if (job.key.includes(agentId)) {
      await agentQueue.removeRepeatableByKey(job.key)
    }
  }

  // Fetch agent config to embed in the job
  const agent = await prisma.agent.findUnique({ where: { id: agentId } })
  if (!agent) throw new Error(`Agent ${agentId} not found`)

  // Add new repeatable job
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await agentQueue.add(
    'agent-cycle',
    { agentId, config: agent.config as any },
    { repeat: { pattern: cron }, jobId: `repeat:${agentId}` }
  )

  // Persist interval + next run time
  const nextRunAt = getNextCronDate(cron)
  await prisma.agent.update({
    where: { id: agentId },
    data: { cronInterval: interval, nextRunAt },
  })

  console.log(`[scheduler] agent ${agentId} scheduled @ ${interval} (next: ${nextRunAt.toISOString()})`)
}

/**
 * Remove all repeatable jobs for an agent and mark it inactive.
 */
export async function pauseAgent(agentId: string): Promise<void> {
  const repeatableJobs = await agentQueue.getRepeatableJobs()
  for (const job of repeatableJobs) {
    if (job.key.includes(agentId)) {
      await agentQueue.removeRepeatableByKey(job.key)
    }
  }
  await prisma.agent.update({
    where: { id: agentId },
    data: { active: false, nextRunAt: null },
  })
  console.log(`[scheduler] agent ${agentId} paused`)
}

/**
 * Re-schedule a paused agent using its stored cronInterval and mark it active.
 */
export async function resumeAgent(agentId: string): Promise<void> {
  const agent = await prisma.agent.findUnique({ where: { id: agentId } })
  if (!agent) throw new Error(`Agent ${agentId} not found`)

  await prisma.agent.update({ where: { id: agentId }, data: { active: true } })
  await scheduleAgent(agentId, agent.cronInterval)
  console.log(`[scheduler] agent ${agentId} resumed`)
}
