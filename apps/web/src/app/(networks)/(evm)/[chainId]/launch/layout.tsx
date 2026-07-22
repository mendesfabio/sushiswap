import { SUPPORTED_CHAIN_IDS } from 'src/config'
import type { ChainId } from 'sushi'
import { Header } from '../header'

export default async function LaunchLayout(props: {
  children: React.ReactNode
  params: Promise<{ chainId: string }>
}) {
  const { children } = props
  const { chainId: chainIdParam } = await props.params
  const chainId = Number(chainIdParam)

  return (
    <>
      <Header chainId={chainId as ChainId} networks={SUPPORTED_CHAIN_IDS} />
      <main className="flex flex-1 animate-slide flex-col">{children}</main>
    </>
  )
}
