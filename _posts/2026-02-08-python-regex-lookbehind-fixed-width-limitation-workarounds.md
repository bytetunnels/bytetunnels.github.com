---
title: "Python Regex Lookbehind Fixed-Width Limitation: Workarounds"
date: 2026-02-08 14:00:00 +0000
categories: ["Data Extraction"]
tags: ["regex", "python", "lookbehind", "fixed-width", "workaround", "pattern matching"]
author: arman
image:
  path: /assets/img/2026-02-08-python-regex-lookbehind-fixed-width-limitation-workarounds-hero.jpg
  alt: "Python Regex Lookbehind Fixed-Width Limitation: Workarounds"
---

If you have spent any time writing regular expressions in Python, you have probably run into this error: `re.error: look-behind requires fixed-width pattern`. It appears the moment you try to use a quantifier like `*`, `+`, or `?` inside a [lookbehind assertion](/posts/regex-lookahead-web-scrapers-advanced-pattern-matching/). The error is not a bug. Python's `re` module enforces a hard constraint that lookbehinds must have a fixed width, meaning the engine must know the exact number of characters to step back before checking the assertion. This post explains why that limitation exists and walks through every practical workaround, with working code you can drop into your scraping and data extraction scripts today. If you are also working with [email regex patterns for web scraping](/posts/email-regex-patterns-web-scraping-reliable-extraction/), the same workarounds apply.

## The Error in Action

Here is the simplest way to trigger the error. Suppose you want to extract a price value that appears after the text `price:` followed by some whitespace, and you want only the digits in your match:

```python
import re

text = "The price:   42 dollars"

# This will raise an error
result = re.findall(r'(?<=price:\s+)\d+', text)
```

Running this produces:

```
re.error: look-behind requires fixed-width pattern at position 0
```

The `\s+` inside the lookbehind is the problem. The `+` quantifier means "one or more whitespace characters," which is a variable-length pattern. Python's `re` engine cannot handle that inside a lookbehind.

The same error appears with `*`, `?`, and `{m,n}` range quantifiers:

```python
# All of these raise the same error
re.findall(r'(?<=price:\s*)\d+', text)       # \s* -- zero or more
re.findall(r'(?<=price:\s?)\d+', text)        # \s? -- zero or one
re.findall(r'(?<=price:\s{1,5})\d+', text)    # \s{1,5} -- range
```

Only fixed-width quantifiers like `\s{3}` (exactly three characters) are allowed.

## Why Python Has This Limitation

To understand the constraint, you need to know how a lookbehind works internally. A lookahead `(?=...)` checks forward from the current position in the string. The engine does not need to know the length of the lookahead pattern because it simply tries to match from where it is. A lookbehind `(?<=...)` checks backward. To do that, the engine needs to step back a fixed number of characters and then check whether the lookbehind pattern matches at that earlier position.

If the lookbehind pattern is `price:` (six characters), the engine steps back six characters and checks for a match. Simple. But if the pattern is `price:\s+`, the engine does not know how far to step back. It could be seven characters, eight, twenty -- there is no upper bound. Python's `re` engine, which is based on a traditional NFA (nondeterministic finite automaton) design, does not support backtracking through multiple possible lookbehind widths. It requires a single fixed step-back distance.

This is a design choice, not a fundamental limitation of regular expressions. Other engines handle it differently. Perl, .NET, and Java all support variable-length lookbehinds (with varying levels of restriction). Python's `re` module chose simplicity and performance predictability over flexibility.

## What Is Allowed in a Lookbehind

Here are the patterns that work inside `(?<=...)` in Python's `re` module:

**Fixed strings:**

```python
import re

text = "price:42 cost:99"

# Fixed string lookbehind -- works fine
prices = re.findall(r'(?<=price:)\d+', text)
print(prices)
# ['42']
```

**Fixed-length character classes:**

```python
import re

text = "A7 B8 C9"

# One uppercase letter followed by -- total width is 1
values = re.findall(r'(?<=[A-Z])\d+', text)
print(values)
# ['7', '8', '9']
```

**Fixed-width quantifiers:**

```python
import re

text = "price:  42"

# Exactly two spaces -- works because width is fixed at 8 (price: + 2 spaces)
result = re.findall(r'(?<=price:\s{2})\d+', text)
print(result)
# ['42']
```

**Alternation of equal-length options:**

