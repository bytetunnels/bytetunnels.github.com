---
title: "Web Scraping Interview Questions: Prepare for Data Engineering Roles"
date: 2026-02-23 16:00:00 +0000
categories: ["Web Scraping"]
tags: ["interview questions", "web scraping", "data engineering", "career", "python", "preparation"]
author: arman
image:
  path: /assets/img/2026-02-23-web-scraping-interview-questions-data-engineering-hero.jpg
  alt: "Web Scraping Interview Questions: Prepare for Data Engineering Roles"
---

Web scraping knowledge is showing up in interview loops for data engineering, machine learning, and backend roles with increasing regularity. Companies that depend on external data -- whether for price monitoring, lead generation, news aggregation, or training datasets -- need engineers who understand how to extract information from the web reliably, ethically, and at scale. The questions you face will range from "explain what the DOM is" to "design a distributed scraping system that processes 10,000 pages per hour with retry logic." This post covers 20 real interview questions across beginner, intermediate, and advanced levels, with answers and code snippets you can study before walking into the room.

The questions are ordered roughly by difficulty. If you can answer all 20 confidently, you are well-prepared for any web scraping segment of a data engineering interview.

## Beginner Questions

These test your foundational understanding of how the web works and where scraping fits in.

### 1. What is web scraping and how does it differ from web crawling?

**Web scraping** is the process of extracting specific data from web pages. You target particular elements -- prices, titles, contact information -- and pull them into a structured format like CSV, JSON, or a database.

**Web crawling** is the process of systematically browsing the web by following links. A crawler discovers pages; a scraper extracts data from them. Google's search engine is a crawler. A script that pulls product prices from an e-commerce site is a scraper.

In practice, most real-world scraping projects involve both: you crawl to discover URLs, then scrape each URL for the data you need. The distinction matters because it affects architecture. Crawling is about breadth and link management. Scraping is about parsing and data extraction.

### 2. What is the DOM?

The DOM (Document Object Model) is the browser's internal representation of an HTML document as a tree of objects. When a browser loads a page, it parses the raw HTML string and builds a tree structure where every element, attribute, and piece of text becomes a node.

```html
<html>
  <body>
    <div id="content">
      <h1>Title</h1>
      <p>Paragraph text</p>
    </div>
  </body>
</html>
```

In the DOM tree, `<html>` is the root node. `<body>` is its child. `<div id="content">` is a child of `<body>`, and so on. JavaScript can modify the DOM after the page loads -- adding elements, changing text, removing nodes. This is why the HTML source you receive from a simple HTTP request may differ from what you see in a browser's DevTools inspector.

For scraping, the DOM matters because your selectors (CSS or XPath) navigate this tree structure. Understanding parent-child relationships, sibling nodes, and attribute matching is essential for writing reliable selectors.

### 3. Explain the difference between static and dynamic websites for scraping

A **static website** serves HTML that already contains all the data you need. When you make an HTTP GET request, the server returns a complete HTML document. You can parse it directly with a library like BeautifulSoup without needing a browser.

A **dynamic website** loads data after the initial page load using JavaScript. The server returns a minimal HTML shell, and client-side JavaScript (typically via AJAX/fetch requests) populates the page with content. React, Vue, and Angular applications are common examples.

This distinction is the most important architectural decision in a scraping project:

- Static sites: use `requests` + `BeautifulSoup` or `Scrapy`. Fast and lightweight. For a speed comparison of these approaches, see [Python requests vs Selenium](/posts/python-requests-vs-selenium-speed-performance-comparison/).
- Dynamic sites: use a browser automation tool like Selenium or Playwright, or intercept the underlying API calls the JavaScript makes and hit those directly.

The best approach for dynamic sites is often to open the browser's Network tab, find the XHR/fetch requests that load the data, and call those API endpoints directly. This avoids the overhead of running a full browser.

### 4. What is robots.txt and should you always follow it?

`robots.txt` is a file at the root of a website (e.g., `https://example.com/robots.txt`) that tells crawlers and scrapers which paths they are allowed or disallowed from accessing. It follows the Robots Exclusion Protocol.

```text
User-agent: *
Disallow: /admin/
Disallow: /private/
Crawl-delay: 10

User-agent: Googlebot
Allow: /
```

This file says: all bots should avoid `/admin/` and `/private/` and wait 10 seconds between requests, but Googlebot can access everything.

Should you always follow it? The honest answer is: `robots.txt` is a guideline, not a technical enforcement mechanism. Nothing prevents you from ignoring it. However, there are strong reasons to respect it:

