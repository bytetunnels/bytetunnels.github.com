---
title: "Migrating from Puppeteer to Playwright: A Step-by-Step Guide"
date: 2026-02-17 10:00:00 +0000
categories: ["Browser Automation"]
tags: ["puppeteer", "playwright", "migration", "javascript", "tutorial", "browser automation"]
author: arman
image:
  path: /assets/img/2026-02-17-migrating-puppeteer-to-playwright-step-by-step-guide-hero.jpg
  alt: "Migrating from Puppeteer to Playwright: A Step-by-Step Guide"
---

More teams are making the jump from Puppeteer to Playwright every month, and for good reason. If you are still evaluating whether the switch makes sense, our [Playwright vs Puppeteer speed and stealth comparison](/posts/playwright-vs-puppeteer-speed-stealth-developer-experience/) covers the performance and developer experience differences in detail. Playwright offers multi-browser support out of the box, a more ergonomic API with built-in auto-waiting, and a developer experience that has pulled significantly ahead since Microsoft took the project in its own direction. If you have an existing Puppeteer codebase and want to migrate without rewriting everything from scratch, this guide walks through the process method by method, pattern by pattern, with real before-and-after code you can adapt to your own project.

## Why Migrate at All

Puppeteer still works. It still drives Chromium reliably. But the gap between the two tools has widened in several areas that affect day-to-day development, as we detail in our [Selenium vs Puppeteer definitive comparison](/posts/selenium-vs-puppeteer-definitive-comparison-web-scraping/):

**Multi-browser support.** Puppeteer is Chromium-only. Playwright ships with Chromium, Firefox, and WebKit, all driven through a single API. If you need to validate behavior across browsers or scrape sites that render differently in Safari's engine, Playwright handles it without switching libraries.

**Auto-waiting.** Puppeteer requires you to manually wait for elements before interacting with them. Playwright's locator-based API automatically waits for elements to be visible, enabled, and stable before performing actions. This eliminates an entire category of flaky test and scraping failures.

**Richer API.** Playwright's locator system, network interception via `page.route()`, built-in assertions, and trace viewer give you more power with less boilerplate. Features like `locator.filter()`, role-based selectors, and frame-piercing locators have no Puppeteer equivalent.

**Active development.** Playwright ships updates more frequently and has been adding features at a faster pace -- codegen, UI mode, component testing, and accessibility snapshots are all relatively recent additions.

**Built-in test runner.** Playwright Test is a full-featured test runner with parallel execution, fixtures, and HTML reporting. If you are migrating tests, you get a complete solution rather than needing to pair Puppeteer with Jest or Mocha.

## API Mapping: Puppeteer to Playwright

Before diving into code, here is a reference table mapping Puppeteer methods to their Playwright equivalents. Keep this handy as you work through your codebase.

| Puppeteer | Playwright | Notes |
|-----------|-----------|-------|
| `puppeteer.launch()` | `chromium.launch()` | Or `firefox.launch()`, `webkit.launch()` |
| `browser.newPage()` | `browser.newPage()` | Same API surface |
| `page.goto(url)` | `page.goto(url)` | Same, but Playwright waits for `load` by default |
| `page.$(selector)` | `page.locator(selector)` | Locators are lazy, do not query immediately |
| `page.$$(selector)` | `page.locator(selector).all()` | Returns array of locators |
| `page.evaluate(fn)` | `page.evaluate(fn)` | Largely identical |
| `page.$eval(sel, fn)` | `page.locator(sel).evaluate(fn)` | Scoped to element |
| `page.$$eval(sel, fn)` | `page.locator(sel).evaluateAll(fn)` | Scoped to all matches |
| `page.waitForSelector(sel)` | `page.locator(sel).waitFor()` | Auto-waiting usually makes this unnecessary |
| `page.waitForNavigation()` | `page.waitForURL(pattern)` | Or use `Promise.all` with navigation actions |
| `page.waitForTimeout(ms)` | `page.waitForTimeout(ms)` | Same, but discouraged in both |
| `page.click(selector)` | `page.locator(selector).click()` | Auto-waits in Playwright |
| `page.type(sel, text)` | `page.locator(sel).fill(text)` | `fill()` clears first -- see breaking changes |
| `page.keyboard.type(text)` | `page.keyboard.type(text)` | Same for raw keyboard input |
| `page.select(sel, value)` | `page.locator(sel).selectOption(value)` | Accepts string, object, or array |
| `page.setRequestInterception(true)` | `page.route(pattern, handler)` | Declarative in Playwright |
| `page.on('request', handler)` | `page.route(pattern, handler)` | Route replaces both interception and listening |
| `page.screenshot()` | `page.screenshot()` | Same API |
| `page.content()` | `page.content()` | Same API |
| `page.setViewport(size)` | Pass in `browser.newContext({ viewport: size })` | Set at context level |
| `page.setUserAgent(ua)` | Pass in `browser.newContext({ userAgent: ua })` | Set at context level |
| `browser.createIncognitoBrowserContext()` | `browser.newContext()` | Every context is isolated |

