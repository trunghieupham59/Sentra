import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { ChatSessionListItem } from '../ChatSessionListItem'

describe('ChatSessionListItem', () => {
  it('keeps selection and deletion as independent controls', () => {
    const onSelect = vi.fn()
    const onDelete = vi.fn()
    render(
      <ChatSessionListItem
        id="chat-1"
        title="Release planning"
        provider="claude"
        model="claude-sonnet-4"
        timeLabel="Just now"
        messageCount={4}
        messageUnitLabel="messages"
        active
        deleteLabel="Delete"
        pendingResearchLabel="Resume research"
        onSelect={onSelect}
        onDelete={onDelete}
      />,
    )

    expect(screen.getByRole('button', {
      name: 'Release planning, claude, claude-sonnet-4, Just now, 4 messages',
    })).toHaveAttribute('aria-current', 'true')
    const deleteButton = screen.getByRole('button', {
      name: 'Delete: Release planning, claude, claude-sonnet-4, Just now, 4 messages',
    })
    expect(deleteButton).toHaveAttribute('data-control-size', 'xs')
    expect(deleteButton).toHaveAttribute('data-control-variant', 'danger')
    expect(deleteButton).toHaveAttribute('data-control-appearance', 'ghost')
    fireEvent.click(deleteButton)

    expect(onDelete).toHaveBeenCalledWith('chat-1')
    expect(onSelect).not.toHaveBeenCalled()
  })

  it('disambiguates delete controls when conversations share a title', () => {
    const commonProps = {
      title: 'Release planning',
      timeLabel: 'Just now',
      messageCount: 0,
      messageUnitLabel: 'messages',
      active: false,
      deleteLabel: 'Delete',
      pendingResearchLabel: 'Resume research',
      onSelect: vi.fn(),
      onDelete: vi.fn(),
    }

    render(
      <ul>
        <ChatSessionListItem
          {...commonProps}
          id="chat-openai"
          provider="openai"
          model="gpt-5-mini"
        />
        <ChatSessionListItem
          {...commonProps}
          id="chat-claude"
          provider="claude"
          model="claude-sonnet-4"
        />
      </ul>,
    )

    expect(screen.getByRole('button', {
      name: 'Delete: Release planning, openai, gpt-5-mini, Just now, 0 messages',
    })).toBeInTheDocument()
    expect(screen.getByRole('button', {
      name: 'Delete: Release planning, claude, claude-sonnet-4, Just now, 0 messages',
    })).toBeInTheDocument()
  })
})
