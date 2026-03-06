---
title: "Using Proxies with Selenium in Node.js"
date: 2026-02-27 12:00:00 +0000
categories: ["Browser Automation"]
tags: ["selenium", "proxy", "nodejs", "javascript", "web scraping", "ip rotation"]
mermaid: true
author: arman
image:
  path: /assets/img/2026-02-27-using-proxies-selenium-nodejs-hero.png
  alt: "Using Proxies with Selenium in Node.js"
---

Proxies are essential for scraping at scale. Without them, your IP address becomes a single point of failure -- one rate limit or ban and your entire operation stops. [Selenium](/posts/getting-started-with-selenium-first-automated-browser/) in Node.js gives you several ways to route traffic through proxies, from a simple command-line flag to more advanced setups involving Chrome extensions and proxy managers. This guide covers every method, including the tricky problem of authenticated proxies that Chrome does not handle natively through launch arguments.

## Why Use Proxies with Selenium

Before diving into code, it helps to understand the three main reasons proxies matter for browser automation and web scraping.

**Avoiding IP bans.** Websites track request volume per IP address. When a single IP sends hundreds or thousands of requests in a short window, the site blocks it. Proper [rate limiting and user-agent rotation](/posts/how-to-configure-rate-limiting-user-agent-rotation-responsibly/) can help reduce the risk even before you add proxies. Proxies let you spread that traffic across many addresses so no single one triggers a threshold.

**Geo-targeting.** Some websites serve different content based on the visitor's location. A proxy in Germany lets you see the German version of a site. A proxy in Japan shows you the Japanese storefront. Without proxies, you are limited to whatever your server's physical location reveals.

**Rate limit distribution.** Even when a site does not outright ban you, it may throttle responses after a certain number of requests per minute per IP. Distributing requests across a pool of proxies keeps each individual address well under the limit, maintaining fast response times across the board.

```mermaid
flowchart TD
    A["Selenium Script"] --> B{"Proxy Layer"}
    B --> C["Proxy 1<br>US East"]
    B --> D["Proxy 2<br>EU West"]
    B --> E["Proxy 3<br>Asia Pacific"]
    C --> F["Target Website"]
    D --> F
    E --> F
    style B fill:#ffdddd
    style F fill:#ddffdd
```

## Basic Proxy Setup with Chrome Options

The simplest way to route Selenium traffic through a proxy is the `--proxy-server` Chrome argument. This works for proxies that do not require authentication.

```javascript
const { Builder } = require('selenium-webdriver');
const chrome = require('selenium-webdriver/chrome');

async function runWithProxy() {
  const options = new chrome.Options();
  options.addArguments('--proxy-server=http://103.21.160.54:8080');

  const driver = await new Builder()
    .forBrowser('chrome')
    .setChromeOptions(options)
    .build();

  try {
    await driver.get('https://httpbin.org/ip');
    const body = await driver.findElement({ css: 'pre' });
    const text = await body.getText();
    console.log('Visible IP:', text);
  } finally {
    await driver.quit();
  }
}

runWithProxy();
```

The `--proxy-server` flag accepts several formats:

| Format | Example | Protocol |
|--------|---------|----------|
| `http://host:port` | `http://103.21.160.54:8080` | HTTP/HTTPS |
| `host:port` | `103.21.160.54:8080` | HTTP (default) |
| `socks5://host:port` | `socks5://103.21.160.54:1080` | SOCKS5 |

Chrome applies this proxy to all traffic the browser generates, including requests for images, stylesheets, scripts, and XHR calls. There is no need to configure it per-request.

## The Authenticated Proxy Problem

Most commercial proxy services require a username and password. This is where things get awkward. Chrome's `--proxy-server` argument does not accept credentials. You cannot pass `http://user:pass@proxy:port` and expect it to work -- Chrome will silently ignore the credentials and fail to authenticate.

There are three ways to solve this:

