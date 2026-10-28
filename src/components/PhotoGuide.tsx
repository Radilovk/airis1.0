import { useId } from 'react'
import { CheckCircle, XCircle } from '@phosphor-icons/react'

/**
 * Как да се снима окото — четири кратки стъпки с рисунка и примери „така /
 * не така“. Указанията следват това, за което е настроен анализът:
 * светкавицата дава неутрален цвят и свита зеница (повече ирисова тъкан), а
 * отблясъкът ѝ пада в зеницата и се маха автоматично (`iris-pipeline.ts`).
 * Снима се с нормалната камера на телефона — тя дава пълната резолюция;
 * окото се намира и изрязва след това (`eye-crop.ts`, `iris-autoframe.ts`).
 */

/* ── рисунка на око ───────────────────────────────────────────────────────── */

type EyeFlaw = 'none' | 'lid' | 'blur' | 'glare'

/** Око отпред. `flaw` показва типичните грешки на примерите. */
export function EyeSketch({ flaw = 'none', className }: { flaw?: EyeFlaw; className?: string }) {
  const id = useId().replace(/:/g, '')
  // Горният клепач: при „lid“ слиза над половината на ириса.
  const y = flaw === 'lid' ? 40 : 38
  const upper = flaw === 'lid' ? `M6 ${y} Q60 22 114 ${y}` : `M6 ${y} Q60 -6 114 ${y}`
  const eye = `${upper} Q60 80 6 ${y} Z`
  return (
    <svg viewBox="0 0 120 76" className={className} aria-hidden>
      <defs>
        <radialGradient id={`ir${id}`} cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#5a3412" />
          <stop offset="30%" stopColor="#b8772a" />
          <stop offset="45%" stopColor="#5e7c58" />
          <stop offset="70%" stopColor="#2f7186" />
          <stop offset="100%" stopColor="#13304a" />
        </radialGradient>
        <clipPath id={`cl${id}`}>
          <path d={eye} />
        </clipPath>
        <filter id={`bl${id}`}>
          <feGaussianBlur stdDeviation="2.4" />
        </filter>
      </defs>
      <rect width="120" height="76" rx="12" fill="#e8c2a4" />
      <g filter={flaw === 'blur' ? `url(#bl${id})` : undefined}>
        <path d={eye} fill="#f7f1ec" />
        <g clipPath={`url(#cl${id})`}>
          <circle cx="60" cy="38" r="21" fill={`url(#ir${id})`} />
          {Array.from({ length: 40 }, (_, i) => {
            const a = (i / 40) * Math.PI * 2
            return (
              <line
                key={i}
                x1={60 + Math.cos(a) * 8}
                y1={38 + Math.sin(a) * 8}
                x2={60 + Math.cos(a) * 20}
                y2={38 + Math.sin(a) * 20}
                stroke={i % 2 ? 'rgba(255,255,255,.22)' : 'rgba(0,0,0,.18)'}
                strokeWidth="0.8"
              />
            )
          })}
          <circle cx="60" cy="38" r="21" fill="none" stroke="#0b1a26" strokeWidth="1.5" />
          <circle cx="60" cy="38" r="7.5" fill="#05080b" />
          <circle cx="56.5" cy="34.5" r="2" fill="#fff" opacity=".9" />
          {flaw === 'glare' && (
            <rect x="49" y="22" width="26" height="17" rx="2" fill="#fff" opacity=".85" transform="rotate(-12 62 30)" />
          )}
        </g>
        <path d={upper} fill="none" stroke="#7a4b33" strokeWidth="2.4" strokeLinecap="round" />
        <path d={`M6 ${y} Q60 80 114 ${y}`} fill="none" stroke="#a87458" strokeWidth="1.2" />
      </g>
    </svg>
  )
}

/* ── рисунки на стъпките ──────────────────────────────────────────────────── */

/** Телефон, гледан отзад: обектив и светкавица. */
function PhoneBack({ x, y, flash }: { x: number; y: number; flash?: boolean }) {
  return (
    <g transform={`translate(${x} ${y})`}>
      <rect width="30" height="56" rx="6" fill="#1f2a33" />
      <rect x="4" y="4" width="15" height="21" rx="4" fill="#33424e" />
      <circle cx="11.5" cy="10" r="4.2" fill="#0b1117" stroke="#7d8f9c" strokeWidth="1.2" />
      <circle cx="11.5" cy="19.5" r="3.2" fill="#0b1117" stroke="#7d8f9c" strokeWidth="1" />
      <circle cx="23" cy="9" r="2.2" fill={flash ? '#fde68a' : '#c9d2d8'} />
      {flash &&
        [0, 1, 2, 3, 4].map(i => {
          const a = (-0.9 + i * 0.45) * Math.PI
          return <line key={i} x1={23 + Math.cos(a) * 5} y1={9 + Math.sin(a) * 5} x2={23 + Math.cos(a) * 11} y2={9 + Math.sin(a) * 11} stroke="#f59e0b" strokeWidth="2" strokeLinecap="round" />
        })}
    </g>
  )
}

