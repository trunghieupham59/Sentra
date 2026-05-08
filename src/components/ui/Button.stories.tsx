import type { Meta, StoryObj } from '@storybook/react'
import { Settings, ArrowRight, Trash2 } from 'lucide-react'
import { Button } from './Button'

const meta: Meta<typeof Button> = {
  title: 'UI/Button',
  component: Button,
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component: 'Apple HIG-compliant button với 5 variants và 3 sizes. Tuân thủ RULE-UI-002 (focus ring) và RULE-UI-004 (transition 150ms).',
      },
    },
  },
  argTypes: {
    variant: {
      control: 'select',
      options: ['primary', 'secondary', 'ghost', 'destructive', 'tinted'],
    },
    size: {
      control: 'select',
      options: ['sm', 'md', 'lg'],
    },
    loading: { control: 'boolean' },
    disabled: { control: 'boolean' },
    fullWidth: { control: 'boolean' },
  },
}

export default meta
type Story = StoryObj<typeof Button>

export const Primary: Story = {
  args: { variant: 'primary', children: 'Dịch ngay' },
}

export const Secondary: Story = {
  args: { variant: 'secondary', children: 'Huỷ' },
}

export const Ghost: Story = {
  args: { variant: 'ghost', children: 'Tìm hiểu thêm' },
}

export const Destructive: Story = {
  args: { variant: 'destructive', children: 'Xoá tất cả' },
}

export const Tinted: Story = {
  args: { variant: 'tinted', children: 'Xem chi tiết' },
}

export const WithLeftIcon: Story = {
  args: {
    variant: 'primary',
    children: 'Cài đặt',
    leftIcon: <Settings size={16} strokeWidth={1.5} />,
  },
}

export const WithRightIcon: Story = {
  args: {
    variant: 'ghost',
    children: 'Tiếp theo',
    rightIcon: <ArrowRight size={16} strokeWidth={1.5} />,
  },
}

export const Loading: Story = {
  args: { variant: 'primary', children: 'Đang dịch...', loading: true },
}

export const Disabled: Story = {
  args: { variant: 'primary', children: 'Không khả dụng', disabled: true },
}

export const Small: Story = {
  args: { variant: 'primary', size: 'sm', children: 'Nhỏ' },
}

export const Large: Story = {
  args: { variant: 'primary', size: 'lg', children: 'Lớn' },
}

export const AllVariants: Story = {
  render: () => (
    <div className="flex flex-wrap gap-3 items-center p-4">
      <Button variant="primary">Primary</Button>
      <Button variant="secondary">Secondary</Button>
      <Button variant="ghost">Ghost</Button>
      <Button variant="tinted">Tinted</Button>
      <Button variant="destructive">Destructive</Button>
    </div>
  ),
}

export const AllSizes: Story = {
  render: () => (
    <div className="flex flex-wrap gap-3 items-center p-4">
      <Button variant="primary" size="sm">Small</Button>
      <Button variant="primary" size="md">Medium</Button>
      <Button variant="primary" size="lg">Large</Button>
    </div>
  ),
}

export const DestructiveWithIcon: Story = {
  args: {
    variant: 'destructive',
    children: 'Xoá',
    leftIcon: <Trash2 size={16} strokeWidth={1.5} />,
  },
}
