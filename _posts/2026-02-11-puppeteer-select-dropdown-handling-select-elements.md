---
title: "Puppeteer Select Dropdown: Handling select Elements Programmatically"
date: 2026-02-11 12:00:00 +0000
categories: ["Browser Automation"]
tags: ["puppeteer", "dropdown", "select", "forms", "javascript", "tutorial"]
author: arman
image:
  path: /assets/img/2026-02-11-puppeteer-select-dropdown-handling-select-elements-hero.png
  alt: "Puppeteer Select Dropdown: Handling select Elements Programmatically"
---

Dropdown `<select>` elements appear on nearly every web form -- country pickers, currency selectors, shipping methods, language preferences. When you automate these forms with Puppeteer, you need a reliable way to choose options programmatically. Puppeteer ships with `page.select()` for exactly this purpose, but real-world dropdowns are rarely that simple. Some load their options dynamically, some are built entirely from `<div>` elements styled to look like selects, and some are wrapped in React or Material UI components that never render a native `<select>` tag at all.

If you work with Playwright instead, the equivalent API is covered in the [Playwright select_option guide](/posts/playwright-select-option-python-complete-signature-guide/). This guide covers every scenario you will encounter when handling dropdowns in Puppeteer, from the one-liner basics to the workarounds needed for custom component libraries.

## Basic Usage with page.select()

The `page.select()` method is the fastest way to choose an option from a native `<select>` element. You pass the selector for the `<select>` tag and the `value` attribute of the option you want.

```javascript
const puppeteer = require('puppeteer');

(async () => {
  const browser = await puppeteer.launch();
  const page = await browser.newPage();
  await page.goto('https://example.com/form');

  // Select the option whose value attribute is 'us'
  await page.select('select#country', 'us');

  await browser.close();
})();
```

The method returns an array of the values that were successfully selected. If the value you pass does not match any `<option>` in the dropdown, Puppeteer throws an error.

Consider this HTML:

```html
<select id="country" name="country">
  <option value="">-- Choose a country --</option>
  <option value="us">United States</option>
  <option value="uk">United Kingdom</option>
  <option value="ca">Canada</option>
  <option value="de">Germany</option>
</select>
```

Calling `page.select('select#country', 'de')` sets the dropdown to "Germany" and dispatches the `change` event automatically, which is important because many forms listen for that event to trigger dependent behavior like populating a state or province field.

## Selecting Multiple Options

Some dropdowns allow multiple selections via the `multiple` attribute. With `page.select()`, you simply pass additional value arguments.

```html
<select id="languages" name="languages" multiple>
  <option value="en">English</option>
  <option value="fr">French</option>
  <option value="es">Spanish</option>
  <option value="de">German</option>
  <option value="ja">Japanese</option>
</select>
```

```javascript
// Select English, French, and Japanese
const selected = await page.select('select#languages', 'en', 'fr', 'ja');
console.log(selected); // ['en', 'fr', 'ja']
```

Each call to `page.select()` replaces the previous selection entirely. If you previously selected "English" and then call `page.select()` with only "French", English will be deselected.

```javascript
// This replaces any prior selections -- only 'fr' will be selected
await page.select('select#languages', 'fr');
```

If you need to add to an existing selection without clearing it, you will need to read the current values first, merge them with the new ones, and pass all of them together.

```javascript
// Read existing selected values
const currentValues = await page.$eval('select#languages', sel =>
  Array.from(sel.selectedOptions).map(opt => opt.value)
);

// Merge with new values and select all
const merged = [...new Set([...currentValues, 'de'])];
await page.select('select#languages', ...merged);
```

## Selecting by Visible Text Instead of Value

`page.select()` works with the `value` attribute, but sometimes you only know the visible label -- "United States" rather than "us". You need to look up the value first, then pass it to `page.select()`.

