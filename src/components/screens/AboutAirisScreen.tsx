import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import {
  ArrowLeft,
  ArrowSquareOut,
  BookOpen,
  Calculator,
  CaretDown,
  ClipboardText,
  Eye,
  Flask,
  GridFour,
  MagnifyingGlass,
  PencilSimpleLine,
  ShieldCheck,
  Target,
} from '@phosphor-icons/react'
import type { Icon } from '@phosphor-icons/react'
import { motion } from 'framer-motion'
import { FINDINGS, FINDING_TYPES, SYSTEMS } from '@/lib/iris-map'

interface AboutAirisScreenProps {
  onBack: () => void
}

/**
 * „Как работи анализът“. Описва реалния pipeline (`iris-pipeline.ts`), не
 * намеренията. Списъкът със знаци и системи се чете от `iris-map.ts`, за да не
 * се разминава с кода.
 */
const STEPS: Array<{ icon: Icon; title: string; body: string }> = [
  {
    icon: Target,
    title: 'Намиране на окото',
    body: 'В телефона, без AI: кодът намира зеницата, ръба на ириса и клепачите. Вие проверявате кръговете и ги нагласяте, ако трябва.',
  },
  {
    icon: MagnifyingGlass,
    title: 'Проверка на снимката',
    body: 'Острота, размер на ириса, отблясъци, закрити от клепача зони. Неизползваема снимка се връща с конкретен съвет.',
  },
  {
    icon: GridFour,
    title: 'Разгъване в карта',
    body: 'Кръгът на ириса се разгъва в правоъгълна карта: 12 сектора по часовника × 12 пръстена от зеницата навън, с отпечатани номера. Прави се в два варианта — за влакната и за цвета.',
  },
  {
    icon: Eye,
    title: 'Разчитане от AI модел',
    body: 'Моделът получава картата и връща само „какъв знак, в коя клетка“ от затворен списък. Всяко око се чете два пъти, срязано на различно място — знак, видян и в двата прочита, тежи повече.',
  },
  {
    icon: ShieldCheck,
    title: 'Проверка в кода',
    body: 'Отхвърля се знак на невъзможно място, в закрита клетка или с ниска сигурност. Цвят по цялата обиколка се брои за естествения цвят на ириса, не за знак.',
  },
  {
    icon: Calculator,
    title: 'Оценки по системи',
    body: 'Смятат се с формули в кода, не от AI: от знаците в ириса и от въпросника. Колкото по-слаба е снимката, толкова по-малко тежи ирисът.',
  },
  {
    icon: PencilSimpleLine,
    title: 'Текст и план',
    body: 'AI модел пише обяснението и плана по вече изчислените приоритети — не може да ги пренарежда. Ограниченията от въпросника (бременност, бъбреци, лекарства, непоносимости) са твърди забрани.',
  },
]

const EYE_SIGNS = [
  'Светъл пръстен по ръба на роговицата (arcus)',
  'Помътняване в зеницата',
  'Жълтеникав оттенък на бялото на окото',
  'Зачервено бяло на окото',
  'Кафеникаво-златист пръстен по периферията на ириса',
  'Тъмно петно (невус) върху ириса',
  'Неправилна форма на зеницата',
  'Израстък от ъгъла на окото към роговицата',
  'Различна големина на зениците',
  'Различен цвят на двата ириса',
]

const pubmed = (q: string) => `https://pubmed.ncbi.nlm.nih.gov/?term=${encodeURIComponent(q)}`

const SOURCES: Array<{ cite: string; note: string; url: string }> = [
  {
    cite: 'Simon A, Worthen DM, Mitas JA. An evaluation of iridology. JAMA. 1979;242(13):1385–1389.',
    note: 'Трима иридолози не разпознават бъбречно заболяване по снимки на ириса по-добре от случайност.',
    url: pubmed('Simon Worthen Mitas evaluation of iridology'),
  },
  {
    cite: 'Knipschild P. Looking for gall bladder disease in the patient’s iris. BMJ. 1988;297:1578–1581.',
    note: 'Пет иридолози не различават хора с възпаление на жлъчката от здрави.',
    url: pubmed('Knipschild gall bladder disease iris'),
  },
  {
    cite: 'Ernst E. Iridology: not useful and potentially harmful. Arch Ophthalmol. 2000;118(1):120–121.',
    note: 'Систематичен преглед на контролираните проучвания — без потвърдена диагностична стойност.',
    url: pubmed('Ernst iridology not useful and potentially harmful'),
  },
  {
    cite: 'Münstedt K et al. Can iridology detect susceptibility to cancer? J Altern Complement Med. 2005;11(3):515–519.',
    note: 'Проспективно проучване: иридологията не открива рак по-добре от случайност.',
    url: pubmed('Münstedt iridology cancer susceptibility'),
  },
  {
    cite: 'Australian Government. Natural Therapies Review 2024 — Iridology evidence evaluation.',
    note: 'Най-новият преглед на доказателствата: точността на иридологичната диагноза е около нивото на случайността.',
    url: 'https://www.health.gov.au/sites/default/files/2025-03/natural-therapies-review-2024-iridology-evidence-evaluation.pdf',
  },
  {
    cite: 'Daugman J. How iris recognition works. IEEE Trans Circuits Syst Video Technol. 2004;14(1):21–30.',
    note: 'Методът, по който кодът намира ръбовете на зеницата и ириса и разгъва ириса в карта.',
    url: 'https://scholar.google.com/scholar?q=Daugman+How+iris+recognition+works',
  },
]