function StepDistance() {
  return (
    <svg viewBox="0 0 120 76" aria-hidden className="h-full w-full">
      <rect width="120" height="76" rx="12" className="fill-muted" />
      {/* профил: чело, нос, око */}
      <path d="M14 6 Q30 8 32 26 L38 36 L32 40 Q34 54 26 70" fill="none" stroke="#c99a7a" strokeWidth="3" strokeLinecap="round" />
      <path d="M24 27 Q29 24 31 28" fill="none" stroke="#7a4b33" strokeWidth="2" strokeLinecap="round" />
      <PhoneBack x={78} y={10} />
      <line x1="38" y1="28" x2="76" y2="28" stroke="currentColor" className="text-primary" strokeWidth="1.5" strokeDasharray="3 3" />
      <text x="57" y="22" textAnchor="middle" fontSize="9" fontWeight="700" className="fill-primary">10–15 см</text>
    </svg>
  )
}

function StepFlash() {
  return (
    <svg viewBox="0 0 120 76" aria-hidden className="h-full w-full">
      <rect width="120" height="76" rx="12" className="fill-muted" />
      <PhoneBack x={45} y={12} flash />
    </svg>
  )
}

function StepFocus() {
  return (
    <svg viewBox="0 0 120 76" aria-hidden className="h-full w-full">
      <rect width="120" height="76" rx="12" className="fill-muted" />
      <rect x="34" y="4" width="52" height="68" rx="8" fill="#1f2a33" />
      <rect x="37" y="9" width="46" height="58" rx="4" fill="#e8c2a4" />
      <path d="M41 38 Q60 22 79 38 Q60 54 41 38 Z" fill="#f7f1ec" />
      <circle cx="60" cy="38" r="8" fill="#2f7186" />
      <circle cx="60" cy="38" r="3" fill="#05080b" />
      <rect x="49" y="27" width="22" height="22" fill="none" stroke="#facc15" strokeWidth="1.8" />
      {/* пръст */}
      <circle cx="74" cy="52" r="7" fill="#d9a888" stroke="#a87458" strokeWidth="1" opacity=".95" />
    </svg>
  )
}

const STEPS = [
  { pic: StepDistance, title: 'Задната камера, отблизо', body: 'Нормалната камера на телефона, на 10–15 см от окото. Най-лесно е друг да снима.' },
  { pic: StepFlash, title: 'Със светкавица', body: 'Включете светкавицата. Не стойте с гръб към прозорец.' },
  { pic: () => <EyeSketch className="h-full w-full" />, title: 'Окото широко отворено', body: 'Гледайте в обектива. Целият ирис да се вижда — с бяло над и под него.' },
  { pic: StepFocus, title: 'Докоснете окото, после снимайте', body: 'Докоснете окото на екрана за фокус и задръжте неподвижно. Без увеличение с пръсти.' },
]

const EXAMPLES: Array<{ flaw: EyeFlaw; label: string; ok?: boolean }> = [
  { flaw: 'none', label: 'Така', ok: true },
  { flaw: 'lid', label: 'Клепачът закрива' },
  { flaw: 'blur', label: 'Размазано' },
  { flaw: 'glare', label: 'Отблясък от прозорец' },
]

export default function PhotoGuide({ compact }: { compact?: boolean }) {
  if (compact) {
    return (
      <ul className="space-y-1.5 text-sm text-muted-foreground">
        {STEPS.slice(0, 3).map(d => (
          <li key={d.title} className="flex items-start gap-2">
            <CheckCircle size={16} weight="duotone" className="mt-0.5 shrink-0 text-primary" />
            <span>
              <strong className="font-semibold text-foreground">{d.title}</strong>
            </span>
          </li>
        ))}
      </ul>
    )
  }

  return (
    <div className="space-y-5">
      <ol className="space-y-3">
        {STEPS.map((step, i) => (
          <li key={step.title} className="flex items-center gap-3">
            <div className="relative h-[60px] w-[96px] shrink-0 overflow-hidden rounded-xl">
              <step.pic />
              <span className="absolute left-1 top-1 flex h-5 w-5 items-center justify-center rounded-full bg-primary text-[11px] font-bold text-primary-foreground">
                {i + 1}
              </span>
            </div>
            <div className="min-w-0">
              <p className="text-[15px] font-semibold leading-snug">{step.title}</p>
              <p className="text-sm leading-snug text-muted-foreground">{step.body}</p>
            </div>
          </li>
        ))}
      </ol>

      <div className="grid grid-cols-2 gap-2">
        {EXAMPLES.map(ex => (
          <figure key={ex.label} className={`overflow-hidden rounded-xl border-2 ${ex.ok ? 'border-emerald-400' : 'border-border'}`}>
            <EyeSketch flaw={ex.flaw} className="block w-full" />
            <figcaption className={`flex items-center gap-1.5 px-2 py-1.5 text-xs font-semibold ${ex.ok ? 'text-emerald-700' : 'text-muted-foreground'}`}>
              {ex.ok ? <CheckCircle size={15} weight="fill" /> : <XCircle size={15} weight="fill" className="text-amber-600" />}
              {ex.label}
            </figcaption>
          </figure>
        ))}
      </div>

      <p className="rounded-xl bg-muted/50 p-3 text-sm text-muted-foreground">
        Може и <strong className="text-foreground">една снимка на двете очи</strong> — ще ги разделим сами. Но едно око отблизо дава най-много детайли.
        Без очила и цветни лещи.
      </p>
    </div>
  )
}
