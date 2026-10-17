import { motion } from 'framer-motion'
import { ArrowRight, FirstAidKit, MapPin, Phone, WarningOctagon } from '@phosphor-icons/react'
import { REFERRAL_COPY } from '@/lib/eye-health'
import type { EyeHealthReport } from '@/types'

const SIDE_LABEL = { left: 'ляво око', right: 'дясно око', both: 'двете очи' } as const

/**
 * Спешен екран пред доклада. Когато скринингът е стигнал до „преглед веднага“,
 * докладът, табовете и бутоните отгоре се скриват: остават само знакът, какво
 * да се направи и до две действия — всяко на едно докосване. Червеното е
 * запазено точно за този случай.
 */
export default function UrgentEyeGate({
  report,
  onContinue,
}: {
  report: EyeHealthReport
  onContinue: () => void
}) {
  const copy = REFERRAL_COPY.urgent
  const urgent = report.signs.filter(s => s.referral === 'urgent')

  return (
    <motion.main
      role="alertdialog"
      aria-labelledby="urgent-eye-title"
      aria-describedby="urgent-eye-body"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="min-h-screen bg-background px-4 py-8"
    >
      <div className="mx-auto flex max-w-lg flex-col gap-6">
        <div className="flex items-center gap-3">
          <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-rose-600 text-white shadow-lg">
            <WarningOctagon size={30} weight="fill" aria-hidden />
          </span>
          <p className="flex items-center gap-1.5 text-sm font-semibold text-muted-foreground">
            <FirstAidKit size={16} aria-hidden /> Очно здраве
          </p>
        </div>

        <div>
          <h1 id="urgent-eye-title" className="text-2xl font-extrabold leading-tight">
            {copy.title}
          </h1>
          <p id="urgent-eye-body" className="mt-3 text-base leading-relaxed text-foreground/85">
            {copy.body}
          </p>
        </div>

        {urgent.length > 0 && (
          <ul className="space-y-3">
            {urgent.map(s => (
              <li key={`${s.key}-${s.side}`} className="rounded-2xl border-2 border-rose-300 bg-rose-50 p-4 text-rose-950">
                <p className="text-base font-bold leading-snug">{s.title}</p>
                <p className="mt-0.5 text-sm">{SIDE_LABEL[s.side]}</p>
                <p className="mt-2 text-base leading-relaxed">{s.action}</p>
              </li>
            ))}
          </ul>
        )}

        <div className="flex flex-col gap-3">
          <a
            href="https://www.google.com/maps/search/%D0%BE%D1%87%D0%B5%D0%BD+%D0%BB%D0%B5%D0%BA%D0%B0%D1%80"
            target="_blank"
            rel="noopener noreferrer"
            className="flex min-h-[52px] items-center justify-center gap-2 rounded-2xl bg-primary px-5 text-base font-semibold text-primary-foreground shadow-md active:scale-[0.98]"
          >
            <MapPin size={22} weight="bold" aria-hidden /> Намери очен лекар наблизо
          </a>
          <a
            href="tel:112"
            className="flex min-h-[52px] items-center justify-center gap-2 rounded-2xl border-2 border-rose-600 px-5 text-base font-semibold text-rose-700 active:scale-[0.98]"
          >
            <Phone size={22} weight="bold" aria-hidden /> Болка или внезапно влошено зрение — 112
          </a>
        </div>

        <p className="text-sm leading-relaxed text-muted-foreground">
          Това не е диагноза — снимката може да подведе. Решението е на лекаря, затова е важно да ви види.
        </p>

        <button
          type="button"
          onClick={onContinue}
          className="flex min-h-[48px] items-center justify-center gap-2 self-center rounded-xl px-4 text-base font-medium text-muted-foreground underline-offset-4 hover:underline"
        >
          Разбрах — към доклада <ArrowRight size={18} aria-hidden />
        </button>
      </div>
    </motion.main>
  )
}
