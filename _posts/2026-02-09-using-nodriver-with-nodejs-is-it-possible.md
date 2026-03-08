---
title: "Using Nodriver with Node.js: Is It Possible?"
date: 2026-02-09 10:00:00 +0000
categories: ["Browser Automation"]
tags: ["nodriver", "nodejs", "javascript", "python", "browser automation", "alternatives"]
author: arman
image:
  path: /assets/img/2026-02-09-using-nodriver-with-nodejs-is-it-possible-hero.jpg
  alt: "Using Nodriver with Node.js: Is It Possible?"
---

The short answer is no. Nodriver is a Python-only library with no official Node.js port, no npm package, and no JavaScript API. If you have been searching for a way to `npm install nodriver` or `require('nodriver')`, that path does not exist. But the goal that nodriver achieves --- undetected browser automation through direct Chrome DevTools Protocol access --- is absolutely achievable in Node.js. You just need different tools. This post explains why nodriver is locked to Python, what the closest Node.js equivalents are, and how to pick the right one for your project.

## Why Nodriver Is Python-Only

Nodriver is built from the ground up on Python's `asyncio` event loop. For a thorough walkthrough of what the library offers, see the [complete guide to nodriver for undetected browser automation](/posts/nodriver-complete-guide-undetected-browser-automation-python/). Every internal component --- the CDP WebSocket connection, browser process management, tab lifecycle handling, DOM interaction --- uses `async`/`await` patterns tied to Python's native coroutine system. This is not a thin wrapper that could be swapped out. The entire architecture assumes Python's concurrency model.

Here is what makes porting impractical:

- **asyncio dependency** --- Nodriver uses `asyncio.create_subprocess_exec` to launch Chrome, `asyncio.Queue` for internal event handling, and Python-specific async context managers throughout. These have no direct JavaScript equivalents with identical semantics.
- **Python-specific CDP implementation** --- The library generates Python dataclass bindings for every Chrome DevTools Protocol domain. These are strongly typed Python objects with `__init__`, `__repr__`, and custom serialization. A JavaScript port would need to rewrite all of this for a different type system.
- **No abstraction layer** --- Unlike Selenium, which has a language-agnostic wire protocol that enabled official bindings in Java, Python, JavaScript, C#, and Ruby, nodriver has no intermediate protocol. The Python code talks directly to Chrome. There is nothing to bind against from another language.
- **Single maintainer scope** --- Nodriver is maintained by the same developer who built undetected-chromedriver. The project focuses exclusively on Python. There has been no indication of multi-language support on the roadmap.

The bottom line is that nodriver is not a protocol or a specification. It is a Python application that happens to control Chrome. Using it requires Python.

## Node.js Alternatives That Achieve the Same Goal

The reason people look for nodriver in Node.js usually comes down to one of two needs: they want undetected browser automation, or they want raw CDP access without the overhead of a full framework. Node.js has strong options for both.

### puppeteer-extra with Stealth Plugin

This is the closest Node.js equivalent to nodriver for stealth automation. Puppeteer already uses the Chrome DevTools Protocol under the hood. The `puppeteer-extra` wrapper adds a plugin system, and `puppeteer-extra-plugin-stealth` applies a set of evasion techniques that mirror what nodriver achieves by default.

The stealth plugin handles:

- Removing the `navigator.webdriver` flag
- Spoofing `navigator.plugins` and `navigator.languages`
- Fixing the `chrome.runtime` object that headless Chrome mishandles
- Patching `WebGL` and `canvas` fingerprinting inconsistencies
- Hiding automation-related Chrome command-line flags
- Overriding `navigator.permissions` behavior

Installation is straightforward:

```bash
npm install puppeteer puppeteer-extra puppeteer-extra-plugin-stealth
```

Basic usage:

```javascript
const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');

puppeteer.use(StealthPlugin());

(async () => {
  const browser = await puppeteer.launch({
    headless: false,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage();
  await page.goto('https://bot.sannysoft.com');

  // Check detection results
  await page.screenshot({ path: 'stealth-test.png', fullPage: true });

  await browser.close();
})();
```

The key difference from nodriver is architectural. Nodriver avoids detection by never using ChromeDriver or Selenium at all --- it connects directly to Chrome over CDP with no intermediary that leaks automation artifacts. Puppeteer does use an intermediary (the Puppeteer library itself manages the Chrome process), but the stealth plugin patches over the artifacts that this creates. The end result for most detection systems is similar, though nodriver's approach is arguably cleaner because it has nothing to patch in the first place.