- **Legal risk**: Courts have considered robots.txt violations as evidence of unauthorized access (see hiQ Labs v. LinkedIn, Ryanair v. PR Aviation).
- **Ethical practice**: The site owner is explicitly telling you not to access certain paths.
- **Practical**: If you ignore it and get blocked, you have wasted your own time.

In an interview, the right answer is: "I always check robots.txt first, respect its directives, and if I need access to a disallowed path, I contact the site owner to request permission." For more on the legal nuances, read [is robots.txt legally binding](/posts/is-robots-txt-legally-binding-scraping-law-explained/).

### 5. What HTTP methods are used in web scraping?

The two primary HTTP methods used in scraping are **GET** and **POST**.

**GET** retrieves a resource. Most scraping starts with GET requests to fetch HTML pages. Query parameters are appended to the URL.

```python
import requests

# Simple GET request
response = requests.get("https://example.com/products?page=2&category=electronics")
```

**POST** sends data to the server. You use POST when submitting forms, logging in, or interacting with APIs that expect a request body.

```python
# POST request for login
response = requests.post("https://example.com/login", data={
    "username": "user@example.com",
    "password": "secretpassword"
})

# POST request to an API endpoint
response = requests.post("https://example.com/api/search", json={
    "query": "laptop",
    "page": 1,
    "filters": {"min_price": 500}
})
```

Less commonly, you might encounter **PUT** or **PATCH** if you are interacting with a REST API, or **HEAD** if you want to check response headers without downloading the full body (useful for checking content types or last-modified dates before deciding whether to scrape).

<figure>
  <img src="/assets/img/interview-whiteboard.jpg" alt="People collaborating at a whiteboard in an office setting" loading="lazy">
  <figcaption>Interviewers want to see you think through trade-offs, not recite definitions. <span class="img-credit">Photo by RDNE Stock project / <a href="https://www.pexels.com" target="_blank" rel="noopener noreferrer">Pexels</a></span></figcaption>
</figure>

## Intermediate Questions

These probe your practical experience building scrapers.

### 6. Compare BeautifulSoup, Selenium, and Scrapy

These three tools solve different problems and operate at different levels of abstraction.

**BeautifulSoup** is an HTML/XML parser. It does not fetch pages or execute JavaScript. You hand it an HTML string and it gives you methods to search and navigate the document tree. It is lightweight, easy to learn, and pairs with `requests` for simple scraping tasks.

```python
from bs4 import BeautifulSoup
import requests

html = requests.get("https://example.com").text
soup = BeautifulSoup(html, "html.parser")
titles = [h2.text for h2 in soup.select("h2.product-title")]
```

**Selenium** is a browser automation framework. It launches a real browser (Chrome, Firefox), executes JavaScript, and lets you interact with pages -- clicking buttons, filling forms, scrolling. It is slower and more resource-intensive but handles dynamic content that BeautifulSoup cannot see.

```python
from selenium import webdriver
from selenium.webdriver.common.by import By

driver = webdriver.Chrome()
driver.get("https://example.com")
titles = driver.find_elements(By.CSS_SELECTOR, "h2.product-title")
for title in titles:
    print(title.text)
driver.quit()
```

**Scrapy** is a full scraping framework. It handles HTTP requests, response parsing, link following, data pipelines, rate limiting, retries, and output formatting. It is built for large-scale, production-grade scraping projects.

```python
import scrapy

class ProductSpider(scrapy.Spider):
    name = "products"
    start_urls = ["https://example.com/products"]

    def parse(self, response):
        for product in response.css("div.product-card"):
            yield {
                "title": product.css("h2.title::text").get(),
                "price": product.css("span.price::text").get(),
            }
        next_page = response.css("a.next-page::attr(href)").get()
        if next_page:
            yield response.follow(next_page, self.parse)
```

**When to use each**: BeautifulSoup for small, one-off tasks on static pages. Selenium when you need a browser. Scrapy when you need to scrape thousands of pages with built-in concurrency, retries, and data pipelines. For a more detailed breakdown of these and other tools, see the [Playwright vs Puppeteer vs Selenium vs Scrapy mega comparison](/posts/playwright-vs-puppeteer-vs-selenium-vs-scrapy-2026-mega-comparison/).

### 7. How do you handle JavaScript-rendered content?

Three main approaches, in order of preference:

