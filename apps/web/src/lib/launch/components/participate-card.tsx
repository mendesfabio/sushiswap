'use client'

import {
  AddressProvider,
  type ChainId as BalancerChainId,
  MaxUint160,
  PERMIT2,
  Slippage,
  Swap,
  type SwapBuildOutputExactIn,
  SwapKind,
  permit2Abi,
} from '@balancer/sdk'
import { ArrowDownIcon } from '@heroicons/react/24/outline'
import { Button, Card } from '@sushiswap/ui'
import { useMemo, useState } from 'react'
import { Web3Input } from 'src/lib/wagmi/components/web3-input'
import { Checker } from 'src/lib/wagmi/systems/Checker'
import { waitForSuccessfulReceipt } from 'src/lib/wagmi/transactions/wait-for-successful-receipt'
import { useSwitchChain } from 'src/lib/wallet'
import { type EvmAddress, EvmToken } from 'sushi/evm'
import { erc20Abi, formatUnits, maxUint256, parseUnits } from 'viem'
import {
  useConnection,
  usePublicClient,
  useSendTransaction,
  useWriteContract,
} from 'wagmi'
import type { LaunchChainConfig } from '../config'
import { getLaunchStatus } from '../launch'
import { getPublicRpcUrl } from '../rpc'
import type { LaunchPoolDetail, LaunchPoolToken } from '../types'

interface ParticipateCardProps {
  config: LaunchChainConfig
  pool: LaunchPoolDetail
  projectToken: LaunchPoolToken
  reserveToken: LaunchPoolToken
}

interface LaunchQuote {
  amountInRaw: bigint
  call: SwapBuildOutputExactIn
  expectedOutRaw: bigint
}