### Playwright with Stealth Patches

Playwright does not have an official stealth plugin ecosystem like puppeteer-extra, but several community approaches exist. The most common pattern is to modify the browser context at launch to reduce detectable automation signals:

```javascript
const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({
    headless: false,
    args: [
      '--disable-blink-features=AutomationControlled',
      '--no-sandbox'
    ]
  });

  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    viewport: { width: 1920, height: 1080 },
    locale: 'en-US',
    timezoneId: 'America/New_York'
  });

  const page = await context.newPage();

  // Remove webdriver property before any page loads
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'webdriver', {
      get: () => undefined
    });

    // Fix chrome.runtime
    window.chrome = {
      runtime: {},
      loadTimes: function () { },
      csi: function () { }
    };
  });

  await page.goto('https://example.com');
  await browser.close();
})();
```

Playwright's stealth story is less mature than puppeteer-extra's. You end up writing more manual patches, and keeping them current as detection systems evolve requires ongoing maintenance. For dedicated stealth work in Node.js, puppeteer-extra with the stealth plugin is the more practical choice.

### chrome-remote-interface: Raw CDP from Node.js

If what draws you to nodriver is the direct CDP access rather than stealth specifically, `chrome-remote-interface` is the Node.js library you want. It provides a thin JavaScript client for the Chrome DevTools Protocol, similar in concept to what nodriver does internally in Python.

This library does not launch or manage Chrome for you. It connects to an already-running Chrome instance via its debugging port. This is the same pattern nodriver uses: communicate directly with Chrome over WebSocket using the CDP.

```bash
npm install chrome-remote-interface
```

## Code Comparison: Nodriver vs puppeteer-extra-stealth

To see how similar the end result is, here is the same task --- navigating to a page with stealth, extracting text, and taking a screenshot --- in both nodriver (Python) and puppeteer-extra with the stealth plugin (Node.js).

**Nodriver (Python):**

```python
import asyncio
import nodriver as uc

async def main():
    browser = await uc.start(
        headless=False,
        browser_args=['--no-sandbox']
    )

    page = await browser.get('https://example.com')

    # Wait for an element
    heading = await page.select('h1')
    print(await heading.get_text())

    # Take a screenshot
    await page.save_screenshot('nodriver-result.png')

    # Extract page title
    title = await page.evaluate('document.title')
    print(f'Page title: {title}')

    browser.stop()

asyncio.run(main())
```

**puppeteer-extra with StealthPlugin (Node.js):**

```javascript
const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');

puppeteer.use(StealthPlugin());

(async () => {
  const browser = await puppeteer.launch({
    headless: false,
    args: ['--no-sandbox']
  });

  const page = await browser.newPage();
  await page.goto('https://example.com');

  // Wait for an element
  const heading = await page.waitForSelector('h1');
  const text = await heading.evaluate(el => el.textContent);
  console.log(text);

  // Take a screenshot
  await page.screenshot({ path: 'stealth-result.png' });

  // Extract page title
  const title = await page.title();
  console.log(`Page title: ${title}`);

  await browser.close();
})();
```

The APIs are different, but the workflow is nearly identical. Both connect to Chrome via CDP. Both achieve stealth by default (nodriver architecturally, puppeteer-extra via the stealth plugin). Both support `async`/`await` for handling dynamic pages.

The major difference is what happens before your code runs. Nodriver starts with a clean Chrome session that has no automation artifacts. Puppeteer starts with a session that has automation artifacts and then patches them out via JavaScript overrides. For most detection systems, the observable result is the same. For the most sophisticated detectors that look for the patching itself, nodriver has a theoretical edge.


<figure>
  <img src="/assets/img/inline-using-nodriver-with-nodejs-is-it-possibl-1.jpg" alt="Staying undetected requires understanding what detection systems look for." loading="lazy">
  <figcaption>Staying undetected requires understanding what detection systems look for. <span class="img-credit">Photo by Maxim Landolfi / <a href="https://www.pexels.com" target="_blank" rel="noopener noreferrer">Pexels</a></span></figcaption>
</figure>

## chrome-remote-interface: The Node.js CDP Library

If you want to replicate nodriver's core approach --- direct CDP communication without a high-level framework --- `chrome-remote-interface` is the tool. It maps every CDP domain, method, and event to JavaScript functions.

### Launching Chrome and Connecting

