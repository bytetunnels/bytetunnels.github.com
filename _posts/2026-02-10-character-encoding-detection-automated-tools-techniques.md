---
title: "Character Encoding Detection: Automated Tools and Techniques"
date: 2026-02-10 16:00:00 +0000
categories: ["Data Extraction"]
tags: ["character encoding", "detection", "chardet", "python", "utf-8", "text processing", "web scraping"]
author: arman
image:
  path: /assets/img/2026-02-10-character-encoding-detection-automated-tools-techniques-hero.png
  alt: "Character Encoding Detection: Automated Tools and Techniques"
---

When you scrape the web at scale, you will encounter pages encoded in UTF-8, Latin-1, Windows-1252, Shift_JIS, EUC-KR, and dozens of other character sets. Most of the time things just work because the majority of the modern web has settled on UTF-8. But the moment you hit a legacy site, a government portal from the early 2000s, or a Japanese e-commerce page, you are one wrong decode call away from mojibake -- those garbled sequences of characters like `Ã©` where you expected `e` or `锘?` where you expected clean text. Detecting the correct encoding before decoding is the difference between a clean dataset and hours of manual cleanup.

This post covers the tools and techniques for automated character encoding detection in Python, from standalone libraries to the detection logic built into `requests`, and the full chain of signals you should check before falling back to statistical guessing.

## How Encoding Detection Works

Character encoding detection is fundamentally a classification problem. Given a sequence of raw bytes, the detector tries to figure out which encoding produced them. It does this through statistical analysis of byte patterns.

Every encoding has a fingerprint. UTF-8 has strict rules about which byte sequences are valid -- a byte starting with `110xxxxx` must be followed by a byte starting with `10xxxxxx`. Shift_JIS uses byte ranges that overlap with ASCII but have distinct patterns in the upper half. ISO-8859-1 allows any single byte value from 0x00 to 0xFF, making it a universal fallback but also the hardest to positively identify.

Detectors work by running the byte sequence through a set of probers, one per candidate encoding. Each prober tracks how well the bytes conform to the expected patterns and assigns a confidence score. The encoding with the highest confidence wins.

```
Raw bytes: b'\xc3\xa9'

UTF-8 prober:   0xC3 followed by 0xA9 -> valid 2-byte sequence -> high confidence
Latin-1 prober: 0xC3 = "A tilde", 0xA9 = copyright sign -> valid but unusual pair -> lower confidence
Shift_JIS prober: 0xC3A9 -> not a valid lead byte -> very low confidence

Result: UTF-8 with high confidence -> decoded as "e"
```

This approach works surprisingly well in practice, but it is not perfect. Short byte sequences provide less statistical signal, and some encodings are genuinely ambiguous -- a valid Windows-1252 sequence can also be valid ISO-8859-1, since the two differ in only 32 code points.

## Python Tools for Encoding Detection

Three libraries dominate the Python encoding detection space. For a head-to-head breakdown of [chardet, cchardet, and charset-normalizer](/posts/charset-detection-python-chardet-cchardet-charset-normalizer/), we have a dedicated comparison. Each makes different tradeoffs between accuracy, speed, and maintenance status.

### chardet: The Classic

`chardet` is a port of Mozilla's automatic charset detection algorithm. It has been the go-to library for over a decade and is a dependency of the `requests` library.

```python
import chardet

# Detect encoding from raw bytes
raw_bytes = b'\xe4\xb8\xad\xe6\x96\x87\xe6\xb5\x8b\xe8\xaf\x95'
result = chardet.detect(raw_bytes)

print(result)
# {'encoding': 'utf-8', 'confidence': 0.99, 'language': 'Chinese'}

# Use the detected encoding to decode
text = raw_bytes.decode(result['encoding'])
print(text)
# 中文测试
```

The return value is always a dictionary with three keys: `encoding` (the detected encoding name or `None`), `confidence` (a float from 0 to 1), and `language` (a string hint or empty string).

For large files or streaming data, `chardet` provides an incremental detector that processes data in chunks:

```python
import chardet

detector = chardet.UniversalDetector()

with open('mystery_file.txt', 'rb') as f:
    for line in f:
        detector.feed(line)
        if detector.done:
            break

detector.close()
result = detector.result
print(result)
# {'encoding': 'EUC-JP', 'confidence': 0.93, 'language': 'Japanese'}
```

The incremental approach is essential when dealing with large files. There is no point reading an entire 500MB file into memory when the first few kilobytes usually provide enough signal for a confident detection.

**Strengths:** Battle-tested, wide encoding support, dependency of `requests`.
**Weaknesses:** Slow on large inputs. Pure Python implementation means detection can take seconds on multi-megabyte files.

### charset-normalizer: The Modern Replacement

`charset-normalizer` was created as a drop-in replacement for `chardet` with better performance and a different detection philosophy. Instead of porting Mozilla's algorithm, it uses a coherence-based approach that analyzes whether decoded text "looks like" real language.

```python
from charset_normalizer import detect, from_bytes

# Simple detection (chardet-compatible API)
raw_bytes = b'\xc0\xce\xc5\xcd\xb3\xdd \xc8\xab\xc6\xe4\xc0\xcc\xc1\xf6'
result = detect(raw_bytes)
print(result)
# {'encoding': 'euc-kr', 'confidence': 0.85, 'language': 'Korean'}

# Advanced API: get multiple candidates ranked by confidence
results = from_bytes(raw_bytes)

for match in results:
    print(f"Encoding: {match.encoding}, Confidence: {match.coherence}")
    print(f"  Decoded: {str(match)[:50]}")
```

The `from_bytes()` function returns all plausible encodings ranked by a coherence score, which is useful when you want to present options or apply domain-specific heuristics to pick the best one.

```python
from charset_normalizer import from_bytes

raw_bytes = b'\xe9\xe8\xea\xeb'

results = from_bytes(raw_bytes)
best = results.best()

if best is not None:
    print(f"Best encoding: {best.encoding}")
    print(f"Decoded text: {str(best)}")
else:
    print("Could not detect encoding")
```

**Strengths:** Faster than `chardet`, actively maintained, better handling of edge cases, provides multiple candidates.
**Weaknesses:** Slightly different detection results than `chardet` in some edge cases, so switching mid-project may surface differences.

As of `requests` version 2.29+, `charset-normalizer` is the default fallback detector, replacing `chardet`. If you are using a modern `requests` install, you are already using it.

### cchardet: The Speed Demon

`cchardet` is a Python binding to the C library `uchardet`, which is itself a C++ port of Mozilla's detection code. It offers the same detection logic as `chardet` but runs orders of magnitude faster.

```python
import cchardet

raw_bytes = b'\x82\xb1\x82\xf1\x82\xc9\x82\xbf\x82\xcd\x90\xa2\x8a\x45'
result = cchardet.detect(raw_bytes)
print(result)
# {'encoding': 'SHIFT_JIS', 'confidence': 0.99}
```

The API is intentionally identical to `chardet.detect()`, making it a drop-in replacement for the most common usage pattern.

**Strengths:** Extremely fast -- 10x to 100x faster than `chardet` on large inputs.
**Weaknesses:** The project is deprecated and no longer maintained. Binary wheels may not be available for newer Python versions or platforms. Use it if you need speed on an older codebase, but plan to migrate to `charset-normalizer` for new projects.

### Speed Comparison

Here is a rough benchmark detecting the encoding of a 1MB text file:

```python
import time
import chardet
import cchardet
from charset_normalizer import detect as cn_detect

with open('large_text.bin', 'rb') as f:
    data = f.read()

# chardet
start = time.time()
chardet.detect(data)
print(f"chardet:            {time.time() - start:.3f}s")

# charset-normalizer
start = time.time()
cn_detect(data)
print(f"charset-normalizer: {time.time() - start:.3f}s")

# cchardet
start = time.time()
cchardet.detect(data)
print(f"cchardet:           {time.time() - start:.3f}s")

# Typical results on a 1MB file:
# chardet:            2.150s
# charset-normalizer: 0.340s
# cchardet:           0.012s
```

