import { useMemo } from 'react'
import { Button } from '@/components/ui/button'
import {
  ArrowRight,
  Bug,
  Camera,
  ClipboardText,
  ClockClockwise,
  Eye,
  FileText,
  Flask,
  Gear,
  Info,
  Key,
  MapTrifold,
  Play,
  Sparkle,
  Star,
} from '@phosphor-icons/react'
import { motion } from 'framer-motion'
import { useKVWithFallback } from '@/hooks/useKVWithFallback'
import type { AIModelConfig, QuestionnaireData } from '@/types'

interface WelcomeScreenProps {
  onStart: () => void
  onViewHistory: () => void
  onAdmin: () => void
  onTestStart: () => void
  onAbout: () => void
  onDiagnostics: () => void
  /** Примерен доклад с демо данни. */
  onDemo?: () => void
}

/** Живо, бавно въртящо се око — визитката на приложението. */
function IrisArt() {
  const fibers = useMemo(() => {
    let s = 17
    const rnd = () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296)
    return Array.from({ length: 150 }, (_, i) => {
      const a = (i / 150) * Math.PI * 2 + rnd() * 0.03
      const r0 = 54 + rnd() * 10
      const r1 = 118 + rnd() * 32
      return {
        x1: 200 + Math.cos(a) * r0,
        y1: 200 + Math.sin(a) * r0,
        x2: 200 + Math.cos(a + (rnd() - 0.5) * 0.06) * r1,
        y2: 200 + Math.sin(a + (rnd() - 0.5) * 0.06) * r1,
        light: rnd() > 0.5,
        w: 0.6 + rnd() * 1.3,
      }
    })
  }, [])

  const collarette = useMemo(() => {
    const pts: string[] = []
    for (let d = 0; d <= 360; d += 4) {
      const a = (d * Math.PI) / 180
      const r = 84 + Math.sin(a * 9) * 4
      pts.push(`${(200 + Math.cos(a) * r).toFixed(1)},${(200 + Math.sin(a) * r).toFixed(1)}`)
    }
    return `M${pts.join(' L')} Z`
  }, [])

  return (
    <div className="relative mx-auto aspect-square w-full max-w-[420px]">
      <div className="absolute inset-6 rounded-full bg-gradient-to-br from-primary/30 via-sky-300/20 to-accent/30 blur-3xl" />
      <svg viewBox="0 0 400 400" className="relative h-full w-full drop-shadow-2xl" aria-hidden>
        <defs>
          <radialGradient id="w-iris" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#7c4a1e" />
            <stop offset="34%" stopColor="#8a6a34" />
            <stop offset="48%" stopColor="#3f7f86" />
            <stop offset="86%" stopColor="#2e6a8a" />
            <stop offset="100%" stopColor="#14283a" />
          </radialGradient>
          <linearGradient id="w-scan" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#38bdf8" stopOpacity="0" />
            <stop offset="100%" stopColor="#38bdf8" stopOpacity="0.9" />
          </linearGradient>
        </defs>

        {/* външна скала — 12 часа */}
        <g className="iris-spin" style={{ animationDuration: '120s' }}>
          {Array.from({ length: 60 }, (_, i) => {
            const a = (i / 60) * Math.PI * 2
            const long = i % 5 === 0
            const r0 = long ? 176 : 181
            return (
              <line
                key={i}
                x1={200 + Math.cos(a) * r0}
                y1={200 + Math.sin(a) * r0}
                x2={200 + Math.cos(a) * 188}
                y2={200 + Math.sin(a) * 188}
                stroke="currentColor"
                className={long ? 'text-primary/60' : 'text-primary/25'}
                strokeWidth={long ? 2 : 1}
              />
            )
          })}
        </g>

        <circle cx="200" cy="200" r="152" fill="url(#w-iris)" />
        <g className="iris-spin">
          {fibers.map((f, i) => (
            <line key={i} x1={f.x1} y1={f.y1} x2={f.x2} y2={f.y2} stroke={f.light ? 'rgba(230,240,235,0.16)' : 'rgba(10,20,25,0.2)'} strokeWidth={f.w} />
          ))}
          <path d={collarette} fill="none" stroke="rgba(230,190,120,0.65)" strokeWidth="2.5" />
        </g>
        <circle cx="200" cy="200" r="150" fill="none" stroke="rgba(235,235,230,0.35)" strokeWidth="6" strokeDasharray="160 800" strokeDashoffset="-40" />
        <circle cx="200" cy="200" r="152" fill="none" stroke="#0b1620" strokeWidth="4" />

        <g className="iris-breathe">
          <circle cx="200" cy="200" r="54" fill="#05080b" />
        </g>
        <ellipse cx="220" cy="180" rx="13" ry="9" fill="rgba(255,255,255,0.9)" transform="rotate(-35 220 180)" />

        {/* сканираща дъга */}
        <g className="iris-spin-fast">
          <path d="M200 30 A170 170 0 0 1 347 115" fill="none" stroke="url(#w-scan)" strokeWidth="3" strokeLinecap="round" />
        </g>

        {/* знаци */}
        {[
          [262, 268],
          [128, 150],
          [292, 168],
        ].map(([x, y], i) => (
          <g key={i}>
            <circle cx={x} cy={y} r="9" fill="none" stroke="#fff" strokeWidth="1.5" className="iris-pulse" style={{ animationDelay: `${i * 0.5}s` }} />
            <circle cx={x} cy={y} r="5.5" fill={i === 1 ? '#f59e0b' : '#f43f5e'} stroke="#fff" strokeWidth="1.5" />
          </g>
        ))}
      </svg>

      {[
        { t: 'Коларета', c: 'left-[-2%] top-[30%]', d: 0.9 },
        { t: 'Arcus · очно здраве', c: 'right-[-4%] top-[14%]', d: 1.1 },
        { t: 'Стресов пръстен', c: 'right-[2%] bottom-[18%]', d: 1.3 },
      ].map(l => (
        <motion.span
          key={l.t}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: l.d }}
          className={`absolute ${l.c} rounded-full bg-background/90 px-3 py-1 text-[11px] font-semibold shadow-lg ring-1 ring-border backdrop-blur`}
        >
          {l.t}
        </motion.span>
      ))}
    </div>
  )
}

