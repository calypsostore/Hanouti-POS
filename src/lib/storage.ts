const DATABASE_NAME = '7anouti-pos'
const OBJECT_STORE_NAME = 'key-value'
const DATABASE_VERSION = 1

let databasePromise: Promise<IDBDatabase> | null = null

function openDatabase(): Promise<IDBDatabase> {
  if (databasePromise) return databasePromise
  if (typeof indexedDB === 'undefined') {
    return Promise.reject(new Error('IndexedDB is not available in this browser.'))
  }

  databasePromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION)
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(OBJECT_STORE_NAME)) {
        request.result.createObjectStore(OBJECT_STORE_NAME)
      }
    }
    request.onsuccess = () => {
      const database = request.result
      database.onversionchange = () => {
        database.close()
        databasePromise = null
      }
      resolve(database)
    }
    request.onerror = () => {
      databasePromise = null
      reject(request.error ?? new Error('Could not open IndexedDB.'))
    }
  })

  return databasePromise
}

export async function readIndexedValue(key: string): Promise<string | null> {
  const database = await openDatabase()
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(OBJECT_STORE_NAME, 'readonly')
    const request = transaction.objectStore(OBJECT_STORE_NAME).get(key)
    let value: string | null = null

    request.onsuccess = () => {
      value = typeof request.result === 'string' ? request.result : null
    }
    request.onerror = () => reject(request.error ?? new Error('Could not read from IndexedDB.'))
    transaction.oncomplete = () => resolve(value)
    transaction.onerror = () => reject(transaction.error ?? new Error('IndexedDB read failed.'))
    transaction.onabort = () => reject(transaction.error ?? new Error('IndexedDB read was aborted.'))
  })
}

export async function writeIndexedValue(key: string, value: string): Promise<void> {
  const database = await openDatabase()
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(OBJECT_STORE_NAME, 'readwrite')
    transaction.objectStore(OBJECT_STORE_NAME).put(value, key)
    transaction.oncomplete = () => resolve()
    transaction.onerror = () => reject(transaction.error ?? new Error('IndexedDB write failed.'))
    transaction.onabort = () => reject(transaction.error ?? new Error('IndexedDB write was aborted.'))
  })
}
