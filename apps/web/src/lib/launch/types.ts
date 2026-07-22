import type { EvmAddress } from 'sushi/evm'

export interface LaunchPoolToken {
  address: EvmAddress
  balance: string
  balanceUSD?: string | null
  decimals: number
  logoURI?: string | null
  name: string
  symbol: string
  weight: string
}

export interface LaunchPricePoint {
  projectTokenPrice: number
  reservePrice: number
  timestamp: number
}

export interface LaunchPoolListItem {
  address: EvmAddress
  chain: string
  createTime: number
  dynamicData: {
    lifetimeVolume: string
    swapFee: string
    totalLiquidity: string
  }
  lbpParams: {
    endTime: number
    startTime: number
  }
  name: string
  poolTokens: LaunchPoolToken[]
}

export interface LaunchPoolDetail extends LaunchPoolListItem {
  description?: string | null
  discord?: string | null
  dynamicData: LaunchPoolListItem['dynamicData'] & {
    isPaused: boolean
    swapEnabled: boolean
    volume24h: string
  }
  isProjectTokenSwapInBlocked: boolean
  isSeedless: boolean
  lbpName?: string | null
  lbpOwner: EvmAddress
  owner: EvmAddress
  projectToken: EvmAddress
  projectTokenEndWeight: number
  projectTokenIndex: number
  projectTokenStartWeight: number
  reserveToken: EvmAddress
  reserveTokenIndex: number
  reserveTokenVirtualBalance: number
  website?: string | null
  x?: string | null
}
