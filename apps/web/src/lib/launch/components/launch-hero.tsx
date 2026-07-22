import {
  ArrowTrendingDownIcon,
  BoltIcon,
  RocketLaunchIcon,
} from '@heroicons/react/24/outline'
import { Button, Card } from '@sushiswap/ui'
import Link from 'next/link'

interface LaunchHeroProps {
  chainKey: string
  supported: boolean
}

export function LaunchHero({ chainKey, supported }: LaunchHeroProps) {
  return (
    <section className="flex flex-col gap-8 py-8 md:flex-row md:items-end md:justify-between md:py-12">
      <div className="max-w-3xl">
        <p className="text-sm font-semibold uppercase tracking-widest text-pink">
          Sushi Launch
        </p>
        <h1 className="mt-3 text-4xl font-bold tracking-tight md:text-6xl">
          Launch your token. Find your market.
        </h1>
        <p className="mt-5 max-w-2xl text-lg leading-8 text-muted-foreground">
          Kick off with a price-discovery sale. Set the opening price and
          duration, let demand find the level, then graduate liquidity to Sushi.
        </p>
      </div>
      <div className="flex shrink-0 flex-wrap gap-3">
        {supported ? (
          <Button asChild size="lg" variant="sushi-gradient">
            <Link href={`/${chainKey}/launch/create`}>Launch a token</Link>
          </Button>
        ) : (
          <Button disabled size="lg">
            Coming soon
          </Button>
        )}
      </div>
    </section>
  )
}

export function LaunchExplainer() {
  const items = [
    {
      description:
        'Choose how many tokens to sell, set the opening price, and pick how long your LBP will run.',
      icon: RocketLaunchIcon,
      title: 'Set up your LBP',
    },
    {
      description:
        'The price starts high and trends lower until buyers find the level they want.',
      icon: ArrowTrendingDownIcon,
      title: 'Let price discovery work',
    },
    {
      description:
        'When the sale closes, use the discovered price to seed long-term liquidity on Sushi.',
      icon: BoltIcon,
      title: 'Graduate to Sushi',
    },
  ]

  return (
    <section id="how-it-works" className="pb-12 pt-4">
      <div className="grid gap-4 md:grid-cols-3">
        {items.map(({ description, icon: Icon, title }, index) => (
          <Card key={title} className="p-5">
            <div className="flex items-start gap-4">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-pink/10 text-pink">
                <Icon className="h-5 w-5" />
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  0{index + 1}
                </p>
                <h2 className="mt-1 font-semibold">{title}</h2>
                <p className="mt-1 text-sm leading-6 text-muted-foreground">
                  {description}
                </p>
              </div>
            </div>
          </Card>
        ))}
      </div>
    </section>
  )
}
