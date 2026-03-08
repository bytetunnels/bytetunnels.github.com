---
title: "Web Scraping with HTTPX: Async HTTP for Fast Data Collection"
date: 2026-02-15 14:00:00 +0000
categories: ["Web Scraping"]
tags: ["httpx", "python", "async", "http client", "web scraping", "performance", "aiohttp"]
author: arman
image:
  path: /assets/img/2026-02-15-web-scraping-httpx-async-http-fast-data-collection-hero.jpg
  alt: "Web Scraping with HTTPX: Async HTTP for Fast Data Collection"
---

HTTPX is a modern Python HTTP client that supports both synchronous and asynchronous requests out of the box. If you have ever used the `requests` library, the API will feel immediately familiar -- but HTTPX goes further by adding native `asyncio` support, HTTP/2 capability, and connection pooling that makes it one of the best choices for high-performance web scraping in Python. This post walks through everything you need to start scraping with HTTPX, from basic synchronous calls to a full async scraper with rate limiting and error handling.

## Why HTTPX Over Requests

The `requests` library has been the default Python HTTP client for over a decade. Our [Python requests vs Selenium speed comparison](/posts/python-requests-vs-selenium-speed-performance-comparison/) quantifies exactly where that library hits its limits. It works fine for simple scripts that fetch a handful of pages. But it has a fundamental limitation: it is synchronous. Every call to `requests.get()` blocks the entire thread until the response comes back. If you need to scrape 500 pages and each request takes 200 milliseconds, you are looking at 100 seconds of wall-clock time with no way around it (short of threading, which brings its own headaches).

HTTPX solves this with a dual API. The synchronous interface mirrors `requests` almost exactly, so you can switch with minimal code changes. The async interface lets you fire off dozens or hundreds of requests concurrently using `asyncio`, collapsing that 100-second job into a few seconds.

Here is a quick comparison of what HTTPX brings to the table:

| Feature | requests | HTTPX |
|---|---|---|
| Sync API | Yes | Yes |
| Async API | No | Yes |
| HTTP/2 | No | Yes |
| Connection pooling | Session object | Client/AsyncClient |
| Timeout granularity | Single value | Connect, read, write, pool |
| Proxy support | Yes | Yes |
| Streaming | Yes | Yes |
| Type hints | Partial | Full |

The API compatibility means you can often do a find-and-replace from `requests` to `httpx` and have working code. The async support means you can then rewrite the hot path for concurrency without switching to a completely different library like `aiohttp`.

## Installation

Install HTTPX with pip:

```bash
pip install httpx
```

If you want HTTP/2 support, install the optional dependency:

```bash
pip install httpx[http2]
```

For parsing HTML responses, you will also want BeautifulSoup or lxml:

```bash
pip install beautifulsoup4 lxml
```

## Synchronous Usage

If you are coming from `requests`, the synchronous API will feel like home. The function signatures are nearly identical.

### Quick One-Off Requests

```python
import httpx

response = httpx.get("https://example.com")
print(response.status_code)
print(response.text[:200])
```

Just like `requests`, you get back a `Response` object with `.status_code`, `.text`, `.content`, `.json()`, and `.headers`. The top-level functions -- `httpx.get()`, `httpx.post()`, `httpx.put()`, `httpx.delete()` -- work exactly as you would expect.

### Using httpx.Client for Session Management

For scraping, you should almost always use `httpx.Client()` instead of the top-level functions. A client maintains a connection pool, persists cookies across requests, and lets you set default headers once instead of repeating them on every call.

```python
import httpx

with httpx.Client() as client:
    # Set default headers once
    client.headers.update({
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        "Accept-Language": "en-US,en;q=0.9",
    })

    # First request -- cookies are stored automatically
    response = client.get("https://example.com/login")
    print(f"Status: {response.status_code}")

    # Second request -- cookies from the first request are sent along
    response = client.get("https://example.com/dashboard")
    print(f"Dashboard status: {response.status_code}")
```

The `with` block ensures the client and its connection pool are properly closed when you are done. You can also call `client.close()` manually if the context manager pattern does not fit your code.

## Async Usage for Concurrent Scraping

This is where HTTPX shines. The `AsyncClient` has the same API as `Client`, but every request method is a coroutine that you `await`. Combined with `asyncio.gather()`, you can fetch many pages at once.

