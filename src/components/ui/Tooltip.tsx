import { useState, useRef, useEffect, type ReactNode } from 'react'
import { createPortal } from 'react-dom'

type TooltipSide = 'top' | 'bottom' | 'left' | 'right'

type TooltipProps = {
  content: string
  side?: TooltipSide
  delay?: number
  children: ReactNode
  disabled?: boolean
}

export function Tooltip({
  content,
  side = 'top',
  delay = 600,
  children,
  disabled = false,
}: TooltipProps) {
  const [visible, setVisible] = useState(false)
  const [pos, setPos] = useState({ top: 0, left: 0 })
  const triggerRef = useRef<HTMLDivElement>(null)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [])

  const show = () => {
    if (disabled) return
    timerRef.current = setTimeout(() => {
      if (!triggerRef.current) return
      const rect = triggerRef.current.getBoundingClientRect()
      const offset = 8

      let top = 0
      let left = 0

      switch (side) {
        case 'top':
          top = rect.top - offset
          left = rect.left + rect.width / 2
          break
        case 'bottom':
          top = rect.bottom + offset
          left = rect.left + rect.width / 2
          break
        case 'left':
          top = rect.top + rect.height / 2
          left = rect.left - offset
          break
        case 'right':
          top = rect.top + rect.height / 2
          left = rect.right + offset
          break
      }

      setPos({ top, left })
      setVisible(true)
    }, delay)
  }

  const hide = () => {
    if (timerRef.current) clearTimeout(timerRef.current)
    setVisible(false)
  }

  const transformMap: Record<TooltipSide, string> = {
    top: 'translate(-50%, -100%)',
    bottom: 'translate(-50%, 0)',
    left: 'translate(-100%, -50%)',
    right: 'translate(0, -50%)',
  }

  return (
    <div
      ref={triggerRef}
      onMouseEnter={show}
      onMouseLeave={hide}
      onFocus={show}
      onBlur={hide}
      className="inline-flex"
    >
      {children}
      {visible &&
        createPortal(
          <div
            role="tooltip"
            style={{
              position: 'fixed',
              top: pos.top,
              left: pos.left,
              transform: transformMap[side],
              zIndex: 9999,
            }}
            className="pointer-events-none px-2 py-1 rounded-md text-[12px] leading-[16px] text-white bg-[rgba(50,50,50,0.92)] shadow-lg animate-[fadeIn_150ms_ease-out] whitespace-nowrap"
          >
            {content}
          </div>,
          document.body,
        )}
    </div>
  )
}
