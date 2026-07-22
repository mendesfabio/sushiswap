#!/usr/bin/env node

const isPerpsDisabled = process.env.NEXT_PUBLIC_DISABLE_PERPS === 'true'

if (isPerpsDisabled) {
  console.log('Skipping TradingView token check because Perps is disabled')
  process.exit(0)
}

if (!process.env.TRADING_VIEW_GH_READ_TOKEN) {
  console.error('TRADING_VIEW_GH_READ_TOKEN is required')
  process.exit(1)
}
