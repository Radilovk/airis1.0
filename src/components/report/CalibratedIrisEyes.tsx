import { useMemo, useState } from 'react'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Eye } from '@phosphor-icons/react'
import { fitImageInSquare } from '@/lib/image-utils'
import { cellCenterInView, sectorBandWedgePath } from '@/lib/iris-coords'
import { sectorsFor, ringBand, type RingBandDef } from '@/lib/iris-map'
import { isPlanRelevantFinding, groupFindingsForDisplay } from '@/lib/calibrated-report-summary'
import type { AnalysisReport, CalibratedAnalysisPayload, IrisGeometrySnapshot } from '@/types'

const VIEW = 320

function loadColor(confidence: number): string {
  if (confidence >= 0.75) return 'rgba(239, 68, 68, 0.55)'
  if (confidence >= 0.6) return 'rgba(234, 179, 8, 0.5)'
  return 'rgba(250, 204, 21, 0.35)'
}

function IrisEyePanel({
  side,
  dataUrl,
  geometry,
  findings,
  maxPerEye,
}: {
  side: 'left' | 'right'
  dataUrl: string
  geometry?: IrisGeometrySnapshot
  findings: CalibratedAnalysisPayload['findings']
  /** Ако е зададено — ограничава броя маркери; по подразбиране — всички значими. */
  maxPerEye?: number
}) {
  const sideLabel = side === 'left' ? 'Ляв' : 'Десен'
  const allFindings = findings.filter(f => f.side === side)
  const relevant = allFindings.filter(isPlanRelevantFinding)
  const grouped = groupFindingsForDisplay(relevant)
  const eyeFindings = maxPerEye != null ? grouped.slice(0, maxPerEye) : grouped
  const [activeIdx, setActiveIdx] = useState<number | null>(null)

  const overlay = useMemo(() => {
    if (!geometry?.imageWidth || !geometry.imageHeight) return null
    const fit = fitImageInSquare(geometry.imageWidth, geometry.imageHeight, VIEW)
    const cx = geometry.limbus.cx * fit.scale + fit.offsetX
    const cy = geometry.limbus.cy * fit.scale + fit.offsetY
    const pr = geometry.pupil.r * fit.scale
    const lr = geometry.limbus.r * fit.scale
    return { ...fit, cx, cy, pr, lr }
  }, [geometry])

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <Eye size={18} weight="duotone" className="text-primary" />
        <h4 className="font-semibold">{sideLabel} ирис</h4>
        <Badge variant="outline" className="text-[10px]">
          {eyeFindings.length} за плана
          {allFindings.length > eyeFindings.length
            ? ` · ${allFindings.length} прегледани`
            : ''}
        </Badge>
      </div>

      <div className="relative mx-auto aspect-square w-full max-w-[320px] overflow-hidden rounded-2xl bg-black ring-1 ring-border">
        {dataUrl ? (
          <img src={dataUrl} alt={sideLabel} className="absolute inset-0 h-full w-full object-contain" />
        ) : (
          <div className="flex h-full items-center justify-center text-xs text-muted-foreground">Няма снимка</div>
        )}
        {overlay && geometry && (
          <svg viewBox={`0 0 ${VIEW} ${VIEW}`} className="pointer-events-none absolute inset-0 h-full w-full">
            {eyeFindings.map((f, i) => (
              <path
                key={`w-${f.type}-${f.sector}-${f.ring}-${i}`}
                d={sectorBandWedgePath(f.sector, f.ring, geometry, VIEW)}
                fill={loadColor(f.confidence)}
                stroke={activeIdx === i ? '#fff' : 'rgba(255,255,255,0.35)'}
                strokeWidth={activeIdx === i ? 2 : 1}
                className="pointer-events-auto cursor-pointer"
                onMouseEnter={() => setActiveIdx(i)}
                onMouseLeave={() => setActiveIdx(null)}
              />
            ))}
            {Array.from({ length: 12 }, (_, i) => {
              const a = (i * 30 * Math.PI) / 180
              const sin = Math.sin(a)
              const cos = Math.cos(a)
              return (
                <line
                  key={i}
                  x1={overlay.cx + overlay.pr * sin}
                  y1={overlay.cy - overlay.pr * cos}
                  x2={overlay.cx + overlay.lr * sin}
                  y2={overlay.cy - overlay.lr * cos}
                  stroke="rgba(125,211,252,0.25)"
                  strokeWidth={0.75}
                />
              )
            })}
            <circle cx={overlay.cx} cy={overlay.cy} r={overlay.lr} fill="none" stroke="#fbbf24" strokeWidth={1.5} strokeDasharray="6 4" />
            <circle cx={overlay.cx} cy={overlay.cy} r={overlay.pr} fill="none" stroke="#38bdf8" strokeWidth={1.5} />
            {eyeFindings.map((f, i) => {
              const pt = cellCenterInView(f.sector, f.ring, geometry, VIEW)
              return (
                <g key={`m-${f.type}-${f.sector}-${f.ring}-${i}`}>
                  <circle cx={pt.x} cy={pt.y} r={activeIdx === i ? 7 : 5} fill="#ef4444" stroke="#fff" strokeWidth={1.5} />
                  <text x={pt.x} y={pt.y - 10} textAnchor="middle" fill="#fff" fontSize={9} fontWeight="bold" stroke="#000" strokeWidth={0.3}>
                    {f.sector}
                  </text>
                </g>
              )
            })}
          </svg>
        )}
      </div>

      <ul className="space-y-1.5 text-sm">
        {eyeFindings.length === 0 ? (
          <li className="text-muted-foreground">
            {allFindings.length > 0
              ? `${allFindings.length} прегледани точки — нито една не е достатъчно ясна, за да промени плана.`
              : 'Няма открити ирисови акценти за това око.'}
          </li>
        ) : (
          eyeFindings.map((f, i) => {
            const sector = sectorsFor(side)[f.sector - 1]
            const band: RingBandDef = ringBand(f.ring)
            return (
              <li
                key={`${f.type}-${f.sector}-${band.key}-${i}`}
                className={`flex gap-2 rounded-lg px-2.5 py-2 transition-colors ${activeIdx === i ? 'bg-primary/15 ring-1 ring-primary/30' : 'bg-muted/40'}`}
                onMouseEnter={() => setActiveIdx(i)}
                onMouseLeave={() => setActiveIdx(null)}
              >
                <span className="shrink-0 font-mono text-xs text-primary">
                  С{f.sector}
                </span>
                <span className="min-w-0">
                  <span className="font-medium">{f.label}</span>
                  <span className="block text-[11px] text-muted-foreground">
                    {band.label}
                    {sector ? ` · ${sector.label}` : ''}
                  </span>
                </span>
              </li>
            )
          })
        )}
      </ul>
    </div>
  )
}

/** Двете очи с маркирани зони върху реалната снимка. */
export default function CalibratedIrisEyes({
  report,
  maxPerEye,
}: {
  report: AnalysisReport
  maxPerEye?: number
}) {
  const cal = report.calibrated
  if (!cal) return null

  return (
    <Card className="p-5 md:p-6">
      <h3 className="mb-1 text-lg font-bold">Къде на снимката са акцентите</h3>
      <p className="mb-5 text-sm text-muted-foreground">
        Маркираните зони са по пръstenни пояси от атласа (IPB, STOM, ANW, ORG, LYM, SCU) —
        не по отделни микро-пръstenи. Показваме само достатъчно ясни находки.
      </p>
      <div className="grid gap-8 md:grid-cols-2">
        <IrisEyePanel
          side="left"
          dataUrl={report.leftIrisImage?.dataUrl ?? ''}
          geometry={report.leftIrisImage?.geometry}
          findings={cal.findings}
          maxPerEye={maxPerEye}
        />
        <IrisEyePanel
          side="right"
          dataUrl={report.rightIrisImage?.dataUrl ?? ''}
          geometry={report.rightIrisImage?.geometry}
          findings={cal.findings}
          maxPerEye={maxPerEye}
        />
      </div>
    </Card>
  )
}
