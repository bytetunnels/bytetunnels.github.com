---
title: "Getting Started with Nodriver in Python: Installation to First Script"
date: 2026-03-03 12:00:00 +0000
categories: ["Browser Automation"]
tags: ["nodriver", "python", "tutorial", "getting started", "browser automation", "beginner"]
author: arman
image:
  path: /assets/img/2026-03-03-getting-started-nodriver-python-installation-first-script-hero.png
  alt: "Getting Started with Nodriver in Python: Installation to First Script"
---

Nodriver is a Python browser automation library that controls Chrome without leaving the telltale fingerprints that get bots detected. It is the successor to the widely used undetected-chromedriver library, rebuilt from scratch around the Chrome DevTools Protocol. Unlike Selenium or Playwright --- whose [stealth capabilities differ significantly](/posts/playwright-vs-selenium-stealth-which-evades-detection-better/) --- nodriver does not use a WebDriver binary or inject automation flags into the browser. It talks directly to Chrome over a WebSocket connection, which means detection scripts that look for `navigator.webdriver` or other automation markers come up empty. This approach places nodriver firmly in the [stealth browser category](/posts/stealth-browsers-in-2026-camoufox-nodriver-and-the-anti-detection-arms-race/) alongside tools like Camoufox.

Nodriver is Python-only and fully asynchronous, built on top of `asyncio`. If you have written any async Python before, the API will feel natural. If you have not, this tutorial will walk you through everything you need. By the end, you will have a working script that opens a browser, navigates to a page, finds elements, extracts data, and takes a screenshot.

## What Makes Nodriver Different

Most browser automation tools work by inserting themselves between your code and the browser through a driver binary. [Selenium uses ChromeDriver while Puppeteer uses CDP](/posts/selenium-vs-puppeteer-definitive-comparison-web-scraping/). Playwright uses its own browser binaries. For a side-by-side look at all the major options, see the [Playwright vs Puppeteer vs Selenium vs Scrapy mega-comparison](/posts/playwright-vs-puppeteer-vs-selenium-vs-scrapy-2026-mega-comparison/). These intermediaries modify the browser environment in ways that anti-bot systems can detect --- which is why many developers look for [alternatives to Puppeteer](/posts/top-puppeteer-alternatives-what-to-use-instead/) that avoid this overhead.

Nodriver takes a different path. It launches a regular Chrome installation and communicates with it using the Chrome DevTools Protocol (CDP) directly. There is no middleman binary, no injected scripts at page load, and no modified browser flags. From the perspective of a website, the browser looks like a normal user session.

This matters if you are automating against sites that use bot detection. But even if detection is not your concern, nodriver offers a clean and lightweight API that makes browser automation straightforward.

## Prerequisites

Before installing nodriver, make sure you have the following:

**Python 3.9 or higher.** Nodriver relies on modern `asyncio` features. Check your version by running:

```bash
python --version
```

If you see `Python 3.8.x` or higher, you are good to go.

**Google Chrome or Chromium installed.** Nodriver does not ship its own browser. It looks for Chrome on your system in the standard installation locations. On most systems, if you can open Chrome from your desktop, nodriver will find it.

To verify Chrome is installed and check its version:

```bash
# macOS
/Applications/Google\ Chrome.app/Contents/MacOS/Google\ Chrome --version

# Linux
google-chrome --version

# Windows (PowerShell)
& "C:\Program Files\Google\Chrome\Application\chrome.exe" --version
```

You do not need to install ChromeDriver or any other driver binary. Nodriver handles the connection to Chrome on its own.

## Installation

Install nodriver with pip:

```bash
pip install nodriver
```

That is the only dependency you need. Nodriver has minimal external requirements, so the installation is fast.

To verify the installation worked:

```python
import nodriver
print(nodriver.__version__)
```

If this prints a version number without errors, you are ready to write your first script.

## Your First Script: Open a Page and Get the Title

Let us start with the simplest possible nodriver script. It opens a browser, navigates to a URL, prints the page title, and closes the browser.