```javascript
// Find the value for the option with visible text "United States"
const value = await page.$eval('select#country', (sel, text) => {
  const option = Array.from(sel.options).find(o => o.textContent.trim() === text);
  if (!option) throw new Error(`Option with text "${text}" not found`);
  return option.value;
}, 'United States');

// Now select by value
await page.select('select#country', value);
```

You can wrap this into a reusable helper function to keep your automation scripts clean.

```javascript
async function selectByText(page, selector, text) {
  const value = await page.$eval(selector, (sel, label) => {
    const option = Array.from(sel.options).find(
      o => o.textContent.trim() === label
    );
    if (!option) {
      throw new Error(`No option with text "${label}" in ${sel.id || sel.name}`);
    }
    return option.value;
  }, text);

  return page.select(selector, value);
}

// Usage
await selectByText(page, 'select#country', 'Canada');
```

This approach also handles cases where the value attribute is an opaque ID or numeric code that you would not want to hard-code in your scripts.

## Getting All Options from a Dropdown

Before selecting anything, you might need to inspect what options are available. Use `page.$$eval()` to extract every option from a dropdown as structured data.

```javascript
const options = await page.$$eval('select#country option', opts =>
  opts.map(o => ({
    value: o.value,
    text: o.textContent.trim(),
    selected: o.selected,
    disabled: o.disabled
  }))
);

console.log(options);
// [
//   { value: '', text: '-- Choose a country --', selected: true, disabled: false },
//   { value: 'us', text: 'United States', selected: false, disabled: false },
//   { value: 'uk', text: 'United Kingdom', selected: false, disabled: false },
//   { value: 'ca', text: 'Canada', selected: false, disabled: false },
//   { value: 'de', text: 'Germany', selected: false, disabled: false }
// ]
```

This is especially useful when you are scraping a form to discover valid values, or when you need to iterate through all options and submit the form once for each.

```javascript
// Submit the form once for every country option
for (const opt of options) {
  if (!opt.value) continue; // Skip the placeholder

  await page.select('select#country', opt.value);
  await page.click('button[type="submit"]');
  await page.waitForNavigation();

  // Process the result page...

  await page.goBack();
  await page.waitForSelector('select#country');
}
```


<figure>
  <img src="/assets/img/inline-puppeteer-select-dropdown-handling-selec-1.jpg" alt="Headless browsers opened a new chapter in web automation." loading="lazy">
  <figcaption>Headless browsers opened a new chapter in web automation. <span class="img-credit">Photo by Bibek ghosh / <a href="https://www.pexels.com" target="_blank" rel="noopener noreferrer">Pexels</a></span></figcaption>
</figure>

## Getting the Currently Selected Option

To read which option is currently selected, query the `selectedOptions` collection on the `<select>` element.

```javascript
// Get the currently selected value
const currentValue = await page.$eval('select#country', sel => sel.value);
console.log(currentValue); // 'us'

// Get both the value and the visible text
const current = await page.$eval('select#country', sel => ({
  value: sel.value,
  text: sel.selectedOptions[0]?.textContent.trim() || ''
}));
console.log(current); // { value: 'us', text: 'United States' }
```

For multi-select dropdowns, use `selectedOptions` to get all selected items.

```javascript
const selectedItems = await page.$eval('select#languages', sel =>
  Array.from(sel.selectedOptions).map(o => ({
    value: o.value,
    text: o.textContent.trim()
  }))
);
console.log(selectedItems);
// [{ value: 'en', text: 'English' }, { value: 'fr', text: 'French' }]
```

## Handling Custom Dropdowns (Non-select Elements)

Many modern websites do not use native `<select>` elements at all. Instead, they build dropdowns from `<div>`, `<ul>`, and `<li>` elements styled with CSS. These custom dropdowns require a different approach: click to open, then click the desired option.

A typical custom dropdown might look like this in the DOM:

```html
<div class="custom-dropdown">
  <div class="dropdown-trigger" role="combobox">Select a country</div>
  <ul class="dropdown-menu" style="display: none;">
    <li data-value="us">United States</li>
    <li data-value="uk">United Kingdom</li>
    <li data-value="ca">Canada</li>
  </ul>
</div>
```

