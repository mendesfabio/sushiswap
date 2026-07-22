import { type EvmAddress, EvmChainId } from 'sushi/evm'

export const LAUNCH_START_PROJECT_WEIGHT = 90
export const LAUNCH_END_PROJECT_WEIGHT = 50
export const LAUNCH_SWAP_FEE_PERCENT = 2
export const LAUNCH_IMMEDIATE_START_DELAY_MS = 5 * 60 * 1000
export const LAUNCH_MIN_START_DELAY_MS = 2 * 60 * 60 * 1000
export const LAUNCH_MIN_DURATION_MS = 24 * 60 * 60 * 1000

export interface LaunchTokenConfig {
  address: EvmAddress
  decimals: number
  symbol: string
}

export interface LaunchChainConfig {
  apiChain: string
  chainId: BalancerLaunchChainId
  reserveToken: LaunchTokenConfig
}

export type BalancerLaunchChainId =
  | typeof EvmChainId.ETHEREUM
  | typeof EvmChainId.ARBITRUM
  | typeof EvmChainId.BASE
  | typeof EvmChainId.GNOSIS
  | typeof EvmChainId.AVALANCHE
  | typeof EvmChainId.OPTIMISM
  | typeof EvmChainId.SONIC
  | typeof EvmChainId.HYPEREVM
  | typeof EvmChainId.SEPOLIA

export const LAUNCH_CHAIN_CONFIGS = {
  [EvmChainId.ETHEREUM]: {
    apiChain: 'MAINNET',
    chainId: EvmChainId.ETHEREUM,
    reserveToken: {
      address: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
      decimals: 6,
      symbol: 'USDC',
    },
  },
  [EvmChainId.ARBITRUM]: {
    apiChain: 'ARBITRUM',
    chainId: EvmChainId.ARBITRUM,
    reserveToken: {
      address: '0xaf88d065e77c8cc2239327c5edb3a432268e5831',
      decimals: 6,
      symbol: 'USDC',
    },
  },
  [EvmChainId.BASE]: {
    apiChain: 'BASE',
    chainId: EvmChainId.BASE,
    reserveToken: {
      address: '0x833589fCD6EDb6E08f4c7C32D4f71b54bdA02913',
      decimals: 6,
      symbol: 'USDC',
    },
  },
  [EvmChainId.GNOSIS]: {
    apiChain: 'GNOSIS',
    chainId: EvmChainId.GNOSIS,
    reserveToken: {
      address: '0xDDAfbb505ad214D7b80b1f830fCcC89B60fb7A83',
      decimals: 6,
      symbol: 'USDC',
    },
  },
  [EvmChainId.AVALANCHE]: {
    apiChain: 'AVALANCHE',
    chainId: EvmChainId.AVALANCHE,
    reserveToken: {
      address: '0xB97EF9Ef8734C71904D8002F8b6Bc66Dd9c48a6E',
      decimals: 6,
      symbol: 'USDC',
    },
  },
  [EvmChainId.OPTIMISM]: {
    apiChain: 'OPTIMISM',
    chainId: EvmChainId.OPTIMISM,
    reserveToken: {
      address: '0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85',
      decimals: 6,
      symbol: 'USDC',
    },
  },
  [EvmChainId.SONIC]: {
    apiChain: 'SONIC',
    chainId: EvmChainId.SONIC,
    reserveToken: {
      address: '0x000000000eCcFF26B795f73fB0a70d48da657fEf',
      decimals: 18,
      symbol: 'USSD',
    },
  },
  [EvmChainId.HYPEREVM]: {
    apiChain: 'HYPEREVM',
    chainId: EvmChainId.HYPEREVM,
    reserveToken: {
      address: '0xB8CE59FC3717ada4C02eaDF9682A9e934F625ebb',
      decimals: 6,
      symbol: 'USD₮0',
    },
  },
  [EvmChainId.SEPOLIA]: {
    apiChain: 'SEPOLIA',
    chainId: EvmChainId.SEPOLIA,
    reserveToken: {
      address: '0x80D6d3946eD8A1Da4E226aa21ccDDc32bd127D1A',
      decimals: 6,
      symbol: 'USDC',
    },
  },
} as const satisfies Partial<Record<EvmChainId, LaunchChainConfig>>

export const LAUNCH_SUPPORTED_CHAIN_IDS = Object.values(
  LAUNCH_CHAIN_CONFIGS,
).map(({ chainId }) => chainId)

export function getLaunchChainConfig(
  chainId: number,
): LaunchChainConfig | undefined {
  return LAUNCH_CHAIN_CONFIGS[chainId as keyof typeof LAUNCH_CHAIN_CONFIGS]
}

export function isLaunchSupportedChainId(
  chainId: number,
): chainId is keyof typeof LAUNCH_CHAIN_CONFIGS {
  return Boolean(getLaunchChainConfig(chainId))
}
