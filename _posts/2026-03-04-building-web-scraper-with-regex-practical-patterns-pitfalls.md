---
title: "Building a Web Scraper with Regex: Practical Patterns and Pitfalls"
date: 2026-03-04 16:00:00 +0000
categories: ["Data Extraction"]
tags: ["regex", "web scraping", "python", "patterns", "data extraction", "regular expressions", "tutorial"]
author: arman
image:
  path: /assets/img/2026-03-04-building-web-scraper-with-regex-practical-patterns-pitfalls-hero.jpg
  alt: "Building a Web Scraper with Regex: Practical Patterns and Pitfalls"
---

Most web scraping tutorials reach for BeautifulSoup or lxml the moment HTML enters the picture. Those are excellent tools, but they are not always necessary. If you are scraping a predictable page, extracting a handful of fields from a known HTML structure, or working in an environment where you cannot install third-party parsing libraries, regular expressions can do the job. This post walks through building a complete web scraper in Python using only the `requests` library for fetching and the built-in `re` module for extraction. Along the way, we will build a reusable pattern library, handle common edge cases, and then look honestly at where regex scraping falls apart.

This is not a regex basics article. If you need a refresher on capture groups and quantifiers, check our earlier post on [pattern matching fundamentals](/posts/regex-for-web-scraping-extracting-data-without-parser/). Here we are building a working tool.

## The Project

We will build a scraper that takes a URL, fetches the page, and extracts the following structured data using only regex:

- Page title
- All links with their anchor text
- Meta tags (description, keywords, Open Graph tags)
- Structured product-like data from repeating HTML blocks

The entire scraper will be a single Python script with no dependencies beyond [`requests`](/posts/python-requests-vs-selenium-speed-performance-comparison/) and the standard library. By the end, you will have a reusable module you can adapt for your own projects.

## Step 1: Fetching HTML with Python Requests

Before we extract anything, we need clean HTML to work with. The `requests` library handles fetching, redirects, and encoding detection for us.

```python
import requests

def fetch_page(url, timeout=10):
    """Fetch a webpage and return its HTML as a string."""
    headers = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) '
                       'AppleWebKit/537.36 (KHTML, like Gecko) '
                       'Chrome/131.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
    }
    response = requests.get(url, headers=headers, timeout=timeout)
    response.raise_for_status()
    return response.text
```

A few things worth noting here. We set a `User-Agent` header because some servers return different HTML or block requests that identify as Python. The `response.text` property returns the HTML as a decoded string, which matters for regex because `re` works on strings, not raw bytes. If you use `response.content` instead, you get bytes, and your patterns will need `b'...'` byte literals. Stick with `response.text` unless you have a specific reason not to.

```python
html = fetch_page('https://example.com')
print(f"Fetched {len(html)} characters")
```

That gives us a string we can run patterns against.

## Step 2: Extracting the Page Title

The simplest extraction task: pull the text between `<title>` and `</title>`.

```python
import re

def extract_title(html):
    """Extract the page title from HTML."""
    match = re.search(r'<title[^>]*>(.*?)</title>', html, re.IGNORECASE | re.DOTALL)
    if match:
        return match.group(1).strip()
    return None
```

Let us break down the pattern `<title[^>]*>(.*?)</title>`:

- `<title` matches the opening tag literally
- `[^>]*` handles any attributes on the title tag (rare, but possible)
- `>` closes the opening tag
- `(.*?)` is a non-greedy capture group that grabs everything inside the tag
- `</title>` matches the closing tag
- `re.IGNORECASE` handles `<TITLE>` or `<Title>` variations
- `re.DOTALL` lets `.` match newlines, since the title might span multiple lines

```python
title = extract_title(html)
print(f"Title: {title}")
# Output: Title: Example Domain
```

The `re.search` function returns `None` if the pattern does not match, so always check before calling `.group()`. This is a pattern we will repeat throughout the scraper.


<figure>
  <img src="/assets/img/inline-building-web-scraper-with-regex-practica-1.jpg" alt="Extract blocks first, then parse fields within each block — two-phase regex avoids the greedy-match trap." loading="lazy">
  <figcaption>Extract blocks first, then parse fields within each block — two-phase regex avoids the greedy-match trap. <span class="img-credit">Photo by Memet Öz / <a href="https://www.pexels.com" target="_blank" rel="noopener noreferrer">Pexels</a></span></figcaption>
</figure>