**1. Find the underlying API.** Open DevTools, go to the Network tab, filter by XHR/Fetch, and look for the API calls that load the data. If you find them, call those endpoints directly with `requests`. This is the fastest and most reliable approach.

```python
import requests

# Instead of rendering the JS, call the API directly
response = requests.get("https://example.com/api/products", params={
    "page": 1,
    "limit": 50
})
data = response.json()
```

**2. Use a headless browser.** Playwright or Selenium can render the page fully, including JavaScript execution.

```python
from playwright.sync_api import sync_playwright

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    page = browser.new_page()
    page.goto("https://example.com/products")
    page.wait_for_selector("div.product-card")
    content = page.content()
    browser.close()
```

**3. Use a lightweight JS renderer.** Tools like `requests-html` can render JavaScript without the full overhead of Selenium, though they are less reliable for complex applications.

The interview answer should demonstrate that you try the lightweight approach first and only escalate to a full browser when necessary.

### 8. What are CSS selectors and XPath? Give examples.

Both are languages for selecting elements from an HTML document. CSS selectors are more readable; XPath is more powerful.

**CSS Selectors**:

```python
# Select by class
soup.select("div.product-card")

# Select by ID
soup.select("#main-content")

# Select by attribute
soup.select('a[href^="https://"]')

# Select child elements
soup.select("div.product > span.price")

# Select nth child
soup.select("table tr:nth-child(2)")
```

**XPath**:

```python
from lxml import etree

tree = etree.HTML(html_string)

# Select by class
tree.xpath('//div[@class="product-card"]')

# Select by text content
tree.xpath('//a[contains(text(), "Next")]')

# Select parent of an element
tree.xpath('//span[@class="price"]/parent::div')

# Select by position
tree.xpath('//table/tr[position()>1]')

# Select using multiple conditions
tree.xpath('//div[@class="product" and @data-available="true"]')
```

XPath's advantages: you can select by text content, navigate upward to parents, and use more complex conditional logic. CSS selectors are simpler and generally sufficient for most scraping tasks. When neither CSS nor XPath is practical, [regex for web scraping](/posts/regex-for-web-scraping-extracting-data-without-parser/) can serve as a lightweight alternative for extracting data without a full parser. In Scrapy, both are first-class citizens.

### 9. How do you handle pagination in scraping?

Pagination comes in several patterns, and each requires a different approach.

**URL-based pagination** with page numbers:

```python
import requests
from bs4 import BeautifulSoup

base_url = "https://example.com/products?page={}"
all_products = []

for page_num in range(1, 101):
    response = requests.get(base_url.format(page_num))
    soup = BeautifulSoup(response.text, "html.parser")
    products = soup.select("div.product-card")
    if not products:
        break  # No more pages
    all_products.extend(products)
```

**"Next" button pagination**:

```python
url = "https://example.com/products"

while url:
    response = requests.get(url)
    soup = BeautifulSoup(response.text, "html.parser")
    # Process current page data
    process_products(soup.select("div.product-card"))
    # Find next page link
    next_link = soup.select_one("a.next-page")
    url = next_link["href"] if next_link else None
```

**Infinite scroll** (JavaScript-loaded content):

```python
from playwright.sync_api import sync_playwright

with sync_playwright() as p:
    browser = p.chromium.launch()
    page = browser.new_page()
    page.goto("https://example.com/feed")

    previous_height = 0
    while True:
        page.evaluate("window.scrollTo(0, document.body.scrollHeight)")
        page.wait_for_timeout(2000)
        current_height = page.evaluate("document.body.scrollHeight")
        if current_height == previous_height:
            break
        previous_height = current_height

    # Now extract all loaded content
    content = page.content()
    browser.close()
```

**API-based pagination** with cursors or offsets:

```python
offset = 0
limit = 50

while True:
    response = requests.get("https://example.com/api/items", params={
        "offset": offset,
        "limit": limit
    })
    data = response.json()
    if not data["items"]:
        break
    process_items(data["items"])
    offset += limit
```

The best interview answer shows awareness of all these patterns and explains that you would inspect the site to determine which pattern it uses before writing code.

### 10. What is rate limiting and how do you implement it?

Rate limiting means controlling how frequently your scraper sends requests to avoid overloading the server, getting blocked, or violating terms of service.

**Simple approach with sleep**:

```python
import time
import requests

urls = ["https://example.com/page/1", "https://example.com/page/2", ...]

for url in urls:
    response = requests.get(url)
    process(response)
    time.sleep(2)  # Wait 2 seconds between requests
```

