---
title: "Nodriver Click Handling: page.click and Element Interaction"
date: 2026-02-10 12:00:00 +0000
categories: ["Browser Automation"]
tags: ["nodriver", "click", "element interaction", "python", "browser automation", "tutorial"]
author: arman
image:
  path: /assets/img/2026-02-10-nodriver-click-handling-page-click-element-interaction-hero.png
  alt: "Nodriver Click Handling: page.click and Element Interaction"
---

Clicking elements in nodriver is not as simple as calling `page.click("#button")` and moving on. Nodriver is fully asynchronous, built on the Chrome DevTools Protocol, and its element model works differently from Selenium or Playwright. If you are new to the library, our [getting started with nodriver](/posts/getting-started-nodriver-python-installation-first-script/) guide covers installation and your first script. There is no single `page.click()` method that takes a CSS selector and clicks the matching element in one call. Instead, you find the element first, then interact with it. This two-step pattern runs through every kind of interaction: clicking, typing, reading attributes, and scrolling. Once you internalize it, nodriver's API becomes predictable and powerful. For a comprehensive overview of the library, see our [complete guide to nodriver](/posts/nodriver-complete-guide-undetected-browser-automation-python/). This post covers every interaction pattern you will need, from basic clicks to complex multi-step form flows.

## Finding Elements First

Before you can click anything, you need a reference to the element. Nodriver gives you two primary methods for finding elements on a page.

**`page.select(css_selector)`** finds the first element matching a CSS selector:

```python
import nodriver as uc
import asyncio


async def main():
    browser = await uc.start()
    page = await browser.get("https://example.com")

    # Find by CSS selector
    button = await page.select("button.submit")
    link = await page.select("a#nav-home")
    input_field = await page.select("input[name='email']")

    # select() returns None if nothing matches
    missing = await page.select("div.does-not-exist")
    print(missing)  # None

    browser.stop()


if __name__ == "__main__":
    uc.loop().run_until_complete(main())
```

**`page.find(text)`** finds the first element containing the given text:

```python
async def main():
    browser = await uc.start()
    page = await browser.get("https://example.com")

    # Find by visible text content
    login_link = await page.find("Log In")
    accept_button = await page.find("Accept Cookies")
    heading = await page.find("Welcome")

    browser.stop()
```

The `find()` method searches visible text across all elements. It is useful when you do not know the exact selector but you know what the element says. For buttons, links, and headings, text-based finding is often more reliable than selectors because text tends to stay stable across site redesigns while class names change.

**`page.select_all(css_selector)`** returns a list of all matching elements when you need more than the first one:

```python
async def main():
    browser = await uc.start()
    page = await browser.get("https://example.com/products")

    # Get all product cards
    cards = await page.select_all("div.product-card")
    print(f"Found {len(cards)} products")

    for card in cards:
        title = await card.query_selector("h3.title")
        if title:
            print(title.text)

    browser.stop()
```

## Clicking an Element

Once you have an element reference, clicking it is a single await call:

```python
async def main():
    browser = await uc.start()
    page = await browser.get("https://example.com/login")

    button = await page.select("button.login")
    if button:
        await button.click()
        print("Clicked the login button")

    browser.stop()
```

Always check that the element is not `None` before clicking. If `page.select()` does not find a match, calling `.click()` on `None` raises an `AttributeError`, and the error message will not tell you which selector failed. Wrapping the check in an `if` block makes debugging much easier.

## The Find-and-Click Pattern

Since nodriver does not have a `page.click(selector)` method, the standard pattern is to find the element and click it in sequence. You will write this pattern dozens of times in any nodriver project, so it helps to extract it into a helper:

```python
import nodriver as uc
import asyncio


async def click_selector(page, selector, timeout=10):
    """Find an element by CSS selector and click it."""
    import time
    start = time.time()
    while time.time() - start < timeout:
        element = await page.select(selector)
        if element:
            await element.click()
            return element
        await page.sleep(0.5)
    raise TimeoutError(f"Element not found: {selector}")


async def click_text(page, text, timeout=10):
    """Find an element by visible text and click it."""
    import time
    start = time.time()
    while time.time() - start < timeout:
        element = await page.find(text)
        if element:
            await element.click()
            return element
        await page.sleep(0.5)
    raise TimeoutError(f"Text not found: {text}")


async def main():
    browser = await uc.start()
    page = await browser.get("https://example.com")

    await click_selector(page, "button.accept-cookies")
    await click_text(page, "Sign In")

    browser.stop()


if __name__ == "__main__":
    uc.loop().run_until_complete(main())
```

