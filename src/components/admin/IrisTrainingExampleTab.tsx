import { useRef } from 'react'
import { useKVWithFallback } from '@/hooks/useKVWithFallback'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Separator } from '@/components/ui/separator'
import { Eye, DownloadSimple, Info, Warning } from '@phosphor-icons/react'
import type { AnalysisReport, IrisZone, Artifact } from '@/types'

// ── Coordinate system constants ──────────────────────────────────────────────
const RINGS = 12       // R0 (pupil border) → R11 (outer edge)
const MINUTES = 60     // 0 (12 o'clock) → 60, clockwise

// Visual settings for the circular iris diagram
const SVG_SIZE = 520
const CX = SVG_SIZE / 2
const CY = SVG_SIZE / 2
const OUTER_R = SVG_SIZE * 0.46
const PUPIL_R = OUTER_R * 0.22

function ringRadius(r: number): number {
  return PUPIL_R + (r / RINGS) * (OUTER_R - PUPIL_R)
}

// minute (0-60, 0 = 12 o'clock, clockwise) → angle in radians
function minuteToRad(m: number): number {
  return ((m / MINUTES) * 2 * Math.PI) - Math.PI / 2
}

// polar → cartesian
function polar(angle: number, r: number): [number, number] {
  return [CX + r * Math.cos(angle), CY + r * Math.sin(angle)]
}

// ── Colour helpers ────────────────────────────────────────────────────────────
const STATUS_FILL: Record<string, string> = {
  normal:    'rgba(34,197,94,0.22)',
  attention: 'rgba(234,179,8,0.38)',
  concern:   'rgba(239,68,68,0.48)',
}
const STATUS_STROKE: Record<string, string> = {
  normal:    'rgba(34,197,94,0.7)',
  attention: 'rgba(234,179,8,0.9)',
  concern:   'rgba(239,68,68,0.95)',
}
const STATUS_LABEL: Record<string, string> = {
  normal:    'Норма',
  attention: 'Внимание',
  concern:   'Притеснение',
}

// ── SVG arc path between two rings and two minutes ───────────────────────────
function sectorPath(
  minuteStart: number,
  minuteEnd: number,
  ringStart: number,
  ringEnd: number
): string {
  const a1 = minuteToRad(minuteStart)
  const a2 = minuteToRad(minuteEnd)
  const r1 = ringRadius(ringStart)
  const r2 = ringRadius(ringEnd + 1)          // ring_end is inclusive

  const [ox1, oy1] = polar(a1, r1)
  const [ox2, oy2] = polar(a2, r1)
  const [ix1, iy1] = polar(a1, r2)
  const [ix2, iy2] = polar(a2, r2)

  const largeArc = minuteEnd - minuteStart > 30 ? 1 : 0

  return [
    `M ${ox1} ${oy1}`,
    `A ${r1} ${r1} 0 ${largeArc} 1 ${ox2} ${oy2}`,
    `L ${ix2} ${iy2}`,
    `A ${r2} ${r2} 0 ${largeArc} 0 ${ix1} ${iy1}`,
    'Z'
  ].join(' ')
}

// Clock labels: minute 0 = 12 o'clock, minute 5 = 1 o'clock, etc.
const CLOCK_LABELS = [
  { minute: 0,  label: '12' },
  { minute: 5,  label: '1' },
  { minute: 10, label: '2' },
  { minute: 15, label: '3' },
  { minute: 20, label: '4' },
  { minute: 25, label: '5' },
  { minute: 30, label: '6' },
  { minute: 35, label: '7' },
  { minute: 40, label: '8' },
  { minute: 45, label: '9' },
  { minute: 50, label: '10' },
  { minute: 55, label: '11' },
]

// ── Unwrapped (rectangular) view ─────────────────────────────────────────────
const UW = 600
const UH = 160
const UPL = 36   // left padding (ring labels)
const UPT = 18   // top padding
const UPB = 30   // bottom padding (minute labels + NASAL/TEMPORAL)
const UPR = 8    // right padding

