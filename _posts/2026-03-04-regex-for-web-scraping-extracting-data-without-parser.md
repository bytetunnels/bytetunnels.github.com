---
title: "Regex for Web Scraping: Extracting Data Without a Parser"
date: 2026-03-04 14:00:00 +0000
categories: ["Data Extraction"]
tags: ["regex", "web scraping", "regular expressions", "python", "data extraction", "pattern matching"]
author: arman
image:
  path: /assets/img/2026-03-04-regex-for-web-scraping-extracting-data-without-parser-hero.png
  alt: "Regex for Web Scraping: Extracting Data Without a Parser"
---

Regular expressions have a bad reputation in the scraping world. The common advice is to never use regex on HTML, and for deeply nested documents that advice is sound. But in practice, a significant amount of scraping work involves extracting simple, predictable patterns from raw text, API responses, log files, or HTML fragments where spinning up a full parser is overkill. Regex is fast, dependency-free, and available in every language. Knowing when and how to use it gives you a lightweight tool that can handle a surprising number of extraction tasks.

This post covers practical regex patterns for web scraping in Python and JavaScript, with working code examples you can use immediately. We will also look at when regex falls short and you should reach for BeautifulSoup, lxml, or a proper DOM parser instead.

## When Regex Makes Sense

Regex is a good fit for scraping when the data you need follows a flat, predictable pattern. Here are the situations where it works well:

- **Raw text extraction** -- pulling phone numbers, emails, or prices out of unstructured text content
- **API responses** -- extracting values from JSON-like strings or plain text endpoints where a JSON parser is not warranted
- **Log files and server responses** -- parsing timestamps, status codes, or URLs from HTTP logs
- **Simple HTML patterns** -- grabbing the content of a `<title>` tag, extracting all `href` values, or pulling data from consistently structured markup
- **Preprocessing** -- cleaning or normalizing text before feeding it to another tool

## When Regex Does Not Make Sense

Regex struggles with anything that involves nesting, optional attributes in unpredictable order, or context-dependent structure. These are problems for a real parser:

- **Nested HTML elements** -- a regex cannot reliably match `<div>` tags that contain other `<div>` tags
- **Attributes in variable order** -- `<a class="link" href="/page">` versus `<a href="/page" class="link">` breaks naive patterns
- **Malformed HTML** -- browsers are forgiving, regex is not
- **Full document traversal** -- if you need to walk a DOM tree, use BeautifulSoup or lxml

The rule of thumb: if you can describe what you want as "find all strings that look like X," regex is fine. If you need to say "find the third div inside the second section that has a specific class," use a parser.

## Python re Module Basics for Scraping

Python's built-in `re` module is all you need. Here are the three functions you will use most:

```python
import re

html = '<a href="https://example.com">Example</a> <a href="/about">About</a>'

# re.findall() -- returns all matches as a list
urls = re.findall(r'href="([^"]+)"', html)
print(urls)
# ['https://example.com', '/about']

# re.search() -- returns the first match (or None)
match = re.search(r'href="([^"]+)"', html)
if match:
    print(match.group(1))
    # 'https://example.com'

# re.compile() -- precompile for repeated use
url_pattern = re.compile(r'href="([^"]+)"')
urls = url_pattern.findall(html)
print(urls)
# ['https://example.com', '/about']
```

Use `re.findall()` when you want every occurrence. Use `re.search()` when you only need the first. Use `re.compile()` when you are applying the same pattern across many pages -- it avoids recompiling the pattern on every call.

## Practical Patterns: Extracting URLs

The most common scraping task is pulling links out of HTML. The `href` attribute is almost always quoted with double quotes, making it a natural regex target.

```python
import re

html = """
<nav>
  <a href="https://example.com/products">Products</a>
  <a href="https://example.com/about">About Us</a>
  <a href="/contact" class="nav-link">Contact</a>
  <a href='https://example.com/blog'>Blog</a>
</nav>
<img src="https://cdn.example.com/logo.png" alt="Logo">
"""

# Extract all href values (double-quoted)
hrefs = re.findall(r'href="([^"]+)"', html)
print(hrefs)
# ['https://example.com/products', 'https://example.com/about', '/contact']

# Handle both single and double quotes
all_hrefs = re.findall(r'href=["\']([^"\']+)["\']', html)
print(all_hrefs)
# ['https://example.com/products', 'https://example.com/about', '/contact', 'https://example.com/blog']

# Extract all URLs from src and href attributes
all_urls = re.findall(r'(?:href|src)=["\']([^"\']+)["\']', html)
print(all_urls)
# ['https://example.com/products', 'https://example.com/about', '/contact',
#  'https://example.com/blog', 'https://cdn.example.com/logo.png']
```

