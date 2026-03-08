---
title: "Closing Browsers Properly in Nodriver: browser.close() and browser.stop()"
date: 2026-02-09 12:00:00 +0000
categories: ["Browser Automation"]
tags: ["nodriver", "browser close", "cleanup", "python", "browser automation", "best practices"]
author: arman
image:
  path: /assets/img/2026-02-09-closing-browsers-properly-nodriver-browser-close-stop-hero.jpg
  alt: "Closing Browsers Properly in Nodriver: browser.close() and browser.stop()"
---

Every Chrome instance nodriver launches is a real operating system process with its own memory allocation, temporary files, network sockets, and debugging port. If your script finishes without shutting that process down, it does not vanish. It keeps running. Run a scraping script ten times without proper cleanup and you have ten Chrome processes consuming RAM, holding open ports, and writing to disk. This is not a theoretical concern. Zombie Chrome processes are one of the most common problems in browser automation, and they are entirely preventable if you close browsers correctly.

If you are new to the library, the [complete guide to nodriver](/posts/nodriver-complete-guide-undetected-browser-automation-python/) provides broader context. Nodriver handles browser lifecycle differently from Selenium or Playwright. There is no `browser.close()` coroutine that you await. The primary shutdown method is `browser.stop()`, a synchronous call that sends a termination signal to the Chrome process. Understanding this distinction, and the patterns that make cleanup reliable, is the difference between scripts that run cleanly in production and scripts that slowly eat your server alive.

## browser.stop() Is the Primary Shutdown Method

In nodriver, `browser.stop()` is the method that terminates the Chrome process your script launched. It is a synchronous method, not a coroutine. You call it without `await`:

```python
import nodriver as uc
import asyncio


async def main():
    browser = await uc.start()
    page = await browser.get("https://example.com")

    title = await page.evaluate("document.title")
    print(title)

    browser.stop()


if __name__ == "__main__":
    uc.loop().run_until_complete(main())
```

When `browser.stop()` executes, it does the following:

1. Sends a shutdown command to the Chrome process through the DevTools Protocol connection
2. Closes the WebSocket connection between your script and Chrome
3. Terminates the Chrome subprocess

This is a clean shutdown. Chrome gets a chance to close its tabs, flush any pending writes, and release its debugging port. After `browser.stop()` returns, the Chrome process is gone and its resources are freed.

## Why There Is No await browser.close()

If you come from Playwright, your muscle memory tells you to write `await browser.close()`. In nodriver, `browser.close()` does not exist as a documented API method in the way Playwright implements it. The shutdown mechanism is `browser.stop()`, and it is synchronous.

This catches people off guard. The instinct is to write:

```python
# This is NOT the correct nodriver pattern
await browser.close()  # AttributeError or unexpected behavior
```

The correct call is simply:

```python
browser.stop()
```

No `await`, no parentheses tricks. Just a direct synchronous method call. This design makes sense when you consider that nodriver manages Chrome as a subprocess. Stopping a subprocess is fundamentally a synchronous operation at the OS level: you send a signal and the process terminates.

## When to Call browser.stop()

You should call `browser.stop()` in three situations:

**End of script execution.** When your scraping or automation task is complete and you no longer need the browser:

```python
async def main():
    browser = await uc.start()
    page = await browser.get("https://example.com")
    # ... do your work ...
    browser.stop()
```

**In error handling blocks.** When an exception occurs and you need to clean up before the script exits:

```python
async def main():
    browser = await uc.start()
    try:
        page = await browser.get("https://example.com")
        data = await page.select("div.nonexistent")
        # If this raises, the finally block still closes Chrome
    except Exception as e:
        print(f"Error: {e}")
    finally:
        browser.stop()
```

**When rotating browsers.** Some scraping workflows launch a fresh browser periodically to get a new fingerprint or clear accumulated state:

```python
async def scrape_batch(urls):
    for i, url in enumerate(urls):
        browser = await uc.start()
        try:
            page = await browser.get(url)
            # ... extract data ...
        finally:
            browser.stop()
```

## The Proper Cleanup Pattern

The most reliable way to ensure Chrome gets shut down is the try/finally pattern. This guarantees `browser.stop()` runs whether your code succeeds, raises an exception, or encounters any other issue:

```python
import nodriver as uc
import asyncio


async def main():
    browser = await uc.start()
    try:
        page = await browser.get("https://example.com")

        # Navigate, click, extract data
        heading = await page.select("h1")
        if heading:
            print(heading.text)

        # Visit another page
        page = await browser.get("https://example.com/about")
        content = await page.select("div.content")
        if content:
            print(content.text)

    except Exception as e:
        print(f"Scraping failed: {e}")
    finally:
        browser.stop()


if __name__ == "__main__":
    uc.loop().run_until_complete(main())
```

