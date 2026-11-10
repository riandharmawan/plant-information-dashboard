import { createContext, useContext, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import type { CommodityClass } from '../../domain/management.ts'

const SHOW_DELAY = 90
const HIDE_DELAY = 160
const CARD_WIDTH = 320

/**
 * Where a card can lead. The page provides these, so a card can open a site, a commodity, a tank or a
 * list of flagged tanks without every card being handed the navigation.
 */
export interface CardActions {
  openSite: (siteId: string) => void
  openClass: (siteId: string, cls: CommodityClass, product?: string) => void
  openCommodity: (cls: CommodityClass) => void
  openTank: (siteId: string, tankId: string) => void
  openStatus: (status: string) => void
}

const noop = () => undefined
export const CardActionsContext = createContext<CardActions>({
  openSite: noop,
  openClass: noop,
  openCommodity: noop,
  openTank: noop,
  openStatus: noop,
})
export const useCardActions = () => useContext(CardActionsContext)

interface Anchor {
  left: number
  top: number
  width: number
  height: number
}

export interface HoverState {
  key: string
  root: HTMLElement
  /** The target's box, relative to the page root the card is placed in. */
  anchor: Anchor
}

/**
 * The timing every card shares: it opens after a short pause, stays while the pointer is on the target
 * or the card, and closes shortly after it leaves, so the card can be moved into.
 */
export function useHoverCard() {
  const [state, setState] = useState<HoverState | null>(null)
  const timer = useRef<number | undefined>(undefined)

  const open = (key: string, element: HTMLElement, delay = SHOW_DELAY) => {
    window.clearTimeout(timer.current)
    timer.current = window.setTimeout(() => {
      const root = element.closest<HTMLElement>('.mg')
      if (!root) return
      const box = element.getBoundingClientRect()
      const page = root.getBoundingClientRect()
      setState({ key, root, anchor: { left: box.left - page.left, top: box.top - page.top, width: box.width, height: box.height } })
    }, delay)
  }
  const close = () => {
    window.clearTimeout(timer.current)
    timer.current = window.setTimeout(() => setState(null), HIDE_DELAY)
  }
  const keep = () => window.clearTimeout(timer.current)
  const hide = () => {
    window.clearTimeout(timer.current)
    setState(null)
  }
  return { state, open, close, keep, hide }
}

/**
 * The card itself: placed under its target, or above it when there is no room, kept inside the page, with
 * an arrow at the target. Every card uses it, so they look and behave the same.
 */
export function HoverCardShell({
  state,
  label,
  onEnter,
  onLeave,
  children,
}: {
  state: HoverState
  label: string
  onEnter: () => void
  onLeave: () => void
  children: ReactNode
}) {
  const card = useRef<HTMLDivElement>(null)
  const [above, setAbove] = useState(false)

  useLayoutEffect(() => {
    const element = card.current
    if (!element) return
    const height = element.getBoundingClientRect().height
    const page = state.root.getBoundingClientRect()
    const anchorTop = page.top + state.anchor.top
    const anchorBottom = anchorTop + state.anchor.height
    setAbove(anchorBottom + 8 + height > window.innerHeight - 8 && anchorTop - 8 - height > 8)
  }, [state])

  const width = Math.min(CARD_WIDTH, state.root.clientWidth - 16)
  const center = state.anchor.left + state.anchor.width / 2
  const left = Math.max(8, Math.min(center - width / 2, state.root.clientWidth - width - 8))
  const top = above ? undefined : state.anchor.top + state.anchor.height + 8
  const bottom = above ? state.root.clientHeight - state.anchor.top + 8 : undefined
  const arrow = Math.max(14, Math.min(center - left, width - 14))

  return (
    <div
      ref={card}
      className={above ? 'mg-tip mg-tip--above' : 'mg-tip'}
      role="dialog"
      aria-label={label}
      style={{ left, top, bottom, width, ['--arrow' as string]: `${arrow}px` }}
      onMouseEnter={onEnter}
      onMouseLeave={onLeave}
      // The card sits inside its target in the React tree, so a click on it must not trigger the target too.
      onClick={(event) => event.stopPropagation()}
    >
      {children}
    </div>
  )
}

/**
 * Wraps anything that should open a card on hover or keyboard focus. `card` receives a function that
 * closes the card, for a card that navigates away.
 */
export function HoverTarget({
  cardKey,
  label,
  card,
  className,
  as: Tag = 'div',
  focusable = true,
  children,
}: {
  cardKey: string
  label: string
  card: (hide: () => void) => ReactNode
  className?: string
  as?: 'div' | 'span'
  /** False inside something that is already focusable, such as a row button. */
  focusable?: boolean
  children: ReactNode
}) {
  const hover = useHoverCard()
  return (
    <Tag
      className={className}
      tabIndex={focusable ? 0 : undefined}
      onMouseEnter={(event: React.MouseEvent<HTMLElement>) => hover.open(cardKey, event.currentTarget)}
      onMouseLeave={hover.close}
      onFocus={(event: React.FocusEvent<HTMLElement>) => hover.open(cardKey, event.currentTarget, 0)}
      onBlur={hover.close}
      onKeyDown={(event: React.KeyboardEvent) => event.key === 'Escape' && hover.hide()}
    >
      {children}
      {hover.state
        ? createPortal(
            <HoverCardShell state={hover.state} label={label} onEnter={hover.keep} onLeave={hover.close}>
              {card(hover.hide)}
            </HoverCardShell>,
            hover.state.root,
          )
        : null}
    </Tag>
  )
}