## Step 3: Extracting All Links with Their Text

Links are more interesting because there are many on a page, and each has both a URL and anchor text.

```python
def extract_links(html):
    """Extract all links with their href and anchor text."""
    pattern = r'<a\s+[^>]*href=["\']([^"\']+)["\'][^>]*>(.*?)</a>'
    matches = re.findall(pattern, html, re.IGNORECASE | re.DOTALL)
    links = []
    for href, text in matches:
        # Clean the anchor text by removing nested HTML tags
        clean_text = re.sub(r'<[^>]+>', '', text).strip()
        links.append({'href': href, 'text': clean_text})
    return links
```

The pattern `<a\s+[^>]*href=["\']([^"\']+)["\'][^>]*>(.*?)</a>` works like this:

- `<a\s+` matches the opening `<a` tag followed by at least one whitespace character
- `[^>]*` skips over any attributes before `href` (like `class`, `id`)
- `href=["\']` matches the href attribute with either single or double quotes
- `([^"\']+)` captures the URL (everything that is not a quote)
- `["\']` closes the quote
- `[^>]*>` skips any remaining attributes and closes the opening tag
- `(.*?)` captures the anchor text non-greedily
- `</a>` matches the closing tag

There is a subtlety here: anchor text often contains nested HTML like `<span>`, `<img>`, or `<strong>` tags. The secondary `re.sub` call strips those out, leaving just the visible text. For a dedicated look at extracting email addresses from links and page content, see our post on [email regex patterns for web scraping](/posts/email-regex-patterns-web-scraping-reliable-extraction/).

```python
links = extract_links(html)
for link in links:
    print(f"  {link['text']} -> {link['href']}")
```

One limitation: this pattern requires `href` to use quotes. Some HTML in the wild uses unquoted attribute values like `href=https://example.com`. If you need to handle that, extend the pattern with an alternation:

```python
# Handles quoted and unquoted href values
pattern = r'<a\s+[^>]*href=(?:["\']([^"\']+)["\']|(\S+))[^>]*>(.*?)</a>'
```

For most modern websites, the quoted version is sufficient.

## Step 4: Extracting Meta Tags

Meta tags carry structured metadata that is useful for scraping: descriptions, keywords, Open Graph tags for social media, and canonical URLs.

```python
def extract_meta_tags(html):
    """Extract meta tags and return them as a dictionary."""
    meta = {}

    # Standard meta tags with name attribute
    pattern_name = r'<meta\s+[^>]*name=["\']([^"\']+)["\'][^>]*content=["\']([^"\']*)["\'][^>]*/?>'
    for name, content in re.findall(pattern_name, html, re.IGNORECASE):
        meta[name.lower()] = content

    # Handle reversed attribute order (content before name)
    pattern_reversed = r'<meta\s+[^>]*content=["\']([^"\']*)["\'][^>]*name=["\']([^"\']+)["\'][^>]*/?>'
    for content, name in re.findall(pattern_reversed, html, re.IGNORECASE):
        meta[name.lower()] = content

    # Open Graph meta tags (use property instead of name)
    pattern_og = r'<meta\s+[^>]*property=["\']([^"\']+)["\'][^>]*content=["\']([^"\']*)["\'][^>]*/?>'
    for prop, content in re.findall(pattern_og, html, re.IGNORECASE):
        meta[prop.lower()] = content

    return meta
```

This function uses three patterns because meta tags in real HTML vary in attribute order and use different attribute names. The HTML spec does not enforce any particular order for attributes, so `<meta name="description" content="...">` and `<meta content="..." name="description">` are both valid. You will encounter both in production scraping.

```python
meta = extract_meta_tags(html)
for key, value in meta.items():
    print(f"  {key}: {value}")
```

Notice that we need separate patterns for `name` vs `property` attributes. Open Graph tags use `property="og:title"` instead of `name`. This is exactly the kind of variation that makes regex scraping require careful pattern design.


<figure>
  <img src="/assets/img/inline-building-web-scraper-with-regex-practica-2.jpg" alt="The PatternLibrary approach compiles patterns once and reuses them across pages." loading="lazy">
  <figcaption>The PatternLibrary approach compiles patterns once and reuses them across pages. <span class="img-credit">Photo by Berna / <a href="https://www.pexels.com" target="_blank" rel="noopener noreferrer">Pexels</a></span></figcaption>
</figure>

## Step 5: Extracting Structured Data from Repeating Blocks

