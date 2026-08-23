import { useMemo, useState } from 'react'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Eye } from '@phosphor-icons/react'
import { fitImageInSquare } from '@/lib/image-utils'
import { cellCenterInView, sectorRingWedgePath } from '@/lib/iris-coords'
import { sectorsFor } from '@/lib/iris-map'
import type { AnalysisReport, CalibratedAnalysisPayload, IrisGeometrySnapshot } from '@/types'

const VIEW = 320

function loadColor(confidence: number, confirmations?: number): string {
  if ((confirmations ?? 1) >= 2) return 'rgba(239, 68, 68, 0.55)'
  if (confidence >= 0.7) return 'rgba(234, 179, 8, 0.5)'
  return 'rgba(250, 204, 21, 0.35)'
}

function IrisEyePanel({
  side,
  dataUrl,
  geometry,
  findings,
}: {
  side: 'left' | 'right'
  dataUrl: string
  geometry?: IrisGeometrySnapshot
  findings: CalibratedAnalysisPayload['findings']
}) {
  const sideLabel = side === 'left' ? 'Ляв' : 'Десен'
  const eyeFindings = findings.filter(f => f.side === side)
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
          {eyeFindings.length} находки
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
                d={sectorRingWedgePath(f.sector, f.ring, geometry, VIEW)}
                fill={loadColor(f.confidence, f.confirmations)}
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
          <li className="text-muted-foreground">Няма приети находки за това око.</li>
        ) : (
          eyeFindings.slice(0, 10).map((f, i) => {
            const sector = sectorsFor(side)[f.sector - 1]
            return (
              <li
                key={`${f.type}-${f.sector}-${f.ring}-${i}`}
                className={`flex gap-2 rounded-lg px-2.5 py-2 transition-colors ${activeIdx === i ? 'bg-primary/15 ring-1 ring-primary/30' : 'bg-muted/40'}`}
                onMouseEnter={() => setActiveIdx(i)}
                onMouseLeave={() => setActiveIdx(null)}
              >
                <span className="shrink-0 font-mono text-xs text-primary">
                  S{f.sector}/R{f.ring}
                </span>
                <span className="min-w-0">
                  <span className="font-medium">{f.label}</span>
                  {sector && (
                    <span className="block text-[11px] text-muted-foreground">{sector.label}</span>
                  )}
                </span>
              </li>
            )
          })
        )}
      </ul>
    </div>
  )
}

/** Двете очи с маркирани зони върху реалната снимка — основният изглед за клиента. */
export default function CalibratedIrisEyes({ report }: { report: AnalysisReport }) {
  const cal = report.calibrated
  if (!cal) return null

  return (
    <Card className="p-5 md:p-6">
      <h3 className="mb-1 text-lg font-bold">Вашите ириси — зоните с находки</h3>
      <p className="mb-5 text-sm text-muted-foreground">
        Оцветените сектори показват къде на <strong>вашата снимка</strong> са открити признаци.
        Червените маркери сочат точната клетка (сектор S1–S12, пръстен R0–R11).
        Отблясъкът от светкавицата в зеницата не се брои като находка.
      </p>
      <div className="grid gap-8 md:grid-cols-2">
        <IrisEyePanel
          side="left"
          dataUrl={report.leftIrisImage?.dataUrl ?? ''}
          geometry={report.leftIrisImage?.geometry}
          findings={cal.findings}
        />
        <IrisEyePanel
          side="right"
          dataUrl={report.rightIrisImage?.dataUrl ?? ''}
          geometry={report.rightIrisImage?.geometry}
          findings={cal.findings}
        />
      </div>
    </Card>
  )
}
