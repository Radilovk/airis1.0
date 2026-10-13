import { useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Card } from '@/components/ui/card'
import { CaretDown, CheckCircle, Eye, FirstAidKit, Info, Warning, WarningOctagon } from '@phosphor-icons/react'
import { REFERRAL_COPY, eyeReferralChip } from '@/lib/eye-health'
import type { EyeHealthReport, EyeReferral, EyeSign } from '@/types'

const TONE: Record<EyeReferral, { card: string; icon: typeof Eye; iconBox: string; title: string; chip: string }> = {
  none: {
    card: 'from-emerald-50 to-teal-50/40 ring-emerald-200',
    icon: CheckCircle,
    iconBox: 'bg-emerald-500 text-white',
    title: 'text-emerald-950',
    chip: 'bg-emerald-100 text-emerald-800',
  },
  routine: {
    card: 'from-sky-50 to-indigo-50/40 ring-sky-200',
    icon: Eye,
    iconBox: 'bg-sky-500 text-white',
    title: 'text-sky-950',
    chip: 'bg-sky-100 text-sky-800',
  },
  soon: {
    card: 'from-amber-50 to-orange-50/50 ring-amber-300',
    icon: Warning,
    iconBox: 'bg-amber-500 text-white',
    title: 'text-amber-950',
    chip: 'bg-amber-100 text-amber-900',
  },
  urgent: {
    card: 'from-rose-50 to-red-50/50 ring-rose-300',
    icon: WarningOctagon,
    iconBox: 'bg-rose-600 text-white',
    title: 'text-rose-950',
    chip: 'bg-rose-100 text-rose-900',
  },
}


const SIDE_LABEL: Record<EyeSign['side'], string> = { left: 'ляво око', right: 'дясно око', both: 'двете очи' }
const SOURCE_LABEL: Record<EyeSign['source'], string> = {
  photo: 'видяно на снимката',
  measurement: 'измерено',
  iridology: 'от иридологичен знак',
}

function SignRow({ sign, open, onToggle }: { sign: EyeSign; open: boolean; onToggle: () => void }) {
  const tone = TONE[sign.referral]
  return (
    <li className="overflow-hidden rounded-2xl bg-background/80 ring-1 ring-border/70">
      <button type="button" onClick={onToggle} aria-expanded={open} className="flex w-full items-start gap-3 px-4 py-3 text-left">
        <span className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ${tone.iconBox}`}>
          <tone.icon size={15} weight="bold" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block font-semibold leading-snug">{sign.title}</span>
          <span className="mt-1 flex flex-wrap gap-1.5 text-[11px]">
            <span className={`rounded-full px-2 py-0.5 font-medium ${tone.chip}`}>{eyeReferralChip(sign.referral)}</span>
            <span className="rounded-full bg-muted px-2 py-0.5 text-muted-foreground">{SIDE_LABEL[sign.side]}</span>
            <span className="rounded-full bg-muted px-2 py-0.5 text-muted-foreground">{SOURCE_LABEL[sign.source]}</span>
          </span>
        </span>
        <CaretDown size={16} className={`mt-1 shrink-0 text-muted-foreground transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
            <div className="grid gap-3 border-t px-4 py-3 text-sm sm:grid-cols-3">
              <Block label="Какво се вижда" text={sign.what} />
              <Block label="Защо има значение" text={sign.why} />
              <Block label="Какво да направите" text={sign.action} strong />
            </div>
            {sign.detail && <p className="px-4 pb-3 text-[11px] text-muted-foreground">Бележка: {sign.detail}</p>}
          </motion.div>
        )}
      </AnimatePresence>
    </li>
  )
}

function Block({ label, text, strong }: { label: string; text: string; strong?: boolean }) {
  return (
    <div className={strong ? 'rounded-xl bg-primary/5 p-2.5 ring-1 ring-primary/15' : ''}>
      <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-1 leading-relaxed">{text}</p>
    </div>
  )
}

/**
 * Офталмологичен скрининг: един ясен извод най-горе (трябва ли очен лекар и
 * колко бързо), знаците под него — сгънати до едно докосване.
 */
export default function EyeHealthCard({ report, compact }: { report?: EyeHealthReport; compact?: boolean }) {
  const [open, setOpen] = useState<number | null>(report && report.referral !== 'none' && !compact ? 0 : null)
  if (!report || !report.ran) return null
  const tone = TONE[report.referral]
  const copy = REFERRAL_COPY[report.referral]

  return (
    <Card className={`overflow-hidden border-0 bg-gradient-to-br p-5 ring-1 md:p-6 ${tone.card}`}>
      <div className="flex items-start gap-4">
        <motion.div
          initial={{ scale: 0.6, rotate: -12, opacity: 0 }}
          animate={{ scale: 1, rotate: 0, opacity: 1 }}
          transition={{ type: 'spring', stiffness: 300, damping: 18 }}
          className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl shadow-lg ${tone.iconBox}`}
        >
          <tone.icon size={26} weight="duotone" />
        </motion.div>
        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            <FirstAidKit size={13} /> Очно здраве · офталмологичен скрининг
          </p>
          <h3 className={`mt-1 text-lg font-bold leading-tight ${tone.title}`}>{copy.title}</h3>
          <p className="mt-1.5 text-sm leading-relaxed text-foreground/80">{copy.body}</p>
        </div>
      </div>

      {report.signs.length > 0 && (
        <ul className="mt-4 space-y-2">
          {report.signs.map((s, i) => (
            <SignRow key={`${s.key}-${s.side}`} sign={s} open={open === i} onToggle={() => setOpen(open === i ? null : i)} />
          ))}
        </ul>
      )}

      {!compact && (
        <div className="mt-4 rounded-2xl bg-background/60 p-3.5">
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Какво проверихме</p>
          <ul className="grid gap-1.5 text-sm sm:grid-cols-2">
            {report.checked.map(c => {
              const hit = report.signs.length > 0 && matchesChecklist(c, report.signs)
              return (
                <li key={c} className="flex items-center gap-2">
                  {hit ? (
                    <Info size={16} weight="fill" className="shrink-0 text-amber-500" />
                  ) : (
                    <CheckCircle size={16} weight="fill" className="shrink-0 text-emerald-500" />
                  )}
                  <span className={hit ? 'font-medium' : 'text-muted-foreground'}>{c}</span>
                </li>
              )
            })}
          </ul>
          <p className="mt-3 text-[11px] leading-relaxed text-muted-foreground">
            Снимка от телефон не замества преглед с биомикроскоп и измерване на очното налягане.
            При внезапна промяна в зрението, болка или светкавици пред очите — към лекар, без да чакате.
          </p>
        </div>
      )}
    </Card>
  )
}

const CHECK_MAP: Array<[RegExp, string[]]> = [
  [/роговицата/, ['arcus', 'limbal_ring']],
  [/Зеница/, ['lens_opacity', 'pupil_irregular', 'anisocoria']],
  [/Бяло на окото/, ['scleral_yellow', 'scleral_red', 'pterygium']],
  [/Ирис/, ['iris_nevus', 'heterochromia']],
]

function matchesChecklist(item: string, signs: EyeSign[]) {
  const keys = CHECK_MAP.find(([re]) => re.test(item))?.[1] ?? []
  return signs.some(s => keys.includes(s.key))
}
