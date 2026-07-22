'use client'

import {
  AddressProvider,
  type ChainId as BalancerChainId,
  CreatePool,
  type CreatePoolLiquidityBootstrappingInput,
  InitPool,
  InitPoolDataProvider,
  type InitPoolInputV3,
  MaxUint160,
  PERMIT2,
  PoolType,
  permit2Abi,
} from '@balancer/sdk'
import {
  ArrowLeftIcon,
  CheckCircleIcon,
  ChevronDownIcon,
  InformationCircleIcon,
} from '@heroicons/react/24/outline'
import {
  Button,
  Card,
  Container,
  FormSection,
  Separator,
  TextField,
} from '@sushiswap/ui'
import Link from 'next/link'
import { useMemo, useState } from 'react'
import { getPublicRpcUrl } from 'src/lib/launch/rpc'
import { Checker } from 'src/lib/wagmi/systems/Checker'
import { waitForSuccessfulReceipt } from 'src/lib/wagmi/transactions/wait-for-successful-receipt'
import { useSwitchChain } from 'src/lib/wallet'
import type { EvmAddress } from 'sushi/evm'
import {
  erc20Abi,
  formatUnits,
  getAddress,
  isAddress,
  maxUint256,
  parseAbi,
  parseEventLogs,
  parseUnits,
  zeroAddress,
} from 'viem'
import {
  useConnection,
  usePublicClient,
  useSendTransaction,
  useWriteContract,
} from 'wagmi'
import type { LaunchChainConfig } from '../config'
import {
  LAUNCH_END_PROJECT_WEIGHT,
  LAUNCH_IMMEDIATE_START_DELAY_MS,
  LAUNCH_MIN_DURATION_MS,
  LAUNCH_MIN_START_DELAY_MS,
  LAUNCH_START_PROJECT_WEIGHT,
  LAUNCH_SWAP_FEE_PERCENT,
} from '../config'
import { calculateVirtualReserveRaw, getNoTradeEndPrice } from '../launch'

interface CreateLaunchFormProps {
  chainKey: string
  config: LaunchChainConfig
}

interface TokenMetadata {
  decimals: number
  name: string
  symbol: string
}

interface LaunchSchedule {
  end: Date
  start: Date
}

type TransactionPhase =
  | 'idle'
  | 'creating'
  | 'approving-token'
  | 'approving-permit2'
  | 'initializing'
  | 'complete'

const poolCreatedAbi = parseAbi(['event PoolCreated(address indexed pool)'])
const durationPresets = [
  { hours: 24, label: '24h' },
  { hours: 48, label: '48h' },
  { hours: 72, label: '3 days' },
  { hours: 168, label: '7 days' },
] as const

function toDateTimeLocal(date: Date): string {
  const offset = date.getTimezoneOffset() * 60_000
  return new Date(date.getTime() - offset).toISOString().slice(0, 16)
}

function getButtonLabel(phase: TransactionPhase): string {
  if (phase === 'creating') return 'Creating your launch…'
  if (phase === 'approving-token') return 'Approving launch tokens…'
  if (phase === 'approving-permit2') return 'Preparing your wallet…'
  if (phase === 'initializing') return 'Funding your launch…'
  if (phase === 'complete') return 'Launch created'
  return 'Create launch'
}

function formatDuration(hours: number): string {
  if (hours > 0 && hours % 24 === 0) {
    const days = hours / 24
    return `${days} ${days === 1 ? 'day' : 'days'}`
  }
  return `${hours} ${hours === 1 ? 'hour' : 'hours'}`
}

async function saveMetadata({
  address,
  chain,
  description,
  discord,
  name,
  website,
  x,
}: {
  address: EvmAddress
  chain: string
  description: string
  discord: string
  name: string
  website: string
  x: string
}): Promise<void> {
  const response = await fetch('/api/launch/metadata', {
    body: JSON.stringify({
      address,
      chain,
      description,
      discord,
      name,
      website,
      x,
    }),
    headers: { 'content-type': 'application/json' },
    method: 'POST',
  })
  if (!response.ok) throw new Error('Could not sync launch details')
}