**Randomized delays** to avoid detectable patterns:

```python
import time
import random

for url in urls:
    response = requests.get(url)
    process(response)
    time.sleep(random.uniform(1.5, 4.5))
```

**Token bucket or leaky bucket** for more precise control:

```python
import time
import threading

class RateLimiter:
    def __init__(self, max_requests_per_second):
        self.min_interval = 1.0 / max_requests_per_second
        self.last_request_time = 0
        self.lock = threading.Lock()

    def wait(self):
        with self.lock:
            elapsed = time.time() - self.last_request_time
            wait_time = self.min_interval - elapsed
            if wait_time > 0:
                time.sleep(wait_time)
            self.last_request_time = time.time()

limiter = RateLimiter(max_requests_per_second=2)

for url in urls:
    limiter.wait()
    response = requests.get(url)
```

**Scrapy's built-in approach**: set `DOWNLOAD_DELAY` in settings, and Scrapy handles it automatically with optional `RANDOMIZE_DOWNLOAD_DELAY`.

In an interview, mention that you also check `robots.txt` for `Crawl-delay` directives and respect the server's `Retry-After` header when you receive a 429 (Too Many Requests) response.

### 11. How do you handle authentication/login in scrapers?

There are several methods depending on the site's authentication mechanism.

**Session-based login with form POST**:

```python
import requests

session = requests.Session()

# Log in
login_data = {
    "username": "user@example.com",
    "password": "password123"
}
session.post("https://example.com/login", data=login_data)

# Now use the same session for authenticated requests
response = session.get("https://example.com/dashboard")
# The session automatically sends cookies from the login response
```

**Token-based authentication (API keys, Bearer tokens)**:

```python
headers = {
    "Authorization": "Bearer eyJhbGciOiJIUzI1NiIs...",
    "Content-Type": "application/json"
}
response = requests.get("https://api.example.com/data", headers=headers)
```

**Cookie-based authentication** (extracting cookies from a browser):

```python
cookies = {
    "session_id": "abc123def456",
    "auth_token": "xyz789"
}
response = requests.get("https://example.com/protected", cookies=cookies)
```

**Browser-based login** for complex authentication flows (OAuth, multi-step, CAPTCHA on login):

```python
from playwright.sync_api import sync_playwright

with sync_playwright() as p:
    browser = p.chromium.launch(headless=False)
    page = browser.new_page()
    page.goto("https://example.com/login")
    page.fill("#email", "user@example.com")
    page.fill("#password", "password123")
    page.click("button[type='submit']")
    page.wait_for_url("**/dashboard")

    # Save cookies for future use
    cookies = page.context.cookies()
    # Continue scraping in authenticated state
```

Key point for interviews: always mention that you handle CSRF tokens when they are present. Many login forms include a hidden CSRF field that you need to extract from the form page and include in your POST request.

### 12. What are common anti-bot detection methods?

Sites use multiple layers of detection. Understanding them shows depth of knowledge.

**IP-based detection**: Blocking or rate-limiting requests from a single IP address. Mitigated with rotating proxies.

**User-Agent checking**: Rejecting requests with missing, outdated, or bot-like User-Agent strings. Mitigated by rotating realistic User-Agent strings.

**JavaScript challenges**: Requiring the client to execute JavaScript and return a computed token. Cloudflare's "checking your browser" page is the most common example. Mitigated by using a real browser.

**Browser fingerprinting**: Checking navigator properties, WebGL rendering, canvas fingerprint, installed fonts, screen dimensions, and other browser characteristics. Headless browsers have detectable differences from real browsers. Tools like `playwright-stealth` or `undetected-chromedriver` patch common fingerprinting leaks.

**Behavioral analysis**: Tracking mouse movements, scroll patterns, click timing, and navigation paths. Bot behavior is typically more uniform and faster than human behavior.

**CAPTCHAs**: Presenting visual or interactive challenges (reCAPTCHA, hCaptcha) that are difficult for automated systems to solve.

**Honeypot traps**: Invisible links or elements that real users never click but bots follow. Clicking them flags the session as automated.

**TLS fingerprinting**: Analyzing the TLS ClientHello message to identify HTTP client libraries (which have different fingerprints than real browsers). Tools like `curl_cffi` or `httpmorph` can mitigate this.

In an interview, knowing this list and the corresponding mitigations demonstrates practical experience.

### 13. How do you store scraped data? (CSV, JSON, databases)

The choice depends on the data structure, volume, and how it will be consumed.

