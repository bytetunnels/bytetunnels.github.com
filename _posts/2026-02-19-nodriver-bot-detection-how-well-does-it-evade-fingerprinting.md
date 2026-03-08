---
title: "Nodriver Bot Detection: How Well Does It Evade Fingerprinting?"
date: 2026-02-19 12:00:00 +0000
categories: ["Browser Automation"]
tags: ["nodriver", "bot detection", "fingerprinting", "stealth", "anti-detection", "python"]
mermaid: true
author: arman
image:
  path: /assets/img/2026-02-19-nodriver-bot-detection-how-well-does-it-evade-fingerprinting-hero.jpg
  alt: "Nodriver Bot Detection: How Well Does It Evade Fingerprinting?"
---

Nodriver's entire pitch is stealth. If you are new to the tool, our [complete guide to nodriver](/posts/nodriver-complete-guide-undetected-browser-automation-python/) covers the fundamentals. It exists because its predecessor, undetected-chromedriver, could not keep up with detection systems that evolved faster than its patches. Nodriver threw out Selenium, threw out ChromeDriver, and connected directly to Chrome over the DevTools Protocol. For a walkthrough of [getting started with nodriver](/posts/getting-started-nodriver-python-installation-first-script/), including installation and your first script, see our companion post. No driver binary, no automation flags, no `navigator.webdriver`. The result is a browser session that starts clean. But "starts clean" and "evades modern fingerprinting" are two very different claims. This post tests what nodriver actually handles, where it falls short, and what you need to add to survive real-world bot detection.

## What Nodriver Avoids by Design

The stealth that nodriver provides is not based on patches or overrides. It is structural. By removing every intermediary between your Python script and Chrome, nodriver eliminates the artifacts that detection systems have relied on for years.

```mermaid
graph TD
    A["Selenium + ChromeDriver"] --> B["navigator.webdriver = true"]
    A --> C["cdc_ variables in DOM"]
    A --> D["--enable-automation flag"]
    A --> E["Automation extensions injected"]
    A --> F["ChromeDriver process visible"]

    G["Nodriver"] --> H["navigator.webdriver = undefined"]
    G --> I["No cdc_ variables"]
    G --> J["No automation flags"]
    G --> K["No extensions injected"]
    G --> L["No driver process"]

    style A fill:#ffcccc
    style B fill:#ffcccc
    style C fill:#ffcccc
    style D fill:#ffcccc
    style E fill:#ffcccc
    style F fill:#ffcccc
    style G fill:#ccffcc
    style H fill:#ccffcc
    style I fill:#ccffcc
    style J fill:#ccffcc
    style K fill:#ccffcc
    style L fill:#ccffcc
```

Here is what nodriver removes compared to a standard Selenium setup:

- **No WebDriver binary.** ChromeDriver is never downloaded or launched. Detection systems that scan for the `chromedriver` process or its characteristic port find nothing.
- **No `navigator.webdriver` flag.** Selenium sets this to `true` by default. Even patched versions often leave residual traces. Nodriver never sets it at all, so the property returns `undefined`, which is the genuine default for a user-launched Chrome session.
- **No `cdc_` variables.** ChromeDriver injects variables prefixed with `cdc_` into the `document` object for internal communication. These are one of the oldest and most reliable detection signals. Nodriver does not use ChromeDriver, so these variables do not exist.
- **No automation extensions.** ChromeDriver loads internal extensions for automation. Extension enumeration is a common detection vector. Nodriver launches Chrome without any injected extensions.
- **No `--enable-automation` flag.** This Chrome flag triggers the "Chrome is being controlled by automated test software" banner. It also modifies browser behavior in subtle ways that detection scripts probe for. Nodriver does not pass this flag.

## Testing Nodriver Against Detection Checks

Claims are easy. Code is harder to argue with. The following script launches nodriver and runs the same JavaScript checks that anti-bot systems use to identify automated browsers.