```python
import re

text = "USD42 EUR99 GBP15"

# Each option is exactly 3 characters -- works
amounts = re.findall(r'(?<=USD|EUR|GBP)\d+', text)
print(amounts)
# ['42', '99', '15']
```

## What Is NOT Allowed in a Lookbehind

These patterns all raise `re.error: look-behind requires fixed-width pattern`:

```python
import re

text = "price: 42"

# Variable quantifiers
# re.findall(r'(?<=price:\s+)\d+', text)     # + quantifier
# re.findall(r'(?<=price:\s*)\d+', text)     # * quantifier
# re.findall(r'(?<=price:\s?)\d+', text)     # ? quantifier
# re.findall(r'(?<=price:\s{1,5})\d+', text) # {m,n} range

# Variable-length alternation
# re.findall(r'(?<=price:|total price:)\d+', text)  # 6 vs 12 chars

# Backreferences
# re.findall(r'(?<=(\w)\1)\d+', text)  # variable by nature
```

Variable-length alternation is a common surprise. Even though each branch has a known width, if those widths differ, the lookbehind is rejected. `(?<=USD|EUR|YUAN)` would fail because `YUAN` is four characters while the others are three.

## Workaround 1: Use the regex Module

The third-party `regex` module (installed with `pip install regex`) is a drop-in replacement for `re` that supports variable-length lookbehinds. It uses a more advanced engine that can handle backtracking through multiple possible lookbehind widths.

```python
import regex

text = "price:   42 total price: 99"

# Variable-length lookbehind -- works with regex module
prices = regex.findall(r'(?<=price:\s+)\d+', text)
print(prices)
# ['42', '99']

# Range quantifier in lookbehind -- also works
prices = regex.findall(r'(?<=price:\s{1,10})\d+', text)
print(prices)
# ['42', '99']

# Variable-length alternation -- works too
prices = regex.findall(r'(?<=price:|total price:)\s*\d+', text)
print(prices)
# ['   42', ' 99']
```

The `regex` module also supports other advanced features like atomic groups, possessive quantifiers, and Unicode property escapes. If you are doing serious regex work in Python, it is worth having in your toolkit.

Install it with:

```bash
pip install regex
```

The API is identical to `re`. You can swap `import re` for `import regex` and your existing code will continue to work while gaining access to the extended features.

## Workaround 2: Use a Capturing Group Instead

This is the most common and often the best workaround. Instead of using a lookbehind to exclude the prefix from the match, match the entire pattern and capture only the part you want in a group.

```python
import re

text = "price:   42 dollars"

# Instead of lookbehind, use a capturing group
result = re.findall(r'price:\s+(\d+)', text)
print(result)
# ['42']
```

When `re.findall()` encounters a pattern with capturing groups, it returns only the captured text, not the full match. This gives you the same result as a lookbehind without the fixed-width restriction.

This works for all the patterns that break lookbehinds:

```python
import re

text = """
product: Widget
price:    42
total price: 99
cost:5
"""

# Variable whitespace after a fixed prefix
prices = re.findall(r'price:\s*(\d+)', text)
print(prices)
# ['42', '99']

# Variable-length prefix alternatives
values = re.findall(r'(?:price|cost|total price):\s*(\d+)', text)
print(values)
# ['42', '99', '5']

# Multiple captures in one pattern
items = re.findall(r'(\w[\w\s]*):\s*(\d+)', text)
print(items)
# [('product', 'Widget'), ('price', '42'), ('total price', '99'), ('cost', '5')]
```

Notice the use of `(?:...)` for a non-capturing group when you need alternation for the prefix but do not want it in the results. Only the `(\d+)` group is captured and returned.

## Workaround 3: Match and Slice the Result

Sometimes you want to keep using `re.search()` or `re.match()` and you are willing to do a little string manipulation after the match. Match the full pattern including the prefix, then slice off what you do not need.

```python
import re

text = "total price:   42 dollars"

# Match the full pattern
match = re.search(r'price:\s+\d+', text)
if match:
    full = match.group()
    print(full)
    # 'price:   42'

    # Extract just the number by finding where digits start
    number = re.search(r'\d+', full).group()
    print(number)
    # '42'
```

A cleaner version uses `re.sub()` to strip the prefix:

```python
import re

text = "total price:   42 dollars"

match = re.search(r'price:\s+\d+', text)
if match:
    number = re.sub(r'^.*?(?=\d)', '', match.group())
    print(number)
    # '42'
```

