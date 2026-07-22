import { parseUnits } from 'viem'

import {
  LAUNCH_END_PROJECT_WEIGHT,
  LAUNCH_START_PROJECT_WEIGHT,
} from './config'
import type { LaunchPricePoint } from './types'

export type LaunchStatus = 'upcoming' | 'live' | 'ended'

export function getLaunchStatus(
  startTime: number,
  endTime: number,
  now = Date.now() / 1000,
): LaunchStatus {
  if (now < startTime) return 'upcoming'
  if (now < endTime) return 'live'
  return 'ended'
}

export function getLaunchProgress(
  startTime: number,
  endTime: number,
  now = Date.now() / 1000,
): number {
  if (endTime <= startTime) return 0
  return Math.min(1, Math.max(0, (now - startTime) / (endTime - startTime)))
}

export function getProjectWeightAt(
  startTime: number,
  endTime: number,
  now = Date.now() / 1000,
): number {
  return getLinearWeightAt({
    endTime,
    endWeight: LAUNCH_END_PROJECT_WEIGHT,
    now,
    startTime,
    startWeight: LAUNCH_START_PROJECT_WEIGHT,
  })
}

export function getLinearWeightAt({
  endTime,
  endWeight,
  now = Date.now() / 1000,
  startTime,
  startWeight,
}: {
  endTime: number
  endWeight: number
  now?: number
  startTime: number
  startWeight: number
}): number {
  const progress = getLaunchProgress(startTime, endTime, now)
  return startWeight + (endWeight - startWeight) * progress
}

export function calculateVirtualReserveRaw({
  initialPrice,
  projectAmountRaw,
  projectTokenDecimals,
  reserveTokenDecimals,
}: {
  initialPrice: string
  projectAmountRaw: bigint
  projectTokenDecimals: number
  reserveTokenDecimals: number
}): bigint {
  const priceRaw = parseUnits(initialPrice, reserveTokenDecimals)
  const projectScale = 10n ** BigInt(projectTokenDecimals)
  const startWeightRatio =
    BigInt(LAUNCH_START_PROJECT_WEIGHT) /
    BigInt(100 - LAUNCH_START_PROJECT_WEIGHT)

  return (priceRaw * projectAmountRaw) / (projectScale * startWeightRatio)
}

export function getNoTradeEndPrice(initialPrice: number): number {
  const startRatio =
    LAUNCH_START_PROJECT_WEIGHT / (100 - LAUNCH_START_PROJECT_WEIGHT)
  const endRatio = LAUNCH_END_PROJECT_WEIGHT / (100 - LAUNCH_END_PROJECT_WEIGHT)
  return initialPrice * (endRatio / startRatio)
}

export function getCurrentPrice({
  projectBalance,
  reserveBalance,
  virtualReserveBalance,
  projectWeight,
}: {
  projectBalance: number
  reserveBalance: number
  virtualReserveBalance: number
  projectWeight: number
}): number | undefined {
  if (projectBalance <= 0 || projectWeight <= 0 || projectWeight >= 1) {
    return undefined
  }

  return (
    ((reserveBalance + virtualReserveBalance) / projectBalance) *
    (projectWeight / (1 - projectWeight))
  )
}

export function getLaunchPriceUsd(
  point: LaunchPricePoint,
  reservePriceFallback = 1,
): number {
  return point.projectTokenPrice * (point.reservePrice || reservePriceFallback)
}

export function getLaunchPriceAt(
  points: LaunchPricePoint[],
  timestamp = Date.now() / 1000,
  reservePriceFallback = 1,
): number | undefined {
  if (points.length === 0) return undefined

  let currentPoint = points[0]
  for (const point of points) {
    if (point.timestamp > timestamp) break
    currentPoint = point
  }

  return getLaunchPriceUsd(currentPoint, reservePriceFallback)
}

export function getLaunchAthPrice(
  points: LaunchPricePoint[],
  timestamp = Date.now() / 1000,
  reservePriceFallback = 1,
): number | undefined {
  if (points.length === 0) return undefined
  const elapsedPoints = points.filter((point) => point.timestamp <= timestamp)
  const relevantPoints = elapsedPoints.length > 0 ? elapsedPoints : [points[0]]

  return Math.max(
    ...relevantPoints.map((point) =>
      getLaunchPriceUsd(point, reservePriceFallback),
    ),
  )
}