```python
import nodriver as uc
import asyncio


async def main():
    # Start a browser instance
    browser = await uc.start()

    # Open a page
    page = await browser.get("https://example.com")

    # Print the page title
    print("Page title:", page.target.title)

    # Close the browser
    browser.stop()


if __name__ == "__main__":
    uc.loop().run_until_complete(main())
```

Save this as `first_script.py` and run it:

```bash
python first_script.py
```

You should see a Chrome window open, navigate to example.com, and then close. The terminal will print:

```
Page title: Example Domain
```

Let us break down what happened:

1. `import nodriver as uc` imports the library. The alias `uc` is a convention carried over from undetected-chromedriver.
2. `await uc.start()` launches a new Chrome browser instance and returns a browser object.
3. `await browser.get("https://example.com")` navigates to the URL and returns a page (tab) object.
4. `page.target.title` contains the title of the page as it appears in the browser tab.
5. `browser.stop()` shuts down the browser process.

The entire script runs inside an `async` function because nodriver's API is asynchronous. The `asyncio.run(main())` call at the bottom is what kicks off the async event loop.

## Navigating Between Pages

In most automation tasks, you will visit more than one page. You can call `browser.get()` multiple times, or open new tabs.

```python
import nodriver as uc
import asyncio


async def main():
    browser = await uc.start()

    # Visit the first page
    page = await browser.get("https://example.com")
    print("First page:", page.target.title)

    # Navigate to a different URL in the same tab
    page = await browser.get("https://www.iana.org/domains/reserved")
    print("Second page:", page.target.title)

    # Open a new tab with a different URL
    page2 = await browser.get("https://example.org", new_tab=True)
    print("New tab:", page2.target.title)

    browser.stop()


if __name__ == "__main__":
    uc.loop().run_until_complete(main())
```

By default, `browser.get()` navigates the most recently active tab. Passing `new_tab=True` opens the URL in a fresh tab instead. The method returns the page object for whichever tab it used, so you always have a reference to work with.


<figure>
  <img src="/assets/img/inline-getting-started-nodriver-python-installa-1.jpg" alt="Staying undetected requires understanding what detection systems look for." loading="lazy">
  <figcaption>Staying undetected requires understanding what detection systems look for. <span class="img-credit">Photo by Maxim Landolfi / <a href="https://www.pexels.com" target="_blank" rel="noopener noreferrer">Pexels</a></span></figcaption>
</figure>

## Finding Elements on a Page

Finding elements is one of the most common tasks in browser automation. Nodriver provides two main approaches: CSS selectors and text search.

### Finding Elements by CSS Selector

The `page.select()` method finds the first element matching a CSS selector. If you have used CSS selectors in web development or with other scraping tools, this will be familiar.

```python
import nodriver as uc
import asyncio


async def main():
    browser = await uc.start()
    page = await browser.get("https://example.com")

    # Find an element by tag name
    heading = await page.select("h1")
    print("Found heading:", heading)

    # Find an element by CSS class
    # (example.com does not have many classes, but the syntax is standard)
    container = await page.select("div")
    print("Found div:", container)

    # Find an element by ID
    # body_element = await page.select("#some-id")

    # Find an element with a complex selector
    paragraph = await page.select("div > p")
    print("Found paragraph:", paragraph)

    browser.stop()


if __name__ == "__main__":
    uc.loop().run_until_complete(main())
```

The `page.select()` method returns the first matching element. If no element matches the selector, it will wait briefly and then raise an error. This built-in waiting behavior is helpful because pages often take a moment to fully render.

To find all elements matching a selector, use `page.select_all()`:

```python
import nodriver as uc
import asyncio


async def main():
    browser = await uc.start()
    page = await browser.get("https://example.com")

    # Find all paragraph elements
    paragraphs = await page.select_all("p")
    print(f"Found {len(paragraphs)} paragraphs")

    for p in paragraphs:
        text = p.text
        print(f"  - {text[:80]}")

    browser.stop()


if __name__ == "__main__":
    uc.loop().run_until_complete(main())
```

### Finding Elements by Text

Sometimes you do not know the CSS selector, but you know what text the element contains. The `page.find()` method searches for elements by their visible text.

