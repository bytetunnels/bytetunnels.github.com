---
title: "Email Regex Patterns for Web Scraping: Reliable Extraction"
date: 2026-03-02 10:00:00 +0000
categories: ["Data Extraction"]
tags: ["regex", "email", "web scraping", "python", "data extraction", "pattern matching"]
author: arman
image:
  path: /assets/img/2026-03-02-email-regex-patterns-web-scraping-reliable-extraction-hero.png
  alt: "Email Regex Patterns for Web Scraping: Reliable Extraction"
---

Email extraction is one of the most common web scraping tasks, and one of the trickiest to get right with regex. The problem sounds simple -- find every email address on a page -- but the reality involves plus addressing, subdomains, obfuscated addresses, and an alarming number of false positives that look like emails but are not. A naive pattern will miss valid addresses or match filenames and CSS artifacts. A pattern that tries to follow the full RFC 5322 specification will be hundreds of characters long and still not cover every edge case. This post walks through practical email regex patterns at different levels of strictness, shows complete working code in Python and JavaScript, and covers the filtering and deduplication steps that turn raw matches into a clean list of real email addresses. If you are new to using regex for scraping in general, our guide on [regex for web scraping without a parser](/posts/regex-for-web-scraping-extracting-data-without-parser/) covers the fundamentals.

## The Basic Email Pattern

The simplest useful email regex looks like this:

```python
[\w.-]+@[\w.-]+\.\w+
```

This pattern matches one or more word characters, dots, or hyphens before the `@`, then the same set after the `@`, followed by a dot and one or more word characters for the top-level domain. It will catch the majority of everyday email addresses.

```python
import re

pattern = r'[\w.-]+@[\w.-]+\.\w+'
text = "Contact us at info@example.com or sales@company.org"

matches = re.findall(pattern, text)
print(matches)
# ['info@example.com', 'sales@company.org']
```

What this pattern catches:

- Standard addresses: `user@example.com`
- Dots in the local part: `first.last@example.com`
- Hyphens in the domain: `user@my-company.com`
- Subdomains: `user@mail.example.com`

What it misses or gets wrong:

- Plus addressing: `user+tag@example.com` -- the `+` is not in `[\w.-]`
- Quoted local parts: `"user name"@example.com` -- rare but valid
- It will match trailing dots: `user@example.com.` -- the final dot gets swallowed into the match
- It will match things that are not emails, like `image@2x.png`

The basic pattern is a reasonable starting point for quick extraction, but most real scraping tasks need something more robust.

## A Practical Middle-Ground Pattern

The full RFC 5322 email specification allows an extraordinary range of characters in the local part, including quoted strings with spaces and special characters. Matching the entire spec with a single regex produces a pattern that is hundreds of characters long, nearly impossible to debug, and still imperfect. In practice, you do not need to match every theoretically valid address. You need to match the addresses that real people actually use.

Here is a practical middle-ground pattern that covers plus addressing, hyphens, dots, and multi-part TLDs while filtering out most false positives:

```python
[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}
```

Breaking it down:

- `[a-zA-Z0-9._%+-]+` -- the local part: letters, digits, dots, underscores, percent signs, plus signs, and hyphens
- `@` -- the literal at sign
- `[a-zA-Z0-9.-]+` -- the domain: letters, digits, dots, and hyphens
- `\.[a-zA-Z]{2,}` -- a dot followed by at least two letters for the TLD

This pattern handles the common edge cases that the basic pattern misses:

```python
import re

pattern = r'[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}'

test_addresses = [
    "simple@example.com",
    "first.last@example.com",
    "user+tag@example.com",
    "user@sub.domain.example.com",
    "hyphen-user@my-company.co.uk",
    "underscore_user@example.org",
]

for addr in test_addresses:
    match = re.fullmatch(pattern, addr)
    print(f"{addr:40s} -> {'MATCH' if match else 'NO MATCH'}")
```

```
simple@example.com                       -> MATCH
first.last@example.com                   -> MATCH
user+tag@example.com                     -> MATCH
user@sub.domain.example.com              -> MATCH
hyphen-user@my-company.co.uk             -> MATCH
underscore_user@example.org              -> MATCH
```

The `{2,}` at the end is important. It prevents the pattern from matching things like `file@v1.0` where the characters after the dot are digits or a single letter. Real TLDs are at least two characters long.

## Common Edge Cases

Even with a solid middle-ground pattern, email extraction on real web pages will throw surprises at you. Here are the cases that come up most often.