## Step 1: Replace the Launch Code

This is the first thing you change and it touches every script.

**Puppeteer:**

```javascript
const puppeteer = require('puppeteer');

async function main() {
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 720 });
  await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64)...');

  await page.goto('https://example.com');
  // ... your script
  await browser.close();
}
main();
```

**Playwright:**

```javascript
const { chromium } = require('playwright');

async function main() {
  const browser = await chromium.launch({
    headless: true,
  });
  const context = await browser.newContext({
    viewport: { width: 1280, height: 720 },
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)...',
  });
  const page = await context.newPage();

  await page.goto('https://example.com');
  // ... your script
  await browser.close();
}
main();
```

The key difference is the browser context. In Puppeteer, you typically set viewport and user agent directly on the page. In Playwright, these are set when creating a context. A context is an isolated browser session with its own cookies, storage, and settings. Every page belongs to a context. This is a better model because it mirrors how real browsers isolate tabs and profiles.

If your Puppeteer code uses `browser.createIncognitoBrowserContext()`, replace it with `browser.newContext()` -- every Playwright context is already isolated by default.

## Step 2: Replace Selectors with Locators

This is the biggest conceptual shift. Puppeteer uses `page.$()` and `page.$$()` which return `ElementHandle` objects -- live references to DOM nodes that can go stale. Playwright uses locators, which are lazy queries that re-evaluate every time you interact with them. Locators never go stale.

**Puppeteer -- finding and clicking an element:**

```javascript
// Find a single element
const button = await page.$('button.submit');
if (button) {
  await button.click();
}

// Find multiple elements
const items = await page.$$('.product-card');
for (const item of items) {
  const title = await item.$eval('.title', el => el.textContent);
  console.log(title);
}

// Wait for element, then interact
await page.waitForSelector('.results-loaded');
const results = await page.$$('.result-item');
```

**Playwright -- the locator equivalent:**

```javascript
// Find and click -- no null check needed, auto-waits
await page.locator('button.submit').click();

// Find multiple elements
const items = page.locator('.product-card');
const count = await items.count();
for (let i = 0; i < count; i++) {
  const title = await items.nth(i).locator('.title').textContent();
  console.log(title);
}

// Or use .all() for an array
const allItems = await page.locator('.product-card').all();
for (const item of allItems) {
  const title = await item.locator('.title').textContent();
  console.log(title);
}

// Wait for element -- usually unnecessary with locators
await page.locator('.results-loaded').waitFor();
const results = page.locator('.result-item');
```

Notice that `page.locator()` does not return a promise. It creates a locator object synchronously. The actual DOM query happens when you call an action method like `.click()`, `.textContent()`, or `.waitFor()`. This is different from Puppeteer's `page.$()` which queries the DOM immediately and returns a handle (or null).

Playwright also offers more expressive selectors beyond CSS:

```javascript
// By role -- more resilient than CSS selectors
await page.getByRole('button', { name: 'Submit' }).click();

// By text content
await page.getByText('Add to cart').click();

// By placeholder
await page.getByPlaceholder('Search...').fill('query');

// By test id
await page.getByTestId('checkout-button').click();

// Chained filtering
await page.locator('.product-card')
  .filter({ hasText: 'Sale' })
  .locator('.buy-button')
  .click();
```


<figure>
  <img src="/assets/img/inline-migrating-puppeteer-to-playwright-step-b-1.jpg" alt="Headless browsers opened a new chapter in web automation." loading="lazy">
  <figcaption>Headless browsers opened a new chapter in web automation. <span class="img-credit">Photo by Bibek ghosh / <a href="https://www.pexels.com" target="_blank" rel="noopener noreferrer">Pexels</a></span></figcaption>
</figure>

## Step 3: Replace Wait Patterns

Puppeteer's waiting patterns are the biggest source of flakiness in most codebases. The typical pattern involves `waitForSelector()`, `waitForNavigation()`, or `waitForFunction()`. Playwright's auto-waiting handles most of these cases implicitly.

**Puppeteer -- manual waits:**

```javascript
// Wait for navigation after click
await Promise.all([
  page.waitForNavigation({ waitUntil: 'networkidle0' }),
  page.click('a.next-page'),
]);

// Wait for selector with timeout
try {
  await page.waitForSelector('.data-loaded', { timeout: 10000 });
} catch (e) {
  console.log('Element did not appear');
}

// Wait for a function to return true
await page.waitForFunction(
  () => document.querySelectorAll('.item').length > 10
);

// Wait for network idle
await page.goto('https://example.com', { waitUntil: 'networkidle0' });
```

**Playwright -- equivalent waits:**

```javascript
// Wait for navigation after click -- auto-waiting handles most cases
await page.locator('a.next-page').click();
await page.waitForURL('**/page/2');

// Or if you need to wait for a specific load state:
await page.locator('a.next-page').click();
await page.waitForLoadState('networkidle');

// Wait for selector with timeout
await page.locator('.data-loaded').waitFor({ timeout: 10000 });

// Wait for a function to return true
await page.waitForFunction(
  () => document.querySelectorAll('.item').length > 10
);

// Wait for network idle on navigation
await page.goto('https://example.com', { waitUntil: 'networkidle' });
```

The most important difference: in Playwright, most explicit waits are unnecessary. When you call `page.locator('.button').click()`, Playwright automatically waits for the element to be attached to the DOM, visible, stable (not animating), enabled, and not obscured by other elements. It retries the checks until the action timeout expires. This alone eliminates the majority of `waitForSelector()` calls in a typical Puppeteer codebase.

**Puppeteer `waitForNavigation()` pattern:**

```javascript
// Puppeteer -- must coordinate navigation wait with the action
const [response] = await Promise.all([
  page.waitForNavigation(),
  page.click('#submit-form'),
]);
```

**Playwright -- simpler navigation handling:**

```javascript
// Playwright -- waitForURL or expect the action to cause navigation
await page.locator('#submit-form').click();
await page.waitForURL('**/confirmation');

// Or if you need the response:
const responsePromise = page.waitForResponse('**/api/submit');
await page.locator('#submit-form').click();
const response = await responsePromise;
```

## Step 4: Replace Network Interception

Puppeteer uses `page.setRequestInterception(true)` followed by event listeners. Playwright uses `page.route()` which is declarative and more composable.

**Puppeteer -- request interception:**

```javascript
await page.setRequestInterception(true);

page.on('request', (request) => {
  // Block images and stylesheets
  if (['image', 'stylesheet', 'font'].includes(request.resourceType())) {
    request.abort();
  } else if (request.url().includes('/api/data')) {
    // Modify a request
    request.continue({
      headers: {
        ...request.headers(),
        'Authorization': 'Bearer token123',
      },
    });
  } else {
    request.continue();
  }
});

// Listen for responses
page.on('response', async (response) => {
  if (response.url().includes('/api/data')) {
    const data = await response.json();
    console.log('Captured:', data);
  }
});
```

**Playwright -- route-based interception:**

