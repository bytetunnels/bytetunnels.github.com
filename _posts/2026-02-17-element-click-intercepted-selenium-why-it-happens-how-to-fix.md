---
title: "Element Click Intercepted in Selenium: Why It Happens and How to Fix It"
date: 2026-02-17 12:00:00 +0000
categories: ["Browser Automation"]
tags: ["selenium", "element click intercepted", "debugging", "python", "error", "web scraping"]
author: arman
image:
  path: /assets/img/2026-02-17-element-click-intercepted-selenium-why-it-happens-how-to-fix-hero.png
  alt: "Element Click Intercepted in Selenium: Why It Happens and How to Fix It"
---

If you have spent any amount of time writing [Selenium](/posts/python-requests-vs-selenium-speed-performance-comparison/) scripts, you have seen this error: `ElementClickInterceptedException: element click intercepted: Element is not clickable at point (X, Y). Other element would receive the click`. It is one of the most common Selenium errors, and it is also one of the most frustrating because the element is right there in the DOM. You can find it, you can read its text, you can get its attributes, but the moment you call `.click()` on it, Selenium refuses. The reason is straightforward once you understand it: another element is physically covering the one you want to click, and Selenium will not click through it. This post explains every common cause and gives you five reliable fixes you can use immediately.

## What the Error Actually Means

When you call `element.click()` in Selenium, the WebDriver does not just fire a click event on the element. It simulates a real user click at a specific pixel coordinate on the screen. Before performing that click, it checks whether the element at those coordinates is actually the one you intended to click. If a different element is sitting on top of your target, Selenium raises `ElementClickInterceptedException`.

This is the full traceback you typically see:

```python
from selenium import webdriver
from selenium.webdriver.common.by import By

driver = webdriver.Chrome()
driver.get("https://example.com/products")

button = driver.find_element(By.CSS_SELECTOR, "button.add-to-cart")
button.click()
# selenium.common.exceptions.ElementClickInterceptedException:
# Message: element click intercepted: Element <button class="add-to-cart">
# is not clickable at point (412, 730).
# Other element <div class="cookie-banner"> would receive the click
```

The key information is in the error message itself. Selenium tells you exactly which element would receive the click instead. In this case, a `div` with class `cookie-banner` is covering the button. That is your starting point for debugging.

## Why This Happens: The Common Causes

The error always comes down to the same thing: an element with a higher z-index, a fixed position, or a later position in the DOM stacking order is sitting between the viewport and your target. Here are the specific situations that trigger it most often.

### Cookie Consent Banners

These are the number one cause. Almost every website now shows a cookie consent popup or banner. They are typically fixed to the bottom or center of the viewport with a high z-index. They cover everything underneath:

```html
<!-- Typical cookie banner structure -->
<div class="cookie-overlay" style="position: fixed; bottom: 0; left: 0;
     width: 100%; z-index: 99999; background: white; padding: 20px;">
    <p>We use cookies to improve your experience.</p>
    <button class="accept-cookies">Accept All</button>
</div>
```

Any element behind this banner is unclickable until the banner is dismissed.

### Fixed or Sticky Headers and Footers

Navigation bars that stick to the top of the page as you scroll are a constant problem. When Selenium scrolls an element into view, the element might end up directly behind the sticky header:

```html
<nav style="position: sticky; top: 0; z-index: 1000; height: 64px;">
    <!-- Navigation links -->
</nav>
```

The element is technically visible, but 64 pixels of it (or all of it) are hidden under the nav bar. Selenium tries to click the center of the element and hits the nav instead.

### Loading Overlays and Spinners

Many single-page applications show a full-screen loading overlay while data is being fetched. These overlays are transparent or semi-transparent divs that cover the entire viewport:

```html
<div class="loading-overlay" style="position: fixed; top: 0; left: 0;
     width: 100%; height: 100%; z-index: 10000; background: rgba(0,0,0,0.5);">
    <div class="spinner"></div>
</div>
```

Even after the content underneath has loaded, if the overlay removal is delayed by a fraction of a second, your click will hit the overlay.

