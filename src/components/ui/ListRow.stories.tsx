import type { Meta, StoryObj } from '@storybook/react'
import { Wifi, Bluetooth, Key, Globe, Palette, Info } from 'lucide-react'
import { ListRow, ListGroup } from './ListRow'
import { Toggle } from './Toggle'
import { useState } from 'react'

const meta: Meta<typeof ListRow> = {
  title: 'UI/ListRow',
  component: ListRow,
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component: 'macOS Settings-style list row. Supports icon với màu background, label, description, value, chevron.',
      },
    },
  },
}

export default meta
type Story = StoryObj<typeof ListRow>

export const Basic: Story = {
  args: { label: 'Wi-Fi', chevron: true },
}

export const WithColoredIcon: Story = {
  args: {
    icon: { element: <Wifi size={14} strokeWidth={1.5} />, bgColor: '#007AFF' },
    label: 'Wi-Fi',
    value: 'Viezan Network',
    chevron: true,
  },
}

export const WithDescription: Story = {
  args: {
    icon: { element: <Key size={14} strokeWidth={1.5} />, bgColor: '#FF9500' },
    label: 'API Key',
    description: 'sk-proj-****...abc',
    chevron: true,
  },
}

export const Destructive: Story = {
  args: {
    label: 'Xoá tài khoản',
    destructive: true,
    onClick: () => alert('Confirm delete'),
  },
}

export const WithToggle: Story = {
  render: () => {
    const [checked, setChecked] = useState(true)
    return (
      <ListRow
        label="Tự động dịch"
        value={<Toggle checked={checked} onChange={setChecked} size="sm" />}
      />
    )
  },
}

export const SettingsGroup: Story = {
  render: () => (
    <div className="p-4 bg-[var(--apple-bg-secondary)] min-w-[360px]">
      <ListGroup label="KẾT NỐI">
        <ListRow
          icon={{ element: <Wifi size={14} strokeWidth={1.5} />, bgColor: '#007AFF' }}
          label="Wi-Fi"
          value="Viezan Network"
          chevron
          onClick={() => {}}
        />
        <ListRow
          icon={{ element: <Bluetooth size={14} strokeWidth={1.5} />, bgColor: '#007AFF' }}
          label="Bluetooth"
          value="Bật"
          chevron
          onClick={() => {}}
        />
      </ListGroup>
      <ListGroup label="AI">
        <ListRow
          icon={{ element: <Key size={14} strokeWidth={1.5} />, bgColor: '#FF9500' }}
          label="API Keys"
          description="Quản lý các API key"
          chevron
          onClick={() => {}}
        />
        <ListRow
          icon={{ element: <Globe size={14} strokeWidth={1.5} />, bgColor: '#34C759' }}
          label="Ngôn ngữ"
          value="Tiếng Việt"
          chevron
          onClick={() => {}}
        />
      </ListGroup>
    </div>
  ),
}
