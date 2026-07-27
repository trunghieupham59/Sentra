import { fireEvent, render, screen, within } from '@testing-library/react'
import { useState } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { ImageLightbox } from '../ImageLightbox'

const labels = {
  previewLabel: 'Image preview',
  toolbarLabel: 'Image actions',
  copyLabel: 'Copy image',
  downloadLabel: 'Download image',
  closeLabel: 'Close image preview',
}

describe('ImageLightbox', () => {
  it('groups equal-size neutral utility actions in one toolbar', () => {
    const onCopy = vi.fn()
    const onDownload = vi.fn()

    render(
      <ImageLightbox
        src="data:image/png;base64,image"
        alt="Generated image"
        {...labels}
        onCopy={onCopy}
        onDownload={onDownload}
        onClose={vi.fn()}
      />,
    )

    const dialog = screen.getByRole('dialog', { name: labels.previewLabel })
    const toolbar = within(dialog).getByRole('toolbar', { name: labels.toolbarLabel })
    const controls = within(toolbar).getAllByRole('button')
    expect(controls).toHaveLength(3)
    for (const control of controls) {
      expect(control).toHaveAttribute('data-control-size', 'md')
      expect(control).toHaveAttribute('data-control-shape', 'icon')
      expect(control).toHaveAttribute('data-control-variant', 'neutral')
      expect(control).toHaveAttribute('data-control-appearance', 'ghost')
    }

    fireEvent.click(within(toolbar).getByRole('button', { name: labels.copyLabel }))
    fireEvent.click(within(toolbar).getByRole('button', { name: labels.downloadLabel }))
    expect(onCopy).toHaveBeenCalledOnce()
    expect(onDownload).toHaveBeenCalledOnce()
  })

  it('closes from Escape or backdrop and traps keyboard focus inside the toolbar', () => {
    const onClose = vi.fn()
    render(
      <ImageLightbox
        src="data:image/png;base64,image"
        alt="Generated image"
        {...labels}
        onCopy={vi.fn()}
        onDownload={vi.fn()}
        onClose={onClose}
      />,
    )

    const dialog = screen.getByRole('dialog', { name: labels.previewLabel })
    const copyButton = screen.getByRole('button', { name: labels.copyLabel })
    const closeButton = screen.getByRole('button', { name: labels.closeLabel })
    expect(closeButton).toHaveFocus()

    fireEvent.keyDown(document, { key: 'Tab' })
    expect(copyButton).toHaveFocus()
    fireEvent.keyDown(document, { key: 'Tab', shiftKey: true })
    expect(closeButton).toHaveFocus()

    fireEvent.keyDown(document, { key: 'Escape' })
    fireEvent.mouseDown(dialog)
    expect(onClose).toHaveBeenCalledTimes(2)
  })

  it('restores focus to the preview trigger after closing', () => {
    function Harness() {
      const [open, setOpen] = useState(false)
      return (
        <>
          <button type="button" onClick={() => setOpen(true)}>Open preview</button>
          {open && (
            <ImageLightbox
              src="data:image/png;base64,image"
              alt="Generated image"
              {...labels}
              onClose={() => setOpen(false)}
            />
          )}
        </>
      )
    }

    render(<Harness />)
    const trigger = screen.getByRole('button', { name: 'Open preview' })
    trigger.focus()
    fireEvent.click(trigger)
    fireEvent.click(screen.getByRole('button', { name: labels.closeLabel }))
    expect(trigger).toHaveFocus()
  })
})
