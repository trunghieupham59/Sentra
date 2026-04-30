/**
 * TokenTtlPicker — row of toggle-buttons for selecting a token TTL.
 * Extracted from SettingsPage (Chrome Extension › Create API key form).
 */
import { ButtonGroup } from './ButtonGroup'

export interface TokenTtlOption {
  days: number
  label: string
}

interface TokenTtlPickerProps {
  value: number
  onChange: (days: number) => void
  options: TokenTtlOption[]
}

export function TokenTtlPicker({ value, onChange, options }: TokenTtlPickerProps) {
  const btnOptions = options.map(({ days, label }) => ({ value: days, label }))
  return (
    <ButtonGroup
      value={value}
      onChange={onChange}
      options={btnOptions}
      containerClassName="flex-wrap"
    />
  )
}
