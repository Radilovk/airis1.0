import { House, ClockCounterClockwise } from '@phosphor-icons/react'

/**
 * Горната лента на приложението — като в Eatologix: марката в средата, „Начало“ вляво,
 * избор на език и „Моите анализи“ вдясно. Стъклена, залепена горе, с отстъп за изреза на телефона.
 * Изборът на език (<select data-lang-picker>) се попълва от i18n.js.
 */
export default function AppHeader({ onHistory }: { onHistory?: () => void }) {
  const base = import.meta.env.BASE_URL
  return (
    <header
      className="sticky top-0 z-40 border-b border-[rgba(3,147,156,0.1)] bg-background/80 backdrop-blur-xl"
      style={{ paddingTop: 'env(safe-area-inset-top, 0px)' }}
    >
      <div className="mx-auto flex h-14 max-w-4xl items-center justify-between gap-2 px-3">
        <a
          href={base}
          aria-label="Начало"
          className="flex size-11 items-center justify-center rounded-full text-foreground/70 transition-colors hover:bg-primary/10 hover:text-primary"
        >
          <House size={22} weight="bold" />
        </a>
        <a href={base} className="flex items-center gap-2 no-underline" aria-label="IrisMap — начало">
          <img src={`${base}brand/mark.svg`} alt="" width={28} height={28} className="size-7" />
          <span className="font-[Montserrat,Inter,sans-serif] text-[17px] font-semibold tracking-[0.04em] text-[#034E5C]">
            IRIS<b className="font-semibold text-[#08B5B9]">M</b><b className="font-semibold text-[#06C3AA]">A</b><b className="font-semibold text-[#07CF61]">P</b>
          </span>
        </a>
        <div className="flex items-center gap-1">
          <select
            data-lang-picker="short"
            aria-label="Език / Language"
            className="h-9 rounded-full border border-[rgba(3,147,156,0.2)] bg-card px-2 text-[13px] font-bold text-foreground"
          />
          {onHistory && (
            <button
              type="button"
              onClick={onHistory}
              aria-label="Моите анализи"
              className="flex size-11 items-center justify-center rounded-full text-foreground/70 transition-colors hover:bg-primary/10 hover:text-primary"
            >
              <ClockCounterClockwise size={22} weight="bold" />
            </button>
          )}
        </div>
      </div>
    </header>
  )
}
