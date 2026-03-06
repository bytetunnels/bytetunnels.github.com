---
title: "Playwright sessionStorage: Reading and Writing Session Data"
date: 2026-02-13 12:00:00 +0000
categories: ["Browser Automation"]
tags: ["playwright", "sessionstorage", "python", "session data", "browser automation", "web scraping"]
author: arman
image:
  path: /assets/img/2026-02-13-playwright-sessionstorage-reading-writing-session-data-hero.png
  alt: "Playwright sessionStorage: Reading and Writing Session Data"
---

sessionStorage holds per-tab data that many single-page applications rely on for state management. Search results, filter selections, authentication tokens, onboarding progress, and cached API responses all end up in sessionStorage because the data is only needed for the current browsing session. Unlike localStorage, sessionStorage is scoped to the individual tab -- when the tab closes, the data disappears. For anyone automating browsers with [Playwright](/posts/playwright-vs-puppeteer-speed-stealth-developer-experience/), knowing how to read, write, and manipulate sessionStorage is essential. Every operation goes through `page.evaluate()`, and once you understand the patterns, you can extract hidden data, skip UI flows, and preserve session state across scraper runs.

## How sessionStorage Works

sessionStorage is a synchronous key-value store built into every modern browser. It stores string keys mapped to string values, scoped to the page's origin (protocol + domain + port). The API is identical to [localStorage](/posts/scraping-localstorage-accessing-client-side-storage/), but the lifetime is different.

```javascript
// Set a value
sessionStorage.setItem("search_query", "playwright automation");

// Get a value
sessionStorage.getItem("search_query"); // "playwright automation"

// Remove a single key
sessionStorage.removeItem("search_query");

// Clear all keys for this tab
sessionStorage.clear();

// Count stored items
sessionStorage.length;
```

Key characteristics that matter for Playwright automation:

- **Per-tab isolation**: each `page` object in Playwright gets its own independent sessionStorage, even within the same browser context
- **Same-origin only**: you can only access sessionStorage for the origin currently loaded in the page
- **Survives reloads**: refreshing the page within the same tab preserves sessionStorage
- **Does not survive tab close**: closing the page or browser wipes the data
- **Strings only**: objects must be serialized with `JSON.stringify()` before storage

## Reading All sessionStorage

The most common operation is dumping the entire contents of sessionStorage to see what the application has stored. Playwright's `page.evaluate()` runs JavaScript in the page context and returns the result to Python.

```python
from playwright.sync_api import sync_playwright
import json

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    context = browser.new_context()
    page = context.new_page()

    page.goto("https://example.com/app")
    page.wait_for_load_state("networkidle")

    # Dump all sessionStorage as a JSON string
    raw = page.evaluate(
        "JSON.stringify(Object.fromEntries(Object.entries(sessionStorage)))"
    )
    data = json.loads(raw)

    print(f"Found {len(data)} keys in sessionStorage")
    for key, value in data.items():
        preview = value[:100] if len(value) > 100 else value
        print(f"  {key}: {preview}")

    browser.close()
```

The `Object.fromEntries(Object.entries(sessionStorage))` pattern converts the Storage object into a plain JavaScript object, which serializes cleanly to JSON. You might see `JSON.stringify(sessionStorage)` in other guides, but the entries-based approach is more reliable across browsers.

For the async API, the same pattern applies with `await`:

```python
from playwright.async_api import async_playwright
import asyncio
import json

async def dump_session_storage(url):
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        page = await browser.new_page()

        await page.goto(url)
        await page.wait_for_load_state("networkidle")

        raw = await page.evaluate(
            "JSON.stringify(Object.fromEntries(Object.entries(sessionStorage)))"
        )
        data = json.loads(raw)

        await browser.close()
        return data

data = asyncio.run(dump_session_storage("https://example.com/app"))
```

## Reading a Specific Key

When you know the key name, reading a single value is a one-liner.

```python
# Read a single key
token = page.evaluate("sessionStorage.getItem('auth_token')")

if token:
    print(f"Auth token: {token}")
else:
    print("No auth token found")
```

