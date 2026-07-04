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

Downloads are deduped: if an endpoint (e.g. `/transactions`) got called more
than once before you downloaded, the export collapses records sharing the
same `_id`/`id` into one entry instead of repeating them.

## Categories

Defined in `CATEGORY_RULES` at the top of `background.js`. Currently:

- `transactions` — URLs containing `/transactions`
- `vip` — URLs containing `/vip`
- `user` — URLs containing `/user` (profile/balance-style responses), as
  long as they didn't already match `transactions` or `vip` above
- `other` — everything else

Add more rules to that array as you identify endpoints worth splitting out.
Order matters — more specific patterns must come before broader ones.

## Merging exports over time

Known API endpoints here (e.g. `/transactions`) only ever return a capped,
most-recent window of records — there's no pagination to pull full history
in one shot. To build a complete history over time:

1. Download periodically (before old entries roll out of that window).
2. In the popup's **Merge previous exports** section, select two or more of
   those downloaded JSON files.
3. Click **Merge & Download** to get one combined, deduped file.

This also accepts files that are themselves the output of a previous merge,
so you can keep folding new downloads into one running export.

## Load it in Chrome

1. Go to `chrome://extensions`.
2. Enable **Developer mode** (top right).
3. Click **Load unpacked** and select this folder.
4. Browse flip.gg — the toolbar icon badge shows the running capture count.
5. Click the icon to download or reset logged calls.
