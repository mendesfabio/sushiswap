'use client'

import { Card } from '@sushiswap/ui'
import type { EChartOption } from 'echarts'
import ReactEChartsCore from 'echarts-for-react/lib/core'
import { LineChart } from 'echarts/charts'
import { GridComponent, TooltipComponent } from 'echarts/components'
import * as echarts from 'echarts/core'
import { CanvasRenderer } from 'echarts/renderers'
import { useMemo } from 'react'
import { getLaunchPriceUsd } from '../launch'
import type { LaunchPricePoint } from '../types'

echarts.use([CanvasRenderer, GridComponent, LineChart, TooltipComponent])

interface LaunchPriceChartProps {
  currentPrice?: number
  cutTimestamp: number
  points: LaunchPricePoint[]
  reservePriceFallback: number
  symbol: string
}

function formatPrice(value?: number): string {
  if (value === undefined || !Number.isFinite(value)) return '—'
  if (value === 0) return '$0.00'
  if (value < 0.01) {
    return `$${value.toLocaleString('en-US', {
      maximumSignificantDigits: 5,
      useGrouping: false,
    })}`
  }
  return new Intl.NumberFormat('en-US', {
    currency: 'USD',
    maximumFractionDigits: 4,
    notation: value >= 10_000 ? 'compact' : 'standard',
    style: 'currency',
  }).format(value)
}

function formatDate(timestamp: number): string {
  return new Intl.DateTimeFormat('en-US', {
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    month: 'short',
  }).format(new Date(timestamp))
}

export function LaunchPriceChart({
  currentPrice,
  cutTimestamp,
  points,
  reservePriceFallback,
  symbol,
}: LaunchPriceChartProps) {
  const option = useMemo<EChartOption>(() => {
    const past: [number, number][] = []
    const projected: [number, number][] = []

    for (const point of points) {
      const value: [number, number] = [
        point.timestamp * 1000,
        getLaunchPriceUsd(point, reservePriceFallback),
      ]
      if (point.timestamp <= cutTimestamp) past.push(value)
      else projected.push(value)
    }
    if (past.length > 0 && projected.length > 0) {
      projected.unshift(past[past.length - 1])
    }

    return {
      animation: false,
      grid: { bottom: 30, left: 70, right: 18, top: 18 },
      tooltip: {
        axisPointer: { lineStyle: { color: '#94a3b8', type: 'dashed' } },
        backgroundColor: 'rgba(15, 23, 42, 0.92)',
        borderColor: 'rgba(148, 163, 184, 0.25)',
        borderRadius: 12,
        borderWidth: 1,
        formatter: (params): string => {
          const point = Array.isArray(params) ? params[0] : params
          if (!point || !Array.isArray(point.value)) return ''
          const timestamp = Number(point.value[0])
          const price = Number(point.value[1])
          if (!Number.isFinite(timestamp) || !Number.isFinite(price)) return ''
          return `<div style="padding: 2px 4px"><strong style="color:#fff">${formatPrice(price)}</strong><br/><span style="color:#94a3b8;font-size:12px">${formatDate(timestamp)}</span></div>`
        },
        trigger: 'axis',
      },
      xAxis: {
        axisLabel: {
          color: '#94a3b8',
          formatter: (value: number) =>
            new Intl.DateTimeFormat('en-US', {
              day: 'numeric',
              month: 'short',
            }).format(new Date(value)),
          fontSize: 11,
        },
        axisLine: { lineStyle: { color: 'rgba(148,163,184,0.2)' } },
        axisTick: { show: false },
        min: points[0]?.timestamp ? points[0].timestamp * 1000 : undefined,
        max: points.at(-1)?.timestamp
          ? (points.at(-1)?.timestamp ?? 0) * 1000
          : undefined,
        splitLine: { show: false },
        type: 'time',
      },
      yAxis: {
        axisLabel: {
          color: '#94a3b8',
          formatter: (value: number) => formatPrice(value),
          fontSize: 11,
        },
        axisLine: { show: false },
        axisTick: { show: false },
        scale: true,
        splitLine: {
          lineStyle: { color: 'rgba(148,163,184,0.12)', type: 'dashed' },
        },
        type: 'value',
      },
      series: [
        {
          areaStyle: {
            color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
              { color: 'rgba(250, 82, 160, 0.28)', offset: 0 },
              { color: 'rgba(73, 161, 219, 0)', offset: 1 },
            ]),
          },
          data: past,
          lineStyle: {
            color: new echarts.graphic.LinearGradient(0, 0, 1, 0, [
              { color: '#49A1DB', offset: 0 },
              { color: '#FA52A0', offset: 1 },
            ]),
            width: 3,
          },
          name: 'Spot price',
          showSymbol: false,
          type: 'line',
        },
        {
          data: projected,
          lineStyle: { color: '#94a3b8', type: 'dashed', width: 2 },
          name: 'Projected price',
          showSymbol: false,
          type: 'line',
        },
      ],
    }
  }, [cutTimestamp, points, reservePriceFallback])

  return (
    <Card className="p-5 md:p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold">Price curve</h2>
          <p className="mt-1 text-sm text-muted-foreground">${symbol} / USD</p>
        </div>
        <div className="text-right">
          <p className="text-xl font-semibold">{formatPrice(currentPrice)}</p>
          <p className="text-xs text-muted-foreground">Current price</p>
        </div>
      </div>

      {points.length > 0 ? (
        <ReactEChartsCore
          className="mt-4 h-[280px] w-full"
          echarts={echarts}
          option={option}
          opts={{ renderer: 'canvas' }}
        />
      ) : (
        <div className="mt-4 flex h-[280px] items-center justify-center rounded-xl bg-muted/40 text-sm text-muted-foreground">
          Price data will appear when the launch is indexed.
        </div>
      )}

      <div className="mt-3 flex flex-wrap items-center gap-5 text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-2">
          <span className="h-0.5 w-5 bg-pink" /> Spot price
        </span>
        <span className="inline-flex items-center gap-2">
          <span className="w-5 border-t-2 border-dashed border-muted-foreground" />
          Projected with no buys
        </span>
      </div>
    </Card>
  )
}
