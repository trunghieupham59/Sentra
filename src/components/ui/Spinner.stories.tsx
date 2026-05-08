import type { Meta, StoryObj } from '@storybook/react'
import { Spinner } from './Spinner'

const meta: Meta<typeof Spinner> = {
  title: 'UI/Spinner',
  component: Spinner,
  tags: ['autodocs'],
  argTypes: {
    size: { control: 'select', options: ['xs', 'sm', 'md', 'lg'] },
    color: { control: 'select', options: ['accent', 'white', 'current'] },
  },
}

export default meta
type Story = StoryObj<typeof Spinner>

export const Default: Story = { args: { size: 'md' } }
export const Small: Story = { args: { size: 'sm' } }
export const Large: Story = { args: { size: 'lg' } }
export const AccentColor: Story = { args: { size: 'md', color: 'accent' } }

export const AllSizes: Story = {
  render: () => (
    <div className="flex gap-4 items-center p-4">
      <Spinner size="xs" />
      <Spinner size="sm" />
      <Spinner size="md" />
      <Spinner size="lg" />
    </div>
  ),
}
