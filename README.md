# Flip.gg API Logger

Chrome extension that captures flip.gg's own API responses (as your browser
already receives them while you use the site) and sorts them into
categorized JSON logs for personal analytics.

## How it works

- `content.js` injects `interceptor.js` into the flip.gg page, which wraps
  `window.fetch` and `XMLHttpRequest` so every JSON response the page's own
  code requests gets captured — no matter which host or path it hits, so
  future endpoints are picked up automatically.
- Captured calls are relayed to the background service worker
  (`background.js`), categorized by URL pattern, and stored in IndexedDB.
- The toolbar popup shows a live count per category, plus **Download JSON**
  (one file per category) and **Reset** (wipes everything and starts fresh).

## Categories

Defined in `CATEGORY_RULES` at the top of `background.js`. Currently:

- `transactions` — URLs containing `/transactions`
- `vip` — URLs containing `/vip`
- `other` — everything else

Add more rules to that array as you identify endpoints worth splitting out.

## Load it in Chrome

1. Go to `chrome://extensions`.
2. Enable **Developer mode** (top right).
3. Click **Load unpacked** and select this folder.
4. Browse flip.gg — the toolbar icon badge shows the running capture count.
5. Click the icon to download or reset logged calls.