### Basic Async Example

```python
import httpx
import asyncio

async def fetch_page(client, url):
    response = await client.get(url)
    return response.text

async def main():
    async with httpx.AsyncClient() as client:
        urls = [
            "https://example.com/page/1",
            "https://example.com/page/2",
            "https://example.com/page/3",
        ]
        tasks = [fetch_page(client, url) for url in urls]
        results = await asyncio.gather(*tasks)

        for i, html in enumerate(results):
            print(f"Page {i+1}: {len(html)} characters")

asyncio.run(main())
```

All three requests are sent concurrently. Instead of waiting for each one to finish before starting the next, `asyncio.gather()` fires them all off and waits for all of them to complete.

### Scraping 10 Pages Concurrently

Here is a more realistic example that scrapes product listing pages and extracts titles:

```python
import httpx
import asyncio
from bs4 import BeautifulSoup

async def scrape_page(client, url):
    response = await client.get(url)
    if response.status_code != 200:
        print(f"Failed: {url} (status {response.status_code})")
        return []

    soup = BeautifulSoup(response.text, "lxml")
    titles = [h2.get_text(strip=True) for h2 in soup.select("h2.product-title")]
    return titles

async def main():
    base_url = "https://example.com/products?page="
    urls = [f"{base_url}{i}" for i in range(1, 11)]

    async with httpx.AsyncClient() as client:
        client.headers.update({
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        })

        tasks = [scrape_page(client, url) for url in urls]
        results = await asyncio.gather(*tasks)

    all_titles = []
    for page_titles in results:
        all_titles.extend(page_titles)

    print(f"Scraped {len(all_titles)} product titles from 10 pages")
    for title in all_titles[:5]:
        print(f"  - {title}")

asyncio.run(main())
```

Ten pages that would take two seconds sequentially (at 200ms each) now complete in roughly 200ms total -- the time of the slowest single request.

## Connection Pooling

Both `Client` and `AsyncClient` maintain a pool of open connections. When you make a request to a host you have already connected to, HTTPX reuses the existing TCP connection instead of opening a new one. This eliminates the overhead of the TCP handshake and TLS negotiation on every request.

```python
import httpx

# Without a client -- new connection for every request
for i in range(100):
    response = httpx.get(f"https://example.com/page/{i}")  # Slow: new connection each time

# With a client -- connections are reused
with httpx.Client() as client:
    for i in range(100):
        response = client.get(f"https://example.com/page/{i}")  # Fast: connection reuse
```

You can control the pool size to match your concurrency needs:

```python
import httpx

limits = httpx.Limits(
    max_keepalive_connections=20,
    max_connections=100,
)

async with httpx.AsyncClient(limits=limits) as client:
    # Up to 100 simultaneous connections, 20 kept alive between bursts
    pass
```

The default limits are 20 keepalive connections and 100 max connections. For most scraping jobs, these defaults are fine. If you are hitting a single domain hard, you might want to increase `max_keepalive_connections`. If you are scraping across many domains, `max_connections` is the one to watch.


<figure>
  <img src="/assets/img/inline-web-scraping-httpx-async-http-fast-data--1.jpg" alt="HTTP is the language every scraper must speak fluently." loading="lazy">
  <figcaption>HTTP is the language every scraper must speak fluently. <span class="img-credit">Photo by Google DeepMind / <a href="https://www.pexels.com" target="_blank" rel="noopener noreferrer">Pexels</a></span></figcaption>
</figure>

## HTTP/2 Support

HTTP/2 allows multiple requests to be multiplexed over a single TCP connection. Some websites serve responses faster over HTTP/2, and using it can reduce the number of connections your scraper needs to open.

```python
import httpx

async with httpx.AsyncClient(http2=True) as client:
    response = await client.get("https://example.com")
    print(f"HTTP version: {response.http_version}")
    print(f"Status: {response.status_code}")
```

Not every server supports HTTP/2. HTTPX handles this gracefully -- if the server does not support HTTP/2, it falls back to HTTP/1.1 automatically. You do not need to add any conditional logic.

Remember to install the HTTP/2 dependency:

```bash
pip install httpx[http2]
```

This pulls in the `h2` library that handles the HTTP/2 protocol framing.