```javascript
// Block images and stylesheets
await page.route(/\.(png|jpg|jpeg|gif|css|woff|woff2)$/, (route) => {
  route.abort();
});

// Or block by resource type using a glob
await page.route('**/*', (route) => {
  const resourceType = route.request().resourceType();
  if (['image', 'stylesheet', 'font'].includes(resourceType)) {
    return route.abort();
  }
  return route.continue();
});

// Modify a specific request
await page.route('**/api/data', (route) => {
  route.continue({
    headers: {
      ...route.request().headers(),
      'Authorization': 'Bearer token123',
    },
  });
});

// Listen for responses
page.on('response', async (response) => {
  if (response.url().includes('/api/data')) {
    const data = await response.json();
    console.log('Captured:', data);
  }
});

// Or wait for a specific response
const response = await page.waitForResponse('**/api/data');
const data = await response.json();
```

Playwright's `page.route()` is more flexible because you can register multiple route handlers and they compose cleanly. You do not need a single monolithic request handler with a cascade of if/else branches. Each route targets a specific URL pattern and handles only that traffic.

You can also mock responses entirely:

```javascript
// Mock an API response
await page.route('**/api/products', (route) => {
  route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({
      products: [
        { id: 1, name: 'Test Product', price: 29.99 },
      ],
    }),
  });
});
```

## Step 5: Replace evaluate Calls

The `page.evaluate()` API is mostly identical between Puppeteer and Playwright. This is the easiest part of the migration -- most evaluate calls work without changes.

**Puppeteer:**

```javascript
// Simple evaluate
const title = await page.evaluate(() => document.title);

// Evaluate with arguments
const text = await page.evaluate(
  (selector) => document.querySelector(selector)?.textContent,
  '.product-name'
);

// $eval -- evaluate in context of a single element
const price = await page.$eval('.price', (el) => el.textContent.trim());

// $$eval -- evaluate across all matching elements
const allPrices = await page.$$eval('.price', (elements) =>
  elements.map((el) => el.textContent.trim())
);

// Expose a function from Node to the browser
await page.exposeFunction('md5', (text) => crypto.createHash('md5').update(text).digest('hex'));
const hash = await page.evaluate(async () => {
  return await window.md5('hello');
});
```

**Playwright:**

```javascript
// Simple evaluate -- identical
const title = await page.evaluate(() => document.title);

// Evaluate with arguments -- identical
const text = await page.evaluate(
  (selector) => document.querySelector(selector)?.textContent,
  '.product-name'
);

// $eval equivalent -- use locator.evaluate
const price = await page.locator('.price').evaluate(
  (el) => el.textContent.trim()
);

// $$eval equivalent -- use locator.evaluateAll
const allPrices = await page.locator('.price').evaluateAll(
  (elements) => elements.map((el) => el.textContent.trim())
);

// Expose a function -- identical API
await page.exposeFunction('md5', (text) => crypto.createHash('md5').update(text).digest('hex'));
const hash = await page.evaluate(async () => {
  return await window.md5('hello');
});
```

The only differences are `$eval` and `$$eval`, which become `locator().evaluate()` and `locator().evaluateAll()`. The function signatures inside the evaluate callback remain the same because both libraries serialize the function and run it in the browser context.


<figure>
  <img src="/assets/img/inline-migrating-puppeteer-to-playwright-step-b-2.jpg" alt="Node.js gave browser automation a native home in JavaScript." loading="lazy">
  <figcaption>Node.js gave browser automation a native home in JavaScript. <span class="img-credit">Photo by Daniil Komov / <a href="https://www.pexels.com" target="_blank" rel="noopener noreferrer">Pexels</a></span></figcaption>
</figure>

## Breaking Changes to Watch For

Several Puppeteer patterns behave differently in Playwright. These are the ones most likely to cause bugs if you do a find-and-replace migration without reading carefully.

### type() vs fill()

This is the most common migration pitfall.