1. **Chrome extension** -- inject a small extension that handles proxy auth automatically
2. **Chrome DevTools Protocol (CDP)** -- intercept the auth challenge at the network level
3. **Local proxy forwarder** -- run a local proxy that adds credentials before forwarding

The extension method is the most widely used and reliable approach.

## Setting Up Proxy Auth with a Chrome Extension

You can create a lightweight Chrome extension on the fly that tells Chrome how to authenticate with your proxy. The extension consists of two files packed into a ZIP archive: a manifest and a background script.

```javascript
const { Builder } = require('selenium-webdriver');
const chrome = require('selenium-webdriver/chrome');
const fs = require('fs');
const path = require('path');
const archiver = require('archiver');

function createProxyAuthExtension({ host, port, username, password }) {
  const dir = path.join(__dirname, 'proxy_auth_extension');
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  const manifest = {
    version: '1.0.0',
    manifest_version: 2,
    name: 'Proxy Auth',
    permissions: ['proxy', 'tabs', 'unlimitedStorage', 'storage',
                  '<all_urls>', 'webRequest', 'webRequestBlocking'],
    background: {
      scripts: ['background.js']
    }
  };

  const background = `
    var config = {
      mode: "fixed_servers",
      rules: {
        singleProxy: {
          scheme: "http",
          host: "${host}",
          port: parseInt(${port})
        },
        bypassList: ["localhost"]
      }
    };

    chrome.proxy.settings.set(
      { value: config, scope: "regular" },
      function() {}
    );

    chrome.webRequest.onAuthRequired.addListener(
      function(details) {
        return {
          authCredentials: {
            username: "${username}",
            password: "${password}"
          }
        };
      },
      { urls: ["<all_urls>"] },
      ["blocking"]
    );
  `;

  fs.writeFileSync(path.join(dir, 'manifest.json'), JSON.stringify(manifest, null, 2));
  fs.writeFileSync(path.join(dir, 'background.js'), background);

  return dir;
}

async function runWithAuthProxy() {
  const extensionPath = createProxyAuthExtension({
    host: 'proxy.example.com',
    port: 8080,
    username: 'myuser',
    password: 'mypassword'
  });

  const options = new chrome.Options();
  options.addArguments(`--load-extension=${extensionPath}`);

  // Extensions do not work in headless mode by default.
  // Use the new headless mode if you need it:
  // options.addArguments('--headless=new');

  const driver = await new Builder()
    .forBrowser('chrome')
    .setChromeOptions(options)
    .build();

  try {
    await driver.get('https://httpbin.org/ip');
    const body = await driver.findElement({ css: 'pre' });
    console.log('Proxy IP:', await body.getText());
  } finally {
    await driver.quit();
  }
}

runWithAuthProxy();
```

A few things to note about this approach:

- **Manifest V2 is required.** The `webRequestBlocking` permission that makes synchronous auth interception work is not available in Manifest V3. Chrome still loads MV2 extensions locally.
- **Headless mode limitations.** Classic headless mode (`--headless`) does not support extensions. Use `--headless=new` (available in Chrome 112+) if you need headless with extensions.
- **Clean up after yourself.** The extension directory persists on disk. In production, generate it once and reuse it, or clean it up when the script exits.


<figure>
  <img src="/assets/img/inline-using-proxies-selenium-nodejs-1.jpg" alt="Selenium pioneered browser automation and remains widely used today." loading="lazy">
  <figcaption>Selenium pioneered browser automation and remains widely used today. <span class="img-credit">Photo by ThisIsEngineering / <a href="https://www.pexels.com" target="_blank" rel="noopener noreferrer">Pexels</a></span></figcaption>
</figure>

## Using selenium-webdriver Proxy Capability

Selenium's built-in `Proxy` class provides another way to configure proxy settings through capabilities rather than Chrome-specific arguments. This approach is more portable across browsers.

