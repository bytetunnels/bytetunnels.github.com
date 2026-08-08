---
title: "Massive: The Proxy Provider With Device-Type Targeting"
description: "Massive lets you pick whether a request exits from a desktop, a phone, or a smart TV. Why that dropdown is rarer than it looks."
date: 2026-08-07 10:00:00 +0000
categories: ["Web Scraping"]
tags: ["proxy", "residential proxies", "massive", "device targeting", "geotargeting", "ip rotation", "web scraping"]
author: arman
image:
  path: /assets/img/2026-08-07-proxy-provider-with-device-type-targeting-hero.png
  alt: "Massive's device type dropdown: Common (desktops and laptops), Mobile (smartphones and tablets), TV (smart TVs and set-top boxes)"
---

Every residential proxy dashboard has the same knobs. Country, city, sticky session, maybe ZIP and ASN if the provider is feeling fancy. You know the drill. After the tenth one you stop reading the panel and scroll straight for the username string.

Which is what I was doing in the [Massive](https://www.joinmassive.com/) dashboard when a dropdown labelled **Device type** stopped me. Three options: *Common (desktops and laptops)*, *Mobile (smartphones and tablets)*, *TV (smart TVs and set-top boxes)*. I read it twice. You do not see that knob often in this industry.

Quick FYI before we go on: this is not an affiliate post. No referral link, no commission. I just found the dropdown interesting enough to write about.

## Why almost nobody has this dropdown

Geo targeting is a lookup. An IP is a key, and the value is something you buy off the shelf. Any reseller can grab a pool from an aggregator, join it against a commercial GeoIP database, and ship a dashboard full of city and ZIP dropdowns without knowing one true thing about where those addresses came from.

Device class does not work like that. There is no database you can buy that says "this IP is somebody's living-room TV". That fact exists in exactly one place: the moment the device opted in. If you were not there for that moment, you simply do not have it.

Which makes the dropdown less a feature and more a side effect. Massive can sell device targeting because they built the supply chain themselves and were standing there when each device joined. You can only sell what you can see.

## The consent story holds up

Consent is easy to claim and hard to evidence, so I checked. SOC 2 Type I audited for Security. GDPR and CCPA compliant. They run KYC on their clients and keep an audit trail from source to request. IPs are enrolled through their own SDK, and the deal is stated plainly: idle bandwidth in exchange for a premium app benefit.

The bit I keep coming back to is the AppEsteem certification, because it covers the enrolment screen itself. Informed consent, clean uninstall. That screen is the exact moment a device becomes an exit node, and someone audited it.

## How you actually use it

It is a username parameter, and it composes with everything else:

```bash
curl --proxy http://network.joinmassive.com:65534 \
     -U '{USERNAME}-type-mobile-country-US-session-1:{API_KEY}' \
     https://cloudflare.com/cdn-cgi/trace
```

Values are `common`, `mobile`, and `tv`, comma-separated if any of several will do, and the whole thing is [documented properly](https://docs.joinmassive.com/residential/device-type-targeting). Typo a value and you get a 400 back, not a silent fallback to an untargeted request. Small thing, but it is the right call. I have lost whole afternoons to configs that fail quietly.

## Where it earns its keep

<figure>
  <img src="/assets/img/2026-08-07-proxy-provider-with-device-type-targeting-fig1.png" alt="Diagram: the -type-mobile username parameter routing a request out through a phone, while the laptop and TV device classes sit unselected, and the target site sees a real phone on a residential line" loading="lazy">
  <figcaption>type-mobile routes the request out through a real phone. The laptop and the TV stay available, one parameter away.</figcaption>
</figure>

Mobile is the practical one. Your phone User-Agent stops contradicting the desktop fibre line it exits from, which is one less thing for your [fingerprint](/posts/chromiumfish-engine-level-stealth-browser-fingerprint-hardening/) to explain away. And you get served the mobile DOM instead of the desktop template. That second part alone killed a whole category of "the selector works locally but not in production" bugs for me.

But TV is the one that stuck with me. Smart TVs and set-top boxes were a segment I had written off completely. If you have ever needed to verify connected-TV ad delivery, or check what a streaming catalogue looks like on the living-room app rather than the web player, you know the blocker was never technique. There was simply no supply. Now there is. A small pool, probably not a fast one, but going from impossible to small and slow counts for a lot more than going from fine to slightly better.

## The part worth generalising

Next time you are [sizing up a provider](/posts/what-questions-to-ask-choosing-data-extraction-solution/), ask what device your exit node is. Most of the market cannot answer. Try it, the silence is informative.

Massive, for its part, publishes [a ten-question checklist](https://www.joinmassive.com/blog/proxy-vendor-compliance-soc2-gdpr) of what buyers should demand from any proxy vendor. How IPs enter the network, how they leave, SOC 2 type and period, named subprocessors, retention windows, breach notification timelines. Handing your customers the questions to grill you with is a confident thing to publish. I mean that as a compliment.
