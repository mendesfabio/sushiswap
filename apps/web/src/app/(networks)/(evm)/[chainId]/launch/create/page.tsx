import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { CreateLaunchForm } from 'src/lib/launch/components/create-launch-form'
import { LaunchPage } from 'src/lib/launch/components/launch-page'
import { getLaunchChainConfig } from 'src/lib/launch/config'
import { getEvmChainById, isEvmChainId } from 'sushi/evm'

export const metadata: Metadata = {
  title: 'Create a launch',
  description: 'Launch your token and find its market on Sushi.',
}

export default async function Page(props: {
  params: Promise<{ chainId: string }>
}) {
  const { chainId: chainIdParam } = await props.params
  const chainId = Number(chainIdParam)
  if (!isEvmChainId(chainId)) return notFound()

  const chainKey = getEvmChainById(chainId).key
  const config = getLaunchChainConfig(chainId)
  if (!config) return <LaunchPage chainKey={chainKey} />

  return <CreateLaunchForm chainKey={chainKey} config={config} />
}