### Dropdown Menus Covering Elements

When a dropdown menu is open, it can overlap elements below it. If your script opens a dropdown and then immediately tries to click something else without closing the dropdown first, the dropdown receives the click.

### Invisible Overlay Divs

Some websites place transparent divs over content areas for analytics tracking, ad targeting, or click hijacking. These divs have no visible appearance but have `position: absolute` or `position: fixed` and sit on top of the content:

```html
<div class="tracking-overlay" style="position: absolute; top: 0; left: 0;
     width: 100%; height: 100%; z-index: 5; background: transparent;">
</div>
```

You cannot see them on the page, but Selenium detects them because they are real DOM elements occupying real screen space.

### Element Not Scrolled Into View

If an element is partially off-screen, Selenium will attempt to scroll it into view before clicking. But the default scroll behavior might place the element at the very edge of the viewport where a fixed header or footer covers it.

## Fix 1: Scroll the Element Into View Properly

The simplest fix handles the case where a sticky header or footer is covering your element. Instead of relying on Selenium's default scroll behavior, scroll the element to the center of the viewport:

```python
from selenium import webdriver
from selenium.webdriver.common.by import By

driver = webdriver.Chrome()
driver.get("https://example.com/products")

element = driver.find_element(By.CSS_SELECTOR, "button.add-to-cart")

# Scroll element to the center of the viewport
driver.execute_script(
    "arguments[0].scrollIntoView({block: 'center', inline: 'center'});",
    element
)

# Small pause to let scroll complete
import time
time.sleep(0.3)

element.click()
```

The `{block: 'center'}` option tells the browser to position the element in the vertical center of the viewport, keeping it well clear of any sticky headers or footers. This alone fixes a large percentage of intercepted click errors.

You can also add a pixel offset if you know the exact height of the sticky header:

```python
# Scroll with offset to account for a 64px sticky header
driver.execute_script("""
    arguments[0].scrollIntoView(true);
    window.scrollBy(0, -80);
""", element)
```

This scrolls the element into view at the top of the page, then scrolls back up by 80 pixels to clear the header.

## Fix 2: Wait for the Overlay to Disappear

When the intercepting element is a loading spinner or temporary overlay, the correct fix is to wait for it to go away before clicking. Selenium's `WebDriverWait` combined with `expected_conditions` handles this cleanly:

```python
from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC

driver = webdriver.Chrome()
driver.get("https://example.com/dashboard")

# Wait for the loading overlay to disappear
WebDriverWait(driver, 15).until(
    EC.invisibility_of_element_located(
        (By.CSS_SELECTOR, "div.loading-overlay")
    )
)

# Now the element is unobstructed
button = driver.find_element(By.CSS_SELECTOR, "button.submit-report")
button.click()
```

The `invisibility_of_element_located` condition waits until the element is either not present in the DOM or has a CSS `display: none` or `visibility: hidden` style. It will wait up to the timeout you specify (15 seconds in this example) before raising a `TimeoutException`.

You can also wait for the target element itself to be clickable, which implicitly checks that nothing is blocking it:

```python
# Wait until the button is clickable (visible and not obstructed)
button = WebDriverWait(driver, 15).until(
    EC.element_to_be_clickable(
        (By.CSS_SELECTOR, "button.submit-report")
    )
)
button.click()
```

The `element_to_be_clickable` condition checks that the element is visible and enabled. However, it does not guarantee that no overlay is covering it. If overlays are involved, explicitly waiting for the overlay to disappear is more reliable.


<figure>
  <img src="/assets/img/inline-element-click-intercepted-selenium-why-i-1.jpg" alt="Selenium pioneered browser automation and remains widely used today." loading="lazy">
  <figcaption>Selenium pioneered browser automation and remains widely used today. <span class="img-credit">Photo by ThisIsEngineering / <a href="https://www.pexels.com" target="_blank" rel="noopener noreferrer">Pexels</a></span></figcaption>
</figure>

## Fix 3: Use a JavaScript Click

