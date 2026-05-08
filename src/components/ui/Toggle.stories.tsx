import type { Meta, StoryObj } from '@storybook/react'
import { useState } from 'react'
import { Toggle } from './Toggle'

const meta: Meta<typeof Toggle> = {
  title: 'UI/Toggle',
  component: Toggle,
  tags: ['autodocs'],
  argTypes: {
    checked: { control: 'boolean' },
    disabled: { control: 'boolean' },
    size: { control: 'select', options: ['sm', 'md'] },
  },
}

export default meta
type Story = StoryObj<typeof Toggle>

export const On: Story = {
  render: () => {
    const [checked, setChecked] = useState(true)
    return <Toggle checked={checked} onChange={setChecked} label="Tự động dịch" />
  },
}

export const Off: Story = {
  render: () => {
    const [checked, setChecked] = useState(false)
    return <Toggle checked={checked} onChange={setChecked} label="Lưu lịch sử" />
  },
}

export const Disabled: Story = {
  render: () => (
    <Toggle checked={true} onChange={() => {}} disabled label="Không thể thay đổi" />
  ),
}

export const Small: Story = {
  render: () => {
    const [checked, setChecked] = useState(true)
    return <Toggle checked={checked} onChange={setChecked} size="sm" label="Nhỏ hơn" />
  },
}

export const Interactive: Story = {
  render: () => {
    const [autoTranslate, setAutoTranslate] = useState(true)
    const [saveHistory, setSaveHistory] = useState(false)
    const [furigana, setFurigana] = useState(true)

    return (
      <div className="flex flex-col gap-4 p-4 rounded-xl bg-[var(--apple-bg-secondary)] min-w-[280px]">
        <Toggle checked={autoTranslate} onChange={setAutoTranslate} label="Tự động dịch" />
        <Toggle checked={saveHistory} onChange={setSaveHistory} label="Lưu lịch sử" />
        <Toggle checked={furigana} onChange={setFurigana} label="Furigana tự động" />
      </div>
    )
  },
}