These helpers add retry logic so they handle elements that take a moment to appear on the page. The timeout parameter prevents infinite loops when an element genuinely does not exist.

## Typing Into Inputs

To type text into an input field, use `element.send_keys()`:

```python
async def main():
    browser = await uc.start()
    page = await browser.get("https://example.com/login")

    # Find the email field and type into it
    email_input = await page.select("input[name='email']")
    if email_input:
        await email_input.send_keys("user@example.com")

    # Find the password field
    password_input = await page.select("input[name='password']")
    if password_input:
        await password_input.send_keys("secretpassword")

    # Click the submit button
    submit = await page.select("button[type='submit']")
    if submit:
        await submit.click()

    browser.stop()
```

`send_keys()` types characters one at a time, simulating real keyboard input. This matters for sites that validate input on each keystroke or use JavaScript keydown/keyup event handlers.

## Clearing Input Fields

When an input field already contains text, you need to clear it before typing new content. Nodriver does not have a dedicated `.clear()` method on elements, so you use `send_keys()` with keyboard shortcuts or JavaScript:

```python
async def clear_input(page, element):
    """Clear an input field by selecting all text and deleting it."""
    await element.click()
    # Select all text with Ctrl+A (or Cmd+A on macOS) then delete
    await element.send_keys("")
    await page.evaluate("""
        (elem) => { elem.value = ''; elem.dispatchEvent(new Event('input', { bubbles: true })); }
    """, element)


async def main():
    browser = await uc.start()
    page = await browser.get("https://example.com/search")

    search_box = await page.select("input#search")
    if search_box:
        # Clear any existing text
        await clear_input(page, search_box)
        # Type new search query
        await search_box.send_keys("nodriver tutorial")

    browser.stop()
```

The JavaScript approach is the most reliable. Setting `element.value = ''` clears the field, and dispatching an `input` event ensures that any JavaScript framework listening for changes (React, Vue, Angular) picks up the cleared state.

An alternative approach is to triple-click to select all text in the field, then type over it:

```python
async def clear_and_type(element, text):
    """Triple-click to select all, then type new text."""
    await element.click()
    await element.click()
    await element.click()
    await element.send_keys(text)
```

This works in many cases but can be fragile depending on how the site handles click events.


<figure>
  <img src="/assets/img/inline-nodriver-click-handling-page-click-eleme-1.jpg" alt="Staying undetected requires understanding what detection systems look for." loading="lazy">
  <figcaption>Staying undetected requires understanding what detection systems look for. <span class="img-credit">Photo by Maxim Landolfi / <a href="https://www.pexels.com" target="_blank" rel="noopener noreferrer">Pexels</a></span></figcaption>
</figure>

## Getting Element Attributes

Nodriver elements expose their HTML attributes through the `.attrs` property and their text content through `.text`:

```python
async def main():
    browser = await uc.start()
    page = await browser.get("https://example.com/products")

    link = await page.select("a.product-link")
    if link:
        # Get the href attribute
        href = link.attrs.get("href", "")
        print(f"Link URL: {href}")

        # Get the visible text
        print(f"Link text: {link.text}")

        # Get other attributes
        css_class = link.attrs.get("class", "")
        data_id = link.attrs.get("data-id", "")
        print(f"Class: {css_class}, Data ID: {data_id}")

    # Extract data from multiple elements
    prices = await page.select_all("span.price")
    for price in prices:
        print(f"Price: {price.text}")

    browser.stop()
```

The `.attrs` property is a dictionary of all HTML attributes on the element. The `.text` property returns the visible text content, similar to `innerText` in JavaScript.

For attributes that might not exist, always use `.get()` with a default value to avoid `KeyError` exceptions.

## Scrolling to Elements

Some elements are below the visible viewport and need to be scrolled into view before they can be clicked. Nodriver provides `element.scroll_into_view()`:

```python
async def main():
    browser = await uc.start()
    page = await browser.get("https://example.com/long-page")

    # Scroll to a specific element
    footer = await page.select("footer")
    if footer:
        await footer.scroll_into_view()
        await page.sleep(0.5)  # Brief pause for scroll animation
        print(f"Footer text: {footer.text}")

    # Scroll to and click a button that is off-screen
    load_more = await page.select("button.load-more")
    if load_more:
        await load_more.scroll_into_view()
        await load_more.click()

    browser.stop()
```

You can also scroll the page using JavaScript for more control:

```python
async def scroll_to_bottom(page):
    """Scroll to the bottom of the page."""
    await page.evaluate("window.scrollTo(0, document.body.scrollHeight)")


async def scroll_by_pixels(page, pixels):
    """Scroll down by a specific number of pixels."""
    await page.evaluate(f"window.scrollBy(0, {pixels})")


async def main():
    browser = await uc.start()
    page = await browser.get("https://example.com/infinite-scroll")

    # Scroll down in increments to trigger lazy loading
    for i in range(5):
        await scroll_by_pixels(page, 800)
        await page.sleep(1)  # Wait for new content to load

    browser.stop()
```

## Handling Elements Not Yet Visible

The most common click failure in browser automation is trying to click an element before it exists in the DOM. Dynamic sites load content asynchronously, and the element you want might appear a few seconds after the page loads. The wait-then-click pattern handles this:

```python
import time


async def wait_and_click(page, selector, timeout=15):
    """Wait for an element to appear, then click it."""
    start = time.time()
    while time.time() - start < timeout:
        element = await page.select(selector)
        if element:
            await element.scroll_into_view()
            await page.sleep(0.3)
            await element.click()
            return element
        await page.sleep(0.5)
    raise TimeoutError(
        f"Timed out waiting for '{selector}' after {timeout}s"
    )


async def main():
    browser = await uc.start()
    page = await browser.get("https://example.com/dashboard")

    # Wait for the dashboard to fully load, then click a tab
    await wait_and_click(page, "div.tab[data-tab='analytics']")

    # Wait for the analytics content to load, then click export
    await wait_and_click(page, "button.export-csv", timeout=20)

    browser.stop()
```

This pattern combines finding, scrolling, and clicking into one robust call. The scroll step matters because Chrome may refuse to click elements that are outside the viewport, even if they exist in the DOM.

## JavaScript-Based Clicking

Sometimes a normal click does not work. The element might be covered by an overlay, obscured by a sticky header, or intercepted by a JavaScript event handler that prevents the default action. In these cases, you can click using JavaScript through `page.evaluate()`:

```python
async def js_click(page, selector):
    """Click an element using JavaScript instead of simulated mouse events."""
    await page.evaluate(f"""
        document.querySelector('{selector}').click()
    """)


async def main():
    browser = await uc.start()
    page = await browser.get("https://example.com/tricky-page")

    # Normal click fails because a modal overlay intercepts it
    # Use JavaScript to bypass the overlay
    await js_click(page, "button.hidden-action")

    browser.stop()
```

You can also click by element reference rather than re-querying by selector:

```python
async def main():
    browser = await uc.start()
    page = await browser.get("https://example.com")

    element = await page.select("button.proceed")
    if element:
        # Use evaluate with the element reference
        await page.evaluate("(el) => el.click()", element)

    browser.stop()
```

JavaScript clicks bypass the normal event dispatch chain. They fire the `click` event directly on the element without simulating mouse movement, hover states, or checking if the element is visually obscured. This makes them powerful for tricky cases but less realistic for [stealth and anti-detection purposes](/posts/stealth-browsers-in-2026-camoufox-nodriver-and-the-anti-detection-arms-race/). Use JavaScript clicks as a fallback, not as your default.


<figure>
  <img src="/assets/img/inline-nodriver-click-handling-page-click-eleme-2.jpg" alt="The less a browser looks automated, the better it performs against detection." loading="lazy">
  <figcaption>The less a browser looks automated, the better it performs against detection. <span class="img-credit">Photo by Rafael Rendon / <a href="https://www.pexels.com" target="_blank" rel="noopener noreferrer">Pexels</a></span></figcaption>
</figure>

## Mouse Actions: Hover and Double-Click

Nodriver supports mouse interactions beyond simple clicks through its CDP-level controls.

**Hovering** over an element to trigger dropdown menus or tooltips:

```python
async def hover(page, element):
    """Move the mouse over an element to trigger hover effects."""
    await element.scroll_into_view()
    await element.mouse_move()


async def main():
    browser = await uc.start()
    page = await browser.get("https://example.com/navigation")

    # Hover over a menu to reveal dropdown items
    menu_item = await page.select("li.has-dropdown")
    if menu_item:
        await hover(page, menu_item)
        await page.sleep(0.5)  # Wait for dropdown animation

        # Now click the revealed submenu item
        submenu_link = await page.select("a.submenu-link")
        if submenu_link:
            await submenu_link.click()

    browser.stop()
```

**Double-clicking** to trigger edit modes or select text:

```python
async def double_click(page, element):
    """Perform a double-click on an element."""
    await element.scroll_into_view()
    await page.evaluate("(el) => { "
        "const event = new MouseEvent('dblclick', { bubbles: true, cancelable: true }); "
        "el.dispatchEvent(event); "
    "}", element)


async def main():
    browser = await uc.start()
    page = await browser.get("https://example.com/editor")

    # Double-click a cell to enter edit mode
    cell = await page.select("td.editable")
    if cell:
        await double_click(page, cell)
        await page.sleep(0.3)

        # Now type into the cell
        active_input = await page.select("td.editable input")
        if active_input:
            await active_input.send_keys("new value")

    browser.stop()
```

For right-click (context menu), you can dispatch a `contextmenu` event through JavaScript:

```python
async def right_click(page, element):
    """Perform a right-click to open context menu."""
    await page.evaluate("(el) => { "
        "const event = new MouseEvent('contextmenu', { bubbles: true, cancelable: true }); "
        "el.dispatchEvent(event); "
    "}", element)
```

## Common Issues and How to Fix Them

### Element Not Found

The most frequent problem. `page.select()` returns `None` and your script crashes on the next line.

**Causes and fixes:**

```python
# Problem: Element has not loaded yet
# Fix: Add retry logic with timeout
async def safe_select(page, selector, timeout=10):
    import time
    start = time.time()
    while time.time() - start < timeout:
        el = await page.select(selector)
        if el:
            return el
        await page.sleep(0.5)
    return None

# Problem: Element is inside an iframe
# Fix: Switch to the iframe first
iframe = await page.select("iframe#content-frame")
if iframe:
    iframe_page = await iframe.content_frame()
    button = await iframe_page.select("button.submit")

# Problem: Wrong selector
# Fix: Test your selector in Chrome DevTools first
# Open DevTools > Console > document.querySelector("your-selector")
```

### Element Not Clickable

The element exists in the DOM but clicking it does nothing or throws an error.

```python
# Problem: Element is hidden or has zero dimensions
# Fix: Check visibility before clicking
async def is_visible(page, element):
    result = await page.evaluate("""(el) => {
        const style = window.getComputedStyle(el);
        return style.display !== 'none'
            && style.visibility !== 'hidden'
            && style.opacity !== '0'
            && el.offsetWidth > 0
            && el.offsetHeight > 0;
    }""", element)
    return result

# Problem: Another element is covering the target
# Fix: Use JavaScript click to bypass the overlay
await page.evaluate("(el) => el.click()", element)

# Problem: Element is outside the viewport
# Fix: Scroll into view first
await element.scroll_into_view()
await page.sleep(0.3)
await element.click()
```

### Stale Element References

After a page navigation or DOM update, element references from before the change become invalid.

```python
# Problem: You stored an element reference, then the page changed
button = await page.select("button.next")
await button.click()  # This navigates to a new page

# This will fail because 'button' refers to the old page
# await button.click()  # Error: stale element

# Fix: Always re-select elements after navigation
page = await browser.get("https://example.com/page-2")
button = await page.select("button.next")  # Fresh reference
if button:
    await button.click()
```

```python
# Problem: A JavaScript framework re-renders the component
# The old element reference points to a DOM node that no longer exists

# Fix: Re-select right before interacting
async def resilient_click(page, selector, retries=3):
    for attempt in range(retries):
        try:
            element = await page.select(selector)
            if element:
                await element.click()
                return True
        except Exception:
            await page.sleep(0.5)
    return False
```

## Complete Example: Multi-Page Flow with Clicks and Form Fills

Here is a realistic example that ties everything together. The script navigates a multi-step signup form, filling in fields and clicking through pages:

```python
import nodriver as uc
import asyncio
import time


async def wait_for(page, selector, timeout=15):
    """Wait for an element to appear in the DOM."""
    start = time.time()
    while time.time() - start < timeout:
        element = await page.select(selector)
        if element:
            return element
        await page.sleep(0.5)
    raise TimeoutError(f"Element '{selector}' not found after {timeout}s")


async def clear_and_type(page, selector, text, timeout=10):
    """Find an input, clear it, and type new text."""
    element = await wait_for(page, selector, timeout)
    # Clear existing content
    await page.evaluate(
        "(el) => { el.value = ''; el.dispatchEvent(new Event('input', { bubbles: true })); }",
        element
    )
    await element.send_keys(text)
    return element


async def click_and_wait(page, selector, wait_selector=None, timeout=15):
    """Click an element and optionally wait for another element to appear."""
    element = await wait_for(page, selector, timeout)
    await element.scroll_into_view()
    await page.sleep(0.3)
    await element.click()

    if wait_selector:
        await wait_for(page, wait_selector, timeout)


async def main():
    browser = await uc.start()

    try:
        # Step 1: Navigate to the signup page
        page = await browser.get("https://example.com/signup")
        print("Loaded signup page")

        # Step 2: Fill in the first page of the form
        await clear_and_type(page, "input[name='first_name']", "Jane")
        await clear_and_type(page, "input[name='last_name']", "Smith")
        await clear_and_type(page, "input[name='email']", "jane@example.com")
        print("Filled in personal details")

        # Step 3: Select a dropdown option
        dropdown = await wait_for(page, "select[name='country']")
        await page.evaluate("""
            (el) => {
                el.value = 'US';
                el.dispatchEvent(new Event('change', { bubbles: true }));
            }
        """, dropdown)
        print("Selected country")

        # Step 4: Check a checkbox
        checkbox = await wait_for(page, "input[type='checkbox']#terms")
        is_checked = checkbox.attrs.get("checked")
        if not is_checked:
            await checkbox.click()
        print("Accepted terms")

        # Step 5: Click Next to go to step 2
        await click_and_wait(
            page,
            "button.next-step",
            wait_selector="input[name='password']"
        )
        print("Moved to step 2")

        # Step 6: Fill in password fields
        await clear_and_type(page, "input[name='password']", "Str0ngP@ssword!")
        await clear_and_type(page, "input[name='confirm_password']", "Str0ngP@ssword!")
        print("Filled in password")

        # Step 7: Handle a radio button group
        plan_option = await page.select("input[type='radio'][value='premium']")
        if plan_option:
            await plan_option.click()
        print("Selected premium plan")

        # Step 8: Click submit and wait for confirmation
        await click_and_wait(
            page,
            "button[type='submit']",
            wait_selector="div.confirmation-message"
        )
        print("Form submitted successfully")

        # Step 9: Extract confirmation details
        confirmation = await page.select("div.confirmation-message")
        if confirmation:
            print(f"Confirmation: {confirmation.text}")

        # Extract the confirmation number from a data attribute
        conf_number = await page.select("span.confirmation-number")
        if conf_number:
            print(f"Confirmation number: {conf_number.text}")

        # Step 10: Take a screenshot of the result
        await page.save_screenshot("signup_confirmation.png")
        print("Screenshot saved")

    except TimeoutError as e:
        print(f"Automation failed: {e}")
        await page.save_screenshot("error_state.png")

    finally:
        browser.stop()


if __name__ == "__main__":
    uc.loop().run_until_complete(main())
```

This example demonstrates the patterns that recur across every nodriver automation project. For a broader look at [automating web form filling](/posts/how-to-automate-web-form-filling-complete-guide/) across different tools, including multi-step flows and CAPTCHA handling, see our complete guide. Here are the key patterns:

- **Wait-then-act** --- Never interact with an element without first confirming it exists in the DOM.
- **Clear-then-type** --- Always clear input fields before typing to avoid appending to existing content.
- **Click-then-wait** --- After clicking something that triggers navigation or DOM changes, wait for the new content before proceeding.
- **Scroll-then-click** --- Bring elements into the viewport before clicking to avoid interaction failures.
- **Try-finally** --- Always stop the browser in a `finally` block so Chrome does not stay running if your script crashes. For more on [properly closing browsers in nodriver](/posts/closing-browsers-properly-nodriver-browser-close-stop/), see our cleanup guide.

## Quick Reference

Here is a summary of the key nodriver interaction methods:

| Action | Code |
|---|---|
| Find by selector | `await page.select("css-selector")` |
| Find by text | `await page.find("visible text")` |
| Find all matching | `await page.select_all("css-selector")` |
| Click | `await element.click()` |
| Type text | `await element.send_keys("text")` |
| Get attribute | `element.attrs.get("href", "")` |
| Get text | `element.text` |
| Scroll to element | `await element.scroll_into_view()` |
| JavaScript click | `await page.evaluate("(el) => el.click()", element)` |
| Hover | `await element.mouse_move()` |
| Run JavaScript | `await page.evaluate("JS code here")` |

Every interaction in nodriver follows the same rhythm: find the element, verify it exists, then act on it. There are no shortcuts that combine finding and acting into a single call, and that is by design. The explicit two-step approach makes scripts easier to debug because you always know exactly which step failed: the finding or the interacting.