export function ParticipateCard({
  config,
  pool,
  projectToken,
  reserveToken,
}: ParticipateCardProps) {
  const reserveCurrency = useMemo(
    () =>
      new EvmToken({
        address: reserveToken.address,
        chainId: config.chainId,
        decimals: reserveToken.decimals,
        name: reserveToken.name,
        symbol: reserveToken.symbol,
      }),
    [config.chainId, reserveToken],
  )
  const projectCurrency = useMemo(
    () =>
      new EvmToken({
        address: projectToken.address,
        chainId: config.chainId,
        decimals: projectToken.decimals,
        name: projectToken.name,
        symbol: projectToken.symbol,
      }),
    [config.chainId, projectToken],
  )
  const [payCurrency, setPayCurrency] =
    useState<CurrencyFor<LaunchChainConfig['chainId']>>(reserveCurrency)
  const [amount, setAmount] = useState('')
  const [quote, setQuote] = useState<LaunchQuote>()
  const [isQuoting, setIsQuoting] = useState(false)
  const [isBuying, setIsBuying] = useState(false)
  const [error, setError] = useState<string>()
  const [transactionHash, setTransactionHash] = useState<`0x${string}`>()

  const { address: account, chainId: connectedChainId } = useConnection()
  const publicClient = usePublicClient({ chainId: config.chainId })
  const { mutateAsync: sendTransactionAsync } = useSendTransaction()
  const { mutateAsync: writeContractAsync } = useWriteContract()
  const { mutateAsync: switchChainAsync } = useSwitchChain()
  const status = getLaunchStatus(
    pool.lbpParams.startTime,
    pool.lbpParams.endTime,
  )
  const canBuy =
    status === 'live' &&
    pool.dynamicData.swapEnabled &&
    !pool.dynamicData.isPaused
  const isReserveTokenSelected =
    payCurrency.wrap().address.toLowerCase() ===
    reserveCurrency.address.toLowerCase()
  const expectedOutput = quote
    ? formatUnits(quote.expectedOutRaw, projectToken.decimals)
    : ''

  function updateAmount(value: string): void {
    setAmount(value)
    setQuote(undefined)
    setTransactionHash(undefined)
    setError(undefined)
  }

  function updatePayCurrency(
    currency: CurrencyFor<LaunchChainConfig['chainId']>,
  ): void {
    setPayCurrency(currency)
    updateAmount('')
  }

  async function getQuote(): Promise<void> {
    setError(undefined)
    setIsQuoting(true)
    try {
      if (!isReserveTokenSelected) {
        throw new Error(`Buying with ${payCurrency.symbol} is coming soon`)
      }
      const amountInRaw = parseUnits(amount, reserveToken.decimals)
      if (amountInRaw <= 0n) throw new Error('Enter an amount to buy with')

      const swap = new Swap({
        chainId: config.chainId,
        paths: [
          {
            inputAmountRaw: amountInRaw,
            outputAmountRaw: 0n,
            pools: [pool.address],
            protocolVersion: 3,
            tokens: [
              {
                address: reserveToken.address,
                decimals: reserveToken.decimals,
              },
              {
                address: projectToken.address,
                decimals: projectToken.decimals,
              },
            ],
          },
        ],
        swapKind: SwapKind.GivenIn,
      })
      const queryOutput = await swap.query(getPublicRpcUrl(config.chainId))
      if (queryOutput.swapKind !== SwapKind.GivenIn) {
        throw new Error('Unexpected quote type')
      }
      const call = swap.buildCall({
        deadline: BigInt(Math.floor(Date.now() / 1000) + 20 * 60),
        queryOutput,
        slippage: Slippage.fromPercentage('1'),
        wethIsEth: false,
      }) as SwapBuildOutputExactIn

      setQuote({
        amountInRaw,
        call,
        expectedOutRaw: queryOutput.expectedAmountOut.amount,
      })
    } catch (caught: unknown) {
      setQuote(undefined)
      setError(
        caught instanceof Error ? caught.message : 'Could not get a quote',
      )
    } finally {
      setIsQuoting(false)
    }
  }

  async function ensureApproval(amountInRaw: bigint): Promise<void> {
    if (!publicClient || !account) {
      throw new Error('Connect your wallet to continue')
    }
    const permit2 = PERMIT2[config.chainId]
    if (!permit2) throw new Error('Permit2 is unavailable on this network')
    const router = AddressProvider.Router(config.chainId as BalancerChainId)

    const tokenAllowance = await publicClient.readContract({
      abi: erc20Abi,
      address: reserveToken.address,
      args: [account, permit2],
      functionName: 'allowance',
    })
    if (tokenAllowance < amountInRaw) {
      const hash = await writeContractAsync({
        abi: erc20Abi,
        account,
        address: reserveToken.address,
        args: [permit2, maxUint256],
        chainId: config.chainId,
        functionName: 'approve',
      })
      await waitForSuccessfulReceipt(publicClient, hash)
    }

    const [permitAmount, expiration] = await publicClient.readContract({
      abi: permit2Abi,
      address: permit2,
      args: [account, reserveToken.address, router],
      functionName: 'allowance',
    })
    if (
      permitAmount < amountInRaw ||
      expiration <= BigInt(Math.floor(Date.now() / 1000))
    ) {
      if (amountInRaw > MaxUint160) throw new Error('Buy amount is too large')
      const hash = await writeContractAsync({
        abi: permit2Abi,
        account,
        address: permit2,
        args: [
          reserveToken.address,
          router,
          amountInRaw,
          Math.floor(Date.now() / 1000) + 3 * 86_400,
        ],
        chainId: config.chainId,
        functionName: 'approve',
      })
      await waitForSuccessfulReceipt(publicClient, hash)
    }
  }

  async function buy(): Promise<void> {
    setError(undefined)
    if (!quote) return
    try {
      if (!account) throw new Error('Connect your wallet to continue')
      if (connectedChainId !== config.chainId) {
        await switchChainAsync({ chainId: config.chainId })
        return
      }
      if (!publicClient) throw new Error('Wallet is not ready')

      setIsBuying(true)
      await ensureApproval(quote.amountInRaw)
      const hash = await sendTransactionAsync({
        account,
        chainId: config.chainId,
        data: quote.call.callData,
        to: quote.call.to,
        value: quote.call.value,
      })
      await waitForSuccessfulReceipt(publicClient, hash)
      setTransactionHash(hash)
      setQuote(undefined)
      setAmount('')
    } catch (caught: unknown) {
      setError(caught instanceof Error ? caught.message : 'Purchase failed')
    } finally {
      setIsBuying(false)
    }
  }

  return (
    <Card className="p-5 md:p-6">
      <h2 className="text-xl font-semibold">Buy ${projectToken.symbol}</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        {status === 'live'
          ? 'Choose how much you want to buy.'
          : status === 'upcoming'
            ? 'This sale has not opened yet.'
            : 'This sale has ended.'}
      </p>

      <div className="mt-6">
        <Web3Input.Currency
          allowNative
          chainId={config.chainId}
          className="rounded-xl border border-accent bg-white p-3 dark:bg-slate-800"
          currency={payCurrency}
          disabled={!canBuy}
          id="launch-buy-from"
          label="Sell"
          onChange={updateAmount}
          onSelect={updatePayCurrency}
          type="INPUT"
          value={amount}
        />
        <div className="relative z-10 -my-3 flex justify-center">
          <div className="flex h-9 w-9 items-center justify-center rounded-full border-4 border-background bg-muted text-muted-foreground">
            <ArrowDownIcon className="h-4 w-4" />
          </div>
        </div>
        <Web3Input.Currency
          chainId={config.chainId}
          className="rounded-xl border border-accent bg-white p-3 dark:bg-slate-800"
          currency={projectCurrency}
          disableMaxButton
          disabled
          hidePricing
          id="launch-buy-to"
          label="Buy"
          type="OUTPUT"
          value={expectedOutput}
        />
      </div>

      {!isReserveTokenSelected ? (
        <p className="mt-3 rounded-xl bg-blue/10 p-3 text-sm text-blue">
          Buying with {payCurrency.symbol} is coming soon. Select{' '}
          {reserveToken.symbol} to join this launch.
        </p>
      ) : null}
      {quote ? (
        <div className="mt-3 flex justify-between text-xs text-muted-foreground">
          <span>Expected received</span>
          <span>
            {Number(expectedOutput).toLocaleString(undefined, {
              maximumSignificantDigits: 8,
            })}{' '}
            {projectToken.symbol}
          </span>
        </div>
      ) : null}
      <p className="mt-2 text-xs text-muted-foreground">1% max slippage</p>

      {error ? (
        <p className="mt-4 rounded-xl bg-red/10 p-3 text-sm text-red">
          {error}
        </p>
      ) : null}
      {transactionHash ? (
        <p className="mt-4 rounded-xl bg-green/10 p-3 text-sm text-green">
          Purchase confirmed. Your {projectToken.symbol} is in your wallet.
        </p>
      ) : null}

      {!canBuy ? (
        <Button className="mt-5" disabled fullWidth size="xl">
          {status === 'upcoming'
            ? 'Sale has not started'
            : status === 'ended'
              ? 'Sale ended'
              : 'Trading is paused'}
        </Button>
      ) : !isReserveTokenSelected ? (
        <Button className="mt-5" disabled fullWidth size="xl">
          {payCurrency.symbol} buys coming soon
        </Button>
      ) : quote ? (
        <Checker.Connect
          className="mt-5"
          fullWidth
          size="xl"
          variant="sushi-gradient"
        >
          <Button
            className="mt-5"
            fullWidth
            loading={isBuying}
            onClick={() => void buy()}
            size="xl"
            variant="sushi-gradient"
          >
            {account && connectedChainId !== config.chainId
              ? 'Switch network'
              : `Buy ${projectToken.symbol}`}
          </Button>
        </Checker.Connect>
      ) : (
        <Button
          className="mt-5"
          disabled={Number(amount) <= 0}
          fullWidth
          loading={isQuoting}
          onClick={() => void getQuote()}
          size="xl"
        >
          Preview purchase
        </Button>
      )}
    </Card>
  )
}