The pattern `[^"]+` means "one or more characters that are not a double quote." This is a non-greedy approach by design -- it stops at the closing quote without needing the `?` lazy modifier.

## Practical Patterns: Extracting Email Addresses

Email extraction is one of the most common regex use cases in scraping. This pattern covers the vast majority of real-world email formats:

```python
import re

text = """
Contact us at support@example.com or sales@example.co.uk.
You can also reach john.doe+newsletter@company.org for inquiries.
Invalid: @nodomain or noatsign.com
"""

email_pattern = re.compile(r'[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}')
emails = email_pattern.findall(text)
print(emails)
# ['support@example.com', 'sales@example.co.uk', 'john.doe+newsletter@company.org']
```

This pattern is not RFC 5322 compliant -- a fully compliant email regex is famously unwieldy. But for scraping purposes, it catches the emails you actually encounter on web pages. For a deeper dive into edge cases like plus addressing, obfuscation, and false positive filtering, see our post on [email regex patterns for reliable extraction](/posts/email-regex-patterns-web-scraping-reliable-extraction/).


<figure>
  <img src="/assets/img/inline-regex-for-web-scraping-extracting-data-w-1.jpg" alt="A single re.findall call can extract every URL from a page faster than any HTML parser." loading="lazy">
  <figcaption>A single re.findall call can extract every URL from a page faster than any HTML parser. <span class="img-credit">Photo by Memet Öz / <a href="https://www.pexels.com" target="_blank" rel="noopener noreferrer">Pexels</a></span></figcaption>
</figure>

## Practical Patterns: Extracting Prices

Price extraction requires handling dollar signs, commas, and optional decimal places:

```python
import re

text = """
Basic Plan: $9.99/month
Pro Plan: $29.99/month
Enterprise: $1,299.00/year
One-time fee: $500
Sale price: $4,999
Discount: save $10.50
"""

# Match prices with dollar sign, optional commas, optional decimals
price_pattern = re.compile(r'\$[\d,]+\.?\d*')
prices = price_pattern.findall(text)
print(prices)
# ['$9.99', '$29.99', '$1,299.00', '$500', '$4,999', '$10.50']

# Convert to float values
def price_to_float(price_str):
    return float(price_str.replace('$', '').replace(',', ''))

numeric_prices = [price_to_float(p) for p in prices]
print(numeric_prices)
# [9.99, 29.99, 1299.0, 500.0, 4999.0, 10.5]
```

The pattern `\$[\d,]+\.?\d*` breaks down as: literal dollar sign, then one or more digits or commas, then an optional decimal point, then zero or more digits.

## Practical Patterns: Extracting Text Between Tags

For simple, non-nested tags, regex works reliably:

```python
import re

html = """
<html>
<head><title>Product Catalog - Example Store</title></head>
<body>
<h1>Featured Products</h1>
<p>Check out our latest offerings.</p>
<h2>Electronics</h2>
<h2>Books</h2>
</body>
</html>
"""

# Extract title tag content
title = re.search(r'<title>(.*?)</title>', html)
if title:
    print(title.group(1))
    # 'Product Catalog - Example Store'

# Extract all h2 contents
h2_texts = re.findall(r'<h2>(.*?)</h2>', html)
print(h2_texts)
# ['Electronics', 'Books']

# Extract paragraph text
paragraphs = re.findall(r'<p>(.*?)</p>', html)
print(paragraphs)
# ['Check out our latest offerings.']
```

The `.*?` lazy quantifier is critical here. Without the `?`, the pattern would greedily match from the first opening tag to the last closing tag, consuming everything in between.

## Practical Patterns: Extracting Data Attributes

Modern HTML often uses `data-*` attributes to store structured information. These are often more reliable targets than visible text because they are meant for programmatic access:

