---
title: "CSS Selectors in Python: Libraries and Usage Patterns"
date: 2026-02-11 14:00:00 +0000
categories: ["Data Extraction"]
tags: ["css selectors", "python", "beautifulsoup", "lxml", "parsel", "selectolax", "web scraping"]
author: arman
image:
  path: /assets/img/2026-02-11-css-selectors-python-libraries-usage-patterns-hero.png
  alt: "CSS Selectors in Python: Libraries and Usage Patterns"
---

Python has multiple libraries that let you query HTML with CSS selectors, but they are not interchangeable. BeautifulSoup is the most approachable. lxml compiles selectors to XPath and runs them at C speed. Parsel wraps lxml with a Scrapy-friendly API. Selectolax skips the Python overhead entirely with a C-based parser. Each has a different API, different selector support, and very different performance characteristics. If you prefer skipping the parser entirely and going straight to pattern matching, there is also the option of [using regex for extraction](/posts/regex-for-web-scraping-extracting-data-without-parser/). This post walks through all four libraries, runs the same extraction task on each, and gives you a clear framework for choosing the right one.

## The Sample HTML

Every example in this post uses the same HTML so you can compare the libraries directly:

```html
<html>
<head><title>Book Catalog</title></head>
<body>
  <div class="catalog">
    <div class="book" data-genre="fiction">
      <h2 class="title">The Great Gatsby</h2>
      <span class="author">F. Scott Fitzgerald</span>
      <span class="price">$12.99</span>
      <a href="/books/gatsby">Details</a>
    </div>
    <div class="book" data-genre="science">
      <h2 class="title">A Brief History of Time</h2>
      <span class="author">Stephen Hawking</span>
      <span class="price">$15.99</span>
      <a href="/books/brief-history">Details</a>
    </div>
    <div class="book featured" data-genre="fiction">
      <h2 class="title">1984</h2>
      <span class="author">George Orwell</span>
      <span class="price">$10.99</span>
      <a href="/books/1984">Details</a>
    </div>
    <div class="book" data-genre="biography">
      <h2 class="title">Steve Jobs</h2>
      <span class="author">Walter Isaacson</span>
      <span class="price">$18.99</span>
      <a href="/books/steve-jobs">Details</a>
    </div>
  </div>
</body>
</html>
```

The goal for every library: extract the title, author, price, and detail link for each book.

## BeautifulSoup

BeautifulSoup is the default choice for most Python developers. It ships with two CSS selector methods: `select()` returns a list of all matches, and `select_one()` returns the first match or `None`.

### Installation

```bash
pip install beautifulsoup4 lxml
```

Installing `lxml` alongside BeautifulSoup is recommended because it makes parsing faster. Without it, BeautifulSoup falls back to Python's built-in `html.parser`, which is significantly slower.

### Usage

```python
from bs4 import BeautifulSoup

html = open("books.html").read()
soup = BeautifulSoup(html, "lxml")

books = soup.select("div.book")

for book in books:
    title = book.select_one("h2.title").get_text()
    author = book.select_one("span.author").get_text()
    price = book.select_one("span.price").get_text()
    link = book.select_one("a")["href"]
    print(f"{title} by {author} - {price} ({link})")
```

Output:

```
The Great Gatsby by F. Scott Fitzgerald - $12.99 (/books/gatsby)
A Brief History of Time by Stephen Hawking - $15.99 (/books/brief-history)
1984 by George Orwell - $10.99 (/books/1984)
Steve Jobs by Walter Isaacson - $18.99 (/books/steve-jobs)
```

### Key Methods

```python
# All matches
elements = soup.select("div.book")           # list of Tag objects

# First match
element = soup.select_one("div.book")        # single Tag or None

# Text content
text = element.get_text()                     # "The Great Gatsby"
text = element.get_text(strip=True)           # strips whitespace

# Attributes
href = element["href"]                        # raises KeyError if missing
href = element.get("href")                    # returns None if missing
```

When you call `select()` on a `Tag` object instead of the top-level `soup`, the search is scoped to that element's descendants. This is how the loop above works -- each `book.select_one()` only searches within that book's div.

## lxml.cssselect

lxml is the speed king. It parses HTML into a C-backed element tree and converts CSS selectors into XPath expressions under the hood. This means you get the readability of CSS with the performance of compiled XPath.

### Installation

```bash
pip install lxml cssselect
```

The `cssselect` package is required for CSS selector support. lxml's core XPath engine does not depend on it, so you need both.

### Usage

```python
from lxml import html

tree = html.fromstring(open("books.html").read())

books = tree.cssselect("div.book")

for book in books:
    title = book.cssselect("h2.title")[0].text_content()
    author = book.cssselect("span.author")[0].text_content()
    price = book.cssselect("span.price")[0].text_content()
    link = book.cssselect("a")[0].get("href")
    print(f"{title} by {author} - {price} ({link})")
```

