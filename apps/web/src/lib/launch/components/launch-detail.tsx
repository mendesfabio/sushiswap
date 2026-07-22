import {
  ArrowLeftIcon,
  ArrowTopRightOnSquareIcon,
} from '@heroicons/react/24/outline'
import { Button, Card, Container } from '@sushiswap/ui'
import Link from 'next/link'
import { getEvmChainById } from 'sushi/evm'
import type { LaunchChainConfig } from '../config'
import {
  getCurrentPrice,
  getLaunchAthPrice,
  getLaunchPriceAt,
  getLaunchProgress,
  getLaunchStatus,
  getLinearWeightAt,
} from '../launch'
import type {
  LaunchPoolDetail,
  LaunchPoolToken,
  LaunchPricePoint,
} from '../types'
import { CreateSushiPoolButton } from './create-sushi-pool-button'
import { LaunchPriceChart } from './launch-price-chart'
import { ParticipateCard } from './participate-card'
import { ShareLaunchButton } from './share-launch-button'

interface LaunchDetailProps {
  chainKey: string
  config: LaunchChainConfig
  pool: LaunchPoolDetail
  pricePoints: LaunchPricePoint[]
  totalSupply?: number
}

function formatDate(timestamp: number): string {
  return new Intl.DateTimeFormat('en-US', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(timestamp * 1000))
}

function formatUsd(value?: number | string): string {
  const number = Number(value)
  if (!Number.isFinite(number)) return '—'
  if (number > 0 && number < 0.01) {
    return `$${number.toLocaleString('en-US', {
      maximumSignificantDigits: 3,
      useGrouping: false,
    })}`
  }
  const compactUnits = [
    { minimum: 1_000_000_000, suffix: 'B' },
    { minimum: 1_000_000, suffix: 'M' },
    { minimum: 1_000, suffix: 'K' },
  ]
  const unit = compactUnits.find(({ minimum }) => number >= minimum)
  if (unit) return `$${(number / unit.minimum).toFixed(1)}${unit.suffix}`
  return new Intl.NumberFormat('en-US', {
    currency: 'USD',
    maximumFractionDigits: 2,
    style: 'currency',
  }).format(number)
}

function formatTokenAmount(value: string): string {
  const number = Number(value)
  if (!Number.isFinite(number)) return '—'
  return new Intl.NumberFormat('en-US', {
    maximumFractionDigits: 2,
    notation: number >= 10_000 ? 'compact' : 'standard',
  }).format(number)
}

function tokenAt(pool: LaunchPoolDetail, index: number): LaunchPoolToken {
  const token = pool.poolTokens.find(
    ({ address }) =>
      address.toLowerCase() ===
      (index === pool.projectTokenIndex
        ? pool.projectToken
        : pool.reserveToken
      ).toLowerCase(),
  )
  if (!token) throw new Error('Launch token data is incomplete')
  return token
}

function statusLabel(status: ReturnType<typeof getLaunchStatus>): string {
  if (status === 'live') return 'Live'
  if (status === 'upcoming') return 'Upcoming'
  return 'Ended'
}

function statusStyles(status: ReturnType<typeof getLaunchStatus>): string {
  if (status === 'live') return 'bg-green/15 text-green'
  if (status === 'upcoming') return 'bg-blue/15 text-blue'
  return 'bg-muted text-muted-foreground'
}

function getPublicUrl(value?: string | null): string | undefined {
  if (!value || !URL.canParse(value)) return undefined
  const url = new URL(value)
  return ['http:', 'https:'].includes(url.protocol) ? url.toString() : undefined
}