```python
import nodriver as uc
import asyncio


async def main():
    browser = await uc.start()
    page = await browser.get("https://example.com")

    # Find an element containing specific text
    link = await page.find("More information")
    print("Found link:", link)

    browser.stop()


if __name__ == "__main__":
    uc.loop().run_until_complete(main())
```

The `page.find()` method searches the visible text content of all elements on the page and returns the first match. This is useful when dealing with pages where elements do not have reliable CSS selectors but do have predictable text labels.

## Extracting Text and Attributes

Once you have found an element, you typically want to extract information from it. Nodriver provides straightforward methods for getting text content and HTML attributes.

### Getting Text Content

Use the `.text` property or `element.get_text()` to extract the visible text from an element:

```python
import nodriver as uc
import asyncio


async def main():
    browser = await uc.start()
    page = await browser.get("https://example.com")

    heading = await page.select("h1")
    heading_text = heading.text
    print("Heading text:", heading_text)

    # get_text() also works and returns the text content
    paragraph = await page.select("p")
    paragraph_text = paragraph.text
    print("Paragraph text:", paragraph_text[:100])

    browser.stop()


if __name__ == "__main__":
    uc.loop().run_until_complete(main())
```

### Getting Attributes

HTML elements have attributes like `href`, `src`, `class`, and `id`. Use `element.get_attribute()` to read them.

```python
import nodriver as uc
import asyncio


async def main():
    browser = await uc.start()
    page = await browser.get("https://example.com")

    # Find the link and get its href attribute
    link = await page.select("a")
    href = link.attrs.get("href", "")
    print("Link href:", href)

    # You can also use get_attribute for any attribute
    # For example, getting the class of a div
    div = await page.select("div")
    div_attrs = div.attrs
    print("Div attributes:", div_attrs)

    browser.stop()


if __name__ == "__main__":
    uc.loop().run_until_complete(main())
```

The `attrs` property returns a dictionary-like object containing all of the element's HTML attributes. This is useful when you need to inspect multiple attributes at once.

## Taking Screenshots

Screenshots are invaluable for debugging automation scripts and for capturing visual data. Nodriver makes this easy with `page.save_screenshot()`.

```python
import nodriver as uc
import asyncio


async def main():
    browser = await uc.start()
    page = await browser.get("https://example.com")

    # Take a screenshot of the full page
    await page.save_screenshot("example_page.png")
    print("Screenshot saved to example_page.png")

    browser.stop()


if __name__ == "__main__":
    uc.loop().run_until_complete(main())
```

This saves a PNG image of the current viewport to the specified path. The screenshot captures exactly what the browser is rendering, including any dynamically loaded content, CSS styling, and images.

You can also take a screenshot of a specific element if you only need part of the page:

```python
import nodriver as uc
import asyncio


async def main():
    browser = await uc.start()
    page = await browser.get("https://example.com")

    heading = await page.select("h1")
    await heading.save_screenshot("heading_only.png")
    print("Element screenshot saved")

    browser.stop()


if __name__ == "__main__":
    uc.loop().run_until_complete(main())
```

## Clicking and Typing

Interactive automation requires clicking buttons and typing into input fields. Nodriver provides `element.click()` and `element.send_keys()` for these tasks. For a deeper dive into form interactions, see our [complete guide to automating web form filling](/posts/how-to-automate-web-form-filling-complete-guide/).

### Clicking Elements

```python
import nodriver as uc
import asyncio


async def main():
    browser = await uc.start()
    page = await browser.get("https://example.com")

    # Find the "More information..." link and click it
    link = await page.find("More information")
    await link.click()

    # Wait a moment for navigation to complete
    await page.sleep(2)

    # We should now be on the IANA page
    print("Current page title:", page.target.title)

    browser.stop()


if __name__ == "__main__":
    uc.loop().run_until_complete(main())
```

The `click()` method simulates a mouse click on the element. If the element is a link, the browser will navigate to the link target. If it is a button, the associated action fires.

### Typing into Input Fields