```python
import nodriver as uc
import asyncio


async def run_detection_checks():
    browser = await uc.start(headless=False)
    page = await browser.get("about:blank")

    # Give the page a moment to initialize
    await page.sleep(1)

    checks = {}

    # Check 1: navigator.webdriver
    checks["navigator.webdriver"] = await page.evaluate(
        "navigator.webdriver"
    )

    # Check 2: chrome.runtime object
    checks["window.chrome exists"] = await page.evaluate(
        "typeof window.chrome !== 'undefined'"
    )
    checks["chrome.runtime exists"] = await page.evaluate(
        "typeof window.chrome.runtime !== 'undefined'"
    )

    # Check 3: Plugins count (real Chrome has plugins)
    checks["navigator.plugins.length"] = await page.evaluate(
        "navigator.plugins.length"
    )

    # Check 4: Languages array
    checks["navigator.languages"] = await page.evaluate(
        "JSON.stringify(navigator.languages)"
    )

    # Check 5: Permissions API
    checks["permissions.query works"] = await page.evaluate("""
        (async () => {
            try {
                const result = await navigator.permissions.query(
                    { name: 'notifications' }
                );
                return result.state;
            } catch (e) {
                return 'error: ' + e.message;
            }
        })()
    """)

    # Check 6: WebGL renderer
    checks["webgl.renderer"] = await page.evaluate("""
        (() => {
            const canvas = document.createElement('canvas');
            const gl = canvas.getContext('webgl');
            if (!gl) return 'no webgl';
            const debugInfo = gl.getExtension('WEBGL_debug_renderer_info');
            if (!debugInfo) return 'no debug info';
            return gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL);
        })()
    """)

    # Check 7: cdc_ variables
    checks["cdc_ variables found"] = await page.evaluate("""
        (() => {
            for (const key of Object.keys(document)) {
                if (key.startsWith('cdc_') || key.startsWith('$cdc_')) {
                    return true;
                }
            }
            return false;
        })()
    """)

    # Check 8: Headless indicators
    checks["user_agent_contains_headless"] = await page.evaluate(
        "'HeadlessChrome' in navigator.userAgent"
    )

    # Print results
    for check, result in checks.items():
        status = "PASS" if result not in [True, "true", 0] else "FLAG"
        if check == "navigator.webdriver" and result is None:
            status = "PASS"
        elif check == "navigator.plugins.length" and result > 0:
            status = "PASS"
        elif check == "window.chrome exists" and result is True:
            status = "PASS"
        elif check == "chrome.runtime exists" and result is True:
            status = "PASS"
        elif check == "permissions.query works":
            status = "PASS" if "error" not in str(result) else "FLAG"
        elif check == "cdc_ variables found" and result is False:
            status = "PASS"
        elif check == "user_agent_contains_headless" and result is False:
            status = "PASS"
        print(f"[{status}] {check}: {result}")

    browser.stop()


asyncio.run(run_detection_checks())
```

When you run this headed (with `headless=False`), a typical output looks like this:

```
[PASS] navigator.webdriver: None
[PASS] window.chrome exists: True
[PASS] chrome.runtime exists: True
[PASS] navigator.plugins.length: 5
[PASS] navigator.languages: ["en-US","en"]
[PASS] permissions.query works: prompt
[PASS] webgl.renderer: ANGLE (Intel, Intel(R) UHD Graphics 630, OpenGL 4.1)
[PASS] cdc_ variables found: False
[PASS] user_agent_contains_headless: False
```

Every basic automation check passes. The browser looks like a regular Chrome instance because, at this level, it is one.

## What Nodriver Handles Well

Nodriver's strengths map directly to the checks it was designed to bypass: the automation artifact layer that traditional tools fail.

### Automation Flag Detection

Every detection system starts with the cheapest checks first. Does `navigator.webdriver` return `true`? Is the `--enable-automation` flag present? Are there `cdc_` variables in the DOM? Nodriver passes all of these because it never introduces these artifacts in the first place.

### Headed Mode Stealth

When running in headed mode, nodriver produces a browser session that is indistinguishable from a user-launched Chrome at the JavaScript API level. The `window.chrome` object is fully populated, plugins are present, the permissions API works correctly, and there are no headless-mode indicators.

### Plugin and Extension Fingerprints

A common detection technique is checking `navigator.plugins.length`. Automated browsers often report zero plugins because they run in stripped-down configurations. Nodriver uses your system's actual Chrome installation, so plugins reflect whatever Chrome normally exposes.