The most practical use case for regex scraping is pulling structured data from repeating HTML blocks: product listings, search results, table rows, article cards. Here we will parse a product listing page.

Suppose the HTML contains product cards with this structure:

```html
<div class="product-card">
    <h2 class="product-name">Wireless Mouse</h2>
    <span class="price">$29.99</span>
    <p class="description">Ergonomic wireless mouse with USB receiver</p>
</div>
```

First, we extract each card as a block, then parse fields within each block:

```python
def extract_products(html):
    """Extract product data from repeating HTML blocks."""
    products = []

    # Step 1: Extract each product card block
    card_pattern = r'<div\s+class=["\']product-card["\'][^>]*>(.*?)</div>'
    cards = re.findall(card_pattern, html, re.IGNORECASE | re.DOTALL)

    # Step 2: Extract fields from each card
    name_pattern = re.compile(r'<h2[^>]*class=["\']product-name["\'][^>]*>(.*?)</h2>', re.IGNORECASE | re.DOTALL)
    price_pattern = re.compile(r'<span[^>]*class=["\']price["\'][^>]*>\$?([\d,.]+)</span>', re.IGNORECASE | re.DOTALL)
    desc_pattern = re.compile(r'<p[^>]*class=["\']description["\'][^>]*>(.*?)</p>', re.IGNORECASE | re.DOTALL)

    for card_html in cards:
        product = {}

        name_match = name_pattern.search(card_html)
        product['name'] = name_match.group(1).strip() if name_match else None

        price_match = price_pattern.search(card_html)
        product['price'] = float(price_match.group(1).replace(',', '')) if price_match else None

        desc_match = desc_pattern.search(card_html)
        product['description'] = desc_match.group(1).strip() if desc_match else None

        products.append(product)

    return products
```

The two-phase approach (extract blocks, then parse fields) is important. If you try to match all fields in a single pattern across the entire page, you risk matching a price from one product with the name from another. Isolating each block first keeps the data aligned.

Notice that the field patterns are compiled with `re.compile()`. This is the entry point into building a reusable pattern library.

## Building a Reusable Pattern Library

When you scrape multiple pages from the same site, you end up writing the same patterns repeatedly. Compiling them into a library avoids that duplication and improves performance since `re.compile()` pre-processes the pattern once.

```python
import re

class PatternLibrary:
    """Reusable compiled regex patterns for HTML extraction."""

    def __init__(self):
        flags = re.IGNORECASE | re.DOTALL

        # Structural patterns
        self.title = re.compile(r'<title[^>]*>(.*?)</title>', flags)
        self.links = re.compile(
            r'<a\s+[^>]*href=["\']([^"\']+)["\'][^>]*>(.*?)</a>', flags
        )
        self.images = re.compile(
            r'<img\s+[^>]*src=["\']([^"\']+)["\'][^>]*(?:alt=["\']([^"\']*)["\'])?[^>]*/?>',
            flags
        )

        # Meta patterns
        self.meta_name = re.compile(
            r'<meta\s+[^>]*name=["\']([^"\']+)["\'][^>]*content=["\']([^"\']*)["\'][^>]*/?>',
            flags
        )
        self.meta_property = re.compile(
            r'<meta\s+[^>]*property=["\']([^"\']+)["\'][^>]*content=["\']([^"\']*)["\'][^>]*/?>',
            flags
        )

        # Content cleaning
        self.html_tags = re.compile(r'<[^>]+>')
        self.whitespace = re.compile(r'\s+')

    def clean_text(self, text):
        """Remove HTML tags and normalize whitespace."""
        text = self.html_tags.sub(' ', text)
        text = self.whitespace.sub(' ', text)
        return text.strip()

    def extract_tag(self, html, tag, class_name=None):
        """Generic extractor for content within a tag, optionally filtered by class."""
        if class_name:
            pattern = re.compile(
                rf'<{tag}\s+[^>]*class=["\'][^"\']*{re.escape(class_name)}[^"\']*["\'][^>]*>(.*?)</{tag}>',
                re.IGNORECASE | re.DOTALL
            )
        else:
            pattern = re.compile(
                rf'<{tag}[^>]*>(.*?)</{tag}>',
                re.IGNORECASE | re.DOTALL
            )
        return [self.clean_text(m) for m in pattern.findall(html)]
```

The `extract_tag` method is particularly useful. Instead of writing a new pattern for every tag and class combination, you build patterns dynamically. The `re.escape()` call on the class name prevents special regex characters in class names from breaking the pattern.