function Section({ id, title, icon: I, open, onToggle, children }: {
  id: string
  title: string
  icon: Icon
  open: boolean
  onToggle: (id: string) => void
  children: React.ReactNode
}) {
  return (
    <Collapsible open={open} onOpenChange={() => onToggle(id)}>
      <Card className="gap-0 overflow-hidden py-0">
        <CollapsibleTrigger className="flex min-h-14 w-full items-center justify-between gap-3 px-4 py-3 text-left active:bg-muted/50">
          <span className="flex items-center gap-3">
            <I size={20} weight="duotone" className="shrink-0 text-primary" />
            <span className="font-semibold">{title}</span>
          </span>
          <CaretDown size={18} className={`shrink-0 text-muted-foreground transition-transform duration-200 ${open ? 'rotate-180' : ''}`} />
        </CollapsibleTrigger>
        <CollapsibleContent>
          <div className="space-y-3 px-4 pb-4 text-[15px] leading-relaxed text-muted-foreground">{children}</div>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  )
}

export default function AboutAirisScreen({ onBack }: AboutAirisScreenProps) {
  const [open, setOpen] = useState<Record<string, boolean>>({})
  const toggle = (id: string) => setOpen(prev => ({ ...prev, [id]: !prev[id] }))

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-2xl px-4 pb-12 pt-4">
        <Button variant="ghost" onClick={onBack} className="-ml-2 mb-4 min-h-11 gap-2">
          <ArrowLeft size={20} />
          Назад
        </Button>

        <h1 className="text-[28px] font-extrabold leading-tight tracking-tight">Как работи анализът</h1>
        <p className="mt-2 text-[16px] leading-relaxed text-muted-foreground">
          Две снимки и въпросник дават три отделни неща — с различна степен на доказаност.
        </p>

        <div className="mt-5 grid gap-2">
          {[
            { icon: GridFour, t: 'Карта на ириса', b: 'Знаците в ириса по иридологичната карта. Помощен сигнал.' },
            { icon: Eye, t: 'Очен скрининг', b: 'Видими знаци, при които е добре да се покажете на очен лекар.' },
            { icon: ClipboardText, t: 'План за хранене и навици', b: 'Стъпва основно на въпросника.' },
          ].map(x => (
            <div key={x.t} className="flex items-start gap-3 rounded-2xl bg-muted/40 p-3.5">
              <x.icon size={22} weight="duotone" className="mt-0.5 shrink-0 text-primary" />
              <div>
                <p className="font-semibold">{x.t}</p>
                <p className="text-sm text-muted-foreground">{x.b}</p>
              </div>
            </div>
          ))}
        </div>

        <h2 className="mt-8 text-[21px] font-bold">Стъпките</h2>
        <ol className="mt-3 space-y-3">
          {STEPS.map((s, i) => (
            <motion.li
              key={s.title}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: Math.min(i * 0.04, 0.3), duration: 0.2 }}
              className="flex items-start gap-3"
            >
              <span className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <s.icon size={20} weight="duotone" />
                <span className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-primary text-[11px] font-bold text-primary-foreground">
                  {i + 1}
                </span>
              </span>
              <div className="min-w-0">
                <p className="font-semibold leading-snug">{s.title}</p>
                <p className="text-[15px] leading-relaxed text-muted-foreground">{s.body}</p>
              </div>
            </motion.li>
          ))}
        </ol>

        <h2 className="mt-8 text-[21px] font-bold">Подробно</h2>
        <div className="mt-3 space-y-2">
          <Section id="signs" title={`Кои знаци се търсят в ириса (${FINDING_TYPES.length})`} icon={GridFour} open={!!open.signs} onToggle={toggle}>
            <p>Затворен списък — моделът не може да върне друго. Значението е по иридологичната традиция:</p>
            <ul className="space-y-1.5">
              {FINDING_TYPES.map(t => (
                <li key={t}>
                  <strong className="font-semibold text-foreground">{FINDINGS[t].label}</strong> — {FINDINGS[t].meaning}
                </li>
              ))}
            </ul>
            <p>
              Всеки знак се свързва със системи по сектора и пръстена, в които лежи. Оценките са за{' '}
              {SYSTEMS.length} системи: {SYSTEMS.map(s => s.label.toLowerCase()).join(', ')}.
            </p>
          </Section>

          <Section id="eye" title="Очен скрининг" icon={Eye} open={!!open.eye} onToggle={toggle}>
            <p>
              Отделен от иридологията. AI моделът гледа целия кадър — бялото на окото, ръба на роговицата, зеницата — и
              търси видими знаци, които лекарите също оценяват при преглед:
            </p>
            <ul className="list-disc space-y-1 pl-5">
              {EYE_SIGNS.map(s => (
                <li key={s}>{s}</li>
              ))}
            </ul>
            <p>
              Изходът е само насочване: няма нужда, профилактичен преглед, преглед в близките седмици или веднага.
              Възрастта се отчита — например arcus под 50 години е причина за липиден профил.
            </p>
            <p>Снимката не заменя преглед с биомикроскоп. Може да пропусне знак и може да види знак, който го няма.</p>
          </Section>

          <Section id="evidence" title="Научна основа — какво е доказано и какво не" icon={Flask} open={!!open.evidence} onToggle={toggle}>
            <p>
              <strong className="font-semibold text-foreground">Очните знаци</strong> от скрининга са част от
              обикновения очен и общ преглед. Те насочват към преглед, не поставят диагноза.
            </p>
            <p>
              <strong className="font-semibold text-foreground">Иридологичната карта</strong> — връзката между зона в
              ириса и орган — не е потвърдена в контролирани проучвания. Когато иридолози гледат снимки, без да знаят
              кой е болен, разпознават болните колкото при случаен избор (източниците са по-долу).
            </p>
            <p>Затова в airis:</p>
            <ul className="list-disc space-y-1 pl-5">
              <li>ирисът е помощен сигнал с ограничена тежест в оценките; основата на плана е въпросникът;</li>
              <li>текстът не назовава заболявания и не тълкува изследвания;</li>
              <li>картата показва къде да обърнете внимание, а не какво „имате“.</li>
            </ul>
          </Section>

          <Section id="measured" title="Какво е измерено в самото приложение" icon={Calculator} open={!!open.measured} onToggle={toggle}>
            <p>Тестове върху изкуствен ирис с известни знаци — проверяват веригата, не медицинската стойност:</p>
            <ul className="list-disc space-y-1 pl-5">
              <li>Координати: знак, поставен в клетка, стига до същата клетка на картата — 96 от 96.</li>
              <li>
                AI разчитане (тест с Gemini, август 2026): намира 3 от 3 нарисувани петна, но добавя и фалшиви — затова
                двойното четене и проверките в кода.
              </li>
              <li>Повторяемост между двата прочита на едно око: около 75 % съвпадение по място.</li>
              <li>Видът на знака (крипта или бразда) се повтаря по-слабо от мястото — затова оценките стъпват на мястото.</li>
            </ul>
            <p>Проверка срещу реални диагнози не е правена.</p>
          </Section>

          <Section id="limits" title="Какво airis не прави" icon={ShieldCheck} open={!!open.limits} onToggle={toggle}>
            <ul className="list-disc space-y-1 pl-5">
              <li>не поставя диагнози и не назначава лечение;</li>
              <li>не заменя лекар, нито очен преглед;</li>
              <li>не е за остри и спешни състояния — при тях 112 или лекар.</li>
            </ul>
          </Section>

          <Section id="sources" title="Източници" icon={BookOpen} open={!!open.sources} onToggle={toggle}>
            <ul className="space-y-3">
              {SOURCES.map(s => (
                <li key={s.cite}>
                  <a
                    href={s.url}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-start gap-1 font-medium text-foreground underline-offset-2 hover:underline"
                  >
                    {s.cite}
                    <ArrowSquareOut size={14} className="mt-1 shrink-0" />
                  </a>
                  <p className="text-sm">{s.note}</p>
                </li>
              ))}
            </ul>
          </Section>
        </div>
      </div>
    </div>
  )
}
