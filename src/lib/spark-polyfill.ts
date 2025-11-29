// Polyfill for window.spark functionality after removing @github/spark dependency
// Provides KV storage using IndexedDB + localStorage (aligned with useKVWithFallback hook)

interface UserInfo {
  avatarUrl: string
  email: string
  id: string
  isOwner: boolean
  login: string
}

// IndexedDB configuration - must match useKVWithFallback.ts
const DB_NAME = 'airis_storage'
const DB_VERSION = 1
const STORE_NAME = 'settings'

async function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION)
    request.onerror = () => reject(request.error)
    request.onsuccess = () => resolve(request.result)
    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME)
      }
    }
  })
}

async function getFromIndexedDB(key: string): Promise<any> {
  try {
    const db = await openDB()
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORE_NAME], 'readonly')
      const store = transaction.objectStore(STORE_NAME)
      const request = store.get(key)
      request.onsuccess = () => resolve(request.result)
      request.onerror = () => reject(request.error)
    })
  } catch (error) {
    console.warn(`[KV] IndexedDB read error for ${key}:`, error)
    return undefined
  }
}

async function setInIndexedDB(key: string, value: any): Promise<void> {
  try {
    const db = await openDB()
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORE_NAME], 'readwrite')
      const store = transaction.objectStore(STORE_NAME)
      const request = store.put(value, key)
      request.onsuccess = () => resolve()
      request.onerror = () => reject(request.error)
    })
  } catch (error) {
    console.warn(`[KV] IndexedDB write error for ${key}:`, error)
    throw error
  }
}

// KV Storage implementation using IndexedDB + localStorage (aligned with useKVWithFallback)
const kvStorage = {
  async keys(): Promise<string[]> {
    const keys: string[] = []
    // Check localStorage with airis_ prefix
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i)
      if (key && key.startsWith('airis_')) {
        keys.push(key.replace('airis_', ''))
      }
    }
    return keys
  },

  async get<T>(key: string): Promise<T | undefined> {
    try {
      // Priority 1: Try IndexedDB first (primary storage)
      const indexedDBValue = await getFromIndexedDB(key)
      if (indexedDBValue !== undefined && indexedDBValue !== null) {
        console.log(`[KV] ✓ Loaded ${key} from IndexedDB`)
        return indexedDBValue as T
      }
      
      // Priority 2: Try localStorage with airis_ prefix (fallback)
      const localStorageValue = localStorage.getItem(`airis_${key}`)
      if (localStorageValue && localStorageValue !== 'null' && localStorageValue !== 'undefined') {
        const parsed = JSON.parse(localStorageValue) as T
        console.log(`[KV] ✓ Loaded ${key} from localStorage (airis_ prefix)`)
        return parsed
      }
      
      // Priority 3: Legacy - check spark-kv: prefix for backwards compatibility
      const legacyValue = localStorage.getItem(`spark-kv:${key}`)
      if (legacyValue && legacyValue !== 'null' && legacyValue !== 'undefined') {
        const parsed = JSON.parse(legacyValue) as T
        console.log(`[KV] ✓ Loaded ${key} from localStorage (legacy spark-kv: prefix)`)
        // Migrate to new storage
        await setInIndexedDB(key, parsed)
        return parsed
      }
      
      return undefined
    } catch (error) {
      console.error(`[KV] Error getting key "${key}":`, error)
      return undefined
    }
  },

  async set<T>(key: string, value: T): Promise<void> {
    try {
      // Save to IndexedDB (primary)
      await setInIndexedDB(key, value)
      console.log(`[KV] ✓ Saved ${key} to IndexedDB`)
      
      // Also save to localStorage with airis_ prefix (fallback, for small data)
      const dataSize = JSON.stringify(value).length
      if (dataSize < 100 * 1024) { // 100KB limit
        localStorage.setItem(`airis_${key}`, JSON.stringify(value))
        console.log(`[KV] ✓ Saved ${key} to localStorage`)
      }
    } catch (error) {
      console.error(`[KV] Error setting key "${key}":`, error)
      throw error
    }
  },

  async delete(key: string): Promise<void> {
    try {
      // Delete from both storages
      localStorage.removeItem(`airis_${key}`)
      localStorage.removeItem(`spark-kv:${key}`) // Legacy cleanup
      
      // Note: We don't delete from IndexedDB here to keep it simple
      // The next write will overwrite the value anyway
    } catch (error) {
      console.error(`[KV] Error deleting key "${key}":`, error)
      throw error
    }
  }
}

// Simple template string processor
function llmPrompt(strings: TemplateStringsArray, ...values: any[]): string {
  return strings.reduce((result, str, i) => {
    return result + str + (values[i] !== undefined ? String(values[i]) : '')
  }, '')
}

// Mock user function (not used in the current app)
async function user(): Promise<UserInfo> {
  return {
    avatarUrl: '',
    email: '',
    id: 'local-user',
    isOwner: true,
    login: 'local'
  }
}

// Mock LLM function that throws error (we removed Spark LLM, only custom APIs should be used)
async function llm(prompt: string, modelName?: string, jsonMode?: boolean): Promise<string> {
  throw new Error('Spark LLM is no longer available. Please configure OpenAI or Gemini API in Admin settings.')
}

// Initialize window.spark polyfill
if (typeof window !== 'undefined') {
  window.spark = {
    llmPrompt,
    llm,
    user,
    kv: kvStorage
  }
}

export { kvStorage, llmPrompt, user, llm }