### Plus Addressing

Services like Gmail allow users to add tags after a `+` sign: `user+newsletter@gmail.com` still delivers to `user@gmail.com`. The middle-ground pattern handles this because `+` is in the character class. The basic `[\w.-]` pattern does not.

### Subdomains

Corporate and institutional emails often use subdomains: `researcher@cs.university.edu` or `support@help.service.example.com`. Both patterns handle this because dots are allowed in the domain character class. However, watch for false matches where multiple dots appear in non-email contexts.

### Consecutive Dots and Edge Characters

Technically, `user..name@example.com` is invalid per RFC 5322 -- consecutive dots in the local part are not allowed without quoting. Most regex patterns will still match it. If strict validation matters, add a negative lookahead:

```python
# Reject consecutive dots in the local part
pattern = r'(?![a-zA-Z0-9._%+-]*\.\.)[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}'
```

### International Domain Names

Internationalized email addresses can include non-ASCII characters in both the local part and the domain. These are still relatively rare in the wild, but if you need to handle them, you can broaden the character classes or use a dedicated email validation library instead of regex.

## Python Implementation

Here is a complete working script that fetches a web page and extracts email addresses using [`requests`](/posts/python-requests-vs-selenium-speed-performance-comparison/) and `re`:

```python
import re
import requests

def extract_emails(url):
    """Fetch a page and extract all email addresses."""
    headers = {
        "User-Agent": "Mozilla/5.0 (compatible; EmailExtractor/1.0)"
    }

    response = requests.get(url, headers=headers, timeout=10)
    response.raise_for_status()

    html = response.text

    # Middle-ground email pattern
    pattern = r'[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}'
    raw_matches = re.findall(pattern, html)

    return raw_matches

if __name__ == "__main__":
    url = "https://example.com/contact"
    emails = extract_emails(url)

    for email in emails:
        print(email)
```

The `re.findall()` function returns a list of all non-overlapping matches in the string. Unlike `re.search()` which stops at the first match, `findall` scans the entire document and returns every email it finds.

If you need the position of each match in the source HTML -- useful for context extraction or debugging -- use `re.finditer()` instead:

```python
for match in re.finditer(pattern, html):
    email = match.group()
    start = match.start()
    # Get surrounding context (50 chars on each side)
    context = html[max(0, start - 50):start + len(email) + 50]
    print(f"{email} -- found near: ...{context}...")
```


<figure>
  <img src="/assets/img/inline-email-regex-patterns-web-scraping-reliab-1.jpg" alt="Patterns are everywhere — regex helps you find the ones that matter." loading="lazy">
  <figcaption>Patterns are everywhere — regex helps you find the ones that matter. <span class="img-credit">Photo by Memet Öz / <a href="https://www.pexels.com" target="_blank" rel="noopener noreferrer">Pexels</a></span></figcaption>
</figure>

## JavaScript Implementation

The equivalent in JavaScript uses `String.prototype.matchAll()`, which returns an iterator of match objects:

```javascript
async function extractEmails(url) {
  const response = await fetch(url);
  const html = await response.text();

  const pattern = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
  const matches = [...html.matchAll(pattern)];

  return matches.map((match) => match[0]);
}

// Usage
extractEmails("https://example.com/contact").then((emails) => {
  emails.forEach((email) => console.log(email));
});
```

Note the `g` flag on the regex -- without it, `matchAll` would throw an error. The global flag tells the engine to find all matches rather than stopping at the first one.

For Node.js scraping with a real HTTP client:

```javascript
const https = require("https");

function fetchPage(url) {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      let data = "";
      res.on("data", (chunk) => (data += chunk));
      res.on("end", () => resolve(data));
      res.on("error", reject);
    });
  });
}

async function extractEmails(url) {
  const html = await fetchPage(url);
  const pattern = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
  return [...html.matchAll(pattern)].map((m) => m[0]);
}
```

## Filtering False Positives

Raw regex matches on HTML pages will include things that look like emails but are not. Here are the most common false positives and how to filter them out.

### Image Filenames and Asset References

Retina image references like `icon@2x.png` or `logo@3x.jpg` match the basic email pattern. The middle-ground pattern with `[a-zA-Z]{2,}` for the TLD will catch `photo@2x.png` because `png` is three letters long. Filter these out by checking for common file extensions:

```python
import re

IMAGE_EXTENSIONS = {
    "png", "jpg", "jpeg", "gif", "svg", "webp",
    "bmp", "ico", "tiff", "avif"
}

ASSET_EXTENSIONS = IMAGE_EXTENSIONS | {
    "css", "js", "woff", "woff2", "ttf", "eot", "map"
}

def is_false_positive(email):
    """Check if a matched string is likely not a real email."""
    # Check for file extensions masquerading as TLDs
    tld = email.rsplit(".", 1)[-1].lower()
    if tld in ASSET_EXTENSIONS:
        return True

    # Check for @2x, @3x retina patterns
    local_part = email.split("@")[0]
    domain_part = email.split("@")[1]
    if re.match(r'^\dx', domain_part):
        return True

    # Check for very short domains (likely not real)
    if len(domain_part) < 4:
        return True

    return False

def extract_clean_emails(html):
    pattern = r'[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}'
    raw_matches = re.findall(pattern, html)
    return [e for e in raw_matches if not is_false_positive(e)]
```

### CSS and Encoded Strings

Minified CSS sometimes contains sequences that look like email patterns. Base64-encoded strings and URL-encoded content can also produce false matches. If you are scraping HTML, it helps to strip out `<style>` and `<script>` tags before running the regex:

```python
def strip_tags(html, tag_names):
    """Remove specified tags and their contents from HTML."""
    for tag in tag_names:
        html = re.sub(
            rf'<{tag}[^>]*>.*?</{tag}>',
            '',
            html,
            flags=re.DOTALL | re.IGNORECASE
        )
    return html

def extract_visible_emails(html):
    """Extract emails only from visible page content."""
    cleaned = strip_tags(html, ["style", "script", "noscript"])
    pattern = r'[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}'
    raw_matches = re.findall(pattern, cleaned)
    return [e for e in raw_matches if not is_false_positive(e)]
```

## Handling Obfuscated Emails

Many websites deliberately obfuscate email addresses to prevent automated extraction. Here are the most common techniques and how to decode them.

### Text-Based Obfuscation

The classic approach replaces `@` and `.` with words:

- `user [at] domain [dot] com`
- `user(at)domain(dot)com`
- `user AT domain DOT com`

```python
def deobfuscate_text_emails(text):
    """Find and decode text-obfuscated email addresses."""
    # Normalize common obfuscation patterns
    patterns = [
        # user [at] domain [dot] com
        r'([a-zA-Z0-9._%+-]+)\s*[\[\(]\s*at\s*[\]\)]\s*'
        r'([a-zA-Z0-9.-]+)\s*[\[\(]\s*dot\s*[\]\)]\s*'
        r'([a-zA-Z]{2,})',

        # user AT domain DOT com (with spaces)
        r'([a-zA-Z0-9._%+-]+)\s+at\s+'
        r'([a-zA-Z0-9.-]+)\s+dot\s+'
        r'([a-zA-Z]{2,})',
    ]

    emails = []
    for pattern in patterns:
        for match in re.finditer(pattern, text, re.IGNORECASE):
            local, domain, tld = match.group(1), match.group(2), match.group(3)
            emails.append(f"{local}@{domain}.{tld}")

    return emails

text = "Reach us at support [at] example [dot] com or sales(at)company(dot)org"
print(deobfuscate_text_emails(text))
# ['support@example.com', 'sales@company.org']
```

### HTML Entity Encoding

Some sites encode the `@` symbol as `&#64;` or `&#x40;` and dots as `&#46;`:

```python
import html

def decode_html_emails(raw_html):
    """Decode HTML entities, then extract emails normally."""
    decoded = html.unescape(raw_html)
    pattern = r'[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}'
    return re.findall(pattern, decoded)

# &#64; is @, &#46; is .
encoded = "Contact: user&#64;example&#46;com"
print(decode_html_emails(encoded))
# ['user@example.com']
```

### JavaScript-Based Obfuscation

Some pages construct email addresses in JavaScript, concatenating strings or using character codes:

```javascript
// Common JS obfuscation patterns
var user = "contact";
var domain = "example.com";
document.getElementById("email").href = "mailto:" + user + "@" + domain;
```

Regex alone cannot handle this. You need to either execute the JavaScript using a browser automation tool like [Playwright](/posts/playwright-vs-puppeteer-speed-stealth-developer-experience/) or [Puppeteer](/posts/top-puppeteer-alternatives-what-to-use-instead/), or parse the JavaScript to find the string concatenation patterns. For the second approach:

```python
def extract_mailto_from_js(html):
    """Extract emails constructed via mailto: in JavaScript."""
    # Match mailto: links already assembled in HTML
    mailto_pattern = r'mailto:([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})'
    return re.findall(mailto_pattern, html)

    # For JS string concatenation, a browser-based approach
    # with Playwright is more reliable -- see our posts on
    # browser automation for details.
```

### Reversed Strings

Another technique writes the email backwards in the HTML and reverses it with CSS or JavaScript:

```python
def check_reversed_emails(text):
    """Check for reversed email addresses."""
    pattern = r'[a-zA-Z]{2,}\.[a-zA-Z0-9.-]+@[a-zA-Z0-9._%+-]+'
    reversed_matches = re.findall(pattern, text)
    return [m[::-1] for m in reversed_matches]

# moc.elpmaxe@resu reversed is user@example.com
text = "moc.elpmaxe@resu"
print(check_reversed_emails(text))
# ['user@example.com']
```

## De-duplication and Normalization

After extraction, you will usually have duplicates and inconsistent casing. Email addresses are case-insensitive in the domain part (and conventionally in the local part for most providers), so normalization matters.

```python
def normalize_and_deduplicate(emails):
    """Normalize email addresses and remove duplicates."""
    seen = set()
    unique = []

    for email in emails:
        # Lowercase the entire address
        normalized = email.lower().strip()

        # Remove trailing dots or punctuation that got matched
        normalized = normalized.rstrip(".,;:!?)")

        # Remove leading dots or punctuation
        normalized = normalized.lstrip(".(")

        # Skip if we have already seen this address
        if normalized in seen:
            continue

        # Skip obviously invalid results
        if len(normalized) < 6:  # a@b.co is 6 chars
            continue

        seen.add(normalized)
        unique.append(normalized)

    return unique

raw = [
    "User@Example.com",
    "user@example.com",
    "USER@EXAMPLE.COM",
    "admin@example.com.",
    "support@example.com",
    "support@example.com",
]

cleaned = normalize_and_deduplicate(raw)
print(cleaned)
# ['user@example.com', 'admin@example.com', 'support@example.com']
```

For large-scale scraping, you might also want to sort the results by domain to group addresses from the same organization:

```python
def sort_by_domain(emails):
    """Sort email addresses by domain, then by local part."""
    return sorted(emails, key=lambda e: (e.split("@")[1], e.split("@")[0]))
```

## Ethical and Legal Considerations

Email scraping sits in a legally sensitive area. Before building or running an email extraction tool, you need to understand the rules.

**GDPR (EU/UK):** Email addresses are personal data under the General Data Protection Regulation. Collecting them without a lawful basis -- such as legitimate interest or consent -- can result in significant fines. Scraping emails from public web pages does not automatically give you the right to use them for marketing.

**CAN-SPAM Act (US):** While CAN-SPAM primarily regulates sending commercial emails, the source of your email list matters. Sending unsolicited emails to scraped addresses without an unsubscribe mechanism violates the act.

**Terms of Service:** Most websites explicitly prohibit automated data collection in their terms of service. Scraping emails from a site that forbids it can expose you to legal action regardless of what the email-specific regulations say. For more on the legal landscape of scraping, see our post on [whether robots.txt is legally binding](/posts/is-robots-txt-legally-binding-scraping-law-explained/).

**Best practices:**

- Only scrape emails from pages where they are clearly published for public contact purposes
- Respect [`robots.txt` directives](/posts/ietf-aipref-the-new-robots-txt-for-the-ai-era/)
- Do not use scraped emails for unsolicited marketing
- Store and process collected data in compliance with applicable privacy laws
- Consider whether an API or public directory would serve your needs better than scraping

## Complete Working Example

Here is a full pipeline that combines everything -- fetching, extraction, deobfuscation, filtering, and deduplication:

```python
import re
import html
import requests

# --- Configuration ---
EMAIL_PATTERN = r'[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}'
MAILTO_PATTERN = r'mailto:([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})'

FALSE_POSITIVE_TLDS = {
    "png", "jpg", "jpeg", "gif", "svg", "webp", "bmp", "ico",
    "css", "js", "woff", "woff2", "ttf", "eot", "map", "avif"
}


def fetch_page(url):
    """Fetch a web page and return its HTML content."""
    headers = {
        "User-Agent": "Mozilla/5.0 (compatible; EmailExtractor/1.0)"
    }
    response = requests.get(url, headers=headers, timeout=15)
    response.raise_for_status()
    return response.text


def strip_non_visible(raw_html):
    """Remove script, style, and noscript tags."""
    for tag in ["script", "style", "noscript"]:
        raw_html = re.sub(
            rf'<{tag}[^>]*>.*?</{tag}>',
            '', raw_html,
            flags=re.DOTALL | re.IGNORECASE
        )
    return raw_html


def decode_obfuscation(text):
    """Decode HTML entities and common text obfuscation."""
    # Decode HTML entities like &#64; -> @
    text = html.unescape(text)

    # Replace [at] / (at) / [dot] / (dot) patterns
    text = re.sub(r'\s*[\[\(]\s*at\s*[\]\)]\s*', '@', text, flags=re.IGNORECASE)
    text = re.sub(r'\s*[\[\(]\s*dot\s*[\]\)]\s*', '.', text, flags=re.IGNORECASE)

    return text


def is_false_positive(email):
    """Determine if a match is likely not a real email."""
    tld = email.rsplit(".", 1)[-1].lower()
    if tld in FALSE_POSITIVE_TLDS:
        return True

    domain = email.split("@")[1]
    if re.match(r'^\dx', domain):
        return True

    if len(domain) < 4:
        return True

    return False


def normalize_and_deduplicate(emails):
    """Clean, normalize, and deduplicate email addresses."""
    seen = set()
    unique = []

    for email in emails:
        normalized = email.lower().strip().rstrip(".,;:!?)").lstrip(".(")

        if normalized in seen or len(normalized) < 6:
            continue

        seen.add(normalized)
        unique.append(normalized)

    return unique


def extract_emails(url):
    """Full pipeline: fetch, clean, extract, filter, deduplicate."""
    raw_html = fetch_page(url)

    # Step 1: Extract mailto: links before stripping tags
    mailto_emails = re.findall(MAILTO_PATTERN, raw_html)

    # Step 2: Strip non-visible content
    visible_html = strip_non_visible(raw_html)

    # Step 3: Decode obfuscation
    decoded_html = decode_obfuscation(visible_html)

    # Step 4: Extract with regex
    regex_emails = re.findall(EMAIL_PATTERN, decoded_html)

    # Step 5: Combine all sources
    all_emails = mailto_emails + regex_emails

    # Step 6: Filter false positives
    filtered = [e for e in all_emails if not is_false_positive(e)]

    # Step 7: Normalize and deduplicate
    return normalize_and_deduplicate(filtered)


if __name__ == "__main__":
    import sys

    target_url = sys.argv[1] if len(sys.argv) > 1 else "https://example.com"

    print(f"Extracting emails from: {target_url}\n")

    try:
        emails = extract_emails(target_url)

        if emails:
            print(f"Found {len(emails)} unique email(s):\n")
            for email in sorted(emails, key=lambda e: (e.split("@")[1], e.split("@")[0])):
                print(f"  {email}")
        else:
            print("No email addresses found.")

    except requests.RequestException as e:
        print(f"Error fetching page: {e}")
```

Run it from the command line with any URL:

```bash
python extract_emails.py https://example.com/contact
```

The pipeline works in stages. First it grabs `mailto:` links from the raw HTML, since these are the highest-confidence matches. Then it strips out `<script>` and `<style>` blocks to avoid false positives from minified code. Next it decodes HTML entities and common text obfuscation. The regex runs on the cleaned text, and the results from both passes are combined, filtered, and deduplicated.

For pages that build their content with JavaScript, this pipeline will not be enough. You will need a [browser automation tool](/posts/how-to-automate-web-form-filling-complete-guide/) to render the page first -- [Playwright in particular](/posts/playwright-for-browser-automation-in-ai-agents/) works well for this. Alternatively, [LLM-based extraction](/posts/best-llm-structured-data-extraction-html-2026/) and [schema-driven scraping with structured output](/posts/schema-driven-scraping-llms-pydantic-zod-structured-output/) can handle complex pages where regex and simple parsing fall short.

The patterns in this post cover the vast majority of email addresses you will encounter on real web pages. Start with the middle-ground pattern, add false positive filtering, and handle obfuscation as you encounter it. The complete pipeline above is a solid starting point that you can extend for your specific use case. For a hands-on walkthrough of building a full regex-powered scraper, see our post on [building a web scraper with regex](/posts/building-web-scraper-with-regex-practical-patterns-pitfalls/).
