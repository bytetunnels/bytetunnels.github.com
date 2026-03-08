---
title: "Playwright select_option in Python: The Complete Signature Guide"
date: 2026-02-12 12:00:00 +0000
categories: ["Browser Automation"]
tags: ["playwright", "select_option", "python", "dropdowns", "forms", "tutorial"]
author: arman
image:
  path: /assets/img/2026-02-12-playwright-select-option-python-complete-signature-guide-hero.jpg
  alt: "Playwright select_option in Python: The Complete Signature Guide"
---

Dropdown menus built with `<select>` elements are everywhere -- registration forms, checkout flows, filter panels, admin dashboards. If you are coming from the Puppeteer side, the equivalent API is covered in [Puppeteer's select dropdown handling](/posts/puppeteer-select-dropdown-handling-select-elements/). Every time you automate a form or scrape data behind one, you need a reliable way to choose an option programmatically. Playwright's `select_option` method handles this in a single call, but its signature is more flexible than most developers realize. It supports selection by value, by visible label, by index, by a combination of those, and even by multiple values at once. This guide walks through the entire API surface with working Python examples so you never have to guess which parameter to reach for.

## Setting Up

If you have not installed Playwright yet, the setup takes two commands.

```bash
pip install playwright
playwright install chromium
```

Every example below uses the synchronous API. If you are working in an async codebase, swap `sync_playwright` for `async_playwright` and add the usual `async` / `await` keywords.

```python
from playwright.sync_api import sync_playwright

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    page = browser.new_page()
    page.goto("https://example.com/form")

    # selection examples go here

    browser.close()
```

## The HTML We Are Working With

Most of the examples target a standard `<select>` element like this one.

```html
<select id="country" name="country">
  <option value="">-- Choose a country --</option>
  <option value="us">United States</option>
  <option value="uk">United Kingdom</option>
  <option value="ca">Canada</option>
  <option value="de">Germany</option>
  <option value="jp">Japan</option>
</select>
```

And for the multi-select examples, imagine the same element with the `multiple` attribute.

```html
<select id="languages" name="languages" multiple>
  <option value="python">Python</option>
  <option value="javascript">JavaScript</option>
  <option value="rust">Rust</option>
  <option value="go">Go</option>
  <option value="java">Java</option>
</select>
```

## Basic Usage

The simplest call passes a CSS selector and a string value. Playwright matches that string against the `value` attribute of each `<option>`.

```python
page.select_option("select#country", "us")
```

That single line finds the `<select>` with `id="country"`, locates the `<option>` whose `value` attribute equals `"us"`, and selects it. If the option does not exist, Playwright raises an error.

## Selecting by Value

When you want to be explicit about matching the `value` attribute, use the `value` keyword argument. This is functionally identical to the basic usage above, but makes intent clearer when the code is read later.

```python
page.select_option("select#country", value="us")
```

You can also pass a list of values, which is useful for multi-select elements.

```python
page.select_option("select#languages", value=["python", "rust", "go"])
```

For a standard single-select dropdown, passing a list with one element works fine.

```python
page.select_option("select#country", value=["uk"])
```

## Selecting by Label

Sometimes you know the text the user sees but not the underlying `value` attribute. The `label` parameter matches against the visible text of each `<option>`.

```python
page.select_option("select#country", label="United States")
```

Label matching is exact. If the option text is `"United States"` and you pass `"united states"`, it will not match. When you are scraping and the label text comes from a variable, make sure the casing and whitespace line up.

```python
# Select multiple options by their visible text
page.select_option("select#languages", label=["Python", "JavaScript"])
```

## Selecting by Index

If the position of the option matters more than its value or label, use `index`. Indices are zero-based, so `index=0` selects the first `<option>` in the list.

```python
# Select the third option (index 2)
page.select_option("select#country", index=2)
```

In our example HTML, index `0` is the placeholder `"-- Choose a country --"`, index `1` is `"United States"`, and index `2` is `"United Kingdom"`.

You can pass a list of indices for multi-select elements.

```python
page.select_option("select#languages", index=[0, 2, 4])
```

## The Full Method Signature

Here is the complete signature for `page.select_option` in the synchronous Python API.

```python
page.select_option(
    selector,          # CSS or XPath selector for the <select> element
    value=None,        # option value(s) to match
    index=None,        # option index/indices to match
    label=None,        # option label(s) to match
    element=None,      # ElementHandle(s) to select
    force=False,       # bypass actionability checks
    timeout=None,      # max time in milliseconds to wait
)
```

The first positional argument is the selector. Everything after it is keyword-only (note the `*` in the actual source). You can combine `value`, `index`, and `label` in a single call if needed, though doing so is rare in practice.

The `element` parameter accepts one or more `ElementHandle` objects, letting you select options you have already located through other means. The `force` parameter skips Playwright's built-in actionability checks (visibility, enabled state). Use it sparingly -- if you need `force=True`, something is usually wrong with the page state or your selector.

## Using the Locator API

Playwright's newer locator-based API is generally preferred over raw selectors because it auto-waits and auto-retries. The `select_option` method is available on locators too.

```python
# Using page.locator()
page.locator("select#country").select_option("us")

# With keyword arguments
page.locator("select#country").select_option(label="Canada")

# Multiple selections
page.locator("select#languages").select_option(value=["python", "go"])
```

The locator version has the same parameters minus the `selector` argument, since the locator itself defines the target element.

```python
page.locator("select#country").select_option(
    value="de",
    timeout=5000,
    force=False,
)
```

You can also chain locators with other filtering methods before calling `select_option`.

```python
# Find the select inside a specific form
page.locator("form#registration").locator("select[name='country']").select_option("ca")
```

## Return Value

`select_option` returns a list of strings -- the `value` attributes of the options that ended up selected. This is true even when you select a single option.

```python
result = page.select_option("select#country", label="Germany")
print(result)  # ['de']
```

For multi-select elements, you get back all selected values.

```python
result = page.select_option("select#languages", value=["python", "rust"])
print(result)  # ['python', 'rust']
```

This return value is handy for assertions in test code or for confirming that the correct option was actually selected.

```python
selected = page.select_option("select#country", value="jp")
assert selected == ["jp"], f"Expected ['jp'], got {selected}"
```


<figure>
  <img src="/assets/img/inline-playwright-select-option-python-complete-1.jpg" alt="Browser automation turns repetitive tasks into reliable scripts." loading="lazy">
  <figcaption>Browser automation turns repetitive tasks into reliable scripts. <span class="img-credit">Photo by ThisIsEngineering / <a href="https://www.pexels.com" target="_blank" rel="noopener noreferrer">Pexels</a></span></figcaption>
</figure>

## Waiting for Options to Load Dynamically

Some forms populate dropdown options with an API call after the page loads, or after another field changes. If you call `select_option` before the target `<option>` exists in the DOM, Playwright will throw an error because there is nothing to match.

There are a few strategies for handling this.

### Wait for the Option Element

Use `wait_for_selector` to wait until the specific option appears.

```python
# Wait until the option with value "us" exists
page.wait_for_selector("select#country option[value='us']")
page.select_option("select#country", value="us")
```

### Wait for a Network Response

If options are loaded via an API call, wait for that response to complete.

```python
# Trigger the load (e.g., by selecting a region first)
page.select_option("select#region", value="north_america")

# Wait for the countries API to respond
page.wait_for_response("**/api/countries*")

# Now select the country
page.select_option("select#country", value="us")
```

### Use expect with a Timeout

When using the locator API, Playwright auto-waits for the element to be actionable, but it does not wait for a specific option to appear. You can increase the timeout to give dynamic content more time.

```python
page.locator("select#country").select_option(value="us", timeout=10000)
```

This will retry for up to 10 seconds. If the `<select>` element is present but the desired `<option>` is not, it will still fail. Combine this with an explicit wait for the option when the options themselves load asynchronously.

## Handling Custom Dropdowns (Non-Select Elements)

Many modern websites do not use native `<select>` elements at all. Instead, they build custom dropdowns from `<div>`, `<ul>`, and `<span>` elements styled to look like selects. Playwright's `select_option` only works on actual `<select>` elements. For custom dropdowns, you need a click-based approach.

```python
# Step 1: Click the dropdown trigger to open it
page.click("div.custom-dropdown-trigger")

# Step 2: Wait for the dropdown menu to appear
page.wait_for_selector("ul.dropdown-menu", state="visible")

# Step 3: Click the desired option
page.click("ul.dropdown-menu li:text('United States')")
```

Here is a more robust version using locators.

```python
# Open the dropdown
page.locator("div.custom-dropdown").click()

# Wait for options to be visible and click the target
page.locator("div.dropdown-options").get_by_text("United States").click()

# Verify the selection stuck
selected_text = page.locator("div.custom-dropdown .selected-value").inner_text()
assert selected_text == "United States"
```

The key difference is that you are performing two separate actions (open, then click) instead of one atomic `select_option` call. This means you need to handle timing between the click and the options appearing.

## Handling React and Vue Select Components

Frontend frameworks like React and Vue commonly use component libraries for dropdowns -- React Select, Ant Design Select, Vuetify v-select, and others. These components render as a tree of `<div>` elements with dynamic class names, making them trickier to automate.

### React Select Example

React Select is one of the most popular dropdown libraries. Here is how to automate it.

```python
# Click the control area to open the dropdown
page.locator("div.react-select__control").click()

# Type into the search input to filter options
page.locator("div.react-select__input input").fill("United")

# Wait for filtered results and click the match
page.locator("div.react-select__option:text('United States')").click()
```

### Ant Design Select Example

Ant Design selects work similarly but use different class names.

```python
# Open the dropdown
page.locator("div.ant-select-selector").click()

# Wait for the dropdown panel
page.wait_for_selector("div.ant-select-dropdown", state="visible")

# Click the option
page.locator("div.ant-select-item-option[title='United States']").click()
```

### General Strategy for Unknown Components

When you encounter a custom dropdown you have not seen before, the debugging process is always the same.

```python
# 1. Open DevTools and inspect the dropdown
# 2. Click the dropdown manually and watch what elements appear
# 3. Note the selectors for:
#    - The trigger element (what you click to open)
#    - The options container (the menu that appears)
#    - Individual option items

# Then automate with:
page.locator("<trigger-selector>").click()
page.locator("<options-container>").wait_for(state="visible")
page.locator("<option-item-selector>").click()
```

## Common Errors and How to Fix Them

### Error: Element Is Not a Select

```
Error: Element is not a <select> element
```

This means your selector matched an element, but it is not a native `<select>`. You are probably dealing with a custom dropdown. Switch to the click-based approach described above.

```python
# This will fail on a custom dropdown
# page.select_option("div.fake-select", value="us")  # Error!

# Use clicks instead
page.locator("div.fake-select").click()
page.locator("div.fake-select-options li:text('United States')").click()
```

### Error: Option Not Found

```
Error: No option with value "xyz" in <select> element
```

The option you requested does not exist. This usually means one of three things.

1. The value is wrong. Inspect the HTML and check the exact `value` attribute.
2. The options have not loaded yet. Add a wait before calling `select_option`.
3. You are matching by `value` when you meant to match by `label`, or vice versa.

```python
# Debug: print all available options
options = page.eval_on_selector_all(
    "select#country option",
    "options => options.map(o => ({value: o.value, text: o.textContent}))"
)
print(options)
# [{'value': '', 'text': '-- Choose a country --'},
#  {'value': 'us', 'text': 'United States'}, ...]
```

### Error: Strict Mode Violation

```
Error: strict mode violation: selector resolved to 3 elements
```

Your selector matches more than one `<select>` element. Make it more specific.

```python
# Too broad -- matches every select on the page
# page.locator("select").select_option("us")

# Be specific
page.locator("select#country").select_option("us")

# Or use nth() if you truly want the first one
page.locator("select").nth(0).select_option("us")
```

### Timeout Error

```
TimeoutError: Timeout 30000ms exceeded
```

The `<select>` element was not found or was not actionable within the timeout period. Check that your selector is correct and that the element is visible on the page.

```python
# Increase timeout if the page is slow
page.select_option("select#country", value="us", timeout=60000)

# Or check if the element exists first
if page.locator("select#country").count() > 0:
    page.select_option("select#country", value="us")
else:
    print("Country dropdown not found on this page")
```

## Deselecting All Options

For multi-select elements, you can deselect everything by passing an empty list.

```python
# Clear all selections
page.select_option("select#languages", value=[])

result = page.select_option("select#languages", value=[])
print(result)  # []
```

This is useful when you want to reset a multi-select before making new selections.

## Reading the Current Selection

`select_option` is for setting values. To read the currently selected option without changing it, use `evaluate`.

```python
# Get the current value
current_value = page.eval_on_selector("select#country", "el => el.value")
print(current_value)  # 'us'

# Get the current label text
current_label = page.eval_on_selector(
    "select#country",
    "el => el.options[el.selectedIndex].textContent"
)
print(current_label)  # 'United States'

# Get all selected values in a multi-select
selected_values = page.eval_on_selector(
    "select#languages",
    "el => Array.from(el.selectedOptions).map(o => o.value)"
)
print(selected_values)  # ['python', 'rust']
```

## Complete Form Example

Here is a full example that fills out a registration form using `select_option` alongside other Playwright form methods. For a comprehensive walkthrough of [automating web form filling](/posts/how-to-automate-web-form-filling-complete-guide/) beyond just dropdowns, see our dedicated guide.

```python
from playwright.sync_api import sync_playwright

def fill_registration_form():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=False)
        page = browser.new_page()
        page.goto("https://example.com/register")

        # Text inputs
        page.fill("input#first-name", "Jane")
        page.fill("input#last-name", "Doe")
        page.fill("input#email", "jane.doe@example.com")
        page.fill("input#password", "S3cure_P@ssw0rd!")

        # Standard dropdown -- select by value
        page.select_option("select#country", value="us")

        # Standard dropdown -- select by label
        page.select_option("select#state", label="California")

        # Multi-select -- pick multiple values
        page.select_option("select#interests", value=["tech", "science", "travel"])

        # Dropdown whose options load after country is selected
        page.wait_for_selector("select#city option[value='los_angeles']")
        page.select_option("select#city", value="los_angeles")

        # Checkbox
        page.check("input#terms-agree")

        # Radio button
        page.click("input[name='newsletter'][value='weekly']")

        # Submit the form
        page.click("button[type='submit']")

        # Wait for confirmation
        page.wait_for_selector("div.success-message", state="visible")
        confirmation = page.locator("div.success-message").inner_text()
        print(f"Registration result: {confirmation}")

        # Verify the country selection persisted (useful for debugging)
        selected_country = page.eval_on_selector(
            "select#country", "el => el.value"
        )
        print(f"Country value after submit: {selected_country}")

        browser.close()

if __name__ == "__main__":
    fill_registration_form()
```

## Quick Reference Table

Here is a summary of every way to call `select_option`.

```text
Method                                              What It Matches
--------------------------------------------------  -------------------------
select_option(sel, "us")                            value attribute (positional)
select_option(sel, value="us")                      value attribute (explicit)
select_option(sel, label="United States")            visible option text
select_option(sel, index=2)                          zero-based position
select_option(sel, value=["us", "uk"])              multiple values
select_option(sel, label=["US", "UK"])              multiple labels
select_option(sel, index=[0, 2])                    multiple indices
select_option(sel, value=[])                         deselect all
locator.select_option(value="us")                   locator-based selection
locator.select_option(label="US", timeout=5000)     with custom timeout
```

## Wrapping Up

Playwright's `select_option` covers every scenario you will encounter with native `<select>` elements -- single value, multiple values, matching by value attribute, visible label, or position index. The locator-based variant adds auto-waiting and retry logic. For custom dropdowns built from `<div>` trees, you fall back to the click-open-then-click-option pattern, which works regardless of the underlying framework. Keep the full signature in mind when debugging edge cases, and remember that the method always returns a list of the values it selected -- a small detail that makes assertions and logging straightforward. If you want to speed up your selector discovery workflow, the [Playwright CLI](/posts/using-playwright-cli-quick-browser-testing/) can record interactions and generate working code with `codegen`.
