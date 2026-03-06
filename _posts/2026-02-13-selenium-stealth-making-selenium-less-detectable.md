---
title: "selenium-stealth: Making Selenium Less Detectable"
date: 2026-02-13 14:00:00 +0000
categories: ["Browser Automation"]
tags: ["selenium", "stealth", "selenium-stealth", "anti-detection", "python", "web scraping"]
author: arman
image:
  path: /assets/img/2026-02-13-selenium-stealth-making-selenium-less-detectable-hero.png
  alt: "selenium-stealth: Making Selenium Less Detectable"
---

If you have used Selenium for any serious web scraping, you have probably hit a wall where the target site blocks you instantly. The reason is simple: a default Selenium Chrome session leaks dozens of signals that scream "I am a bot." The `navigator.webdriver` property is set to `true`, the plugin list is empty, the Chrome runtime object is missing key properties, and permissions queries return inconsistent results. Anti-bot systems like Cloudflare, DataDome, and PerimeterX check for all of these. The `selenium-stealth` package is a lightweight Python library that patches many of these signals, making your Selenium browser look more like a real user's Chrome. It is not a silver bullet, but for a wide range of sites, it is all you need. For a broader look at how detection has evolved over time, see the [evolution of web scraping detection methods](/posts/evolution-web-scraping-detection-methods-timeline/).

## What Is selenium-stealth

`selenium-stealth` is a Python package that applies a series of JavaScript patches to a Selenium-controlled Chrome browser. It was inspired by the `puppeteer-extra-plugin-stealth` package from the Puppeteer ecosystem and brings similar evasion techniques to Selenium users. The library works by injecting scripts into the browser session that override known automation fingerprints before the target page's detection scripts can read them.

The project lives on PyPI and can be installed in seconds. It targets Chrome specifically --- Firefox and other browsers are not supported.

## Installation

Install with pip:

```bash
pip install selenium-stealth
```

You will also need Selenium and a compatible ChromeDriver:

```bash
pip install selenium
```

Make sure your ChromeDriver version matches your installed Chrome version. If you are using Selenium 4.6 or later, the built-in Selenium Manager handles this automatically.

## Basic Setup

The core API is a single function: `stealth()`. You pass it your Selenium WebDriver instance along with configuration options that control the fake fingerprint values.

```python
from selenium import webdriver
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.chrome.service import Service
from selenium_stealth import stealth

# Set up Chrome options
chrome_options = Options()
chrome_options.add_argument("--start-maximized")
chrome_options.add_experimental_option("excludeSwitches", ["enable-automation"])
chrome_options.add_experimental_option("useAutomationExtension", False)

# Create the driver
driver = webdriver.Chrome(options=chrome_options)

# Apply stealth patches
stealth(driver,
    languages=["en-US", "en"],
    vendor="Google Inc.",
    platform="Win32",
    webgl_vendor="Intel Inc.",
    renderer="Intel Iris OpenGL Engine",
    fix_hairline=True,
)

# Now use the driver as normal
driver.get("https://example.com")
print(driver.title)
driver.quit()
```

The `excludeSwitches` and `useAutomationExtension` options in the Chrome configuration are not part of selenium-stealth itself, but they complement it. The first removes the "Chrome is being controlled by automated test software" banner and its associated detection signal. The second disables Chrome's built-in automation extension.

## What selenium-stealth Patches

The library targets the most commonly checked automation fingerprints. Here is what it modifies:

### navigator.webdriver

This is the single most basic bot detection check. When Chrome is controlled by Selenium, `navigator.webdriver` returns `true`. Real browsers return `false` or `undefined`. selenium-stealth overrides this property to return `false`.

```python
# Before stealth: navigator.webdriver = true
# After stealth:  navigator.webdriver = false
```

### navigator.languages

An empty or single-entry language list is suspicious. selenium-stealth sets this to whatever you configure, defaulting to a realistic value:

```python
stealth(driver, languages=["en-US", "en"])
```

This makes `navigator.languages` return `["en-US", "en"]` instead of an empty or default list.

### navigator.plugins

A real Chrome browser has plugins like Chrome PDF Plugin and Chrome PDF Viewer. Selenium sessions typically report zero plugins. selenium-stealth injects fake plugin objects that mimic the structure and properties of real Chrome plugins.

### navigator.vendor

Real Chrome reports `"Google Inc."` as the vendor. Some Selenium configurations leave this empty or set it to an unexpected value. selenium-stealth lets you set it explicitly:

```python
stealth(driver, vendor="Google Inc.")
```

### WebGL Renderer and Vendor

Detection scripts use WebGL to query the graphics hardware and driver information. Mismatches between the reported renderer and the platform you claim to be on are a strong signal. selenium-stealth lets you specify both:

```python
stealth(driver,
    webgl_vendor="Intel Inc.",
    renderer="Intel Iris OpenGL Engine",
)
```

Choose values that are consistent with the platform you are spoofing. If you set `platform="Win32"`, use a renderer string that actually exists on Windows systems.

### chrome.runtime

Real Chrome browsers have a `chrome.runtime` object with specific properties. Automated Chrome sessions often have this object missing or incorrectly structured. selenium-stealth patches it to look like a normal browser.

### window.chrome

Similar to `chrome.runtime`, the `window.chrome` object is expected to exist in a real Chrome session. selenium-stealth ensures it is present with the correct structure.

### Permissions API

Detection scripts call `navigator.permissions.query()` to check the notification permission state. In automated browsers, this often throws an error or returns unexpected values. selenium-stealth patches the Permissions API to return consistent results.

### Hairline Fix

The `fix_hairline=True` option patches a rendering quirk where thin lines (hairlines) are displayed differently in automated Chrome compared to normal Chrome. This is a subtle visual fingerprint that some detection systems check.

## What selenium-stealth Does NOT Patch

Understanding the limits is just as important as understanding the capabilities. These are the areas where selenium-stealth offers no protection:

### TLS Fingerprint

Every browser has a unique TLS fingerprint based on its cipher suites, extensions, and handshake parameters. Detection systems use JA3 and JA4 hashing to identify the TLS fingerprint before any page content loads. Tools like [httpmorph address this at the HTTP client level](/posts/httpmorph-solving-tls-fingerprinting-with-a-c-native-python-http-client/). selenium-stealth operates at the JavaScript level and has no ability to modify TLS behavior. Your browser's TLS fingerprint will still match Selenium-controlled Chrome.

### Behavioral Analysis

selenium-stealth does not change how you interact with the page. If your scraper navigates instantly, clicks without moving the mouse, or types at perfectly uniform intervals, behavioral analysis systems will flag you regardless of fingerprint patches.

### Canvas Fingerprint

While selenium-stealth patches WebGL renderer strings, it does not modify canvas fingerprint output. Detection scripts render invisible canvas elements and hash the pixel output. The hash differs between real and automated browsers due to differences in font rendering, antialiasing, and GPU processing.

### CDP (Chrome DevTools Protocol) Markers

Selenium communicates with Chrome through the Chrome DevTools Protocol. Some detection scripts probe for artifacts left by this connection, such as specific properties on the `window` object or the presence of debugging ports. selenium-stealth does not address these markers.

### iframe Consistency

Detection scripts sometimes load checks inside iframes to see if the stealth patches propagate. Some JavaScript-level patches only apply to the main frame, leaving iframes unpatched. This inconsistency is itself a detection signal.

## Testing Before and After

You can verify the effect of selenium-stealth by checking key properties before and after applying it.

```python
from selenium import webdriver
from selenium.webdriver.chrome.options import Options
from selenium_stealth import stealth

def check_fingerprint(driver):
    """Check common bot detection properties."""
    checks = {
        "navigator.webdriver": driver.execute_script("return navigator.webdriver"),
        "navigator.languages": driver.execute_script("return navigator.languages"),
        "navigator.vendor": driver.execute_script("return navigator.vendor"),
        "plugins_count": driver.execute_script("return navigator.plugins.length"),
        "chrome_exists": driver.execute_script("return !!window.chrome"),
        "chrome_runtime": driver.execute_script(
            "return typeof window.chrome !== 'undefined' && "
            "typeof window.chrome.runtime !== 'undefined'"
        ),
        "webgl_vendor": driver.execute_script(
            "var canvas = document.createElement('canvas');"
            "var gl = canvas.getContext('webgl');"
            "if (!gl) return 'no webgl';"
            "var ext = gl.getExtension('WEBGL_debug_renderer_info');"
            "return ext ? gl.getParameter(ext.UNMASKED_VENDOR_WEBGL) : 'no ext';"
        ),
        "webgl_renderer": driver.execute_script(
            "var canvas = document.createElement('canvas');"
            "var gl = canvas.getContext('webgl');"
            "if (!gl) return 'no webgl';"
            "var ext = gl.getExtension('WEBGL_debug_renderer_info');"
            "return ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : 'no ext';"
        ),
    }
    return checks


# Without stealth
chrome_options = Options()
chrome_options.add_argument("--headless=new")
driver = webdriver.Chrome(options=chrome_options)
driver.get("about:blank")

print("=== WITHOUT stealth ===")
for key, value in check_fingerprint(driver).items():
    print(f"  {key}: {value}")
driver.quit()

# With stealth
chrome_options = Options()
chrome_options.add_argument("--headless=new")
chrome_options.add_experimental_option("excludeSwitches", ["enable-automation"])
chrome_options.add_experimental_option("useAutomationExtension", False)
driver = webdriver.Chrome(options=chrome_options)

stealth(driver,
    languages=["en-US", "en"],
    vendor="Google Inc.",
    platform="Win32",
    webgl_vendor="Intel Inc.",
    renderer="Intel Iris OpenGL Engine",
    fix_hairline=True,
)

driver.get("about:blank")
print("\n=== WITH stealth ===")
for key, value in check_fingerprint(driver).items():
    print(f"  {key}: {value}")
driver.quit()
```