```python
patterns = PatternLibrary()

# Use compiled patterns
title_match = patterns.title.search(html)
all_links = patterns.links.findall(html)
headings = patterns.extract_tag(html, 'h2')
prices = patterns.extract_tag(html, 'span', class_name='price')
```


<figure>
  <img src="/assets/img/inline-building-web-scraper-with-regex-practica-3.jpg" alt="Reversed attribute order in meta tags is one of the most common regex failures — always allow for any attribute order." loading="lazy">
  <figcaption>Reversed attribute order in meta tags is one of the most common regex failures — always allow for any attribute order. <span class="img-credit">Photo by cottonbro studio / <a href="https://www.pexels.com" target="_blank" rel="noopener noreferrer">Pexels</a></span></figcaption>
</figure>

## Error Handling: When Patterns Do Not Match

Regex extraction fails silently. `re.search` returns `None`, `re.findall` returns an empty list. Your scraper needs to handle both without crashing.

```python
def safe_extract(pattern, html, group=1, default=None):
    """Safely extract a single value from HTML using a regex pattern."""
    match = pattern.search(html) if hasattr(pattern, 'search') else re.search(pattern, html)
    if match:
        try:
            return match.group(group).strip()
        except IndexError:
            return default
    return default


def safe_extract_all(pattern, html):
    """Safely extract all matches, always returns a list."""
    if hasattr(pattern, 'findall'):
        return pattern.findall(html)
    return re.findall(pattern, html)
```

Use these wrappers everywhere in your scraper. They prevent `AttributeError` from calling `.group()` on `None` and ensure you always get a consistent return type.

```python
title = safe_extract(patterns.title, html, default='No title found')
links = safe_extract_all(patterns.links, html)

print(f"Title: {title}")
print(f"Found {len(links)} links")
```

For more robust error handling, add logging to track which patterns fail on which pages. This is invaluable when a site updates its HTML and your patterns start returning empty results:

```python
import logging

logger = logging.getLogger('regex_scraper')

def extract_with_logging(pattern, html, field_name, url=''):
    """Extract with logging for debugging pattern failures."""
    result = safe_extract(pattern, html)
    if result is None:
        logger.warning(f"Pattern failed for '{field_name}' on {url}")
    return result
```

## The Pitfalls

Regex scraping works well in controlled scenarios, but it has sharp edges that will cut you if you are not careful. Every one of these has cost real developers real debugging time.

### HTML Is Not a Regular Language

This is the fundamental limitation. Regular expressions can match regular languages, and HTML is not one. HTML has nested structures, and regex cannot reliably count nesting depth.

Consider this:

```html
<div class="product-card">
    <div class="inner-wrapper">
        <h2>Product Name</h2>
    </div>
</div>
```

If your card extraction pattern uses `(.*?)</div>`, it will match up to the first `</div>`, which closes `inner-wrapper`, not `product-card`. You get a partial block.

```python
# This breaks on nested divs
broken_pattern = r'<div class="product-card">(.*?)</div>'

# For single-level nesting, you can be more specific
# but this is fragile and does not generalize
workaround = r'<div class="product-card">\s*<div[^>]*>.*?</div>\s*</div>'
```

There is no general regex solution to the nesting problem. If the HTML you are scraping has predictable, shallow nesting, you can work around it. If the nesting varies or goes deep, use a parser.

### Character Encoding Issues

The `response.text` from `requests` is usually correctly decoded, but not always. Some servers send incorrect encoding headers, or the HTML declares one encoding in a meta tag while the server header says another.

```python
def fetch_page_safe(url, timeout=10):
    """Fetch with encoding fallback."""
    headers = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) '
                       'AppleWebKit/537.36 (KHTML, like Gecko) '
                       'Chrome/131.0.0.0 Safari/537.36',
    }
    response = requests.get(url, headers=headers, timeout=timeout)
    response.raise_for_status()

    # Check if encoding was explicitly set by the server
    if response.encoding and response.encoding.lower() != 'iso-8859-1':
        return response.text

    # Try to detect encoding from HTML meta tag
    meta_match = re.search(
        rb'<meta[^>]+charset=["\']?([^"\'\s;>]+)',
        response.content,
        re.IGNORECASE
    )
    if meta_match:
        detected = meta_match.group(1).decode('ascii', errors='ignore')
        response.encoding = detected

    return response.text
```

