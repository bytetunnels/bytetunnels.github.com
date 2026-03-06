---
title: "Changing User Agents in Playwright: Why and How"
date: 2026-02-14 10:00:00 +0000
categories: ["Browser Automation"]
tags: ["playwright", "user agent", "python", "web scraping", "headers", "browser automation"]
author: arman
image:
  path: /assets/img/2026-02-14-changing-user-agents-playwright-why-and-how-hero.png
  alt: "Changing User Agents in Playwright: Why and How"
---

Every HTTP request your browser sends includes a `User-Agent` header --- a string that tells the server what browser, operating system, and rendering engine you are using. When you run Playwright out of the box, it sends a user-agent string that belongs to its bundled Chromium or Firefox build, not a standard release version that real users run. Anti-bot systems and analytics platforms know exactly what those default strings look like, and many will block or challenge requests that carry them. The [evolution of web scraping detection methods](/posts/evolution-web-scraping-detection-methods-timeline/) explains how these checks have grown more sophisticated over time. Changing the user agent is one of the simplest and most effective steps you can take to make your Playwright sessions look like ordinary browser traffic.

## Why Playwright's Default User Agent Is a Problem

Playwright ships with a specific version of Chromium (or Firefox, or WebKit) that is compiled from the upstream source with some patches applied. The version number in the default user-agent string often lags behind the latest stable Chrome release by a few builds. That alone is enough to raise a flag.

Here is what a default Playwright Chromium user agent might look like:

```
Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/124.0.6367.29 Safari/537.36
```

Several things stand out:

- The string contains `HeadlessChrome` when running in headless mode, which is an immediate giveaway.
- The version `124.0.6367.29` may not match any public Chrome stable release.
- The OS platform (`X11; Linux x86_64`) may not match what a typical visitor to the target site would use.

Even in headed mode, where `HeadlessChrome` is not present, the version mismatch is enough for sophisticated detection systems to flag the session. Sites that track browser distributions know that the vast majority of their visitors run the latest stable Chrome, and a version string that does not match any known release is suspicious.

## Setting the User Agent at Context Level

The most common and recommended way to change the user agent in Playwright is at the browser context level. Every page opened within that context will use the specified user agent for all requests.

```python
from playwright.sync_api import sync_playwright

with sync_playwright() as p:
    browser = p.chromium.launch(headless=False)

    context = browser.new_context(
        user_agent=(
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
            "AppleWebKit/537.36 (KHTML, like Gecko) "
            "Chrome/131.0.0.0 Safari/537.36"
        )
    )

    page = context.new_page()
    page.goto("https://httpbin.org/user-agent")
    print(page.inner_text("body"))

    browser.close()
```

The output will confirm that your custom user agent is being sent:

```json
{
  "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36"
}
```

The `user_agent` parameter on `browser.new_context()` sets the header for every HTTP request made by any page in that context. It also updates `navigator.userAgent` in JavaScript, so detection scripts that read the user agent from the DOM will see the same value as the HTTP header.

## Setting the User Agent Per Page

In rare cases you might want different pages within the same context to use different user agents. Playwright does not provide a direct `page.set_user_agent()` method, but you can achieve this by setting extra HTTP headers on a specific page.

```python
from playwright.sync_api import sync_playwright

with sync_playwright() as p:
    browser = p.chromium.launch(headless=False)
    context = browser.new_context()

    page = context.new_page()
    page.set_extra_http_headers({
        "User-Agent": (
            "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
            "AppleWebKit/537.36 (KHTML, like Gecko) "
            "Chrome/131.0.0.0 Safari/537.36"
        )
    })

    page.goto("https://httpbin.org/user-agent")
    print(page.inner_text("body"))

    browser.close()
```

There is an important caveat with this approach: `set_extra_http_headers` changes the HTTP header, but it does not update `navigator.userAgent` in JavaScript. If a detection script compares the HTTP header to the JavaScript value, the mismatch will flag you. For most scraping tasks, setting the user agent at the context level is the better choice.

## Using Playwright's Built-in Device Emulation

Playwright includes a `devices` dictionary with pre-configured settings for dozens of real devices. Each entry includes a user agent, viewport dimensions, device scale factor, and whether the device is mobile. This is the easiest way to get a consistent, realistic configuration.

```python
from playwright.sync_api import sync_playwright

with sync_playwright() as p:
    iphone = p.devices["iPhone 13"]
    browser = p.chromium.launch(headless=False)

    context = browser.new_context(**iphone)
    page = context.new_page()

    page.goto("https://httpbin.org/user-agent")
    print(page.inner_text("body"))

    # Check viewport matches the device
    viewport = page.evaluate("JSON.stringify({w: window.innerWidth, h: window.innerHeight})")
    print(f"Viewport: {viewport}")

    browser.close()
```