Typical output looks like this:

```text
=== WITHOUT stealth ===
  navigator.webdriver: True
  navigator.languages: ['en-US']
  navigator.vendor: Google Inc.
  plugins_count: 0
  chrome_exists: False
  chrome_runtime: False
  webgl_vendor: Google Inc. (...)
  webgl_renderer: ANGLE (...)

=== WITH stealth ===
  navigator.webdriver: False
  navigator.languages: ['en-US', 'en']
  navigator.vendor: Google Inc.
  plugins_count: 3
  chrome_exists: True
  chrome_runtime: True
  webgl_vendor: Intel Inc.
  webgl_renderer: Intel Iris OpenGL Engine
```

The difference in `plugins_count`, `chrome_exists`, and `navigator.webdriver` is what gets you past basic detection systems.

## Limitations

selenium-stealth has practical limits you should be aware of before committing to it:

**Maintenance cadence.** The library is maintained but not frequently updated. Detection systems evolve constantly, adding new checks and refining existing ones. selenium-stealth's patches target a specific set of known checks, and new detection methods may not be covered until the library is updated.

**Chrome only.** It works exclusively with Chrome via Selenium. If you need Firefox or Edge support, you will need a different approach.

**JavaScript-level only.** All patches operate by injecting JavaScript. This means they can be detected by sophisticated systems that compare JavaScript-level values with lower-level browser internals, check for property descriptor tampering, or probe for the presence of override scripts.

**No headless-specific patches.** Running in headless mode introduces additional fingerprint differences (screen dimensions, rendering behavior). selenium-stealth does not specifically address headless-mode artifacts, though using `--headless=new` (the newer headless mode) reduces some of these differences.

**Static fingerprint.** The fingerprint values you set are static for the session. If you run multiple sessions with identical fingerprints, detection systems that track fingerprint uniqueness may flag you.

## Alternatives

When selenium-stealth is not enough, these tools offer more comprehensive evasion:

### undetected-chromedriver

`undetected-chromedriver` takes a more aggressive approach than selenium-stealth. Instead of just injecting JavaScript patches, it modifies the ChromeDriver binary itself to remove automation markers at the binary level. It also patches the Chrome executable to remove CDP detection artifacts.

```python
import undetected_chromedriver as uc

driver = uc.Chrome(headless=False)
driver.get("https://example.com")
```

undetected-chromedriver handles more detection vectors than selenium-stealth, including some CDP-level markers. However, it can be slower to start up and occasionally has compatibility issues with the latest Chrome versions.

### SeleniumBase UC Mode

SeleniumBase offers an "Undetected Chrome" mode that combines undetected-chromedriver with additional stealth patches and a higher-level API:

```python
from seleniumbase import SB

with SB(uc=True) as sb:
    sb.open("https://example.com")
    sb.type("#search", "query")
    sb.click("button[type='submit']")
```

SeleniumBase UC Mode is the most comprehensive Selenium-based stealth solution. It handles driver patching, runtime patches, and provides utility methods for solving CAPTCHAs. If you want to stay in the Selenium ecosystem but need stronger evasion, this is the natural upgrade path.

### Nodriver

For the strongest stealth available in Python, [nodriver](/posts/nodriver-complete-guide-undetected-browser-automation-python/) bypasses Selenium entirely. It communicates with Chrome through the raw DevTools Protocol without any WebDriver dependency, which eliminates the entire class of WebDriver-based detection:

```python
import nodriver as uc

async def main():
    browser = await uc.start()
    page = await browser.get("https://example.com")
    content = await page.get_content()
    print(content)

uc.loop().run_until_complete(main())
```

## When selenium-stealth Is Enough

selenium-stealth is the right tool when:

- The target site uses basic bot detection that checks `navigator.webdriver`, plugin counts, and similar JavaScript properties
- You are scraping medium-security sites that do not employ Cloudflare, DataDome, or PerimeterX
- You need a quick drop-in solution that does not require rewriting your existing Selenium code
- The site uses simple rate limiting combined with basic fingerprint checks
- You are building a prototype and want to test whether JS-level patches are sufficient before investing in heavier tools