`getItem()` returns `None` in Python (mapped from JavaScript's `null`) when the key does not exist. No exception, no error -- just `None`.

For keys that hold JSON-encoded data, parse the result:

```python
import json

raw_results = page.evaluate("sessionStorage.getItem('search_results')")

if raw_results:
    results = json.loads(raw_results)
    print(f"Cached {len(results)} search results")
    for item in results[:5]:
        print(f"  {item.get('title', 'untitled')}")
```

To read multiple keys in a single `evaluate()` call and reduce round trips:

```python
keys_to_read = ["auth_token", "csrf_token", "user_preferences"]

result = page.evaluate("""
    (keys) => {
        const data = {};
        keys.forEach(key => {
            const value = sessionStorage.getItem(key);
            if (value !== null) {
                data[key] = value;
            }
        });
        return data;
    }
""", keys_to_read)

for key, value in result.items():
    print(f"  {key}: {value[:80]}")
```

## Enumerating Keys and Previewing Values

Before you know which keys to target, you need to explore what the application has stored. This helper function enumerates all keys and classifies their values:

```python
key_info = page.evaluate("""
    () => {
        const entries = [];
        for (let i = 0; i < sessionStorage.length; i++) {
            const key = sessionStorage.key(i);
            const value = sessionStorage.getItem(key);
            let valueType = 'string';
            try {
                const parsed = JSON.parse(value);
                if (Array.isArray(parsed)) valueType = 'json_array';
                else if (typeof parsed === 'object' && parsed !== null) valueType = 'json_object';
                else valueType = 'json_primitive';
            } catch (e) {
                valueType = 'string';
            }
            entries.push({
                key: key,
                type: valueType,
                length: value.length,
                preview: value.substring(0, 200)
            });
        }
        return entries;
    }
""")

for entry in key_info:
    print(f"Key: {entry['key']}")
    print(f"  Type: {entry['type']}, Size: {entry['length']} chars")
    print(f"  Preview: {entry['preview']}")
    print()
```

Common key naming patterns to look for:

- `*token*`, `*csrf*`, `*xsrf*` -- authentication and anti-forgery tokens
- `*cache*`, `*search*`, `*results*` -- cached API responses
- `*state*`, `*step*`, `*wizard*` -- navigation and form state
- `*filter*`, `*sort*`, `*page*` -- UI state for listings and pagination
- `*onboarding*`, `*tutorial*`, `*welcome*` -- first-run flow progress

## Writing to sessionStorage

Writing to sessionStorage lets you inject state before the application reads it. This is useful for skipping login flows, setting search parameters, pre-loading cached data, or jumping to a specific step in a multi-step wizard.

```python
# Set a simple string value
page.evaluate("sessionStorage.setItem('theme', 'dark')")

# Set a value using a Python variable
page.evaluate(
    "([key, val]) => sessionStorage.setItem(key, val)",
    ["user_locale", "en-US"]
)
```

For complex data, serialize to JSON before writing:

```python
import json

user_prefs = {
    "sort_order": "price_asc",
    "filters": {
        "category": "electronics",
        "min_price": 50,
        "max_price": 500
    },
    "page_size": 100
}

page.evaluate(
    "([key, val]) => sessionStorage.setItem(key, val)",
    ["user_preferences", json.dumps(user_prefs)]
)
```

The critical detail is that you must navigate to the target origin before writing to sessionStorage. sessionStorage is origin-scoped, so writing to it before navigating will store the data under the wrong origin (or fail entirely on `about:blank`).

```python
# Correct: navigate first, then write
page.goto("https://example.com")
page.wait_for_load_state("domcontentloaded")
page.evaluate("sessionStorage.setItem('setup_complete', 'true')")

# Now navigate to the actual page -- the app reads sessionStorage on load
page.goto("https://example.com/dashboard")
```


<figure>
  <img src="/assets/img/inline-playwright-sessionstorage-reading-writin-1.jpg" alt="Browser automation turns repetitive tasks into reliable scripts." loading="lazy">
  <figcaption>Browser automation turns repetitive tasks into reliable scripts. <span class="img-credit">Photo by ThisIsEngineering / <a href="https://www.pexels.com" target="_blank" rel="noopener noreferrer">Pexels</a></span></figcaption>
</figure>

## Clearing sessionStorage

Clearing sessionStorage is straightforward. You can wipe everything or remove individual keys.

```python
# Clear all sessionStorage for the current origin
page.evaluate("sessionStorage.clear()")

# Remove a single key
page.evaluate("sessionStorage.removeItem('auth_token')")

# Remove multiple keys selectively
keys_to_remove = ["temp_data", "debug_log", "old_cache"]
page.evaluate("""
    (keys) => keys.forEach(k => sessionStorage.removeItem(k))
""", keys_to_remove)
```

Clearing sessionStorage before interacting with a page can be useful when you want the application to start fresh, fetching data from its API rather than reading stale cached values.

## Why sessionStorage Matters for Scraping

Applications use sessionStorage for data that should not outlive the current browsing session but needs to persist across page navigations within the same tab. This creates several opportunities for scrapers.

**Cached API responses.** SPAs frequently cache the JSON payloads from API calls in sessionStorage. A product search page might store the full API response keyed by the query string. Instead of parsing the rendered HTML table, you can grab the raw API response directly -- it is usually cleaner, more complete, and contains fields that the front-end does not display.

**Authentication tokens.** Some applications store short-lived JWTs or session tokens in sessionStorage rather than localStorage or cookies. The reasoning is security: if a user walks away and someone opens a new tab, they will not inherit the token. For scrapers, this means the token is available in the current tab's sessionStorage after login.

**Search state and filters.** When a user applies filters or performs a search, the application often saves the current state to sessionStorage. This means you can read the applied filters, the sort order, and the pagination state without parsing the URL or the DOM.

**Onboarding and wizard progress.** Multi-step flows frequently track their progress in sessionStorage. By writing the completed state, you can skip directly to the final step or to the page you actually need to scrape.

**Page state.** Scroll position, expanded/collapsed sections, active tab index, and form field values are commonly persisted in sessionStorage to survive page refreshes.

## Practical Example: Extracting Cached API Responses

This example navigates to a SPA, waits for it to populate sessionStorage with API data, and extracts any values that contain JSON objects or arrays.

```python
from playwright.sync_api import sync_playwright
import json

def extract_cached_api_data(url, wait_seconds=3):
    """
    Navigate to a SPA, wait for sessionStorage population,
    and extract keys containing structured JSON data.
    """
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()

        page.goto(url)
        page.wait_for_load_state("networkidle")
        page.wait_for_timeout(wait_seconds * 1000)

        raw = page.evaluate(
            "JSON.stringify(Object.fromEntries(Object.entries(sessionStorage)))"
        )
        storage = json.loads(raw)

        api_data = {}
        for key, value in storage.items():
            try:
                parsed = json.loads(value)
                if isinstance(parsed, (dict, list)):
                    api_data[key] = parsed
            except (json.JSONDecodeError, TypeError):
                continue

        browser.close()
        return api_data


cached = extract_cached_api_data("https://example.com/search?q=laptops")

for key, data in cached.items():
    print(f"\nCache key: {key}")
    if isinstance(data, list):
        print(f"  Array with {len(data)} items")
        for item in data[:3]:
            print(f"    {json.dumps(item)[:120]}")
    elif isinstance(data, dict):
        print(f"  Object with keys: {list(data.keys())[:10]}")
        if "results" in data:
            print(f"  Contains {len(data['results'])} results")
```

The cached API response often includes fields like internal product IDs, stock levels, rating breakdowns, and metadata that the rendered page hides. This data is already structured and does not require HTML parsing.

## Practical Example: Pre-Setting Session Data to Skip Onboarding

Many applications show onboarding flows, cookie consent dialogs, or tutorial overlays on first visit. These flows typically check sessionStorage (or localStorage) for a flag indicating completion. This is one aspect of broader [session management with cookies and storage](/posts/session-management-cookies-storage-user-state/). By writing that flag before the application reads it, you skip the flow entirely.

```python
from playwright.sync_api import sync_playwright

def scrape_with_onboarding_skip(url):
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()

        # Navigate to the origin to establish the storage scope
        page.goto(url)
        page.wait_for_load_state("domcontentloaded")

        # Set flags that the app checks to determine if onboarding is complete
        page.evaluate("""
            sessionStorage.setItem('onboarding_complete', 'true');
            sessionStorage.setItem('tutorial_dismissed', '1');
            sessionStorage.setItem('cookie_consent', JSON.stringify({
                accepted: true,
                timestamp: Date.now()
            }));
            sessionStorage.setItem('welcome_modal_shown', 'true');
        """)

        # Reload the page -- the app reads these flags on initialization
        page.reload()
        page.wait_for_load_state("networkidle")

        # The page should now load without onboarding overlays
        # Proceed with scraping
        title = page.title()
        print(f"Page title: {title}")

        # Verify the onboarding is actually skipped
        modal_visible = page.evaluate("""
            () => {
                const modal = document.querySelector('.onboarding-modal');
                return modal ? window.getComputedStyle(modal).display !== 'none' : false;
            }
        """)
        print(f"Onboarding modal visible: {modal_visible}")

        browser.close()


scrape_with_onboarding_skip("https://example.com/app")
```

The specific key names and values vary by application. The discovery step from the key enumeration section is how you identify what to set. Run the scraper once without pre-setting anything, complete the onboarding manually in headed mode, then dump sessionStorage to see what the app wrote.

## sessionStorage vs Playwright's storage_state()

Playwright provides a `storage_state()` method on the browser context that serializes cookies and localStorage to a JSON file. This is the standard way to persist browser state between sessions.

```python
# Save storage state (cookies + localStorage)
context.storage_state(path="state.json")

# Restore storage state in a new context
context = browser.new_context(storage_state="state.json")
```

The important caveat: `storage_state()` does **not** include sessionStorage. This is by design -- sessionStorage is per-tab, and a browser context can have multiple tabs. There is no built-in way to tell Playwright to save and restore sessionStorage automatically.

This means that if your target application stores critical data in sessionStorage (auth tokens, cached responses, CSRF tokens), using `storage_state()` alone will not preserve it. You need a manual save-and-restore workflow.

## Workaround: Saving and Restoring sessionStorage Manually

Since `storage_state()` skips sessionStorage, you need to handle it yourself. The approach is to dump sessionStorage to a file at the end of a session and restore it at the start of the next one.

```python
from playwright.sync_api import sync_playwright
from pathlib import Path
import json
import time

SESSION_STORAGE_FILE = Path("session_storage_backup.json")

def save_session_storage(page, filepath=SESSION_STORAGE_FILE):
    """Save the current page's sessionStorage to a JSON file."""
    raw = page.evaluate(
        "JSON.stringify(Object.fromEntries(Object.entries(sessionStorage)))"
    )
    data = json.loads(raw)
    payload = {
        "origin": page.evaluate("window.location.origin"),
        "saved_at": time.time(),
        "entries": data
    }
    filepath.write_text(json.dumps(payload, indent=2))
    print(f"Saved {len(data)} sessionStorage entries")


def restore_session_storage(page, url, filepath=SESSION_STORAGE_FILE,
                            max_age_seconds=1800):
    """
    Restore sessionStorage from a saved file.
    Returns True if restoration succeeded.
    """
    if not filepath.exists():
        return False

    payload = json.loads(filepath.read_text())
    age = time.time() - payload["saved_at"]

    if age > max_age_seconds:
        print(f"Saved session is {age:.0f}s old, exceeds max age of {max_age_seconds}s")
        return False

    # Must be on the correct origin before writing
    page.goto(url)
    page.wait_for_load_state("domcontentloaded")

    for key, value in payload["entries"].items():
        page.evaluate(
            "([k, v]) => sessionStorage.setItem(k, v)",
            [key, value]
        )

    print(f"Restored {len(payload['entries'])} entries (age: {age:.0f}s)")

    # Reload so the application picks up restored state
    page.reload()
    page.wait_for_load_state("networkidle")
    return True


# Combined workflow: restore if possible, otherwise log in fresh
with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    context = browser.new_context()
    page = context.new_page()

    restored = restore_session_storage(page, "https://example.com/app")

    if not restored:
        page.goto("https://example.com/login")
        page.fill("#email", "user@example.com")
        page.fill("#password", "password123")
        page.click("#login-button")
        page.wait_for_load_state("networkidle")

    # Do the actual scraping
    page.goto("https://example.com/dashboard")
    page.wait_for_load_state("networkidle")
    # ... extract data ...

    # Save for next run
    save_session_storage(page)
    browser.close()
```

The `max_age_seconds` parameter is important. sessionStorage is designed for temporary data, and the tokens it contains typically have short lifespans. Restoring a session backup that is hours old will often fail because server-side tokens have expired.

To combine this with Playwright's built-in storage state for a complete solution:

```python
# Save both storage_state and sessionStorage
context.storage_state(path="playwright_state.json")
save_session_storage(page, Path("session_storage_backup.json"))

# Restore both in a new session
context = browser.new_context(storage_state="playwright_state.json")
page = context.new_page()
restore_session_storage(page, "https://example.com/app",
                        Path("session_storage_backup.json"))
```

## Monitoring sessionStorage Changes

Some applications write to sessionStorage progressively as the user interacts with the page. Monitoring these writes can reveal data flows that are not obvious from the DOM alone. For a deeper look at tracking storage changes over time, see [monitoring sessionStorage for dynamic state changes](/posts/sessionstorage-monitoring-watching-dynamic-state-changes/).

### Intercepting Writes with setItem Override

Override the `setItem` method to log every change as it happens:

```python
# Install the interceptor before interactions
page.evaluate("""
    window.__storageLog = [];

    const originalSetItem = sessionStorage.setItem.bind(sessionStorage);
    sessionStorage.setItem = function(key, value) {
        window.__storageLog.push({
            action: 'set',
            key: key,
            valueLength: value.length,
            preview: value.substring(0, 200),
            timestamp: Date.now()
        });
        return originalSetItem(key, value);
    };

    const originalRemoveItem = sessionStorage.removeItem.bind(sessionStorage);
    sessionStorage.removeItem = function(key) {
        window.__storageLog.push({
            action: 'remove',
            key: key,
            timestamp: Date.now()
        });
        return originalRemoveItem(key);
    };
""")

# Interact with the page to trigger storage writes
page.click("#search-button")
page.wait_for_load_state("networkidle")
page.wait_for_timeout(3000)

# Retrieve the log
changes = page.evaluate("window.__storageLog")

for change in changes:
    action = change["action"]
    key = change["key"]
    preview = change.get("preview", "")
    print(f"[{action}] {key}: {preview[:80]}")
```

### Polling Approach

A simpler method that does not require overriding native methods. Take snapshots at intervals and diff them:

```python
import time
import json

def poll_session_storage(page, duration_seconds=10, interval=0.5):
    """Take periodic snapshots of sessionStorage and report changes."""
    previous = json.loads(
        page.evaluate(
            "JSON.stringify(Object.fromEntries(Object.entries(sessionStorage)))"
        )
    )
    changes = []
    end_time = time.time() + duration_seconds

    while time.time() < end_time:
        time.sleep(interval)
        current = json.loads(
            page.evaluate(
                "JSON.stringify("
                "Object.fromEntries(Object.entries(sessionStorage)))"
            )
        )

        for key in current:
            if key not in previous:
                changes.append(("added", key, current[key]))
            elif current[key] != previous[key]:
                changes.append(("modified", key, current[key]))

        for key in previous:
            if key not in current:
                changes.append(("removed", key, None))

        previous = current

    return changes


# Monitor for 15 seconds while the page initializes
changes = poll_session_storage(page, duration_seconds=15)
for action, key, value in changes:
    preview = (value[:80] + "...") if value and len(value) > 80 else value
    print(f"  [{action}] {key}: {preview}")
```

## Gotchas

### sessionStorage Is Per-Tab

This is the single most important thing to understand. In Playwright, every `page` object created with `context.new_page()` gets its own independent sessionStorage, even for the same origin.

```python
page1 = context.new_page()
page1.goto("https://example.com")
page1.evaluate("sessionStorage.setItem('key', 'from_page1')")

page2 = context.new_page()
page2.goto("https://example.com")

# Returns None -- page2 has empty sessionStorage
result = page2.evaluate("sessionStorage.getItem('key')")
print(result)  # None
```

If you need the same session data in multiple tabs, you must copy it manually between pages.

### Same-Origin Only

You can only access sessionStorage for the origin currently loaded in the page. Navigating to `https://app.example.com` does not give you access to sessionStorage from `https://api.example.com`, even though they share the same parent domain.

```python
page.goto("https://app.example.com")

# Works -- same origin
page.evaluate("sessionStorage.getItem('app_token')")

# Cannot access api.example.com's sessionStorage from here
# You would need to navigate: page.goto("https://api.example.com")
```

### Timing Matters

sessionStorage is often populated by JavaScript that runs after the initial page load. Reading it too early gives you an empty or incomplete snapshot.

```python
page.goto("https://example.com/app")

# Too early -- sessionStorage might be empty
# bad_data = page.evaluate("sessionStorage.length")

# Wait for the app to finish initializing
page.wait_for_load_state("networkidle")

# Or wait for a specific key to exist
page.wait_for_function(
    "sessionStorage.getItem('app_ready') !== null",
    timeout=10000
)

# Now sessionStorage should be populated
data = page.evaluate(
    "JSON.stringify(Object.fromEntries(Object.entries(sessionStorage)))"
)
```

### Iframes Have Separate sessionStorage

If the application uses iframes, each iframe has its own sessionStorage scoped to the iframe's origin. Access it through the frame object:

```python
frame = page.frame(name="payment-frame")
if frame:
    iframe_data = frame.evaluate(
        "JSON.stringify(Object.fromEntries(Object.entries(sessionStorage)))"
    )
    print(f"Iframe sessionStorage: {iframe_data}")
```

Cross-origin iframes are subject to browser security restrictions. If the iframe's origin differs from the parent page, you cannot access its sessionStorage through the parent's context.

### Page Navigation Resets on New Origins

If you navigate to a different origin within the same page, the sessionStorage changes to reflect the new origin's data. The previous origin's sessionStorage is not lost -- it is still there if you navigate back -- but you cannot access both simultaneously.

```python
page.goto("https://site-a.com")
page.evaluate("sessionStorage.setItem('source', 'site_a')")

page.goto("https://site-b.com")
# sessionStorage is now site-b.com's storage, not site-a.com's
result = page.evaluate("sessionStorage.getItem('source')")
print(result)  # None

page.goto("https://site-a.com")
# Back to site-a.com's storage
result = page.evaluate("sessionStorage.getItem('source')")
print(result)  # "site_a"
```

## Quick Reference

A summary of every sessionStorage operation through Playwright's `page.evaluate()`:

```python
# Read all keys and values
data = page.evaluate(
    "JSON.stringify(Object.fromEntries(Object.entries(sessionStorage)))"
)

# Read a single key
value = page.evaluate("sessionStorage.getItem('key_name')")

# Write a single key
page.evaluate("sessionStorage.setItem('key_name', 'value')")

# Write with Python variables
page.evaluate(
    "([k, v]) => sessionStorage.setItem(k, v)",
    ["key_name", "value"]
)

# Remove a single key
page.evaluate("sessionStorage.removeItem('key_name')")

# Clear all sessionStorage
page.evaluate("sessionStorage.clear()")

# Count stored keys
count = page.evaluate("sessionStorage.length")

# Get key by index
key = page.evaluate("sessionStorage.key(0)")
```

Every sessionStorage operation in Playwright is a `page.evaluate()` call wrapping the browser's native Storage API. There is no Playwright-specific abstraction for sessionStorage, and there does not need to be -- the JavaScript API is simple enough that `evaluate()` handles everything cleanly. The only complexity comes from sessionStorage's per-tab scoping and the fact that `storage_state()` does not cover it, which means you need the manual save-and-restore pattern any time session data needs to survive beyond a single page's lifetime.
