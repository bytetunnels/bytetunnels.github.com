---
title: "sessionStorage Monitoring: Watching for Dynamic State Changes"
date: 2026-02-08 10:00:00 +0000
categories: ["Data Extraction"]
tags: ["sessionstorage", "monitoring", "javascript", "browser automation", "playwright", "dynamic content"]
author: arman
image:
  path: /assets/img/2026-02-08-sessionstorage-monitoring-watching-dynamic-state-changes-hero.png
  alt: "sessionStorage Monitoring: Watching for Dynamic State Changes"
---

Single-page applications constantly update sessionStorage as users interact with the page. Search results get cached, auth tokens get refreshed, cart contents change, and filter states get persisted -- all without a single page reload. The problem for scrapers is that reading sessionStorage once, at a single point in time, misses everything that happens afterward. If you want the full picture of what an SPA is doing with client-side state, you need to monitor sessionStorage continuously and react to changes as they happen. This post covers two approaches to doing that in Playwright: intercepting writes at the JavaScript level, and polling with diffing. If you need to read and write sessionStorage data directly rather than monitor it, see our guide on [Playwright sessionStorage reading and writing](/posts/playwright-sessionstorage-reading-writing-session-data/). Both are practical, and which one you choose depends on what you are trying to capture.

## The Storage Event Limitation

Browsers fire a `storage` event when localStorage or sessionStorage changes. At first glance, this seems like the perfect monitoring mechanism. There is a catch that trips up nearly everyone who tries it: the `storage` event only fires in other tabs or windows on the same origin. It does not fire in the tab that made the change.

```javascript
// This listener will NEVER fire for changes made in the same tab
window.addEventListener("storage", (event) => {
    console.log("Changed key:", event.key);
    console.log("Old value:", event.oldValue);
    console.log("New value:", event.newValue);
});

// This write will NOT trigger the listener above
sessionStorage.setItem("test", "value");
```

This is by design in the Web Storage specification. The event exists so that other tabs can synchronize when storage changes, but since sessionStorage is tab-scoped, the `storage` event is essentially useless for sessionStorage monitoring. Even for localStorage, you would only catch changes made by other tabs, not by the page you are actually automating.

For browser automation, where you control a single page context and want to observe what that page does to its own sessionStorage, you need a different approach.

## Intercepting Writes by Overriding setItem

The most reliable way to catch every sessionStorage write as it happens is to override the `setItem` method before the page's own JavaScript runs. You replace `sessionStorage.setItem` with a wrapper function that logs the change and then calls the original method.

```javascript
const originalSetItem = sessionStorage.setItem.bind(sessionStorage);

sessionStorage.setItem = function(key, value) {
    console.log(JSON.stringify({
        type: "sessionStorage:set",
        key: key,
        value: value,
        timestamp: Date.now()
    }));
    return originalSetItem(key, value);
};
```

This intercepts every call to `setItem`, logs the key and value as a JSON string to the console, and then delegates to the real implementation so the application still works normally. The `.bind(sessionStorage)` is important -- without it, `this` inside the original method would point to the wrong object, and the call would fail.

To be thorough, you should also intercept `removeItem` and `clear` using the same pattern -- bind the original, wrap it, log the change, and delegate. The full three-method override is shown in the Playwright injection section below.

Some applications also write to sessionStorage using bracket notation (`sessionStorage["key"] = "value"`) or the property-based API (`sessionStorage.key = "value"`). These bypass `setItem` entirely. If you need to catch those, you would need to use a `Proxy`, which is more complex but covers every access pattern.

```javascript
const handler = {
    set(target, property, value) {
        // Ignore internal properties like "length"
        if (typeof property === "string" && property !== "length") {
            console.log(JSON.stringify({
                type: "sessionStorage:set",
                key: property,
                value: value,
                timestamp: Date.now()
            }));
        }
        return Reflect.set(target, property, value);
    },
    deleteProperty(target, property) {
        console.log(JSON.stringify({
            type: "sessionStorage:remove",
            key: property,
            timestamp: Date.now()
        }));
        return Reflect.deleteProperty(target, property);
    }
};

// Note: replacing window.sessionStorage with a Proxy is not always
// possible due to browser restrictions. The setItem override approach
// is more reliable in practice.
```

In practice, the `setItem` override catches the vast majority of writes because most frameworks use the standard API.

## Injecting the Monitor in Playwright

Playwright's `page.add_init_script()` runs JavaScript before any page script executes. This is the key to making the override work -- your interception code must be in place before the application starts writing to sessionStorage.

