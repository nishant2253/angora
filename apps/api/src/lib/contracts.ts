import { ethers } from 'ethers'
import { execSync } from 'child_process'

// ── Minimal ABIs (only the functions we call) ──────────────────────────────

const REGISTRY_ABI = [
  'function registerAgent(string agentId, bytes32 configHash, string strategyType) external',
  'function logExecution(string agentId, string signal, uint256 price) external',
  'event AgentExecuted(string indexed agentId, string signal, uint256 price, uint256 ts)',
]

const DEX_ABI = [
  'function sellMON(string agentId, uint256 minOut) external payable',
  'function buyMON(string agentId, uint256 usdtAmount, uint256 minMonOut) external',
]

// ── Private key from Foundry encrypted keystore ────────────────────────────

function getPrivateKey(): string {
  try {
    const keystoreDir = `${process.env.HOME}/.monskills/keystore`
    const filename = execSync(`ls ${keystoreDir} | head -1`, {
      encoding: 'utf8',
    }).trim()
    const output = execSync(
      `cast wallet decrypt-keystore --keystore-dir ${keystoreDir} ${filename} --unsafe-password ''`,
      { encoding: 'utf8' }
    ).trim()
    const match = output.match(/(0x[0-9a-fA-F]{64})/)
    return match ? match[1] : process.env.PRIVATE_KEY || ''
  } catch {
    return process.env.PRIVATE_KEY || ''
  }
}

// ── Provider + Signer ──────────────────────────────────────────────────────

export function getSigner(): ethers.Wallet {
  const provider = new ethers.JsonRpcProvider(
    process.env.MONAD_RPC_URL || 'https://testnet-rpc.monad.xyz'
  )
  const privateKey = getPrivateKey()
  if (!privateKey) throw new Error('No private key available')
  return new ethers.Wallet(privateKey, provider)
}

export function getRegistryContract(signer?: ethers.Wallet): ethers.Contract {
  const address = process.env.AGENT_REGISTRY_ADDRESS
  if (!address) throw new Error('AGENT_REGISTRY_ADDRESS not set')
  return new ethers.Contract(address, REGISTRY_ABI, signer ?? getSigner())
}

export function getDexContract(signer?: ethers.Wallet): ethers.Contract {
  const address = process.env.MOCK_DEX_ADDRESS
  if (!address) throw new Error('MOCK_DEX_ADDRESS not set')
  return new ethers.Contract(address, DEX_ABI, signer ?? getSigner())
}
