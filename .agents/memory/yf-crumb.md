---
name: Yahoo Finance crumb flow
description: How to correctly fetch a Yahoo Finance crumb token for quoteSummary API calls
---

## Rule
To call `https://query2.finance.yahoo.com/v10/finance/quoteSummary/{symbol}`:
1. Visit `https://finance.yahoo.com/` with HTML Accept headers (`text/html,...`) — NOT `application/json`. Using JSON Accept headers prevents A1/A3/A1S cookies from being set.
2. In the SAME session, fetch crumb from `https://query2.finance.yahoo.com/v1/test/getcrumb` (use query2, not query1 — more reliable).
3. Pass crumb as `?crumb={crumb}` query param.
4. On 401 response, clear crumb cache so it refreshes next call.

**Why:** Yahoo Finance returns different responses based on Accept headers. With `Accept: application/json`, the initial visit doesn't set the session cookies needed for the crumb endpoint to return a valid token. With `Accept: text/html,...`, cookies are set correctly and crumb fetch succeeds (confirmed: status 200, ~10 char token).

**How to apply:** `_get_yf_crumb()` and `_fetch_quote_summary()` in backend/main.py implement this. Call `_fetch_quote_summary(symbol)` directly in the fundamentals endpoint (not cached via `_fetch_yf`) to always get fresh data.

## Other endpoints
- `/v8/finance/chart/{symbol}` — works without crumb, reliable for price/OHLCV data.
- `/v10/finance/quoteSummary` — requires crumb, returns PE/ROE/margins/etc.
- `/v6/finance/quote` — returns 404 in this environment.
- NSE India API (`nseindia.com/api/`) — returns 403 from Replit container.
