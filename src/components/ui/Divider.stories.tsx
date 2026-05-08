import type { Meta, StoryObj } from '@storybook/react'
import { Divider } from './Divider'

const meta: Meta<typeof Divider> = {
  title: 'UI/Divider',
  component: Divider,
  tags: ['autodocs'],
}

export default meta
type Story = StoryObj<typeof Divider>

export const Horizontal: Story = {
  render: () => (
    <div className="w-64 p-4 flex flex-col gap-4">
      <div className="text-[15px]">Phần trên</div>
      <Divider />
      <div className="text-[15px]">Phần dưới</div>
    </div>
  ),
}

export const WithLabel: Story = {
  render: () => (
    <div className="w-64 p-4">
      <Divider label="Hoặc" />
    </div>
  ),
}

export const Vertical: Story = {
  render: () => (
    <div className="flex h-12 gap-3 items-center p-4">
      <span className="text-[15px]">Trái</span>
      <Divider orientation="vertical" />
      <span className="text-[15px]">Phải</span>
    </div>
  ),
}
