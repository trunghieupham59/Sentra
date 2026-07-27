import { render } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { AppLogoIcon } from '../AppLogo'

describe('AppLogoIcon', () => {
  it('uses semantic brand-mark sizes without mutating the source image', () => {
    const { container, rerender } = render(<AppLogoIcon size="sm" />)
    const logo = container.querySelector('img')
    if (!logo) throw new Error('Expected app logo')
    expect(logo).toHaveClass('app-logo', 'app-logo--sm')
    expect(logo).not.toHaveAttribute('width')

    rerender(<AppLogoIcon size={42} />)
    expect(logo).toHaveAttribute('width', '42')
    expect(logo).toHaveAttribute('height', '42')
    expect(logo).not.toHaveClass('app-logo--sm')
  })
})
