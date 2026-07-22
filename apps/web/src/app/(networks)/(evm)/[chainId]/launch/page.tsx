import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { getLaunchPools } from 'src/lib/launch/balancer-api'
import { LaunchPage } from 'src/lib/launch/components/launch-page'
import { getLaunchChainConfig } from 'src/lib/launch/config'
import { getEvmChainById, isEvmChainId } from 'sushi/evm'

export const metadata: Metadata = {
  title: 'Launch',
  description:
    'Discover new token launches, join live sales, or launch your token on Sushi.',
}

export default async function Page(props: {
  params: Promise<{ chainId: string }>
}) {
  const { chainId: chainIdParam } = await props.params
  const chainId = Number(chainIdParam)
  if (!isEvmChainId(chainId)) return notFound()

  const config = getLaunchChainConfig(chainId)
  const pools = config
    ? await getLaunchPools(config).catch((error: unknown) => {
        console.error('Failed to load launches', error)
        return []
      })
    : []

  return (
    <LaunchPage
      chainKey={getEvmChainById(chainId).key}
      config={config}
      pools={pools}
    />
  )
}