export function LaunchDetail({
  chainKey,
  config,
  pool,
  pricePoints,
  totalSupply,
}: LaunchDetailProps) {
  const projectToken = tokenAt(pool, pool.projectTokenIndex)
  const reserveToken = tokenAt(pool, pool.reserveTokenIndex)
  const status = getLaunchStatus(
    pool.lbpParams.startTime,
    pool.lbpParams.endTime,
  )
  const progress = getLaunchProgress(
    pool.lbpParams.startTime,
    pool.lbpParams.endTime,
  )
  const projectWeight = getLinearWeightAt({
    endTime: pool.lbpParams.endTime,
    endWeight: pool.projectTokenEndWeight * 100,
    startTime: pool.lbpParams.startTime,
    startWeight: pool.projectTokenStartWeight * 100,
  })
  const currentPoolPrice = getCurrentPrice({
    projectBalance: Number(projectToken.balance),
    projectWeight: projectWeight / 100,
    reserveBalance: Number(reserveToken.balance),
    virtualReserveBalance: pool.reserveTokenVirtualBalance,
  })
  const reservePriceUsd =
    Number(reserveToken.balance) > 0 && Number(reserveToken.balanceUSD) > 0
      ? Number(reserveToken.balanceUSD) / Number(reserveToken.balance)
      : undefined
  const currentTimestamp = Date.now() / 1000
  const reservePriceFallback = reservePriceUsd ?? 1
  const chartPriceUsd = getLaunchPriceAt(
    pricePoints,
    currentTimestamp,
    reservePriceFallback,
  )
  const priceUsd =
    chartPriceUsd ??
    (currentPoolPrice && reservePriceUsd
      ? currentPoolPrice * reservePriceUsd
      : undefined)
  const athPriceUsd = getLaunchAthPrice(
    pricePoints,
    currentTimestamp,
    reservePriceFallback,
  )
  const marketCap =
    priceUsd && totalSupply !== undefined ? priceUsd * totalSupply : undefined
  const athMarketCap =
    athPriceUsd && totalSupply !== undefined
      ? athPriceUsd * totalSupply
      : undefined
  const title =
    pool.lbpName ?? pool.name.replace(/ Liquidity Bootstrapping Pool$/, '')
  const website = getPublicUrl(pool.website)
  const discord = getPublicUrl(pool.discord)
  const chain = getEvmChainById(config.chainId)
  const metrics = [
    { label: 'Market cap', value: formatUsd(marketCap) },
    { label: 'Liquidity', value: formatUsd(pool.dynamicData.totalLiquidity) },
    { label: '24h volume', value: formatUsd(pool.dynamicData.volume24h) },
    { label: 'ATH', value: formatUsd(athMarketCap) },
  ]

  return (
    <Container maxWidth="7xl" className="w-full px-4 py-8 md:py-10">
      <Link
        className="inline-flex items-center gap-1.5 text-sm font-semibold text-blue hover:text-blue-700 hover:underline"
        href={`/${chainKey}/launch`}
      >
        <ArrowLeftIcon className="h-4 w-4 shrink-0" />
        <span>All launches</span>
      </Link>

      <Card className="mt-6 overflow-hidden p-5 md:p-7">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
          <div className="flex min-w-0 gap-4">
            {projectToken.logoURI ? (
              <img
                alt=""
                className="h-16 w-16 shrink-0 rounded-2xl object-cover md:h-20 md:w-20"
                src={projectToken.logoURI}
              />
            ) : (
              <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-pink/15 text-2xl font-bold text-pink md:h-20 md:w-20">
                {projectToken.symbol.slice(0, 1)}
              </div>
            )}
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="truncate text-3xl font-bold md:text-4xl">
                  {title}
                </h1>
                <span
                  className={`rounded-full px-2.5 py-1 text-xs font-semibold ${statusStyles(status)}`}
                >
                  {statusLabel(status)}
                </span>
                <ShareLaunchButton
                  address={pool.address}
                  chainKey={chainKey}
                  name={title}
                  symbol={projectToken.symbol}
                />
              </div>
              <p className="mt-1 text-lg text-muted-foreground">
                ${projectToken.symbol}
              </p>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground">
                {pool.description ||
                  `A new token launch for $${projectToken.symbol}.`}
              </p>
              <div className="mt-4 flex flex-wrap gap-3 text-sm">
                <a
                  className="inline-flex items-center gap-1 font-semibold text-blue hover:underline"
                  href={chain.getTokenUrl(projectToken.address as never)}
                  rel="noreferrer"
                  target="_blank"
                >
                  {projectToken.address.slice(0, 6)}…
                  {projectToken.address.slice(-4)}
                  <ArrowTopRightOnSquareIcon className="h-4 w-4" />
                </a>
                {website ? (
                  <a
                    className="font-semibold text-blue hover:underline"
                    href={website}
                    rel="noreferrer"
                    target="_blank"
                  >
                    Website
                  </a>
                ) : null}
                {pool.x ? (
                  <a
                    className="font-semibold text-blue hover:underline"
                    href={`https://x.com/${pool.x.replace(/^@/, '')}`}
                    rel="noreferrer"
                    target="_blank"
                  >
                    X
                  </a>
                ) : null}
                {discord ? (
                  <a
                    className="font-semibold text-blue hover:underline"
                    href={discord}
                    rel="noreferrer"
                    target="_blank"
                  >
                    Discord
                  </a>
                ) : null}
              </div>
            </div>
          </div>

          <div className="grid shrink-0 grid-cols-2 gap-x-8 gap-y-4 sm:grid-cols-4 lg:min-w-[520px]">
            {metrics.map(({ label, value }) => (
              <div key={label}>
                <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  {label}
                </p>
                <p className="mt-1 text-lg font-semibold">{value}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-7 border-t border-accent pt-5">
          <div className="flex items-center justify-between gap-4 text-sm">
            <span className="font-medium">Launch progress</span>
            <span className="text-muted-foreground">
              {(progress * 100).toFixed(0)}%
            </span>
          </div>
          <div className="mt-3 h-2 overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-sushi-gradient"
              style={{ width: `${progress * 100}%` }}
            />
          </div>
          <div className="mt-2 flex flex-wrap justify-between gap-2 text-xs text-muted-foreground">
            <span>
              {status === 'upcoming' ? 'Starts' : 'Started'}{' '}
              {formatDate(pool.lbpParams.startTime)}
            </span>
            <span>
              {status === 'ended' ? 'Ended' : 'Ends'}{' '}
              {formatDate(pool.lbpParams.endTime)}
            </span>
          </div>
        </div>
      </Card>

      <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_400px]">
        <div className="space-y-6">
          <LaunchPriceChart
            currentPrice={priceUsd}
            cutTimestamp={currentTimestamp}
            points={pricePoints}
            reservePriceFallback={reservePriceFallback}
            symbol={projectToken.symbol}
          />
          <Card className="p-5 md:p-6">
            <h2 className="text-xl font-semibold">Sale details</h2>
            <div className="mt-5 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
              <div>
                <p className="text-sm text-muted-foreground">Available</p>
                <p className="mt-1 font-semibold">
                  {formatTokenAmount(projectToken.balance)} $
                  {projectToken.symbol}
                </p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">
                  {pool.isSeedless ? 'Raised' : 'Quote balance'}
                </p>
                <p className="mt-1 font-semibold">
                  {formatTokenAmount(reserveToken.balance)}{' '}
                  {reserveToken.symbol}
                </p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Opens</p>
                <p className="mt-1 font-semibold">
                  {formatDate(pool.lbpParams.startTime)}
                </p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Closes</p>
                <p className="mt-1 font-semibold">
                  {formatDate(pool.lbpParams.endTime)}
                </p>
              </div>
            </div>
            <p className="mt-5 flex items-center gap-1 border-t border-accent pt-4 text-xs text-muted-foreground">
              Created by
              <a
                aria-label={`View creator ${pool.lbpOwner} on ${chain.name} explorer`}
                className="inline-flex items-center gap-1 font-medium text-blue hover:underline"
                href={chain.getAccountUrl(pool.lbpOwner)}
                rel="noreferrer"
                target="_blank"
              >
                {pool.lbpOwner.slice(0, 6)}…{pool.lbpOwner.slice(-4)}
                <ArrowTopRightOnSquareIcon className="h-3.5 w-3.5" />
              </a>
            </p>
          </Card>

          {status === 'ended' ? (
            <Card className="border-pink/30 bg-pink/5 p-6">
              <p className="text-sm font-semibold uppercase tracking-widest text-pink">
                Launch complete
              </p>
              <h2 className="mt-2 text-2xl font-bold">
                Make ${projectToken.symbol} liquid on Sushi
              </h2>
              <p className="mt-2 text-sm text-muted-foreground">
                Take the discovered price into a long-term Sushi market.
              </p>
              <CreateSushiPoolButton
                chainId={config.chainId}
                chainKey={chainKey}
                projectToken={projectToken.address}
                reserveToken={reserveToken.address}
              />
            </Card>
          ) : null}
        </div>

        <aside className="lg:sticky lg:top-20 lg:self-start">
          <ParticipateCard
            config={config}
            pool={pool}
            projectToken={projectToken}
            reserveToken={reserveToken}
          />
        </aside>
      </div>
    </Container>
  )
}
