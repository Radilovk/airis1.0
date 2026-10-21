import { useEffect, useState } from 'react'

/**
 * Колко пиксела от долния край на екрана заема екранната клавиатура.
 *
 * iOS Safari (и Android Chrome без `interactive-widget=resizes-content`) не
 * свиват страницата при отворена клавиатура — тя просто се рисува отгоре.
 * Елемент с `position: fixed; bottom: 0` остава зад нея. `visualViewport`
 * показва видимата част; разликата до прозореца е височината на клавиатурата.
 */
export function useKeyboardInset(): number {
  const [inset, setInset] = useState(0)

  useEffect(() => {
    const vv = window.visualViewport
    if (!vv) return
    const update = () => {
      const covered = window.innerHeight - vv.height - vv.offsetTop
      // Под ~80 px е лентата на браузъра или закръгляне, не клавиатура.
      setInset(covered > 80 ? Math.round(covered) : 0)
    }
    update()
    vv.addEventListener('resize', update)
    vv.addEventListener('scroll', update)
    return () => {
      vv.removeEventListener('resize', update)
      vv.removeEventListener('scroll', update)
    }
  }, [])

  return inset
}