Notice we use `response.content` (bytes) to look for the charset meta tag, then set the encoding before reading `response.text`. This avoids mojibake (garbled text) that would make your regex patterns match garbage.

### Greedy Matching Eating Too Much

This is the most common regex scraping bug. The difference between `(.*)` and `(.*?)` determines whether your pattern captures too much content.

```python
html_snippet = '<p>First paragraph</p><p>Second paragraph</p>'

# Greedy: captures everything between the first <p> and the LAST </p>
greedy = re.search(r'<p>(.*)</p>', html_snippet)
print(greedy.group(1))
# Output: First paragraph</p><p>Second paragraph

# Non-greedy: captures only up to the first </p>
lazy = re.search(r'<p>(.*?)</p>', html_snippet)
print(lazy.group(1))
# Output: First paragraph
```

Always use `*?`, `+?`, and `??` (non-greedy quantifiers) when extracting content between HTML tags. The greedy versions will reach across multiple tags and produce incorrect results.

A more insidious version of this problem appears with `re.DOTALL`:

```python
# Without DOTALL, . does not match newlines, which naturally limits greediness
# With DOTALL, a greedy .* can consume the entire page

bad_pattern = re.search(r'<div class="target">(.*)</div>', huge_html, re.DOTALL)
# This might match from the first target div to the very last </div> on the page

good_pattern = re.search(r'<div class="target">(.*?)</div>', huge_html, re.DOTALL)
# Non-greedy stops at the first </div> after the target
```

### Brittle Patterns That Break When HTML Changes

Regex patterns encode assumptions about the HTML structure. When the site updates its layout, even minor changes can break your scraper.

```python
# This pattern assumes the price is in a <span> with class "price"
price_v1 = re.compile(r'<span class="price">\$([\d.]+)</span>')

# Site update: they added a data attribute
# <span class="price" data-currency="USD">$29.99</span>
# price_v1 breaks because it expects > immediately after "price"

# More resilient version
price_v2 = re.compile(r'<span[^>]*class=["\'][^"\']*price[^"\']*["\'][^>]*>\$?([\d,.]+)</span>')
```

Tips for writing less brittle patterns:

- Use `[^>]*` to skip unknown attributes
- Match class names with `[^"\']*classname[^"\']*` to handle multiple classes
- Do not depend on whitespace formatting (use `\s*` between tags)
- Use `["\']` to handle both quote types

Even with these precautions, regex patterns will break more often than CSS selectors or XPath queries when a site changes its markup. Budget time for pattern maintenance.

### Missing the DOTALL Flag for Multiline Content

HTML is routinely formatted across multiple lines. Without `re.DOTALL`, the `.` metacharacter does not match newline characters, and your patterns silently fail to match content that spans lines.

```python
multiline_html = """
<div class="product-card">
    <h2>Product Name</h2>
    <span class="price">$19.99</span>
</div>
"""

# Without DOTALL: no match, because .* cannot cross the newline
no_dotall = re.search(r'<div class="product-card">(.*?)</div>', multiline_html)
print(no_dotall)  # None

# With DOTALL: matches correctly
with_dotall = re.search(r'<div class="product-card">(.*?)</div>', multiline_html, re.DOTALL)
print(with_dotall.group(1))
# Output:
#     <h2>Product Name</h2>
#     <span class="price">$19.99</span>
```

Make `re.DOTALL` your default flag for any pattern that extracts content between tags. The only time to omit it is when you specifically want to restrict matching to a single line.

## When Regex Works vs When to Use a Parser

Regex scraping is the right tool when:

- You need to extract a small number of specific fields from well-structured HTML
- You are working in an environment where you cannot install BeautifulSoup or lxml
- The HTML is generated by a template and has very consistent structure
- Performance matters and you want to avoid the overhead of building a DOM tree
- You are extracting data from non-HTML text that happens to be inside a webpage (embedded JSON, inline scripts, CSV data)

Switch to a proper parser when:

- The HTML has deeply nested structures you need to traverse
- You need to extract data based on relationships between elements (parent, sibling, child) -- for example, [automating form filling](/posts/how-to-automate-web-form-filling-complete-guide/) requires understanding label-input relationships
- The site's HTML changes frequently and you need more resilient selectors
- You are scraping complex pages with hundreds of elements -- at that scale, a [browser automation framework](/posts/playwright-vs-puppeteer-vs-selenium-vs-scrapy-2026-mega-comparison/) is usually the better choice
- The extraction logic requires understanding the document tree (like "the third table in the second section")