```javascript
const { Builder, Proxy } = require('selenium-webdriver');
const chrome = require('selenium-webdriver/chrome');

async function runWithCapabilityProxy() {
  const proxy = {
    proxyType: 'manual',
    httpProxy: '103.21.160.54:8080',
    sslProxy: '103.21.160.54:8080',
    noProxy: 'localhost,127.0.0.1'
  };

  const driver = await new Builder()
    .forBrowser('chrome')
    .setProxy(proxy)
    .build();

  try {
    await driver.get('https://httpbin.org/ip');
    const body = await driver.findElement({ css: 'pre' });
    console.log('Proxy IP:', await body.getText());
  } finally {
    await driver.quit();
  }
}

runWithCapabilityProxy();
```

The `setProxy` method on the Builder sets the proxy at the WebDriver protocol level. The key fields in the proxy object are:

| Field | Purpose |
|-------|---------|
| `proxyType` | Must be `'manual'` for explicit proxy config |
| `httpProxy` | Proxy for HTTP traffic (`host:port`) |
| `sslProxy` | Proxy for HTTPS traffic (`host:port`) |
| `ftpProxy` | Proxy for FTP traffic (rarely needed) |
| `noProxy` | Comma-separated list of hosts to bypass |

This method still does not solve the authentication problem. For authenticated proxies, you still need the extension approach or CDP interception.

## SOCKS5 Proxy Configuration

SOCKS5 proxies operate at a lower level than HTTP proxies. They tunnel all TCP traffic without inspecting the protocol, which makes them useful for handling both HTTP and HTTPS traffic through a single proxy, and for scenarios where you want DNS resolution to happen on the proxy side rather than locally.

```javascript
const { Builder } = require('selenium-webdriver');
const chrome = require('selenium-webdriver/chrome');

async function runWithSocks5() {
  const options = new chrome.Options();
  options.addArguments('--proxy-server=socks5://127.0.0.1:1080');

  // Force DNS resolution through the SOCKS5 proxy
  // to prevent DNS leaks that reveal your real location
  options.addArguments('--host-resolver-rules=MAP * ~NOTFOUND, EXCLUDE 127.0.0.1');

  const driver = await new Builder()
    .forBrowser('chrome')
    .setChromeOptions(options)
    .build();

  try {
    await driver.get('https://httpbin.org/ip');
    const body = await driver.findElement({ css: 'pre' });
    console.log('SOCKS5 IP:', await body.getText());
  } finally {
    await driver.quit();
  }
}

runWithSocks5();
```

The `--host-resolver-rules` flag is critical. Without it, Chrome resolves DNS locally before sending traffic through the SOCKS5 proxy. That means the DNS server (usually your ISP's) sees every domain you visit, even though the actual HTTP traffic goes through the proxy. The flag forces all DNS resolution to fail locally, which makes Chrome fall back to resolving through the SOCKS proxy.

```mermaid
flowchart TD
    A["Selenium Script"] --> B["Chrome Browser"]
    B --> C{"DNS Resolution"}
    C -->|"Without flag"| D["Local DNS Server<br>(Leak)"]
    C -->|"With flag"| E["SOCKS5 Proxy<br>Resolves DNS"]
    D --> F["SOCKS5 Proxy"]
    E --> G["Target Website"]
    F --> G
    style D fill:#ffdddd
    style E fill:#ddffdd
```

## Proxy Rotation Between Requests

A single proxy is a single point of failure. For serious scraping, you need rotation -- switching proxies between requests or sessions so no single address accumulates too much traffic.

There are two main strategies for rotating proxies with Selenium.

### Strategy 1: Restart the Browser

The most straightforward approach is quitting the browser and launching a new instance with a different proxy. This is clean but slow because browser startup takes time.

```javascript
const { Builder } = require('selenium-webdriver');
const chrome = require('selenium-webdriver/chrome');

const proxies = [
  '103.21.160.54:8080',
  '185.199.228.220:7300',
  '45.33.32.156:3128',
  '91.243.71.90:8080'
];

async function scrapeWithRotation(urls) {
  const results = [];

  for (let i = 0; i < urls.length; i++) {
    const proxy = proxies[i % proxies.length];

    const options = new chrome.Options();
    options.addArguments(`--proxy-server=http://${proxy}`);
    options.addArguments('--headless=new');

    const driver = await new Builder()
      .forBrowser('chrome')
      .setChromeOptions(options)
      .build();

    try {
      await driver.get(urls[i]);
      const title = await driver.getTitle();
      results.push({ url: urls[i], proxy, title });
      console.log(`[${proxy}] ${urls[i]} -> ${title}`);
    } catch (err) {
      console.error(`[${proxy}] ${urls[i]} failed: ${err.message}`);
    } finally {
      await driver.quit();
    }
  }

  return results;
}