```python
from playwright.sync_api import sync_playwright
import json

MONITOR_SCRIPT = """
const originalSetItem = sessionStorage.setItem.bind(sessionStorage);
const originalRemoveItem = sessionStorage.removeItem.bind(sessionStorage);
const originalClear = sessionStorage.clear.bind(sessionStorage);

sessionStorage.setItem = function(key, value) {
    console.log(JSON.stringify({
        type: "sessionStorage:set",
        key: key,
        value: value,
        timestamp: Date.now()
    }));
    return originalSetItem(key, value);
};

sessionStorage.removeItem = function(key) {
    console.log(JSON.stringify({
        type: "sessionStorage:remove",
        key: key,
        timestamp: Date.now()
    }));
    return originalRemoveItem(key);
};

sessionStorage.clear = function() {
    console.log(JSON.stringify({
        type: "sessionStorage:clear",
        timestamp: Date.now()
    }));
    return originalClear();
};
"""

def monitor_sessionstorage(url: str):
    changes = []

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context()
        page = context.new_page()

        # Inject the monitor before any page script runs
        page.add_init_script(MONITOR_SCRIPT)

        # Listen for console messages from our injected script
        def handle_console(msg):
            if msg.type == "log":
                try:
                    data = json.loads(msg.text)
                    if data.get("type", "").startswith("sessionStorage:"):
                        changes.append(data)
                except (json.JSONDecodeError, ValueError):
                    pass

        page.on("console", handle_console)

        # Navigate and let the page do its thing
        page.goto(url, wait_until="networkidle")

        # Wait for additional dynamic updates
        page.wait_for_timeout(3000)

        browser.close()

    return changes


if __name__ == "__main__":
    url = "https://example.com"
    captured = monitor_sessionstorage(url)

    print(f"Captured {len(captured)} sessionStorage changes:\n")
    for change in captured:
        print(f"  [{change['type']}] {change.get('key', 'N/A')}")
        if "value" in change:
            preview = change["value"][:120]
            if len(change["value"]) > 120:
                preview += "..."
            print(f"    Value: {preview}")
        print()
```

The `page.add_init_script()` call registers the script at the context level. It runs on every navigation within that page, including soft navigations triggered by the SPA's router. This means the override survives client-side route changes without you needing to re-inject anything.

## The Polling Approach: Periodic Diff

The interception approach catches writes in real time, but it requires injecting code before the page loads. If you are working with a page that is already loaded, or if you want a simpler implementation that does not depend on console message parsing, polling with diffing is a solid alternative.

The idea is straightforward: read the entire contents of sessionStorage at regular intervals and compare each snapshot to the previous one.

```python
from playwright.sync_api import sync_playwright
import json
import time

def get_all_sessionstorage(page) -> dict:
    """Read all sessionStorage key-value pairs from the page."""
    return page.evaluate("""
        () => {
            const data = {};
            for (let i = 0; i < sessionStorage.length; i++) {
                const key = sessionStorage.key(i);
                data[key] = sessionStorage.getItem(key);
            }
            return data;
        }
    """)


def diff_storage(previous: dict, current: dict) -> list:
    """Compare two sessionStorage snapshots and return a list of changes."""
    changes = []
    all_keys = set(list(previous.keys()) + list(current.keys()))

    for key in all_keys:
        old_val = previous.get(key)
        new_val = current.get(key)

        if old_val is None and new_val is not None:
            changes.append({
                "type": "added",
                "key": key,
                "value": new_val
            })
        elif old_val is not None and new_val is None:
            changes.append({
                "type": "removed",
                "key": key,
                "previous_value": old_val
            })
        elif old_val != new_val:
            changes.append({
                "type": "modified",
                "key": key,
                "previous_value": old_val,
                "value": new_val
            })

    return changes


def poll_sessionstorage(url: str, duration_seconds: int = 15, interval_ms: int = 500):
    all_changes = []

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()
        page.goto(url, wait_until="networkidle")

        previous = get_all_sessionstorage(page)
        print(f"Initial sessionStorage: {len(previous)} keys")

        end_time = time.time() + duration_seconds
        poll_count = 0

        while time.time() < end_time:
            time.sleep(interval_ms / 1000)
            current = get_all_sessionstorage(page)
            changes = diff_storage(previous, current)

            if changes:
                poll_count += 1
                for change in changes:
                    change["poll_number"] = poll_count
                    change["timestamp"] = time.time()
                    all_changes.append(change)
                    print(f"  [{change['type']}] {change['key']}")

            previous = current

        browser.close()

    return all_changes


if __name__ == "__main__":
    results = poll_sessionstorage("https://example.com", duration_seconds=20)
    print(f"\nTotal changes detected: {len(results)}")
```