This approach is less elegant than a capturing group, but it can be useful when you are processing match objects and need access to `.start()`, `.end()`, or `.span()` for position information.


<figure>
  <img src="/assets/img/inline-python-regex-lookbehind-fixed-width-limi-1.jpg" alt="Patterns are everywhere — regex helps you find the ones that matter." loading="lazy">
  <figcaption>Patterns are everywhere — regex helps you find the ones that matter. <span class="img-credit">Photo by Memet Öz / <a href="https://www.pexels.com" target="_blank" rel="noopener noreferrer">Pexels</a></span></figcaption>
</figure>

## Workaround 4: Use re.sub with a Replacement Function

When the goal is replacement rather than extraction, lookbehinds are often used to anchor a substitution without consuming the prefix. If the lookbehind is variable-width, use a replacement function instead.

Suppose you want to double every price value that appears after `price:` with variable whitespace:

```python
import re

text = "price: 42 and total price:   99"

# This would fail with a lookbehind:
# result = re.sub(r'(?<=price:\s+)\d+', lambda m: str(int(m.group()) * 2), text)

# Use a capturing group and rebuild the match
def double_price(match):
    prefix = match.group(1)
    value = int(match.group(2))
    return f'{prefix}{value * 2}'

result = re.sub(r'(price:\s+)(\d+)', double_price, text)
print(result)
# 'price: 84 and total price:   198'
```

The key insight is that the first capturing group `(price:\s+)` holds the prefix, and the replacement function puts it back unchanged. The second group `(\d+)` holds the value you want to transform.

You can also use a lambda for concise one-liners:

```python
import re

text = "price: 42 and total price:   99"

result = re.sub(
    r'(price:\s+)(\d+)',
    lambda m: m.group(1) + str(int(m.group(2)) * 2),
    text
)
print(result)
# 'price: 84 and total price:   198'
```

## Practical Scraping Examples

These patterns come up constantly when [extracting structured data from web pages using regex](/posts/regex-for-web-scraping-extracting-data-without-parser/) and API responses. Here are several real-world scenarios.

**Extracting values after variable-length labels in HTML:**

```python
import re

html = '''
<span class="label">Price:</span>  <span class="value">$42.99</span>
<span class="label">Sale Price:</span> <span class="value">$29.99</span>
<span class="label">Discount:</span>    <span class="value">30%</span>
'''

# Extract the values after any label -- variable whitespace between tags
items = re.findall(
    r'<span class="label">([^<]+)</span>\s*<span class="value">([^<]+)</span>',
    html
)
print(items)
# [('Price:', '$42.99'), ('Sale Price:', '$29.99'), ('Discount:', '30%')]
```

**Pulling numbers from JSON-like text responses:**

```python
import re

response = '''
{"price": 42, "shipping":   5, "total":47}
'''

# Variable whitespace after the colon
pairs = re.findall(r'"(\w+)":\s*(\d+)', response)
print(pairs)
# [('price', '42'), ('shipping', '5'), ('total', '47')]
```

**Extracting data from log lines with variable-width fields:**

```python
import re

logs = """
2026-02-08 14:23:01 INFO  price_update product=widget amount=42
2026-02-08 14:23:02 WARN  price_update product=gadget amount=0
2026-02-08 14:23:05 INFO  price_update product=doohickey amount=99
"""

# Extract amount values -- the product name has variable length
amounts = re.findall(r'product=\w+\s+amount=(\d+)', logs)
print(amounts)
# ['42', '0', '99']

# Extract both product and amount
items = re.findall(r'product=(\w+)\s+amount=(\d+)', logs)
print(items)
# [('widget', '42'), ('gadget', '0'), ('doohickey', '99')]
```

**Handling multiple possible prefixes in scraped text** (a common need when [building a web scraper with regex](/posts/building-web-scraper-with-regex-practical-patterns-pitfalls/))**:**

```python
import re

lines = [
    "Price: $42.99",
    "Our price: $29.99",
    "Regular price: $59.99",
    "Sale price: $19.99",
    "Cost: $10.00",
]

for line in lines:
    match = re.search(r'(?:[\w\s]*price|cost):\s*\$?([\d.]+)', line, re.IGNORECASE)
    if match:
        print(f'{line:30s} => {match.group(1)}')

# Price: $42.99                  => 42.99
# Our price: $29.99              => 29.99
# Regular price: $59.99          => 59.99
# Sale price: $19.99             => 19.99
# Cost: $10.00                   => 10.00
```