```python
import re

html = """
<div class="product-card" data-product-id="12345" data-price="29.99" data-category="electronics">
  <span data-rating="4.5">Wireless Mouse</span>
</div>
<div class="product-card" data-product-id="67890" data-price="49.99" data-category="accessories">
  <span data-rating="3.8">USB Hub</span>
</div>
"""

# Extract specific data attributes
product_ids = re.findall(r'data-product-id="([^"]+)"', html)
print(product_ids)
# ['12345', '67890']

data_prices = re.findall(r'data-price="([^"]+)"', html)
print(data_prices)
# ['29.99', '49.99']

# Extract any data attribute and its value
all_data_attrs = re.findall(r'(data-[\w\-]+)="([^"]+)"', html)
print(all_data_attrs)
# [('data-product-id', '12345'), ('data-price', '29.99'), ('data-category', 'electronics'),
#  ('data-rating', '4.5'), ('data-product-id', '67890'), ('data-price', '49.99'),
#  ('data-category', 'accessories'), ('data-rating', '3.8')]
```

Data attributes are great regex targets because their format is rigid: `data-name="value"` with no variation in structure.

## Named Groups for Structured Extraction

When you need to extract multiple fields from each match, named groups turn regex output into something resembling structured data:

```python
import re

html = """
<div class="listing">
  <a href="/product/laptop-pro" class="title">Laptop Pro 15"</a>
  <span class="price">$1,299.00</span>
  <span class="stock">In Stock</span>
</div>
<div class="listing">
  <a href="/product/wireless-mouse" class="title">Wireless Mouse</a>
  <span class="price">$29.99</span>
  <span class="stock">Low Stock</span>
</div>
"""

listing_pattern = re.compile(
    r'<div class="listing">\s*'
    r'<a href="(?P<url>[^"]+)" class="title">(?P<name>.*?)</a>\s*'
    r'<span class="price">(?P<price>.*?)</span>\s*'
    r'<span class="stock">(?P<stock>.*?)</span>',
    re.DOTALL
)

for match in listing_pattern.finditer(html):
    print({
        'url': match.group('url'),
        'name': match.group('name'),
        'price': match.group('price'),
        'stock': match.group('stock'),
    })

# {'url': '/product/laptop-pro', 'name': 'Laptop Pro 15"', 'price': '$1,299.00', 'stock': 'In Stock'}
# {'url': '/product/wireless-mouse', 'name': 'Wireless Mouse', 'price': '$29.99', 'stock': 'Low Stock'}
```

The `(?P<name>pattern)` syntax assigns a name to each capture group, so you can access matches by label instead of numeric index. Combined with `re.finditer()`, which returns match objects one at a time, this gives you an iterator of structured results without loading everything into memory at once.

You can also use `match.groupdict()` to get all named groups as a dictionary in one call:

```python
for match in listing_pattern.finditer(html):
    product = match.groupdict()
    print(product)
    # {'url': '/product/laptop-pro', 'name': 'Laptop Pro 15"', 'price': '$1,299.00', 'stock': 'In Stock'}
```


<figure>
  <img src="/assets/img/inline-regex-for-web-scraping-extracting-data-w-2.jpg" alt="Regex runs 10-50x faster than BeautifulSoup for simple extraction — but breaks the moment HTML nests unpredictably." loading="lazy">
  <figcaption>Regex runs 10-50x faster than BeautifulSoup for simple extraction — but breaks the moment HTML nests unpredictably. <span class="img-credit">Photo by Berna / <a href="https://www.pexels.com" target="_blank" rel="noopener noreferrer">Pexels</a></span></figcaption>
</figure>

## Common Pitfalls

### Greedy vs Lazy Matching

This is the single most common regex bug in scraping. The difference between `.*` (greedy) and `.*?` (lazy) determines whether your pattern overshoots:

```python
import re

html = '<span>First</span> some text <span>Second</span>'

# WRONG: greedy -- matches from first <span> to LAST </span>
greedy = re.findall(r'<span>(.*)</span>', html)
print(greedy)
# ['First</span> some text <span>Second']

# RIGHT: lazy -- matches each <span>...</span> individually
lazy = re.findall(r'<span>(.*?)</span>', html)
print(lazy)
# ['First', 'Second']
```

Always use `.*?` when extracting content between delimiters unless you have a specific reason to be greedy.

### Multiline Matching

By default, `.` does not match newline characters. If your target content spans multiple lines, you need `re.DOTALL`:

```python
import re

html = """<div class="description">
  This product features
  advanced technology
  and premium materials.
</div>"""

# Without DOTALL -- no match because . does not cross newlines
no_match = re.search(r'<div class="description">(.*?)</div>', html)
print(no_match)
# None

# With DOTALL -- . matches everything including newlines
with_match = re.search(r'<div class="description">(.*?)</div>', html, re.DOTALL)
if with_match:
    print(with_match.group(1).strip())
    # 'This product features\n  advanced technology\n  and premium materials.'
```

There is also `re.MULTILINE`, which changes `^` and `$` to match the start and end of each line instead of the entire string. These two flags solve different problems -- `DOTALL` for content spanning lines, `MULTILINE` for line-by-line matching:

```python
import re

log_data = """200 OK https://example.com/page1
404 Not Found https://example.com/missing
200 OK https://example.com/page2
500 Error https://example.com/broken"""

# Match lines that start with a specific status code
errors = re.findall(r'^(?:404|500)\s+\S+\s+(\S+)$', log_data, re.MULTILINE)
print(errors)
# ['https://example.com/missing', 'https://example.com/broken']
```

### Escaping Special Characters

Characters like `.`, `?`, `*`, `+`, `(`, `)`, `[`, `]`, `{`, `}`, `\`, `^`, `$`, and `|` have special meaning in regex. When you want to match them literally, escape with a backslash:

```python
import re

text = "Price is $29.99 (USD). Visit example.com for details."

# WRONG: unescaped . matches any character, $ is an anchor
bad = re.findall(r'$\d+.\d+', text)
print(bad)
# []

# RIGHT: escaped special characters
good = re.findall(r'\$\d+\.\d+', text)
print(good)
# ['$29.99']

# Use re.escape() for dynamic strings
search_term = "example.com"
escaped = re.escape(search_term)
print(escaped)
# 'example\\.com'
matches = re.findall(escaped, text)
print(matches)
# ['example.com']
```

Use `re.escape()` whenever you are building patterns from user input or scraped content to avoid injection of regex metacharacters.

## JavaScript Regex Examples

The same patterns work in JavaScript with slightly different syntax. Here are the equivalents using `match()` and `matchAll()`:

```javascript
const html = `
<a href="https://example.com/products">Products</a>
<a href="https://example.com/about">About</a>
<span class="price">$49.99</span>
<span class="price">$129.00</span>
`;

// Extract all URLs -- matchAll requires the global flag
const urlPattern = /href="([^"]+)"/g;
const urls = [...html.matchAll(urlPattern)].map(m => m[1]);
console.log(urls);
// ['https://example.com/products', 'https://example.com/about']

// Extract prices
const pricePattern = /\$[\d,]+\.?\d*/g;
const prices = html.match(pricePattern);
console.log(prices);
// ['$49.99', '$129.00']

// Named groups (ES2018+)
const listingHtml = '<a href="/product/mouse" class="title">Wireless Mouse</a>';
const namedPattern = /href="(?<url>[^"]+)"[^>]*>(?<name>[^<]+)/;
const result = listingHtml.match(namedPattern);
console.log(result.groups);
// { url: '/product/mouse', name: 'Wireless Mouse' }
```

Key differences from Python:

- JavaScript uses `/pattern/flags` syntax instead of raw strings
- `matchAll()` requires the `g` (global) flag and returns an iterator
- `match()` without the `g` flag returns the first match with groups; with `g` it returns all matches but without groups
- The `s` flag in JavaScript is equivalent to Python's `re.DOTALL`
- The `m` flag is equivalent to `re.MULTILINE`

```javascript
// Multiline matching in JavaScript
const multilineHtml = `<div class="bio">
  John is a developer
  based in New York.
</div>`;

// Use the 's' flag so . matches newlines
const bioPattern = /<div class="bio">(.*?)<\/div>/s;
const bio = multilineHtml.match(bioPattern);
console.log(bio[1].trim());
// 'John is a developer\n  based in New York.'
```

## Performance: Regex vs Parsers

For flat pattern extraction, regex is significantly faster than loading a full parser. Here is a comparison on a typical product page:

```python
import re
import time
from bs4 import BeautifulSoup
from lxml import html as lxml_html

# Simulated HTML with 1000 product prices
sample_html = '<div>' + ''.join(
    f'<span class="price">${i}.99</span>' for i in range(1, 1001)
) + '</div>'