const STEPS = [
  { icon: ClipboardText, title: 'Кратък въпросник', body: 'Цели, сън, хранене — около 3 минути.' },
  { icon: Camera, title: 'Две снимки на очите', body: 'Отблизо, на дневна светлина, с калибрация.' },
  { icon: FileText, title: 'Доклад и план', body: 'Карта на ириса, очно здраве, меню и стъпки.' },
]

const FEATURES = [
  { icon: MapTrifold, title: 'Иридологична карта', body: '12 зони × 6 пояса, всеки знак разчетен и проверен в два независими прочита.' },
  { icon: Eye, title: 'Очно здраве', body: 'Скрининг за arcus, помътняване в зеницата, анизокория и др. — със съвет кога към офталмолог.' },
  { icon: Sparkle, title: 'Персонален план', body: 'Хранене и навици, съобразени с вашите цели, непоносимости и ограничения.' },
]

export default function WelcomeScreen({ onStart, onViewHistory, onAdmin, onTestStart, onAbout, onDiagnostics, onDemo }: WelcomeScreenProps) {
  const [questionnaireData] = useKVWithFallback<QuestionnaireData | null>('questionnaire-data', null)

  // Проверката за API ключ беше чак в AnalysisScreen — потребителят изминаваше
  // 21 въпроса, две снимки и две калибрации и чак тогава научаваше, че нищо
  // няма да се случи. Тук е на входа, преди инвестицията на време.
  const [aiConfig] = useKVWithFallback<AIModelConfig | null>('ai-model-config', null)
  const hasApiKey = !!aiConfig?.apiKey && aiConfig.apiKey.trim().length > 0

  const navItems = [
    { icon: ClockClockwise, label: 'История', onClick: onViewHistory },
    { icon: Info, label: 'Как работи', onClick: onAbout },
    { icon: Gear, label: 'Настройки', onClick: onAdmin },
    { icon: Bug, label: 'Диагностика', onClick: onDiagnostics },
  ]

  return (
    <div className="relative min-h-screen overflow-hidden">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,oklch(0.9_0.06_230/.7),transparent_55%),radial-gradient(ellipse_at_bottom_left,oklch(0.92_0.07_45/.5),transparent_50%)]" />

      <header className="relative mx-auto flex max-w-6xl items-center justify-between px-4 py-4 md:px-8">
        <div className="flex items-center gap-2">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-accent shadow-md">
            <Eye size={20} weight="duotone" className="text-white" />
          </span>
          <span className="text-lg font-extrabold tracking-tight">airis</span>
        </div>
        <nav className="flex items-center gap-1">
          {navItems.map(n => (
            <button
              key={n.label}
              type="button"
              onClick={n.onClick}
              title={n.label}
              className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-2 text-sm font-medium text-muted-foreground transition hover:bg-background/80 hover:text-foreground"
            >
              <n.icon size={18} weight="duotone" />
              <span className="hidden lg:inline">{n.label}</span>
            </button>
          ))}
        </nav>
      </header>

      <main className="relative mx-auto max-w-6xl px-4 pb-12 md:px-8">
        <section className="grid items-center gap-8 pt-2 md:grid-cols-[1.1fr_1fr] md:gap-10 md:pt-6">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }} className="order-2 text-center md:order-1 md:text-left">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary ring-1 ring-primary/20">
              <Sparkle size={14} weight="fill" /> Иридология + офталмологичен скрининг
            </span>
            <h1 className="mt-4 text-4xl font-extrabold leading-[1.05] tracking-tight md:text-6xl">
              Какво разказват{' '}
              <span className="bg-gradient-to-r from-primary via-sky-500 to-accent bg-clip-text text-transparent">очите ви</span>
            </h1>
            <p className="mx-auto mt-4 max-w-xl text-lg leading-relaxed text-muted-foreground md:mx-0">
              Две снимки и кратък въпросник — и получавате карта на ириса, проверка за видими очни знаци и личен план за хранене и навици.
            </p>

            <div className="mt-7 flex flex-col items-center gap-3 sm:flex-row md:items-start">
              <motion.div whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }} className="w-full sm:w-auto">
                <Button
                  size="lg"
                  onClick={onStart}
                  className="h-14 w-full gap-2 rounded-2xl bg-gradient-to-r from-primary to-accent px-8 text-lg font-bold shadow-xl shadow-primary/25 hover:opacity-95 sm:w-auto"
                >
                  Започни анализ
                  <ArrowRight size={20} weight="bold" />
                </Button>
              </motion.div>
              {onDemo && (
                <Button
                  size="lg"
                  variant="outline"
                  onClick={onDemo}
                  className="h-14 w-full gap-2 rounded-2xl border-2 bg-background/70 px-6 text-base font-semibold backdrop-blur sm:w-auto"
                >
                  <Play size={18} weight="fill" className="text-primary" />
                  Виж примерен доклад
                </Button>
              )}
            </div>

            <div className="mt-3 flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-sm text-muted-foreground md:justify-start">
              <span>≈ 5–10 минути</span>
              {questionnaireData && (
                <button type="button" onClick={onTestStart} className="inline-flex items-center gap-1 font-medium text-primary hover:underline">
                  <Flask size={15} weight="duotone" /> Продължи с предишните отговори
                </button>
              )}
            </div>

            {!hasApiKey && (
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4 }}
                className="mx-auto mt-6 flex max-w-xl items-start gap-3 rounded-2xl border border-amber-300 bg-amber-50/90 p-3.5 text-left md:mx-0"
              >
                <Key size={20} weight="duotone" className="mt-0.5 shrink-0 text-amber-700" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-amber-900">Първо добавете API ключ</p>
                  <p className="mt-0.5 text-xs leading-relaxed text-amber-800">
                    Анализът ползва външен AI модел. Без ключ ще стигнете до края на въпросника напразно.
                  </p>
                </div>
                <Button variant="outline" size="sm" onClick={onAdmin} className="shrink-0 gap-1.5 border-amber-400 bg-white text-amber-900 hover:bg-amber-100">
                  <Gear size={15} /> Добави
                </Button>
              </motion.div>
            )}
          </motion.div>

          <motion.div initial={{ opacity: 0, scale: 0.92 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.7, ease: 'easeOut' }} className="order-1 md:order-2">
            <IrisArt />
          </motion.div>
        </section>

        <section className="mt-12 grid gap-3 md:grid-cols-3">
          {STEPS.map((s, i) => (
            <motion.div
              key={s.title}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 + i * 0.1 }}
              className="flex items-start gap-3 rounded-2xl bg-background/70 p-4 ring-1 ring-border backdrop-blur"
            >
              <span className="relative flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <s.icon size={22} weight="duotone" />
                <span className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-primary text-[11px] font-bold text-primary-foreground">
                  {i + 1}
                </span>
              </span>
              <div>
                <p className="font-semibold">{s.title}</p>
                <p className="text-sm text-muted-foreground">{s.body}</p>
              </div>
            </motion.div>
          ))}
        </section>

        <section className="mt-3 grid gap-3 md:grid-cols-3">
          {FEATURES.map((f, i) => (
            <motion.div
              key={f.title}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5 + i * 0.1 }}
              whileHover={{ y: -3 }}
              className="rounded-2xl bg-gradient-to-br from-card to-muted/40 p-5 shadow-sm ring-1 ring-border transition-shadow hover:shadow-lg"
            >
              <f.icon size={26} weight="duotone" className="text-primary" />
              <p className="mt-3 font-bold">{f.title}</p>
              <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{f.body}</p>
            </motion.div>
          ))}
        </section>

        <footer className="mt-10 flex flex-col items-center gap-4 text-center">
          <p className="max-w-2xl text-xs leading-relaxed text-muted-foreground">
            Иридологията е допълващ подход, а не медицинска диагностика. Очният скрининг само насочва кога да се покажете на офталмолог.
          </p>
          <button
            type="button"
            onClick={() => { window.location.href = `${import.meta.env.BASE_URL}learn.html` }}
            className="inline-flex items-center gap-1.5 rounded-full bg-violet-500/10 px-3 py-1.5 text-xs font-semibold text-violet-700 ring-1 ring-violet-400/30 transition hover:bg-violet-500/20"
          >
            <Star size={14} weight="duotone" /> Звездичко — Домашна работа
          </button>
        </footer>
      </main>
    </div>
  )
}
