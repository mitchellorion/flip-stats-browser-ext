const statsEl = document.getElementById("stats");
const emptyEl = document.getElementById("empty");
const statusEl = document.getElementById("status");

function send(type) {
  return chrome.runtime.sendMessage({ type });
}

function dateStamp() {
  return new Date().toISOString().slice(0, 10);
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

async function downloadAll() {
  const grouped = await send("GET_ALL");
  const categories = Object.keys(grouped);
  if (categories.length === 0) {
    statusEl.textContent = "Nothing to download yet.";
    return;
  }

  for (const category of categories) {
    const blob = new Blob([JSON.stringify(grouped[category], null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    await chrome.downloads.download({
      url,
      filename: `flip-${category}-${dateStamp()}.json`,
      saveAs: false,
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

document.getElementById("download").addEventListener("click", () => {
  statusEl.textContent = "";
  downloadAll();
});
document.getElementById("reset").addEventListener("click", resetAll);

refresh();