The `devices` dictionary includes entries like `"iPhone 13"`, `"Pixel 5"`, `"iPad Pro 11"`, `"Desktop Chrome"`, `"Desktop Firefox"`, and many more. You can print all available device names with:

```python
from playwright.sync_api import sync_playwright

with sync_playwright() as p:
    for name in sorted(p.devices.keys()):
        print(name)
```

Device emulation is particularly useful for testing mobile versions of websites or scraping sites that serve different content to mobile users. The user agent, viewport, and touch capabilities all align, which makes the session internally consistent.

## Building a Realistic User Agent String

If you are not using device emulation, you need to construct a user-agent string that matches what real browsers actually send. Here is a breakdown of the Chrome user-agent format:

```
Mozilla/5.0 (<platform>) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/<version> Safari/537.36
```

The `<platform>` portion varies by operating system:

| OS | Platform String |
|---|---|
| Windows 10/11 | `Windows NT 10.0; Win64; x64` |
| macOS | `Macintosh; Intel Mac OS X 10_15_7` |
| Linux | `X11; Linux x86_64` |

The `<version>` should be a real Chrome stable release version. You can find the latest version at [chromestatus.com](https://chromestatus.com) or by checking the user agent on a real Chrome installation. As of early 2026, current Chrome stable versions are in the 131-133 range.

For Firefox, the format is different:

```
Mozilla/5.0 (<platform>; rv:<version>) Gecko/20100101 Firefox/<version>
```

A realistic Firefox user agent:

```
Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:134.0) Gecko/20100101 Firefox/134.0
```

The key rule is to use a version number that corresponds to an actual release. Invented version numbers are easy for detection systems to spot because they maintain lists of every real browser version ever released.

## Rotating User Agents Across Sessions

Sending the same user agent on every request is fine for small-scale scraping, but if you are making thousands of requests to the same site, rotating user agents across sessions helps distribute your fingerprint.

```python
import random
from playwright.sync_api import sync_playwright

USER_AGENTS = [
    # Chrome on Windows
    (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/131.0.0.0 Safari/537.36"
    ),
    # Chrome on macOS
    (
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/131.0.0.0 Safari/537.36"
    ),
    # Chrome on Linux
    (
        "Mozilla/5.0 (X11; Linux x86_64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/131.0.0.0 Safari/537.36"
    ),
    # Firefox on Windows
    (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:134.0) "
        "Gecko/20100101 Firefox/134.0"
    ),
    # Firefox on macOS
    (
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:134.0) "
        "Gecko/20100101 Firefox/134.0"
    ),
]


def scrape_with_random_ua(url: str) -> str:
    ua = random.choice(USER_AGENTS)
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=False)
        context = browser.new_context(user_agent=ua)
        page = context.new_page()
        page.goto(url)
        content = page.content()
        browser.close()
    return content
```

Each call to `scrape_with_random_ua` creates a fresh context with a different user agent. For even better distribution, combine user-agent rotation with proxy rotation so that each unique user agent comes from a different IP address.

One important detail: create a new browser context for each user agent rather than changing the user agent mid-session. The user agent is set when the context is created and applies to all subsequent requests. If you need a different user agent, create a new context.


<figure>
  <img src="/assets/img/inline-changing-user-agents-playwright-why-and--1.jpg" alt="Browser automation turns repetitive tasks into reliable scripts." loading="lazy">
  <figcaption>Browser automation turns repetitive tasks into reliable scripts. <span class="img-credit">Photo by ThisIsEngineering / <a href="https://www.pexels.com" target="_blank" rel="noopener noreferrer">Pexels</a></span></figcaption>
</figure>

## Common Mistakes to Avoid

The most frequent mistake is using a user agent that does not match the actual browser engine. If you are running Playwright with Chromium, do not use a Firefox user agent. Detection systems check for consistency between the user-agent header and dozens of JavaScript properties that are specific to each browser engine. Tools like [selenium-stealth](/posts/selenium-stealth-making-selenium-less-detectable/) attempt to patch these properties, but mismatching the user agent with the wrong engine undermines the effort entirely.

For example, `navigator.plugins` has different contents in Chrome and Firefox. The `window.chrome` object exists in Chrome but not in Firefox. The `CSS.supports()` method returns different results for engine-specific CSS properties. If your user agent claims Firefox but these JavaScript checks return Chrome-specific values, the session is immediately flagged.

```python
# Bad: Chromium browser with Firefox user agent
context = browser.new_context(
    user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:134.0) Gecko/20100101 Firefox/134.0"
)
# Detection script will find window.chrome exists, navigator.plugins has Chrome entries,
# and CSS engine is Blink --- none of which match Firefox.

# Good: Chromium browser with Chrome user agent
context = browser.new_context(
    user_agent=(
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/131.0.0.0 Safari/537.36"
    )
)
```

Other common mistakes:

- **Using outdated versions.** A user agent from Chrome 90 in 2026 is suspicious. Keep your version strings current.
- **Mismatching OS and viewport.** A macOS user agent with a 1366x768 viewport is plausible but a mobile user agent with a 1920x1080 viewport is not.
- **Forgetting headless mode.** In headless mode, some Playwright builds still expose `HeadlessChrome` in the default user agent. Always set a custom one.

## Beyond User Agent: Other Headers That Matter

The user agent is the most visible header, but it is not the only one detection systems inspect. Several other headers contribute to your browser fingerprint and should be consistent with your user agent.

### Accept-Language

This header tells the server what languages you prefer. A user agent claiming to be on a US English Windows system should send:

```python
context = browser.new_context(
    user_agent=(
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/131.0.0.0 Safari/537.36"
    ),
    locale="en-US"
)
```

Playwright's `locale` parameter on `new_context` sets both the `Accept-Language` header and the JavaScript `navigator.language` property, keeping them in sync.

### Sec-CH-UA (Client Hints)

Modern Chrome sends Client Hints headers that provide structured information about the browser. These headers must match your user agent, or detection systems will notice the inconsistency.

```
Sec-CH-UA: "Google Chrome";v="131", "Chromium";v="131", "Not_A Brand";v="24"
Sec-CH-UA-Mobile: ?0
Sec-CH-UA-Platform: "Windows"
```

Playwright's Chromium automatically sends these headers based on the browser version, but if you override the user agent, the Client Hints may not update to match. You can set them explicitly using extra headers:

```python
context = browser.new_context(
    user_agent=(
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/131.0.0.0 Safari/537.36"
    ),
    extra_http_headers={
        "Sec-CH-UA": '"Google Chrome";v="131", "Chromium";v="131", "Not_A Brand";v="24"',
        "Sec-CH-UA-Mobile": "?0",
        "Sec-CH-UA-Platform": '"Windows"',
    }
)
```

### Accept

The `Accept` header varies between browsers and request types. Chrome sends a specific `Accept` value for document requests that differs from what Firefox sends. Playwright handles this automatically in most cases, but if you are using `set_extra_http_headers`, be careful not to overwrite it with an incorrect value.

## Verifying Your User Agent

Always verify that your user agent is being sent correctly before starting a large scraping job. The simplest way is to navigate to a service that echoes your request headers back to you.

```python
from playwright.sync_api import sync_playwright

CUSTOM_UA = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
    "AppleWebKit/537.36 (KHTML, like Gecko) "
    "Chrome/131.0.0.0 Safari/537.36"
)

with sync_playwright() as p:
    browser = p.chromium.launch(headless=False)
    context = browser.new_context(user_agent=CUSTOM_UA)
    page = context.new_page()

    # Check the HTTP header
    page.goto("https://httpbin.org/user-agent")
    http_ua = page.inner_text("body")
    print(f"HTTP User-Agent: {http_ua}")

    # Check the JavaScript value
    js_ua = page.evaluate("navigator.userAgent")
    print(f"JS navigator.userAgent: {js_ua}")

    # They should match
    assert CUSTOM_UA in http_ua
    assert js_ua == CUSTOM_UA

    browser.close()
```

If both the HTTP header and `navigator.userAgent` return your custom string, you are set. If they differ --- especially if you used `set_extra_http_headers` instead of the context-level `user_agent` parameter --- you have a consistency problem that detection scripts will catch.

## Complete Example: Scraping with Rotated, Realistic User Agents

Here is a complete, practical example that combines everything covered in this post: a pool of realistic user agents matched to the Chromium engine, rotation across sessions, consistent Client Hints, and verification.

```python
import random
from playwright.sync_api import sync_playwright


# Pool of realistic Chrome user agents with matching Client Hints
UA_PROFILES = [
    {
        "user_agent": (
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
            "AppleWebKit/537.36 (KHTML, like Gecko) "
            "Chrome/131.0.0.0 Safari/537.36"
        ),
        "sec_ch_ua": '"Google Chrome";v="131", "Chromium";v="131", "Not_A Brand";v="24"',
        "sec_ch_ua_platform": '"Windows"',
        "viewport": {"width": 1920, "height": 1080},
        "locale": "en-US",
    },
    {
        "user_agent": (
            "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
            "AppleWebKit/537.36 (KHTML, like Gecko) "
            "Chrome/131.0.0.0 Safari/537.36"
        ),
        "sec_ch_ua": '"Google Chrome";v="131", "Chromium";v="131", "Not_A Brand";v="24"',
        "sec_ch_ua_platform": '"macOS"',
        "viewport": {"width": 1440, "height": 900},
        "locale": "en-US",
    },
    {
        "user_agent": (
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
            "AppleWebKit/537.36 (KHTML, like Gecko) "
            "Chrome/133.0.0.0 Safari/537.36"
        ),
        "sec_ch_ua": '"Google Chrome";v="133", "Chromium";v="133", "Not_A Brand";v="24"',
        "sec_ch_ua_platform": '"Windows"',
        "viewport": {"width": 1366, "height": 768},
        "locale": "en-GB",
    },
    {
        "user_agent": (
            "Mozilla/5.0 (X11; Linux x86_64) "
            "AppleWebKit/537.36 (KHTML, like Gecko) "
            "Chrome/131.0.0.0 Safari/537.36"
        ),
        "sec_ch_ua": '"Google Chrome";v="131", "Chromium";v="131", "Not_A Brand";v="24"',
        "sec_ch_ua_platform": '"Linux"',
        "viewport": {"width": 1920, "height": 1080},
        "locale": "en-US",
    },
]


def scrape_page(url: str) -> dict:
    """Scrape a single page with a randomly selected realistic UA profile."""
    profile = random.choice(UA_PROFILES)

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=False)

        context = browser.new_context(
            user_agent=profile["user_agent"],
            viewport=profile["viewport"],
            locale=profile["locale"],
            extra_http_headers={
                "Sec-CH-UA": profile["sec_ch_ua"],
                "Sec-CH-UA-Mobile": "?0",
                "Sec-CH-UA-Platform": profile["sec_ch_ua_platform"],
            },
        )

        page = context.new_page()
        page.goto(url, wait_until="domcontentloaded")

        result = {
            "url": url,
            "title": page.title(),
            "user_agent": profile["user_agent"],
            "content_length": len(page.content()),
        }

        browser.close()

    return result


def scrape_multiple(urls: list[str]) -> list[dict]:
    """Scrape multiple URLs, each with a fresh context and random UA."""
    results = []
    for url in urls:
        result = scrape_page(url)
        results.append(result)
        print(f"Scraped: {result['title']} ({result['content_length']} chars) "
              f"with UA: ...{result['user_agent'][-30:]}")
    return results


if __name__ == "__main__":
    urls = [
        "https://httpbin.org/user-agent",
        "https://httpbin.org/headers",
        "https://example.com",
    ]
    results = scrape_multiple(urls)
    for r in results:
        print(f"\n{r['url']}")
        print(f"  Title: {r['title']}")
        print(f"  UA: {r['user_agent']}")
```

Each URL gets a fresh browser context with a randomly selected profile. The user agent, Client Hints, viewport, and locale are all internally consistent. Because each context is independent, cookies and session state do not leak between requests.

## Key Takeaways

Changing the user agent in Playwright is straightforward, but doing it correctly requires attention to consistency. Set the user agent at the context level using `browser.new_context(user_agent=...)` so that both HTTP headers and JavaScript properties stay in sync. Match your user agent to the actual browser engine you are running --- Chrome user agents for Chromium, Firefox user agents for Firefox. Keep version numbers current with real stable releases. When you need device emulation, use `p.devices["..."]` to get a fully consistent profile with a single line of code. And do not forget the supporting headers like `Sec-CH-UA` and `Accept-Language` that detection systems cross-reference against your user-agent string. At a lower level, [TLS fingerprinting](/posts/httpmorph-solving-tls-fingerprinting-with-a-c-native-python-http-client/) can also expose your client regardless of which headers you set.

The user agent is just one piece of the browser fingerprint puzzle, but it is the piece that is easiest to get right and hardest to recover from if you get it wrong. If you need stealth that goes beyond header manipulation, [dedicated stealth browsers](/posts/stealth-browsers-in-2026-camoufox-nodriver-and-the-anti-detection-arms-race/) handle fingerprint consistency at the engine level.