First, launch Chrome manually with the remote debugging port enabled:

```bash
google-chrome --remote-debugging-port=9222 --no-first-run --no-default-browser-check
```

Then connect from Node.js:

```javascript
const CDP = require('chrome-remote-interface');

(async () => {
  const client = await CDP({ port: 9222 });

  const { Page, Runtime, Network, DOM } = client;

  // Enable the domains you need
  await Page.enable();
  await Network.enable();
  await DOM.enable();

  // Navigate to a page
  await Page.navigate({ url: 'https://example.com' });
  await Page.loadEventFired();

  // Execute JavaScript in the page context
  const result = await Runtime.evaluate({
    expression: 'document.title'
  });
  console.log('Title:', result.result.value);

  // Get the full HTML
  const { root } = await DOM.getDocument();
  const { outerHTML } = await DOM.getOuterHTML({
    nodeId: root.nodeId
  });
  console.log('HTML length:', outerHTML.length);

  await client.close();
})();
```

### Connecting to an Existing Chrome Instance

One advantage of chrome-remote-interface is connecting to a Chrome browser that is already open on your desktop. This gives you all the cookies, sessions, and extensions from your normal browsing:

```javascript
const CDP = require('chrome-remote-interface');

(async () => {
  // List available targets (tabs)
  const targets = await CDP.List({ port: 9222 });
  console.log('Available tabs:');
  targets.forEach((target, i) => {
    console.log(`  ${i}: ${target.title} - ${target.url}`);
  });

  // Connect to a specific tab
  const client = await CDP({
    port: 9222,
    target: targets[0]
  });

  const { Runtime } = client;

  // You now have access to a fully authenticated browser session
  const cookies = await Runtime.evaluate({
    expression: 'document.cookie'
  });
  console.log('Cookies:', cookies.result.value);

  await client.close();
})();
```

### Intercepting Network Requests

Like nodriver, chrome-remote-interface gives you full access to network-level CDP events:

```javascript
const CDP = require('chrome-remote-interface');

(async () => {
  const client = await CDP({ port: 9222 });
  const { Network, Page } = client;

  await Network.enable();
  await Page.enable();

  // Log every request
  Network.requestWillBeSent((params) => {
    console.log(`[${params.request.method}] ${params.request.url}`);
  });

  // Log responses with status codes
  Network.responseReceived((params) => {
    const resp = params.response;
    console.log(`[${resp.status}] ${resp.url}`);
  });

  // Intercept and modify requests
  await Fetch.enable({
    patterns: [{ urlPattern: '*' }]
  });

  Fetch.requestPaused(async ({ requestId, request }) => {
    console.log('Intercepted:', request.url);
    await Fetch.continueRequest({ requestId });
  });

  await Page.navigate({ url: 'https://example.com' });
  await Page.loadEventFired();

  await client.close();
})();
```

This is functionally equivalent to nodriver's network interception, just expressed through JavaScript instead of Python.

## Could You Run Nodriver from Node.js?

Technically, you could spawn a Python process from Node.js and communicate with a nodriver script over `stdin`/`stdout` or a local socket:

```javascript
const { spawn } = require('child_process');

const python = spawn('python3', ['nodriver_script.py']);

python.stdout.on('data', (data) => {
  console.log('Python output:', data.toString());
});

python.stderr.on('data', (data) => {
  console.error('Python error:', data.toString());
});

python.on('close', (code) => {
  console.log('Python process exited with code:', code);
});
```

This is impractical for several reasons:

- **Serialization overhead** --- Every piece of data must be serialized to pass between the Node.js and Python processes. Screenshots become base64-encoded strings. DOM trees become JSON blobs. This adds latency to every operation.
- **Two runtimes** --- You now have two language runtimes running, two dependency management systems to maintain, and two sets of version compatibility issues to track.
- **Error handling complexity** --- Errors in the Python process need to be caught, serialized, sent to Node.js, deserialized, and re-thrown. Stack traces become meaningless across the boundary.
- **No shared state** --- The Node.js process cannot directly access browser page objects, DOM elements, or CDP sessions managed by Python. Every interaction requires a round trip.

If your project is in Node.js, use a Node.js stealth solution. If you need nodriver specifically, write that part of your system in Python.


