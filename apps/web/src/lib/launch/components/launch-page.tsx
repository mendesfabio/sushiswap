import { Container } from '@sushiswap/ui'
import type { LaunchChainConfig } from '../config'
import type { LaunchPoolListItem } from '../types'
import { LaunchExplainer, LaunchHero } from './launch-hero'
import { LaunchPools } from './launch-pools'

interface LaunchPageProps {
  chainKey: string
  config?: LaunchChainConfig
  pools?: LaunchPoolListItem[]
}

export function LaunchPage({ chainKey, config, pools = [] }: LaunchPageProps) {
  return (
    <Container maxWidth="7xl" className="w-full px-4">
      <LaunchHero chainKey={chainKey} supported={Boolean(config)} />
      <LaunchExplainer />
      {config ? (
        <LaunchPools chainKey={chainKey} pools={pools} />
      ) : (
        <section className="pb-16 text-center">
          <h2 className="text-2xl font-bold capitalize">
            {chainKey} launches are coming soon
          </h2>
          <p className="mx-auto mt-3 max-w-xl text-muted-foreground">
            Explore how launches work today. Creation and trading will unlock
            here as soon as the network is ready.
          </p>
        </section>
      )}
    </Container>
  )
}
