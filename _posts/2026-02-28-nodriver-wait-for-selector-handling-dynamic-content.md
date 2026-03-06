---
title: "Nodriver wait_for_selector: Handling Dynamic Content"
date: 2026-02-28 10:00:00 +0000
categories: ["Browser Automation"]
tags: ["nodriver", "python", "wait_for_selector", "dynamic content", "async", "web scraping"]
author: arman
image:
  path: /assets/img/2026-02-28-nodriver-wait-for-selector-handling-dynamic-content-hero.png
  alt: "Nodriver wait_for_selector: Handling Dynamic Content"
---

Dynamic content is the single biggest reason browser automation scripts fail silently. If you are just [getting started with nodriver](/posts/getting-started-nodriver-python-installation-first-script/), make sure you have your environment set up before tackling dynamic content. A page loads, your script grabs the HTML, and the data you expected is not there. No error, no crash, just empty results. The problem is timing: modern websites load content through JavaScript after the initial HTML arrives, and if your script reads the DOM before that JavaScript finishes, it finds nothing. [Nodriver](/posts/nodriver-complete-guide-undetected-browser-automation-python/), being async and built on the Chrome DevTools Protocol, gives you several ways to wait for elements to appear. But there is no built-in `wait_for_selector` method like you might know from [Playwright](/posts/playwright-wait-for-selector-python-waiting-elements-reliably/). You need to build your own, and this post shows you how.

## Why You Cannot Just Read the Page Immediately

When nodriver navigates to a URL with `await browser.get()`, it waits for the initial page load event. But that event fires when the HTML and its synchronous resources finish loading. It does not wait for:

- AJAX requests that fetch data from an API
- JavaScript frameworks that render components after hydration
- Lazy-loaded content that appears on scroll
- Elements inserted by third-party scripts (ads, widgets, chat bubbles)
- Content gated behind client-side authentication checks

Here is what happens when you try to extract content too early:

```python
import nodriver as uc
import asyncio


async def main():
    browser = await uc.start()
    page = await browser.get("https://example.com/dynamic-dashboard")

    # This often returns None because the data table
    # has not been rendered by JavaScript yet
    table = await page.select("table.data-grid")
    print(table)  # None

    browser.stop()


if __name__ == "__main__":
    uc.loop().run_until_complete(main())
```

The page HTML might contain a `<div id="app"></div>` and nothing else. The actual table gets injected by a JavaScript framework seconds later. Your script ran before that happened.

## The Crude Approach: page.sleep

The simplest way to wait is to add a fixed delay:

```python
page = await browser.get("https://example.com/dynamic-dashboard")
await page.sleep(5)  # Wait 5 seconds and hope for the best
table = await page.select("table.data-grid")
```

This works some of the time. The problems are obvious:

- **Too short** and the content still is not there. Your script fails.
- **Too long** and you waste time on every page load, which compounds across hundreds of pages.
- **Inconsistent** because network speed, server load, and page complexity all vary. A 5-second wait that works on your machine might fail in a CI environment or on a different network.

Fixed sleeps should be your last resort, not your first tool. For a broader look at why [timing and waits matter in browser automation](/posts/timing-is-everything-mastering-waits-in-browser-automation/), see our dedicated guide. Use them only when you have no selector to wait for and need a quick-and-dirty solution.

## Using page.select with Retry Logic

Nodriver's `page.select(selector)` returns the first matching element or `None` if nothing matches. You can wrap it in a loop that polls until the element appears:

```python
import nodriver as uc
import time
import asyncio


async def wait_for_selector(page, selector, timeout=10):
    """Poll for an element matching the CSS selector until it appears or timeout."""
    start = time.time()
    while time.time() - start < timeout:
        element = await page.select(selector)
        if element:
            return element
        await page.sleep(0.5)
    raise TimeoutError(f"Selector '{selector}' not found within {timeout}s")


async def main():
    browser = await uc.start()
    page = await browser.get("https://example.com/dynamic-dashboard")

    try:
        table = await wait_for_selector(page, "table.data-grid", timeout=15)
        print("Table found:", table.tag_name)
    except TimeoutError as e:
        print(f"Gave up waiting: {e}")

    browser.stop()


if __name__ == "__main__":
    uc.loop().run_until_complete(main())
```

