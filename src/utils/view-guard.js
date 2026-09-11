export function createKeyedLock() {
  const inflight = new Set()

  return {
    key(accion, id) {
      return `${accion}:${Number(id)}`
    },
    has(key) {
      return inflight.has(key)
    },
    acquire(key) {
      if (inflight.has(key)) return false
      inflight.add(key)
      return true
    },
    release(key) {
      inflight.delete(key)
    },
    keys() {
      return [...inflight]
    },
  }
}

export function createViewLifecycle() {
  let disposed = false

  return {
    get disposed() {
      return disposed
    },
    isAlive() {
      return !disposed
    },
    dispose(cleanup) {
      if (disposed) return
      disposed = true
      cleanup?.()
    },
  }
}

export async function runLockedConfirmAction({
  lock,
  key,
  confirm,
  execute,
  isAlive = () => true,
  onLockChange,
} = {}) {
  if (!lock?.acquire(key)) return { status: 'busy' }
  onLockChange?.(true)
  try {
    if (!isAlive()) return { status: 'disposed' }

    let confirmed
    try {
      confirmed = await confirm()
    } catch (error) {
      return { status: 'confirm-error', error }
    }

    if (!confirmed) return { status: 'cancelled' }
    if (!isAlive()) return { status: 'disposed' }

    const result = await execute()
    if (!isAlive()) return { status: 'disposed', result }
    return { status: 'ok', result }
  } catch (error) {
    return { status: 'error', error }
  } finally {
    lock.release(key)
    onLockChange?.(false)
  }
}