**CSV**: Best for flat, tabular data. Easy to share and open in spreadsheets. Breaks down with nested or variable-length data.

```python
import csv

with open("products.csv", "w", newline="") as f:
    writer = csv.DictWriter(f, fieldnames=["title", "price", "url"])
    writer.writeheader()
    for product in products:
        writer.writerow(product)
```

**JSON / JSON Lines**: Best for nested or semi-structured data. JSON Lines (one JSON object per line) is better for large datasets because you can append without loading the entire file.

```python
import json

# JSON Lines format -- append-friendly
with open("products.jsonl", "a") as f:
    for product in products:
        f.write(json.dumps(product) + "\n")
```

**SQLite**: Best for medium-scale projects where you need querying capability without setting up a database server.

```python
import sqlite3

conn = sqlite3.connect("scraped_data.db")
cursor = conn.cursor()
cursor.execute("""
    CREATE TABLE IF NOT EXISTS products (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT,
        price REAL,
        url TEXT UNIQUE,
        scraped_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
""")
cursor.executemany(
    "INSERT OR IGNORE INTO products (title, price, url) VALUES (?, ?, ?)",
    [(p["title"], p["price"], p["url"]) for p in products]
)
conn.commit()
```

**PostgreSQL / MySQL**: Best for production systems, concurrent writes, and data that feeds into larger pipelines.

**Cloud storage (S3, GCS)**: Best for large-scale pipelines where scraped data feeds into data warehouses or ML training pipelines. Often combined with Parquet format for efficient columnar storage.

In an interview, explain that you choose the storage based on downstream requirements: who consumes the data, how much of it there is, and whether you need deduplication or incremental updates.

<figure>
  <img src="/assets/img/interview-code-monitor.jpg" alt="Programming code displayed on a computer monitor" loading="lazy">
  <figcaption>Advanced questions test your experience with real-world edge cases. <span class="img-credit">Photo by Daniil Komov / <a href="https://www.pexels.com" target="_blank" rel="noopener noreferrer">Pexels</a></span></figcaption>
</figure>

## Advanced Questions

These test system design, trade-offs, and deep technical knowledge.

### 14. Design a scraper that handles 10,000 pages with retries and error handling

This is a system design question. Walk through the architecture step by step.

```python
import asyncio
import aiohttp
from dataclasses import dataclass
from typing import Optional
import logging
import random

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

@dataclass
class ScrapeResult:
    url: str
    status: int
    data: Optional[dict]
    error: Optional[str]

class ResilientScraper:
    def __init__(self, max_concurrent=20, max_retries=3, base_delay=1.0):
        self.max_concurrent = max_concurrent
        self.max_retries = max_retries
        self.base_delay = base_delay
        self.semaphore = asyncio.Semaphore(max_concurrent)
        self.results = []
        self.failed = []

    async def fetch_with_retry(self, session, url):
        for attempt in range(self.max_retries):
            try:
                async with self.semaphore:
                    async with session.get(url, timeout=aiohttp.ClientTimeout(total=30)) as resp:
                        if resp.status == 200:
                            html = await resp.text()
                            data = self.parse(html)
                            return ScrapeResult(url, 200, data, None)
                        elif resp.status == 429:
                            delay = self.base_delay * (2 ** attempt) + random.uniform(0, 1)
                            logger.warning(f"Rate limited on {url}, retrying in {delay:.1f}s")
                            await asyncio.sleep(delay)
                            continue
                        elif resp.status >= 500:
                            delay = self.base_delay * (2 ** attempt)
                            await asyncio.sleep(delay)
                            continue
                        else:
                            return ScrapeResult(url, resp.status, None, f"HTTP {resp.status}")
            except (aiohttp.ClientError, asyncio.TimeoutError) as e:
                delay = self.base_delay * (2 ** attempt)
                logger.warning(f"Error on {url}: {e}, retry {attempt + 1}/{self.max_retries}")
                await asyncio.sleep(delay)

        return ScrapeResult(url, 0, None, "Max retries exceeded")

    def parse(self, html):
        # Parsing logic here
        return {"raw_length": len(html)}

    async def run(self, urls):
        async with aiohttp.ClientSession() as session:
            tasks = [self.fetch_with_retry(session, url) for url in urls]
            results = await asyncio.gather(*tasks)
            self.results = [r for r in results if r.data is not None]
            self.failed = [r for r in results if r.data is None]
            logger.info(f"Completed: {len(self.results)} success, {len(self.failed)} failed")

# Usage
scraper = ResilientScraper(max_concurrent=20, max_retries=3)
urls = [f"https://example.com/product/{i}" for i in range(10000)]
asyncio.run(scraper.run(urls))
```

