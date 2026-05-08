import type { Meta, StoryObj } from '@storybook/react'
import { Badge } from './Badge'

const meta: Meta<typeof Badge> = {
  title: 'UI/Badge',
  component: Badge,
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component: 'Apple-style badge với 6 semantic variants. Dùng cho trạng thái, labels, và notifications.',
      },
    },
  },
  argTypes: {
    variant: {
      control: 'select',
      options: ['default', 'accent', 'success', 'warning', 'error', 'neutral'],
    },
    size: { control: 'select', options: ['sm', 'md'] },
    dot: { control: 'boolean' },
  },
}

export default meta
type Story = StoryObj<typeof Badge>

export const Default: Story = { args: { children: 'Default' } }
export const Accent: Story = { args: { variant: 'accent', children: 'Mới' } }
export const Success: Story = { args: { variant: 'success', children: '✓ Thành công' } }
export const Warning: Story = { args: { variant: 'warning', children: 'Cảnh báo' } }
export const Error: Story = { args: { variant: 'error', children: 'Lỗi' } }
export const Neutral: Story = { args: { variant: 'neutral', children: 'Đã lưu' } }

export const DotIndicators: Story = {
  render: () => (
    <div className="flex gap-4 items-center p-4">
      <Badge variant="success" dot />
      <Badge variant="warning" dot />
      <Badge variant="error" dot />
      <Badge variant="accent" dot />
      <Badge variant="neutral" dot />
    </div>
  ),
}

export const AllVariants: Story = {
  render: () => (
    <div className="flex flex-wrap gap-2 p-4">
      <Badge variant="default">Default</Badge>
      <Badge variant="accent">Accent</Badge>
      <Badge variant="success">Success</Badge>
      <Badge variant="warning">Warning</Badge>
      <Badge variant="error">Error</Badge>
      <Badge variant="neutral">Neutral</Badge>
    </div>
  ),
}
