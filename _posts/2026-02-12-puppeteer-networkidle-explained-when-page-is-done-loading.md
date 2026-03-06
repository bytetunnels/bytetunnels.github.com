---
title: "Puppeteer networkidle Explained: When Your Page Is Done Loading"
date: 2026-02-12 10:00:00 +0000
categories: ["Browser Automation"]
tags: ["puppeteer", "networkidle", "page loading", "javascript", "web scraping", "waiting"]
author: arman
image:
  path: /assets/img/2026-02-12-puppeteer-networkidle-explained-when-page-is-done-loading-hero.png
  alt: "Puppeteer networkidle Explained: When Your Page Is Done Loading"
---

Knowing when a page is "done loading" is one of the trickiest problems in browser automation. The browser fires a `load` event, but that event has nothing to do with the AJAX calls still fetching product data, the lazy-loaded images trickling in, or the analytics scripts phoning home. If you extract data too early, you get empty containers. If you wait too long, your scraper crawls at a fraction of its potential speed. Puppeteer addresses this with its `waitUntil` option and, specifically, its `networkidle` events -- a mechanism that watches network activity to decide when the page has settled. Understanding how these options work, when each one is appropriate, and where they break down is essential for building reliable scrapers. If you are deciding between Puppeteer and Selenium for your automation stack, the [definitive comparison](/posts/selenium-vs-puppeteer-definitive-comparison-web-scraping/) covers the broader trade-offs.

## The Four waitUntil Options

When you call `page.goto()` in Puppeteer, you can pass a `waitUntil` option that controls when the navigation is considered "complete." There are four possible values:

```javascript
// Option 1: Wait for the DOM load event
await page.goto(url, { waitUntil: 'load' });

// Option 2: Wait for DOMContentLoaded
await page.goto(url, { waitUntil: 'domcontentloaded' });

// Option 3: Wait until zero network connections for 500ms
await page.goto(url, { waitUntil: 'networkidle0' });

// Option 4: Wait until two or fewer network connections for 500ms
await page.goto(url, { waitUntil: 'networkidle2' });
```

Each one represents a different threshold for "done." Choosing the wrong one is a common source of both missed data and unnecessary slowness.

## load and domcontentloaded: The Fast But Incomplete Options

The `domcontentloaded` event fires when the initial HTML has been parsed and the DOM tree is built, but before stylesheets, images, and subframes have finished loading. It is the fastest option. If the data you need is embedded directly in the initial HTML (server-side rendered content, for example), this is all you need.

```javascript
// Good for server-rendered pages where data is in the initial HTML
await page.goto('https://example.com/static-product-page', {
  waitUntil: 'domcontentloaded'
});
const title = await page.$eval('h1', el => el.textContent);
```

The `load` event fires after `domcontentloaded`, once all stylesheets, images, and iframes have also finished loading. This is what most people think of as "the page loaded." It is the default value for `waitUntil` in Puppeteer.

```javascript
// Waits for stylesheets and images too
await page.goto('https://example.com/product-page', {
  waitUntil: 'load'
});
```

The problem with both of these is that neither one waits for asynchronous JavaScript to finish. Modern single-page applications fetch their actual content through XHR or Fetch requests after the initial page load. A React app, for example, might serve a nearly empty HTML shell, then pull all the real data from an API. By the time `load` fires, the API call may not have even started yet.

## networkidle0: Complete Network Silence

The `networkidle0` option waits until there have been zero network connections for at least 500 milliseconds. This is the strictest waiting strategy Puppeteer offers.

```javascript
await page.goto('https://example.com/spa-dashboard', {
  waitUntil: 'networkidle0'
});
```

The logic is straightforward: if nothing has talked to the network for half a second, the page is probably done loading all its data. This works well for pages that fetch a batch of data on load and then stop. A product detail page that makes three API calls to get product info, reviews, and recommendations, and then sits quietly, is a perfect candidate.

The downside is that `networkidle0` demands absolute silence. If even a single connection stays active -- a WebSocket for live chat, an analytics ping every 400ms, a keep-alive connection to a CDN -- the condition will never be met, and your navigation will eventually time out.

```javascript
// This will likely time out on pages with persistent connections
try {
  await page.goto('https://example.com/live-dashboard', {
    waitUntil: 'networkidle0',
    timeout: 30000
  });
} catch (error) {
  console.log('Timed out waiting for complete network silence');
}
```

## networkidle2: The Practical Default

The `networkidle2` option waits until there are no more than two active network connections for at least 500 milliseconds. This is the option you will use most often, and for good reason.

