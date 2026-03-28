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
  const tag = `[agentRunner:${agentId.slice(0, 8)}]`
  console.log(`${tag} ── cycle start ──────────────────────────────────────`)

  // ── Step 1: Fetch live Pyth price ────────────────────────────────────────
  console.log(`${tag} Step 1: fetching Pyth price for ${config.asset}…`)
  const feedId = getFeedId(config.asset)
  const prices = await fetchPrices([feedId])
  const priceData = prices[0]

  if (!isFresh(priceData.timestamp)) {
    throw new Error(`Stale price for ${config.asset}: ${priceData.timestamp}`)
  }

  const price = priceData.price
  console.log(`${tag} Step 1: price = $${price.toFixed(4)}`)

  // ── Step 2: Fetch OHLCV + calculate indicators ───────────────────────────
  console.log(`${tag} Step 2: building OHLCV + indicators…`)
  const candles = fetchOHLCV(config.asset, config.timeframe, 60, price)
  const indicators = calculateIndicators(candles, config)
  console.log(`${tag} Step 2: indicators ready (${candles.length} candles)`)

  // ── Step 3: Gemini decision ──────────────────────────────────────────────
  const model = process.env.GEMINI_MODEL || 'gemini-2.5-pro'
  console.log(`${tag} Step 3: calling Gemini (${model})…`)
  const decisionPrompt = buildDecisionPrompt(config, price, indicators)

  const geminiModel = genAI.getGenerativeModel({
    model,
    generationConfig: {
      responseMimeType: 'application/json',
      temperature: 0.1,
    } as any,
  })

  const geminiResult = await geminiModel.generateContent(decisionPrompt)
  const rawText = geminiResult.response.text().replace(/```json|```/g, '').trim()
  const decision = JSON.parse(rawText) as {
    signal: 'BUY' | 'SELL' | 'HOLD'
    confidence: number
    reasoning: string
  }

  const { signal, confidence, reasoning } = decision
  console.log(`${tag} Step 3: Gemini → signal=${signal} confidence=${confidence}% reasoning="${reasoning.slice(0, 80)}…"`)

  // ── Step 4: Execute trade if confident enough ────────────────────────────
  let txHash: string | null = null

  if (signal !== 'HOLD' && confidence > 55) {
    console.log(`${tag} Step 4: executing ${signal} trade on MockDEX…`)
    try {
      const signer = getSigner()
      const dex = getDexContract(signer)

      let tx: ethers.TransactionResponse
      if (signal === 'SELL') {
        tx = await dex.sellMON(agentId, 0n, { value: TRADE_MON })
      } else {
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
      console.log(`${tag} Step 4: trade confirmed — txHash=${txHash}`)
    } catch (err) {
      console.warn(`${tag} Step 4: trade failed (non-fatal):`, (err as Error).message)
    }
  } else {
    console.log(`${tag} Step 4: no trade — signal=${signal}, confidence=${confidence}% (threshold: >55% and not HOLD)`)
  }

  // ── Step 5: Log execution on-chain (5 s timeout so we never block) ───────
  // The Monad testnet RPC can be slow; cap at 5 s so Run Now responds fast.
  let logTxHash = txHash
  console.log(`${tag} Step 5: logging on-chain (5 s timeout)…`)
  try {
    const signer = getSigner()
    const registry = getRegistryContract(signer)
    const priceInt = BigInt(Math.round(price * 1e8))
    const logTx = await Promise.race([
      registry.logExecution(agentId, signal, priceInt),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('logExecution RPC timeout (5 s)')), 5_000)
      ),
    ])
    const logReceipt = await logTx.wait()
    logTxHash = logReceipt?.hash ?? logTx.hash
    if (!txHash) txHash = logTxHash
    console.log(`${tag} Step 5: on-chain log confirmed — txHash=${logTxHash}`)
  } catch (err) {
    console.warn(`${tag} Step 5: on-chain log skipped (non-fatal): ${(err as Error).message}`)
  }

  // ── Step 6: Persist to Prisma DB ─────────────────────────────────────────
  console.log(`${tag} Step 6: persisting execution to DB…`)
  try {
    const saved = await prisma.execution.create({
      data: {
        agentId,
        signal,
        price,
        confidence,
        reasoning,
        txHash: logTxHash,
      },
    })
    console.log(`${tag} Step 6: saved execution id=${saved.id} signal=${signal} price=$${price.toFixed(4)}`)
  } catch (err) {
    console.warn(`${tag} Step 6: prisma.execution.create failed (non-fatal):`, (err as Error).message)
  }

  console.log(`${tag} ── cycle done: ${signal} ${confidence}% ───────────────`)
  return { agentId, signal, confidence, reasoning, price, txHash }
}