### Pre-Compiled Selectors

For repeated queries, compile the selector once with the `CSSSelector` class:

```python
from lxml.cssselect import CSSSelector

sel_books = CSSSelector("div.book")
sel_title = CSSSelector("h2.title")

tree = html.fromstring(open("books.html").read())

for book in sel_books(tree):
    title = sel_title(book)[0].text_content()
```

Pre-compiling avoids the CSS-to-XPath translation on every call. For scripts that parse thousands of pages with the same selectors, this saves measurable time.

### XPath Fallback

The real power of lxml is that you can mix CSS selectors and XPath in the same script. When a CSS selector cannot express what you need, switch to XPath without changing libraries:

```python
# CSS for simple queries
titles = tree.cssselect("h2.title")

# XPath for complex queries CSS cannot express
fiction_titles = tree.xpath(
    '//div[contains(@class, "book") and @data-genre="fiction"]'
    '/h2[@class="title"]/text()'
)
```

## Parsel

Parsel is the selector library extracted from Scrapy. It wraps lxml and adds a clean API with chained `.css()` and `.xpath()` calls. You do not need Scrapy to use Parsel -- it works perfectly standalone.

### Installation

```bash
pip install parsel
```

This pulls in lxml and cssselect as dependencies.

### Usage

```python
from parsel import Selector

sel = Selector(text=open("books.html").read())

books = sel.css("div.book")

for book in books:
    title = book.css("h2.title::text").get()
    author = book.css("span.author::text").get()
    price = book.css("span.price::text").get()
    link = book.css("a::attr(href)").get()
    print(f"{title} by {author} - {price} ({link})")
```

### The ::text and ::attr() Pseudo-Elements

Parsel's standout feature is its custom pseudo-elements. Standard CSS does not let you extract text content or attribute values directly -- you always get the element and then pull the data from it in a second step. Parsel shortcuts this:

```python
# Get text content directly
title = sel.css("h2.title::text").get()          # "The Great Gatsby"

# Get all text matches as a list
titles = sel.css("h2.title::text").getall()       # ["The Great Gatsby", ...]

# Get attribute value directly
href = sel.css("a::attr(href)").get()             # "/books/gatsby"
hrefs = sel.css("a::attr(href)").getall()         # ["/books/gatsby", ...]
```

These are not standard CSS. They are Parsel extensions that save you from writing `element.text` or `element.get("href")` on every extraction.

### Scrapy Integration

Inside a Scrapy spider, the `response` object is a Selector, so the API is identical:

```python
import scrapy


class BookSpider(scrapy.Spider):
    name = "books"
    start_urls = ["https://example.com/books"]

    def parse(self, response):
        for book in response.css("div.book"):
            yield {
                "title": book.css("h2.title::text").get(),
                "author": book.css("span.author::text").get(),
                "price": book.css("span.price::text").get(),
                "link": response.urljoin(book.css("a::attr(href)").get()),
            }
```

## Selectolax

Selectolax is a Python wrapper around two C-based parsers: Modest (the default) and Lexbor. It is designed for raw speed and uses significantly less memory than BeautifulSoup.

### Installation

```bash
pip install selectolax
```

### Usage

```python
from selectolax.parser import HTMLParser

tree = HTMLParser(open("books.html").read())

books = tree.css("div.book")

for book in books:
    title = book.css_first("h2.title").text()
    author = book.css_first("span.author").text()
    price = book.css_first("span.price").text()
    link = book.css_first("a").attributes["href"]
    print(f"{title} by {author} - {price} ({link})")
```

### Key Methods

```python
# All matches
elements = tree.css("div.book")                  # list of Node objects

# First match
element = tree.css_first("div.book")             # single Node or None

# Text content
text = element.text()                            # all text content
text = element.text(deep=False)                  # direct text only

# Attributes
href = element.attributes["href"]               # dict-style access
```

Selectolax also ships with a second parser backend called Lexbor, which follows the HTML specification more closely. Import it from `selectolax.lexbor` with `LexborHTMLParser` -- the API is identical.

## Side-by-Side Extraction

Here is the same extraction task implemented in all four libraries, each returning a list of dictionaries:

```python
# BeautifulSoup
from bs4 import BeautifulSoup

def extract_bs4(raw_html):
    soup = BeautifulSoup(raw_html, "lxml")
    return [{
        "title": b.select_one("h2.title").get_text(strip=True),
        "author": b.select_one("span.author").get_text(strip=True),
        "price": b.select_one("span.price").get_text(strip=True),
        "link": b.select_one("a")["href"],
    } for b in soup.select("div.book")]


# lxml
from lxml import html

def extract_lxml(raw_html):
    tree = html.fromstring(raw_html)
    return [{
        "title": b.cssselect("h2.title")[0].text_content().strip(),
        "author": b.cssselect("span.author")[0].text_content().strip(),
        "price": b.cssselect("span.price")[0].text_content().strip(),
        "link": b.cssselect("a")[0].get("href"),
    } for b in tree.cssselect("div.book")]


# Parsel
from parsel import Selector

def extract_parsel(raw_html):
    sel = Selector(text=raw_html)
    return [{
        "title": b.css("h2.title::text").get(),
        "author": b.css("span.author::text").get(),
        "price": b.css("span.price::text").get(),
        "link": b.css("a::attr(href)").get(),
    } for b in sel.css("div.book")]


# Selectolax
from selectolax.parser import HTMLParser

def extract_selectolax(raw_html):
    tree = HTMLParser(raw_html)
    return [{
        "title": b.css_first("h2.title").text().strip(),
        "author": b.css_first("span.author").text().strip(),
        "price": b.css_first("span.price").text().strip(),
        "link": b.css_first("a").attributes["href"],
    } for b in tree.css("div.book")]
```

All four functions produce identical output. The differences are in API style and performance.

## Performance Comparison

Parsing speed matters when you are processing thousands of pages. Here are typical results from benchmarking all four libraries on 10,000 iterations of the sample HTML:

| Library                    | Time (10K iterations) | Relative Speed |
|----------------------------|----------------------|----------------|
| Selectolax (Modest)        | ~1.2s                | 1x (fastest)   |
| lxml.cssselect             | ~1.8s                | ~1.5x slower   |
| Parsel                     | ~2.1s                | ~1.8x slower   |
| BeautifulSoup + lxml       | ~6.5s                | ~5.4x slower   |
| BeautifulSoup + html.parser| ~12.0s               | ~10x slower    |

The takeaway: selectolax and lxml are in the same performance tier, both significantly faster than BeautifulSoup. Parsel adds a small overhead over raw lxml due to its wrapper layer. BeautifulSoup with `html.parser` is the slowest option by a wide margin -- always install lxml if you use BeautifulSoup.


<figure>
  <img src="/assets/img/inline-css-selectors-python-libraries-usage-pat-1.jpg" alt="CSS selectors are the bridge between what you see and what you can extract." loading="lazy">
  <figcaption>CSS selectors are the bridge between what you see and what you can extract. <span class="img-credit">Photo by Bibek ghosh / <a href="https://www.pexels.com" target="_blank" rel="noopener noreferrer">Pexels</a></span></figcaption>
</figure>

## CSS Selector Support

Not every library supports every CSS selector. Here is what you can rely on:

| Selector                    | BeautifulSoup | lxml.cssselect | Parsel | Selectolax |
|-----------------------------|---------------|----------------|--------|------------|
| Tag, class, ID              | Yes           | Yes            | Yes    | Yes        |
| Attribute `[attr=val]`      | Yes           | Yes            | Yes    | Yes        |
| Descendant / Child          | Yes           | Yes            | Yes    | Yes        |
| Sibling `+` and `~`         | Yes           | Yes            | Yes    | Yes        |
| `:first-child`, `:nth-child`| Yes           | Yes            | Yes    | Yes        |
| `:not(selector)`            | Yes           | Yes            | Yes    | Yes        |
| `:has(selector)`            | Yes           | No             | No     | Yes        |
| `::text` (Parsel extension) | No            | No             | Yes    | No         |
| `::attr(name)` (Parsel ext) | No            | No             | Yes    | No         |
| `[attr^=]`, `[attr$=]`, `[attr*=]` | Yes    | Yes            | Yes    | Yes        |

Selectolax and BeautifulSoup (via soupsieve) both support modern CSS features like `:has()`. Parsel's `::text` and `::attr()` are unique extensions not part of the CSS specification.

## Installation Summary

```bash
# BeautifulSoup (with fast parser)
pip install beautifulsoup4 lxml

# lxml with CSS selector support
pip install lxml cssselect

# Parsel (pulls in lxml and cssselect automatically)
pip install parsel

# Selectolax
pip install selectolax
```

## Integration Patterns

### BeautifulSoup with requests

```python
import requests
from bs4 import BeautifulSoup

response = requests.get("https://example.com/books")
soup = BeautifulSoup(response.text, "lxml")

for title in soup.select("h2.title"):
    print(title.get_text())
```

### lxml with requests

```python
import requests
from lxml import html

response = requests.get("https://example.com/books")
tree = html.fromstring(response.content)

for title in tree.cssselect("h2.title"):
    print(title.text_content())
```

Note `response.content` (bytes) instead of `response.text` (string). lxml handles encoding detection better when it receives raw bytes.

### Parsel Standalone