This pattern handles every scenario:

- **Normal completion**: code runs, finally block executes, Chrome stops
- **Exception during scraping**: except block catches it, finally block still executes, Chrome stops
- **Keyboard interrupt**: finally block still executes, Chrome stops
- **System exit**: finally block executes in most cases, Chrome stops

Never put `browser.stop()` inside the try block itself unless it is the very last line. If any code after `browser.stop()` tries to use the browser, you get connection errors. The finally block is the right place because it runs after everything else.


<figure>
  <img src="/assets/img/inline-closing-browsers-properly-nodriver-brows-1.jpg" alt="Staying undetected requires understanding what detection systems look for." loading="lazy">
  <figcaption>Staying undetected requires understanding what detection systems look for. <span class="img-credit">Photo by Maxim Landolfi / <a href="https://www.pexels.com" target="_blank" rel="noopener noreferrer">Pexels</a></span></figcaption>
</figure>

## Closing Individual Tabs Without Stopping the Browser

Sometimes you want to close a specific tab but keep the browser running. This is common in multi-tab workflows where you open a link in a new tab, extract data, and close that tab before moving on:

```python
async def main():
    browser = await uc.start()
    try:
        # Open first page
        main_page = await browser.get("https://example.com")

        # Open a second tab
        second_page = await browser.get("https://example.com/details", new_tab=True)

        # Extract data from the second tab
        detail = await second_page.select("div.detail")
        if detail:
            print(detail.text)

        # Close only the second tab
        await second_page.close()

        # The browser is still running, main_page is still accessible
        links = await main_page.select_all("a")
        print(f"Found {len(links)} links on main page")

    finally:
        browser.stop()
```

Key differences between `page.close()` and `browser.stop()`:

| Action | What it does | Sync/Async | Browser still running? |
|---|---|---|---|
| `await page.close()` | Closes one tab | Async (awaitable) | Yes |
| `browser.stop()` | Terminates the entire Chrome process | Sync | No |

Use `page.close()` when you need the browser to keep running. Use `browser.stop()` when you are done with the browser entirely.

## What Happens When You Do Not Close the Browser

If your script exits without calling `browser.stop()`, the Chrome process keeps running as an orphan. Here is what that looks like in practice:

**Zombie processes accumulate.** Each run of your script spawns a new Chrome instance. After ten runs, you have ten Chrome processes. After a hundred runs on a cron job, you have a hundred:

```bash
# Check for orphaned Chrome processes
ps aux | grep chrome | grep -v grep
```

On a server running scheduled scraping jobs, this fills memory within hours.

**Debugging ports get locked.** Nodriver connects to Chrome on a debugging port (usually starting around 9222). If Chrome is still running on that port when your next script starts, nodriver needs to find a different port. Enough orphaned processes and you run out of available ports in the range:

```python
# This can fail if the port is still held by a zombie Chrome
browser = await uc.start(browser_args=["--remote-debugging-port=9222"])
```

**Temporary files pile up.** Chrome creates a user data directory for each session. Without a clean shutdown, these directories may not get cleaned up. On Linux, they land in `/tmp` and eventually fill the partition:

```bash
# Orphaned Chrome profile directories
ls /tmp/.org.chromium.* 2>/dev/null
ls /tmp/tmp*/   2>/dev/null
```

**Memory consumption climbs.** A single headless Chrome instance uses 100-300 MB of RAM depending on the pages loaded. Ten orphans can consume 2-3 GB. On a VPS with 4 GB of total memory, that is a crash waiting to happen.

## Handling Chrome Crashes

Sometimes Chrome crashes before your script gets a chance to call `browser.stop()`. A page might trigger a GPU error, run out of memory, or hit a rendering bug. When this happens, the Chrome process is already dead but your script does not know that.

Calling `browser.stop()` on an already-dead process is generally safe. Nodriver handles this gracefully. The call either sends the shutdown signal (which fails silently because the process is gone) or recognizes the process has already terminated. Either way, it does not raise an exception that would break your script.

But you should still handle the case where Chrome dies mid-operation:

```python
import nodriver as uc
import asyncio


async def main():
    browser = await uc.start()
    try:
        page = await browser.get("https://example.com")

        # This might fail if Chrome crashes during navigation
        try:
            page = await browser.get("https://heavy-page-that-might-crash.com")
        except ConnectionError:
            print("Chrome connection lost, likely crashed")
            return
        except Exception as e:
            print(f"Navigation failed: {e}")
            return

        # Continue with data extraction
        data = await page.evaluate("document.title")
        print(data)

    finally:
        try:
            browser.stop()
        except Exception:
            # Chrome may already be dead, that is fine
            pass


if __name__ == "__main__":
    uc.loop().run_until_complete(main())
```

