export const MOCK_USDT_ABI = [
  {
    name: 'faucet',
    type: 'function',
    inputs: [
      { name: 'to', type: 'address' },
      { name: 'amount', type: 'uint256' },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    name: 'balanceOf',
    type: 'function',
    inputs: [{ name: 'account', type: 'address' }],
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
  },
] as const

export const AGENT_REGISTRY_ABI = [
  {
    name: 'registerAgent',
    type: 'function',
    inputs: [
      { name: 'agentId', type: 'string' },
      { name: 'configHash', type: 'bytes32' },
      { name: 'strategyType', type: 'string' },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    name: 'logExecution',
    type: 'function',
    inputs: [
      { name: 'agentId', type: 'string' },
      { name: 'signal', type: 'string' },
      { name: 'price', type: 'uint256' },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
] as const
