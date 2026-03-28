'use client'
import { LineChart, Line, ResponsiveContainer, Tooltip } from 'recharts'

interface SparklineChartProps {
  data: number[]
  positive?: boolean
  height?: number
}

export function SparklineChart({ data, positive = true, height = 48 }: SparklineChartProps) {
  if (!data || data.length < 2) {
    return <div style={{ height }} className="w-full rounded bg-angora-surface/30" />
  }

  const chartData = data.map((value, index) => ({ index, value }))
  const color = positive ? '#34D399' : '#F87171'

  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={chartData}>
        <Line
          type="monotone"
          dataKey="value"
          stroke={color}
          strokeWidth={1.5}
          dot={false}
          isAnimationActive={false}
        />
        <Tooltip
          content={({ active, payload }) => {
            if (!active || !payload?.length) return null
            return (
              <div className="px-2 py-1 rounded bg-angora-card border border-angora-border text-xs text-white font-mono">
                ${Number(payload[0].value).toLocaleString(undefined, { maximumFractionDigits: 2 })}
              </div>
            )
          }}
        />
      </LineChart>
    </ResponsiveContainer>
  )
}