```javascript
// Puppeteer type() -- types character by character, appends to existing value
await page.type('#search', 'playwright');

// Playwright fill() -- clears the field first, then sets the value
await page.locator('#search').fill('playwright');

// If you need Puppeteer's character-by-character behavior:
await page.locator('#search').pressSequentially('playwright');

// If you need to append text without clearing:
await page.locator('#search').pressSequentially('additional text');
```

Puppeteer's `type()` simulates individual keystrokes and appends to whatever text is already in the field. Playwright's `fill()` clears the field and sets the value directly. If your code relies on appending text to an existing input value, you must use `pressSequentially()` in Playwright, not `fill()`.

### Response Handling

```javascript
// Puppeteer -- response from goto
const response = await page.goto('https://example.com');
console.log(response.status());      // Works
console.log(response.headers());     // Returns object

// Playwright -- same pattern but headers() is async
const response = await page.goto('https://example.com');
console.log(response.status());      // Works
console.log(await response.allHeaders()); // Note: async method
// response.headers() returns headers as a simple object; allHeaders() includes multi-value ones
```

### Context vs Incognito

```javascript
// Puppeteer -- incognito context
const context = await browser.createIncognitoBrowserContext();
const page = await context.newPage();
// The default context is shared and not isolated

// Playwright -- every context is isolated
const context = await browser.newContext();
const page = await context.newPage();
// There is no shared default context leaking state
```

### Frame Handling

```javascript
// Puppeteer -- access frames through the page
const frame = page.frames().find(f => f.name() === 'my-iframe');
await frame.click('.button');

// Playwright -- use frameLocator for a cleaner API
await page.frameLocator('#my-iframe').locator('.button').click();

// Or access by name
const frame = page.frame('my-iframe');
await frame.locator('.button').click();
```

### Download Handling

```javascript
// Puppeteer -- set download path via CDP
const client = await page.target().createCDPSession();
await client.send('Page.setDownloadBehavior', {
  behavior: 'allow',
  downloadPath: '/tmp/downloads',
});
await page.click('#download-link');

// Playwright -- built-in download API
const downloadPromise = page.waitForEvent('download');
await page.locator('#download-link').click();
const download = await downloadPromise;
await download.saveAs('/tmp/downloads/' + download.suggestedFilename());
```

### Dialog Handling

```javascript
// Puppeteer -- listen for dialog events
page.on('dialog', async (dialog) => {
  await dialog.accept('yes');
});
await page.click('#confirm-button');

// Playwright -- same event pattern, but must register BEFORE triggering
page.on('dialog', (dialog) => {
  dialog.accept('yes');
});
await page.locator('#confirm-button').click();
```

## Testing Your Migration

Do not attempt a big-bang migration. The safest approach is to run both implementations in parallel and compare results.

```javascript
const puppeteer = require('puppeteer');
const { chromium } = require('playwright');

async function runBothAndCompare(url) {
  // Run Puppeteer version
  const pptrBrowser = await puppeteer.launch({ headless: true });
  const pptrPage = await pptrBrowser.newPage();
  await pptrPage.goto(url, { waitUntil: 'networkidle0' });
  const pptrTitle = await pptrPage.title();
  const pptrContent = await pptrPage.content();
  const pptrElements = await pptrPage.$$eval('.item', els => els.length);
  await pptrBrowser.close();

  // Run Playwright version
  const pwBrowser = await chromium.launch({ headless: true });
  const pwPage = await pwBrowser.newPage();
  await pwPage.goto(url, { waitUntil: 'networkidle' });
  const pwTitle = await pwPage.title();
  const pwContent = await pwPage.content();
  const pwElements = await pwPage.locator('.item').count();
  await pwBrowser.close();

  // Compare results
  console.log('Title match:', pptrTitle === pwTitle);
  console.log('Element count match:', pptrElements === pwElements);
  console.log('Content length:', pptrContent.length, 'vs', pwContent.length);
}

runBothAndCompare('https://example.com');
```

For larger codebases, a phased migration works best:

1. **Install Playwright alongside Puppeteer.** Both can coexist in the same project.
2. **Migrate utility functions first.** Start with your launch helpers, page setup functions, and common selectors.
3. **Convert one script or test file at a time.** Verify each file produces identical results before moving on.
4. **Run regression tests after each batch.** Compare scraped data, screenshots, or test outcomes between the old and new versions.
5. **Remove Puppeteer once all scripts are converted.** Uninstall the package and clean up any remaining imports.

A useful technique during parallel operation is to wrap both libraries behind a common interface:

```javascript
// scraper.js -- abstraction layer during migration
class Scraper {
  constructor(engine = 'playwright') {
    this.engine = engine;
  }

  async launch() {
    if (this.engine === 'puppeteer') {
      const puppeteer = require('puppeteer');
      this.browser = await puppeteer.launch({ headless: true });
      this.page = await this.browser.newPage();
    } else {
      const { chromium } = require('playwright');
      this.browser = await chromium.launch({ headless: true });
      const context = await this.browser.newContext();
      this.page = await context.newPage();
    }
  }

  async navigate(url) {
    if (this.engine === 'puppeteer') {
      await this.page.goto(url, { waitUntil: 'networkidle0' });
    } else {
      await this.page.goto(url, { waitUntil: 'networkidle' });
    }
  }

  async getTextAll(selector) {
    if (this.engine === 'puppeteer') {
      return await this.page.$$eval(selector, els =>
        els.map(el => el.textContent.trim())
      );
    } else {
      return await this.page.locator(selector).evaluateAll(els =>
        els.map(el => el.textContent.trim())
      );
    }
  }

  async close() {
    await this.browser.close();
  }
}
```

This lets you toggle between engines with a single flag and verify that both produce the same output before committing to the migration.

## What You Gain After Migration

Once the migration is complete and Puppeteer is removed, here is what your project gains.

**Multi-browser testing.** Swap `chromium.launch()` for `firefox.launch()` or `webkit.launch()` and run the same scripts across all three engines. No code changes required beyond the launch call.

```javascript
// Run the same scraper on all browsers
for (const browserType of [chromium, firefox, webkit]) {
  const browser = await browserType.launch();
  const page = await browser.newPage();
  await page.goto('https://example.com');
  const data = await page.locator('.product').allTextContents();
  console.log(`${browserType.name()}: found ${data.length} products`);
  await browser.close();
}
```

**Trace viewer.** Playwright can record a trace of every action, network request, DOM snapshot, and console message during a run. When something breaks, you open the trace in a browser and step through it like a debugger.

```javascript
const context = await browser.newContext();
await context.tracing.start({ screenshots: true, snapshots: true });
const page = await context.newPage();

// ... run your scraper

await context.tracing.stop({ path: 'trace.zip' });
// Open with: npx playwright show-trace trace.zip
```

**Codegen tool.** Playwright includes a code generator that records your browser interactions and outputs working code. This is useful for bootstrapping new scrapers or generating selector suggestions.

```bash
npx playwright codegen https://example.com
```

**Parallel execution.** Playwright Test runs tests in parallel across multiple workers by default. If you are migrating a test suite, you get parallel execution without configuring it.

```javascript
// playwright.config.js
module.exports = {
  workers: 4,
  retries: 1,
  use: {
    headless: true,
    trace: 'on-first-retry',
  },
};
```

**Better debugging.** Playwright's inspector lets you step through scripts interactively, pause on locator evaluations, and see exactly what the browser sees at each point.

```bash
PWDEBUG=1 node my-scraper.js
```

The migration is not trivial -- especially the shift from element handles to locators and from `type()` to `fill()`. But the result is a codebase with fewer race conditions, better error messages, and access to a toolchain that is growing faster than Puppeteer's. For a broader look at how Playwright stacks up across the entire landscape, see our [Playwright vs Puppeteer vs Selenium vs Scrapy mega comparison](/posts/playwright-vs-puppeteer-vs-selenium-vs-scrapy-2026-mega-comparison/). For most teams, the investment pays for itself within the first few weeks of reduced flakiness and faster debugging. If you decide Playwright is not for you, check out the [top Puppeteer alternatives](/posts/top-puppeteer-alternatives-what-to-use-instead/) to see what other options are available.
