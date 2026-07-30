import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { NotificationToast } from '../NotificationToast'

describe('NotificationToast', () => {
  it('renders an accessible error notification with atomic actions', () => {
    const onAction = vi.fn()
    const onDismiss = vi.fn()

    render(
      <NotificationToast
        tone="error"
        title="Voice input is unavailable"
        message="Check microphone access and STT settings."
        actionLabel="Open Settings"
        onAction={onAction}
        dismissLabel="Dismiss"
        onDismiss={onDismiss}
      />,
    )

    expect(screen.getByRole('alert')).toHaveTextContent('Voice input is unavailable')
    expect(screen.getByRole('alert')).toHaveClass('notification-toast--error')

    const action = screen.getByRole('button', { name: 'Open Settings' })
    const dismiss = screen.getByRole('button', { name: 'Dismiss' })
    expect(action).toHaveAttribute('data-control-size', 'sm')
    expect(dismiss).toHaveAttribute('data-control-size', 'sm')

    fireEvent.click(action)
    fireEvent.click(dismiss)
    expect(onAction).toHaveBeenCalledOnce()
    expect(onDismiss).toHaveBeenCalledOnce()
  })
})
