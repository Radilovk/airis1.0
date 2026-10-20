import { Camera, CheckCircle, Lightning, ArrowsOut, Eye, Crosshair, XCircle } from '@phosphor-icons/react'
import type { Icon } from '@phosphor-icons/react'

/**
 * Как да се снима окото. Указанията следват това, за което е настроен анализът:
 * светкавицата дава неутрален цвят и свита зеница (повече ирисова тъкан), а
 * отблясъкът ѝ пада в зеницата и се маха автоматично (`iris-pipeline.ts`).
 * Огледалото и предната камера обръщат страните на картата.
 */
const DO: Array<{ icon: Icon; title: string; short: string; body: string }> = [
  { icon: Camera, title: 'Задната камера', short: 'не селфи, не в огледало', body: 'Не селфи и не в огледало — огледалото разменя лявата и дясната страна.' },
  { icon: Lightning, title: 'Със светкавица', short: 'за верен цвят', body: 'Цветът излиза верен, а отблясъкът пада в зеницата и се маха сам.' },
  { icon: ArrowsOut, title: 'Отблизо, около 10–15 см', short: 'остро, окото широко отворено', body: 'Ирисът да заема поне третина от ширината. Без цифров зум — изрязва се после.' },
  { icon: Crosshair, title: 'Остро', short: '', body: 'Докоснете окото на екрана за фокус и задръжте телефона неподвижно. Влакната трябва да се виждат.' },
  { icon: Eye, title: 'Окото широко отворено', short: '', body: 'Гледайте право в обектива. Ако клепачът закрива ириса, повдигнете го леко с пръст.' },
]

const DONT = ['очила и контактни лещи (цветните правят анализа невъзможен)', 'отражение на прозорец върху ириса', 'размазана или тъмна снимка']

export default function PhotoGuide({ compact }: { compact?: boolean }) {
  if (compact) {
    return (
      <ul className="space-y-1.5 text-sm text-muted-foreground">
        {DO.slice(0, 3).map(d => (
          <li key={d.title} className="flex items-start gap-2">
            <d.icon size={16} weight="duotone" className="mt-0.5 shrink-0 text-primary" />
            <span>
              <strong className="font-semibold text-foreground">{d.title}</strong> — {d.short}
            </span>
          </li>
        ))}
      </ul>
    )
  }

  return (
    <div className="space-y-4">
      <ol className="space-y-3">
        {DO.map((d, i) => (
          <li key={d.title} className="flex items-start gap-3">
            <span className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <d.icon size={20} weight="duotone" />
              <span className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-primary text-[11px] font-bold text-primary-foreground">
                {i + 1}
              </span>
            </span>
            <div className="min-w-0">
              <p className="text-[15px] font-semibold leading-snug">{d.title}</p>
              <p className="text-sm leading-relaxed text-muted-foreground">{d.body}</p>
            </div>
          </li>
        ))}
      </ol>
      <div className="rounded-xl bg-muted/50 p-3">
        <p className="mb-1.5 text-sm font-semibold">Без:</p>
        <ul className="space-y-1 text-sm text-muted-foreground">
          {DONT.map(t => (
            <li key={t} className="flex items-start gap-2">
              <XCircle size={16} weight="duotone" className="mt-0.5 shrink-0" />
              {t}
            </li>
          ))}
        </ul>
      </div>
      <p className="flex items-start gap-2 text-sm text-muted-foreground">
        <CheckCircle size={16} weight="duotone" className="mt-0.5 shrink-0 text-primary" />
        Най-лесно е друг човек да снима. Една снимка на око — лявото око е вашето ляво.
      </p>
    </div>
  )
}