```python
import nodriver as uc
import asyncio


async def main():
    browser = await uc.start()
    page = await browser.get("https://www.google.com")

    # Find the search input
    search_box = await page.select("textarea[name=q]")

    # Type a search query
    await search_box.send_keys("nodriver python tutorial")

    # Wait a moment to see the results
    await page.sleep(2)

    # You could press Enter by sending the key
    await search_box.send_keys("\n")

    await page.sleep(3)
    print("Page title after search:", page.target.title)

    browser.stop()


if __name__ == "__main__":
    uc.loop().run_until_complete(main())
```

The `send_keys()` method types text into the element character by character, simulating real keyboard input. This is important for sites that listen for keypress events to trigger autocomplete or validation.

## Complete Example: Scrape Headlines from Example.com

Let us put everything together into a complete, practical script. This example navigates to example.com, extracts all the text content, and demonstrates the full workflow of a simple scraping task.

```python
import nodriver as uc
import asyncio
import json


async def scrape_example():
    """
    Complete example: navigate to a page, extract structured data,
    take a screenshot, and save results.
    """
    browser = await uc.start()

    try:
        # Navigate to the target page
        page = await browser.get("https://example.com")
        print(f"Loaded: {page.target.title}")

        # Extract the main heading
        h1 = await page.select("h1")
        headline = h1.text
        print(f"Headline: {headline}")

        # Extract all paragraphs
        paragraphs = await page.select_all("p")
        paragraph_texts = []
        for p in paragraphs:
            text = p.text
            if text.strip():
                paragraph_texts.append(text.strip())

        print(f"Found {len(paragraph_texts)} paragraphs")

        # Extract all links with their text and URLs
        links = await page.select_all("a")
        link_data = []
        for link in links:
            text = link.text
            href = link.attrs.get("href", "")
            link_data.append({"text": text, "href": href})

        print(f"Found {len(link_data)} links")

        # Take a screenshot for our records
        await page.save_screenshot("example_scraped.png")
        print("Screenshot saved")

        # Compile the results
        results = {
            "url": "https://example.com",
            "title": page.target.title,
            "headline": headline,
            "paragraphs": paragraph_texts,
            "links": link_data,
        }

        # Save to a JSON file
        with open("example_results.json", "w") as f:
            json.dump(results, f, indent=2)

        print("Results saved to example_results.json")
        print(json.dumps(results, indent=2))

    finally:
        browser.stop()


if __name__ == "__main__":
    asyncio.run(scrape_example())
```

Running this script produces a JSON file with the structured data from the page, plus a screenshot. The `try/finally` block ensures the browser shuts down even if an error occurs during scraping.

Here is what the output looks like:

```
Loaded: Example Domain
Headline: Example Domain
Found 2 paragraphs
Found 1 links
Screenshot saved
Results saved to example_results.json
{
  "url": "https://example.com",
  "title": "Example Domain",
  "headline": "Example Domain",
  "paragraphs": [
    "This domain is for use in illustrative examples in documents. You may use this domain in literature without prior coordination or asking for permission.",
    "More information..."
  ],
  "links": [
    {
      "text": "More information...",
      "href": "https://www.iana.org/domains/example"
    }
  ]
}
```

## Running Headless

By default, nodriver opens a visible browser window. For production scraping or server environments where there is no display, you can run in headless mode.

```python
import nodriver as uc
import asyncio


async def main():
    browser = await uc.start(headless=True)

    page = await browser.get("https://example.com")
    print("Title:", page.target.title)

    browser.stop()


if __name__ == "__main__":
    uc.loop().run_until_complete(main())
```

Pass `headless=True` to `uc.start()` and Chrome runs in the background with no visible window. Everything else works the same: navigation, element selection, screenshots, and interaction.

## Common Errors and Fixes

When getting started with nodriver, you will likely hit a few common issues. Here are the ones most beginners encounter and how to solve them.

### Chrome Not Found

```
FileNotFoundError: Could not find a suitable Chrome/Chromium binary
```

Nodriver searches for Chrome in standard installation paths. If Chrome is installed in a non-standard location, you can specify the path explicitly:

```python
browser = await uc.start(
    browser_executable_path="/path/to/google-chrome"
)
```