```javascript
await page.goto('https://example.com/ecommerce-page', {
  waitUntil: 'networkidle2'
});
```

Most modern websites maintain a small number of persistent connections in the background. These include:

- **Analytics beacons** -- Google Analytics, Segment, Mixpanel, and similar tools maintain ongoing connections or send periodic pings.
- **WebSocket connections** -- Live chat widgets, real-time price updates, notification systems.
- **Keep-alive connections** -- HTTP/2 connections that stay open for potential future requests.
- **Service worker activity** -- Background sync, push notification checks.

By allowing up to two active connections, `networkidle2` accommodates these background activities while still waiting for the main content-loading requests to finish. The page's five API calls for product data, images, and recommendations will have completed. The two remaining connections are almost always just background noise.

```javascript
const puppeteer = require('puppeteer');

(async () => {
  const browser = await puppeteer.launch();
  const page = await browser.newPage();

  // networkidle2 handles the common case well
  await page.goto('https://example.com/search?q=laptops', {
    waitUntil: 'networkidle2',
    timeout: 30000
  });

  // By this point, search results have loaded
  const results = await page.$$eval('.product-card', cards =>
    cards.map(card => ({
      name: card.querySelector('.product-name')?.textContent?.trim(),
      price: card.querySelector('.price')?.textContent?.trim()
    }))
  );

  console.log(`Found ${results.length} products`);
  await browser.close();
})();
```

## Comparing All Four Options

Here is a practical way to think about when to use each option:

| Option | Waits For | Speed | Completeness | Best For |
|--------|-----------|-------|-------------|----------|
| `domcontentloaded` | HTML parsed | Fastest | Lowest | Server-rendered pages, static HTML |
| `load` | HTML + images + styles | Fast | Medium | Pages where data is in the initial render |
| `networkidle2` | Network mostly quiet | Moderate | High | SPAs, AJAX-heavy pages (most common) |
| `networkidle0` | Network completely silent | Slowest | Highest | Simple pages with no background activity |

You can also pass multiple events as an array, and Puppeteer will wait for all of them:

```javascript
// Wait for both load event AND network to settle
await page.goto(url, {
  waitUntil: ['load', 'networkidle2']
});
```

In practice, `networkidle2` alone covers the `load` case since network silence implies the initial resources have loaded. The array form is mainly useful if you want to combine `domcontentloaded` with a network condition for specific scenarios.


<figure>
  <img src="/assets/img/inline-puppeteer-networkidle-explained-when-pag-1.jpg" alt="Headless browsers opened a new chapter in web automation." loading="lazy">
  <figcaption>Headless browsers opened a new chapter in web automation. <span class="img-credit">Photo by Bibek ghosh / <a href="https://www.pexels.com" target="_blank" rel="noopener noreferrer">Pexels</a></span></figcaption>
</figure>

## When networkidle Fails

There are real-world scenarios where neither `networkidle0` nor `networkidle2` will work correctly. Knowing these failure modes saves hours of debugging.

### Infinite polling

Some pages poll an API endpoint on a tight interval -- every 200ms, every second, every two seconds. News tickers, stock price widgets, sports scores. These pages never reach network idle because new requests fire before the 500ms quiet period elapses.

```javascript
// A page that polls every 500ms will never satisfy networkidle0 or networkidle2
// The network never goes quiet long enough
await page.goto('https://example.com/live-scores', {
  waitUntil: 'networkidle2',
  timeout: 60000  // Will time out
});
```

### Persistent WebSocket connections

WebSocket connections count as active network connections. A page with three WebSocket connections (chat, notifications, real-time data) will never satisfy `networkidle2` because there are always three active connections, which exceeds the threshold of two.

### Lazy loading triggered by scroll

Some pages only load content as the user scrolls. The initial network activity settles quickly (satisfying `networkidle2`), but most of the content is not yet loaded. You need to scroll and wait again.

### Analytics that never stop

Some analytics implementations send a stream of events -- mouse movements, scroll depth, time on page. These generate continuous network activity that prevents network idle from being reached.

## Better Alternatives: Waiting for Specific Elements

When network-based waiting is unreliable, the most robust alternative is to wait for the specific content you actually need.

```javascript
await page.goto(url, { waitUntil: 'domcontentloaded' });

// Wait for the specific element that contains your target data
await page.waitForSelector('.product-price', { timeout: 15000 });

// Now extract
const price = await page.$eval('.product-price', el => el.textContent.trim());
```

This approach decouples your waiting strategy from network behavior entirely. You do not care how many connections are open or closed. You care about whether the element you need is in the DOM.

