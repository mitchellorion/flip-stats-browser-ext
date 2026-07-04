// Isolated-world content script: has chrome.* access but can't see the
// page's real fetch/XHR, so it injects interceptor.js into the page and
// relays what that script observes back to the background service worker.
(function () {
  const MSG_TAG = "__flipStatsCapture__";

  const script = document.createElement("script");
  script.src = chrome.runtime.getURL("interceptor.js");
  script.onload = function () {
    this.remove();
  };
  (document.head || document.documentElement).appendChild(script);

  window.addEventListener("message", (event) => {
    if (event.source !== window) return;
    const data = event.data;
    if (!data || data[MSG_TAG] !== true || !data.record) return;
    chrome.runtime.sendMessage({ type: "CALL_CAPTURED", record: data.record });
  });
})();