On Linux, Chrome might be at `/usr/bin/google-chrome` or `/usr/bin/chromium-browser`. On macOS, it is typically at `/Applications/Google Chrome.app/Contents/MacOS/Google Chrome`.

### asyncio Event Loop Errors

```
RuntimeError: This event loop is already running
```

This error appears when you try to use `asyncio.run()` inside an environment that already has an event loop running, such as Jupyter notebooks or certain web frameworks.

For Jupyter notebooks, use `await` directly instead of `asyncio.run()`:

```python
# In a Jupyter notebook cell, just use await directly
import nodriver as uc

browser = await uc.start()
page = await browser.get("https://example.com")
print(page.target.title)
browser.stop()
```

If you are in another async context, you can call your function with `await` instead of wrapping it in `asyncio.run()`.

### Element Not Found or Timeout

```
TimeoutError: Element not found
```

This usually means the page has not finished loading or the selector does not match any element. There are a few solutions:

```python
import nodriver as uc
import asyncio


async def main():
    browser = await uc.start()
    page = await browser.get("https://example.com")

    # Add an explicit wait before selecting
    await page.sleep(2)

    # Then try to find the element
    heading = await page.select("h1")
    print(heading.text)

    browser.stop()


if __name__ == "__main__":
    uc.loop().run_until_complete(main())
```

If you are unsure whether an element exists, wrap the selection in a try/except block:

```python
try:
    element = await page.select(".might-not-exist")
    print("Found:", element.text)
except Exception:
    print("Element not found on this page")
```

### Port Already in Use

```
OSError: [Errno 48] Address already in use
```

This happens when a previous nodriver session did not shut down cleanly, leaving a Chrome process running. Kill the orphaned process:

```bash
# macOS/Linux
pkill -f chrome

# Windows
taskkill /F /IM chrome.exe
```

To prevent this, always use `try/finally` to ensure `browser.stop()` runs:

```python
browser = await uc.start()
try:
    page = await browser.get("https://example.com")
    # ... your automation code ...
finally:
    browser.stop()
```

### SSL Certificate Errors

Some development or internal sites use self-signed certificates. You can tell Chrome to ignore certificate errors:

```python
browser = await uc.start(
    browser_args=["--ignore-certificate-errors"]
)
```

Use this only for testing or internal sites, never for general browsing.

## Next Steps

This tutorial covered the fundamentals: installation, navigation, element selection, data extraction, interaction, and screenshots. With these building blocks, you can automate most straightforward browser tasks.

From here, there are several directions you can go:

**Handling dynamic content.** Many modern websites load data asynchronously with JavaScript. You will need strategies for waiting until content appears, which goes beyond simple `sleep()` calls. Look into waiting for specific elements or network requests to complete.

**Working with multiple pages.** Scraping at scale often means opening many tabs or cycling through a list of URLs. Nodriver's async nature makes it well suited for concurrent page processing.

**Dealing with anti-bot detection.** While nodriver is already stealthier than most automation tools, [advanced detection systems](/posts/evolution-web-scraping-detection-methods-timeline/) --- including techniques like [Cloudflare's AI Labyrinth](/posts/cloudflare-ai-labyrinth-how-honeypot-pages-are-trapping-scrapers/) --- may require additional configuration. Browser arguments, realistic timing between actions, and proper viewport settings all contribute to staying undetected.

**Extracting structured data from complex pages.** Real-world scraping targets have nested layouts, pagination, infinite scroll, and [shadow DOM elements](/posts/shadow-dom-the-silent-killer-of-ai-web-scraping/). Each of these requires specific techniques beyond basic `select()` and `find()` calls.

**Error handling and resilience.** Production scraping scripts need to handle network failures, unexpected page layouts, and rate limiting gracefully. Building retry logic and proper error handling into your scripts will save you from silent failures.

Nodriver gives you a clean foundation to build on. Its async API keeps your scripts efficient, and its direct CDP connection avoids the detection pitfalls that trip up other automation tools. Start with simple scripts like the ones in this tutorial, then move on to the [complete nodriver guide](/posts/nodriver-complete-guide-undetected-browser-automation-python/) to cover advanced topics like JavaScript evaluation, tab management, configuration options, and stealth best practices.