The nested try/except around `browser.stop()` in the finally block is defensive programming. In production scripts that run unattended, you want the cleanup to never be the thing that throws an unhandled exception.


<figure>
  <img src="/assets/img/inline-closing-browsers-properly-nodriver-brows-2.jpg" alt="The less a browser looks automated, the better it performs against detection." loading="lazy">
  <figcaption>The less a browser looks automated, the better it performs against detection. <span class="img-credit">Photo by Rafael Rendon / <a href="https://www.pexels.com" target="_blank" rel="noopener noreferrer">Pexels</a></span></figcaption>
</figure>

## Setting a Timeout So Close Does Not Hang

In rare cases, Chrome might not respond to the shutdown signal promptly. The process could be stuck in a page that runs heavy JavaScript, has an infinite loop, or is deadlocked on a system call. If `browser.stop()` takes too long, your script hangs.

You can wrap the shutdown in a timeout using asyncio:

```python
import nodriver as uc
import asyncio
import signal
import os


async def stop_with_timeout(browser, timeout=10):
    """Stop the browser, forcefully kill if it does not respond."""
    loop = asyncio.get_event_loop()

    try:
        # Run browser.stop() in a thread to make it cancellable
        await asyncio.wait_for(
            loop.run_in_executor(None, browser.stop),
            timeout=timeout
        )
    except asyncio.TimeoutError:
        print(f"Browser did not stop within {timeout}s, force killing")
        # Force kill the Chrome process if it exists
        if hasattr(browser, '_process') and browser._process:
            try:
                browser._process.kill()
            except ProcessLookupError:
                pass  # Already dead


async def main():
    browser = await uc.start()
    try:
        page = await browser.get("https://example.com")
        title = await page.evaluate("document.title")
        print(title)
    finally:
        await stop_with_timeout(browser, timeout=10)


if __name__ == "__main__":
    uc.loop().run_until_complete(main())
```

This approach gives Chrome a grace period to shut down cleanly. If it does not respond within the timeout, the script forcefully kills the process. This is the right balance between clean shutdown and guaranteed cleanup.

## Cleaning Up Orphaned Chrome Processes

If you have already accumulated zombie Chrome processes from scripts that did not clean up properly, you need to find and kill them. Here are platform-specific approaches.

**Linux and macOS:**

```bash
# Find Chrome processes launched by nodriver
# They typically have --remote-debugging-port in their arguments
ps aux | grep '[c]hrome.*remote-debugging-port'

# Kill all orphaned Chrome processes
pkill -f 'chrome.*remote-debugging-port'
```

**Scripted cleanup in Python:**

```python
import subprocess
import sys


def kill_orphaned_chrome():
    """Kill Chrome processes that have remote debugging enabled."""
    if sys.platform == "win32":
        # Windows
        subprocess.run(
            ["taskkill", "/F", "/IM", "chrome.exe", "/FI",
             "WINDOWTITLE eq *remote-debugging*"],
            capture_output=True
        )
    else:
        # Linux / macOS
        result = subprocess.run(
            ["pgrep", "-f", "chrome.*remote-debugging-port"],
            capture_output=True, text=True
        )
        pids = result.stdout.strip().split("\n")
        for pid in pids:
            if pid:
                try:
                    subprocess.run(["kill", "-9", pid], capture_output=True)
                    print(f"Killed orphaned Chrome process {pid}")
                except Exception:
                    pass


if __name__ == "__main__":
    kill_orphaned_chrome()
```

You can run this cleanup function at the start of your scraping script to ensure a clean slate:

```python
async def main():
    # Clean up any leftover Chrome from previous runs
    kill_orphaned_chrome()

    browser = await uc.start()
    try:
        page = await browser.get("https://example.com")
        # ... scraping logic ...
    finally:
        browser.stop()
```

## Context Manager Pattern for Automatic Cleanup

Python's context manager protocol (`async with`) is the most Pythonic way to guarantee cleanup. Nodriver does not provide a built-in context manager, but you can build one:

```python
import nodriver as uc
import asyncio
from contextlib import asynccontextmanager


@asynccontextmanager
async def managed_browser(**kwargs):
    """Context manager that guarantees browser cleanup."""
    browser = await uc.start(**kwargs)
    try:
        yield browser
    finally:
        try:
            browser.stop()
        except Exception:
            pass


async def main():
    async with managed_browser() as browser:
        page = await browser.get("https://example.com")
        title = await page.evaluate("document.title")
        print(title)
    # browser.stop() has already been called at this point


if __name__ == "__main__":
    uc.loop().run_until_complete(main())
```

This pattern has several advantages:

