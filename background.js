const DB_NAME = "flipStatsDB";
const DB_VERSION = 1;
const STORE = "calls";

// Add new rules here as you learn about more endpoints worth splitting out.
// First matching rule wins; anything else falls into "other".
const CATEGORY_RULES = [
  { name: "transactions", test: (url) => /\/transactions(\/|\?|$)/i.test(url) },
  { name: "vip", test: (url) => /\/vip(\/|\?|$)/i.test(url) },
  // Must stay after the two rules above: /api/user/transactions and
  // /api/user/vip would otherwise also match this broader /user pattern.
  { name: "user", test: (url) => /\/user(\/|\?|$)/i.test(url) },
];

function categorize(url) {
  for (const rule of CATEGORY_RULES) {
    if (rule.test(url)) return rule.name;
  }
  return "other";
}

function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        const store = db.createObjectStore(STORE, { keyPath: "id", autoIncrement: true });
        store.createIndex("category", "category", { unique: false });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function addRecord(record) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).add(record);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

async function getAll() {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readonly");
    const req = tx.objectStore(STORE).getAll();
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function getStats() {
  const records = await getAll();
  const stats = {};
  for (const r of records) {
    stats[r.category] = (stats[r.category] || 0) + 1;
  }
  return { stats, total: records.length };
}

async function getAllGrouped() {
  const records = await getAll();
  const grouped = {};
  for (const r of records) {
    (grouped[r.category] ||= []).push(r);
  }
  return grouped;
}

async function resetAll() {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).clear();
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

async function updateBadge() {
  const { total } = await getStats();
  chrome.action.setBadgeText({ text: total > 0 ? String(total) : "" });
  chrome.action.setBadgeBackgroundColor({ color: "#4688F1" });
}

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  (async () => {
    switch (msg.type) {
      case "CALL_CAPTURED": {
        const category = categorize(msg.record.url || "");
        await addRecord({ ...msg.record, category });
        await updateBadge();
        sendResponse({ ok: true });
        break;
      }
      case "GET_STATS":
        sendResponse(await getStats());
        break;
      case "GET_ALL":
        sendResponse(await getAllGrouped());
        break;
      case "RESET":
        await resetAll();
        await updateBadge();
        sendResponse({ ok: true });
        break;
    }
  })();
  return true;
});

updateBadge();