When you do not care about simulating a real user click and just need the element's click handler to fire, you can bypass the interception check entirely by executing the click through JavaScript:

```python
from selenium import webdriver
from selenium.webdriver.common.by import By

driver = webdriver.Chrome()
driver.get("https://example.com/products")

element = driver.find_element(By.CSS_SELECTOR, "button.add-to-cart")

# JavaScript click bypasses the interception check
driver.execute_script("arguments[0].click();", element)
```

This calls the element's native `.click()` method directly in the browser's JavaScript context. There is no coordinate-based hit test, no check for overlapping elements. The click event fires on the element you specified, period.

There are trade-offs. A JavaScript click does not perfectly replicate user behavior. It does not trigger `mouseover`, `mousedown`, or `mouseup` events in the same sequence a real click does. Some JavaScript frameworks rely on that full event sequence. For web scraping, this rarely matters. For UI testing, it can cause false positives where a test passes but a real user could not actually click the button.

If you need the full event sequence but still want to avoid the interception, you can dispatch a synthetic event:

```python
driver.execute_script("""
    var event = new MouseEvent('click', {
        bubbles: true,
        cancelable: true,
        view: window
    });
    arguments[0].dispatchEvent(event);
""", element)
```

This fires a proper `MouseEvent` that bubbles up through the DOM, which is closer to what a real click does.

## Fix 4: Dismiss the Intercepting Element First

The most correct fix, when possible, is to get rid of the blocking element before trying to click your target. If it is a cookie banner, accept or dismiss it. If it is a modal, close it:

```python
from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC

driver = webdriver.Chrome()
driver.get("https://example.com/products")

# Handle cookie consent banner
try:
    cookie_button = WebDriverWait(driver, 5).until(
        EC.element_to_be_clickable(
            (By.CSS_SELECTOR, "button.accept-cookies, button#cookie-accept, "
                              "[data-testid='cookie-accept']")
        )
    )
    cookie_button.click()

    # Wait for the banner to disappear
    WebDriverWait(driver, 5).until(
        EC.invisibility_of_element_located(
            (By.CSS_SELECTOR, "div.cookie-overlay, div.cookie-banner")
        )
    )
except Exception:
    # No cookie banner appeared, continue
    pass

# Now click the target element
button = driver.find_element(By.CSS_SELECTOR, "button.add-to-cart")
button.click()
```

For more stubborn overlays that do not have a close button, you can remove them from the DOM with JavaScript:

```python
# Remove an overlay element entirely
driver.execute_script("""
    var overlay = document.querySelector('div.tracking-overlay');
    if (overlay) {
        overlay.remove();
    }
""")
```

Or hide it with CSS:

```python
# Hide the overlay without removing it from the DOM
driver.execute_script("""
    var overlay = document.querySelector('div.tracking-overlay');
    if (overlay) {
        overlay.style.display = 'none';
    }
""")
```

Removing elements from the DOM can sometimes break the page's JavaScript. Hiding with `display: none` is safer when you need the page to keep functioning normally after the overlay is gone.

## Fix 5: Use ActionChains to Move to the Element First

Selenium's `ActionChains` class lets you build a sequence of low-level interactions. Moving to an element before clicking it can help because the move action scrolls the element into view and positions the mouse precisely:

```python
from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.common.action_chains import ActionChains

driver = webdriver.Chrome()
driver.get("https://example.com/products")

element = driver.find_element(By.CSS_SELECTOR, "button.add-to-cart")

# Move to element, then click
actions = ActionChains(driver)
actions.move_to_element(element).click().perform()
```

`move_to_element` scrolls the element into view if necessary and moves the virtual mouse to its center. This sometimes avoids interception because the scroll behavior is different from what `.click()` does on its own.

You can also move to the element with an offset to avoid the center point where an overlay might be thickest:

```python
# Click near the top-left corner of the element instead of the center
actions = ActionChains(driver)
actions.move_to_element_with_offset(element, 5, 5).click().perform()
```

This is useful when a small badge, tooltip, or notification icon overlaps the center of your target element but not its edges.