Key design points to mention in the interview:

- **Concurrency control**: Use a semaphore to limit simultaneous connections (20 in this example) to avoid overwhelming the server or running out of file descriptors.
- **Exponential backoff**: Double the wait time on each retry, with jitter, to avoid thundering herd problems.
- **Timeout handling**: Set explicit timeouts to avoid hanging on unresponsive servers.
- **Result tracking**: Separate successful and failed results for reporting and potential re-processing.
- **Graceful degradation**: Log failures but continue processing other URLs.

### 15. How do you deal with CAPTCHAs?

There is no single clean answer, which is partly why this question gets asked.

**Avoidance**: The best strategy is to avoid triggering CAPTCHAs in the first place. Use realistic request patterns, rotate IPs and User-Agents, maintain sessions, and respect rate limits.

**Detection**: Check for known CAPTCHA signatures in the response -- reCAPTCHA script tags, hCaptcha iframes, or specific redirect patterns.

**CAPTCHA solving services**: Services like 2Captcha or Anti-Captcha use human workers or ML models to solve CAPTCHAs. You submit the CAPTCHA image or site key and receive a solution token.

```python
import requests

# Submit CAPTCHA to solving service
response = requests.post("https://api.solving-service.com/solve", json={
    "type": "recaptcha_v2",
    "site_key": "6Le-wvkSAAAAAPBMRTvw0Q4Muexq9bi0DJwx_mJ-",
    "page_url": "https://example.com/protected-page"
})
solution = response.json()["solution"]
```

**Browser-based solving**: Use a headed (non-headless) browser and hope that a clean browser fingerprint with realistic behavior avoids the CAPTCHA entirely.

**Re-architecture**: If CAPTCHAs are frequent, question whether you are scraping the right source. Look for APIs, RSS feeds, data partnerships, or alternative data providers.

In an interview, emphasize that CAPTCHAs exist for a reason and your first response should be to evaluate whether you have a legitimate right to access the data.

### 16. Explain browser fingerprinting and how stealth tools work

Browser fingerprinting identifies a browser by collecting dozens of characteristics and combining them into a unique signature. The server-side detection runs JavaScript that checks:

- **Navigator properties**: `navigator.webdriver` (set to `true` in automated browsers), `navigator.plugins`, `navigator.languages`
- **WebGL renderer**: The GPU's renderer string, which varies by hardware
- **Canvas fingerprint**: Drawing to an invisible canvas element and hashing the pixel output -- different systems produce different results
- **Screen properties**: `screen.width`, `screen.height`, `window.outerWidth`, `devicePixelRatio`
- **Font enumeration**: Measuring which fonts are installed by rendering text and checking dimensions
- **AudioContext**: Generating audio signals and comparing the output fingerprint
- **WebRTC**: Detecting local IP addresses

Headless browsers fail multiple checks by default. `navigator.webdriver` is `true`, plugins are empty, and WebGL returns generic renderer strings.

Stealth tools patch these leaks:

```python
# playwright-stealth patches common detection vectors
from playwright.sync_api import sync_playwright
from playwright_stealth import stealth_sync

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    page = browser.new_page()
    stealth_sync(page)
    page.goto("https://bot-detection-test.example.com")
```

Tools like `undetected-chromedriver`, `playwright-stealth`, Camoufox, and nodriver each take different approaches. Some patch JavaScript properties. Others modify the browser binary itself. nodriver connects to the Chrome DevTools Protocol in a way that avoids the automation flags entirely.

The key insight for interviews: fingerprinting is an arms race. Any specific stealth technique has a shelf life, because detection vendors update their checks regularly. The [evolution of web scraping detection methods](/posts/evolution-web-scraping-detection-methods-timeline/) illustrates how rapidly this landscape has changed.

### 17. How would you build a distributed scraping system?

This is a system design question. Outline the components.

**Architecture**:

1. **URL queue**: A message broker like Redis, RabbitMQ, or Kafka holds the list of URLs to scrape. Workers pull URLs from the queue.
2. **Worker pool**: Multiple scraper instances run on separate machines or containers. Each worker pulls a URL, scrapes it, and stores the result.
3. **Proxy management**: A proxy rotation layer assigns different exit IPs to different workers to distribute the load and avoid IP-based blocking.
4. **Result storage**: Scraped data goes to a central store -- a database, S3 bucket, or data warehouse.
5. **Monitoring and coordination**: A dashboard tracks success rates, error rates, queue depth, and throughput.

