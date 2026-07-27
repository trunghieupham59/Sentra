import { fireEvent, render, screen } from '@testing-library/react'
import { createRef } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { Input } from '../Input'

describe('Input', () => {
  it('publishes its shared control contract and forwards native props', () => {
    const ref = createRef<HTMLInputElement>()
    const onChange = vi.fn()
    render(
      <Input
        ref={ref}
        size="sm"
        type="search"
        aria-label="Search"
        placeholder="Search…"
        onChange={onChange}
      />,
    )

    const input = screen.getByRole('searchbox', { name: 'Search' })
    expect(input).toHaveAttribute('data-ui-control', 'input')
    expect(input).toHaveAttribute('data-control-size', 'sm')
    expect(input).toHaveClass('ui-input', 'ui-input-sm')
    expect(ref.current).toBe(input)

    fireEvent.change(input, { target: { value: 'model' } })
    expect(onChange).toHaveBeenCalledOnce()
  })
})