```python
import nodriver as uc
import asyncio


async def check_plugins():
    browser = await uc.start()
    page = await browser.get("about:blank")

    plugin_info = await page.evaluate("""
        (() => {
            const plugins = [];
            for (let i = 0; i < navigator.plugins.length; i++) {
                plugins.push({
                    name: navigator.plugins[i].name,
                    filename: navigator.plugins[i].filename,
                    description: navigator.plugins[i].description
                });
            }
            return JSON.stringify(plugins, null, 2);
        })()
    """)

    print("Installed plugins:")
    print(plugin_info)

    browser.stop()


asyncio.run(check_plugins())
```

This returns real Chrome plugins like "PDF Viewer" and "Chrome PDF Viewer" rather than an empty list.

## What Nodriver Does Not Handle

Here is where the picture changes. Modern detection goes far beyond checking `navigator.webdriver`. The advanced fingerprinting layers are where nodriver's "clean Chrome" approach runs out of answers.

```mermaid
graph TD
    A["Detection Layer"] --> B["Automation Flags<br>(nodriver passes)"]
    A --> C["Canvas Fingerprinting<br>(nodriver exposed)"]
    A --> D["WebGL Fingerprinting<br>(nodriver exposed)"]
    A --> E["TLS Fingerprinting<br>(nodriver passes*)"]
    A --> F["Font Enumeration<br>(nodriver exposed)"]
    A --> G["Behavioral Analysis<br>(nodriver neutral)"]

    B --> H["Result: Clean"]
    C --> I["Result: Unique to machine"]
    D --> J["Result: Unique to GPU"]
    E --> K["Result: Real Chrome TLS<br>*unless behind proxy"]
    F --> L["Result: System fonts exposed"]
    G --> M["Result: Depends on<br>your code"]

    style B fill:#ccffcc
    style H fill:#ccffcc
    style C fill:#ffffcc
    style D fill:#ffffcc
    style E fill:#ffffcc
    style F fill:#ffffcc
    style G fill:#ffffcc
    style I fill:#ffffcc
    style J fill:#ffffcc
    style K fill:#ffffcc
    style L fill:#ffffcc
    style M fill:#ffffcc
```

### Canvas Fingerprinting

Detection systems render invisible canvas elements and hash the pixel output. Every machine produces a slightly different hash based on its GPU, driver version, and rendering pipeline. If the same hash appears across thousands of requests, the system knows it is seeing the same machine. Nodriver cannot modify canvas output because it does not alter Chrome's rendering engine. Your canvas fingerprint is your machine's fingerprint, and it stays constant across every session.

```python
import nodriver as uc
import asyncio


async def check_canvas_fingerprint():
    browser = await uc.start()
    page = await browser.get("about:blank")

    fingerprint = await page.evaluate("""
        (() => {
            const canvas = document.createElement('canvas');
            canvas.width = 200;
            canvas.height = 50;
            const ctx = canvas.getContext('2d');

            // Draw text with specific styling
            ctx.textBaseline = 'top';
            ctx.font = '14px Arial';
            ctx.fillStyle = '#f60';
            ctx.fillRect(125, 1, 62, 20);
            ctx.fillStyle = '#069';
            ctx.fillText('fingerprint test', 2, 15);
            ctx.fillStyle = 'rgba(102, 204, 0, 0.7)';
            ctx.fillText('fingerprint test', 4, 17);

            return canvas.toDataURL();
        })()
    """)

    # In a real detector, this data URL gets hashed
    # The same hash across sessions = same machine
    print(f"Canvas fingerprint length: {len(fingerprint)}")
    print(f"First 80 chars: {fingerprint[:80]}...")

    browser.stop()


asyncio.run(check_canvas_fingerprint())
```

Every time you run this on the same machine, the output is identical. A detection system correlating fingerprints across sessions will recognize the pattern.

### WebGL Fingerprinting

Similar to canvas, WebGL fingerprinting extracts GPU renderer strings and rendering characteristics. Nodriver does not intercept or modify WebGL calls, so the real hardware identity is exposed.

### Advanced TLS Analysis

