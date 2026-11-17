/**
 * form-memory.ts — паметта на въпросника и снимките между посещенията (уеб и приложение).
 *
 *  - Чернова: всеки отговор се пази веднага (излизане по средата → продължава откъдето е спряло).
 *  - Последни отговори: при нов анализ въпросникът се попълва с тях — човекът само проверява.
 *  - Последни снимки: двете очи от последния анализ (с намерената геометрия) — „Използвай същите“.
 *
 * Всичко е само на устройството (IndexedDB), отделно от историята на анализите, и не се трие
 * при „Нов анализ“. Без IndexedDB (частен режим) просто не се помни — нищо не се чупи.
 */
import type { IrisImage, QuestionnaireData } from '@/types'

const DB = 'irismap_memory'
const STORE = 'kv'

function open(): Promise<IDBDatabase | null> {
  return new Promise(resolve => {
    try {
      const req = indexedDB.open(DB, 1)
      req.onupgradeneeded = () => { if (!req.result.objectStoreNames.contains(STORE)) req.result.createObjectStore(STORE) }
      req.onsuccess = () => resolve(req.result)
      req.onerror = () => resolve(null)
    } catch {
      resolve(null)
    }
  })
}

async function get<T>(key: string): Promise<T | null> {
  const db = await open()
  if (!db) return null
  return new Promise(resolve => {
    try {
      const r = db.transaction(STORE, 'readonly').objectStore(STORE).get(key)
      r.onsuccess = () => resolve((r.result as T) ?? null)
      r.onerror = () => resolve(null)
    } catch {
      resolve(null)
    }
  })
}

async function put(key: string, value: unknown): Promise<void> {
  const db = await open()
  if (!db) return
  await new Promise<void>(resolve => {
    try {
      const tx = db.transaction(STORE, 'readwrite')
      if (value === null) tx.objectStore(STORE).delete(key)
      else tx.objectStore(STORE).put(value, key)
      tx.oncomplete = () => resolve()
      tx.onerror = () => resolve()
    } catch {
      resolve()
    }
  })
}

export interface QuestionnaireDraft {
  version: string | number
  answers: Record<string, unknown>
  otherValues: Record<string, string>
  showOther: Record<string, boolean>
  uploadedDocuments: unknown[]
  index: number
  savedAt: string
}

export const loadDraft = () => get<QuestionnaireDraft>('q-draft')
export const saveDraft = (d: QuestionnaireDraft) => put('q-draft', d)
export const clearDraft = () => put('q-draft', null)

export const loadLastAnswers = () => get<QuestionnaireData>('q-last')
export const saveLastAnswers = (d: QuestionnaireData) => put('q-last', d)

export interface LastIrisImages { left: IrisImage; right: IrisImage; savedAt: string }
export const loadLastImages = () => get<LastIrisImages>('img-last')
export const saveLastImages = (left: IrisImage, right: IrisImage) =>
  put('img-last', { left, right, savedAt: new Date().toISOString() })
export const clearLastImages = () => put('img-last', null)