The automation pattern is straightforward: click the trigger, wait for the menu to appear, then click the option.

```javascript
// Click the dropdown trigger to open the menu
await page.click('.custom-dropdown .dropdown-trigger');

// Wait for the menu to become visible
await page.waitForSelector('.custom-dropdown .dropdown-menu', {
  visible: true
});

// Click the option by its data-value attribute
await page.click('.dropdown-menu li[data-value="ca"]');
```

If you need to select by visible text, use XPath or filter with `page.$$eval()`.

```javascript
// Open the dropdown
await page.click('.custom-dropdown .dropdown-trigger');
await page.waitForSelector('.dropdown-menu', { visible: true });

// Find and click the option by its text content
const optionElements = await page.$$('.dropdown-menu li');
for (const el of optionElements) {
  const text = await el.evaluate(node => node.textContent.trim());
  if (text === 'United Kingdom') {
    await el.click();
    break;
  }
}
```

## Handling React and Material UI Dropdowns

React component libraries like Material UI (MUI), Ant Design, and Chakra UI render their own dropdown implementations. These typically involve a trigger button, a portal-rendered menu (often appended to `<body>` rather than nested inside the component), and ARIA attributes for accessibility.

A Material UI Select component renders something like this when opened:

```html
<!-- The trigger -->
<div class="MuiSelect-root" role="combobox" aria-expanded="true">
  <div class="MuiSelect-select">United States</div>
</div>

<!-- The menu (rendered in a portal at the document root) -->
<div class="MuiPopover-root">
  <ul class="MuiMenu-list" role="listbox">
    <li class="MuiMenuItem-root" data-value="us">United States</li>
    <li class="MuiMenuItem-root" data-value="uk">United Kingdom</li>
    <li class="MuiMenuItem-root" data-value="ca">Canada</li>
  </ul>
</div>
```

The key challenge is that the menu is detached from the trigger element in the DOM. Here is the pattern:

```javascript
// Click the MUI select trigger to open the menu
await page.click('.MuiSelect-root');

// Wait for the popover menu to appear
await page.waitForSelector('.MuiMenu-list', { visible: true });

// Click the desired option
await page.click('.MuiMenuItem-root[data-value="uk"]');

// Wait for the popover to close
await page.waitForSelector('.MuiMenu-list', { hidden: true });
```

For selecting by text in MUI:

```javascript
await page.click('.MuiSelect-root');
await page.waitForSelector('.MuiMenu-list', { visible: true });

// Use XPath to find the menu item by text
const [option] = await page.$$('xpath///li[contains(@class, "MuiMenuItem-root") and normalize-space(text())="Canada"]');

if (option) {
  await option.click();
} else {
  throw new Error('Option "Canada" not found in MUI select');
}
```

Ant Design selects follow a similar pattern but use different class names. The trigger typically has a class like `.ant-select-selector`, and the dropdown panel appears as `.ant-select-dropdown`.

```javascript
// Ant Design select
await page.click('.ant-select-selector');
await page.waitForSelector('.ant-select-dropdown', { visible: true });
await page.click('.ant-select-item[title="Canada"]');
```


<figure>
  <img src="/assets/img/inline-puppeteer-select-dropdown-handling-selec-2.jpg" alt="Node.js gave browser automation a native home in JavaScript." loading="lazy">
  <figcaption>Node.js gave browser automation a native home in JavaScript. <span class="img-credit">Photo by Daniil Komov / <a href="https://www.pexels.com" target="_blank" rel="noopener noreferrer">Pexels</a></span></figcaption>
</figure>

## Waiting for Dropdown Options to Load Dynamically

Some dropdowns populate their options asynchronously -- for example, a city dropdown that loads options after you select a country, or a search-as-you-type combobox that fetches results from an API.

### Waiting for Options to Appear