Nodriver uses Chrome's real TLS stack, which is actually an advantage --- the JA3/JA4 fingerprint matches genuine Chrome. For cases where the TLS fingerprint becomes the bottleneck, [httpmorph solves TLS fingerprinting with a C-native Python HTTP client](/posts/httpmorph-solving-tls-fingerprinting-with-a-c-native-python-http-client/). But this only holds if you are connecting directly. If you route traffic through a proxy that terminates and re-establishes TLS, the fingerprint changes to match the proxy's TLS implementation, which can trigger detection.

### Font Enumeration

Detection scripts probe for installed fonts by rendering text in various font families and measuring the dimensions. The set of available fonts is unique to each system. Nodriver cannot alter font availability because it runs unmodified Chrome with whatever fonts your OS provides.

## Testing Against Anti-Bot Services

When you aim nodriver at sites protected by commercial anti-bot services, the results split into two clear tiers.

**Tier 1 --- Nodriver passes cleanly:**
- Basic `navigator.webdriver` checks
- Simple JavaScript property probing
- ChromeDriver artifact scanning
- Headless-mode detection (when running headed)
- User-agent validation

**Tier 2 --- Nodriver gets flagged:**
- Canvas + WebGL fingerprint correlation across sessions
- Behavioral analysis (scripted click patterns, no mouse movement)
- Advanced environment consistency checks (screen resolution vs viewport vs GPU capabilities)
- Repeated identical fingerprints from different IPs

The pattern is clear. Nodriver defeats the automation layer of detection with near-perfect results. But the fingerprinting layer and the behavioral layer require additional work.


<figure>
  <img src="/assets/img/inline-nodriver-bot-detection-how-well-does-it--2.jpg" alt="The less a browser looks automated, the better it performs against detection." loading="lazy">
  <figcaption>The less a browser looks automated, the better it performs against detection. <span class="img-credit">Photo by Rafael Rendon / <a href="https://www.pexels.com" target="_blank" rel="noopener noreferrer">Pexels</a></span></figcaption>
</figure>

## Improving Nodriver's Stealth

While nodriver cannot modify Chrome's engine, you can configure it to reduce your detection surface.

### Custom Browser Arguments

Passing specific Chrome flags helps eliminate edge cases that detection scripts look for.

```python
import nodriver as uc
import asyncio


async def stealth_session():
    browser = await uc.start(
        headless=False,
        browser_args=[
            "--disable-blink-features=AutomationControlled",
            "--disable-dev-shm-usage",
            "--no-first-run",
            "--no-default-browser-check",
            "--disable-infobars",
            "--window-size=1920,1080",
        ],
    )

    page = await browser.get("https://example.com")
    await page.sleep(2)

    title_el = await page.select("h1")
    if title_el:
        print(title_el.text_all)

    browser.stop()


asyncio.run(stealth_session())
```

### Realistic Viewport and Screen Dimensions

A common detection signal is a mismatch between the reported screen size and the browser viewport. If `screen.width` says 1920 but the viewport is 800 pixels wide, it looks like a programmatically resized window.

```python
import nodriver as uc
import asyncio


async def realistic_viewport():
    browser = await uc.start(
        headless=False,
        browser_args=[
            "--window-size=1920,1080",
            "--window-position=0,0",
        ],
    )

    page = await browser.get("about:blank")

    # Verify screen vs viewport consistency
    screen_info = await page.evaluate("""
        JSON.stringify({
            screenWidth: screen.width,
            screenHeight: screen.height,
            innerWidth: window.innerWidth,
            innerHeight: window.innerHeight,
            outerWidth: window.outerWidth,
            outerHeight: window.outerHeight,
            devicePixelRatio: window.devicePixelRatio
        }, null, 2)
    """)

    print("Screen and viewport info:")
    print(screen_info)

    browser.stop()


asyncio.run(realistic_viewport())
```

### User Data Directory

By default, nodriver creates a temporary profile for each session. Detection systems can flag fresh profiles with no history, no cookies, and no stored data as suspicious. Using a persistent user data directory makes the browser look like it belongs to a returning user.