For most scraping tasks where you are detecting encoding on individual pages (typically 50-500KB), all three are fast enough. The difference becomes meaningful when processing bulk offline data.

## Encoding Detection with requests

The `requests` library has built-in encoding handling that covers the most common scenarios. Understanding how it works helps you know when to trust it and when to override it.

### response.encoding vs response.apparent_encoding

These two attributes serve different purposes:

```python
import requests

response = requests.get('https://example.com/page')

# response.encoding: encoding from the HTTP Content-Type header
# Falls back to 'ISO-8859-1' for text/* content types if no charset is specified
print(response.encoding)
# 'utf-8' (or whatever the server declared)

# response.apparent_encoding: encoding detected by charset-normalizer (or chardet)
# This analyzes the actual response bytes
print(response.apparent_encoding)
# 'utf-8' (detected from byte patterns)

# response.text uses response.encoding to decode
# If the server lied about the encoding, response.text may contain mojibake
print(response.text[:100])
```

The critical thing to understand: `response.text` uses `response.encoding`, not `response.apparent_encoding`. If the server sends a `Content-Type: text/html` header with no charset parameter, `requests` defaults `response.encoding` to `ISO-8859-1` per the HTTP/1.1 spec (RFC 2616). This default is technically correct but practically wrong for many pages that are actually UTF-8.

### Fixing Encoding Before Accessing response.text

The standard pattern for handling potentially misidentified encodings:

```python
import requests

response = requests.get('https://example.com/legacy-page')

# Option 1: Override encoding with detected encoding before accessing .text
response.encoding = response.apparent_encoding
text = response.text

# Option 2: Skip .text entirely and decode bytes yourself
raw = response.content  # raw bytes, no decoding applied
detected = chardet.detect(raw)
text = raw.decode(detected['encoding'])

# Option 3: Try the declared encoding, fall back to detection on error
try:
    text = response.content.decode(response.encoding)
except (UnicodeDecodeError, TypeError):
    text = response.content.decode(response.apparent_encoding)
```

Option 1 is the simplest and works well for most cases. Option 3 is more defensive and avoids running the detector when the declared encoding already works.


<figure>
  <img src="/assets/img/inline-character-encoding-detection-automated-t-1.jpg" alt="Every character has a number, and getting that number wrong breaks everything." loading="lazy">
  <figcaption>Every character has a number, and getting that number wrong breaks everything. <span class="img-credit">Photo by Nataliya Vaitkevich / <a href="https://www.pexels.com" target="_blank" rel="noopener noreferrer">Pexels</a></span></figcaption>
</figure>

## The Encoding Signal Chain

When you fetch a web page, encoding information can come from multiple sources. These sources sometimes contradict each other. Here is the order of precedence you should follow, from most reliable to least:

### 1. Byte Order Mark (BOM)

A BOM is a special byte sequence at the very start of a file that unambiguously identifies the encoding:

```python
def detect_bom(raw_bytes):
    """Check for a Byte Order Mark at the start of the data."""
    bom_map = {
        b'\xef\xbb\xbf': 'utf-8-sig',
        b'\xff\xfe\x00\x00': 'utf-32-le',
        b'\x00\x00\xfe\xff': 'utf-32-be',
        b'\xff\xfe': 'utf-16-le',
        b'\xfe\xff': 'utf-16-be',
    }
    # Check longer BOMs first to avoid false matches
    for bom, encoding in bom_map.items():
        if raw_bytes.startswith(bom):
            return encoding
    return None

raw = b'\xef\xbb\xbfHello World'
bom_encoding = detect_bom(raw)
print(bom_encoding)
# 'utf-8-sig'
```

BOMs are rare on web pages but common in files downloaded from Windows applications (Excel exports, CSV files from legacy systems). When present, they are the most trustworthy signal.

### 2. HTTP Content-Type Header

The server's `Content-Type` header can declare the charset:

```
Content-Type: text/html; charset=utf-8
Content-Type: text/html; charset=iso-8859-1
Content-Type: text/html  (no charset -- ambiguous)
```

```python
import requests
import re

response = requests.get('https://example.com/page')

# Extract charset from Content-Type header
content_type = response.headers.get('Content-Type', '')
match = re.search(r'charset=([^\s;]+)', content_type, re.IGNORECASE)

if match:
    declared_encoding = match.group(1).strip('"\'')
    print(f"Server declared: {declared_encoding}")
else:
    print("No charset in Content-Type header")
```

The HTTP header is generally reliable for well-maintained servers. However, misconfigured servers frequently declare `ISO-8859-1` or `US-ASCII` when the actual content is UTF-8, or declare nothing at all.

### 3. HTML Meta Tags

HTML documents can declare their own encoding in two ways:

```html
<!-- HTML5 style -->
<meta charset="utf-8">

<!-- Older HTML4 style -->
<meta http-equiv="Content-Type" content="text/html; charset=utf-8">
```

Extracting these from raw bytes requires partial parsing before you know the encoding, which creates a chicken-and-egg problem. The standard approach is to scan the first 1024 bytes using ASCII-compatible matching, since encoding declarations are always near the top of the document and use ASCII-range characters:

```python
import re

def detect_html_encoding(raw_bytes):
    """Extract encoding from HTML meta tags in the first 1024 bytes."""
    # Only scan the head of the document
    head = raw_bytes[:1024]

    # Try HTML5 meta charset
    match = re.search(rb'<meta\s+charset=["\']?([^"\'\s>]+)', head, re.IGNORECASE)
    if match:
        return match.group(1).decode('ascii', errors='ignore')

    # Try HTML4 http-equiv
    match = re.search(
        rb'<meta\s+http-equiv=["\']?Content-Type["\']?\s+content=["\']?[^"\']*charset=([^"\'\s;>]+)',
        head,
        re.IGNORECASE
    )
    if match:
        return match.group(1).decode('ascii', errors='ignore')

    return None

raw = b'<!DOCTYPE html><html><head><meta charset="shift_jis"><title>Test</title>'
print(detect_html_encoding(raw))
# 'shift_jis'
```

This works because the meta charset declaration itself is always in ASCII-compatible bytes, even when the rest of the document is in a different encoding.

### 4. Statistical Detection (Fallback)

When none of the explicit signals are present or trustworthy, you fall back to statistical detection:

```python
import chardet

def detect_encoding_chain(raw_bytes, http_charset=None):
    """Apply the full encoding detection chain."""

    # 1. Check for BOM
    bom_encoding = detect_bom(raw_bytes)
    if bom_encoding:
        return bom_encoding, 'bom', 1.0

    # 2. Trust HTTP header if present
    if http_charset:
        # Verify it actually decodes without errors
        try:
            raw_bytes.decode(http_charset)
            return http_charset, 'http_header', 0.95
        except (UnicodeDecodeError, LookupError):
            pass  # Header lied, continue detection

    # 3. Check HTML meta tags
    html_encoding = detect_html_encoding(raw_bytes)
    if html_encoding:
        try:
            raw_bytes.decode(html_encoding)
            return html_encoding, 'html_meta', 0.90
        except (UnicodeDecodeError, LookupError):
            pass  # Meta tag was wrong, continue

    # 4. Statistical detection as final fallback
    result = chardet.detect(raw_bytes)
    if result['encoding']:
        return result['encoding'], 'statistical', result['confidence']

    # 5. Last resort
    return 'utf-8', 'default', 0.0
```

Notice that steps 2 and 3 include a verification pass -- they try to actually decode with the declared encoding and move on if it fails. A server might claim `ISO-8859-1` in the header while the HTML meta tag correctly says `UTF-8`. The verification catches these inconsistencies.

## Common Encoding Problems in Web Scraping

### Mojibake

Mojibake happens when bytes are decoded with the wrong encoding. The result is readable characters that are obviously wrong:

```python
# The string "cafe" encoded in UTF-8
correct_bytes = 'cafe'.encode('utf-8')
print(correct_bytes)
# b'caf\xc3\xa9'

# Decoded correctly as UTF-8
print(correct_bytes.decode('utf-8'))
# cafe

# Decoded incorrectly as Latin-1 -> mojibake
print(correct_bytes.decode('latin-1'))
# cafÃ©
```

Mojibake is recoverable if you know the wrong encoding that was applied and the correct one. The fix is to re-encode with the wrong encoding and then decode with the right one:

```python
# Fix mojibake: re-encode as latin-1, then decode as utf-8
mangled = 'cafÃ©'
fixed = mangled.encode('latin-1').decode('utf-8')
print(fixed)
# cafe
```

The `ftfy` library automates this kind of repair:

```python
import ftfy

mangled = 'cafÃ©'
fixed = ftfy.fix_text(mangled)
print(fixed)
# cafe
```

### Replacement Characters

When Python encounters bytes it cannot decode with the given encoding, it raises `UnicodeDecodeError` by default. Using `errors='replace'` substitutes the problematic bytes with the Unicode replacement character (U+FFFD):

```python
raw = b'Hello \x80\x81 World'

# Strict mode raises an exception
try:
    raw.decode('utf-8')
except UnicodeDecodeError as e:
    print(f"Error: {e}")
    # Error: 'utf-8' codec can't decode byte 0x80 in position 6

# Replace mode inserts replacement characters
text = raw.decode('utf-8', errors='replace')
print(text)
# Hello   World  (with replacement characters)

# Ignore mode silently drops bad bytes
text = raw.decode('utf-8', errors='ignore')
print(text)
# Hello  World
```

If your scraped data contains replacement characters, it means the encoding was wrong. Do not use `errors='replace'` as a permanent fix -- go back and detect the correct encoding.

### Mixed Encodings

Some pages contain content in multiple encodings. This happens when a page template is UTF-8 but includes content pulled from a legacy database in Latin-1, or when user-submitted content was stored with the wrong encoding.

There is no clean solution for mixed encodings. The best approach is to split the content at known boundaries and decode each segment separately:

```python
def decode_mixed(raw_bytes, primary='utf-8', fallback='latin-1'):
    """Attempt primary encoding, fall back line by line."""
    lines = raw_bytes.split(b'\n')
    decoded_lines = []

    for line in lines:
        try:
            decoded_lines.append(line.decode(primary))
        except UnicodeDecodeError:
            decoded_lines.append(line.decode(fallback, errors='replace'))

    return '\n'.join(decoded_lines)
```


<figure>
  <img src="/assets/img/inline-character-encoding-detection-automated-t-2.jpg" alt="The web speaks many languages — your scraper needs to understand all of them." loading="lazy">
  <figcaption>The web speaks many languages — your scraper needs to understand all of them. <span class="img-credit">Photo by Stefan G / <a href="https://www.pexels.com" target="_blank" rel="noopener noreferrer">Pexels</a></span></figcaption>
</figure>

## Handling Detection Failures

Encoding detection is probabilistic. It will sometimes fail, return low confidence scores, or pick the wrong encoding. A robust scraper needs fallback strategies.

```python
import chardet
from charset_normalizer import from_bytes

def robust_decode(raw_bytes, declared_encoding=None):
    """Decode bytes with multiple fallback strategies."""

    # Strategy 1: Use declared encoding if it works
    if declared_encoding:
        try:
            return raw_bytes.decode(declared_encoding)
        except (UnicodeDecodeError, LookupError):
            pass

    # Strategy 2: Try chardet with a confidence threshold
    result = chardet.detect(raw_bytes)
    if result['encoding'] and result['confidence'] > 0.7:
        try:
            return raw_bytes.decode(result['encoding'])
        except UnicodeDecodeError:
            pass

    # Strategy 3: Try charset-normalizer for a second opinion
    cn_results = from_bytes(raw_bytes)
    best = cn_results.best()
    if best is not None:
        try:
            return raw_bytes.decode(best.encoding)
        except UnicodeDecodeError:
            pass

    # Strategy 4: Try common encodings in order of web prevalence
    for encoding in ['utf-8', 'windows-1252', 'iso-8859-1', 'shift_jis', 'euc-kr', 'gb2312']:
        try:
            return raw_bytes.decode(encoding)
        except (UnicodeDecodeError, LookupError):
            continue

    # Strategy 5: Force UTF-8 with replacement characters as last resort
    return raw_bytes.decode('utf-8', errors='replace')
```

