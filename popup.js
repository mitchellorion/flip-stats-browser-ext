const statsEl = document.getElementById("stats");
const emptyEl = document.getElementById("empty");
const statusEl = document.getElementById("status");
const mergeFilesEl = document.getElementById("mergeFiles");

function send(type) {
  return chrome.runtime.sendMessage({ type });
}

function dateStamp() {
  return new Date().toISOString().slice(0, 10);
}

// Records with a real "_id"/"id" (e.g. transactions) dedupe on that; anything
// else (e.g. a /vip status blob) falls back to exact-content equality so only
// true repeats collapse.
function itemKey(item) {
  if (item && typeof item === "object" && !Array.isArray(item)) {
    if (item._id !== undefined) return `_id:${item._id}`;
    if (item.id !== undefined) return `id:${item.id}`;
  }
  return `json:${JSON.stringify(item)}`;
}

// Takes raw captured calls (each with a .body that's either an array of
// records or a single object) and returns one flat, deduped array of the
// underlying items — this is what both a normal download and a merge of
// several downloads collapse down to.
function flattenAndDedupe(calls) {
  const map = new Map();
  for (const call of calls) {
    const atoms = Array.isArray(call.body) ? call.body : [call.body];
    for (const item of atoms) {
      map.set(itemKey(item), item);
    }
  }
  return Array.from(map.values());
}

// Accepts anything this extension might have produced: a raw multi-call
// export, a previous merge/download's { items: [...] } export, or a bare
// flat array of items — and reshapes it into call-like objects so
// flattenAndDedupe can treat them uniformly.
function normalizeToCalls(parsed) {
  if (Array.isArray(parsed)) {
    const looksLikeRawCalls =
      parsed.length > 0 && parsed[0] && typeof parsed[0] === "object" && "body" in parsed[0] && "time" in parsed[0];
    if (looksLikeRawCalls) return parsed;
    return parsed.map((item) => ({ body: item }));
  }
  if (parsed && Array.isArray(parsed.items)) {
    return parsed.items.map((item) => ({ body: item }));
  }
  return [];
}

async function refresh() {
  const { stats, total } = await send("GET_STATS");
  statsEl.innerHTML = "";
  emptyEl.hidden = total > 0;

  const names = Object.keys(stats).sort();
  for (const name of names) {
    const li = document.createElement("li");
    li.innerHTML = `<span>${name}</span><span>${stats[name]}</span>`;
    statsEl.appendChild(li);
  }
}

function downloadJSON(filename, data) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  return chrome.downloads.download({ url, filename, saveAs: false });
}

async function downloadAll() {
  const grouped = await send("GET_ALL");
  const categories = Object.keys(grouped);
  if (categories.length === 0) {
    statusEl.textContent = "Nothing to download yet.";
    return;
  }

  for (const category of categories) {
    const items = flattenAndDedupe(grouped[category]);
    await downloadJSON(`flip-${category}-${dateStamp()}.json`, {
      category,
      exportedAt: new Date().toISOString(),
      count: items.length,
      items,
    });
  }
  statusEl.textContent = `Downloaded ${categories.length} file(s).`;
}

async function resetAll() {
  if (!confirm("Clear all captured calls? This can't be undone.")) return;
  await send("RESET");
  statusEl.textContent = "Cleared.";
  refresh();
}

async function mergeFiles() {
  const files = Array.from(mergeFilesEl.files || []);
  if (files.length < 2) {
    statusEl.textContent = "Pick two or more exported JSON files to merge.";
    return;
  }

  try {
    const texts = await Promise.all(files.map((f) => f.text()));
    const allCalls = texts.flatMap((text) => normalizeToCalls(JSON.parse(text)));
    const items = flattenAndDedupe(allCalls);
    await downloadJSON(`flip-merged-${dateStamp()}.json`, {
      mergedFrom: files.map((f) => f.name),
      mergedAt: new Date().toISOString(),
      count: items.length,
      items,
    });
    statusEl.textContent = `Merged ${files.length} files into ${items.length} unique record(s).`;
  } catch (e) {
    statusEl.textContent = "Couldn't merge those files — make sure they're exports from this extension.";
  }
}

document.getElementById("download").addEventListener("click", () => {
  statusEl.textContent = "";
  downloadAll();
});
document.getElementById("reset").addEventListener("click", resetAll);
document.getElementById("merge").addEventListener("click", () => {
  statusEl.textContent = "";
  mergeFiles();
});

refresh();
