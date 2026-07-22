import { ArrowRightIcon } from '@heroicons/react/24/outline'
import { Card } from '@sushiswap/ui'
import Link from 'next/link'
import { getLaunchProgress, getLaunchStatus } from '../launch'
import type { LaunchPoolListItem } from '../types'

interface LaunchPoolsProps {
  chainKey: string
  pools: LaunchPoolListItem[]
}

function formatUsd(value: number | string): string {
  const number = Number(value)
  if (!Number.isFinite(number)) return '—'
  return new Intl.NumberFormat('en-US', {
    currency: 'USD',
    maximumFractionDigits: 2,
    notation: number >= 10_000 ? 'compact' : 'standard',
    style: 'currency',
  }).format(number)
}

function formatDate(timestamp: number): string {
  return new Intl.DateTimeFormat('en-US', {
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    month: 'short',
  }).format(new Date(timestamp * 1000))
}

function statusStyles(status: ReturnType<typeof getLaunchStatus>): string {
  if (status === 'live') return 'bg-green/15 text-green'
  if (status === 'upcoming') return 'bg-blue/15 text-blue'
  return 'bg-muted text-muted-foreground'
}

function statusLabel(status: ReturnType<typeof getLaunchStatus>): string {
  if (status === 'live') return 'Live'
  if (status === 'upcoming') return 'Upcoming'
  return 'Ended'
}

function timingLabel(pool: LaunchPoolListItem): string {
  const status = getLaunchStatus(
    pool.lbpParams.startTime,
    pool.lbpParams.endTime,
  )
  if (status === 'upcoming') {
    return `Starts ${formatDate(pool.lbpParams.startTime)}`
  }
  if (status === 'live') return `Ends ${formatDate(pool.lbpParams.endTime)}`
  return `Ended ${formatDate(pool.lbpParams.endTime)}`
}

export function LaunchPools({ chainKey, pools }: LaunchPoolsProps) {
  const liveCount = pools.filter(
    ({ lbpParams }) =>
      getLaunchStatus(lbpParams.startTime, lbpParams.endTime) === 'live',
  ).length
  const totalVolume = pools.reduce(
    (total, pool) => total + Number(pool.dynamicData.lifetimeVolume || 0),
    0,
  )
  const totalLiquidity = pools.reduce(
    (total, pool) => total + Number(pool.dynamicData.totalLiquidity || 0),
    0,
  )
  const stats = [
    { label: 'Launches', value: pools.length.toLocaleString() },
    { label: 'Live now', value: liveCount.toLocaleString() },
    { label: 'Total volume', value: formatUsd(totalVolume) },
    { label: 'Liquidity', value: formatUsd(totalLiquidity) },
  ]
  const sections = [
    { key: 'live', label: 'Live now' },
    { key: 'upcoming', label: 'Upcoming' },
    { key: 'ended', label: 'Past launches' },
  ] as const

  return (
    <section className="pb-16">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map(({ label, value }) => (
          <Card key={label} className="p-5">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              {label}
            </p>
            <p className="mt-2 text-2xl font-semibold">{value}</p>
          </Card>
        ))}
      </div>

      <div className="mb-7 mt-12 flex items-end justify-between gap-4">
        <div>
          <p className="text-sm font-semibold uppercase tracking-widest text-pink">
            Discover
          </p>
          <h2 className="mt-2 text-3xl font-bold">Token launches</h2>
        </div>
        <span className="text-sm text-muted-foreground">
          New markets, onchain
        </span>
      </div>

      <div className="space-y-10">
        {sections.map(({ key, label }) => {
          const sectionPools = pools.filter(
            ({ lbpParams }) =>
              getLaunchStatus(lbpParams.startTime, lbpParams.endTime) === key,
          )
          if (sectionPools.length === 0 && key !== 'live') return null

          return (
            <div key={key}>
              <h3 className="mb-4 text-lg font-semibold">{label}</h3>
              {sectionPools.length === 0 ? (
                <Card className="border-dashed p-8 text-center text-sm text-muted-foreground">
                  Nothing live right now. Check upcoming launches or start the
                  next one.
                </Card>
              ) : (
                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                  {sectionPools.map((pool) => {
                    const primaryToken = pool.poolTokens[0]
                    const status = getLaunchStatus(
                      pool.lbpParams.startTime,
                      pool.lbpParams.endTime,
                    )
                    const progress = getLaunchProgress(
                      pool.lbpParams.startTime,
                      pool.lbpParams.endTime,
                    )

                    return (
                      <Link
                        href={`/${chainKey}/launch/${pool.address}`}
                        key={pool.address}
                      >
                        <Card className="group h-full p-5 transition-colors hover:border-pink/50">
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex min-w-0 items-center gap-3">
                              {primaryToken?.logoURI ? (
                                <img
                                  alt=""
                                  className="h-12 w-12 rounded-xl object-cover"
                                  src={primaryToken.logoURI}
                                />
                              ) : (
                                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-pink/15 text-lg font-bold text-pink">
                                  {primaryToken?.symbol?.slice(0, 1) ?? '?'}
                                </div>
                              )}
                              <div className="min-w-0">
                                <p className="truncate text-lg font-semibold">
                                  {pool.name.replace(
                                    / Liquidity Bootstrapping Pool$/,
                                    '',
                                  )}
                                </p>
                                <p className="text-sm text-muted-foreground">
                                  ${primaryToken?.symbol ?? 'TOKEN'}
                                </p>
                              </div>
                            </div>
                            <span
                              className={`rounded-full px-2.5 py-1 text-xs font-semibold ${statusStyles(status)}`}
                            >
                              {statusLabel(status)}
                            </span>
                          </div>

                          <div className="mt-6">
                            <div className="flex justify-between text-xs text-muted-foreground">
                              <span>Launch progress</span>
                              <span>{(progress * 100).toFixed(0)}%</span>
                            </div>
                            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted">
                              <div
                                className="h-full rounded-full bg-sushi-gradient"
                                style={{ width: `${progress * 100}%` }}
                              />
                            </div>
                            <p className="mt-2 text-xs text-muted-foreground">
                              {timingLabel(pool)}
                            </p>
                          </div>

                          <div className="mt-5 grid grid-cols-2 gap-4 border-t border-accent pt-4 text-sm">
                            <div>
                              <p className="text-muted-foreground">Liquidity</p>
                              <p className="mt-1 font-semibold">
                                {formatUsd(pool.dynamicData.totalLiquidity)}
                              </p>
                            </div>
                            <div>
                              <p className="text-muted-foreground">Volume</p>
                              <p className="mt-1 font-semibold">
                                {formatUsd(pool.dynamicData.lifetimeVolume)}
                              </p>
                            </div>
                          </div>

                          <div className="mt-5 flex items-center justify-between text-sm font-semibold text-pink">
                            Open launch
                            <ArrowRightIcon className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                          </div>
                        </Card>
                      </Link>
                    )
                  })}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </section>
  )
}