<figure>
  <img src="/assets/img/inline-element-click-intercepted-selenium-why-i-2.jpg" alt="A decade of Selenium set the stage for everything that followed." loading="lazy">
  <figcaption>A decade of Selenium set the stage for everything that followed. <span class="img-credit">Photo by Lukas Blazek / <a href="https://www.pexels.com" target="_blank" rel="noopener noreferrer">Pexels</a></span></figcaption>
</figure>

## Debugging: How to Identify What Is Blocking the Click

When you hit this error and none of the obvious causes apply, you need to figure out exactly what element is intercepting the click. The error message usually tells you, but sometimes you need more context.

### Take a Screenshot at the Moment of Failure

```python
from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.common.exceptions import ElementClickInterceptedException

driver = webdriver.Chrome()
driver.get("https://example.com/products")

element = driver.find_element(By.CSS_SELECTOR, "button.add-to-cart")

try:
    element.click()
except ElementClickInterceptedException as e:
    # Save a screenshot to see what the page looks like
    driver.save_screenshot("/tmp/click_intercepted.png")

    # Also save the page source for inspection
    with open("/tmp/click_intercepted.html", "w") as f:
        f.write(driver.page_source)

    print(f"Click intercepted: {e}")
    raise
```

The screenshot shows you the visual state of the page at the exact moment the click failed. Often you will see a banner, modal, or loading spinner that you did not account for.

### Use JavaScript to Find What Is at the Click Point

Selenium's error message tells you the coordinates where it tried to click. You can use `document.elementFromPoint()` to inspect what element is at those coordinates:

```python
# Assume the error said "not clickable at point (412, 730)"
blocking_element = driver.execute_script("""
    var el = document.elementFromPoint(412, 730);
    return {
        tagName: el.tagName,
        className: el.className,
        id: el.id,
        textContent: el.textContent.substring(0, 100),
        zIndex: window.getComputedStyle(el).zIndex,
        position: window.getComputedStyle(el).position,
        display: window.getComputedStyle(el).display,
        outerHTML: el.outerHTML.substring(0, 500)
    };
""")
print(blocking_element)
```

This returns detailed information about the element that is actually at those coordinates, including its z-index and position style. This is the element that would receive the click.

### Inspect the Z-Index Stack

When you suspect a z-index issue but are not sure which elements are involved, dump every element on the page that has a non-default z-index:

```python
z_index_elements = driver.execute_script("""
    var results = [];
    var all = document.querySelectorAll('*');
    for (var i = 0; i < all.length; i++) {
        var style = window.getComputedStyle(all[i]);
        var zIndex = style.zIndex;
        var position = style.position;
        if (zIndex !== 'auto' && position !== 'static') {
            results.push({
                tagName: all[i].tagName,
                className: all[i].className,
                id: all[i].id,
                zIndex: zIndex,
                position: position,
                rect: all[i].getBoundingClientRect()
            });
        }
    }
    return results.sort(function(a, b) {
        return parseInt(b.zIndex) - parseInt(a.zIndex);
    });
""")

for el in z_index_elements[:10]:
    print(f"{el['tagName']}.{el['className']} - z-index: {el['zIndex']}, "
          f"position: {el['position']}")
```

This gives you a sorted list of all positioned elements with explicit z-index values. The elements at the top of the list are the ones most likely to intercept clicks.

## Prevention: Designing Scrapers That Handle Overlays

Instead of fixing the error after it happens, build your scrapers to deal with overlays proactively. Create utility functions that handle common blocking scenarios before any click:

{% raw %}
```python
from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC

# Common overlay selectors to check for and dismiss
OVERLAY_SELECTORS = [
    # Cookie banners
    "div.cookie-banner",
    "div.cookie-overlay",
    "div#cookie-consent",
    "[class*='cookie-notice']",
    "[class*='gdpr']",

    # Loading overlays
    "div.loading-overlay",
    "div.page-loader",
    "[class*='loading-mask']",
    "[class*='spinner-overlay']",

    # Modal backdrops
    "div.modal-backdrop",
    "[class*='overlay-backdrop']",
]

DISMISS_BUTTON_SELECTORS = [
    "button.accept-cookies",
    "button#cookie-accept",
    "[data-testid='cookie-accept']",
    "button[aria-label='Accept cookies']",
    "button[aria-label='Close']",
    "[class*='cookie'] button",
    "[class*='consent'] button[class*='accept']",
]


def dismiss_overlays(driver, timeout=3):
    """Attempt to dismiss any visible overlays on the page."""
    for selector in DISMISS_BUTTON_SELECTORS:
        try:
            button = WebDriverWait(driver, timeout).until(
                EC.element_to_be_clickable((By.CSS_SELECTOR, selector))
            )
            button.click()
            return True
        except Exception:
            continue
    return False


def wait_for_clear_viewport(driver, timeout=10):
    """Wait until no known overlay is blocking the viewport."""
    for selector in OVERLAY_SELECTORS:
        try:
            WebDriverWait(driver, timeout).until(
                EC.invisibility_of_element_located(
                    (By.CSS_SELECTOR, selector)
                )
            )
        except Exception:
            pass


def remove_overlays_js(driver):
    """Force-remove all known overlay elements via JavaScript."""
    selectors = ", ".join(OVERLAY_SELECTORS)
    driver.execute_script(f"""
        document.querySelectorAll('{selectors}').forEach(function(el) {{
            el.style.display = 'none';
        }});
    """)
```
{% endraw %}

Call `dismiss_overlays` after every page navigation and before any click sequence. This catches the most common interception causes before they become errors.

## Complete Example: Robust Click With Multiple Fallbacks

Here is a complete function that attempts to click an element using progressively more aggressive strategies. It starts with the normal click, then falls back to scrolling, waiting, ActionChains, and finally a JavaScript click:

```python
import time
from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.common.action_chains import ActionChains
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from selenium.common.exceptions import (
    ElementClickInterceptedException,
    ElementNotInteractableException,
    TimeoutException,
)


def robust_click(driver, locator, timeout=10, js_fallback=True):
    """
    Attempt to click an element with multiple fallback strategies.

    Args:
        driver: Selenium WebDriver instance.
        locator: Tuple of (By, selector), e.g. (By.CSS_SELECTOR, "button.submit").
        timeout: Maximum wait time in seconds.
        js_fallback: Whether to use JavaScript click as a last resort.

    Returns:
        True if the click succeeded, raises exception otherwise.
    """
    # Strategy 1: Wait for element to be clickable and click normally
    try:
        element = WebDriverWait(driver, timeout).until(
            EC.element_to_be_clickable(locator)
        )
        element.click()
        return True
    except ElementClickInterceptedException:
        pass

    # Strategy 2: Scroll element to center and retry
    try:
        element = driver.find_element(*locator)
        driver.execute_script(
            "arguments[0].scrollIntoView({block: 'center', inline: 'center'});",
            element,
        )
        time.sleep(0.5)
        element.click()
        return True
    except ElementClickInterceptedException:
        pass

    # Strategy 3: Try to dismiss any overlay first, then retry
    try:
        dismiss_overlays(driver)
        time.sleep(0.5)
        element = driver.find_element(*locator)
        element.click()
        return True
    except ElementClickInterceptedException:
        pass

    # Strategy 4: Use ActionChains
    try:
        element = driver.find_element(*locator)
        ActionChains(driver).move_to_element(element).pause(0.3).click().perform()
        return True
    except (ElementClickInterceptedException, ElementNotInteractableException):
        pass

    # Strategy 5: JavaScript click (last resort)
    if js_fallback:
        element = driver.find_element(*locator)
        driver.execute_script("arguments[0].click();", element)
        return True

    raise ElementClickInterceptedException(
        f"All click strategies failed for locator: {locator}"
    )


def dismiss_overlays(driver):
    """Dismiss cookie banners, modals, and other common overlays."""
    dismiss_scripts = [
        # Hide elements by common overlay class patterns
        """
        var selectors = [
            '[class*="cookie"]', '[class*="consent"]', '[class*="gdpr"]',
            '[class*="overlay"]', '[class*="modal-backdrop"]',
            '[class*="loading-mask"]'
        ];
        selectors.forEach(function(sel) {
            document.querySelectorAll(sel).forEach(function(el) {
                var style = window.getComputedStyle(el);
                if (style.position === 'fixed' || style.position === 'absolute') {
                    if (parseInt(style.zIndex) > 100) {
                        el.style.display = 'none';
                    }
                }
            });
        });
        """,
        # Remove any full-viewport fixed overlays
        """
        document.querySelectorAll('*').forEach(function(el) {
            var style = window.getComputedStyle(el);
            if (style.position === 'fixed' &&
                el.offsetWidth >= window.innerWidth * 0.9 &&
                el.offsetHeight >= window.innerHeight * 0.9 &&
                el.tagName !== 'HTML' && el.tagName !== 'BODY') {
                el.style.display = 'none';
            }
        });
        """,
    ]
    for script in dismiss_scripts:
        try:
            driver.execute_script(script)
        except Exception:
            pass


# Usage example
if __name__ == "__main__":
    driver = webdriver.Chrome()

    try:
        driver.get("https://example.com/products")

        # Proactively dismiss overlays after page load
        dismiss_overlays(driver)

        # Use robust_click instead of element.click()
        robust_click(
            driver,
            (By.CSS_SELECTOR, "button.add-to-cart"),
            timeout=10,
        )
        print("Click succeeded")

    except Exception as e:
        driver.save_screenshot("/tmp/click_debug.png")
        print(f"Click failed: {e}")

    finally:
        driver.quit()
```