<figure>
  <img src="/assets/img/inline-sessionstorage-monitoring-watching-dynam-1.jpg" alt="Browsers are the universal interface to the web — and to its data." loading="lazy">
  <figcaption>Browsers are the universal interface to the web — and to its data. <span class="img-credit">Photo by cottonbro studio / <a href="https://www.pexels.com" target="_blank" rel="noopener noreferrer">Pexels</a></span></figcaption>
</figure>

## Polling Interval Trade-offs

The polling interval is a balancing act between responsiveness and overhead.

| Interval | Behavior |
|---|---|
| 100ms | Catches rapid changes but adds CPU overhead from frequent `page.evaluate()` calls. Can interfere with page performance on slower machines. |
| 250ms | Good compromise for most monitoring tasks. Misses changes that are written and overwritten within a quarter second, but this is rare. |
| 500ms | Reasonable default. Low overhead, catches most state changes that persist for any meaningful amount of time. |
| 1000ms+ | Only suitable for slow-changing state. Will miss transient writes entirely. |

For most scraping use cases, 250-500ms is the right range. If you are trying to capture rapidly changing state (like a live search that updates as the user types), drop to 100ms. If you are watching for occasional auth token refreshes, 1000ms or even 2000ms is fine.

The interception approach does not have this trade-off -- it catches every write regardless of timing, which is one reason to prefer it when you can inject the script early enough.

## Capturing API Response Caching

One of the most valuable things to monitor in sessionStorage is cached API responses. Many SPAs cache network responses in sessionStorage to avoid redundant requests when users navigate back and forth within the application. These cached payloads are often complete JSON objects, far richer than whatever subset the front-end renders into the DOM.

Here is an example that combines the interception approach with filtering for JSON-formatted values, which is a strong indicator of cached API data.

```python
from playwright.sync_api import sync_playwright
import json

MONITOR_SCRIPT = """
const originalSetItem = sessionStorage.setItem.bind(sessionStorage);

sessionStorage.setItem = function(key, value) {
    // Only log values that look like JSON objects or arrays
    const trimmed = value.trim();
    if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
        console.log(JSON.stringify({
            type: "sessionStorage:json",
            key: key,
            value: value,
            timestamp: Date.now()
        }));
    }
    return originalSetItem(key, value);
};
"""


def capture_cached_api_responses(url: str, interact_fn=None):
    """
    Monitor sessionStorage for cached API responses.

    Args:
        url: The page to monitor.
        interact_fn: Optional function that receives the page object
                     and performs interactions (clicks, searches, etc.)
                     to trigger API calls that get cached.
    """
    cached_responses = []

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context()
        page = context.new_page()

        page.add_init_script(MONITOR_SCRIPT)

        def handle_console(msg):
            if msg.type == "log":
                try:
                    data = json.loads(msg.text)
                    if data.get("type") == "sessionStorage:json":
                        # Parse the cached value itself
                        try:
                            parsed_value = json.loads(data["value"])
                            cached_responses.append({
                                "key": data["key"],
                                "data": parsed_value,
                                "timestamp": data["timestamp"]
                            })
                        except json.JSONDecodeError:
                            pass
                except (json.JSONDecodeError, ValueError):
                    pass

        page.on("console", handle_console)

        page.goto(url, wait_until="networkidle")

        # Perform interactions that trigger API calls
        if interact_fn:
            interact_fn(page)

        page.wait_for_timeout(2000)
        browser.close()

    return cached_responses


# Example: trigger a search and capture the cached results
def search_interaction(page):
    search_input = page.query_selector("input[type='search'], input[name='q']")
    if search_input:
        search_input.fill("web scraping tools")
        search_input.press("Enter")
        page.wait_for_timeout(3000)


if __name__ == "__main__":
    responses = capture_cached_api_responses(
        "https://example.com",
        interact_fn=search_interaction
    )

    for resp in responses:
        print(f"Key: {resp['key']}")
        print(f"Data type: {type(resp['data']).__name__}")
        if isinstance(resp["data"], list):
            print(f"Array length: {len(resp['data'])}")
        elif isinstance(resp["data"], dict):
            print(f"Object keys: {list(resp['data'].keys())[:10]}")
        print()
```

## Use Cases for sessionStorage Monitoring

Monitoring sessionStorage is not a technique you apply everywhere. It is most useful in specific scenarios where the DOM does not tell the full story.

**Tracking search results.** SPAs that cache search results in sessionStorage give you a direct path to structured data. Instead of parsing a rendered list of results with CSS selectors that might change on the next deploy, you can grab the cached API response -- complete with metadata, scores, and fields that the UI does not display.

