import { redirect } from 'next/navigation'
import { use } from 'react'

export default function AgentAliasPage({
  params,
}: {
  params: Promise<{ agentId: string }>
}) {
  const { agentId } = use(params)
  redirect(`/dashboard/${agentId}`)
}
