import { GoogleGenerativeAI } from '@google/generative-ai'
import { z } from 'zod'
import { ethers } from 'ethers'

// ── Zod schema — source of truth for AI output AND on-chain configHash ──────

export const AgentConfigSchema = z.object({
  name: z.string().min(3).max(80),
  strategyType: z.enum([
    'TREND_FOLLOW',
    'MEAN_REVERT',
    'MOMENTUM',
    'BREAKOUT',
  ]),
  asset: z.string().default('MON/USDT'),
  timeframe: z.enum(['1m', '5m', '15m', '1h', '4h', '1d']),
  indicators: z.object({
    ema: z
      .object({
        fast: z.number().int().min(5).max(50).default(20),
        slow: z.number().int().min(20).max(200).default(60),
      })
      .optional(),
    rsi: z
      .object({
        period: z.number().int().default(14),
        oversold: z.number().default(30),
        overbought: z.number().default(70),
      })
      .optional(),
  }),
  risk: z.object({
    maxPositionPct: z.number().min(1).max(20).default(5),
    stopLossPct: z.number().min(0.5).max(10).default(3),
    takeProfitPct: z.number().min(1).max(50).default(8),
  }),
})

export type AgentConfig = z.infer<typeof AgentConfigSchema>

// ── Gemini 2.5 Flash builder ──────────────────────────────────────────────────

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!)

const SYSTEM_PROMPT = `You are a quant trading config expert.
Convert user strategy to JSON matching this exact schema:
{ name, strategyType: TREND_FOLLOW|MEAN_REVERT|MOMENTUM|BREAKOUT,
  asset: MON/USDT|ETH/USDT|BTC/USDT, timeframe: 1m|5m|15m|1h|4h|1d,
  indicators: { ema?: {fast,slow}, rsi?: {period,oversold,overbought} },
  risk: { maxPositionPct:1-20, stopLossPct:0.5-10, takeProfitPct:1-50 } }
Rules: conservative risk only. Return ONLY valid JSON, no markdown.`

export async function buildFromPrompt(
  prompt: string
): Promise<{ config: AgentConfig; configHash: string }> {
  const model = genAI.getGenerativeModel({
    model: process.env.GEMINI_MODEL || 'gemini-2.5-pro',
    // thinkingConfig is supported by the API but not yet typed in SDK v0.24.1
    generationConfig: {
      responseMimeType: 'application/json',
      temperature: 0.1,
      thinkingConfig: { thinkingBudget: 1024 },
    } as any,
  })

  const result = await model.generateContent(
    `${SYSTEM_PROMPT}\nUser strategy: ${prompt}`
  )

  const raw = result.response.text()

  // Strip any accidental markdown fences before parsing
  const cleaned = raw.replace(/```json|```/g, '').trim()

  const config = AgentConfigSchema.parse(JSON.parse(cleaned))

  // keccak256 of deterministic JSON string — matches on-chain configHash
  const configHash = ethers.keccak256(
    ethers.toUtf8Bytes(JSON.stringify(config))
  )

  return { config, configHash }
}
