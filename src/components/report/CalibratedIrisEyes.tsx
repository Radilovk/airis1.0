import { useMemo } from 'react'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Eye } from '@phosphor-icons/react'
import { fitImageInSquare } from '@/lib/image-utils'
import { sectorsFor } from '@/lib/iris-map'
import type { AnalysisReport, CalibratedAnalysisPayload, IrisGeometrySnapshot } from '@/types'

const VIEW = 280

function IrisEyePanel({
  side,
  dataUrl,
  geometry,
  findings,
  stripUrl,
}: {
  side: 'left' | 'right'
  dataUrl: string
  geometry?: IrisGeometrySnapshot
  findings: CalibratedAnalysisPayload['findings']
  stripUrl?: string
}) {
  const sideLabel = side === 'left' ? 'Ляв' : 'Десен'
  const eyeFindings = findings.filter(f => f.side === side)

  const overlay = useMemo(() => {
    if (!geometry?.imageWidth || !geometry.imageHeight) return null
    const { scale, offsetX, offsetY } = fitImageInSquare(
      geometry.imageWidth,
      geometry.imageHeight,
      VIEW
    )
    const cx = geometry.limbus.cx * scale + offsetX
    const cy = geometry.limbus.cy * scale + offsetY
    const pr = geometry.pupil.r * scale
    const lr = geometry.limbus.r * scale
    return { cx, cy, pr, lr }
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

      <div className="relative mx-auto aspect-square w-full max-w-[280px] overflow-hidden rounded-2xl bg-black ring-1 ring-border">
        {dataUrl ? (
          <img src={dataUrl} alt={sideLabel} className="absolute inset-0 h-full w-full object-contain" />
        ) : (
          <div className="flex h-full items-center justify-center text-xs text-muted-foreground">Няма снимка</div>
        )}
        {overlay && (
          <svg viewBox={`0 0 ${VIEW} ${VIEW}`} className="pointer-events-none absolute inset-0 h-full w-full">
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
                  stroke="rgba(125,211,252,0.35)"
                  strokeWidth={1}
                />
              )
            })}
            <circle cx={overlay.cx} cy={overlay.cy} r={overlay.lr} fill="none" stroke="#fbbf24" strokeWidth={2} strokeDasharray="8 5" />
            <circle cx={overlay.cx} cy={overlay.cy} r={overlay.pr} fill="none" stroke="#38bdf8" strokeWidth={2} />
          </svg>
        )}
      </div>

      {stripUrl && (
        <div className="overflow-x-auto rounded-lg border bg-white p-1">
          <img src={stripUrl} alt={`${sideLabel} лента`} className="min-w-[420px] rounded" />
        </div>
      )}

      <ul className="space-y-1.5 text-sm">
        {eyeFindings.length === 0 ? (
          <li className="text-muted-foreground">Няма приети находки за това око.</li>
        ) : (
          eyeFindings.slice(0, 8).map((f, i) => {
            const sector = sectorsFor(side)[f.sector - 1]
            return (
              <li key={`${f.type}-${f.sector}-${f.ring}-${i}`} className="flex gap-2 rounded-lg bg-muted/40 px-2.5 py-2">
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

/** Двете очи с калибрирана мрежа, лента и находки — основният изглед на анализа. */
export default function CalibratedIrisEyes({ report }: { report: AnalysisReport }) {
  const cal = report.calibrated
  if (!cal) return null

  return (
    <Card className="p-5 md:p-6">
      <h3 className="mb-1 text-lg font-bold">Вашите ириси и зоните с находки</h3>
      <p className="mb-5 text-sm text-muted-foreground">
        Синият кръг = зеница, жълтият = лимбус. S1–S12 са секторите по часовника, R0–R11 — пръстените
        от зеница навън.
      </p>
      <div className="grid gap-8 md:grid-cols-2">
        <IrisEyePanel
          side="left"
          dataUrl={report.leftIrisImage?.dataUrl ?? ''}
          geometry={report.leftIrisImage?.geometry}
          findings={cal.findings}
          stripUrl={cal.strips?.left?.base}
        />
        <IrisEyePanel
          side="right"
          dataUrl={report.rightIrisImage?.dataUrl ?? ''}
          geometry={report.rightIrisImage?.geometry}
          findings={cal.findings}
          stripUrl={cal.strips?.right?.base}
        />
      </div>
    </Card>
  )
}