The confidence threshold in Strategy 2 is important. A detection result of `{'encoding': 'windows-1255', 'confidence': 0.23}` is essentially a guess -- do not trust it without verification.

Note that Strategy 4 lists `windows-1252` before `iso-8859-1`. These two encodings are nearly identical, but `windows-1252` defines characters in the 0x80-0x9F range (like curly quotes and em dashes) that `iso-8859-1` leaves as control characters. In practice, almost every page that claims to be `iso-8859-1` is actually `windows-1252`. The HTML standard itself mandates this substitution.

## Complete Example: Scraping with Correct Encoding

Here is a full example that brings everything together -- fetching a page, detecting its encoding through the signal chain, and producing clean decoded text:

```python
import re
import requests
import chardet


def detect_bom(raw_bytes):
    """Check for a Byte Order Mark."""
    bom_map = [
        (b'\xef\xbb\xbf', 'utf-8-sig'),
        (b'\xff\xfe\x00\x00', 'utf-32-le'),
        (b'\x00\x00\xfe\xff', 'utf-32-be'),
        (b'\xff\xfe', 'utf-16-le'),
        (b'\xfe\xff', 'utf-16-be'),
    ]
    for bom, encoding in bom_map:
        if raw_bytes.startswith(bom):
            return encoding
    return None


def detect_html_meta_encoding(raw_bytes):
    """Extract charset from HTML meta tags."""
    head = raw_bytes[:2048]

    match = re.search(rb'<meta\s+charset=["\']?([^"\'\s>]+)', head, re.IGNORECASE)
    if match:
        return match.group(1).decode('ascii', errors='ignore').strip()

    match = re.search(
        rb'<meta[^>]+content=["\'][^"\']*charset=([^"\'\s;>]+)',
        head,
        re.IGNORECASE,
    )
    if match:
        return match.group(1).decode('ascii', errors='ignore').strip()

    return None


def get_http_charset(response):
    """Extract charset from the Content-Type header."""
    content_type = response.headers.get('Content-Type', '')
    match = re.search(r'charset=([^\s;]+)', content_type, re.IGNORECASE)
    if match:
        return match.group(1).strip('"\'')
    return None


def try_decode(raw_bytes, encoding):
    """Attempt to decode bytes with the given encoding."""
    if not encoding:
        return None
    try:
        return raw_bytes.decode(encoding)
    except (UnicodeDecodeError, LookupError):
        return None


def scrape_with_encoding(url, timeout=30):
    """
    Fetch a URL and return correctly decoded text.

    Applies the full encoding detection chain:
    BOM -> HTTP header -> HTML meta -> statistical detection -> fallback.
    """
    response = requests.get(url, timeout=timeout)
    raw = response.content

    # 1. BOM
    bom_enc = detect_bom(raw)
    if bom_enc:
        text = try_decode(raw, bom_enc)
        if text is not None:
            return text, bom_enc, 'bom'

    # 2. HTTP Content-Type charset
    http_enc = get_http_charset(response)
    if http_enc:
        # Normalize common mislabeling
        normalized = http_enc.lower().replace('-', '')
        if normalized in ('iso88591', 'ascii'):
            # Likely actually windows-1252 or utf-8, verify before trusting
            pass
        else:
            text = try_decode(raw, http_enc)
            if text is not None:
                return text, http_enc, 'http_header'

    # 3. HTML meta charset
    meta_enc = detect_html_meta_encoding(raw)
    if meta_enc:
        text = try_decode(raw, meta_enc)
        if text is not None:
            return text, meta_enc, 'html_meta'

    # 4. Statistical detection
    detected = chardet.detect(raw)
    if detected['encoding'] and detected['confidence'] > 0.5:
        text = try_decode(raw, detected['encoding'])
        if text is not None:
            return text, detected['encoding'], f"detected (confidence: {detected['confidence']:.2f})"

    # 5. Fallback to UTF-8 with replacement
    text = raw.decode('utf-8', errors='replace')
    return text, 'utf-8', 'fallback'


# Usage
if __name__ == '__main__':
    urls = [
        'https://example.com',
        'https://www.yahoo.co.jp',
        'https://www.naver.com',
    ]

    for url in urls:
        try:
            text, encoding, source = scrape_with_encoding(url)
            preview = text[:100].replace('\n', ' ').strip()
            print(f"URL: {url}")
            print(f"  Encoding: {encoding} (source: {source})")
            print(f"  Preview: {preview}")
            print()
        except requests.RequestException as e:
            print(f"URL: {url}")
            print(f"  Error: {e}")
            print()
```

