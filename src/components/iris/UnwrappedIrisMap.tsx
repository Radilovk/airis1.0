import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Eye } from '@phosphor-icons/react'
import type { IrisZone, Artifact } from '@/types'

interface UnwrappedIrisMapProps {
  /** base64 JPEG from method1 backend (mapped/unwrapped image). Optional. */
  mappedImageBase64?: string | null
  zones?: IrisZone[]
  artifacts?: Artifact[]
  side?: 'left' | 'right'
  /** Overall health score 0-100 */
  overallHealth?: number
}

const RINGS = 12
const MINUTES = 60

// Map zone status to fill/stroke colours
const STATUS_STYLE: Record<string, { fill: string; stroke: string }> = {
  normal:    { fill: 'rgba(34,197,94,0.18)',  stroke: 'rgba(34,197,94,0.7)' },
  attention: { fill: 'rgba(234,179,8,0.28)',  stroke: 'rgba(234,179,8,0.85)' },
  concern:   { fill: 'rgba(239,68,68,0.35)',  stroke: 'rgba(239,68,68,0.9)' },
}

const ARTIFACT_COLOR: Record<string, string> = {
  лакуна:          '#f87171',
  крипта:          '#fb923c',
  пигмент:         '#facc15',
  'радиална линия':'#60a5fa',
  'автономен пръстен':'#a78bfa',
}

/**
 * Rectangular "unwrap" visualization of the iris.
 *
 * Coordinate system (matches method1/app.py output):
 *   X-axis = minute  0 – 60  (clockwise from 12 o'clock)
 *   Y-axis = ring    R0 – R11  (R0 = pupil boundary, R11 = outer iris edge)
 *
 * When zones carry `minute_start/end` + `ring_start/end` from the AI they are
 * rendered as coloured rectangles.  Artifacts with `minute` + `ring` fields are
 * drawn as small circles.
 *
 * If a `mappedImageBase64` is supplied (from the method1 Python backend) it is
 * used as the background; otherwise a plain dark background is drawn.
 */
