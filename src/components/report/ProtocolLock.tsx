import { useEffect, useState } from 'react'
import { LockKey, ForkKnife, Pill, Moon, CheckCircle } from '@phosphor-icons/react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import type { AnalysisReport } from '@/types'
import { billingStatus, startProtocolCheckout, type BillingStatus } from '@/lib/protocol-unlock'

/**
 * Заключеният протокол: какво ще получи човек (с броя от неговия анализ) и плащането.
 * Анализът и картата на ириса остават отворени — плаща се само протоколът.
 */
export default function ProtocolLock({ report }: { report: AnalysisReport }) {
  const [status, setStatus] = useState<BillingStatus | null>(null)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [agree, setAgree] = useState(false)
  useEffect(() => { void billingStatus().then(setStatus) }, [])

  const p = report.detailedPlan
  const foods = (p?.recommendedFoods?.length || 0) + (p?.avoidFoods?.length || 0)
  const supps = p?.supplements?.length || 0
  const routine = (p?.generalRecommendations?.length || 0) + (p?.specialRecommendations?.length || 0) + (p?.psychologicalRecommendations?.length || 0)
  const price = (status?.price ?? 9.99).toFixed(2).replace('.', ',') + ' €'

  const buy = async () => {
    if (!agree) { setErr('Отбележете съгласието — после натиснете пак.'); return }
    setBusy(true); setErr(null)
    const e = await startProtocolCheckout(report.id)
    if (e) { setErr(e); setBusy(false) }
  }

  const Row = ({ icon: Icon, title, text }: { icon: typeof ForkKnife; title: string; text: string }) => (
    <li className="flex items-start gap-3">
      <span className="flex size-10 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary"><Icon size={22} weight="duotone" /></span>
      <span><strong className="block">{title}</strong><span className="text-sm text-muted-foreground">{text}</span></span>
    </li>
  )

  return (
    <Card className="mx-auto max-w-xl p-6 text-left">
      <div className="mb-4 flex items-center gap-3">
        <span className="flex size-12 items-center justify-center rounded-2xl bg-primary text-primary-foreground"><LockKey size={26} weight="fill" /></span>
        <div>
          <h3 className="text-xl font-bold">Вашият личен протокол</h3>
          <p className="text-sm text-muted-foreground">
            {status?.recheck ? 'Контролно разчитане: вече сте взели протокол, затова този е на по-ниска цена.' : 'Анализът е безплатен. Протоколът се отключва еднократно за този анализ.'}
          </p>
        </div>
      </div>
      <ul className="mb-5 space-y-3">
        <Row icon={ForkKnife} title="Хранене" text={foods ? `${foods} храни — какво да включите и какво да ограничите` : 'Какво да включите и какво да ограничите'} />
        <Row icon={Pill} title="Добавки" text={supps ? `${supps} добавки — дозировка, кога и колко време` : 'Дозировка, кога и колко време'} />
        <Row icon={Moon} title="Режим" text={routine ? `${routine} конкретни стъпки за сън, движение и стрес` : 'Сън, движение и стрес — конкретни стъпки'} />
      </ul>
      <label className="mb-4 flex cursor-pointer items-start gap-2 text-xs text-muted-foreground">
        <input type="checkbox" className="mt-0.5 size-4 shrink-0 accent-[var(--primary)]" checked={agree} onChange={e => { setAgree(e.target.checked); setErr(null) }} />
        <span>Съгласен съм протоколът да се отключи веднага след плащането и разбирам, че за цифрово съдържание губя правото на отказ от 14 дни.</span>
      </label>
      <Button size="lg" className="h-12 w-full gap-2" onClick={buy} disabled={busy || status?.ready === false}>
        <CheckCircle size={20} weight="bold" />
        {status?.ready === false ? 'Скоро' : `Отключете протокола — ${price}`}
      </Button>
      {err && <p className="mt-3 text-sm text-rose-600">{err}</p>}
      <p className="mt-3 text-center text-xs text-muted-foreground">
        {status?.mode === 'test' && status.ready ? 'Тестов режим: карта 4242 4242 4242 4242, без истинско таксуване. ' : ''}
        Плащане със Stripe. Еднократно, без абонамент.
      </p>
    </Card>
  )
}
