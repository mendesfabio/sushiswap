import { describe, expect, it } from 'vitest'

import {
  calculateVirtualReserveRaw,
  getLaunchAthPrice,
  getLaunchPriceAt,
  getLaunchProgress,
  getLaunchStatus,
  getLinearWeightAt,
  getNoTradeEndPrice,
  getProjectWeightAt,
} from './launch'

describe('Launch auction math', () => {
  it('creates the seedless virtual reserve for a 90/10 opening weight', () => {
    expect(
      calculateVirtualReserveRaw({
        initialPrice: '9',
        projectAmountRaw: 1_000n * 10n ** 18n,
        projectTokenDecimals: 18,
        reserveTokenDecimals: 6,
      }),
    ).toBe(1_000n * 10n ** 6n)
  })

  it('projects a 9x no-trade price decay from 90/10 to 50/50', () => {
    expect(getNoTradeEndPrice(9)).toBe(1)
  })

  it('tracks status, progress, and the linear weight shift', () => {
    expect(getLaunchStatus(100, 200, 50)).toBe('upcoming')
    expect(getLaunchStatus(100, 200, 150)).toBe('live')
    expect(getLaunchStatus(100, 200, 250)).toBe('ended')
    expect(getLaunchProgress(100, 200, 150)).toBe(0.5)
    expect(getProjectWeightAt(100, 200, 150)).toBe(70)
    expect(
      getLinearWeightAt({
        endTime: 200,
        endWeight: 10,
        now: 150,
        startTime: 100,
        startWeight: 98,
      }),
    ).toBe(54)
  })

  it('tracks current and all-time-high launch prices without using future points', () => {
    const points = [
      { projectTokenPrice: 2, reservePrice: 1, timestamp: 100 },
      { projectTokenPrice: 3, reservePrice: 1, timestamp: 200 },
      { projectTokenPrice: 1, reservePrice: 1, timestamp: 300 },
    ]

    expect(getLaunchPriceAt(points, 250)).toBe(3)
    expect(getLaunchAthPrice(points, 250)).toBe(3)
    expect(getLaunchAthPrice(points, 150)).toBe(2)
  })
})