For extraction tasks that go beyond what regex and parsers handle well, [LLM-powered data extraction](/posts/best-llm-structured-data-extraction-html-2026/) and [schema-driven scraping with structured output](/posts/llm-powered-data-extraction-schema-driven-scraping-with-structured-output/) offer compelling alternatives. One hybrid approach that works well in practice: use regex to extract embedded JSON or script blocks, then parse the structured data normally.

```python
import json

def extract_json_ld(html):
    """Extract JSON-LD structured data from script tags."""
    pattern = r'<script\s+type=["\']application/ld\+json["\'][^>]*>(.*?)</script>'
    matches = re.findall(pattern, html, re.IGNORECASE | re.DOTALL)
    results = []
    for match in matches:
        try:
            data = json.loads(match.strip())
            results.append(data)
        except json.JSONDecodeError:
            continue
    return results
```

This is arguably the strongest use case for regex in scraping. JSON-LD blocks are self-contained, predictable, and the regex just extracts the raw JSON string for `json.loads` to handle. Once you have that structured data, you can validate it against a schema using tools like Pydantic or Zod -- an approach we explore in our post on [schema-driven scraping with LLMs](/posts/schema-driven-scraping-llms-pydantic-zod-structured-output/).

## Complete Working Script

Here is the full scraper assembled into a single working script. It fetches a page and runs all of the extraction functions we built:

```python
#!/usr/bin/env python3
"""
Regex Web Scraper - Extract structured data from HTML using only regex.
No BeautifulSoup, no lxml, just requests and re.
"""

import re
import json
import logging
import requests

logging.basicConfig(level=logging.INFO, format='%(levelname)s: %(message)s')
logger = logging.getLogger('regex_scraper')


class RegexScraper:
    """A web scraper that uses regex for all HTML extraction."""

    def __init__(self):
        flags = re.IGNORECASE | re.DOTALL

        # Compiled patterns
        self.p_title = re.compile(r'<title[^>]*>(.*?)</title>', flags)
        self.p_links = re.compile(
            r'<a\s+[^>]*href=["\']([^"\']+)["\'][^>]*>(.*?)</a>', flags
        )
        self.p_meta_name = re.compile(
            r'<meta\s+[^>]*name=["\']([^"\']+)["\'][^>]*content=["\']([^"\']*)["\'][^>]*/?>',
            flags
        )
        self.p_meta_name_rev = re.compile(
            r'<meta\s+[^>]*content=["\']([^"\']*)["\'][^>]*name=["\']([^"\']+)["\'][^>]*/?>',
            flags
        )
        self.p_meta_property = re.compile(
            r'<meta\s+[^>]*property=["\']([^"\']+)["\'][^>]*content=["\']([^"\']*)["\'][^>]*/?>',
            flags
        )
        self.p_json_ld = re.compile(
            r'<script\s+type=["\']application/ld\+json["\'][^>]*>(.*?)</script>',
            flags
        )
        self.p_tags = re.compile(r'<[^>]+>')
        self.p_whitespace = re.compile(r'\s+')

    def fetch(self, url, timeout=10):
        """Fetch a webpage and return its HTML."""
        headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) '
                           'AppleWebKit/537.36 (KHTML, like Gecko) '
                           'Chrome/131.0.0.0 Safari/537.36',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
            'Accept-Language': 'en-US,en;q=0.5',
        }
        response = requests.get(url, headers=headers, timeout=timeout)
        response.raise_for_status()

        # Encoding detection fallback
        if not response.encoding or response.encoding.lower() == 'iso-8859-1':
            meta_match = re.search(
                rb'<meta[^>]+charset=["\']?([^"\'\s;>]+)',
                response.content,
                re.IGNORECASE
            )
            if meta_match:
                response.encoding = meta_match.group(1).decode('ascii', errors='ignore')

        return response.text

    def clean_text(self, text):
        """Remove HTML tags and normalize whitespace."""
        text = self.p_tags.sub(' ', text)
        text = self.p_whitespace.sub(' ', text)
        return text.strip()

    def extract_title(self, html):
        """Extract the page title."""
        match = self.p_title.search(html)
        return match.group(1).strip() if match else None

    def extract_links(self, html):
        """Extract all links with their href and anchor text."""
        matches = self.p_links.findall(html)
        links = []
        for href, text in matches:
            clean_text = self.clean_text(text)
            if href and clean_text:
                links.append({'href': href, 'text': clean_text})
        return links

    def extract_meta(self, html):
        """Extract meta tags as a dictionary."""
        meta = {}
        for name, content in self.p_meta_name.findall(html):
            meta[name.lower()] = content
        for content, name in self.p_meta_name_rev.findall(html):
            if name.lower() not in meta:
                meta[name.lower()] = content
        for prop, content in self.p_meta_property.findall(html):
            meta[prop.lower()] = content
        return meta

    def extract_json_ld(self, html):
        """Extract JSON-LD structured data."""
        results = []
        for match in self.p_json_ld.findall(html):
            try:
                results.append(json.loads(match.strip()))
            except json.JSONDecodeError:
                continue
        return results

    def extract_by_tag(self, html, tag, class_name=None):
        """Extract content from specific tags, optionally filtered by class."""
        if class_name:
            pattern = re.compile(
                rf'<{tag}\s+[^>]*class=["\'][^"\']*{re.escape(class_name)}[^"\']*["\'][^>]*>(.*?)</{tag}>',
                re.IGNORECASE | re.DOTALL
            )
        else:
            pattern = re.compile(
                rf'<{tag}[^>]*>(.*?)</{tag}>',
                re.IGNORECASE | re.DOTALL
            )
        return [self.clean_text(m) for m in pattern.findall(html)]

    def scrape(self, url):
        """Scrape a URL and return all extracted data."""
        logger.info(f"Fetching {url}")
        html = self.fetch(url)
        logger.info(f"Fetched {len(html)} characters")

        data = {
            'url': url,
            'title': self.extract_title(html),
            'meta': self.extract_meta(html),
            'links': self.extract_links(html),
            'json_ld': self.extract_json_ld(html),
        }

        logger.info(f"Extracted: title={bool(data['title'])}, "
                     f"meta_tags={len(data['meta'])}, "
                     f"links={len(data['links'])}, "
                     f"json_ld={len(data['json_ld'])}")

        return data


def main():
    scraper = RegexScraper()

    # Scrape example.com
    result = scraper.scrape('https://example.com')

    print(f"\nTitle: {result['title']}")

    print(f"\nMeta tags ({len(result['meta'])}):")
    for key, value in result['meta'].items():
        print(f"  {key}: {value}")

    print(f"\nLinks ({len(result['links'])}):")
    for link in result['links']:
        print(f"  {link['text']} -> {link['href']}")

    if result['json_ld']:
        print(f"\nJSON-LD blocks ({len(result['json_ld'])}):")
        for block in result['json_ld']:
            print(f"  {json.dumps(block, indent=2)[:200]}")

    # Export as JSON
    print(f"\n--- JSON Output ---")
    print(json.dumps(result, indent=2))


if __name__ == '__main__':
    main()
```