You can wait for multiple elements:

```javascript
await page.goto(url, { waitUntil: 'domcontentloaded' });

// Wait for all critical elements
await Promise.all([
  page.waitForSelector('.product-title'),
  page.waitForSelector('.product-price'),
  page.waitForSelector('.product-reviews')
]);
```

## Custom Waiting with waitForFunction

For more complex conditions, `page.waitForFunction()` lets you run arbitrary JavaScript in the page context and wait until it returns a truthy value.

```javascript
await page.goto(url, { waitUntil: 'domcontentloaded' });

// Wait until a specific JavaScript condition is true
await page.waitForFunction(() => {
  const items = document.querySelectorAll('.search-result');
  return items.length > 0;
}, { timeout: 15000 });
```

This is powerful for cases where the element exists in the DOM early (as a skeleton or placeholder) but does not contain real data until later:

```javascript
// Wait for the price to be a real number, not a placeholder
await page.waitForFunction(() => {
  const priceEl = document.querySelector('.product-price');
  if (!priceEl) return false;
  const text = priceEl.textContent.trim();
  return text && text !== 'Loading...' && text !== '--';
}, { timeout: 15000 });
```

You can also wait for the absence of loading indicators:

```javascript
// Wait for the loading spinner to disappear
await page.waitForFunction(() => {
  const spinner = document.querySelector('.loading-spinner');
  return !spinner || spinner.style.display === 'none';
}, { timeout: 15000 });
```

## The Robust Pattern: networkidle2 Plus Selector

The most reliable pattern for general-purpose scraping combines network-based waiting with element-based waiting. Use `networkidle2` to get past the bulk of the loading, then verify the specific content is present.

```javascript
const puppeteer = require('puppeteer');

async function scrapePage(url, contentSelector) {
  const browser = await puppeteer.launch();
  const page = await browser.newPage();

  try {
    // Phase 1: Wait for the network to mostly settle
    await page.goto(url, {
      waitUntil: 'networkidle2',
      timeout: 30000
    });

    // Phase 2: Confirm the target content is actually present
    await page.waitForSelector(contentSelector, { timeout: 10000 });

    // Phase 3: Extract data
    const data = await page.$eval(contentSelector, el => el.textContent.trim());
    return data;

  } catch (error) {
    console.error(`Failed to scrape ${url}:`, error.message);
    return null;
  } finally {
    await browser.close();
  }
}

// Usage
const price = await scrapePage(
  'https://example.com/product/12345',
  '.product-price'
);
```

This two-phase approach handles the majority of real-world pages. The `networkidle2` wait handles the AJAX data loading. The `waitForSelector` call catches the edge case where the DOM update happens slightly after the network activity finishes (because the browser still needs to parse, execute, and render).


<figure>
  <img src="/assets/img/inline-puppeteer-networkidle-explained-when-pag-2.jpg" alt="Node.js gave browser automation a native home in JavaScript." loading="lazy">
  <figcaption>Node.js gave browser automation a native home in JavaScript. <span class="img-credit">Photo by Daniil Komov / <a href="https://www.pexels.com" target="_blank" rel="noopener noreferrer">Pexels</a></span></figcaption>
</figure>

## A Full Strategy with Fallbacks

For production scrapers that need to handle a wide variety of pages, build a waiting strategy with escalating fallbacks:

```javascript
const puppeteer = require('puppeteer');

async function robustNavigate(page, url, options = {}) {
  const {
    contentSelector = null,
    timeout = 30000,
    fallbackTimeout = 5000
  } = options;

  try {
    // Attempt 1: networkidle2 (handles most cases)
    await page.goto(url, {
      waitUntil: 'networkidle2',
      timeout: timeout
    });
  } catch (navError) {
    // Attempt 2: If networkidle2 times out (persistent connections),
    // fall back to domcontentloaded
    console.warn(`networkidle2 timed out for ${url}, falling back`);
    try {
      await page.goto(url, {
        waitUntil: 'domcontentloaded',
        timeout: timeout
      });
      // Give the page some time to run its JavaScript
      await new Promise(resolve => setTimeout(resolve, fallbackTimeout));
    } catch (fallbackError) {
      throw new Error(`Navigation failed entirely for ${url}: ${fallbackError.message}`);
    }
  }

  // If a content selector was provided, wait for it regardless of
  // which navigation strategy succeeded
  if (contentSelector) {
    try {
      await page.waitForSelector(contentSelector, {
        timeout: fallbackTimeout
      });
    } catch (selectorError) {
      console.warn(
        `Content selector "${contentSelector}" not found on ${url}`
      );
    }
  }
}

// Usage
(async () => {
  const browser = await puppeteer.launch();
  const page = await browser.newPage();

  await robustNavigate(page, 'https://example.com/products', {
    contentSelector: '.product-grid',
    timeout: 30000,
    fallbackTimeout: 5000
  });

  const products = await page.$$eval('.product-card', cards =>
    cards.map(card => ({
      name: card.querySelector('h2')?.textContent?.trim(),
      price: card.querySelector('.price')?.textContent?.trim(),
      link: card.querySelector('a')?.href
    }))
  );

  console.log(JSON.stringify(products, null, 2));
  await browser.close();
})();
```