export default function UnwrappedIrisMap({
  mappedImageBase64,
  zones = [],
  artifacts = [],
  side = 'right',
  overallHealth,
}: UnwrappedIrisMapProps) {
  // Canvas logical dimensions (pixels)
  const W = 600
  const H = 150

  // Padding for axis labels
  const PAD_LEFT = 32
  const PAD_TOP = 16
  const PAD_BOTTOM = 24
  const PAD_RIGHT = 8

  const IW = W - PAD_LEFT - PAD_RIGHT   // iris width
  const IH = H - PAD_TOP - PAD_BOTTOM   // iris height

  // Convert minute (0-60) → X pixel inside the plot area
  const mx = (m: number) => PAD_LEFT + (m / MINUTES) * IW
  // Convert ring (0-11) → Y pixel inside the plot area
  const ry = (r: number) => PAD_TOP + (r / RINGS) * IH

  const sideLabel = side === 'left' ? 'Ляв Ирис' : 'Десен Ирис'

  // NASAL / TEMPORAL positions depend on side (matches draw_ai_grid_map_expanded)
  const nasalMinute  = side === 'right' ? 45 : 15
  const temporalMinute = side === 'right' ? 15 : 45

  return (
    <Card className="overflow-hidden">
      <div className="p-4 bg-gradient-to-br from-primary/5 to-accent/5 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary to-accent flex items-center justify-center shadow">
            <Eye size={16} weight="duotone" className="text-primary-foreground" />
          </div>
          <div>
            <h4 className="font-semibold text-sm">Разгъвка – {sideLabel}</h4>
            <p className="text-xs text-muted-foreground">X = минута (0–60) · Y = пръстен (R0–R11)</p>
          </div>
        </div>
        {overallHealth !== undefined && (
          <Badge variant="outline" className="text-xs font-bold">
            {overallHealth}/100
          </Badge>
        )}
      </div>

      <div className="p-4">
        <div className="w-full overflow-x-auto">
          <svg
            viewBox={`0 0 ${W} ${H}`}
            className="w-full border border-border rounded"
            style={{ minWidth: 320, background: '#111' }}
          >
            {/* Background image from method1 backend */}
            {mappedImageBase64 && (
              <image
                href={`data:image/jpeg;base64,${mappedImageBase64}`}
                x={PAD_LEFT}
                y={PAD_TOP}
                width={IW}
                height={IH}
                preserveAspectRatio="none"
              />
            )}

            {/* Grid lines – rings (horizontal) */}
            {Array.from({ length: RINGS + 1 }).map((_, r) => (
              <line
                key={`ring-${r}`}
                x1={PAD_LEFT}
                y1={ry(r)}
                x2={PAD_LEFT + IW}
                y2={ry(r)}
                stroke="rgba(255,255,255,0.15)"
                strokeWidth={r === 0 || r === RINGS ? 1.5 : 0.5}
              />
            ))}

            {/* Grid lines – minutes (vertical) every 5 min */}
            {Array.from({ length: 13 }).map((_, i) => {
              const m = i * 5
              return (
                <line
                  key={`min-${m}`}
                  x1={mx(m)}
                  y1={PAD_TOP}
                  x2={mx(m)}
                  y2={PAD_TOP + IH}
                  stroke="rgba(255,255,255,0.15)"
                  strokeWidth={m === 0 || m === 60 ? 1.5 : 0.5}
                />
              )
            })}

            {/* Zone highlights */}
            {zones.map((z) => {
              if (
                z.minute_start === undefined ||
                z.minute_end   === undefined ||
                z.ring_start   === undefined ||
                z.ring_end     === undefined
              ) return null

              const style = STATUS_STYLE[z.status] ?? STATUS_STYLE.normal
              const x1 = mx(z.minute_start)
              const y1 = ry(z.ring_start)
              const x2 = mx(z.minute_end)
              const y2 = ry(z.ring_end + 1)  // ring_end is inclusive; +1 converts to exclusive upper bound

              return (
                <g key={`zone-${z.id}`}>
                  <rect
                    x={x1}
                    y={y1}
                    width={Math.max(1, x2 - x1)}
                    height={Math.max(1, y2 - y1)}
                    fill={style.fill}
                    stroke={style.stroke}
                    strokeWidth={1}
                    rx={2}
                  />
                </g>
              )
            })}

            {/* Artifact markers */}
            {artifacts.map((a, idx) => {
              if (a.minute === undefined || a.ring === undefined) return null
              const color = ARTIFACT_COLOR[a.type.toLowerCase()] ?? '#e2e8f0'
              return (
                <circle
                  key={`art-${idx}`}
                  cx={mx(a.minute)}
                  cy={ry(a.ring + 0.5)}
                  r={3}
                  fill={color}
                  stroke="rgba(0,0,0,0.5)"
                  strokeWidth={0.5}
                />
              )
            })}

            {/* Ring labels (Y axis) */}
            {Array.from({ length: RINGS }).map((_, r) => (
              <text
                key={`rl-${r}`}
                x={PAD_LEFT - 2}
                y={ry(r) + IH / RINGS / 2 + 3}
                fontSize={6}
                fill="rgba(255,255,255,0.6)"
                textAnchor="end"
              >
                R{r}
              </text>
            ))}

            {/* Minute labels (X axis) every 5 min */}
            {Array.from({ length: 13 }).map((_, i) => {
              const m = i * 5
              return (
                <text
                  key={`ml-${m}`}
                  x={mx(m)}
                  y={PAD_TOP + IH + 10}
                  fontSize={6}
                  fill="rgba(255,255,255,0.6)"
                  textAnchor="middle"
                >
                  {m}
                </text>
              )
            })}

            {/* NASAL / TEMPORAL labels */}
            <text
              x={mx(nasalMinute)}
              y={PAD_TOP + IH + 20}
              fontSize={6}
              fill="#f87171"
              textAnchor="middle"
              fontWeight="bold"
            >
              NASAL
            </text>
            <text
              x={mx(temporalMinute)}
              y={PAD_TOP + IH + 20}
              fontSize={6}
              fill="rgba(255,255,255,0.5)"
              textAnchor="middle"
            >
              TEMPORAL
            </text>

            {/* Axis labels */}
            <text x={PAD_LEFT + IW / 2} y={H - 2} fontSize={7} fill="rgba(255,255,255,0.4)" textAnchor="middle">
              минута →
            </text>
          </svg>
        </div>

        {/* Legend */}
        <div className="mt-3 flex flex-wrap gap-3 text-xs">
          {Object.entries(STATUS_STYLE).map(([status, s]) => (
            <div key={status} className="flex items-center gap-1">
              <span
                className="inline-block w-3 h-3 rounded border"
                style={{ background: s.fill, borderColor: s.stroke }}
              />
              <span className="text-muted-foreground capitalize">
                {status === 'normal' ? 'Норма' : status === 'attention' ? 'Внимание' : 'Притеснение'}
              </span>
            </div>
          ))}
          {Object.entries(ARTIFACT_COLOR).slice(0, 3).map(([type, color]) => (
            <div key={type} className="flex items-center gap-1">
              <span
                className="inline-block w-2 h-2 rounded-full"
                style={{ background: color }}
              />
              <span className="text-muted-foreground">{type}</span>
            </div>
          ))}
        </div>
      </div>
    </Card>
  )
}
