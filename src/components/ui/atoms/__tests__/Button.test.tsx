import { fireEvent, render, screen } from '@testing-library/react'
import { createRef } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { Button } from '../Button'

describe('Button', () => {
  it('uses the safe default type and publishes its atomic control contract', () => {
    const ref = createRef<HTMLButtonElement>()

    render(
      <Button ref={ref} className="feature-button">
        Continue
      </Button>,
    )

    const button = screen.getByRole('button', { name: 'Continue' })
    expect(button).toHaveAttribute('type', 'button')
    expect(button).toHaveAttribute('data-ui-control', 'button')
    expect(button).toHaveAttribute('data-control-size', 'md')
    expect(button).toHaveAttribute('data-control-shape', 'pill')
    expect(button).toHaveAttribute('data-control-variant', 'neutral')
    expect(button).toHaveAttribute('data-control-appearance', 'outline')
    expect(button).toHaveAttribute('data-control-state', 'enabled')
    expect(button).toHaveClass(
      'ui-button',
      'ui-button-md',
      'ui-button-pill',
      'ui-button-variant-neutral',
      'ui-button-appearance-outline',
      'feature-button',
    )
    expect(ref.current).toBe(button)
  })

  it('applies explicit size and shape while forwarding native and ARIA props', () => {
    const onClick = vi.fn()

    render(
      <Button
        size="sm"
        shape="icon"
        aria-label="Attach file"
        aria-pressed="false"
        onClick={onClick}
      />,
    )

    const button = screen.getByRole('button', { name: 'Attach file' })
    expect(button).toHaveAttribute('data-control-size', 'sm')
    expect(button).toHaveAttribute('data-control-shape', 'icon')
    expect(button).toHaveAttribute('aria-pressed', 'false')
    expect(button).toHaveClass('ui-button-sm', 'ui-button-icon')

    fireEvent.click(button)
    expect(onClick).toHaveBeenCalledTimes(1)
  })

  it.each(['neutral', 'primary', 'danger'] as const)(
    'publishes the %s semantic variant',
    (variant) => {
      render(<Button variant={variant}>{variant}</Button>)

      const button = screen.getByRole('button', { name: variant })
      expect(button).toHaveAttribute('data-control-variant', variant)
      expect(button).toHaveClass(`ui-button-variant-${variant}`)
      expect(button).toHaveAttribute(
        'data-control-appearance',
        variant === 'primary' ? 'solid' : variant === 'danger' ? 'soft' : 'outline',
      )
    },
  )

  it('separates semantic meaning from visual emphasis', () => {
    render(
      <Button size="xs" shape="rect" variant="primary" appearance="soft">
        Active mode
      </Button>,
    )

    const button = screen.getByRole('button', { name: 'Active mode' })
    expect(button).toHaveAttribute('data-control-size', 'xs')
    expect(button).toHaveAttribute('data-control-shape', 'rect')
    expect(button).toHaveAttribute('data-control-variant', 'primary')
    expect(button).toHaveAttribute('data-control-appearance', 'soft')
    expect(button).toHaveClass('ui-button-xs', 'ui-button-rect', 'ui-button-appearance-soft')
  })

  it('uses native disabled behavior and publishes the gray-state hook', () => {
    const onClick = vi.fn()
    render(
      <Button variant="primary" disabled onClick={onClick}>
        Create
      </Button>,
    )

    const button = screen.getByRole('button', { name: 'Create' })
    expect(button).toBeDisabled()
    expect(button).toHaveAttribute('data-control-state', 'disabled')
    fireEvent.click(button)
    expect(onClick).not.toHaveBeenCalled()
  })
})
