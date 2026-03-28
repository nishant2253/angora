import { HardhatUserConfig } from 'hardhat/config'
import '@nomicfoundation/hardhat-toolbox'
import { execSync } from 'child_process'
import * as dotenv from 'dotenv'

dotenv.config({ path: '../../apps/api/.env' })

function getKey(): string {
  try {
    const keystoreDir = `${process.env.HOME}/.monskills/keystore`
    const filename = execSync(`ls ${keystoreDir} | head -1`, {
      encoding: 'utf8',
    }).trim()
    const output = execSync(
      `cast wallet decrypt-keystore --keystore-dir ${keystoreDir} ${filename} --unsafe-password ''`,
      { encoding: 'utf8' }
    ).trim()
    // Output format: "<filename>'s private key is: 0x..."
    const match = output.match(/(0x[0-9a-fA-F]{64})/)
    return match ? match[1] : ''
  } catch {
    return process.env.PRIVATE_KEY || ''
  }
}

const config: HardhatUserConfig = {
  solidity: {
    version: '0.8.28',
    settings: {
      optimizer: { enabled: true, runs: 200 },
      viaIR: true,
    },
  },
  paths: {
    sources: './contracts',
    tests: './test',
    cache: './cache',
    artifacts: './artifacts',
  },
  networks: {
    hardhat: {
      forking: {
        url: process.env.MONAD_RPC_URL || 'https://testnet-rpc.monad.xyz',
      },
    },
    monadTestnet: {
      url: process.env.MONAD_RPC_URL || 'https://testnet-rpc.monad.xyz',
      accounts: [getKey()].filter(Boolean),
      chainId: 10143,
    },
  },
}

export default config
