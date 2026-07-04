// Runs in the page's own JS context (injected via <script src>), so it can
// wrap the same window.fetch / XMLHttpRequest the site's React app calls.
// It has no access to chrome.* APIs, so it hands captured calls off to
// content.js via window.postMessage.
(function () {
  const MSG_TAG = "__flipStatsCapture__";

  function resolveUrl(input) {
    try {
      if (typeof input === "string") return new URL(input, location.href).href;
      if (input && typeof input.url === "string") return new URL(input.url, location.href).href;
    } catch (e) {}
    return String(input);
  }

  function resolveMethod(input, init) {
    if (init && init.method) return init.method.toUpperCase();
    if (input && input.method) return input.method.toUpperCase();
    return "GET";
  }

  function tryParseJSON(text) {
    try {
      return JSON.parse(text);
    } catch (e) {
      return undefined;
    }
  }

  function emit(record) {
    window.postMessage({ [MSG_TAG]: true, record }, "*");
  }

  const originalFetch = window.fetch;
  window.fetch = function (input, init) {
    const url = resolveUrl(input);
    const method = resolveMethod(input, init);
    return originalFetch.apply(this, arguments).then((response) => {
      response
        .clone()
        .text()
        .then((text) => {
          const body = tryParseJSON(text);
          if (body !== undefined) {
            emit({ time: Date.now(), method, url, status: response.status, body });
          }
        })
        .catch(() => {});
      return response;
    });
  };

  const OrigXHR = window.XMLHttpRequest;
  const origOpen = OrigXHR.prototype.open;
  const origSend = OrigXHR.prototype.send;

  OrigXHR.prototype.open = function (method, url, ...rest) {
    this.__flipMethod = method;
    this.__flipUrl = resolveUrl(url);
    return origOpen.call(this, method, url, ...rest);
  };

  OrigXHR.prototype.send = function (...args) {
    this.addEventListener("load", () => {
      const body = tryParseJSON(this.responseText);
      if (body !== undefined) {
        emit({ time: Date.now(), method: this.__flipMethod || "GET", url: this.__flipUrl, status: this.status, body });
      }
    });
    return origSend.apply(this, args);
  };
})();