Save this as `regex_scraper.py` and run it with `python regex_scraper.py`. It will fetch `https://example.com`, extract all available data, and print both a human-readable summary and a JSON export.

## Recommendations

If you are going to build scrapers with regex, keep these guidelines in mind:

1. **Always use non-greedy quantifiers** (`*?`, `+?`) when extracting content between tags. Greedy matching is the source of most regex scraping bugs.

2. **Always include `re.DOTALL`** in your flags for any pattern that extracts content from HTML. Real HTML spans multiple lines.

3. **Compile your patterns** with `re.compile()` and store them in a class or module. You get better performance and a single place to update patterns when the HTML changes.

4. **Use the two-phase approach** for repeating data: first extract the containing block, then parse fields within each block. Never try to match all fields in one pattern across the full page.

5. **Wrap every extraction in a safety check.** `re.search` returns `None`, and calling `.group()` on `None` is the most common crash in regex scrapers.

6. **Know when to stop.** If you find yourself writing patterns to handle three levels of nesting or attribute order permutations, you have crossed the line where a parser would be simpler and more reliable.

7. **Use regex for its strongest scraping use case:** extracting embedded JSON, script blocks, and non-HTML structured data from within HTML pages. Let `json.loads` or `csv.reader` handle the parsing of the actual data.

Regex is not the best general-purpose HTML extraction tool, but it is a capable and sometimes ideal one when you understand its boundaries. The scraper we built here handles the common cases cleanly, and the pattern library approach keeps it maintainable as the sites you scrape evolve.
