import { NextResponse } from 'next/server'
import { isAddress } from 'viem'
import { z } from 'zod'

const BALANCER_API_URL =
  process.env.BALANCER_API_URL ?? 'https://api-v3.balancer.fi/graphql'

const publicUrlSchema = z
  .string()
  .url()
  .refine((value) => ['http:', 'https:'].includes(new URL(value).protocol))

const metadataSchema = z.object({
  address: z.string().refine(isAddress),
  chain: z.enum([
    'MAINNET',
    'ARBITRUM',
    'BASE',
    'GNOSIS',
    'AVALANCHE',
    'OPTIMISM',
    'SONIC',
    'HYPEREVM',
    'SEPOLIA',
  ]),
  description: z.string().max(1_000).optional(),
  discord: publicUrlSchema.optional().or(z.literal('')),
  name: z.string().min(1).max(100),
  website: publicUrlSchema.optional().or(z.literal('')),
  x: z.string().max(50).optional(),
})

export async function POST(request: Request) {
  const parsed = metadataSchema.safeParse(
    await request.json().catch(() => undefined),
  )
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid launch metadata' },
      { status: 400 },
    )
  }

  const { address, chain, description, discord, name, website, x } = parsed.data
  const response = await fetch(BALANCER_API_URL, {
    body: JSON.stringify({
      query: `mutation CreateSushiLBP($input: CreateLBPInput!, $type: GqlPoolType) {
        createLBP(input: $input, type: $type)
      }`,
      variables: {
        input: {
          metadata: {
            description: description || undefined,
            discord: discord || undefined,
            lbpName: name,
            website: website || undefined,
            x: x?.replace(/^@/, '') || undefined,
          },
          poolContract: { address, chain },
        },
        type: 'LIQUIDITY_BOOTSTRAPPING',
      },
    }),
    headers: { 'content-type': 'application/json' },
    method: 'POST',
  })

  const result = (await response.json()) as {
    data?: { createLBP?: boolean }
    errors?: { message: string }[]
  }
  if (!response.ok || result.errors?.length || !result.data?.createLBP) {
    return NextResponse.json(
      { error: result.errors?.[0]?.message ?? 'Could not save metadata' },
      { status: 502 },
    )
  }

  return NextResponse.json({ saved: true })
}
