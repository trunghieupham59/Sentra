import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useAppStore } from '../../store/useAppStore'
import { ModelSelector } from '../ModelSelector'

const LOCAL_MODELS = [
  { id: 'local-auto', name: 'Auto local model', description: 'Best running local model' },
  { id: 'qwen3:4b', name: 'Qwen3 4B', description: 'Balanced local model' },
]

type FetchModelsResult = Awaited<ReturnType<typeof window.api.fetchModels>>

describe('ModelSelector', () => {
  beforeEach(() => {
    act(() => {
      useAppStore.setState({
        locale: 'en',
        selectedProvider: 'local',
        selectedModels: {
          local: 'local-auto',
          gemini: 'gemini-2.5-flash',
          claude: 'claude-sonnet-4-20250514',
          openai: 'gpt-5-mini',
        },
        keyStatus: { local: false, gemini: false, claude: false, openai: false },
        dynamicModels: { local: LOCAL_MODELS, gemini: [], claude: [], openai: [] },
        modelsLoading: { local: false, gemini: false, claude: false, openai: false },
        modelsError: { local: null, gemini: null, claude: null, openai: null },
        recentModels: [],
      })
    })
    vi.mocked(window.api.fetchModels).mockReset()
    vi.mocked(window.api.fetchModels).mockResolvedValue({ success: false, models: [] })
  })

  it('opens the composer picker above the trigger and drills into model search', async () => {
    const onSelectionChange = vi.fn()
    render(<ModelSelector compact onSelectionChange={onSelectionChange} />)

    const trigger = screen.getByRole('button', { name: /auto local model/i })
    vi.spyOn(trigger, 'getBoundingClientRect').mockReturnValue({
      x: 560,
      y: 700,
      top: 700,
      right: 720,
      bottom: 732,
      left: 560,
      width: 160,
      height: 32,
      toJSON: () => ({}),
    })

    fireEvent.click(trigger)

    const panel = await screen.findByRole('dialog', { name: 'Model' })
    await waitFor(() => expect(panel).toHaveClass('model-picker-panel--above'))
    expect(Number.parseFloat(panel.style.top)).toBeLessThan(700)

    fireEvent.click(screen.getByRole('button', { name: 'Model: Auto local model' }))
    const search = await screen.findByRole('searchbox', { name: 'Search models…' })
    fireEvent.change(search, { target: { value: 'Qwen3' } })
    fireEvent.click(screen.getByRole('button', { name: 'Qwen3 4B' }))

    expect(useAppStore.getState().selectedModels.local).toBe('qwen3:4b')
    expect(onSelectionChange).toHaveBeenCalledWith('local', 'qwen3:4b')
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('shows provider and advanced subviews without exposing unsupported controls', async () => {
    render(<ModelSelector compact />)
    fireEvent.click(screen.getByRole('button', { name: /auto local model/i }))

    fireEvent.click(await screen.findByRole('button', { name: 'Provider: Local AI' }))
    expect(screen.getByRole('button', { name: 'Local AI' })).toHaveAttribute('aria-current', 'true')

    fireEvent.click(screen.getByRole('button', { name: 'Back' }))
    fireEvent.click(screen.getByRole('button', { name: 'Advanced' }))

    expect(screen.getByText('local-auto')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Refresh' })).toBeEnabled()
  })

  it('closes on Escape and restores focus to the trigger', async () => {
    render(<ModelSelector compact />)
    const trigger = screen.getByRole('button', { name: /auto local model/i })

    fireEvent.click(trigger)
    await screen.findByRole('dialog')
    fireEvent.keyDown(document, { key: 'Escape' })

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    await waitFor(() => expect(trigger).toHaveFocus())
  })

  it('falls back below the compact trigger when there is no room above', async () => {
    render(<ModelSelector compact />)
    const trigger = screen.getByRole('button', { name: /auto local model/i })
    vi.spyOn(trigger, 'getBoundingClientRect').mockReturnValue({
      x: 560,
      y: 8,
      top: 8,
      right: 720,
      bottom: 40,
      left: 560,
      width: 160,
      height: 32,
      toJSON: () => ({}),
    })

    fireEvent.click(trigger)

    const panel = await screen.findByRole('dialog', { name: 'Model' })
    await waitFor(() => expect(panel).toHaveClass('model-picker-panel--below'))
    expect(Number.parseFloat(panel.style.top)).toBeGreaterThanOrEqual(40)
  })

  it('does not let an in-flight refresh overwrite a newer model choice', async () => {
    act(() => {
      useAppStore.setState({
        dynamicModels: { local: [], gemini: [], claude: [], openai: [] },
      })
    })
    let resolveFetch!: (value: FetchModelsResult) => void
    const pendingFetch = new Promise<FetchModelsResult>((resolve) => {
      resolveFetch = resolve
    })
    vi.mocked(window.api.fetchModels).mockImplementation(() => pendingFetch)

    render(<ModelSelector compact />)
    await waitFor(() => expect(window.api.fetchModels).toHaveBeenCalledWith('local'))
    fireEvent.click(screen.getByRole('button', { name: /auto local model/i }))
    fireEvent.click(screen.getByRole('button', { name: 'Model: Auto local model' }))
    fireEvent.click(screen.getByRole('button', { name: 'Qwen3 4B' }))

    await act(async () => {
      resolveFetch({ success: true, models: LOCAL_MODELS, recommendedModel: 'local-auto' })
      await pendingFetch
    })

    expect(useAppStore.getState().selectedModels.local).toBe('qwen3:4b')
  })

  it('loads and displays the exact model ID returned by the provider', async () => {
    act(() => {
      useAppStore.setState({
        selectedProvider: 'claude',
        keyStatus: { local: false, gemini: false, claude: true, openai: false },
        dynamicModels: {
          local: LOCAL_MODELS,
          gemini: [],
          claude: [{ id: 'claude-sonnet-4-20250514', name: 'Claude Sonnet 4', description: '' }],
          openai: [],
        },
      })
    })
    vi.mocked(window.api.fetchModels).mockResolvedValue({
      success: true,
      models: [{ id: 'claude-sonnet-4-6', name: 'Claude Sonnet 4.6', description: 'Balanced' }],
      recommendedModel: 'claude-sonnet-4-6',
    })

    render(<ModelSelector compact />)
    fireEvent.click(screen.getByRole('button', { name: /claude sonnet 4/i }))
    fireEvent.click(screen.getByRole('button', { name: 'Advanced' }))
    expect(screen.getByText('claude-sonnet-4-20250514')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Refresh' }))

    expect(await screen.findByText('claude-sonnet-4-6')).toBeInTheDocument()
    expect(useAppStore.getState().selectedModels.claude).toBe('claude-sonnet-4-6')
  })
})
