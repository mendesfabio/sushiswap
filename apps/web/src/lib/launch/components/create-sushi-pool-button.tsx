'use client'

import {
  Button,
  Chip,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuTrigger,
  SelectIcon,
  buttonVariants,
} from '@sushiswap/ui'
import Link from 'next/link'
import {
  type EvmAddress,
  type EvmChainId,
  isSushiSwapV2ChainId,
  isSushiSwapV3ChainId,
} from 'sushi/evm'

interface CreateSushiPoolButtonProps {
  chainId: EvmChainId
  chainKey: string
  projectToken: EvmAddress
  reserveToken: EvmAddress
}

export function CreateSushiPoolButton({
  chainId,
  chainKey,
  projectToken,
  reserveToken,
}: CreateSushiPoolButtonProps) {
  const supportsV3 = isSushiSwapV3ChainId(chainId)
  const supportsV2 = isSushiSwapV2ChainId(chainId)
  const pairQuery = new URLSearchParams({
    fromCurrency: projectToken,
    toCurrency: reserveToken,
  }).toString()
  const v3Href = `/${chainKey}/pool/v3/add?${pairQuery}`
  const v2Href = `/${chainKey}/pool/v2/add?${pairQuery}`
  const primaryHref = supportsV3
    ? v3Href
    : supportsV2
      ? v2Href
      : `/${chainKey}/pool`

  return (
    <div className="mt-5 flex items-center">
      <Link
        className={buttonVariants({
          className: 'rounded-r-none',
          variant: 'sushi-gradient',
        })}
        href={primaryHref}
      >
        Create Sushi pool
      </Link>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            aria-label="Choose pool type"
            className="rounded-l-none border-l border-white/20 px-3"
            variant="sushi-gradient"
          >
            <SelectIcon />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-80">
          <DropdownMenuGroup>
            <DropdownMenuItem disabled={!supportsV3} asChild>
              <Link
                className="flex cursor-pointer flex-col !items-start gap-1"
                href={v3Href}
              >
                <div className="flex items-center gap-2 font-medium leading-none">
                  V3 Position
                  <Chip variant="secondary">
                    {supportsV3 ? 'Recommended' : 'Unavailable'}
                  </Chip>
                </div>
                <p className="text-sm leading-snug text-muted-foreground">
                  Create concentrated liquidity around the discovered price.
                </p>
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem disabled={!supportsV2} asChild>
              <Link
                className="flex cursor-pointer flex-col !items-start gap-1"
                href={v2Href}
              >
                <div className="flex items-center gap-2 font-medium leading-none">
                  V2 Position
                  {!supportsV2 ? (
                    <Chip variant="secondary">Unavailable</Chip>
                  ) : null}
                </div>
                <p className="text-sm leading-snug text-muted-foreground">
                  Create a classic full-range liquidity position.
                </p>
              </Link>
            </DropdownMenuItem>
          </DropdownMenuGroup>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )
}