A good rule of thumb: if you can access the site manually in Chrome DevTools (with the console open and the automation banner showing) without being blocked, selenium-stealth will likely work.

## When to Upgrade

You need to move beyond selenium-stealth when:

- The target site uses Cloudflare Bot Management, DataDome, PerimeterX, or Akamai Bot Manager
- You are getting blocked despite passing all JavaScript fingerprint checks (this suggests TLS or behavioral detection)
- The site uses canvas fingerprinting as a primary detection method
- You see CAPTCHA challenges that appear only for your automated sessions
- Detection seems to happen before the page loads (indicating TLS-level blocking)

In these cases, consider upgrading to undetected-chromedriver, SeleniumBase UC Mode, or nodriver depending on how much code you are willing to rewrite. For a head-to-head look at how [Playwright and Selenium compare on stealth](/posts/playwright-vs-selenium-stealth-which-evades-detection-better/), see our dedicated comparison. The [stealth browsers landscape in 2026](/posts/stealth-browsers-in-2026-camoufox-nodriver-and-the-anti-detection-arms-race/) covers the full range of options.

## Complete Working Example

Here is a full example with error handling that demonstrates a realistic selenium-stealth setup:

```python
import time
import logging
from selenium import webdriver
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.chrome.service import Service
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from selenium.common.exceptions import (
    TimeoutException,
    WebDriverException,
)
from selenium_stealth import stealth

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


def create_stealth_driver():
    """Create a Selenium Chrome driver with stealth patches applied."""
    chrome_options = Options()

    # Basic Chrome flags for a cleaner fingerprint
    chrome_options.add_argument("--start-maximized")
    chrome_options.add_argument("--disable-blink-features=AutomationControlled")
    chrome_options.add_experimental_option("excludeSwitches", ["enable-automation"])
    chrome_options.add_experimental_option("useAutomationExtension", False)

    # Optional: set a realistic user agent
    chrome_options.add_argument(
        "--user-agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/120.0.0.0 Safari/537.36"
    )

    driver = webdriver.Chrome(options=chrome_options)

    # Apply stealth patches
    stealth(driver,
        languages=["en-US", "en"],
        vendor="Google Inc.",
        platform="Win32",
        webgl_vendor="Intel Inc.",
        renderer="Intel Iris OpenGL Engine",
        fix_hairline=True,
    )

    return driver


def scrape_with_stealth(url, css_selector, timeout=15):
    """
    Navigate to a URL and extract text from elements matching a CSS selector.

    Returns a list of text strings, one per matched element.
    """
    driver = None
    try:
        driver = create_stealth_driver()
        logger.info(f"Navigating to {url}")
        driver.get(url)

        # Wait for the target elements to appear
        WebDriverWait(driver, timeout).until(
            EC.presence_of_element_located((By.CSS_SELECTOR, css_selector))
        )

        # Small delay to let any lazy-loaded content finish
        time.sleep(2)

        elements = driver.find_elements(By.CSS_SELECTOR, css_selector)
        results = [el.text for el in elements if el.text.strip()]

        logger.info(f"Found {len(results)} elements matching '{css_selector}'")
        return results

    except TimeoutException:
        logger.warning(f"Timed out waiting for '{css_selector}' on {url}")
        return []

    except WebDriverException as e:
        logger.error(f"WebDriver error: {e.msg}")
        return []

    except Exception as e:
        logger.error(f"Unexpected error: {e}")
        return []

    finally:
        if driver:
            driver.quit()
            logger.info("Driver closed")


if __name__ == "__main__":
    # Example: scrape heading text from a page
    url = "https://example.com"
    selector = "h1"

    results = scrape_with_stealth(url, selector)
    for i, text in enumerate(results, 1):
        print(f"{i}. {text}")
```

This example combines selenium-stealth with several complementary techniques: the `excludeSwitches` option, the `AutomationControlled` blink feature flag, a realistic user agent string, and proper wait handling. Together, these give you the best chance of passing basic bot detection while keeping the code maintainable and easy to extend.

## Summary

selenium-stealth fills a specific niche: it is the fastest way to make Selenium less detectable without rewriting your codebase. Install it, call `stealth()` on your driver, and you immediately pass the most common JavaScript-level bot checks. But it operates entirely at the JS level, which means it cannot address TLS fingerprints, behavioral analysis, canvas hashing, or CDP artifacts. Know its boundaries, test against your target site, and be ready to upgrade to undetected-chromedriver, SeleniumBase UC Mode, or nodriver when you hit detection that selenium-stealth cannot handle. If you are still weighing Selenium against Puppeteer altogether, the [Selenium vs Puppeteer comparison](/posts/selenium-vs-puppeteer-definitive-comparison-web-scraping/) may help you decide.