**Monitoring cart state.** E-commerce sites that store cart data in sessionStorage update it on every add, remove, and quantity change. Monitoring these writes gives you a real-time feed of cart mutations, including intermediate states that only exist briefly before the UI re-renders.

**Observing auth token refreshes.** Applications that use short-lived JWTs stored in sessionStorage will periodically write new tokens as the old ones approach expiration. Monitoring these writes lets you detect token refresh cycles, extract valid tokens for API access, and understand the application's auth flow. For broader strategies around [saving cookies and localStorage in Selenium](/posts/selenium-session-management-saving-cookies-localstorage/), the principles are similar.

**Detecting feature flags and A/B test assignments.** Some applications write experiment assignments to sessionStorage during initialization. Monitoring the initial burst of writes after page load can reveal what variant of the site you are seeing and what features are enabled.


<figure>
  <img src="/assets/img/inline-sessionstorage-monitoring-watching-dynam-2.jpg" alt="Headless or headed, browsers remain the most reliable way to render the modern web." loading="lazy">
  <figcaption>Headless or headed, browsers remain the most reliable way to render the modern web. <span class="img-credit">Photo by cottonbro studio / <a href="https://www.pexels.com" target="_blank" rel="noopener noreferrer">Pexels</a></span></figcaption>
</figure>

## Building a sessionStorage Diff Tool

Combining both approaches into a reusable tool gives you the flexibility to either inject early for real-time interception or start monitoring a page that is already running.

```python
from playwright.sync_api import sync_playwright, Page
import json
import time
from dataclasses import dataclass, field
from typing import Optional, Callable


@dataclass
class StorageChange:
    change_type: str  # "set", "remove", "clear", "added", "modified", "removed"
    key: Optional[str]
    value: Optional[str]
    previous_value: Optional[str] = None
    timestamp: float = 0.0
    source: str = ""  # "intercept" or "poll"


class SessionStorageMonitor:
    def __init__(self):
        self.changes: list[StorageChange] = []
        self._previous_snapshot: dict = {}

    def get_init_script(self) -> str:
        """Return the JavaScript to inject via add_init_script."""
        return """
        const _origSet = sessionStorage.setItem.bind(sessionStorage);
        const _origRem = sessionStorage.removeItem.bind(sessionStorage);
        const _origClr = sessionStorage.clear.bind(sessionStorage);

        sessionStorage.setItem = function(k, v) {
            console.log(JSON.stringify({
                _ssm: true, type: "set", key: k, value: v, ts: Date.now()
            }));
            return _origSet(k, v);
        };
        sessionStorage.removeItem = function(k) {
            console.log(JSON.stringify({
                _ssm: true, type: "remove", key: k, ts: Date.now()
            }));
            return _origRem(k);
        };
        sessionStorage.clear = function() {
            console.log(JSON.stringify({
                _ssm: true, type: "clear", ts: Date.now()
            }));
            return _origClr();
        };
        """

    def attach_console_listener(self, page: Page):
        """Attach a console listener to capture intercepted changes."""
        def handler(msg):
            if msg.type == "log":
                try:
                    data = json.loads(msg.text)
                    if data.get("_ssm"):
                        self.changes.append(StorageChange(
                            change_type=data["type"],
                            key=data.get("key"),
                            value=data.get("value"),
                            timestamp=data.get("ts", 0) / 1000,
                            source="intercept"
                        ))
                except (json.JSONDecodeError, ValueError):
                    pass
        page.on("console", handler)

    def poll_once(self, page: Page) -> list[StorageChange]:
        """Take a snapshot and diff against the previous one."""
        current = page.evaluate("""
            () => {
                const d = {};
                for (let i = 0; i < sessionStorage.length; i++) {
                    const k = sessionStorage.key(i);
                    d[k] = sessionStorage.getItem(k);
                }
                return d;
            }
        """)

        new_changes = []
        all_keys = set(list(self._previous_snapshot.keys()) + list(current.keys()))

        for key in all_keys:
            old = self._previous_snapshot.get(key)
            new = current.get(key)

            if old is None and new is not None:
                change = StorageChange("added", key, new,
                                       timestamp=time.time(), source="poll")
                new_changes.append(change)
            elif old is not None and new is None:
                change = StorageChange("removed", key, None, old,
                                       timestamp=time.time(), source="poll")
                new_changes.append(change)
            elif old != new:
                change = StorageChange("modified", key, new, old,
                                       timestamp=time.time(), source="poll")
                new_changes.append(change)

        self.changes.extend(new_changes)
        self._previous_snapshot = current
        return new_changes

    def poll_loop(self, page: Page, duration_s: float = 10, interval_ms: int = 500):
        """Poll sessionStorage for a fixed duration."""
        end = time.time() + duration_s
        while time.time() < end:
            self.poll_once(page)
            time.sleep(interval_ms / 1000)

    def get_json_values(self) -> list[dict]:
        """Return all captured changes where the value is valid JSON."""
        results = []
        for change in self.changes:
            if change.value:
                try:
                    parsed = json.loads(change.value)
                    results.append({
                        "key": change.key,
                        "data": parsed,
                        "source": change.source
                    })
                except json.JSONDecodeError:
                    pass
        return results

    def summary(self) -> dict:
        """Return a summary of all captured changes."""
        keys_modified = set()
        for c in self.changes:
            if c.key:
                keys_modified.add(c.key)

        return {
            "total_changes": len(self.changes),
            "unique_keys": len(keys_modified),
            "keys": sorted(keys_modified),
            "by_type": {
                t: len([c for c in self.changes if c.change_type == t])
                for t in set(c.change_type for c in self.changes)
            }
        }
```

