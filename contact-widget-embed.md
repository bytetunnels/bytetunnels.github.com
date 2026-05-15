# Contact Widget — Embed

Drop-in JS widget for the ByteTunnels contact form. Loads the form (with image, social links, and a "Book a 30-min call" button) and posts to `https://form.bytetunnels.com/contact`. The Calendly link opens in a new tab.

## Usage

Add the script tag wherever you want the widget to appear:

```html
<script src="https://bytetunnels.com/assets/js/contact-widget-embed.js" async></script>
```

Or place an explicit container if you want to control where it mounts:

```html
<div id="bt-contact-widget"></div>
<script src="https://bytetunnels.com/assets/js/contact-widget-embed.js" async></script>
```

That's it. The widget injects its own CSS (scoped under `.bt-embed__*`) and HTML on `DOMContentLoaded`.

## Notes

- All styles are scoped to `.bt-embed__*` to avoid clashing with the host page.
- If the embedding site has a strict CSP, whitelist `bytetunnels.com` (image + script) and `form.bytetunnels.com` (form POST).
- The widget is responsive — stacks vertically under 640px viewport width.
