import { useEffect, useState } from 'react'
import { LockKey, Eye, ForkKnife, Pill, Moon, CheckCircle, ArrowLeft } from '@phosphor-icons/react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { irisStatus, startAnalysisCheckout, formatPrice, NUTRIIN_PROFILE, testerFlag } from '@/lib/iris-billing'

/**
 * Преди анализа, когато се плаща: какво ще получи човекът, цената и двата пътя —
 * плащане (6,99 €) или анализът, включен в плана на Nutriin (пропуск от профила там).
 * Снимките и отговорите остават на устройството — след плащането анализът продължава с тях.
 */
export default function PayScreen({ onBack }: { onBack: () => void }) {
  const [price, setPrice] = useState(6.99)
  const [agree, setAgree] = useState(false)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  useEffect(() => { void irisStatus().then(s => setPrice(s.price)) }, [])
  const test = testerFlag()

  const buy = async () => {
    if (!agree) { setErr('Отбележете съгласието — после натиснете пак.'); return }
    setBusy(true); setErr(null)
    const e = await startAnalysisCheckout()
    if (e) { setErr(e); setBusy(false) }
  }

  const Row = ({ icon: Icon, title, text }: { icon: typeof Eye; title: string; text: string }) => (
    <li className="flex items-start gap-3">
      <span className="flex size-10 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary"><Icon size={22} weight="duotone" /></span>
      <span><strong className="block">{title}</strong><span className="text-sm text-muted-foreground">{text}</span></span>
    </li>
  )

  return (
    <div className="mx-auto max-w-xl px-4 py-6">
      <button type="button" onClick={onBack} className="mb-3 inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-muted-foreground">
        <ArrowLeft size={18} /> Назад към снимките
      </button>
      <Card className="p-6 text-left">
        <div className="mb-4 flex items-center gap-3">
          <span className="flex size-12 items-center justify-center rounded-2xl bg-primary text-primary-foreground"><LockKey size={26} weight="fill" /></span>
          <div>
            <h2 className="text-xl font-bold">Вашият ирисов анализ</h2>
            <p className="text-sm text-muted-foreground">Снимките и отговорите са готови. Анализът започва веднага след плащането.</p>
          </div>
        </div>
        <ul className="mb-5 space-y-3">
          <Row icon={Eye} title="Разчитане на двата ириса" text="Зони, знаци и какво показват — с карта на всяко око" />
          <Row icon={ForkKnife} title="Хранене" text="Какво да включите и какво да ограничите" />
          <Row icon={Pill} title="Добавки" text="Дозировка, кога и колко време" />
          <Row icon={Moon} title="Режим" text="Сън, движение и стрес — конкретни стъпки" />
        </ul>
        <label className="mb-4 flex cursor-pointer items-start gap-2 text-xs text-muted-foreground">
          <input type="checkbox" className="mt-0.5 size-4 shrink-0 accent-[var(--primary)]" checked={agree} onChange={e => { setAgree(e.target.checked); setErr(null) }} />
          <span>Съгласен съм анализът да започне веднага след плащането и разбирам, че за цифрово съдържание губя правото на отказ от 14 дни.</span>
        </label>
        <Button size="lg" className="h-12 w-full gap-2" onClick={buy} disabled={busy}>
          <CheckCircle size={20} weight="bold" />
          Платете {formatPrice(price)} и започнете
        </Button>
        {err && <p className="mt-3 text-sm text-rose-600">{err}</p>}
        <p className="mt-3 text-center text-xs text-muted-foreground">
          {test ? 'Тестов режим: карта 4242 4242 4242 4242, без истинско таксуване. ' : ''}
          Плащане със Stripe. Еднократно, без абонамент. Сумата се приспада от първия ви план в Nutriin до 30 дни.
        </p>
        <div className="mt-5 rounded-2xl border border-primary/25 bg-primary/5 p-4">
          <p className="text-sm font-semibold">Имате план в Nutriin?</p>
          <p className="mt-1 text-sm text-muted-foreground">Анализът е включен — един на 4 седмици. Отворете IrisMap от профила си там („Ирисов анализ“) и продължете без плащане.</p>
          <a className="mt-3 inline-flex min-h-11 items-center text-sm font-bold text-primary" href={NUTRIIN_PROFILE} target="_blank" rel="noopener">
            Към профила в Nutriin
          </a>
        </div>
      </Card>
    </div>
  )
}
