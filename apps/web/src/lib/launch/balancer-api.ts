import 'server-only'

import type { LaunchChainConfig } from './config'
import type {
  LaunchPoolDetail,
  LaunchPoolListItem,
  LaunchPricePoint,
} from './types'

const BALANCER_API_URL =
  process.env.BALANCER_API_URL ?? 'https://api-v3.balancer.fi/graphql'

interface GraphqlResponse<T> {
  data?: T
  errors?: { message: string }[]
}

async function balancerRequest<T>(
  query: string,
  variables?: Record<string, unknown>,
): Promise<T> {
  const response = await fetch(BALANCER_API_URL, {
    body: JSON.stringify({ query, variables }),
    headers: { 'content-type': 'application/json' },
    method: 'POST',
    next: { revalidate: 30 },
  })

  if (!response.ok) {
    throw new Error(`Balancer API returned ${response.status}`)
  }

  const result = (await response.json()) as GraphqlResponse<T>
  if (!result.data || result.errors?.length) {
    throw new Error(result.errors?.[0]?.message ?? 'Balancer API failed')
  }

  return result.data
}

const POOL_LIST_FIELDS = `
  address
  chain
  createTime
  name
  dynamicData {
    totalLiquidity
    lifetimeVolume
    swapFee
  }
  lbpParams {
    startTime
    endTime
  }
  poolTokens {
    address
    symbol
    name
    decimals
    balance
    balanceUSD
    weight
    logoURI
  }
`

export async function getLaunchPools(
  config: LaunchChainConfig,
): Promise<LaunchPoolListItem[]> {
  const data = await balancerRequest<{ poolGetPools: LaunchPoolListItem[] }>(
    `query GetSushiLaunches($chain: GqlChain!) {
      poolGetPools(
        first: 100
        where: {
          chainIn: [$chain]
          poolTypeIn: [LIQUIDITY_BOOTSTRAPPING]
          protocolVersionIn: [3]
        }
      ) {
        ${POOL_LIST_FIELDS}
      }
    }`,
    { chain: config.apiChain },
  )

  return data.poolGetPools.sort(
    (a, b) => b.lbpParams.startTime - a.lbpParams.startTime,
  )
}

export async function getLaunchPool(
  config: LaunchChainConfig,
  address: string,
): Promise<LaunchPoolDetail | undefined> {
  type LaunchPoolDetailResponse = Omit<LaunchPoolDetail, 'lbpParams'> & {
    endTime: number
    startTime: number
  }

  const data = await balancerRequest<{
    poolGetPool: LaunchPoolDetailResponse | null
  }>(
    `query GetSushiLaunch($chain: GqlChain!, $id: String!) {
      poolGetPool(id: $id, chain: $chain) {
        address
        chain
        createTime
        name
        owner
        dynamicData {
          totalLiquidity
          lifetimeVolume
          volume24h
          swapFee
          swapEnabled
          isPaused
        }
        poolTokens {
          address
          symbol
          name
          decimals
          balance
          balanceUSD
          weight
          logoURI
        }
        ... on GqlPoolLiquidityBootstrappingV3 {
          description
          discord
          endTime
          isProjectTokenSwapInBlocked
          isSeedless
          lbpName
          lbpOwner
          projectToken
          projectTokenEndWeight
          projectTokenIndex
          projectTokenStartWeight
          reserveToken
          reserveTokenIndex
          reserveTokenVirtualBalance
          startTime
          website
          x
        }
      }
    }`,
    { chain: config.apiChain, id: address.toLowerCase() },
  )

  if (!data.poolGetPool) return undefined
  const { endTime, startTime, ...pool } = data.poolGetPool
  return { ...pool, lbpParams: { endTime, startTime } }
}

export async function getLaunchPricePoints(
  config: LaunchChainConfig,
  address: string,
): Promise<LaunchPricePoint[]> {
  const data = await balancerRequest<{ prices: LaunchPricePoint[] }>(
    `query GetSushiLaunchPrices($chain: GqlChain!, $id: String!) {
      prices: lbpPriceChart(chain: $chain, id: $id, dataPoints: 500) {
        projectTokenPrice
        reservePrice
        timestamp
      }
    }`,
    { chain: config.apiChain, id: address.toLowerCase() },
  )

  return data.prices
}