```python
import nodriver as uc
import asyncio


async def persistent_profile():
    browser = await uc.start(
        user_data_dir="/tmp/nodriver_profile",
        headless=False,
        browser_args=[
            "--no-first-run",
        ],
    )

    page = await browser.get("https://example.com")

    # On subsequent runs, this profile will have history,
    # cookies, and cached data --- just like a real user
    cookies = await page.evaluate("document.cookie")
    print(f"Cookies: {cookies}")

    browser.stop()


asyncio.run(persistent_profile())
```

On subsequent runs using the same profile directory, the browser carries forward cookies, localStorage data, and browsing history, which makes it harder for detection systems to flag the session as a blank, freshly-spawned automation instance.

## Combining Nodriver With Additional Stealth

Nodriver provides a clean foundation, but defeating advanced detection requires adding layers on top.

### Proxy Rotation

If the same canvas fingerprint appears from the same IP address hundreds of times, it gets flagged regardless of how clean the browser session looks. Rotating proxies spread requests across different IP addresses.

```python
import nodriver as uc
import asyncio


async def with_proxy(proxy_url: str, target_url: str):
    browser = await uc.start(
        headless=False,
        browser_args=[
            f"--proxy-server={proxy_url}",
            "--window-size=1920,1080",
        ],
    )

    page = await browser.get(target_url)
    await page.sleep(3)

    # Verify the IP changed
    page2 = await browser.get("https://httpbin.org/ip")
    await page2.sleep(2)
    ip_text = await page2.select("pre")
    if ip_text:
        print(f"Current IP: {ip_text.text_all}")

    browser.stop()


asyncio.run(with_proxy("http://user:pass@proxy.example.com:8080", "https://example.com"))
```

### Realistic Timing and Interaction

The fastest way to get flagged is to behave like a script. Instant page loads, zero mouse movement, and perfectly timed clicks are obvious signals. Adding human-like delays and interactions helps.

```python
import nodriver as uc
import asyncio
import random


async def human_like_browsing():
    browser = await uc.start(headless=False)
    page = await browser.get("https://example.com")

    # Random delay before interacting (1-3 seconds)
    await page.sleep(random.uniform(1.0, 3.0))

    # Scroll down gradually
    for _ in range(3):
        await page.evaluate(
            "window.scrollBy(0, Math.floor(Math.random() * 300 + 100))"
        )
        await page.sleep(random.uniform(0.5, 1.5))

    # Find and click a link with human-like delay
    link = await page.select("a")
    if link:
        await page.sleep(random.uniform(0.3, 0.8))
        await link.click()
        await page.sleep(random.uniform(1.0, 2.5))

    browser.stop()


asyncio.run(human_like_browsing())
```

### Combining Everything

A production-grade nodriver setup layers all of these techniques together.

```python
import nodriver as uc
import asyncio
import random


async def production_scraper(urls: list, proxy: str = None):
    browser_args = [
        "--disable-blink-features=AutomationControlled",
        "--no-first-run",
        "--no-default-browser-check",
        "--disable-infobars",
        "--window-size=1920,1080",
    ]

    if proxy:
        browser_args.append(f"--proxy-server={proxy}")

    browser = await uc.start(
        user_data_dir="/tmp/nodriver_persistent",
        headless=False,
        browser_args=browser_args,
    )

    for url in urls:
        page = await browser.get(url)

        # Wait for page to fully render
        await page.sleep(random.uniform(2.0, 4.0))

        # Simulate reading the page
        for _ in range(random.randint(2, 5)):
            scroll_amount = random.randint(150, 400)
            await page.evaluate(f"window.scrollBy(0, {scroll_amount})")
            await page.sleep(random.uniform(0.8, 2.0))

        # Extract what you need
        title_el = await page.select("h1")
        if title_el:
            title = title_el.text_all
            print(f"Scraped: {title}")

        # Pause between pages like a real user
        await page.sleep(random.uniform(3.0, 7.0))

    browser.stop()


urls = [
    "https://example.com",
    "https://example.org",
]
asyncio.run(production_scraper(urls))
```

## Limitations Worth Knowing

Nodriver has constraints that no amount of configuration can fix.

**Python only.** There is no JavaScript or TypeScript version. If your stack is Node.js, nodriver is not an option.

**Chrome only.** Nodriver works with Chrome and Chromium. It cannot drive Firefox, Safari, or WebKit. If a target site fingerprints by browser engine and you need to appear as a Firefox user, you need a different tool.