```javascript
// Select a country first
await page.select('select#country', 'us');

// Wait for the city dropdown to be populated
await page.waitForFunction(() => {
  const citySelect = document.querySelector('select#city');
  // Wait until there is more than one option (beyond the placeholder)
  return citySelect && citySelect.options.length > 1;
});

// Now the city dropdown is ready
await page.select('select#city', 'new-york');
```

### Waiting for a Specific Option to Exist

```javascript
// Wait for a particular option value to appear
await page.waitForSelector('select#city option[value="new-york"]');
await page.select('select#city', 'new-york');
```

### Handling Search-as-you-type Dropdowns

Some dropdowns require you to type a search query before options appear. These are common in address forms, user pickers, and tag selectors.

```javascript
// Click the search input inside the dropdown
await page.click('.searchable-select input');

// Type a search query
await page.type('.searchable-select input', 'new yor', { delay: 100 });

// Wait for the filtered results to appear
await page.waitForSelector('.searchable-select .option-list li', {
  visible: true
});

// Click the matching option
await page.click('.searchable-select .option-list li:first-child');
```

The `delay` option in `page.type()` adds a pause between keystrokes, which is important when the dropdown debounces input before making API calls.

## Common Errors and How to Fix Them

### Element Not Found

```
Error: No element found for selector: select#country
```

The `<select>` element does not exist in the DOM when your script runs. This usually means the page has not finished loading, or the element has a different selector than you expect.

```javascript
// Fix: wait for the element before interacting with it
await page.waitForSelector('select#country');
await page.select('select#country', 'us');
```

### Option Value Does Not Exist

```
Error: No option with value "usa" found for select#country
```

The value you passed to `page.select()` does not match any `<option>` in the dropdown. Values are case-sensitive and must match exactly.

```javascript
// Debug: print all available values
const values = await page.$$eval('select#country option', opts =>
  opts.map(o => o.value)
);
console.log('Available values:', values);
// Available values: ['', 'us', 'uk', 'ca', 'de']
// 'usa' is not in the list -- use 'us' instead
```

### Select Is Disabled

Puppeteer will not throw an error when selecting from a disabled dropdown, but the browser will ignore the selection. Check for the `disabled` attribute before attempting to select.

```javascript
const isDisabled = await page.$eval('select#city', sel => sel.disabled);
if (isDisabled) {
  console.log('City dropdown is disabled -- select a country first');
  await page.select('select#country', 'us');
  await page.waitForFunction(
    () => !document.querySelector('select#city').disabled
  );
}
await page.select('select#city', 'new-york');
```

### Hidden Select Behind a Custom Wrapper

Some sites keep a hidden native `<select>` behind a custom dropdown for form submission. In this case, you might be able to use `page.select()` on the hidden element and skip the UI interaction entirely.

```javascript
// Check if there is a hidden native select
const hasHiddenSelect = await page.$('select#country[style*="display: none"]');
if (hasHiddenSelect) {
  // Directly set the value -- this bypasses the UI but works for form submission
  await page.evaluate(() => {
    const sel = document.querySelector('select#country');
    sel.value = 'ca';
    sel.dispatchEvent(new Event('change', { bubbles: true }));
  });
}
```

## Complete Example: Filling a Form with Multiple Dropdowns

For a broader look at [automating web form filling](/posts/how-to-automate-web-form-filling-complete-guide/) across tools and techniques, see our dedicated guide. Here is a full script that fills out a registration form containing several dropdown types: a native select, a dynamically populated dependent select, and a custom React-style dropdown.