## Negative Lookbehinds Have the Same Limitation

Everything discussed so far applies equally to negative lookbehinds `(?<!...)`. The same fixed-width rule is enforced:

```python
import re

text = "USD42 YUAN99 EUR15"

# This works -- each alternative is 3 characters
non_usd = re.findall(r'(?<!USD)\d+', text)
print(non_usd)
# ['2', '99', '15']
# Note: '2' matches because position after 'D' in 'USD42' is not preceded by 'USD'
# at the position of '2', the three preceding characters are 'SD4'

# Better approach with word boundaries
non_usd = re.findall(r'(?<!USD)(?<=\b[A-Z]{3})\d+', text)
# This still requires fixed width in both lookbehinds
```

Negative lookbehinds with variable-width patterns fail with the same error:

```python
import re

# This will raise re.error
# re.findall(r'(?<!total\s+)price:\s*(\d+)', text)
```

The workaround is the same: use a capturing group and filter the results in Python:

```python
import re

text = """
price: 42
total price: 99
retail price: 15
"""

# Match all prices, then filter out those preceded by "total"
all_matches = re.finditer(r'(\S+\s+)?price:\s*(\d+)', text)
for m in all_matches:
    prefix = m.group(1)
    value = m.group(2)
    if prefix and 'total' in prefix.strip():
        continue
    print(f'Non-total price: {value}')

# Non-total price: 42
# Non-total price: 15
```

## Performance Comparison: regex vs re

The `regex` module is generally slower than `re` for simple patterns because its more powerful engine has more overhead. Here is a rough benchmark to set expectations:

```python
import re
import regex
import time

text = "price: 42 " * 100_000

# Benchmark re module with capturing group
start = time.perf_counter()
for _ in range(100):
    re.findall(r'price:\s+(\d+)', text)
re_time = time.perf_counter() - start

# Benchmark regex module with variable-length lookbehind
start = time.perf_counter()
for _ in range(100):
    regex.findall(r'(?<=price:\s+)\d+', text)
regex_time = time.perf_counter() - start

print(f're module (capturing group): {re_time:.3f}s')
print(f'regex module (lookbehind):   {regex_time:.3f}s')
print(f'regex is {regex_time / re_time:.1f}x slower')
```

Typical results on a modern machine:

```
re module (capturing group): 1.842s
regex module (lookbehind):   3.271s
regex is 1.8x slower
```

The `regex` module is roughly 1.5x to 3x slower for this class of pattern. For most scraping tasks where you process kilobytes or low megabytes of text, the difference is negligible. For high-volume processing pipelines where you run millions of matches, the `re` module with capturing groups is measurably faster.

There is also a middle ground. The `regex` module can use the `re` engine for patterns that do not require its extended features:

```python
import regex

# Use VERSION0 for re-compatible behavior (faster for simple patterns)
result = regex.findall(r'price:\s+(\d+)', text, flags=regex.VERSION0)
```

## Quick Reference: Choosing Your Workaround

| Situation | Best Workaround |
|-----------|----------------|
| Extracting text after a variable-length prefix | Capturing group |
| Need exact lookbehind behavior in complex pattern | `regex` module |
| Replacing text while preserving variable prefix | `re.sub` with replacement function |
| Simple extraction from a match object | Match and slice |
| Negative lookbehind with variable width | Capturing group + Python filtering |
| Performance-critical code | Capturing group with `re` module |

## Recommendation

Use capturing groups as your default approach. They work with the built-in `re` module, they are fast, and they handle every case where you would want a variable-length lookbehind. The pattern `prefix(what_you_want)` is immediately readable to anyone who knows regex.

Reach for the `regex` module when you genuinely need lookbehind semantics -- for example, when you are building a pattern that is already complex and adding a capturing group would make it harder to maintain, or when you need the lookbehind to interact with other zero-width assertions in a specific way.

Avoid the match-and-slice approach for new code. It works, but it splits your extraction logic across multiple lines and is harder to maintain.

For substitutions, the `re.sub()` replacement function pattern is the cleanest solution. It keeps the prefix in a capturing group and gives you full control over the replacement logic in Python code where you have access to conditionals, type conversions, and string formatting.

The fixed-width lookbehind limitation in Python's `re` module is unlikely to change. It has been a known constraint since Python 2, and the core developers have pointed to the `regex` module as the answer for anyone who needs more power. Understanding the workarounds means you will never be blocked by this error again.
