import type { Provider } from '../../../types'
import { ProviderIcon } from '../../ProviderIcon'
import { Button } from '../atoms/Button'
import { TrashIcon } from '../icons'

export interface ChatSessionListItemProps {
  id: string
  title: string
  provider: Provider
  model: string
  timeLabel: string
  messageCount: number
  messageUnitLabel: string
  active: boolean
  deleteLabel: string
  pendingResearchLabel: string
  hasPendingResearch?: boolean
  onSelect: (id: string) => void
  onDelete: (id: string) => void
}

/**
 * Pure conversation row used by the AI Chat sidebar.
 * Selection and deletion are sibling buttons so the markup remains valid.
 */
export function ChatSessionListItem({
  id,
  title,
  provider,
  model,
  timeLabel,
  messageCount,
  messageUnitLabel,
  active,
  deleteLabel,
  pendingResearchLabel,
  hasPendingResearch = false,
  onSelect,
  onDelete,
}: ChatSessionListItemProps) {
  const selectionLabel = [
    title,
    provider,
    model,
    timeLabel,
    `${messageCount} ${messageUnitLabel}`,
    hasPendingResearch ? pendingResearchLabel : '',
  ].filter(Boolean).join(', ')

  return (
    <li className={`chat-session-item${active ? ' chat-session-item--active' : ''}`}>
      {/* Composite row selector is the deliberate native-button exception;
          applying atomic control height would break the two-line row layout. */}
      <button
        type="button"
        className="chat-session-select"
        aria-label={selectionLabel}
        aria-current={active ? 'true' : undefined}
        onClick={() => onSelect(id)}
      >
        <span className="chat-session-provider" aria-hidden="true">
          <ProviderIcon provider={provider} size={13} />
        </span>
        <span className="chat-session-copy">
          <span className="chat-session-title">{title}</span>
          <span className="chat-session-meta">
            <span>{timeLabel}</span>
            {messageCount > 0 && <span aria-hidden="true">·</span>}
            {messageCount > 0 && <span>{messageCount}</span>}
            {hasPendingResearch && <span className="chat-session-research-dot" aria-hidden="true" />}
          </span>
        </span>
      </button>
      <Button
        size="xs"
        shape="icon"
        variant="danger"
        appearance="ghost"
        className="chat-session-delete"
        aria-label={`${deleteLabel}: ${selectionLabel}`}
        onClick={() => onDelete(id)}
      >
        <TrashIcon className="h-3 w-3" />
      </Button>
    </li>
  )
}
