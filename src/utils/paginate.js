export const PAGE_SIZE_OPTIONS = [30, 50, 100]
export const DEFAULT_PAGE_SIZE = 30

export function paginateItems(items, page, pageSize) {
  const total = items.length
  const pageCount = Math.max(1, Math.ceil(total / pageSize))
  const current = Math.min(Math.max(1, page), pageCount)
  const startIndex = (current - 1) * pageSize
  const pageItems = items.slice(startIndex, startIndex + pageSize)

  return {
    items: pageItems,
    total,
    pageCount,
    page: current,
    from: pageItems.length === 0 ? 0 : startIndex + 1,
    to: startIndex + pageItems.length,
  }
}

export function paginationSequence(current, pageCount) {
  if (pageCount <= 7) {
    return Array.from({ length: pageCount }, (_, index) => index + 1)
  }

  const pages = new Set([1, pageCount, current, current - 1, current + 1])

  if (current <= 3) {
    pages.add(2)
    pages.add(3)
    pages.add(4)
  }

  if (current >= pageCount - 2) {
    pages.add(pageCount - 3)
    pages.add(pageCount - 2)
    pages.add(pageCount - 1)
  }

  const sorted = [...pages].filter((page) => page >= 1 && page <= pageCount).sort((a, b) => a - b)
  const sequence = []

  sorted.forEach((page) => {
    if (sequence.length > 0) {
      const previous = sequence[sequence.length - 1]
      if (typeof previous === 'number' && page - previous > 1) {
        sequence.push('ellipsis')
      }
    }
    sequence.push(page)
  })

  return sequence
}
