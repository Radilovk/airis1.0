import { motion } from 'framer-motion'
import { Card } from '@/components/ui/card'
import { Leaf, Waves } from '@phosphor-icons/react'
import { constitutionKey, readConstitution, readDensity } from '@/lib/iris-reading'
import type { CalibratedAnalysisPayload } from '@/types'

const SWATCH: Record<string, string> = {
  lymphatic: 'conic-gradient(from 0deg, #8fb3cf, #6b93b5, #a9c4d9, #7aa0c0, #8fb3cf)',
  hematogenic: 'conic-gradient(from 0deg, #6b4423, #8a5a2b, #5a3a1c, #7a4f26, #6b4423)',
  mixed: 'conic-gradient(from 0deg, #6f8f6a, #8a6b3a, #5f7d77, #9a7a40, #6f8f6a)',
}

const DENSITY_STEPS = ['loose', 'medium', 'dense'] as const

/** Конституционният тип на ириса и плътността на влакната — „терена" в иридологията. */
export default function ConstitutionCard({ data }: { data: CalibratedAnalysisPayload }) {
  const reading = readConstitution(data.constitution)
  const density = readDensity(data.density)
  if (!reading && !density) return null
  const key = constitutionKey(data.constitution)

  return (
    <Card className="overflow-hidden p-5 md:p-6">
      <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Вашият терен по иридологията</p>
      <div className="mt-3 grid gap-5 md:grid-cols-2">
        {reading && (
          <div className="flex gap-4">
            <motion.div
              className="relative h-16 w-16 shrink-0 rounded-full shadow-inner ring-4 ring-background"
              style={{ background: SWATCH[key ?? 'mixed'] }}
              initial={{ scale: 0.85, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ duration: 0.4 }}
            >
              <span className="absolute inset-[34%] rounded-full bg-slate-950" />
            </motion.div>
            <div className="min-w-0">
              <h4 className="font-bold leading-tight">{reading.title}</h4>
              <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{reading.body}</p>
              <p className="mt-2 flex items-start gap-1.5 text-sm">
                <Leaf size={16} weight="duotone" className="mt-0.5 shrink-0 text-emerald-600" />
                {reading.support}
              </p>
            </div>
          </div>
        )}
        {density && (
          <div className="flex gap-4">
            <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-primary/10">
              <Waves size={30} weight="duotone" className="text-primary" />
            </div>
            <div className="min-w-0 flex-1">
              <h4 className="font-bold leading-tight">{density.label}</h4>
              <div className="mt-2 flex gap-1" aria-label="Плътност на влакната">
                {DENSITY_STEPS.map((d, i) => (
                  <motion.span
                    key={d}
                    initial={{ scaleX: 0 }}
                    animate={{ scaleX: 1 }}
                    transition={{ delay: 0.15 + i * 0.1 }}
                    className={`h-2 flex-1 origin-left rounded-full ${DENSITY_STEPS.indexOf(density.key) >= i ? 'bg-primary' : 'bg-muted'}`}
                  />
                ))}
              </div>
              <div className="mt-1 flex justify-between text-[10px] text-muted-foreground">
                <span>рехави</span>
                <span>плътни</span>
              </div>
              <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{density.body}</p>
            </div>
          </div>
        )}
      </div>
    </Card>
  )
}