This produces output like:

```
URL: https://example.com
  Encoding: utf-8 (source: http_header)
  Preview: <!doctype html> <html> <head> <title>Example Domain</title>

URL: https://www.yahoo.co.jp
  Encoding: utf-8 (source: html_meta)
  Preview: <!DOCTYPE html><html lang="ja"> <head> <meta charset="utf-8">

URL: https://www.naver.com
  Encoding: utf-8 (source: http_header)
  Preview: <!doctype html> <html lang="ko"> <head> <meta charset="utf-8">
```

## Practical Recommendations

A few guidelines that hold up across most scraping projects:

**Start with `response.apparent_encoding`.** For the majority of pages, setting `response.encoding = response.apparent_encoding` before accessing `response.text` is enough. It handles the most common failure mode (server defaulting to ISO-8859-1 when the content is UTF-8).

**Do not ignore `UnicodeDecodeError`.** Using `errors='ignore'` or `errors='replace'` silently destroys data. Catch the exception, detect the correct encoding, and decode properly. Only use replacement as a last resort after all detection strategies fail.

**Validate after decoding.** A successful decode does not guarantee correctness. ISO-8859-1 will decode any byte sequence without errors, but the result might be garbage. Look for signs of mojibake: sequences like `Ã©`, `Ã¼`, `Ã¶` strongly suggest UTF-8 bytes decoded as Latin-1.

**Normalize to UTF-8 on storage.** Whatever encoding the source uses, convert to UTF-8 before storing. This avoids encoding mismatches downstream and simplifies all subsequent processing.

```python
# After decoding, re-encode to UTF-8 for storage
decoded_text = raw_bytes.decode(detected_encoding)
utf8_bytes = decoded_text.encode('utf-8')

# Or simply write the decoded string -- Python's file handling defaults to UTF-8
with open('output.txt', 'w', encoding='utf-8') as f:
    f.write(decoded_text)
```

**Log the detected encoding.** When scraping at scale, record which encoding was detected for each URL. This helps you spot patterns (all pages from a certain domain use Shift_JIS) and debug issues after the fact.

**Consider `ftfy` for cleanup.** If you inherit a dataset with existing mojibake, the `ftfy` (fixes text for you) library can automatically repair common encoding mistakes. It is not a substitute for correct detection up front, but it can rescue data that was already mangled.

```python
import ftfy

# Fix double-encoded UTF-8 (a very common issue)
broken = 'The cafÃ© served crÃ¨me brÃ»lÃ©e'
fixed = ftfy.fix_text(broken)
print(fixed)
# The cafe served creme brulee
```

Encoding detection is one of those problems that seems solved until you encounter the edge case that breaks your pipeline. Building the detection chain once -- BOM, HTTP header, HTML meta, statistical fallback -- and applying it consistently across your scraper will catch the vast majority of encoding issues before they corrupt your data.
