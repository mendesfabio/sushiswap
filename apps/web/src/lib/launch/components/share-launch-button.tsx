import { ShareIcon } from '@heroicons/react/24/outline'
import { buttonVariants } from '@sushiswap/ui'

interface ShareLaunchButtonProps {
  address: string
  chainKey: string
  name: string
  symbol: string
}

export function ShareLaunchButton({
  address,
  chainKey,
  name,
  symbol,
}: ShareLaunchButtonProps) {
  const launchUrl = `https://www.sushi.com/${chainKey}/launch/${address}`
  const intentUrl = new URL('https://x.com/intent/post')
  intentUrl.searchParams.set(
    'text',
    `${name} ($${symbol}) on Sushi Launch ${launchUrl}`,
  )

  return (
    <a
      className={buttonVariants({ size: 'sm', variant: 'secondary' })}
      href={intentUrl.toString()}
      rel="noreferrer"
      target="_blank"
    >
      <ShareIcon className="h-4 w-4 shrink-0" />
      <span>Share</span>
    </a>
  )
}