scrapeWithRotation([
  'https://example.com',
  'https://httpbin.org/ip',
  'https://example.org',
  'https://httpbin.org/headers'
]);
```

### Strategy 2: Use a Proxy Manager Gateway

A proxy manager or gateway service sits between your Selenium instance and the proxy pool. You configure Selenium to point at a single local address, and the gateway rotates the upstream proxy on each request. This avoids restarting the browser entirely.

```javascript
const { Builder } = require('selenium-webdriver');
const chrome = require('selenium-webdriver/chrome');

async function scrapeWithGateway() {
  // The gateway runs locally and rotates upstream proxies
  // on each request. You configure it once.
  const options = new chrome.Options();
  options.addArguments('--proxy-server=http://127.0.0.1:24000');

  const driver = await new Builder()
    .forBrowser('chrome')
    .setChromeOptions(options)
    .build();

  try {
    // Each navigation uses a different upstream proxy
    // because the gateway rotates automatically
    for (let i = 0; i < 5; i++) {
      await driver.get('https://httpbin.org/ip');
      const body = await driver.findElement({ css: 'pre' });
      console.log(`Request ${i + 1}:`, await body.getText());
    }
  } finally {
    await driver.quit();
  }
}

scrapeWithGateway();
```

The gateway approach is faster because you avoid browser restarts, and it separates proxy management from your scraping logic. Tools like [Proxy Chain](https://github.com/apify/proxy-chain) for Node.js or commercial services like BrightData and Oxylabs provide this functionality.


<figure>
  <img src="/assets/img/inline-using-proxies-selenium-nodejs-2.jpg" alt="A decade of Selenium set the stage for everything that followed." loading="lazy">
  <figcaption>A decade of Selenium set the stage for everything that followed. <span class="img-credit">Photo by Lukas Blazek / <a href="https://www.pexels.com" target="_blank" rel="noopener noreferrer">Pexels</a></span></figcaption>
</figure>

## Testing Your Proxy Configuration

Before running a scraper against a real target, verify that your proxy is working. The easiest way is to hit an IP echo service and check the response.

```javascript
const { Builder } = require('selenium-webdriver');
const chrome = require('selenium-webdriver/chrome');

async function verifyProxy(proxyAddress) {
  const options = new chrome.Options();
  options.addArguments(`--proxy-server=http://${proxyAddress}`);
  options.addArguments('--headless=new');

  const driver = await new Builder()
    .forBrowser('chrome')
    .setChromeOptions(options)
    .build();

  try {
    // Check IP address
    await driver.get('https://httpbin.org/ip');
    const ipElement = await driver.findElement({ css: 'pre' });
    const ipData = JSON.parse(await ipElement.getText());
    console.log('Proxy IP:', ipData.origin);

    // Check headers for proxy leaks
    await driver.get('https://httpbin.org/headers');
    const headersElement = await driver.findElement({ css: 'pre' });
    const headers = JSON.parse(await headersElement.getText());

    // Look for headers that reveal proxy usage
    const suspiciousHeaders = [
      'X-Forwarded-For',
      'X-Real-Ip',
      'Via',
      'X-Proxy-Id'
    ];

    for (const header of suspiciousHeaders) {
      if (headers.headers[header]) {
        console.warn(`Warning: ${header} header present: ${headers.headers[header]}`);
      }
    }

    // Check for WebRTC leak (optional but thorough)
    await driver.get('data:text/html,<script>async function getIP(){try{const c=new RTCPeerConnection({iceServers:[]});c.createDataChannel("");const o=await c.createOffer();await c.setLocalDescription(o);c.onicecandidate=e=>{if(e.candidate){document.body.innerText=e.candidate.candidate}}}catch(e){document.body.innerText="WebRTC blocked"}}getIP()</script>');
    await driver.sleep(2000);
    const webrtcResult = await driver.findElement({ css: 'body' }).getText();
    console.log('WebRTC result:', webrtcResult);

    return ipData.origin;
  } finally {
    await driver.quit();
  }
}

