const store = new Map()

const sessionStorage = {
  getItem(key) {
    return store.has(key) ? store.get(key) : null
  },
  setItem(key, value) {
    store.set(String(key), String(value))
  },
  removeItem(key) {
    store.delete(String(key))
  },
  clear() {
    store.clear()
  },
}

class CustomEvent {
  constructor(type, init = {}) {
    this.type = type
    this.detail = init.detail
    this.bubbles = Boolean(init.bubbles)
  }
}

const windowLike = {
  dispatchEvent() {
    return true
  },
  addEventListener() {},
  removeEventListener() {},
  CustomEvent,
}

if (!globalThis.sessionStorage) globalThis.sessionStorage = sessionStorage
if (!globalThis.window) globalThis.window = windowLike
if (!globalThis.CustomEvent) globalThis.CustomEvent = CustomEvent
if (typeof globalThis.window.sessionStorage === 'undefined') {
  globalThis.window.sessionStorage = globalThis.sessionStorage
}

export function resetBrowserGlobals() {
  store.clear()
}
