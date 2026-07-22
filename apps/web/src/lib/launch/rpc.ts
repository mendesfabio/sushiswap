import { publicTransports } from 'src/lib/wagmi/config/viem'
import { type EvmChainId, getEvmChainById } from 'sushi/evm'

export function getPublicRpcUrl(chainId: EvmChainId): string {
  const transport = publicTransports[chainId]
  if (!transport)
    throw new Error(`No public RPC configured for chain ${chainId}`)
  const url = transport({ chain: undefined }).value?.url
  if (!url || url.includes('dkey=undefined')) {
    const fallbackUrl =
      getEvmChainById(chainId).viemChain.rpcUrls.default.http[0]
    if (fallbackUrl) return fallbackUrl
    throw new Error(`No public RPC configured for chain ${chainId}`)
  }
  return url
}