This is the core pattern and the closest equivalent to Playwright's `page.wait_for_selector()`. The function checks every 0.5 seconds, returns the element as soon as it appears, and raises a clear error if the timeout expires. You control both the polling interval and the maximum wait time.

## A More Flexible wait_for_selector

The basic version works, but real-world scraping demands more flexibility. Here is an improved version that handles common edge cases:

```python
import nodriver as uc
import time
import asyncio


async def wait_for_selector(
    page,
    selector,
    timeout=10,
    poll_interval=0.5,
    visible=False,
):
    """
    Wait for a CSS selector to match an element in the DOM.

    Args:
        page: The nodriver page/tab object.
        selector: CSS selector string.
        timeout: Maximum seconds to wait before raising TimeoutError.
        poll_interval: Seconds between each check.
        visible: If True, also verify the element has non-zero dimensions.

    Returns:
        The matched element.

    Raises:
        TimeoutError: If the selector is not found within the timeout.
    """
    start = time.time()
    last_error = None

    while time.time() - start < timeout:
        try:
            element = await page.select(selector)
            if element:
                if visible:
                    # Check that the element is actually visible on the page
                    is_visible = await page.evaluate(
                        """
                        (selector) => {
                            const el = document.querySelector(selector);
                            if (!el) return false;
                            const rect = el.getBoundingClientRect();
                            const style = window.getComputedStyle(el);
                            return (
                                rect.width > 0 &&
                                rect.height > 0 &&
                                style.display !== 'none' &&
                                style.visibility !== 'hidden' &&
                                style.opacity !== '0'
                            );
                        }
                        """,
                        selector,
                    )
                    if is_visible:
                        return element
                else:
                    return element
        except Exception as e:
            last_error = e

        await page.sleep(poll_interval)

    msg = f"Selector '{selector}' not found within {timeout}s"
    if last_error:
        msg += f" (last error: {last_error})"
    raise TimeoutError(msg)
```

The `visible` parameter is important. Many sites render hidden elements first and then show them with a CSS transition or by toggling a class. If you only check for DOM presence, you might grab an element that has `display: none` and contains no useful content yet.


<figure>
  <img src="/assets/img/inline-nodriver-wait-for-selector-handling-dyna-1.jpg" alt="Staying undetected requires understanding what detection systems look for." loading="lazy">
  <figcaption>Staying undetected requires understanding what detection systems look for. <span class="img-credit">Photo by Maxim Landolfi / <a href="https://www.pexels.com" target="_blank" rel="noopener noreferrer">Pexels</a></span></figcaption>
</figure>

## Waiting for Text Content to Appear

Sometimes the element exists in the DOM from the start, but its text content loads asynchronously. A `<span class="price"></span>` is there on page load, but the actual price gets injected by an API call. For this case, you need to wait for text, not just the element:

```python
async def wait_for_text(page, selector, timeout=10, poll_interval=0.5):
    """Wait until an element matching the selector contains non-empty text."""
    start = time.time()
    while time.time() - start < timeout:
        element = await page.select(selector)
        if element and element.text and element.text.strip():
            return element
        await page.sleep(poll_interval)
    raise TimeoutError(
        f"Selector '{selector}' did not contain text within {timeout}s"
    )


async def main():
    browser = await uc.start()
    page = await browser.get("https://example.com/product/12345")

    price_element = await wait_for_text(page, "span.product-price", timeout=10)
    print(f"Price: {price_element.text}")

    browser.stop()
```

You can extend this pattern to match specific text using `re.compile(pattern).search(element.text)` inside the polling loop -- for example, waiting until a price field matches `r"\$\d+\.\d{2}"`.

## Waiting for Network Requests to Complete

Some pages keep loading data long after the initial DOM settles. You can monitor network activity through CDP events to know when the page is truly idle. This is useful for single-page applications that make several API calls during rendering.

