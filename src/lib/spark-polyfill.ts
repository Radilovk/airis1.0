// Polyfill for window.spark functionality after removing @github/spark dependency
// Provides KV storage using localStorage and basic utility functions

interface UserInfo {
  avatarUrl: string
  email: string
  id: string
  isOwner: boolean
  login: string
}

// KV Storage implementation using localStorage
const kvStorage = {
  async keys(): Promise<string[]> {
    const keys: string[] = []
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i)
      if (key && key.startsWith('spark-kv:')) {
        keys.push(key.replace('spark-kv:', ''))
      }
    }
    return keys
  },

  async get<T>(key: string): Promise<T | undefined> {
    try {
      const item = localStorage.getItem(`spark-kv:${key}`)
      if (item === null) return undefined
      return JSON.parse(item) as T
    } catch (error) {
      console.error(`[KV] Error getting key "${key}":`, error)
      return undefined
    }
  },

  async set<T>(key: string, value: T): Promise<void> {
    try {
      localStorage.setItem(`spark-kv:${key}`, JSON.stringify(value))
    } catch (error) {
      console.error(`[KV] Error setting key "${key}":`, error)
      throw error
    }
  },

  async delete(key: string): Promise<void> {
    try {
      localStorage.removeItem(`spark-kv:${key}`)
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