function isPublicUrl(value: string): boolean {
  if (!URL.canParse(value)) return false
  return ['http:', 'https:'].includes(new URL(value).protocol)
}

export function CreateLaunchForm({ chainKey, config }: CreateLaunchFormProps) {
  const now = useMemo(() => new Date(), [])
  const [projectName, setProjectName] = useState('')
  const [description, setDescription] = useState('')
  const [website, setWebsite] = useState('')
  const [x, setX] = useState('')
  const [discord, setDiscord] = useState('')
  const [projectToken, setProjectToken] = useState('')
  const [projectAmount, setProjectAmount] = useState('')
  const [initialPrice, setInitialPrice] = useState('')
  const [durationHours, setDurationHours] = useState('24')
  const [isAdvancedScheduleOpen, setIsAdvancedScheduleOpen] = useState(false)
  const [isProjectLinksOpen, setIsProjectLinksOpen] = useState(false)
  const [startDate, setStartDate] = useState(
    toDateTimeLocal(new Date(now.getTime() + LAUNCH_MIN_START_DELAY_MS)),
  )
  const [phase, setPhase] = useState<TransactionPhase>('idle')
  const [poolAddress, setPoolAddress] = useState<EvmAddress>()
  const [error, setError] = useState<string>()
  const [metadataError, setMetadataError] = useState<string>()
  const [isSavingMetadata, setIsSavingMetadata] = useState(false)

  const { address: account, chainId: connectedChainId } = useConnection()
  const publicClient = usePublicClient({ chainId: config.chainId })
  const { mutateAsync: sendTransactionAsync } = useSendTransaction()
  const { mutateAsync: writeContractAsync } = useWriteContract()
  const { mutateAsync: switchChainAsync } = useSwitchChain()

  const noTradeEndPrice = getNoTradeEndPrice(Number(initialPrice || 0))
  const isPending = !['idle', 'complete'].includes(phase)

  async function readTokenMetadata(
    address: EvmAddress,
  ): Promise<TokenMetadata> {
    if (!publicClient) throw new Error('Network client is unavailable')
    const [decimals, symbol, name] = await Promise.all([
      publicClient.readContract({
        abi: erc20Abi,
        address,
        functionName: 'decimals',
      }),
      publicClient.readContract({
        abi: erc20Abi,
        address,
        functionName: 'symbol',
      }),
      publicClient.readContract({
        abi: erc20Abi,
        address,
        functionName: 'name',
      }),
    ])
    return { decimals, name, symbol }
  }

  async function sendAndWait(request: {
    data: `0x${string}`
    to: EvmAddress
    value?: bigint
  }) {
    if (!publicClient || !account) {
      throw new Error('Connect your wallet to continue')
    }
    const hash = await sendTransactionAsync({
      account,
      chainId: config.chainId,
      data: request.data,
      to: request.to,
      value: request.value,
    })
    return waitForSuccessfulReceipt(publicClient, hash)
  }

  async function ensureApprovals(
    token: EvmAddress,
    amount: bigint,
  ): Promise<void> {
    if (!publicClient || !account) throw new Error('Wallet is unavailable')
    const permit2 = PERMIT2[config.chainId]
    if (!permit2) throw new Error('Permit2 is unavailable on this network')
    const router = AddressProvider.Router(config.chainId as BalancerChainId)

    const tokenAllowance = await publicClient.readContract({
      abi: erc20Abi,
      address: token,
      args: [account, permit2],
      functionName: 'allowance',
    })
    if (tokenAllowance < amount) {
      setPhase('approving-token')
      const hash = await writeContractAsync({
        abi: erc20Abi,
        account,
        address: token,
        args: [permit2, maxUint256],
        chainId: config.chainId,
        functionName: 'approve',
      })
      await waitForSuccessfulReceipt(publicClient, hash)
    }

    const [permitAmount, expiration] = await publicClient.readContract({
      abi: permit2Abi,
      address: permit2,
      args: [account, token, router],
      functionName: 'allowance',
    })
    const approvalExpiry = BigInt(Math.floor(Date.now() / 1000) + 3 * 86_400)
    if (permitAmount < amount || expiration <= BigInt(Date.now() / 1000)) {
      if (amount > MaxUint160) {
        throw new Error('Launch amount is too large for Permit2')
      }
      setPhase('approving-permit2')
      const hash = await writeContractAsync({
        abi: permit2Abi,
        account,
        address: permit2,
        args: [token, router, amount, Number(approvalExpiry)],
        chainId: config.chainId,
        functionName: 'approve',
      })
      await waitForSuccessfulReceipt(publicClient, hash)
    }
  }

  function getSchedule(): LaunchSchedule {
    const hours = Number(durationHours)
    const start = isAdvancedScheduleOpen
      ? new Date(startDate)
      : new Date(Date.now() + LAUNCH_IMMEDIATE_START_DELAY_MS)

    return {
      end: new Date(start.getTime() + hours * 60 * 60 * 1000),
      start,
    }
  }

  function validate(): LaunchSchedule {
    if (!account) throw new Error('Connect your wallet to continue')
    if (!projectName.trim()) throw new Error('Add a project name')
    if (!isAddress(projectToken)) throw new Error('Enter a valid token address')
    if (Number(projectAmount) <= 0) throw new Error('Enter a token amount')
    if (Number(initialPrice) <= 0) throw new Error('Enter an initial price')
    const hours = Number(durationHours)
    if (!Number.isSafeInteger(hours) || hours < 24) {
      throw new Error('Run the launch for at least 24 whole hours')
    }
    if (website && !isPublicUrl(website)) {
      throw new Error('Enter a valid website URL')
    }
    if (discord && !isPublicUrl(discord)) {
      throw new Error('Enter a valid Discord URL')
    }
    const schedule = getSchedule()
    const { end, start } = schedule
    if (!Number.isFinite(start.getTime()) || !Number.isFinite(end.getTime())) {
      throw new Error('Choose a valid start time')
    }
    if (
      isAdvancedScheduleOpen &&
      start.getTime() < Date.now() + LAUNCH_MIN_START_DELAY_MS - 60_000
    ) {
      throw new Error('Schedule the launch at least two hours from now')
    }
    if (end.getTime() - start.getTime() < LAUNCH_MIN_DURATION_MS) {
      throw new Error('Run the launch for at least 24 hours')
    }
    return schedule
  }

  async function handleCreate(): Promise<void> {
    setError(undefined)
    setMetadataError(undefined)
    try {
      validate()
      if (!account || !publicClient) return
      if (connectedChainId !== config.chainId) {
        await switchChainAsync({ chainId: config.chainId })
        return
      }
      const projectTokenAddress = getAddress(projectToken)
      if (
        projectTokenAddress.toLowerCase() ===
        config.reserveToken.address.toLowerCase()
      ) {
        throw new Error(
          `${config.reserveToken.symbol} is used to buy; choose a different project token`,
        )
      }
      const metadata = await readTokenMetadata(projectTokenAddress)
      const amountRaw = parseUnits(projectAmount, metadata.decimals)
      const virtualReserveBalance = calculateVirtualReserveRaw({
        initialPrice,
        projectAmountRaw: amountRaw,
        projectTokenDecimals: metadata.decimals,
        reserveTokenDecimals: config.reserveToken.decimals,
      })
      if (virtualReserveBalance === 0n) {
        throw new Error('The opening price is too small for this token amount')
      }
      const balance = await publicClient.readContract({
        abi: erc20Abi,
        address: projectTokenAddress,
        args: [account],
        functionName: 'balanceOf',
      })
      if (balance < amountRaw) {
        throw new Error(
          `This wallet has ${formatUnits(balance, metadata.decimals)} ${metadata.symbol}, less than the launch amount`,
        )
      }

      await ensureApprovals(projectTokenAddress, amountRaw)
      const schedule = validate()
      let createdPool = poolAddress
      if (!createdPool) {
        setPhase('creating')
        const createInput: CreatePoolLiquidityBootstrappingInput = {
          chainId: config.chainId,
          lbpParams: {
            blockProjectTokenSwapsIn: true,
            endTimestamp: BigInt(Math.floor(schedule.end.getTime() / 1000)),
            owner: account,
            projectToken: projectTokenAddress,
            projectTokenEndWeight: parseUnits(
              String(LAUNCH_END_PROJECT_WEIGHT),
              16,
            ),
            projectTokenStartWeight: parseUnits(
              String(LAUNCH_START_PROJECT_WEIGHT),
              16,
            ),
            reserveToken: config.reserveToken.address,
            reserveTokenEndWeight: parseUnits(
              String(100 - LAUNCH_END_PROJECT_WEIGHT),
              16,
            ),
            reserveTokenStartWeight: parseUnits(
              String(100 - LAUNCH_START_PROJECT_WEIGHT),
              16,
            ),
            reserveTokenVirtualBalance: virtualReserveBalance,
            startTimestamp: BigInt(Math.floor(schedule.start.getTime() / 1000)),
          },
          name: `${projectName.trim()} Liquidity Bootstrapping Pool`,
          poolCreator: zeroAddress,
          poolType: PoolType.LiquidityBootstrapping,
          protocolVersion: 3,
          swapFeePercentage: parseUnits(String(LAUNCH_SWAP_FEE_PERCENT), 16),
          symbol: `${metadata.symbol}-${config.reserveToken.symbol}-LBP`,
        }
        const call = new CreatePool().buildCall(createInput)
        const receipt = await sendAndWait({ data: call.callData, to: call.to })
        const logs = parseEventLogs({
          abi: poolCreatedAbi,
          logs: receipt.logs,
          strict: false,
        })
        createdPool = logs.find(({ eventName }) => eventName === 'PoolCreated')
          ?.args.pool
        if (!createdPool) {
          throw new Error('Pool was created, but its address could not be read')
        }
        setPoolAddress(createdPool)
      }

      setPhase('initializing')
      const initInput: InitPoolInputV3 = {
        amountsIn: [
          {
            address: projectTokenAddress,
            decimals: metadata.decimals,
            rawAmount: amountRaw,
          },
        ],
        chainId: config.chainId,
        minBptAmountOut: 0n,
        wethIsEth: false,
      }
      const poolState = await new InitPoolDataProvider(
        config.chainId,
        getPublicRpcUrl(config.chainId),
      ).getInitPoolData(createdPool, PoolType.LiquidityBootstrapping, 3)
      const initCall = new InitPool().buildCall(initInput, poolState)
      await sendAndWait({
        data: initCall.callData,
        to: initCall.to,
        value: initCall.value,
      })
      setPhase('complete')
      setIsSavingMetadata(true)
      try {
        await saveMetadata({
          address: createdPool,
          chain: config.apiChain,
          description,
          discord,
          name: projectName.trim(),
          website,
          x,
        })
      } catch {
        setMetadataError(
          'Your launch is live, but its listing details did not sync. Retry below so it appears correctly in Launch.',
        )
      } finally {
        setIsSavingMetadata(false)
      }
    } catch (caught: unknown) {
      setPhase('idle')
      setError(
        caught instanceof Error ? caught.message : 'Launch creation failed',
      )
    }
  }

  async function retryMetadata(): Promise<void> {
    if (!poolAddress) return
    setMetadataError(undefined)
    setIsSavingMetadata(true)
    try {
      await saveMetadata({
        address: poolAddress,
        chain: config.apiChain,
        description,
        discord,
        name: projectName.trim(),
        website,
        x,
      })
    } catch {
      setMetadataError(
        'Listing details still could not sync. Your launch is unaffected.',
      )
    } finally {
      setIsSavingMetadata(false)
    }
  }

  const duration = Number(durationHours)
  const scheduledStart = new Date(startDate)
  const startSummary = isAdvancedScheduleOpen
    ? Number.isFinite(scheduledStart.getTime())
      ? new Intl.DateTimeFormat(undefined, {
          dateStyle: 'medium',
          timeStyle: 'short',
        }).format(scheduledStart)
      : 'Choose a start time'
    : 'After setup'
  const durationSummary = Number.isSafeInteger(duration)
    ? formatDuration(duration)
    : 'Choose a duration'

  if (phase === 'complete' && poolAddress) {
    return (
      <Container maxWidth="2xl" className="w-full px-4 py-12">
        <Card className="p-8 text-center">
          <CheckCircleIcon className="mx-auto h-14 w-14 text-green" />
          <h1 className="mt-5 text-3xl font-bold">
            Your launch is live on-chain
          </h1>
          <p className="mx-auto mt-3 max-w-lg text-muted-foreground">
            It may take a moment for your launch to appear in discovery.
          </p>
          {isSavingMetadata ? (
            <p className="mx-auto mt-5 max-w-lg rounded-xl bg-blue/10 p-3 text-sm text-blue">
              Syncing your project details with the Launch directory…
            </p>
          ) : null}
          {metadataError ? (
            <div className="mx-auto mt-5 max-w-lg rounded-xl bg-red/10 p-4 text-sm text-red">
              <p>{metadataError}</p>
              <Button
                className="mt-3"
                loading={isSavingMetadata}
                onClick={() => void retryMetadata()}
                size="sm"
                variant="secondary"
              >
                Retry listing sync
              </Button>
            </div>
          ) : null}
          <div className="mt-7 flex flex-wrap justify-center gap-3">
            <Button asChild>
              <Link href={`/${chainKey}/launch/${poolAddress}`}>
                View launch
              </Link>
            </Button>
            <Button asChild variant="secondary">
              <Link href={`/${chainKey}/launch`}>Back to Launch</Link>
            </Button>
          </div>
          <p className="mt-6 break-all text-xs text-muted-foreground">
            Pool: {poolAddress}
          </p>
        </Card>
      </Container>
    )
  }

  return (
    <>
      <Container maxWidth="5xl" className="w-full px-4 py-8 md:py-10">
        <div className="flex items-start gap-3">
          <Button asChild className="-ml-3" size="sm" variant="ghost">
            <Link aria-label="Back to Launch" href={`/${chainKey}/launch`}>
              <ArrowLeftIcon className="h-5 w-5" />
            </Link>
          </Button>
          <div>
            <h1 className="text-3xl font-bold">Create a launch</h1>
            <p className="mt-2 max-w-2xl text-muted-foreground">
              Set up your token sale and let the market discover its price.
            </p>
          </div>
        </div>
      </Container>

      <section className="flex flex-1 flex-col border-t border-accent bg-gray-50 py-6 dark:bg-white/[0.02] md:py-10">
        <Container maxWidth="5xl" className="w-full px-4">
          <div className="space-y-5 md:space-y-8">
            <FormSection
              title="Project"
              description="Tell traders what you are launching."
            >
              <div className="space-y-2">
                <label className="text-sm font-medium" htmlFor="project-name">
                  Project name
                </label>
                <TextField
                  id="project-name"
                  onValueChange={setProjectName}
                  placeholder="Sushi Rocket"
                  type="text"
                  value={projectName}
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium" htmlFor="description">
                  Short description
                </label>
                <textarea
                  className="min-h-28 w-full rounded-xl border border-accent bg-background px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-blue"
                  id="description"
                  maxLength={1_000}
                  onChange={(event) => setDescription(event.target.value)}
                  placeholder="What are you building?"
                  value={description}
                />
              </div>
              <div className="rounded-xl border border-accent bg-background/60">
                <button
                  aria-expanded={isProjectLinksOpen}
                  className="flex w-full items-center justify-between gap-4 px-4 py-3 text-left"
                  onClick={() => setIsProjectLinksOpen((isOpen) => !isOpen)}
                  type="button"
                >
                  <span>
                    <span className="block text-sm font-medium">
                      Project links
                    </span>
                    <span className="block text-xs text-muted-foreground">
                      Website and socials (optional)
                    </span>
                  </span>
                  <ChevronDownIcon
                    className={`h-4 w-4 shrink-0 transition-transform ${
                      isProjectLinksOpen ? 'rotate-180' : ''
                    }`}
                  />
                </button>
                {isProjectLinksOpen ? (
                  <div className="space-y-4 border-t border-accent px-4 py-4">
                    <div className="space-y-2">
                      <label className="text-sm font-medium" htmlFor="website">
                        Website
                      </label>
                      <TextField
                        id="website"
                        onValueChange={setWebsite}
                        placeholder="https://project.xyz"
                        type="text"
                        value={website}
                      />
                    </div>
                    <div className="grid gap-4 sm:grid-cols-2">
                      <div className="space-y-2">
                        <label
                          className="text-sm font-medium"
                          htmlFor="x-handle"
                        >
                          X
                        </label>
                        <TextField
                          id="x-handle"
                          onValueChange={setX}
                          placeholder="@project"
                          type="text"
                          value={x}
                        />
                      </div>
                      <div className="space-y-2">
                        <label
                          className="text-sm font-medium"
                          htmlFor="discord"
                        >
                          Discord
                        </label>
                        <TextField
                          id="discord"
                          onValueChange={setDiscord}
                          placeholder="https://discord.gg/project"
                          type="text"
                          value={discord}
                        />
                      </div>
                    </div>
                  </div>
                ) : null}
              </div>
            </FormSection>

            <Separator />

            <FormSection
              title="Token"
              description="Choose the token and how much supply to sell."
            >
              <div className="space-y-2">
                <label className="text-sm font-medium" htmlFor="token-address">
                  Token contract
                </label>
                <TextField
                  id="token-address"
                  onValueChange={setProjectToken}
                  placeholder="0x…"
                  type="text"
                  value={projectToken}
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium" htmlFor="token-amount">
                  Tokens for sale
                </label>
                <TextField
                  id="token-amount"
                  onValueChange={setProjectAmount}
                  placeholder="1,000,000"
                  type="number"
                  value={projectAmount}
                />
              </div>
            </FormSection>

            <Separator />

            <FormSection
              title="Opening price"
              description={`Choose the starting price in ${config.reserveToken.symbol}. Start high and let buyers find the market.`}
            >
              <div className="space-y-2">
                <label className="text-sm font-medium" htmlFor="opening-price">
                  Price per token
                </label>
                <TextField
                  id="opening-price"
                  onValueChange={setInitialPrice}
                  placeholder="1.00"
                  type="number"
                  unit={config.reserveToken.symbol}
                  value={initialPrice}
                />
              </div>
              {Number(initialPrice) > 0 ? (
                <div className="flex gap-3 rounded-xl bg-blue/10 p-4 text-sm">
                  <InformationCircleIcon className="h-5 w-5 shrink-0 text-blue" />
                  <p>
                    With no buys, the price would trend toward{' '}
                    <strong>
                      {noTradeEndPrice.toLocaleString(undefined, {
                        maximumSignificantDigits: 6,
                      })}{' '}
                      {config.reserveToken.symbol}
                    </strong>{' '}
                    by the close. Strong demand can keep it higher.
                  </p>
                </div>
              ) : null}
            </FormSection>

            <Separator />

            <FormSection
              title="Duration"
              description="The launch starts automatically after setup. It must run for at least 24 hours."
            >
              <div className="space-y-2">
                <label className="text-sm font-medium" htmlFor="duration-hours">
                  Sale length
                </label>
                <TextField
                  id="duration-hours"
                  maxDecimals={0}
                  min={24}
                  onValueChange={setDurationHours}
                  placeholder="24"
                  type="number"
                  unit="hours"
                  value={durationHours}
                />
              </div>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                {durationPresets.map((preset) => (
                  <Button
                    aria-pressed={durationHours === String(preset.hours)}
                    className="w-full"
                    key={preset.hours}
                    onClick={() => setDurationHours(String(preset.hours))}
                    size="sm"
                    type="button"
                    variant={
                      durationHours === String(preset.hours)
                        ? 'secondary'
                        : 'ghost'
                    }
                  >
                    {preset.label}
                  </Button>
                ))}
              </div>

              <div className="rounded-xl border border-accent bg-background/60">
                <button
                  aria-expanded={isAdvancedScheduleOpen}
                  className="flex w-full items-center justify-between gap-4 px-4 py-3 text-left"
                  onClick={() => setIsAdvancedScheduleOpen((isOpen) => !isOpen)}
                  type="button"
                >
                  <span>
                    <span className="block text-sm font-medium">
                      Advanced scheduling
                    </span>
                    <span className="block text-xs text-muted-foreground">
                      Start at a future date instead
                    </span>
                  </span>
                  <ChevronDownIcon
                    className={`h-4 w-4 shrink-0 transition-transform ${
                      isAdvancedScheduleOpen ? 'rotate-180' : ''
                    }`}
                  />
                </button>
                {isAdvancedScheduleOpen ? (
                  <div className="border-t border-accent px-4 py-4">
                    <label className="text-sm font-medium" htmlFor="start-date">
                      Future start time
                    </label>
                    <input
                      className="mt-2 h-10 w-full rounded-xl border border-accent bg-background px-3 text-sm"
                      id="start-date"
                      min={toDateTimeLocal(
                        new Date(Date.now() + LAUNCH_MIN_START_DELAY_MS),
                      )}
                      onChange={(event) => setStartDate(event.target.value)}
                      type="datetime-local"
                      value={startDate}
                    />
                    <p className="mt-2 text-xs text-muted-foreground">
                      Scheduled launches need at least two hours for setup.
                    </p>
                  </div>
                ) : null}
              </div>
            </FormSection>

            <Separator />

            <FormSection
              title="Review"
              description="Confirm the launch details and create it from your wallet."
            >
              <Card className="p-5 md:p-6">
                <div className="grid gap-3 sm:grid-cols-3">
                  <div className="rounded-xl bg-muted/40 p-3">
                    <p className="text-xs text-muted-foreground">Starts</p>
                    <p className="mt-1 text-sm font-medium">{startSummary}</p>
                  </div>
                  <div className="rounded-xl bg-muted/40 p-3">
                    <p className="text-xs text-muted-foreground">Duration</p>
                    <p className="mt-1 text-sm font-medium">
                      {durationSummary}
                    </p>
                  </div>
                  <div className="rounded-xl bg-muted/40 p-3">
                    <p className="text-xs text-muted-foreground">Market</p>
                    <p className="mt-1 text-sm font-medium">
                      {config.reserveToken.symbol}
                    </p>
                  </div>
                </div>
                <p className="mt-4 text-sm text-muted-foreground">
                  Buyers can only buy. Tokens unlock immediately.
                </p>
                {poolAddress && phase === 'idle' ? (
                  <p className="mt-4 rounded-xl bg-yellow/10 p-3 text-sm text-yellow-600 dark:text-yellow">
                    The launch contract was created. Retry to finish funding; a
                    second launch will not be created.
                  </p>
                ) : null}
                {error ? (
                  <p className="mt-4 rounded-xl bg-red/10 p-3 text-sm text-red">
                    {error}
                  </p>
                ) : null}
                <Checker.Connect
                  className="mt-5"
                  fullWidth
                  size="xl"
                  variant="sushi-gradient"
                >
                  <Button
                    disabled={phase === 'complete'}
                    fullWidth
                    loading={isPending}
                    onClick={() => void handleCreate()}
                    size="xl"
                    variant="sushi-gradient"
                  >
                    {connectedChainId !== config.chainId && account
                      ? `Switch network to create`
                      : getButtonLabel(phase)}
                  </Button>
                </Checker.Connect>
                <p className="mt-3 text-center text-xs text-muted-foreground">
                  Launches are public and cannot be edited after creation.
                </p>
              </Card>
            </FormSection>
          </div>
        </Container>
      </section>
    </>
  )
}