## Custom Headers, Cookies, and Proxies

### Headers

Setting headers is essential for scraping. Most websites check the `User-Agent` header and block requests from libraries that identify themselves as bots. Beyond headers, [TLS fingerprinting](/posts/httpmorph-solving-tls-fingerprinting-with-a-c-native-python-http-client/) is another layer that can expose HTTP clients even when the user agent looks legitimate.

```python
import httpx

headers = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.9",
    "Accept-Encoding": "gzip, deflate, br",
    "Referer": "https://example.com/",
}

with httpx.Client(headers=headers) as client:
    response = client.get("https://example.com/products")
    print(response.status_code)
```

Headers passed to the `Client` constructor are sent with every request. You can override them on individual requests by passing a `headers` argument to `.get()` or `.post()`.

### Cookies

You can pass cookies explicitly or let the client manage them automatically:

```python
import httpx

# Pass cookies explicitly
cookies = {"session_id": "abc123", "locale": "en_US"}

with httpx.Client(cookies=cookies) as client:
    response = client.get("https://example.com/account")

    # Cookies returned by the server are stored automatically
    print(client.cookies)
```

### Proxies

HTTPX supports HTTP and SOCKS proxies:

```python
import httpx

# Single proxy for all traffic
with httpx.Client(proxy="http://proxy.example.com:8080") as client:
    response = client.get("https://example.com")

# Authenticated proxy
with httpx.Client(proxy="http://user:pass@proxy.example.com:8080") as client:
    response = client.get("https://example.com")
```

For async scraping through a proxy:

```python
import httpx
import asyncio

async def main():
    async with httpx.AsyncClient(proxy="http://proxy.example.com:8080") as client:
        response = await client.get("https://example.com")
        print(response.status_code)

asyncio.run(main())
```

## Timeout Configuration

HTTPX provides granular timeout control. This matters for scraping because slow or unresponsive pages should not hang your entire scraper.

```python
import httpx

# Simple timeout -- applies to the entire request
with httpx.Client(timeout=10.0) as client:
    response = client.get("https://example.com")

# Granular timeouts
timeout = httpx.Timeout(
    connect=5.0,    # Time to establish the TCP connection
    read=10.0,      # Time to receive the response body
    write=5.0,      # Time to send the request body
    pool=5.0,       # Time to wait for a connection from the pool
)

with httpx.Client(timeout=timeout) as client:
    response = client.get("https://example.com")
```

For scraping, the `read` timeout is the most important one. Some pages return headers quickly but stream the body slowly. A 10-second read timeout with a 5-second connect timeout is a reasonable starting point.

To disable timeouts entirely (not recommended for production scrapers):

```python
import httpx

with httpx.Client(timeout=None) as client:
    response = client.get("https://slow-site.example.com")
```

## Retry Logic

HTTPX does not include built-in retry functionality. This is a deliberate design choice -- retries involve policy decisions (which status codes to retry, how long to wait, how many times to try) that the library leaves to you. Here are two approaches.

### Manual Retry Loop

```python
import httpx
import asyncio

async def fetch_with_retry(client, url, max_retries=3, backoff_factor=1.0):
    for attempt in range(max_retries):
        try:
            response = await client.get(url)
            if response.status_code == 200:
                return response
            if response.status_code in (429, 500, 502, 503, 504):
                wait_time = backoff_factor * (2 ** attempt)
                print(f"Retrying {url} in {wait_time}s (status {response.status_code})")
                await asyncio.sleep(wait_time)
                continue
            return response  # Non-retryable status code
        except (httpx.ConnectTimeout, httpx.ReadTimeout, httpx.ConnectError) as e:
            wait_time = backoff_factor * (2 ** attempt)
            print(f"Retrying {url} in {wait_time}s ({type(e).__name__})")
            await asyncio.sleep(wait_time)

    print(f"Failed after {max_retries} retries: {url}")
    return None
```

### Using Tenacity

The `tenacity` library provides a decorator-based approach with more features:

```python
import httpx
from tenacity import retry, stop_after_attempt, wait_exponential, retry_if_exception_type

@retry(
    stop=stop_after_attempt(3),
    wait=wait_exponential(multiplier=1, min=1, max=10),
    retry=retry_if_exception_type((httpx.ConnectTimeout, httpx.ReadTimeout, httpx.ConnectError)),
)
def fetch_page(client, url):
    response = client.get(url)
    response.raise_for_status()
    return response

with httpx.Client() as client:
    try:
        response = fetch_page(client, "https://example.com/flaky-endpoint")
        print(response.text)
    except Exception as e:
        print(f"All retries exhausted: {e}")
```

Install tenacity with `pip install tenacity`. The `wait_exponential` strategy doubles the wait between each attempt, which is the standard approach for being polite to servers that are under load.


<figure>
  <img src="/assets/img/inline-web-scraping-httpx-async-http-fast-data--2.jpg" alt="Requests and responses are the conversation between your scraper and the server." loading="lazy">
  <figcaption>Requests and responses are the conversation between your scraper and the server. <span class="img-credit">Photo by RDNE Stock project / <a href="https://www.pexels.com" target="_blank" rel="noopener noreferrer">Pexels</a></span></figcaption>
</figure>

## Combining HTTPX with Parsers

HTTPX handles the HTTP layer. You still need a parser to extract data from the HTML. The two most common choices are BeautifulSoup and lxml.

### HTTPX with BeautifulSoup

```python
import httpx
from bs4 import BeautifulSoup

with httpx.Client() as client:
    response = client.get("https://example.com/products")
    soup = BeautifulSoup(response.text, "lxml")

    products = []
    for card in soup.select("div.product-card"):
        name = card.select_one("h2.product-name")
        price = card.select_one("span.price")
        if name and price:
            products.append({
                "name": name.get_text(strip=True),
                "price": price.get_text(strip=True),
            })

    for product in products[:5]:
        print(f"{product['name']}: {product['price']}")
```

### HTTPX with lxml

If parsing speed is critical (you are processing thousands of pages), use lxml directly instead of going through BeautifulSoup:

```python
import httpx
from lxml import html

with httpx.Client() as client:
    response = client.get("https://example.com/products")
    tree = html.fromstring(response.text)

    names = tree.xpath("//h2[@class='product-name']/text()")
    prices = tree.xpath("//span[@class='price']/text()")

    for name, price in zip(names, prices):
        print(f"{name.strip()}: {price.strip()}")
```

lxml's XPath support is powerful for complex extraction patterns. For pages where the structure is too messy for CSS or XPath selectors, [regex-based extraction](/posts/regex-for-web-scraping-extracting-data-without-parser/) can be a viable alternative, and for pulling out [email addresses specifically](/posts/email-regex-patterns-web-scraping-reliable-extraction/) regex is often the most practical tool. For most scraping tasks, BeautifulSoup with the `lxml` backend is a good middle ground -- you get the readable CSS selector API of BeautifulSoup with the parsing speed of lxml.

## HTTPX vs aiohttp

Both HTTPX and aiohttp support async HTTP. How do they compare for scraping?

**aiohttp** is a mature async HTTP client that has been around since 2014. It is slightly faster than HTTPX in raw throughput benchmarks because it was designed from the ground up for async I/O. It uses `aiohttp.ClientSession` for connection pooling and has a well-tested ecosystem.

**HTTPX** is newer and trades a small amount of speed for a significantly nicer developer experience. The API matches `requests`, which most Python developers already know. It supports both sync and async in a single library, so you can prototype synchronously and switch to async when you need speed.

```python
# aiohttp approach
import aiohttp
import asyncio

async def fetch_aiohttp(session, url):
    async with session.get(url) as response:
        return await response.text()

async def main():
    async with aiohttp.ClientSession() as session:
        html = await fetch_aiohttp(session, "https://example.com")

# httpx approach
import httpx
import asyncio

async def fetch_httpx(client, url):
    response = await client.get(url)
    return response.text

async def main():
    async with httpx.AsyncClient() as client:
        html = await fetch_httpx(client, "https://example.com")
```

Notice the difference: aiohttp requires a context manager around the response (`async with session.get(...) as response`), while HTTPX returns the response directly. This is a small thing, but it adds up across a large codebase.

For most scraping projects, the speed difference between HTTPX and aiohttp is negligible -- network latency dominates. Choose HTTPX if you want a cleaner API and the option to use sync mode. Choose aiohttp if you are building a high-throughput system where every millisecond counts and you are comfortable with its API.