<figure>
  <img src="/assets/img/inline-using-nodriver-with-nodejs-is-it-possibl-2.jpg" alt="The less a browser looks automated, the better it performs against detection." loading="lazy">
  <figcaption>The less a browser looks automated, the better it performs against detection. <span class="img-credit">Photo by Rafael Rendon / <a href="https://www.pexels.com" target="_blank" rel="noopener noreferrer">Pexels</a></span></figcaption>
</figure>

## Decision Guide

The choice depends on two factors: your primary language and your stealth requirements.

**If you need undetected Chrome in Node.js**, use puppeteer-extra with the stealth plugin. It is the most maintained, best-documented, and widest-adopted stealth solution in the JavaScript ecosystem. The plugin system means you can add capabilities without modifying core Puppeteer code, and the stealth plugin's evasions are regularly updated as detection methods evolve.

**If you need raw CDP access in Node.js**, use chrome-remote-interface. It gives you the same low-level protocol access that nodriver uses internally, without the overhead of Puppeteer or Playwright. This is the right choice when you need fine-grained control over specific CDP domains, or when you want to connect to an existing Chrome instance rather than launching a new one.

**If you can use Python**, nodriver is the cleanest option for stealth automation. You can be up and running quickly by following our [getting started with nodriver guide](/posts/getting-started-nodriver-python-installation-first-script/). Its architectural approach to detection avoidance is fundamentally stronger than the patch-and-override approach that JavaScript stealth plugins use. You avoid an entire category of detection vectors rather than patching around them.

**If stealth is not a priority**, standard Puppeteer or Playwright without stealth plugins will serve you well. For a detailed breakdown of how Puppeteer and Selenium compare for web scraping, see our [Selenium vs Puppeteer definitive comparison](/posts/selenium-vs-puppeteer-definitive-comparison-web-scraping/). Both are excellent browser automation libraries with rich APIs, strong documentation, and active communities.

## Feature Comparison

Here is how the three main options stack up across the features that matter most for undetected browser automation:

| Feature | nodriver (Python) | puppeteer-extra-stealth (Node.js) | chrome-remote-interface (Node.js) |
|---|---|---|---|
| **Language** | Python | JavaScript | JavaScript |
| **Stealth by default** | Yes (architectural) | Yes (plugin patches) | No (manual setup) |
| **Detection evasion approach** | No ChromeDriver, no Selenium, clean Chrome launch | JavaScript overrides to hide automation signals | No built-in evasion |
| **CDP access level** | High-level API over CDP | High-level Puppeteer API over CDP | Raw CDP access |
| **Chrome process management** | Built-in | Built-in (via Puppeteer) | Manual (launch Chrome yourself) |
| **Async model** | Python asyncio | Node.js Promises | Node.js Promises |
| **npm install** | No | Yes | Yes |
| **pip install** | Yes (`pip install nodriver`) | No | No |
| **Browser download** | Uses system Chrome | Downloads Chromium by default | Uses system Chrome |
| **Network interception** | CDP-level | Puppeteer API or CDP-level | CDP-level |
| **Multi-tab support** | Yes | Yes | Yes (manual target management) |
| **Community size** | Moderate (Python scraping community) | Large (Puppeteer ecosystem) | Small (CDP specialists) |
| **Plugin ecosystem** | None | Extensive (puppeteer-extra plugins) | None |
| **Maintenance status** | Active, single maintainer | Active, community maintained | Stable, low churn |
| **Learning curve** | Low if you know Python async | Low if you know Puppeteer | Moderate (requires CDP knowledge) |

## Picking the Right Combination

Some projects benefit from using more than one of these tools. A few patterns that work well in practice:

**puppeteer-extra-stealth for scraping, chrome-remote-interface for debugging** --- Use the stealth plugin for your production scraping pipeline, but switch to chrome-remote-interface when you need to debug specific CDP interactions or inspect raw protocol messages.

**nodriver for stealth-critical paths, Playwright for everything else** --- If your project is polyglot and some pages require maximum stealth while others are straightforward, write the stealth-critical scraping in Python with nodriver and handle the rest with Playwright in whichever language your team prefers.

**chrome-remote-interface for browser extension testing** --- If you need to test or interact with Chrome extensions as part of your automation, chrome-remote-interface's ability to connect to a full Chrome instance (not Chromium) with extensions loaded is invaluable.

The important thing to internalize is that nodriver is not a cross-platform tool. It is a Python library. Searching for it on npm will not yield results. But the problem it solves --- browser automation that does not get detected --- has solid Node.js solutions. Choose the one that fits your stack, and you will get comparable results.