```python
import requests
from parsel import Selector

response = requests.get("https://example.com/books")
sel = Selector(text=response.text)
titles = sel.css("h2.title::text").getall()
```

### Selectolax with httpx (Async)

```python
import asyncio
import httpx
from selectolax.parser import HTMLParser


async def fetch_titles(url):
    async with httpx.AsyncClient() as client:
        response = await client.get(url)
        tree = HTMLParser(response.text)
        return [t.text() for t in tree.css("h2.title")]


titles = asyncio.run(fetch_titles("https://example.com/books"))
```

## Common Gotchas

### Indexing Differences

BeautifulSoup's `select_one()` and selectolax's `css_first()` return `None` when nothing matches. lxml's `cssselect()` returns an empty list, so `[0]` will raise an `IndexError`:

```python
# BeautifulSoup - safe
element = soup.select_one("div.missing")  # None

# lxml - will crash if no match
element = tree.cssselect("div.missing")[0]  # IndexError

# Safe lxml pattern
matches = tree.cssselect("div.missing")
element = matches[0] if matches else None
```

### Text Extraction Differences

Each library handles text from nested elements differently:

```python
# Given: <div class="book"><h2>Title</h2> by <span>Author</span></div>

# BeautifulSoup
soup.select_one("div.book").get_text()           # "Title by Author"

# lxml
tree.cssselect("div.book")[0].text_content()      # "Title by Author"
tree.cssselect("div.book")[0].text                 # None (text before first child)

# Parsel
sel.css("div.book::text").getall()                # [" by "] (direct text nodes only)
sel.css("div.book *::text").getall()              # ["Title", " by ", "Author"]

# Selectolax
tree.css_first("div.book").text()                 # "Title by Author"
tree.css_first("div.book").text(deep=False)        # " by " (direct text only)
```

### Encoding Handling

When working with HTTP responses, pass bytes to lxml and strings to everything else:

```python
import requests
response = requests.get("https://example.com")

tree = html.fromstring(response.content)          # lxml: bytes
soup = BeautifulSoup(response.text, "lxml")       # BS4: string
sel = Selector(text=response.text)                # Parsel: string
tree = HTMLParser(response.text)                  # Selectolax: string
```

## Choosing the Right Library

**BeautifulSoup** -- when you are learning, prototyping, or writing one-off scripts. Best documentation, most Stack Overflow answers, forgiving with broken HTML.

**lxml** -- when you need speed and XPath as a fallback. Best for processing large volumes where some pages need complex queries CSS cannot express. Also handles XML (RSS feeds, sitemaps).

**Parsel** -- when you are building a Scrapy project or want the cleanest extraction syntax. The `::text` and `::attr()` extensions eliminate boilerplate.

**Selectolax** -- when you need maximum parsing speed. Ideal for data pipelines processing millions of pages where parsing is the bottleneck. Pair it with an [async HTTP client like httpx](/posts/web-scraping-httpx-async-http-fast-data-collection/) to maximize throughput end to end.

## Quick Reference Table

| Criteria             | BeautifulSoup       | lxml.cssselect     | Parsel             | Selectolax         |
|----------------------|---------------------|--------------------|--------------------|--------------------|
| CSS Method           | `select()` / `select_one()` | `cssselect()` | `.css()` / `.get()` | `css()` / `css_first()` |
| Text Extraction      | `.get_text()`       | `.text_content()`  | `::text`           | `.text()`          |
| Attribute Access     | `element["attr"]`   | `.get("attr")`     | `::attr(name)`     | `.attributes["attr"]` |
| XPath Support        | No                  | Yes                | Yes                | No                 |
| Parser Backend       | Python / lxml       | C (libxml2)        | C (libxml2)        | C (Modest/Lexbor)  |
| Speed                | Slow-Medium         | Fast               | Fast               | Fastest            |
| Learning Curve       | Low                 | Medium             | Medium             | Low                |
| Scrapy Integration   | Manual              | Manual             | Built-in           | Manual             |
| Best For             | Learning, scripts   | Speed + XPath      | Scrapy, clean API  | High-throughput    |

## Wrapping Up

For projects where the volume of data is high enough to justify it, [LLM-based structured data extraction](/posts/best-llm-structured-data-extraction-html-2026/) can replace manual selector writing entirely. But for most workflows, all four libraries can extract data with CSS selectors, and they serve different situations. BeautifulSoup is where most people start, and it works well for small to medium projects. lxml gives you speed and XPath when you need it. Parsel keeps extraction code short and integrates directly with Scrapy. Selectolax gives you the fastest parsing in the Python ecosystem.

The selector strings themselves are the same across all four libraries. What changes is how you wrap them -- `select()`, `cssselect()`, `.css()`, or `css()`. Once you know CSS selectors, switching between libraries is a matter of adjusting a few method calls, not relearning a query language.