```python
import nodriver as uc
import nodriver.cdp as cdp
import asyncio


async def wait_for_network_idle(page, idle_time=2.0, timeout=30):
    """
    Wait until no network requests have been made for idle_time seconds.
    Uses CDP network events to track in-flight requests.
    """
    pending_requests = set()
    last_activity = asyncio.get_event_loop().time()
    network_idle = asyncio.Event()

    async def on_request(event):
        nonlocal last_activity
        request_id = event.request_id
        pending_requests.add(request_id)
        last_activity = asyncio.get_event_loop().time()

    async def on_response(event):
        nonlocal last_activity
        request_id = event.request_id
        pending_requests.discard(request_id)
        last_activity = asyncio.get_event_loop().time()

    async def on_failed(event):
        nonlocal last_activity
        request_id = event.request_id
        pending_requests.discard(request_id)
        last_activity = asyncio.get_event_loop().time()

    # Enable network tracking via CDP
    await page.send(cdp.network.enable())

    # Subscribe to network events
    page.add_handler(cdp.network.RequestWillBeSent, on_request)
    page.add_handler(cdp.network.ResponseReceived, on_response)
    page.add_handler(cdp.network.LoadingFailed, on_failed)

    start = asyncio.get_event_loop().time()
    while True:
        now = asyncio.get_event_loop().time()
        if now - start > timeout:
            raise TimeoutError(
                f"Network did not become idle within {timeout}s "
                f"({len(pending_requests)} requests still pending)"
            )
        if len(pending_requests) == 0 and (now - last_activity) >= idle_time:
            break
        await asyncio.sleep(0.25)
```

This is a heavier approach and you should not use it as your default. It is best reserved for complex pages where you do not know which specific element to wait for, or when the page makes unpredictable numbers of API calls before settling.

## Waiting for Navigation

When clicking a link or submitting a form triggers a full page navigation, you need to wait for the new page to load before interacting with it. Nodriver handles this through the page object returned by navigation:

```python
import nodriver as uc
import asyncio


async def main():
    browser = await uc.start()
    page = await browser.get("https://example.com/login")

    # Fill in form fields
    username_field = await page.select("input[name='username']")
    await username_field.send_keys("myuser")

    password_field = await page.select("input[name='password']")
    await password_field.send_keys("mypassword")

    # Click submit - this triggers navigation
    submit_button = await page.select("button[type='submit']")
    await submit_button.click()

    # Wait for an element that only exists on the post-login page
    dashboard = await wait_for_selector(page, "div.dashboard-container", timeout=15)
    print("Login successful, dashboard loaded")

    browser.stop()


if __name__ == "__main__":
    uc.loop().run_until_complete(main())
```

For single-page applications that update the URL without a full page reload, waiting for a selector on the new view is the most reliable approach. You can also poll the URL:

```python
import re
import time


async def wait_for_url(page, url_pattern, timeout=10, poll_interval=0.5):
    """Wait until the page URL matches a pattern."""
    compiled = re.compile(url_pattern)
    start = time.time()
    while time.time() - start < timeout:
        current_url = await page.evaluate("window.location.href")
        if compiled.search(current_url):
            return current_url
        await page.sleep(poll_interval)
    raise TimeoutError(f"URL did not match '{url_pattern}' within {timeout}s")
```


<figure>
  <img src="/assets/img/inline-nodriver-wait-for-selector-handling-dyna-2.jpg" alt="The less a browser looks automated, the better it performs against detection." loading="lazy">
  <figcaption>The less a browser looks automated, the better it performs against detection. <span class="img-credit">Photo by Rafael Rendon / <a href="https://www.pexels.com" target="_blank" rel="noopener noreferrer">Pexels</a></span></figcaption>
</figure>

## Common Patterns

### Wait for a Loading Spinner to Disappear

Many sites show a spinner or skeleton screen while fetching data. You want to wait for that indicator to be removed from the DOM:

```python
async def wait_for_selector_gone(page, selector, timeout=10, poll_interval=0.5):
    """Wait until no element matches the selector."""
    start = time.time()
    while time.time() - start < timeout:
        element = await page.select(selector)
        if not element:
            return True
        await page.sleep(poll_interval)
    raise TimeoutError(f"Selector '{selector}' still present after {timeout}s")


# Usage
page = await browser.get("https://example.com/reports")
await wait_for_selector_gone(page, "div.loading-spinner", timeout=20)
data = await page.select("table.report-data")
```

### Wait for a Data Table to Populate

A table element might exist in the DOM but have zero rows until an API response populates it:

{% raw %}
```python
async def wait_for_table_rows(page, table_selector, min_rows=1, timeout=10):
    """Wait until a table has at least min_rows data rows."""
    start = time.time()
    while time.time() - start < timeout:
        row_count = await page.evaluate(
            f"""
            (() => {{
                const table = document.querySelector('{table_selector}');
                if (!table) return 0;
                return table.querySelectorAll('tbody tr').length;
            }})()
            """
        )
        if row_count and row_count >= min_rows:
            return row_count
        await page.sleep(0.5)
    raise TimeoutError(
        f"Table '{table_selector}' did not reach {min_rows} rows within {timeout}s"
    )


# Usage
page = await browser.get("https://example.com/search?q=nodriver")
row_count = await wait_for_table_rows(page, "table.search-results", min_rows=1, timeout=15)
print(f"Table loaded with {row_count} rows")
```
{% endraw %}

### Wait for Multiple Selectors

Sometimes you need several elements to appear before the page is ready:

```python
async def wait_for_all_selectors(page, selectors, timeout=10, poll_interval=0.5):
    """Wait until all selectors match at least one element."""
    start = time.time()
    while time.time() - start < timeout:
        all_found = True
        for selector in selectors:
            element = await page.select(selector)
            if not element:
                all_found = False
                break
        if all_found:
            return True
        await page.sleep(poll_interval)
    raise TimeoutError(
        f"Not all selectors found within {timeout}s"
    )


# Wait for header, sidebar, and main content to all be present
await wait_for_all_selectors(page, [
    "header.site-header",
    "nav.sidebar",
    "main.content-area",
], timeout=15)
```

## Error Handling and Reliability

### Timeout Errors

Always wrap your waits in try/except blocks. A timeout does not always mean the page is broken. It might mean the selector changed, the site redesigned, or the network was slow:

```python
async def safe_scrape(browser, url, selector, timeout=10):
    """Attempt to scrape with proper error handling."""
    page = await browser.get(url)

    try:
        element = await wait_for_selector(page, selector, timeout=timeout)
        return element.text
    except TimeoutError:
        # Take a screenshot for debugging
        await page.save_screenshot("debug_timeout.png")

        # Log what we can see on the page
        title = await page.evaluate("document.title")
        url = await page.evaluate("window.location.href")
        print(f"Timeout on {url} (title: {title})")

        return None
```

### Stale Elements

In a dynamic page, an element you found a moment ago might be removed from the DOM and replaced. This happens frequently with frameworks like React that re-render components. If you store a reference to an element and try to use it later, the operation may fail.

The safest approach is to re-select the element right before you interact with it. For more on [clicking and element interaction in nodriver](/posts/nodriver-click-handling-page-click-element-interaction/), see our dedicated guide:

```python
# Risky: element might go stale between these two lines
element = await wait_for_selector(page, "button.load-more")
await page.sleep(2)  # Something might re-render during this wait
await element.click()  # Could fail if the element was replaced

# Safer: re-select immediately before interaction
await wait_for_selector(page, "button.load-more")
button = await page.select("button.load-more")
if button:
    await button.click()
```

### Retry on Failure

For critical scraping jobs, wrap the entire page interaction -- `browser.get()`, `wait_for_selector`, and extraction -- in a retry loop with `max_retries`. On each `TimeoutError`, log the attempt number, sleep briefly, and retry. This handles transient network issues and intermittent slow loads without manual intervention.

## Putting It All Together

A complete scraping function combines the wait strategies shown above in sequence: first `wait_for_selector_gone` for any loading overlay, then `wait_for_selector` for the main content elements, then `wait_for_text` for data that loads from a separate API call. Each step gets its own try/except block with a timeout, so a failure at one stage does not crash the entire run. After all waits pass, use `page.evaluate()` with JavaScript to extract structured data from the fully-loaded DOM.

## Choosing the Right Wait Strategy

Not every situation calls for the same approach. Here is a quick reference:

| Situation | Strategy | Why |
|---|---|---|
| Element loads after AJAX call | `wait_for_selector` | Polls until the element appears in the DOM |
| Element exists but content is empty | `wait_for_text` | Checks for non-empty text, not just DOM presence |
| Loading spinner or skeleton screen | `wait_for_selector_gone` | Waits for the indicator to be removed |
| SPA navigation after click | `wait_for_selector` on new view | More reliable than watching the URL |
| Unknown number of API calls | `wait_for_network_idle` | Monitors CDP network events |
| Quick prototype or debugging | `page.sleep` | Fast to write, unreliable for production |

The polling approach with `page.select` in a loop is the workhorse. It covers the vast majority of cases, runs efficiently with a 0.5-second interval, and gives you clear timeout errors when things go wrong. Start there and reach for the more specialized strategies only when you need them.
