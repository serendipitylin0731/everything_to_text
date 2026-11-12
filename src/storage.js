const dbReady = new Promise((resolve, reject) => {
  const request = indexedDB.open('shizi-documents', 1);
  request.onupgradeneeded = () => request.result.createObjectStore('documents', { keyPath: 'id' });
  request.onsuccess = () => resolve(request.result);
  request.onerror = () => reject(request.error);
});
function transaction(mode, action) {
  return dbReady.then(db => new Promise((resolve, reject) => {
    const tx = db.transaction('documents', mode);
    const request = action(tx.objectStore('documents'));
    tx.oncomplete = () => resolve(request?.result);
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error || new Error('保存已中断'));
  }));
}
export const getAll = () => transaction('readonly', store => store.getAll());
export const getRecord = id => transaction('readonly', store => store.get(id));
export const putRecord = record => transaction('readwrite', store => store.put(record));
export const deleteRecord = id => transaction('readwrite', store => store.delete(id));
export const clearRecords = () => transaction('readwrite', store => store.clear());
export async function migrateOldHistory() {
  const key = 'shizi.history.v1';
  let old;
  try { old = JSON.parse(localStorage.getItem(key) || '[]'); } catch { return; }
  if (!Array.isArray(old) || !old.length) return;
  for (const record of old.slice(0, 100)) {
    if (await getRecord(record.id)) continue;
    const div = document.createElement('div'); div.textContent = record.text || '';
    await putRecord({ id: record.id, title: record.title || '未命名文档', html: div.innerHTML.replace(/\n/g, '<br>'), images: [], updatedAt: record.updatedAt || Date.now() });
  }
  localStorage.removeItem(key);
}