```text
                    +------------------+
                    |   URL Generator   |
                    +--------+---------+
                             |
                    +--------v---------+
                    |   Message Queue   |
                    |  (Redis / Kafka)  |
                    +--------+---------+
                             |
            +----------------+----------------+
            |                |                |
    +-------v------+  +------v-------+  +-----v--------+
    |   Worker 1   |  |   Worker 2   |  |   Worker N   |
    |  + Proxy A   |  |  + Proxy B   |  |  + Proxy N   |
    +--------------+  +--------------+  +--------------+
            |                |                |
            +----------------+----------------+
                             |
                    +--------v---------+
                    |  Result Storage   |
                    |  (DB / S3 / DW)   |
                    +------------------+
```

**Key considerations**:

- **Deduplication**: Track which URLs have already been scraped to avoid redundant work. Use a Bloom filter or Redis set.
- **Failure handling**: Failed URLs go back into the queue with a retry counter. After N failures, move them to a dead letter queue.
- **Domain-aware scheduling**: Assign URLs from the same domain to the same worker or enforce per-domain rate limits globally.
- **Checkpointing**: Periodically save progress so the system can resume after a crash without restarting from scratch.

For the interview, mention that tools like Scrapy-Redis, Celery, or cloud-native solutions (AWS Lambda + SQS) can implement this pattern without building everything from scratch.

### 18. What are the legal considerations of web scraping?

This is a question where interviewers want to see awareness, not legal expertise.

**Key legal frameworks**:

- **Computer Fraud and Abuse Act (CFAA)** in the US: Accessing a computer system "without authorization" can be a criminal offense. The scope of this for web scraping is debated and has been litigated multiple times.
- **GDPR** in Europe: If you scrape personal data of EU residents, you are subject to GDPR obligations including having a lawful basis for processing.
- **Terms of Service**: Violating a website's ToS can be grounds for breach of contract claims, depending on jurisdiction.
- **Copyright**: The content you scrape may be copyrighted. Scraping it is one thing; republishing it is another.

**Key court cases to know**:

- **hiQ Labs v. LinkedIn (2022)**: The Ninth Circuit ruled that scraping publicly available data did not violate the CFAA. This was a significant win for scrapers but is limited in scope.
- **Meta v. Bright Data (2024)**: A ruling that addressed scraping of logged-in content and found potential CFAA violations for data behind authentication.

**Practical guidelines for interviews**:

- Always check and respect `robots.txt`
- Do not scrape data behind login walls without explicit permission
- Do not overwhelm servers with requests
- Be careful with personal data
- Consult legal counsel for commercial scraping operations
- Consider whether an official API or data partnership exists

### 19. How do you handle character encoding issues?

Character encoding problems are one of the most common causes of garbled data in scraped results. The issue arises when the scraper interprets bytes using the wrong encoding.

**The problem**: A server sends bytes. Those bytes only become text when decoded using the correct encoding (UTF-8, ISO-8859-1, Windows-1252, etc.). If you decode with the wrong encoding, you get mojibake -- garbled characters like `Ã©` instead of `e`.

**Detection strategy**:

```python
import requests
import chardet

response = requests.get("https://example.com", stream=True)
raw_content = response.content

# 1. Check HTTP Content-Type header
content_type = response.headers.get("Content-Type", "")
# e.g., "text/html; charset=utf-8"

# 2. Check HTML meta tag
# <meta charset="UTF-8">
# <meta http-equiv="Content-Type" content="text/html; charset=iso-8859-1">

# 3. Auto-detect with chardet
detected = chardet.detect(raw_content)
print(detected)
# {'encoding': 'utf-8', 'confidence': 0.99, 'language': ''}

# 4. Decode with the detected encoding
text = raw_content.decode(detected["encoding"])
```

**The `requests` library approach**: `response.text` uses the encoding from the Content-Type header, falling back to ISO-8859-1 for `text/*` content types (per HTTP spec). This default is often wrong for HTML pages. You can override it:

```python
response = requests.get("https://example.com")
response.encoding = response.apparent_encoding  # Uses chardet internally
text = response.text
```

**Best practices**:

- Always decode from `response.content` (bytes) rather than trusting `response.text` when you see encoding issues
- Use `chardet` or `charset-normalizer` for detection
- Normalize to UTF-8 as early as possible in your pipeline
- Test with pages that contain accented characters, CJK characters, or special symbols

