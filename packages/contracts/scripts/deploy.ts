import { ethers } from 'hardhat'
import * as fs from 'fs'
import * as path from 'path'

async function main() {
  const [deployer] = await ethers.getSigners()
  console.log('\n🚀 Deploying Angora contracts to Monad Testnet')
  console.log('   Deployer:', deployer.address)

  const balance = await ethers.provider.getBalance(deployer.address)
  console.log('   Balance: ', ethers.formatEther(balance), 'MON\n')

  // ── 1. Deploy MockUSDT ───────────────────────────────────────────────────
  console.log('1/3  Deploying MockUSDT...')
  const MockUSDT = await ethers.getContractFactory('MockUSDT')
  const mockUSDT = await MockUSDT.deploy()
  await mockUSDT.waitForDeployment()
  const usdtAddress = await mockUSDT.getAddress()
  console.log('     MockUSDT deployed:', usdtAddress)

  // ── 2. Deploy MockDEX ────────────────────────────────────────────────────
  console.log('2/3  Deploying MockDEX...')
  const MockDEX = await ethers.getContractFactory('MockDEX')
  const mockDEX = await MockDEX.deploy(usdtAddress)
  await mockDEX.waitForDeployment()
  const dexAddress = await mockDEX.getAddress()
  console.log('     MockDEX deployed:', dexAddress)

  // Seed MockDEX with 500,000 mUSDT liquidity
  console.log('     Seeding MockDEX with 500,000 mUSDT...')
  const seedTx = await mockUSDT.transfer(
    dexAddress,
    ethers.parseUnits('500000', 6)
  )
  await seedTx.wait()

  // Seed MockDEX with 0.3 MON liquidity
  console.log('     Seeding MockDEX with 0.3 MON...')
  const fundTx = await mockDEX.fundMON({ value: ethers.parseEther('0.3') })
  await fundTx.wait()

  // ── 3. Deploy AgentRegistry ──────────────────────────────────────────────
  console.log('3/3  Deploying AgentRegistry...')
  const AgentRegistry = await ethers.getContractFactory('AgentRegistry')
  const agentRegistry = await AgentRegistry.deploy()
  await agentRegistry.waitForDeployment()
  const registryAddress = await agentRegistry.getAddress()
  console.log('     AgentRegistry deployed:', registryAddress)

  // ── Summary ──────────────────────────────────────────────────────────────
  console.log('\n✅ All contracts deployed!\n')
  console.log('   MOCK_USDT_ADDRESS     =', usdtAddress)
  console.log('   MOCK_DEX_ADDRESS      =', dexAddress)
  console.log('   AGENT_REGISTRY_ADDRESS=', registryAddress)

  // ── Write addresses to a JSON file ────────────────────────────────────────
  const deployments = {
    network: 'monadTestnet',
    chainId: 10143,
    deployedAt: new Date().toISOString(),
    deployer: deployer.address,
    contracts: {
      MOCK_USDT_ADDRESS: usdtAddress,
      MOCK_DEX_ADDRESS: dexAddress,
      AGENT_REGISTRY_ADDRESS: registryAddress,
    },
  }

  const outPath = path.join(__dirname, '..', 'deployments.json')
  fs.writeFileSync(outPath, JSON.stringify(deployments, null, 2))
  console.log('\n   Addresses saved to packages/contracts/deployments.json')

  // ── Explorer links ────────────────────────────────────────────────────────
  const base = 'https://testnet.monadexplorer.com/address'
  console.log('\n🔍 Explorer links:')
  console.log(`   MockUSDT:      ${base}/${usdtAddress}`)
  console.log(`   MockDEX:       ${base}/${dexAddress}`)
  console.log(`   AgentRegistry: ${base}/${registryAddress}`)
}

main().catch((err) => {
  console.error(err)
  process.exitCode = 1
})