This pattern covers virtually every scenario that causes `ElementClickInterceptedException`. The key design decisions are:

- Start with the standard click because it is the most faithful simulation of user behavior.
- Scroll to center before trying again, clearing sticky headers and footers.
- Attempt overlay dismissal as a middle ground between a normal click and a JavaScript click.
- Use ActionChains as a different approach to the same coordinate-based click.
- Fall back to JavaScript click only when everything else fails, because it skips the interception check entirely.

## When Not to Use JavaScript Click

It is tempting to always use `driver.execute_script("arguments[0].click();", element)` and skip the headache entirely. For web scraping, this is usually fine. But there are cases where it causes problems:

- **[Form submissions](/posts/how-to-automate-web-form-filling-complete-guide/)** that rely on `mousedown` and `mouseup` events to validate input before submitting. A JavaScript click fires only the `click` event.
- **Drag-and-drop interactions** where the click is part of a larger interaction sequence.
- **Elements that should not be clickable.** If an overlay is blocking a button because the page is in a loading state, clicking through the overlay with JavaScript might trigger an action before the page is ready, leading to errors or data corruption.
- **Sites with click fraud detection** that track event origins and flag programmatic clicks. Consider using [Selenium stealth techniques](/posts/selenium-stealth-making-selenium-less-detectable/) to reduce detection risk on such sites.

For scraping, rule of thumb: use the normal click when it works and JavaScript click when it does not. For testing, always fix the underlying issue rather than bypassing the check. If you are comparing Selenium against other tools for your scraping workflow, see our [mega comparison of Playwright, Puppeteer, Selenium, and Scrapy](/posts/playwright-vs-puppeteer-vs-selenium-vs-scrapy-2026-mega-comparison/).

## Quick Reference

| Cause | Best Fix |
|---|---|
| Cookie banner | Dismiss it, then click |
| Sticky header/footer | Scroll to center |
| Loading overlay | Wait for invisibility |
| Transparent tracking div | Remove with JavaScript |
| Dropdown covering element | Close dropdown first |
| Element partially off-screen | Scroll to center |
| Unknown blocker | Use `elementFromPoint()` to debug |

The `ElementClickInterceptedException` is not a bug in your code or in Selenium. It is Selenium doing exactly what it is supposed to do: refusing to click something a real user could not click. Understanding the cause tells you the fix. Scroll, wait, dismiss, or, when nothing else works, go around it with JavaScript.