# Regex extraction
start = time.perf_counter()
for _ in range(100):
    prices = re.findall(r'\$[\d,]+\.?\d*', sample_html)
regex_time = time.perf_counter() - start

# BeautifulSoup extraction
start = time.perf_counter()
for _ in range(100):
    soup = BeautifulSoup(sample_html, 'html.parser')
    prices = [tag.text for tag in soup.find_all('span', class_='price')]
bs4_time = time.perf_counter() - start

# lxml extraction
start = time.perf_counter()
for _ in range(100):
    tree = lxml_html.fromstring(sample_html)
    prices = tree.xpath('//span[@class="price"]/text()')
lxml_time = time.perf_counter() - start

print(f"Regex:         {regex_time:.3f}s")
print(f"BeautifulSoup: {bs4_time:.3f}s")
print(f"lxml:          {lxml_time:.3f}s")
```

Typical results show regex at roughly 10-50x faster than BeautifulSoup and 3-10x faster than lxml for simple flat patterns. The gap narrows as extraction logic gets more complex, and reverses entirely when you need structural queries. Regex wins on speed for simple patterns because it never builds a DOM tree -- it scans the raw string directly.

That said, the speed difference rarely matters in scraping where network latency dominates. The real advantage of regex is zero dependencies and simplicity for straightforward tasks.

## Real-World Example: Product Page Scraping with Regex

Here is a complete example that scrapes product information from a simple HTML page using only regex and the standard library:

```python
import re
import urllib.request
import json

def scrape_products_regex(html):
    """Extract product data from HTML using only regex."""

    products = []

    # Pattern for a product block -- assumes consistent markup
    product_pattern = re.compile(
        r'<div\s+class="product-card"[^>]*>\s*'
        r'<img\s+src="(?P<image>[^"]+)"[^>]*/>\s*'
        r'<h3[^>]*>(?P<name>.*?)</h3>\s*'
        r'<p\s+class="description">(?P<description>.*?)</p>\s*'
        r'<span\s+class="price">(?P<price>\$[\d,]+\.?\d*)</span>\s*'
        r'(?:<span\s+class="rating"\s+data-score="(?P<rating>[\d.]+)"[^>]*>.*?</span>\s*)?'
        r'<a\s+href="(?P<url>[^"]+)"',
        re.DOTALL
    )

    for match in product_pattern.finditer(html):
        product = match.groupdict()

        # Clean up the extracted data
        product['name'] = re.sub(r'<[^>]+>', '', product['name']).strip()
        product['description'] = re.sub(r'<[^>]+>', '', product['description']).strip()
        product['price_numeric'] = float(
            product['price'].replace('$', '').replace(',', '')
        )
        if product['rating']:
            product['rating'] = float(product['rating'])

        products.append(product)

    return products


# Example HTML that this pattern would match
sample_page = """
<div class="product-card" data-id="1">
  <img src="/images/keyboard.jpg" alt="Mechanical Keyboard"/>
  <h3 class="product-title">Mechanical Keyboard RGB</h3>
  <p class="description">Full-size mechanical keyboard with Cherry MX switches and per-key RGB lighting.</p>
  <span class="price">$89.99</span>
  <span class="rating" data-score="4.7">4.7 stars</span>
  <a href="/products/keyboard-rgb" class="buy-link">View Details</a>
</div>
<div class="product-card" data-id="2">
  <img src="/images/monitor.jpg" alt="4K Monitor"/>
  <h3 class="product-title">Ultra-Wide 4K Monitor</h3>
  <p class="description">34-inch curved display with HDR support and 144Hz refresh rate.</p>
  <span class="price">$1,299.00</span>
  <span class="rating" data-score="4.3">4.3 stars</span>
  <a href="/products/monitor-4k" class="buy-link">View Details</a>
</div>
"""