verifyProxy('103.21.160.54:8080');
```

A thorough proxy test checks three things: that your visible IP matches the proxy, that no headers leak your real IP, and that WebRTC does not bypass the proxy to reveal your actual address.

## Common Issues and How to Fix Them

### Proxy Timeouts

Proxies add latency. Free or overloaded proxies can add a lot of latency. Selenium's default page load timeout may not be enough.

```javascript
const { Builder } = require('selenium-webdriver');
const chrome = require('selenium-webdriver/chrome');

async function runWithTimeouts() {
  const options = new chrome.Options();
  options.addArguments('--proxy-server=http://103.21.160.54:8080');

  const driver = await new Builder()
    .forBrowser('chrome')
    .setChromeOptions(options)
    .build();

  try {
    // Increase timeouts to accommodate slow proxies
    await driver.manage().setTimeouts({
      pageLoad: 60000,   // 60 seconds for page load
      script: 30000,     // 30 seconds for async scripts
      implicit: 10000    // 10 seconds for element lookups
    });

    await driver.get('https://example.com');
    console.log('Page loaded:', await driver.getTitle());
  } catch (err) {
    if (err.name === 'TimeoutError') {
      console.error('Proxy is too slow or unresponsive');
    } else {
      throw err;
    }
  } finally {
    await driver.quit();
  }
}

runWithTimeouts();
```

### SSL Certificate Errors

Some proxies, especially HTTPS-inspecting corporate proxies, present their own SSL certificates that Chrome does not trust. You can bypass these errors for scraping (never do this for anything security-sensitive).

```javascript
const options = new chrome.Options();
options.addArguments('--proxy-server=http://103.21.160.54:8080');
options.addArguments('--ignore-certificate-errors');
options.addArguments('--ignore-ssl-errors=yes');
options.acceptInsecureCerts(true);
```

### DNS Leaks

Even with an HTTP proxy, Chrome may resolve DNS locally before sending the request through the proxy. This reveals the domains you visit to your local DNS resolver.

For HTTP proxies, you can mitigate this by using the proxy for DNS as well:

```javascript
const options = new chrome.Options();
options.addArguments('--proxy-server=http://103.21.160.54:8080');
options.addArguments('--dns-prefetch-disable');
```

For full DNS leak prevention, SOCKS5 proxies with the `--host-resolver-rules` flag (shown in the SOCKS5 section above) provide the strongest protection.

### Proxy Connection Refused

If Chrome cannot connect to the proxy at all, you get an `ERR_PROXY_CONNECTION_FAILED` error. Common causes:

- The proxy server is down or the address is wrong
- A firewall is blocking the connection
- The proxy requires authentication but you passed it as a bare `--proxy-server` argument

Build a retry mechanism that falls back to alternative proxies:

```javascript
const { Builder } = require('selenium-webdriver');
const chrome = require('selenium-webdriver/chrome');