## Rate Limiting with asyncio.Semaphore

Firing off hundreds of requests simultaneously will get you blocked. Servers interpret sudden traffic spikes as abuse, and anti-bot systems will flag your IP. You need rate limiting.

The simplest approach uses `asyncio.Semaphore` to cap the number of concurrent requests:

```python
import httpx
import asyncio

async def fetch_with_limit(client, url, semaphore):
    async with semaphore:
        response = await client.get(url)
        return url, response.status_code, response.text

async def main():
    semaphore = asyncio.Semaphore(5)  # Max 5 concurrent requests
    urls = [f"https://example.com/page/{i}" for i in range(1, 51)]

    async with httpx.AsyncClient() as client:
        tasks = [fetch_with_limit(client, url, semaphore) for url in urls]
        results = await asyncio.gather(*tasks)

    for url, status, html in results:
        print(f"{url}: {status} ({len(html)} chars)")

asyncio.run(main())
```

This fires off all 50 tasks, but the semaphore ensures only 5 are actively waiting for a response at any given time. The rest queue up and execute as slots become available.

For stricter rate limiting -- say, no more than 10 requests per second -- you need a token bucket or a simple sleep:

```python
import httpx
import asyncio
import time

class RateLimiter:
    def __init__(self, requests_per_second):
        self.rate = requests_per_second
        self.semaphore = asyncio.Semaphore(requests_per_second)
        self.interval = 1.0 / requests_per_second

    async def acquire(self):
        await self.semaphore.acquire()
        asyncio.get_running_loop().call_later(self.interval, self.semaphore.release)

async def fetch_rate_limited(client, url, limiter):
    await limiter.acquire()
    response = await client.get(url)
    return url, response.status_code, response.text

async def main():
    limiter = RateLimiter(requests_per_second=10)
    urls = [f"https://example.com/page/{i}" for i in range(1, 101)]

    async with httpx.AsyncClient() as client:
        tasks = [fetch_rate_limited(client, url, limiter) for url in urls]
        results = await asyncio.gather(*tasks)

    successful = sum(1 for _, status, _ in results if status == 200)
    print(f"Completed: {successful}/{len(urls)} successful")

asyncio.run(main())
```

## Complete Example: Async Scraper with Everything

Here is a production-style scraper that combines everything covered in this post: async requests, rate limiting, retries, error handling, and BeautifulSoup parsing.

