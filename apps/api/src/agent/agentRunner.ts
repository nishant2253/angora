import 'dotenv/config'
import { GoogleGenerativeAI } from '@google/generative-ai'
import { ethers } from 'ethers'
import { fetchPrices, getFeedId, isFresh } from '../oracle/pyth'
import { fetchOHLCV, calculateIndicators, buildDecisionPrompt } from './indicators'
import { getSigner, getRegistryContract, getDexContract } from '../lib/contracts'
import { prisma } from '../lib/prisma'
import type { AgentConfig } from './promptBuilder'

export interface CycleResult {
  agentId: string
  signal: 'BUY' | 'SELL' | 'HOLD'
  confidence: number
  reasoning: string
  price: number
  txHash: string | null
}

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!)

// Trade size: 0.01 MON or 0.2 USDT (small testnet amounts)
const TRADE_MON = ethers.parseEther('0.01')
const TRADE_USDT = ethers.parseUnits('0.2', 18)

export async function runAgentCycle(
  agentId: string,
  config: AgentConfig
): Promise<CycleResult> {
  // ── Step 1: Fetch live Pyth price ────────────────────────────────────────
  const feedId = getFeedId(config.asset)
  const prices = await fetchPrices([feedId])
  const priceData = prices[0]

  if (!isFresh(priceData.timestamp)) {
    throw new Error(`Stale price for ${config.asset}: ${priceData.timestamp}`)
  }

  const price = priceData.price

  // ── Step 2: Fetch OHLCV + calculate indicators ───────────────────────────
  const candles = fetchOHLCV(config.asset, config.timeframe, 60, price)
  const indicators = calculateIndicators(candles, config)

  // ── Step 3: Gemini decision ──────────────────────────────────────────────
  const decisionPrompt = buildDecisionPrompt(config, price, indicators)

  const model = genAI.getGenerativeModel({
    model: process.env.GEMINI_MODEL || 'gemini-2.5-flash',
    generationConfig: {
      responseMimeType: 'application/json',
      temperature: 0.1,
    } as any,
  })

  const geminiResult = await model.generateContent(decisionPrompt)
  const rawText = geminiResult.response.text().replace(/```json|```/g, '').trim()
  const decision = JSON.parse(rawText) as {
    signal: 'BUY' | 'SELL' | 'HOLD'
    confidence: number
    reasoning: string
  }

  const { signal, confidence, reasoning } = decision

  // ── Step 4: Execute trade if confident enough ────────────────────────────
  let txHash: string | null = null

  if (signal !== 'HOLD' && confidence > 55) {
    try {
      const signer = getSigner()
      const dex = getDexContract(signer)

      let tx: ethers.TransactionResponse
      if (signal === 'SELL') {
        // Send MON, receive mUSDT
        tx = await dex.sellMON(agentId, 0n, { value: TRADE_MON })
      } else {
        // BUY: send mUSDT, receive MON
        // First approve mUSDT spend (MockUSDT.approve)
        const usdtAbi = [
          'function approve(address spender, uint256 amount) returns (bool)',
        ]
        const usdt = new ethers.Contract(
          process.env.MOCK_USDT_ADDRESS!,
          usdtAbi,
          signer
        )
        const approveTx = await usdt.approve(
          process.env.MOCK_DEX_ADDRESS!,
          TRADE_USDT
        )
        await approveTx.wait()
        tx = await dex.buyMON(agentId, TRADE_USDT, 0n)
      }
      const receipt = await tx.wait()
      txHash = receipt?.hash ?? tx.hash
    } catch (err) {
      console.warn(`[agentRunner] trade failed (non-fatal):`, err)
    }
  }

  // ── Step 5: Log execution on-chain ───────────────────────────────────────
  let logTxHash = txHash
  try {
    const signer = getSigner()
    const registry = getRegistryContract(signer)
    // price * 1e8 to match Pyth's 8-decimal integer representation
    const priceInt = BigInt(Math.round(price * 1e8))
    const logTx = await registry.logExecution(agentId, signal, priceInt)
    const logReceipt = await logTx.wait()
    logTxHash = logReceipt?.hash ?? logTx.hash
    if (!txHash) txHash = logTxHash
  } catch (err) {
    console.warn(`[agentRunner] logExecution failed (non-fatal):`, err)
  }

  // ── Step 6: Persist to Prisma DB ─────────────────────────────────────────
  try {
    await prisma.execution.create({
      data: {
        agentId,
        signal,
        price,
        confidence,
        reasoning,
        txHash: logTxHash,
      },
    })
  } catch (err) {
    console.warn(`[agentRunner] prisma.execution.create failed (non-fatal):`, err)
  }

  return { agentId, signal, confidence, reasoning, price, txHash }
}