### 20. Compare synchronous vs asynchronous scraping approaches

**Synchronous scraping** processes one request at a time. The program waits for each response before sending the next request.

```python
import requests
import time

urls = [f"https://example.com/page/{i}" for i in range(100)]

start = time.time()
results = []
for url in urls:
    response = requests.get(url)
    results.append(response.text)
elapsed = time.time() - start
print(f"Synchronous: {elapsed:.1f}s")
# Typical: ~100 seconds (1 second per request)
```

**Asynchronous scraping** sends multiple requests concurrently using an event loop. While one request waits for a response, others can be in flight.

```python
import asyncio
import aiohttp
import time

async def fetch(session, url):
    async with session.get(url) as response:
        return await response.text()

async def main():
    urls = [f"https://example.com/page/{i}" for i in range(100)]
    async with aiohttp.ClientSession() as session:
        tasks = [fetch(session, url) for url in urls]
        results = await asyncio.gather(*tasks)
    return results

start = time.time()
results = asyncio.run(main())
elapsed = time.time() - start
print(f"Asynchronous: {elapsed:.1f}s")
# Typical: ~5 seconds (all requests overlap)
```

**Performance comparison**:

| Aspect | Synchronous | Asynchronous |
|--------|-------------|--------------|
| Speed (100 pages) | ~100 seconds | ~5 seconds |
| Code complexity | Simple | Moderate |
| Debugging | Easy | Harder |
| Memory usage | Low | Moderate |
| Best for | Small jobs, prototyping | Large-scale production |

**Threading** is a middle ground -- use `concurrent.futures.ThreadPoolExecutor` for concurrent I/O without async/await syntax:

```python
from concurrent.futures import ThreadPoolExecutor, as_completed
import requests

def fetch(url):
    return requests.get(url).text

urls = [f"https://example.com/page/{i}" for i in range(100)]

with ThreadPoolExecutor(max_workers=20) as executor:
    futures = {executor.submit(fetch, url): url for url in urls}
    results = []
    for future in as_completed(futures):
        results.append(future.result())
```

In an interview, explain that asynchronous scraping gives you massive throughput improvements but needs to be paired with rate limiting to avoid overwhelming the target server. Faster does not mean you should ignore polite scraping practices.

## Tips for the Interview

Beyond knowing the technical answers, interviewers evaluate how you think about scraping problems holistically. Keep these principles in mind.

**Lead with ethics.** When asked about any scraping technique, mention the ethical dimension first. "I would check robots.txt, review the terms of service, and ensure we have a legitimate use case before writing any code." This signals maturity.

**Show you think about failure.** Every answer about scraping architecture should include error handling, retries, and graceful degradation. Production scrapers break constantly -- sites change their HTML, introduce new anti-bot measures, or go down temporarily. Interviewers want to know you plan for this.

**Demonstrate scale awareness.** Even if the question is about scraping a single page, briefly mention how your approach would change at 1,000 pages or 100,000 pages. This shows you think beyond the immediate problem.

**Know your tools but do not be married to them.** If asked "how would you scrape X," start with the simplest approach that could work. "I would first check if there is an API. If not, I would try requests plus BeautifulSoup on the raw HTML. If the content is JavaScript-rendered, I would look for the underlying XHR calls. Only if none of that works would I bring in a headless browser." This shows pragmatic decision-making.

**Understand the data pipeline.** Scraping is rarely the end goal. The data feeds into something -- a database, a dashboard, an ML model, a search index. Show that you think about data quality, deduplication, schema validation, and delivery to downstream consumers.

**Practice with real sites.** Sites like [books.toscrape.com](https://books.toscrape.com), [quotes.toscrape.com](https://quotes.toscrape.com), and [httpbin.org](https://httpbin.org) are built specifically for scraping practice. Use them to build sample projects you can discuss in the interview.

## Final Thoughts

Web scraping interviews test a unique combination of skills: HTTP fundamentals, HTML parsing, browser internals, system design, Python programming, and ethical judgment. The questions above cover the territory that most interviewers explore. If you can answer each one with specific examples, code where appropriate, and an awareness of trade-offs, you will stand out.

Prepare by building actual scrapers, not just reading about them. The difference between a candidate who has built a production scraper that handles retries, rotating proxies, and data validation versus one who has only written tutorial-level code is immediately obvious in a technical interview.