products = scrape_products_regex(sample_page)
print(json.dumps(products, indent=2, default=str))
```

Output:

```json
[
  {
    "image": "/images/keyboard.jpg",
    "name": "Mechanical Keyboard RGB",
    "description": "Full-size mechanical keyboard with Cherry MX switches and per-key RGB lighting.",
    "price": "$89.99",
    "rating": 4.7,
    "url": "/products/keyboard-rgb",
    "price_numeric": 89.99
  },
  {
    "image": "/images/monitor.jpg",
    "name": "Ultra-Wide 4K Monitor",
    "description": "34-inch curved display with HDR support and 144Hz refresh rate.",
    "price": "$1,299.00",
    "rating": 4.3,
    "url": "/products/monitor-4k",
    "price_numeric": 1299.0
  }
]
```

This works because the HTML follows a strict, repeating template. Every product card has the same structure, same class names, same attribute order. That predictability is what makes regex viable.

## When to Graduate from Regex to a Parser

Regex is a tool for a specific job. Here are the signals that you have outgrown it. At that point, you might consider [LLM-powered data extraction](/posts/best-llm-structured-data-extraction-html-2026/) or [schema-driven scraping with structured output](/posts/llm-powered-data-extraction-schema-driven-scraping-with-structured-output/) as modern alternatives:

**Switch to BeautifulSoup or lxml when:**
- The HTML has inconsistent formatting or attribute ordering
- You need to navigate parent-child relationships (find the price inside a specific product card)
- The page has nested elements of the same type (`<div>` inside `<div>`)
- You are dealing with malformed HTML that browsers render correctly but breaks strict parsing
- Your regex patterns are becoming unreadable multi-line monsters

**Switch to a browser automation tool when:**
- The content is rendered by JavaScript
- You need to interact with the page (click buttons, [fill forms](/posts/how-to-automate-web-form-filling-complete-guide/), scroll)
- The data loads dynamically via XHR or WebSocket

**A hybrid approach often works best:**
1. Fetch the page with [`requests`](/posts/python-requests-vs-selenium-speed-performance-comparison/) or a [browser automation tool](/posts/playwright-vs-puppeteer-vs-selenium-vs-scrapy-2026-mega-comparison/)
2. Use regex for quick, simple extractions (title, meta tags, prices)
3. Use BeautifulSoup or lxml for structural queries (table rows, nested cards)
4. Use regex again for post-processing (cleaning text, normalizing formats)

```python
import re
from bs4 import BeautifulSoup

def hybrid_extraction(html):
    """Use the right tool for each part of the extraction."""

    # Regex for simple flat values -- fast, no parsing needed
    title = re.search(r'<title>(.*?)</title>', html)
    title_text = title.group(1) if title else ''

    meta_desc = re.search(r'<meta\s+name="description"\s+content="([^"]*)"', html)
    description = meta_desc.group(1) if meta_desc else ''

    # BeautifulSoup for structural queries -- handles nesting and malformed HTML
    soup = BeautifulSoup(html, 'html.parser')
    products = []
    for card in soup.select('div.product-card'):
        name = card.select_one('.product-title')
        price_el = card.select_one('.price')

        # Regex for post-processing the extracted text
        price_text = price_el.text if price_el else ''
        price_match = re.search(r'\$[\d,]+\.?\d*', price_text)

        products.append({
            'name': name.text.strip() if name else '',
            'price': price_match.group(0) if price_match else '',
        })

    return {
        'title': title_text,
        'description': description,
        'products': products,
    }
```

## Recommendations

1. **Start with regex for simple, repetitive patterns.** Extracting all URLs, emails, prices, or data attributes from a page is faster and simpler with `re.findall()` than setting up a parser.

2. **Always use lazy quantifiers (`.*?`) when matching between delimiters.** Greedy matching is the most common source of regex bugs in scraping.

3. **Use `re.DOTALL` when content spans multiple lines.** Without it, `.` stops at newline characters and your pattern silently fails.

4. **Use named groups for multi-field extraction.** The `(?P<name>...)` syntax turns regex matches into readable, maintainable structured data.

5. **Precompile patterns with `re.compile()` when scraping multiple pages.** It avoids recompilation overhead and makes your code cleaner.

6. **Use `re.escape()` for any dynamic content in patterns.** Never interpolate raw strings into regex patterns without escaping.

7. **Know when to stop.** If your regex spans more than three or four lines, or if you are trying to handle optional nested elements, switch to BeautifulSoup or lxml. The time you save writing a quick regex is lost debugging an unreadable one.

8. **Consider a hybrid approach.** Use regex for the parts it handles well (flat values, text cleaning) and a parser for structural queries. There is no rule that says you have to pick one tool for the entire job. For a hands-on walkthrough of building a complete regex-based scraper, see our follow-up post on [building a web scraper with regex](/posts/building-web-scraper-with-regex-practical-patterns-pitfalls/).