## Using the Monitor in a Scraping Pipeline

Here is how you would wire the monitor into a real scraping workflow. The interception and polling approaches can be used independently or combined.

```python
from playwright.sync_api import sync_playwright
import json


def scrape_with_monitoring(url: str, actions: list[dict] = None):
    """
    Navigate to a page, perform actions, and collect both DOM data
    and sessionStorage changes.
    """
    monitor = SessionStorageMonitor()

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context()
        page = context.new_page()

        # Set up interception before navigation
        page.add_init_script(monitor.get_init_script())
        monitor.attach_console_listener(page)

        page.goto(url, wait_until="networkidle")

        # Take initial snapshot for polling baseline
        monitor.poll_once(page)

        # Perform scripted actions
        if actions:
            for action in actions:
                if action["type"] == "click":
                    page.click(action["selector"])
                elif action["type"] == "fill":
                    page.fill(action["selector"], action["value"])
                elif action["type"] == "press":
                    page.press(action["selector"], action["key"])
                elif action["type"] == "wait":
                    page.wait_for_timeout(action.get("ms", 1000))

                # Poll after each action to catch changes
                monitor.poll_once(page)

        # Final poll to catch any trailing writes
        page.wait_for_timeout(1000)
        monitor.poll_once(page)

        # Also extract DOM data as usual
        dom_data = page.evaluate("""
            () => ({
                title: document.title,
                url: window.location.href,
                text_content_length: document.body.innerText.length
            })
        """)

        browser.close()

    return {
        "dom": dom_data,
        "storage_summary": monitor.summary(),
        "storage_changes": [
            {
                "type": c.change_type,
                "key": c.key,
                "value_preview": (c.value or "")[:200]
            }
            for c in monitor.changes
        ],
        "cached_json": monitor.get_json_values()
    }


if __name__ == "__main__":
    result = scrape_with_monitoring(
        "https://example.com",
        actions=[
            {"type": "fill", "selector": "input[name='q']", "value": "test query"},
            {"type": "press", "selector": "input[name='q']", "key": "Enter"},
            {"type": "wait", "ms": 3000},
        ]
    )
    print(f"Storage changes: {result['storage_summary']['total_changes']}")
    print(f"Cached JSON payloads: {len(result['cached_json'])}")
```

## Extracting Monitored Data for Your Pipeline

Once you have captured sessionStorage changes, you need to get that data out of the monitoring layer and into whatever pipeline processes your scraped data. The monitor class stores everything in memory via `monitor.changes`, so you can serialize it directly to JSON with `json.dumps()`, flatten JSON values into CSV rows, or filter changes by key pattern with a simple list comprehension.

The key insight is that sessionStorage monitoring gives you a stream of structured data that would be tedious or impossible to extract from the DOM alone. For techniques on [extracting ephemeral browser data from sessionStorage](/posts/scraping-sessionstorage-extracting-ephemeral-browser-data/) in a one-shot fashion, that approach complements continuous monitoring well. Cached API responses in sessionStorage are already JSON -- you skip the entire parsing step. Auth tokens are stored as plain strings -- no need to intercept network requests. Cart mutations happen as discrete writes -- you get a clean event stream instead of trying to diff rendered HTML.

For pages where the data you need flows through sessionStorage, monitoring it is often simpler and more reliable than any DOM-based extraction strategy. Inject the interception script with `page.add_init_script()`, listen for console messages with `page.on("console")`, and let the application hand you its own data.