```javascript
const puppeteer = require('puppeteer');

async function selectByText(page, selector, text) {
  const value = await page.$eval(selector, (sel, label) => {
    const option = Array.from(sel.options).find(
      o => o.textContent.trim() === label
    );
    if (!option) {
      throw new Error(`No option with text "${label}" in ${sel.id || sel.name}`);
    }
    return option.value;
  }, text);
  return page.select(selector, value);
}

async function selectCustomDropdown(page, triggerSelector, optionText) {
  await page.click(triggerSelector);

  const menuSelector = `${triggerSelector} + .dropdown-menu, .dropdown-menu`;
  await page.waitForSelector(menuSelector, { visible: true });

  const options = await page.$$(`.dropdown-menu li, .dropdown-menu [role="option"]`);
  for (const opt of options) {
    const text = await opt.evaluate(node => node.textContent.trim());
    if (text === optionText) {
      await opt.click();
      return;
    }
  }
  throw new Error(`Option "${optionText}" not found in custom dropdown`);
}

(async () => {
  const browser = await puppeteer.launch({ headless: false });
  const page = await browser.newPage();
  await page.goto('https://example.com/register', {
    waitUntil: 'networkidle2'
  });

  // --- Fill text fields ---
  await page.type('input#name', 'Jane Doe');
  await page.type('input#email', 'jane@example.com');

  // --- Native select: choose a country ---
  await page.waitForSelector('select#country');
  await selectByText(page, 'select#country', 'Canada');

  // --- Dependent select: choose a province (loads after country selection) ---
  await page.waitForFunction(() => {
    const sel = document.querySelector('select#province');
    return sel && sel.options.length > 1;
  }, { timeout: 5000 });
  await page.select('select#province', 'on'); // Ontario

  // --- Multi-select: choose preferred languages ---
  await page.select('select#languages', 'en', 'fr');

  // --- Custom dropdown: choose a plan tier ---
  await selectCustomDropdown(page, '.plan-selector .dropdown-trigger', 'Professional');

  // --- Verify selections before submitting ---
  const country = await page.$eval('select#country', sel => sel.value);
  const province = await page.$eval('select#province', sel => sel.value);
  const languages = await page.$eval('select#languages', sel =>
    Array.from(sel.selectedOptions).map(o => o.value)
  );

  console.log('Country:', country);     // 'ca'
  console.log('Province:', province);   // 'on'
  console.log('Languages:', languages); // ['en', 'fr']

  // --- Submit the form ---
  await page.click('button[type="submit"]');
  await page.waitForNavigation({ waitUntil: 'networkidle2' });

  const confirmationText = await page.$eval('.confirmation', el => el.textContent);
  console.log('Result:', confirmationText);

  await browser.close();
})();
```

This script demonstrates the three patterns you will use most often:

1. **Native selects** -- use `page.select()` directly with values, or the `selectByText` helper when you only know the label.
2. **Dependent selects** -- select the parent dropdown first, then wait for the child dropdown to populate before selecting from it.
3. **Custom dropdowns** -- click the trigger, wait for the menu, and click the option by its text content.

## Quick Reference

Here is a summary of the methods covered in this guide and when to reach for each one.

| Task | Method | Notes |
|------|--------|-------|
| Select by value | `page.select(selector, value)` | Native `<select>` only |
| Select multiple values | `page.select(selector, v1, v2, v3)` | Requires `multiple` attribute |
| Select by visible text | `selectByText()` helper | Look up value first, then call `page.select()` |
| Get all options | `page.$$eval(selector, ...)` | Returns structured data from every `<option>` |
| Get current selection | `page.$eval(selector, sel => sel.value)` | Single value from `sel.value` |
| Custom dropdown | `page.click()` then `page.click()` | Click trigger, wait, click option |
| Wait for dynamic options | `page.waitForFunction()` | Poll until options count changes |
| Debug available values | `page.$$eval(selector, opts => opts.map(o => o.value))` | Print all valid values |

The native `page.select()` method handles the majority of real-world dropdown interactions. When you encounter a site that builds its own dropdown components, fall back to the click-wait-click pattern. Between these two approaches, you can automate any dropdown you will find in the wild. If you are weighing Puppeteer against Selenium for your automation stack, the [Selenium vs Puppeteer comparison](/posts/selenium-vs-puppeteer-definitive-comparison-web-scraping/) breaks down the trade-offs in detail.
