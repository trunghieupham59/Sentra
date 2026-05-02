import { useMemo, useState } from 'react'

export function useHistoryBulkSelection(ids: string[], deleteItem: (id: string) => void) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())

  const selectedVisibleIds = useMemo(
    () => ids.filter((id) => selectedIds.has(id)),
    [ids, selectedIds],
  )
  const selectedCount = selectedVisibleIds.length

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const handleSelectAll = () => {
    if (ids.length > 0 && ids.every((id) => selectedIds.has(id))) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(ids))
    }
  }

  const handleDeleteSelected = () => {
    if (selectedCount === 0) return
    for (const id of selectedVisibleIds) {
      deleteItem(id)
    }
    setSelectedIds(new Set())
  }

  return {
    selectedIds,
    selectedCount,
    toggleSelect,
    handleSelectAll,
    handleDeleteSelected,
  }
}