```python
import httpx
import asyncio
from bs4 import BeautifulSoup
from dataclasses import dataclass, field
import json
import time

@dataclass
class ScrapedProduct:
    name: str
    price: str
    url: str
    description: str = ""

@dataclass
class ScrapeResult:
    products: list = field(default_factory=list)
    errors: list = field(default_factory=list)
    pages_scraped: int = 0
    duration: float = 0.0

async def fetch_with_retry(client, url, semaphore, max_retries=3):
    """Fetch a URL with rate limiting and retry logic."""
    for attempt in range(max_retries):
        async with semaphore:
            try:
                response = await client.get(url)
                if response.status_code == 200:
                    return response
                if response.status_code == 429:
                    retry_after = int(response.headers.get("Retry-After", 5))
                    print(f"Rate limited on {url}, waiting {retry_after}s")
                    await asyncio.sleep(retry_after)
                    continue
                if response.status_code in (500, 502, 503, 504):
                    wait_time = 2 ** attempt
                    print(f"Server error {response.status_code} on {url}, retry in {wait_time}s")
                    await asyncio.sleep(wait_time)
                    continue
                print(f"Unexpected status {response.status_code} for {url}")
                return None
            except (httpx.ConnectTimeout, httpx.ReadTimeout) as e:
                wait_time = 2 ** attempt
                print(f"Timeout on {url} ({type(e).__name__}), retry in {wait_time}s")
                await asyncio.sleep(wait_time)
            except httpx.ConnectError as e:
                print(f"Connection error on {url}: {e}")
                return None

    print(f"All retries exhausted for {url}")
    return None

def parse_product_page(html, url):
    """Extract product data from HTML using BeautifulSoup."""
    soup = BeautifulSoup(html, "lxml")
    products = []

    for card in soup.select("div.product-card"):
        name_el = card.select_one("h2.product-name")
        price_el = card.select_one("span.price")
        desc_el = card.select_one("p.description")

        if name_el and price_el:
            products.append(ScrapedProduct(
                name=name_el.get_text(strip=True),
                price=price_el.get_text(strip=True),
                url=url,
                description=desc_el.get_text(strip=True) if desc_el else "",
            ))

    return products

async def scrape_page(client, url, semaphore):
    """Scrape a single page: fetch, parse, return products."""
    response = await fetch_with_retry(client, url, semaphore)
    if response is None:
        return [], url  # Return empty results and the failed URL

    products = parse_product_page(response.text, url)
    return products, None  # Return products and no error

async def run_scraper(base_url, total_pages, max_concurrent=5):
    """Run the full scraping pipeline."""
    start_time = time.perf_counter()
    result = ScrapeResult()
    semaphore = asyncio.Semaphore(max_concurrent)

    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9",
    }

    timeout = httpx.Timeout(connect=5.0, read=15.0, write=5.0, pool=5.0)

    async with httpx.AsyncClient(
        headers=headers,
        timeout=timeout,
        follow_redirects=True,
        http2=True,
    ) as client:
        urls = [f"{base_url}?page={i}" for i in range(1, total_pages + 1)]
        tasks = [scrape_page(client, url, semaphore) for url in urls]
        page_results = await asyncio.gather(*tasks)

    for products, error_url in page_results:
        if error_url:
            result.errors.append(error_url)
        else:
            result.products.extend(products)
            result.pages_scraped += 1

    result.duration = time.perf_counter() - start_time
    return result

def main():
    base_url = "https://example.com/products"
    total_pages = 20
    max_concurrent = 5

    print(f"Scraping {total_pages} pages from {base_url}")
    print(f"Max concurrent requests: {max_concurrent}")
    print()

    result = asyncio.run(run_scraper(base_url, total_pages, max_concurrent))

    print(f"Pages scraped: {result.pages_scraped}/{total_pages}")
    print(f"Products found: {len(result.products)}")
    print(f"Errors: {len(result.errors)}")
    print(f"Duration: {result.duration:.2f}s")

    if result.errors:
        print(f"\nFailed URLs:")
        for url in result.errors:
            print(f"  {url}")

    if result.products:
        print(f"\nSample products:")
        for product in result.products[:5]:
            print(f"  {product.name} - {product.price}")

    # Save results to JSON
    output = {
        "pages_scraped": result.pages_scraped,
        "total_products": len(result.products),
        "duration_seconds": round(result.duration, 2),
        "products": [
            {
                "name": p.name,
                "price": p.price,
                "url": p.url,
                "description": p.description,
            }
            for p in result.products
        ],
    }

    with open("products.json", "w") as f:
        json.dump(output, f, indent=2)

    print(f"\nResults saved to products.json")

if __name__ == "__main__":
    main()
```

This scraper handles the common failure modes you will encounter: timeouts, server errors, rate limiting (HTTP 429), and connection failures. The semaphore keeps concurrency in check, and the exponential backoff gives struggling servers time to recover.

## Key Takeaways

HTTPX sits in a sweet spot for Python web scraping. It is not the absolute fastest async client (aiohttp edges it out in raw benchmarks), and it is not the simplest tool for quick one-off scripts (plain `requests` is still fine for that). But for any project that starts simple and needs to scale -- which describes most scraping projects -- HTTPX is hard to beat.

The pattern to remember is straightforward:

1. Start with `httpx.Client()` for synchronous prototyping.
2. Switch to `httpx.AsyncClient()` when you need speed.
3. Add `asyncio.Semaphore` for rate limiting.
4. Wrap requests in a retry loop for resilience.
5. Pair with BeautifulSoup or lxml for parsing.

That five-step pattern will handle the vast majority of HTTP-level scraping tasks. When you eventually hit sites that require JavaScript rendering, you will need to bring in a browser automation tool like Playwright or Selenium -- but for the many sites that serve their data in plain HTML responses, HTTPX with async is all you need. If the data you need is buried inside JavaScript-rendered pages, an [LLM-based structured data extraction](/posts/best-llm-structured-data-extraction-html-2026/) pipeline can automate the parsing step after the page is fetched.
