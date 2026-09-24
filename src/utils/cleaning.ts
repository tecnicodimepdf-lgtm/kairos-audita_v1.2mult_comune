/**
 * Utility to perform deep cleaning of local browser data
 */
export async function deepCleanLocalData() {
  // 1. Clear LocalStorage
  localStorage.clear();

  // 2. Clear SessionStorage
  sessionStorage.clear();

  // 3. Clear IndexedDB
  try {
    const dbs = await window.indexedDB.databases();
    dbs.forEach(db => {
      if (db.name) {
        window.indexedDB.deleteDatabase(db.name);
      }
    });
  } catch (e) {
    console.error('Error clearing IndexedDB:', e);
  }

  // 4. Clear Cache Storage
  if ('caches' in window) {
    try {
      const cacheNames = await caches.keys();
      await Promise.all(cacheNames.map(name => caches.delete(name)));
    } catch (e) {
      console.error('Error clearing CacheStorage:', e);
    }
  }

  // 5. Unregister Service Workers
  if ('serviceWorker' in navigator) {
    try {
      const registrations = await navigator.serviceWorker.getRegistrations();
      await Promise.all(registrations.map(reg => reg.unregister()));
    } catch (e) {
      console.error('Error unregistering Service Workers:', e);
    }
  }
}
