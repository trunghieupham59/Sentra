import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { PromptCard } from '../PromptCard'

describe('PromptCard', () => {
  it('renders its content and forwards selection', () => {
    const onClick = vi.fn()

    render(
      <PromptCard
        icon={<span aria-hidden="true">+</span>}
        title="Translate"
        description="Translate a document"
        tone="blue"
        onClick={onClick}
      />,
    )

    const card = screen.getByRole('button', { name: /translate/i })
    expect(card).toHaveClass('prompt-card-blue')
    fireEvent.click(card)
    expect(onClick).toHaveBeenCalledOnce()
  })
})