**No engine-level fingerprint modification.** Canvas hashes, WebGL renderer strings, font lists, and AudioContext fingerprints all come from Chrome's rendering engine. Nodriver cannot alter these. Every session from the same machine produces the same fingerprints.

**Async only.** The entire API is built on `asyncio`. There is no synchronous wrapper. If your existing codebase is synchronous, you need to refactor or use `asyncio.run()` as an entry point.

**No built-in behavioral automation.** Nodriver does not automatically generate human-like mouse movements, scroll patterns, or typing dynamics. You have to implement these yourself, as shown in the examples above.

```mermaid
graph TD
    A["Nodriver Stealth Coverage"] --> B["Automation Artifacts<br>COVERED"]
    A --> C["Headless Detection<br>COVERED (headed mode)"]
    A --> D["Canvas Fingerprint<br>NOT COVERED"]
    A --> E["WebGL Fingerprint<br>NOT COVERED"]
    A --> F["TLS Fingerprint<br>COVERED (direct connect)"]
    A --> G["Font Fingerprint<br>NOT COVERED"]
    A --> H["Behavioral Analysis<br>NOT COVERED (manual)"]

    style B fill:#ccffcc
    style C fill:#ccffcc
    style F fill:#ccffcc
    style D fill:#ffcccc
    style E fill:#ffcccc
    style G fill:#ffcccc
    style H fill:#ffffcc
```

## When Nodriver Is Enough vs When to Escalate

Nodriver is the right tool when the target site uses standard bot detection that checks for automation artifacts. This covers a significant portion of the web. Sites using basic Cloudflare rules, simple JavaScript challenges, or in-house detection that looks for `navigator.webdriver` and ChromeDriver traces will not catch a properly configured nodriver session.

You need to escalate when detection goes deeper. If a site uses canvas fingerprint correlation, WebGL probing, advanced font enumeration, or behavioral analysis that scores mouse movement patterns, nodriver alone will not be enough.

The next step up is [Camoufox](https://camoufox.com/), as explored in our [Playwright vs Camoufox stealth head-to-head](/posts/playwright-vs-camoufox-stealth-automation-head-to-head/). Where nodriver avoids detection by removing automation artifacts, Camoufox defeats detection by modifying Firefox's rendering engine at the C++ level. Canvas fingerprints are spoofed from within the engine. WebGL renderer strings are rewritten before JavaScript can read them. Font enumeration returns a controlled set of fonts regardless of what is installed on the machine. The browser produces consistent, realistic fingerprints that cannot be detected as spoofed because there are no JavaScript overrides to discover.

The decision tree is straightforward:

```mermaid
graph TD
    A["Does the site block<br>Selenium/Playwright?"] -->|Yes| B["Try nodriver first"]
    A -->|No| C["Use Selenium or Playwright<br>with stealth plugins"]

    B --> D["Does nodriver<br>get blocked?"]
    D -->|No| E["Nodriver is sufficient"]
    D -->|Yes| F["Is the site using canvas,<br>WebGL, or behavioral<br>fingerprinting?"]

    F -->|Yes| G["Escalate to Camoufox"]
    F -->|No| H["Add proxies, realistic<br>timing, persistent profiles"]

    H --> I["Still blocked?"]
    I -->|Yes| G
    I -->|No| E

    style E fill:#ccffcc
    style G fill:#cce5ff
    style C fill:#ffffcc
```

Nodriver occupies a practical middle ground. It is dramatically stealthier than Selenium or unpatched Playwright, easy to set up, and requires no custom browser builds. For the full landscape of anti-detection tools, see [stealth browsers in 2026: Camoufox, nodriver, and the anti-detection arms race](/posts/stealth-browsers-in-2026-camoufox-nodriver-and-the-anti-detection-arms-race/) and our [timeline of how detection methods have evolved](/posts/evolution-web-scraping-detection-methods-timeline/). For many scraping tasks, that middle ground is exactly where you need to be. When it is not enough, the escalation path to Camoufox is clear, and the decision to escalate is usually obvious --- if nodriver gets blocked after you have added proxies and realistic behavior, the site is doing engine-level fingerprinting that only an engine-level solution can address.
