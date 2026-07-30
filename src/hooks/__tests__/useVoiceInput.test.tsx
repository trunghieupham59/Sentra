import { act, renderHook } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { useVoiceInput } from '../useVoiceInput'

describe('useVoiceInput', () => {
  it('appends a final transcript without changing intentional trailing whitespace', () => {
    const onTextChange = vi.fn()
    const { result } = renderHook(() => useVoiceInput({
      currentText: 'Draft \n',
      onTextChange,
    }))

    act(() => result.current.handleVoiceRecordingChange(true))
    act(() => result.current.handleVoiceTranscript('spoken text', true))

    expect(onTextChange).toHaveBeenLastCalledWith('Draft \nspoken text')
  })

  it('adds one separator when needed and restores the exact original value on cancel', () => {
    const onTextChange = vi.fn()
    const { result } = renderHook(() => useVoiceInput({
      currentText: 'Typed draft',
      onTextChange,
    }))

    act(() => result.current.handleVoiceRecordingChange(true))
    act(() => result.current.handleVoiceTranscript('voice', true))
    expect(onTextChange).toHaveBeenLastCalledWith('Typed draft voice')

    act(() => result.current.cancelVoiceInput())
    expect(onTextChange).toHaveBeenLastCalledWith('Typed draft')
  })
})