const UIW = UW - UPL - UPR
const UIH = UH - UPT - UPB

const umx = (m: number) => UPL + (m / MINUTES) * UIW
const ury = (r: number) => UPT + (r / RINGS) * UIH

// ── Main component ────────────────────────────────────────────────────────────
export default function IrisTrainingExampleTab() {
  const [history] = useKVWithFallback<AnalysisReport[]>('analysis-history', [])
  const svgLeftRef = useRef<SVGSVGElement>(null)
  const svgRightRef = useRef<SVGSVGElement>(null)
  const unwrapRef = useRef<SVGSVGElement>(null)

  const lastReport = history && history.length > 0 ? history[0] : null

  // ── Download SVG as PNG ─────────────────────────────────────────────────────
  const downloadSVG = (svgElement: SVGSVGElement | null, filename: string) => {
    if (!svgElement) return
    const serializer = new XMLSerializer()
    const svgStr = serializer.serializeToString(svgElement)
    const blob = new Blob([svgStr], { type: 'image/svg+xml;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    a.click()
    URL.revokeObjectURL(url)
  }

  // ── Render helpers ──────────────────────────────────────────────────────────
  const renderCircularDiagram = (
    zones: IrisZone[],
    artifacts: Artifact[],
    side: 'left' | 'right',
    health: number
  ) => {
    const nasalMinute  = side === 'right' ? 45 : 15
    const temporalMinute = side === 'right' ? 15 : 45

    return (
      <svg
        ref={side === 'left' ? svgLeftRef : svgRightRef}
        viewBox={`0 0 ${SVG_SIZE} ${SVG_SIZE}`}
        className="w-full border border-border rounded-lg"
        style={{ background: '#0d1117', maxWidth: SVG_SIZE }}
      >
        <defs>
          <filter id={`glow-train-${side}`}>
            <feGaussianBlur stdDeviation="2.5" result="blur" />
            <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
          <radialGradient id={`bg-grad-${side}`} cx="50%" cy="50%">
            <stop offset="0%"   stopColor="rgba(30,58,138,0.25)" />
            <stop offset="100%" stopColor="rgba(0,0,0,0)" />
          </radialGradient>
        </defs>

        {/* Background glow */}
        <circle cx={CX} cy={CY} r={OUTER_R} fill={`url(#bg-grad-${side})`} />

        {/* ── Ring circles ── */}
        {Array.from({ length: RINGS + 1 }).map((_, r) => (
          <circle
            key={`ring-${r}`}
            cx={CX} cy={CY}
            r={ringRadius(r)}
            fill="none"
            stroke={r === 0 || r === RINGS ? 'rgba(99,102,241,0.8)' : 'rgba(99,102,241,0.3)'}
            strokeWidth={r === 0 || r === RINGS ? 1.5 : 0.8}
            strokeDasharray={r > 0 && r < RINGS ? '4,3' : undefined}
          />
        ))}

        {/* ── Radial minute lines (every 5 min) ── */}
        {CLOCK_LABELS.map(({ minute }) => {
          const a = minuteToRad(minute)
          const [x1, y1] = polar(a, PUPIL_R)
          const [x2, y2] = polar(a, OUTER_R)
          return (
            <line
              key={`rad-${minute}`}
              x1={x1} y1={y1} x2={x2} y2={y2}
              stroke="rgba(148,163,184,0.25)"
              strokeWidth="1"
            />
          )
        })}

        {/* ── Zone sector highlights ── */}
        {zones.map((z) => {
          if (
            z.minute_start === undefined || z.minute_end  === undefined ||
            z.ring_start   === undefined || z.ring_end    === undefined
          ) return null
          return (
            <path
              key={`zone-${z.id}`}
              d={sectorPath(z.minute_start, z.minute_end, z.ring_start, z.ring_end)}
              fill={STATUS_FILL[z.status] ?? STATUS_FILL.normal}
              stroke={STATUS_STROKE[z.status] ?? STATUS_STROKE.normal}
              strokeWidth="1.5"
            />
          )
        })}

        {/* ── Artifact markers ── */}
        {artifacts.map((a, idx) => {
          if (a.minute === undefined || a.ring === undefined) return null
          const angle = minuteToRad(a.minute)
          const r = ringRadius(a.ring + 0.5)
          const [ax, ay] = polar(angle, r)
          return (
            <circle
              key={`art-${idx}`}
              cx={ax} cy={ay} r={4}
              fill="rgba(251,191,36,0.9)"
              stroke="rgba(0,0,0,0.6)"
              strokeWidth="1"
            />
          )
        })}

        {/* ── Pupil ── */}
        <circle cx={CX} cy={CY} r={PUPIL_R}
          fill="rgba(0,0,0,0.7)"
          stroke="rgba(99,102,241,0.9)"
          strokeWidth="2"
          filter={`url(#glow-train-${side})`}
        />
        <text x={CX} y={CY + 4} fontSize={9} fill="rgba(148,163,184,0.7)"
          textAnchor="middle" fontFamily="monospace">PUPIL</text>

        {/* ── Outer border ── */}
        <circle cx={CX} cy={CY} r={OUTER_R}
          fill="none"
          stroke="rgba(99,102,241,0.9)"
          strokeWidth="2.5"
          filter={`url(#glow-train-${side})`}
        />

        {/* ── Ring labels (R0–R11) ── */}
        {Array.from({ length: RINGS }).map((_, r) => {
          const midR = (ringRadius(r) + ringRadius(r + 1)) / 2
          const [lx, ly] = polar(minuteToRad(2), midR)
          return (
            <text
              key={`rl-${r}`}
              x={lx} y={ly + 3}
              fontSize={7} fill="rgba(148,163,184,0.8)"
              textAnchor="middle" fontFamily="monospace"
            >
              R{r}
            </text>
          )
        })}

        {/* ── Clock labels ── */}
        {CLOCK_LABELS.map(({ minute, label }) => {
          const a = minuteToRad(minute)
          const labelR = OUTER_R + 16
          const [lx, ly] = polar(a, labelR)
          return (
            <text
              key={`cl-${minute}`}
              x={lx} y={ly + 4}
              fontSize={10} fill="rgba(203,213,225,0.9)"
              textAnchor="middle" fontWeight="bold" fontFamily="monospace"
            >
              {label}
            </text>
          )
        })}

        {/* ── Nasal / Temporal label ── */}
        {[
          { minute: nasalMinute,    label: 'NASAL',    color: '#f87171' },
          { minute: temporalMinute, label: 'TEMPORAL', color: 'rgba(148,163,184,0.7)' }
        ].map(({ minute, label, color }) => {
          const a = minuteToRad(minute)
          const [lx, ly] = polar(a, OUTER_R + 32)
          return (
            <text key={label} x={lx} y={ly + 4}
              fontSize={8} fill={color}
              textAnchor="middle" fontWeight="bold" fontFamily="monospace"
            >
              {label}
            </text>
          )
        })}

        {/* ── Cross-hairs at centre ── */}
        <line x1={CX - 8} y1={CY} x2={CX + 8} y2={CY} stroke="rgba(99,102,241,0.6)" strokeWidth="1" />
        <line x1={CX} y1={CY - 8} x2={CX} y2={CY + 8} stroke="rgba(99,102,241,0.6)" strokeWidth="1" />

        {/* ── Title ── */}
        <text x={CX} y={SVG_SIZE - 10} fontSize={10}
          fill="rgba(148,163,184,0.6)" textAnchor="middle" fontFamily="monospace">
          {side === 'left' ? 'ЛЯВ ИРИС' : 'ДЕСЕН ИРИС'} · Здраве: {health}/100
        </text>

        {/* ── Coordinate legend box ── */}
        <rect x={8} y={8} width={130} height={42} rx={4}
          fill="rgba(0,0,0,0.65)" stroke="rgba(99,102,241,0.4)" strokeWidth={1} />
        <text x={16} y={22} fontSize={8} fill="rgba(203,213,225,0.9)" fontFamily="monospace" fontWeight="bold">
          Координатна система:
        </text>
        <text x={16} y={34} fontSize={7} fill="rgba(148,163,184,0.8)" fontFamily="monospace">
          X = минута 0–60 (по часовниковата стр.)
        </text>
        <text x={16} y={44} fontSize={7} fill="rgba(148,163,184,0.8)" fontFamily="monospace">
          Y = пръстен R0 (зеница) → R11 (ръб)
        </text>
      </svg>
    )
  }

  const renderUnwrappedDiagram = (
    zones: IrisZone[],
    artifacts: Artifact[],
    side: 'left' | 'right',
    health: number
  ) => {
    const nasalMinute    = side === 'right' ? 45 : 15
    const temporalMinute = side === 'right' ? 15 : 45

    return (
      <svg
        ref={side === 'left' ? unwrapRef : undefined}
        viewBox={`0 0 ${UW} ${UH}`}
        className="w-full border border-border rounded"
        style={{ minWidth: 320, background: '#0d1117' }}
      >
        {/* Grid – rings */}
        {Array.from({ length: RINGS + 1 }).map((_, r) => (
          <line
            key={`ug-r${r}`}
            x1={UPL} y1={ury(r)}
            x2={UPL + UIW} y2={ury(r)}
            stroke={r === 0 || r === RINGS ? 'rgba(99,102,241,0.6)' : 'rgba(255,255,255,0.1)'}
            strokeWidth={r === 0 || r === RINGS ? 1.2 : 0.5}
          />
        ))}

        {/* Grid – minutes every 5 */}
        {Array.from({ length: 13 }).map((_, i) => {
          const m = i * 5
          return (
            <line
              key={`ug-m${m}`}
              x1={umx(m)} y1={UPT}
              x2={umx(m)} y2={UPT + UIH}
              stroke={m === 0 || m === 60 ? 'rgba(99,102,241,0.6)' : 'rgba(255,255,255,0.1)'}
              strokeWidth={m === 0 || m === 60 ? 1.2 : 0.5}
            />
          )
        })}

        {/* Zone rectangles */}
        {zones.map((z) => {
          if (
            z.minute_start === undefined || z.minute_end  === undefined ||
            z.ring_start   === undefined || z.ring_end    === undefined
          ) return null
          const x1 = umx(z.minute_start)
          const y1 = ury(z.ring_start)
          const w  = Math.max(2, umx(z.minute_end) - x1)
          const h  = Math.max(2, ury(z.ring_end + 1) - y1)
          return (
            <rect key={`uz-${z.id}`}
              x={x1} y={y1} width={w} height={h} rx={2}
              fill={STATUS_FILL[z.status] ?? STATUS_FILL.normal}
              stroke={STATUS_STROKE[z.status] ?? STATUS_STROKE.normal}
              strokeWidth={1}
            />
          )
        })}

        {/* Artifact dots */}
        {artifacts.map((a, idx) => {
          if (a.minute === undefined || a.ring === undefined) return null
          return (
            <circle
              key={`ua-${idx}`}
              cx={umx(a.minute)}
              cy={ury(a.ring + 0.5)}
              r={3}
              fill="rgba(251,191,36,0.9)"
              stroke="rgba(0,0,0,0.5)"
              strokeWidth={0.5}
            />
          )
        })}

        {/* Ring labels (Y axis) */}
        {Array.from({ length: RINGS }).map((_, r) => (
          <text key={`url-${r}`}
            x={UPL - 2} y={ury(r) + UIH / RINGS / 2 + 3}
            fontSize={6} fill="rgba(148,163,184,0.7)"
            textAnchor="end" fontFamily="monospace"
          >
            R{r}
          </text>
        ))}

        {/* Minute labels (X axis) every 5 */}
        {Array.from({ length: 13 }).map((_, i) => {
          const m = i * 5
          return (
            <text key={`uml-${m}`}
              x={umx(m)} y={UPT + UIH + 9}
              fontSize={6} fill="rgba(148,163,184,0.7)"
              textAnchor="middle" fontFamily="monospace"
            >
              {m}
            </text>
          )
        })}

        {/* NASAL / TEMPORAL */}
        <text x={umx(nasalMinute)}    y={UH - 2} fontSize={6}
          fill="#f87171" textAnchor="middle" fontWeight="bold" fontFamily="monospace">
          NASAL
        </text>
        <text x={umx(temporalMinute)} y={UH - 2} fontSize={6}
          fill="rgba(148,163,184,0.6)" textAnchor="middle" fontFamily="monospace">
          TEMPORAL
        </text>

        {/* Axis labels */}
        <text x={UPL + UIW / 2} y={UH - 14} fontSize={6}
          fill="rgba(99,102,241,0.7)" textAnchor="middle" fontFamily="monospace">
          минута (0 = 12 ч.) →
        </text>
        <text
          x={8} y={UPT + UIH / 2}
          fontSize={6} fill="rgba(99,102,241,0.7)"
          textAnchor="middle" fontFamily="monospace"
          transform={`rotate(-90, 8, ${UPT + UIH / 2})`}
        >
          пръстен
        </text>

        {/* Title */}
        <text x={UPL + 4} y={UPT + 9} fontSize={7}
          fill="rgba(203,213,225,0.5)" fontFamily="monospace">
          {side === 'left' ? 'ЛЯВ ИРИС' : 'ДЕСЕН ИРИС'} · {health}/100 · разгъната координатна система
        </text>
      </svg>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold mb-1">Примерно Изображение за Обучение на AI</h3>
        <p className="text-sm text-muted-foreground">
          Разгърнато изображение на ириса с координатна система, генерирано от последния анализ.
          Използва се за обучение и калибриране на AI модела.
        </p>
      </div>

      <Alert>
        <Info className="h-4 w-4" />
        <AlertDescription className="text-xs">
          <strong>Координатна система:</strong>{' '}
          X-ос = минута 0–60 (0 = 12 часа, по часовниковата стрелка) ·
          Y-ос = пръстен R0 (зеница) → R11 (външен ръб на ириса).
          Всяка зона се описва с <code className="font-mono bg-muted px-1 rounded">minute_start/end</code> и{' '}
          <code className="font-mono bg-muted px-1 rounded">ring_start/end</code>.
        </AlertDescription>
      </Alert>

      {!lastReport ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Warning size={40} className="mx-auto mb-4 text-muted-foreground/40" weight="duotone" />
            <p className="text-muted-foreground text-sm mb-2">Няма запазени анализи</p>
            <p className="text-xs text-muted-foreground">
              Извършете поне един ирис анализ, за да се генерира примерното изображение.
            </p>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Meta information */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <Eye size={16} weight="duotone" className="text-primary" />
                Последен Анализ
              </CardTitle>
              <CardDescription className="text-xs">
                Данни от{' '}
                {new Date(lastReport.timestamp).toLocaleDateString('bg-BG', {
                  day: 'numeric', month: 'long', year: 'numeric'
                })}{' '}
                · {new Date(lastReport.timestamp).toLocaleTimeString('bg-BG', { hour: '2-digit', minute: '2-digit' })}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-3 text-xs">
                <div className="flex items-center gap-1.5">
                  <span className="text-muted-foreground">Ляв ирис:</span>
                  <Badge variant="outline">{lastReport.leftIris.overallHealth}/100</Badge>
                  <span className="text-muted-foreground">
                    {lastReport.leftIris.zones.filter(z => z.status !== 'normal').length} зони с находки
                  </span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="text-muted-foreground">Десен ирис:</span>
                  <Badge variant="outline">{lastReport.rightIris.overallHealth}/100</Badge>
                  <span className="text-muted-foreground">
                    {lastReport.rightIris.zones.filter(z => z.status !== 'normal').length} зони с находки
                  </span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="text-muted-foreground">Артефакти:</span>
                  <Badge variant="outline">
                    {lastReport.leftIris.artifacts.length + lastReport.rightIris.artifacts.length}
                  </Badge>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* LEFT IRIS */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-base flex items-center gap-2">
                  <Eye size={18} weight="duotone" className="text-primary" />
                  Ляв Ирис – Координатна Система
                </CardTitle>
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-2"
                  onClick={() => downloadSVG(svgLeftRef.current, `iris-training-left-${lastReport.timestamp}.svg`)}
                >
                  <DownloadSimple size={14} />
                  Свали SVG
                </Button>
              </div>
              <CardDescription className="text-xs">
                Кръгова топографска карта с пълна координатна система
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="overflow-x-auto">
                {renderCircularDiagram(
                  lastReport.leftIris.zones,
                  lastReport.leftIris.artifacts,
                  'left',
                  lastReport.leftIris.overallHealth
                )}
              </div>

              <Separator />

              <div>
                <p className="text-xs text-muted-foreground font-medium mb-2">Разгъната (линейна) координатна система</p>
                <div className="overflow-x-auto">
                  {renderUnwrappedDiagram(
                    lastReport.leftIris.zones,
                    lastReport.leftIris.artifacts,
                    'left',
                    lastReport.leftIris.overallHealth
                  )}
                </div>
              </div>

              {lastReport.leftIris.zones.filter(z => z.status !== 'normal').length > 0 && (
                <div>
                  <p className="text-xs font-medium mb-2">Зони с находки (Ляв ирис):</p>
                  <div className="space-y-1.5">
                    {lastReport.leftIris.zones
                      .filter(z => z.status !== 'normal')
                      .map(z => (
                        <div key={z.id}
                          className="flex items-start gap-2 p-2 rounded border text-xs"
                          style={{ borderColor: STATUS_STROKE[z.status], background: STATUS_FILL[z.status] }}
                        >
                          <span className="font-bold shrink-0 font-mono">
                            {z.minute_start !== undefined
                              ? `мин${z.minute_start}-${z.minute_end} R${z.ring_start}-R${z.ring_end}`
                              : z.angle?.join('°–') + '°'
                            }
                          </span>
                          <span className="text-muted-foreground">{z.name} · {z.organ}</span>
                          <Badge className="ml-auto shrink-0 text-[10px] py-0"
                            style={{ background: STATUS_FILL[z.status], borderColor: STATUS_STROKE[z.status], color: 'inherit' }}>
                            {STATUS_LABEL[z.status]}
                          </Badge>
                        </div>
                      ))
                    }
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* RIGHT IRIS */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-base flex items-center gap-2">
                  <Eye size={18} weight="duotone" className="text-primary" />
                  Десен Ирис – Координатна Система
                </CardTitle>
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-2"
                  onClick={() => downloadSVG(svgRightRef.current, `iris-training-right-${lastReport.timestamp}.svg`)}
                >
                  <DownloadSimple size={14} />
                  Свали SVG
                </Button>
              </div>
              <CardDescription className="text-xs">
                Кръгова топографска карта с пълна координатна система
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="overflow-x-auto">
                {renderCircularDiagram(
                  lastReport.rightIris.zones,
                  lastReport.rightIris.artifacts,
                  'right',
                  lastReport.rightIris.overallHealth
                )}
              </div>

              <Separator />

              <div>
                <p className="text-xs text-muted-foreground font-medium mb-2">Разгъната (линейна) координатна система</p>
                <div className="overflow-x-auto">
                  {renderUnwrappedDiagram(
                    lastReport.rightIris.zones,
                    lastReport.rightIris.artifacts,
                    'right',
                    lastReport.rightIris.overallHealth
                  )}
                </div>
              </div>

              {lastReport.rightIris.zones.filter(z => z.status !== 'normal').length > 0 && (
                <div>
                  <p className="text-xs font-medium mb-2">Зони с находки (Десен ирис):</p>
                  <div className="space-y-1.5">
                    {lastReport.rightIris.zones
                      .filter(z => z.status !== 'normal')
                      .map(z => (
                        <div key={z.id}
                          className="flex items-start gap-2 p-2 rounded border text-xs"
                          style={{ borderColor: STATUS_STROKE[z.status], background: STATUS_FILL[z.status] }}
                        >
                          <span className="font-bold shrink-0 font-mono">
                            {z.minute_start !== undefined
                              ? `мин${z.minute_start}-${z.minute_end} R${z.ring_start}-R${z.ring_end}`
                              : z.angle?.join('°–') + '°'
                            }
                          </span>
                          <span className="text-muted-foreground">{z.name} · {z.organ}</span>
                          <Badge className="ml-auto shrink-0 text-[10px] py-0"
                            style={{ background: STATUS_FILL[z.status], borderColor: STATUS_STROKE[z.status], color: 'inherit' }}>
                            {STATUS_LABEL[z.status]}
                          </Badge>
                        </div>
                      ))
                    }
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Legend */}
          <Card className="bg-muted/20">
            <CardHeader>
              <CardTitle className="text-sm">Легенда и обяснение на координатите</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-xs">
              <div className="flex flex-wrap gap-4">
                {Object.entries(STATUS_LABEL).map(([status, label]) => (
                  <div key={status} className="flex items-center gap-1.5">
                    <span className="inline-block w-4 h-4 rounded border"
                      style={{ background: STATUS_FILL[status], borderColor: STATUS_STROKE[status] }} />
                    <span>{label}</span>
                  </div>
                ))}
                <div className="flex items-center gap-1.5">
                  <span className="inline-block w-3 h-3 rounded-full bg-yellow-400 border border-black/50" />
                  <span>Артефакт (лакуна/крипта/пигмент)</span>
                </div>
              </div>

              <Separator />

              <div className="grid sm:grid-cols-2 gap-3">
                <div className="p-3 bg-muted/30 rounded-lg border">
                  <p className="font-semibold mb-1">X-ос: Минута (0–60)</p>
                  <p className="text-muted-foreground">
                    Ъгловата позиция по часовниковата стрелка. 0 = 12 часа · 15 = 3 часа ·
                    30 = 6 часа · 45 = 9 часа.
                  </p>
                </div>
                <div className="p-3 bg-muted/30 rounded-lg border">
                  <p className="font-semibold mb-1">Y-ос: Пръстен (R0–R11)</p>
                  <p className="text-muted-foreground">
                    Радиусна зона. R0 = граница на зеницата · R11 = външен ръб на ириса.
                    12 пръстена общо.
                  </p>
                </div>
                <div className="p-3 bg-muted/30 rounded-lg border">
                  <p className="font-semibold mb-1">Nasal / Temporal</p>
                  <p className="text-muted-foreground">
                    Ляв ирис: Nasal = 15 мин, Temporal = 45 мин. <br />
                    Десен ирис: Nasal = 45 мин, Temporal = 15 мин.
                  </p>
                </div>
                <div className="p-3 bg-muted/30 rounded-lg border">
                  <p className="font-semibold mb-1">Употреба за AI обучение</p>
                  <p className="text-muted-foreground">
                    AI моделът използва тези координати, за да локализира точно
                    всяка зона и артефакт при визуален анализ на изображението.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  )
}
