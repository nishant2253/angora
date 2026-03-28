import { ethers, network } from 'hardhat'
import { expect } from 'chai'
import * as dotenv from 'dotenv'
import path from 'path'

dotenv.config({ path: path.resolve(__dirname, '../../../../apps/api/.env') })

describe('Full agent flow on Monad fork', () => {
  let registry: any
  let dex: any
  let usdt: any
  let trader: any

  before(async function () {
    // Fork resets can be slow — give it up to 60s
    this.timeout(60_000)

    await network.provider.request({
      method: 'hardhat_reset',
      params: [
        {
          forking: {
            jsonRpcUrl:
              process.env.MONAD_RPC_URL || 'https://testnet-rpc.monad.xyz',
          },
        },
      ],
    })

    ;[trader] = await ethers.getSigners()

    // Deploy fresh contract instances on top of the fork
    const MockUSDT = await ethers.getContractFactory('MockUSDT')
    usdt = await MockUSDT.deploy()
    await usdt.waitForDeployment()

    const MockDEX = await ethers.getContractFactory('MockDEX')
    dex = await MockDEX.deploy(await usdt.getAddress())
    await dex.waitForDeployment()

    const AgentRegistry = await ethers.getContractFactory('AgentRegistry')
    registry = await AgentRegistry.deploy()
    await registry.waitForDeployment()

    // Seed DEX: transfer 500k mUSDT and fund with 1000 MON worth of ETH
    await usdt.transfer(
      await dex.getAddress(),
      ethers.parseUnits('500000', 6)
    )
    await dex.fundMON({ value: ethers.parseEther('1000') })
  })

  // ── Test 1: Agent registration ───────────────────────────────────────────

  it('registers agent on-chain and sets active = true', async () => {
    const configHash = ethers.keccak256(ethers.toUtf8Bytes('cfg1'))
    await registry
      .connect(trader)
      .registerAgent('agent-test-1', configHash, 'TREND_FOLLOW')

    const agent = await registry.agents('agent-test-1')
    expect(agent.agentId).to.equal('agent-test-1')
    expect(agent.active).to.be.true
    expect(agent.owner).to.equal(trader.address)
    expect(agent.strategyType).to.equal('TREND_FOLLOW')
  })

  // ── Test 2: Duplicate registration reverts ────────────────────────────────

  it('reverts with AlreadyRegistered on duplicate agentId', async () => {
    const configHash = ethers.keccak256(ethers.toUtf8Bytes('cfg1'))
    await expect(
      registry
        .connect(trader)
        .registerAgent('agent-test-1', configHash, 'TREND_FOLLOW')
    ).to.be.revertedWithCustomError(registry, 'AlreadyRegistered')
  })

  // ── Test 3: sellMON emits Swap event ─────────────────────────────────────

  it('executes sellMON and emits Swap event with correct fields', async () => {
    const oneEther = ethers.parseEther('1')

    await expect(
      dex
        .connect(trader)
        .sellMON('agent-test-1', 0, { value: oneEther })
    )
      .to.emit(dex, 'Swap')
      .withArgs(
        'agent-test-1',
        trader.address,
        'SELL_MON',
        oneEther,
        ethers.parseUnits('20', 6) // 1 MON × $20 = 20 mUSDT
      )
  })

  // ── Test 4: logExecution emits AgentExecuted event ────────────────────────

  it('logExecution emits AgentExecuted event with signal and price', async () => {
    const price = BigInt(Math.floor(20 * 1e8)) // $20.00 scaled to 1e8

    await expect(
      registry.connect(trader).logExecution('agent-test-1', 'BUY', price)
    )
      .to.emit(registry, 'AgentExecuted')
      .withArgs('agent-test-1', 'BUY', price, (ts: bigint) => ts > 0n)
  })
})
