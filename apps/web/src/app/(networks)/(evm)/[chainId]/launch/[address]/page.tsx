import { Button, Card, Container } from '@sushiswap/ui'
import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import {
  getLaunchPool,
  getLaunchPricePoints,
} from 'src/lib/launch/balancer-api'
import { LaunchDetail } from 'src/lib/launch/components/launch-detail'
import { getLaunchChainConfig } from 'src/lib/launch/config'
import { getPublicRpcUrl } from 'src/lib/launch/rpc'
import { getEvmChainById, isEvmChainId } from 'sushi/evm'
import {
  http,
  createPublicClient,
  erc20Abi,
  formatUnits,
  isAddress,
} from 'viem'

export const metadata: Metadata = {
  title: 'Token launch',
}

export default async function Page(props: {
  params: Promise<{ address: string; chainId: string }>
}) {
  const { address, chainId: chainIdParam } = await props.params
  const chainId = Number(chainIdParam)
  if (!isEvmChainId(chainId) || !isAddress(address)) return notFound()

  const config = getLaunchChainConfig(chainId)
  if (!config) return notFound()
  const chainKey = getEvmChainById(chainId).key
  const [pool, pricePoints] = await Promise.all([
    getLaunchPool(config, address).catch((error: unknown) => {
      console.error('Failed to load launch', error)
      return undefined
    }),
    getLaunchPricePoints(config, address).catch((error: unknown) => {
      console.error('Failed to load launch price history', error)
      return []
    }),
  ])

  if (!pool) {
    return (
      <Container maxWidth="2xl" className="w-full px-4 py-16">
        <Card className="p-8 text-center">
          <h1 className="text-2xl font-bold">This launch is being indexed</h1>
          <p className="mt-3 text-muted-foreground">
            New launches can take a moment to appear. Refresh shortly, or return
            to the launch directory.
          </p>
          <div className="mt-6 flex justify-center gap-3">
            <Button asChild>
              <a href={`/${chainKey}/launch/${address}`}>Refresh</a>
            </Button>
            <Button asChild variant="secondary">
              <Link href={`/${chainKey}/launch`}>All launches</Link>
            </Button>
          </div>
        </Card>
      </Container>
    )
  }

  const projectToken = pool.poolTokens.find(
    ({ address: tokenAddress }) =>
      tokenAddress.toLowerCase() === pool.projectToken.toLowerCase(),
  )
  const totalSupply = projectToken
    ? await createPublicClient({
        transport: http(getPublicRpcUrl(config.chainId)),
      })
        .readContract({
          abi: erc20Abi,
          address: projectToken.address,
          functionName: 'totalSupply',
        })
        .then((value) => Number(formatUnits(value, projectToken.decimals)))
        .catch(() => undefined)
    : undefined

  return (
    <LaunchDetail
      chainKey={chainKey}
      config={config}
      pool={pool}
      pricePoints={pricePoints}
      totalSupply={totalSupply}
    />
  )
}
