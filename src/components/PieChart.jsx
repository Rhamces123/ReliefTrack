import { useState } from 'react'
import '../styles/PieChart.css'

const DEFAULT_COLORS = [
  '#1674D1', // Bright Blue
  '#39A935', // Green
  '#F59E0B', // Amber / Warning
  '#8B5CF6', // Purple
  '#14B8A6', // Teal
  '#EC4899', // Pink
  '#DC2626', // Red
  '#64748B', // Slate
]

function polarToCartesian(cx, cy, radius, angleInDegrees) {
  const rad = ((angleInDegrees - 90) * Math.PI) / 180.0
  return {
    x: cx + radius * Math.cos(rad),
    y: cy + radius * Math.sin(rad),
  }
}

export default function PieChart({
  title,
  subtitle,
  data = [],
  totalLabel = 'Total',
  donut = true,
  size = 200,
  emptyMessage = 'No data available',
  loading = false,
  className = '',
}) {
  const [hoveredIndex, setHoveredIndex] = useState(null)

  // Filter items with positive count
  const validItems = data.filter((item) => Number(item.value) > 0)
  const total = validItems.reduce((sum, item) => sum + Number(item.value), 0)

  // Geometry
  const cx = 100
  const cy = 100
  const outerRadius = 85
  const innerRadius = donut ? 52 : 0

  // Calculate slice angles
  let currentAngle = 0
  const slices = validItems.map((item, idx) => {
    const val = Number(item.value)
    const angle = total > 0 ? (val / total) * 360 : 0
    const startAngle = currentAngle
    const endAngle = currentAngle + angle
    currentAngle = endAngle
    const percentage = total > 0 ? ((val / total) * 100).toFixed(1) : '0.0'
    const color = item.color || DEFAULT_COLORS[idx % DEFAULT_COLORS.length]
    return {
      ...item,
      value: val,
      percentage,
      color,
      startAngle,
      endAngle,
      index: idx,
    }
  })

  const hoveredSlice = hoveredIndex !== null ? slices[hoveredIndex] : null

  return (
    <div className={`rt-pie-card ${className}`}>
      {title && (
        <div className="rt-pie-header">
          <div>
            <h4 className="rt-pie-title">{title}</h4>
            {subtitle && <p className="rt-pie-subtitle">{subtitle}</p>}
          </div>
          {total > 0 && (
            <span className="rt-pie-total-badge">
              {total} {totalLabel}
            </span>
          )}
        </div>
      )}

      {loading ? (
        <div className="rt-pie-empty">
          <div className="rt-pie-spinner" />
          <span>Loading chart...</span>
        </div>
      ) : total === 0 ? (
        <div className="rt-pie-empty">
          <svg viewBox="0 0 200 200" width={size * 0.7} height={size * 0.7}>
            <circle
              cx={cx}
              cy={cy}
              r={donut ? (outerRadius + innerRadius) / 2 : outerRadius}
              stroke="#CBD5E1"
              strokeWidth={donut ? outerRadius - innerRadius : 2}
              strokeDasharray="4 4"
              fill="none"
            />
          </svg>
          <p className="rt-pie-empty-text">{emptyMessage}</p>
        </div>
      ) : (
        <div className="rt-pie-body">
          <div className="rt-pie-svg-wrap" style={{ width: size, height: size }}>
            <svg
              viewBox="0 0 200 200"
              className="rt-pie-svg"
              role="img"
              aria-label={title || 'Pie Chart'}
            >
              {slices.length === 1 ? (
                // Single 100% slice edge case
                <circle
                  cx={cx}
                  cy={cy}
                  r={donut ? (outerRadius + innerRadius) / 2 : outerRadius}
                  stroke={slices[0].color}
                  strokeWidth={donut ? outerRadius - innerRadius : 0}
                  fill={donut ? 'none' : slices[0].color}
                  className={`rt-pie-slice ${hoveredIndex === 0 ? 'hovered' : ''}`}
                  onMouseEnter={() => setHoveredIndex(0)}
                  onMouseLeave={() => setHoveredIndex(null)}
                />
              ) : (
                slices.map((slice) => {
                  const pOuterStart = polarToCartesian(cx, cy, outerRadius, slice.startAngle)
                  const pOuterEnd = polarToCartesian(cx, cy, outerRadius, slice.endAngle)
                  const pInnerEnd = polarToCartesian(cx, cy, innerRadius, slice.endAngle)
                  const pInnerStart = polarToCartesian(cx, cy, innerRadius, slice.startAngle)
                  const largeArc = slice.endAngle - slice.startAngle > 180 ? 1 : 0

                  const pathD = donut
                    ? [
                        `M ${pOuterStart.x} ${pOuterStart.y}`,
                        `A ${outerRadius} ${outerRadius} 0 ${largeArc} 1 ${pOuterEnd.x} ${pOuterEnd.y}`,
                        `L ${pInnerEnd.x} ${pInnerEnd.y}`,
                        `A ${innerRadius} ${innerRadius} 0 ${largeArc} 0 ${pInnerStart.x} ${pInnerStart.y}`,
                        'Z',
                      ].join(' ')
                    : [
                        `M ${cx} ${cy}`,
                        `L ${pOuterStart.x} ${pOuterStart.y}`,
                        `A ${outerRadius} ${outerRadius} 0 ${largeArc} 1 ${pOuterEnd.x} ${pOuterEnd.y}`,
                        'Z',
                      ].join(' ')

                  const isHovered = hoveredIndex === slice.index

                  return (
                    <path
                      key={slice.label || slice.index}
                      d={pathD}
                      fill={slice.color}
                      stroke="#FFFFFF"
                      strokeWidth="2.5"
                      strokeLinejoin="round"
                      className={`rt-pie-slice ${isHovered ? 'hovered' : ''}`}
                      onMouseEnter={() => setHoveredIndex(slice.index)}
                      onMouseLeave={() => setHoveredIndex(null)}
                    >
                      <title>{`${slice.label}: ${slice.value} (${slice.percentage}%)`}</title>
                    </path>
                  )
                })
              )}

              {/* Donut center display */}
              {donut && (
                <g className="rt-pie-center-group" pointerEvents="none">
                  <text
                    x={cx}
                    y={hoveredSlice ? cy - 6 : cy + 2}
                    textAnchor="middle"
                    className="rt-pie-center-value"
                  >
                    {hoveredSlice ? hoveredSlice.value : total}
                  </text>
                  <text
                    x={cx}
                    y={hoveredSlice ? cy + 12 : cy + 18}
                    textAnchor="middle"
                    className="rt-pie-center-label"
                  >
                    {hoveredSlice ? hoveredSlice.label : totalLabel}
                  </text>
                  {hoveredSlice && (
                    <text
                      x={cx}
                      y={cy + 26}
                      textAnchor="middle"
                      className="rt-pie-center-percent"
                    >
                      {hoveredSlice.percentage}%
                    </text>
                  )}
                </g>
              )}
            </svg>
          </div>

          {/* Legend */}
          <div className="rt-pie-legend">
            {slices.map((slice) => {
              const isHovered = hoveredIndex === slice.index
              return (
                <div
                  key={slice.label}
                  className={`rt-pie-legend-item ${isHovered ? 'hovered' : ''}`}
                  onMouseEnter={() => setHoveredIndex(slice.index)}
                  onMouseLeave={() => setHoveredIndex(null)}
                >
                  <span
                    className="rt-pie-legend-dot"
                    style={{ backgroundColor: slice.color }}
                  />
                  <span className="rt-pie-legend-label">{slice.label}</span>
                  <span className="rt-pie-legend-value">
                    <strong>{slice.value}</strong>
                    <span className="rt-pie-legend-pct">({slice.percentage}%)</span>
                  </span>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