- **Impossible to forget cleanup.** The context manager handles it automatically.
- **Exception safe.** Whether the code inside the `async with` block raises or not, cleanup happens.
- **Composable.** You can nest it with other context managers for database connections, file handles, or proxies.

You can extend the context manager to include additional cleanup:

```python
@asynccontextmanager
async def managed_browser(cleanup_orphans=False, **kwargs):
    """Context manager with optional orphan cleanup."""
    if cleanup_orphans:
        kill_orphaned_chrome()

    browser = await uc.start(**kwargs)
    try:
        yield browser
    finally:
        try:
            browser.stop()
        except Exception:
            pass


async def main():
    async with managed_browser(cleanup_orphans=True) as browser:
        page = await browser.get("https://example.com")
        # ... scraping logic ...
```

For production scripts, this is the recommended pattern. It codifies cleanup as a structural guarantee rather than something you remember to do. If you are still [getting started with nodriver](/posts/getting-started-nodriver-python-installation-first-script/), adopting this pattern from the beginning will save you from debugging zombie processes later.

## How Other Tools Handle Browser Cleanup

Understanding how other browser automation libraries handle shutdown helps contextualize nodriver's approach.

**Playwright** uses `await browser.close()`, an async method:

```python
# Playwright pattern
from playwright.async_api import async_playwright

async def main():
    async with async_playwright() as p:
        browser = await p.chromium.launch()
        try:
            page = await browser.new_page()
            await page.goto("https://example.com")
        finally:
            await browser.close()
```

Playwright also provides a built-in context manager through `async_playwright()` that handles cleanup of the Playwright server process.

**Selenium** uses `driver.quit()`, a synchronous method similar to nodriver's `browser.stop()`:

```python
# Selenium pattern
from selenium import webdriver

driver = webdriver.Chrome()
try:
    driver.get("https://example.com")
finally:
    driver.quit()
```

Selenium also has `driver.close()` which closes the current window but not the browser, similar to nodriver's `page.close()`.

The key differences:

| Library | Shutdown method | Type | Closes process? |
|---|---|---|---|
| Nodriver | `browser.stop()` | Synchronous | Yes |
| Playwright | `await browser.close()` | Async | Yes |
| Selenium | `driver.quit()` | Synchronous | Yes |

All three ultimately do the same thing: terminate the browser process. The API differences are a matter of design philosophy. Nodriver keeps it simple with a synchronous call. Playwright makes everything async for consistency. Selenium mirrors Nodriver's synchronous approach because it predates the async era of Python.

## Best Practices Checklist

Here is a condensed list of everything covered in this post, structured as a checklist you can reference when writing nodriver scripts:

1. **Always use try/finally.** Never let `browser.stop()` depend on all preceding code succeeding. Wrap your browser usage in try/finally so cleanup is guaranteed.

2. **Call browser.stop(), not browser.close().** The correct nodriver shutdown method is `browser.stop()`. It is synchronous. Do not await it.

3. **Close individual tabs with await page.close().** When you need to close one tab but keep the browser running, use `page.close()`. This is async and must be awaited.

4. **Wrap browser.stop() in its own try/except in production.** If Chrome has already crashed, `browser.stop()` might raise. Catch that exception so your cleanup code does not become the source of unhandled errors.

5. **Use a context manager for reusable code.** The `@asynccontextmanager` pattern shown above makes cleanup structural and automatic. Use it in any script that runs more than once.

6. **Kill orphans at startup.** In long-running systems or cron jobs, run `kill_orphaned_chrome()` before launching a new browser to clear out any zombies from previous runs.

7. **Add timeouts to shutdown.** If Chrome might hang on a heavy page, wrap `browser.stop()` in a timeout and force-kill the process if it does not respond.

8. **Monitor your process table.** On servers running automated scraping, periodically check `ps aux | grep chrome` to catch resource leaks before they cause outages.

9. **One browser, one task.** Avoid sharing a single browser instance across unrelated scraping tasks. If one task crashes the browser, it takes down all tasks. Launch separate browsers and stop each one independently.

10. **Log your shutdowns.** In production, log when `browser.stop()` is called and whether it succeeds. This makes it trivial to diagnose resource leaks after the fact:

```python
import logging

logger = logging.getLogger(__name__)


async def main():
    browser = await uc.start()
    logger.info("Browser started")
    try:
        page = await browser.get("https://example.com")
        # ... scraping logic ...
    finally:
        try:
            browser.stop()
            logger.info("Browser stopped cleanly")
        except Exception as e:
            logger.error(f"Browser stop failed: {e}")
```

Getting browser cleanup right is not glamorous work, but it is the kind of detail that separates scripts that work on your laptop from scripts that run reliably on a server for months. Every Chrome instance you launch is a commitment. `browser.stop()` is how you honor it.
