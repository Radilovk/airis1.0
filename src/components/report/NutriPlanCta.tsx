import { useState } from 'react'
import { ForkKnife, ArrowRight } from '@phosphor-icons/react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import type { AnalysisReport } from '@/types'
import { cameFromNutriPlan, createNutriPlanLink } from '@/lib/nutriplan-handoff'
import { loadVoucher, formatPrice } from '@/lib/iris-billing'

/**
 * Към NutriPlan: насоките от анализа като седмично меню с количества и
 * проследяване. Изпраща се обобщението на анализа и въпросника — без снимките.
 */
// Един линк за един доклад — повторно натискане не създава нова пратка.
const linkCache = new Map<string, { url: string; withData: boolean }>()

export default function NutriPlanCta({ report }: { report: AnalysisReport }) {
  const [busy, setBusy] = useState(false)
  const returning = cameFromNutriPlan()
  const voucher = loadVoucher()   // платеният анализ се приспада от първия план
  if (report.demo) return null

  const go = async () => {
    setBusy(true)
    // Прозорецът се отваря веднага (в отговор на натискането), иначе браузърът го блокира.
    const popup = returning ? null : window.open('', '_blank')
    const key = String(report.id || report.timestamp || '')
    const made = linkCache.get(key) || await createNutriPlanLink(report)
    if (made.withData && key) linkCache.set(key, made)
    const link = voucher ? { ...made, url: made.url + (made.url.includes('?') ? '&' : '?') + `voucher=${voucher.code}` } : made
    // Съобщението се вижда само ако остава в този раздел (новият раздел е отпред).
    const usePopup = popup && !popup.closed
    if (!link.withData && !usePopup) toast.info('Няма връзка с Eatologix — отваряме въпросника без данните от анализа')
    if (usePopup) popup.location.href = link.url
    else window.location.assign(link.url)
    setBusy(false)
  }

  return (
    <section className="rounded-2xl border border-primary/25 bg-primary/5 p-5">
      <div className="flex items-start gap-4">
        <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground">
          <ForkKnife size={22} weight="duotone" />
        </div>
        <div className="min-w-0 flex-1">
          <h2 className="text-base font-bold">
            {returning ? 'Върни резултата в Eatologix' : 'Хранителен план по този анализ'}
          </h2>
          <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
            Eatologix превръща насоките в седмично меню с количества, следи напредъка и адаптира плана всяка седмица.
            С вас отиват обобщението на анализа и отговорите от въпросника — без снимките на очите. В Eatologix
            решавате дали да ги добавите към профила си.
          </p>
          {voucher && !returning && (
            <p className="mt-2 text-sm font-semibold text-primary">
              Платените {formatPrice(voucher.amount)} за анализа се приспадат от първия ви план до {new Date(voucher.until).toLocaleDateString('bg-BG')}.
            </p>
          )}
          <Button onClick={go} disabled={busy} className="mt-4 h-11 w-full gap-2 sm:w-auto">
            {returning ? 'Добави в Eatologix' : 'Продължи в Eatologix'}
            <ArrowRight size={18} />
          </Button>
        </div>
      </div>
    </section>
  )
}