This pattern tries `networkidle2` first, falls back to `domcontentloaded` plus a fixed delay if the network never settles, and then optionally waits for a specific selector on top of either approach.

## Performance Implications

The waiting strategy you choose directly impacts your scraper's throughput. Here are rough timings for a typical AJAX-heavy page:

- **domcontentloaded**: 200-500ms after navigation starts
- **load**: 500-2000ms after navigation starts
- **networkidle2**: 1000-4000ms after navigation starts (content load time + 500ms quiet period)
- **networkidle0**: 1500-10000ms+ after navigation starts (requires complete silence + 500ms)

If you are scraping 10,000 pages and each one takes 2 extra seconds because you are using `networkidle0` instead of `networkidle2`, that is over 5.5 extra hours of runtime. For pages where `domcontentloaded` is sufficient (static HTML, server-rendered content), the savings are even larger.

Measure your specific case. Add timing to your scraper:

```javascript
const startTime = Date.now();

await page.goto(url, { waitUntil: 'networkidle2' });

const navTime = Date.now() - startTime;
console.log(`Navigation took ${navTime}ms`);
```

Then test the same page with different `waitUntil` values and verify the data completeness for each. Choose the fastest option that still gives you complete data.

## Intercepting Requests for Faster Loading

One way to make `networkidle2` resolve faster is to block requests you do not need. If you are scraping text data, you probably do not need images, fonts, or analytics scripts. Blocking them reduces the number of network requests, which means the network goes quiet sooner.

```javascript
await page.setRequestInterception(true);

page.on('request', request => {
  const resourceType = request.resourceType();
  if (['image', 'stylesheet', 'font', 'media'].includes(resourceType)) {
    request.abort();
  } else {
    request.continue();
  }
});

// Now networkidle2 resolves faster because there are fewer requests
await page.goto(url, { waitUntil: 'networkidle2' });
```

This also reduces bandwidth usage and speeds up page loads. The trade-off is that some pages may behave differently without their CSS (elements positioned differently, hidden content not revealed), so test after enabling interception.

## The Playwright Equivalent

If you are using Playwright instead of Puppeteer, the same concepts apply with slightly different syntax. For a deeper look at [how Playwright and Puppeteer compare on speed and stealth](/posts/playwright-vs-puppeteer-speed-stealth-developer-experience/), see our dedicated breakdown.

```javascript
// Playwright (JavaScript)
const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();

  // Playwright uses the same waitUntil values for goto
  await page.goto('https://example.com', {
    waitUntil: 'networkidle'
  });

  // Or use the explicit wait method
  await page.goto('https://example.com');
  await page.waitForLoadState('networkidle');

  await browser.close();
})();
```

```python
# Playwright (Python)
from playwright.sync_api import sync_playwright

with sync_playwright() as p:
    browser = p.chromium.launch()
    page = browser.new_page()

    # Wait for network idle during navigation
    page.goto("https://example.com", wait_until="networkidle")

    # Or wait separately after navigation
    page.goto("https://example.com")
    page.wait_for_load_state("networkidle")

    browser.close()
```

Playwright's `networkidle` is equivalent to Puppeteer's `networkidle0` -- it waits for zero network connections for 500ms. There is no direct equivalent to `networkidle2`. In Playwright, you typically use `networkidle` or combine `domcontentloaded` with `page.waitForSelector()`.

## Summary

The `waitUntil` option is not a detail you gloss over. It determines whether your scraper gets complete data, whether it times out on certain pages, and how fast it runs across thousands of URLs. Start with `networkidle2` as your default. Fall back to `domcontentloaded` plus `waitForSelector` when persistent connections cause timeouts. Use `networkidle0` only for simple pages where you need absolute certainty that all loading has finished. And always validate that the data you need is actually present, regardless of which network strategy you use. The network going quiet does not guarantee the DOM has updated -- it just makes it very likely.