async function scrapeWithFallback(url, proxies) {
  for (const proxy of proxies) {
    const options = new chrome.Options();
    options.addArguments(`--proxy-server=http://${proxy}`);
    options.addArguments('--headless=new');

    let driver;
    try {
      driver = await new Builder()
        .forBrowser('chrome')
        .setChromeOptions(options)
        .build();

      await driver.manage().setTimeouts({ pageLoad: 30000 });
      await driver.get(url);
      const title = await driver.getTitle();
      console.log(`Success with ${proxy}: ${title}`);
      return { proxy, title };
    } catch (err) {
      console.warn(`Proxy ${proxy} failed: ${err.message}`);
    } finally {
      if (driver) {
        await driver.quit();
      }
    }
  }

  throw new Error('All proxies exhausted');
}

scrapeWithFallback('https://example.com', [
  '103.21.160.54:8080',
  '185.199.228.220:7300',
  '45.33.32.156:3128'
]);
```

## Using a Proxy Manager Service

For production scraping, managing your own proxy pool is tedious. Commercial proxy services handle rotation, health checking, geo-targeting, and session management for you. The integration pattern is almost always the same: point Selenium at a single gateway endpoint and let the service handle everything upstream.

```javascript
const { Builder } = require('selenium-webdriver');
const chrome = require('selenium-webdriver/chrome');
const proxyChain = require('proxy-chain');

async function runWithProxyChain() {
  // proxy-chain creates a local anonymizing proxy that
  // forwards to your authenticated upstream proxy
  const newProxyUrl = await proxyChain.anonymizeProxy(
    'http://username:password@proxy.service.com:8080'
  );

  // newProxyUrl is something like http://127.0.0.1:54321
  // with no auth required -- Chrome can use it directly
  const options = new chrome.Options();
  options.addArguments(`--proxy-server=${newProxyUrl}`);
  options.addArguments('--headless=new');

  const driver = await new Builder()
    .forBrowser('chrome')
    .setChromeOptions(options)
    .build();

  try {
    await driver.get('https://httpbin.org/ip');
    const body = await driver.findElement({ css: 'pre' });
    console.log('Proxy service IP:', await body.getText());
  } finally {
    await driver.quit();
    await proxyChain.closeAnonymizedProxy(newProxyUrl);
  }
}

runWithProxyChain();
```

The `proxy-chain` package from Apify is particularly useful here. It spins up a local proxy server that accepts unauthenticated connections from Chrome and forwards them to your authenticated upstream proxy. This neatly sidesteps the Chrome proxy auth limitation without needing extensions.

```mermaid
flowchart TD
    A["Selenium + Chrome"] -->|"No auth needed"| B["proxy-chain<br>Local Proxy<br>(127.0.0.1:54321)"]
    B -->|"Adds credentials"| C["Upstream Proxy<br>(proxy.service.com:8080)"]
    C -->|"Rotates IPs"| D["Proxy Pool"]
    D --> E["Target Website"]
    style B fill:#ddffdd
    style D fill:#ffffdd
```

## Quick Reference: Which Method to Use

| Scenario | Method | Auth Support |
|----------|--------|-------------|
| Simple unauthenticated proxy | `--proxy-server` flag | No |
| Authenticated HTTP proxy | Chrome extension | Yes |
| Authenticated proxy (no extensions) | `proxy-chain` local forwarder | Yes |
| SOCKS5 tunnel | `--proxy-server=socks5://...` | No (use SSH tunnel) |
| Cross-browser proxy | `setProxy` capability | No |
| Rotating proxies | Gateway service or browser restart | Depends on gateway |

Proxies are just one part of the picture. Pairing them with [Selenium stealth techniques](/posts/selenium-stealth-making-selenium-less-detectable/) and [running headless](/posts/setting-up-headless-chromedriver-eliminating-browser-window/) reduces your detection surface further. The simplest path for most scraping projects is to start with `--proxy-server` for unauthenticated proxies and switch to `proxy-chain` or the extension method once you need credentials. For production workloads that require rotation and reliability, a commercial proxy service with a gateway endpoint keeps your Selenium code clean and your proxy management separate. For a broader look at combining proxies with other evasion methods, see [stealth scraping techniques](/posts/stealth-scraping-techniques-flying-under-radar/).
