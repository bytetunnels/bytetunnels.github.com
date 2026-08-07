---
title: "Fail the Build When a GitHub Dependency Goes Archived or Stale"
description: "A CI gate built on GitHub repo metadata: SPDX licence, isArchived, and the gap between last commit and last release."
date: 2026-08-07 00:00:00 +0000
categories: ["Data Extraction"]
tags: ["github", "supply chain", "data extraction", "data pipelines", "monitoring", "open source", "javascript", "sql"]
author: arman
image:
  path: /assets/img/2026-08-07-fail-the-build-when-github-dependency-goes-stale-hero.jpg
  alt: "Fail the Build When a GitHub Dependency Goes Archived or Stale"
---

Your SBOM tool will tell you a dependency is MIT. It will not tell you that the repository behind it was archived in April, that its last release predates its last commit by fourteen months, or that the path in your lockfile now redirects somewhere else. Those three facts live in GitHub's repository metadata. In my experience they get a dependency ripped out of a codebase far more often than a licence identifier does.

## One run, one row per dependency

The fetch is the boring part. [GitHub Repository Scraper](https://apify.com/arman-bd/github-repo-scraper) takes a list of `owner/repo` strings and returns one flat record per repository. You still need a resolver step in front of it. Read `repository.url` from each npm registry document (or `go list -m -json`, or the PyPI `project_urls`) and normalise it down to `owner/repo`. That mapping is the fiddly bit and it is worth caching, because it changes far less often than your lockfile does.

```js
import { ApifyClient } from 'apify-client';

const client = new ApifyClient({ token: process.env.APIFY_TOKEN });

const run = await client.actor('arman-bd/github-repo-scraper').call({
  repositories: ['vercel/next.js', 'expressjs/express'],
  includeReleases: true,
  includeContributors: true,
  includeLanguages: true,
});

const { items } = await client.dataset(run.defaultDatasetId).listItems();
const { value: summary } = await client
  .keyValueStore(run.defaultKeyValueStoreId)
  .getRecord('RUN_SUMMARY');

console.log(items.length, summary.reposFailed, summary.reposSkipped);
```

The REST equivalent, if you would rather keep CI dependency-free:

```bash
curl -s -X POST \
  "https://api.apify.com/v2/acts/arman-bd~github-repo-scraper/run-sync-get-dataset-items?token=$APIFY_TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"repositories":["vercel/next.js","expressjs/express"],
       "includeReleases":true,"includeContributors":true,"includeLanguages":true}'

curl -s "https://api.apify.com/v2/acts/arman-bd~github-repo-scraper/runs/last/key-value-store/records/RUN_SUMMARY?token=$APIFY_TOKEN"
```

Note the second call. `run-sync-get-dataset-items` hands you rows and nothing else, so the summary comes from the last-run alias. Here is a real record from that two-repo run, with `topics`, `languages`, `releases` and `contributors` trimmed:

```json
{
  "requestedAs": "vercel/next.js",
  "fullName": "vercel/next.js",
  "owner": "vercel",
  "url": "https://github.com/vercel/next.js",
  "stars": 141654,
  "openIssues": 4391,
  "license": "MIT",
  "primaryLanguage": "JavaScript",
  "defaultBranch": "canary",
  "isArchived": false,
  "isFork": false,
  "createdAt": "2016-10-05T23:32:51Z",
  "pushedAt": "2026-08-06T23:09:29Z",
  "latestRelease": {
    "tagName": "v16.3.0",
    "publishedAt": "2026-08-03T21:03:18Z",
    "isPrerelease": false,
    "url": "https://github.com/vercel/next.js/releases/tag/v16.3.0"
  },
  "contributors": [
    { "login": "ijjk", "contributions": 3296, "type": "User" },
    { "login": "timneutkens", "contributions": 2856, "type": "User" }
  ],
  "scrapedAt": "2026-08-06T23:25:50.204Z"
}
```

<figure>
  <img src="/assets/img/2026-08-07-fail-the-build-when-github-dependency-goes-stale-fig1.png" alt="Dependency audit gate topology" loading="lazy">
  <figcaption>The resolver maps lockfile entries to owner/repo. The run produces both rows and a coverage summary, and the gate reads both, because missing rows fail the build just as hard as bad ones.</figcaption>
</figure>

## The licence field is a signal, not a verdict

`license` comes back as a bare SPDX identifier: `"MIT"` above. That makes the deny-list trivial to write, and it is the part everyone writes first:

```js
const DENY = [/^GPL-/, /^AGPL-/, /^SSPL/, /^BUSL/];
const ALLOW = new Set([
  'MIT', 'Apache-2.0', 'BSD-2-Clause', 'BSD-3-Clause', 'ISC', 'MPL-2.0', 'Unlicense',
]);

export function licenceVerdict(repo) {
  const id = repo.license;
  if (!id) return { level: 'review', why: 'no licence detected' };
  if (DENY.some((re) => re.test(id))) return { level: 'block', why: `denied licence ${id}` };
  if (!ALLOW.has(id)) return { level: 'review', why: `unrecognised licence ${id}` };
  return { level: 'pass' };
}
```

The important line is the penultimate one. Anything you have not explicitly allowed goes to review, never to pass. A repository with a hand-modified LICENSE file, a dual-licensed project, or one with no detectable licence at all must not slip through because your deny-list did not name it. Fail-open licence gates are the reason people stop trusting licence gates.

## Three ways a dependency dies, and only one is obvious

`isArchived` is the hard signal: the maintainer has said, in the only machine-readable way GitHub offers, that this is finished. Block on it and move on.

The other two are more interesting. First, consumers install releases, not commits, so a repository can look busy on `pushedAt` while its release stream has flatlined. Bot pushes, docs edits and dependency bumps all move `pushedAt`. The gap between `pushedAt` and `latestRelease.publishedAt` is the number that matters. For `vercel/next.js` that gap is three days. A repository with a push yesterday and a release in 2023 is not maintained, from your position downstream.

```js
const DAY = 86_400_000;
const ts = (v) => (typeof v === 'number' ? v : Date.parse(v));
const days = (a, b) => Math.round((ts(a) - ts(b)) / DAY);

export function stalenessVerdict(repo, now = Date.now()) {
  if (repo.isArchived) return { level: 'block', why: 'upstream archived' };
  const last = repo.latestRelease?.publishedAt;
  if (!last) return { level: 'review', why: 'no published release' };
  if (days(now, last) > 540) return { level: 'block', why: `${days(now, last)}d since release` };
  if (days(repo.pushedAt, last) > 365)
    return { level: 'review', why: 'commits continue, releases stopped' };
  return { level: 'pass' };
}
```

Use `latestRelease`, not `releases[0]`. In the run above, `releases[0]` is `v16.3.1-canary.4` with `isPrerelease: true`, because the default branch is `canary` and the project publishes canaries continuously. Compute cadence from the prerelease stream and every fast-moving project scores as healthy while its stable line quietly rots. If you walk the `releases` array yourself, filter `isPrerelease` first.

Second, the bus factor. `contributors` is a ranked slice, not the full history, so treat the ratio as concentration among the top contributors returned rather than across all commits. For next.js those three entries sum to 8,656, and `ijjk` holds 3,296 of them: 38%. That is a healthy spread. A single login holding more than half of the returned contributions is worth a human look, not an automatic block.

<figure>
  <img src="/assets/img/2026-08-07-fail-the-build-when-github-dependency-goes-stale-fig2.png" alt="Four signals, one verdict" loading="lazy">
  <figcaption>Only isArchived is a hard fail. The other three are graded: a stalled release stream blocks, concentration and ownership drift route to a human.</figcaption>
</figure>

## Ownership drift is the cheapest check nobody runs

`requestedAs` is what you asked for; `fullName` is what GitHub resolved. GitHub redirects renamed and transferred repositories, so those two strings diverging means the project moved: a rename, or a transfer to a different owner. Transfer to a new organisation is precisely the event that precedes the interesting supply-chain incidents, and it costs one string comparison to detect.

```js
const moved = repo.requestedAs.toLowerCase() !== repo.fullName.toLowerCase();
if (moved) findings.push({ level: 'review', why: `${repo.requestedAs} now resolves to ${repo.fullName}` });
if (repo.isFork) findings.push({ level: 'review', why: 'direct dependency on a fork' });
```

## Fail closed on coverage, not just on findings

A gate that only inspects the rows it received will pass a build in which half the dependencies were never fetched. `RUN_SUMMARY` exists for exactly this. The real one from that run reported `reposRequested: 2`, `reposSaved: 2`, `reposFailed: 0`, `reposSkipped: 0`, empty `failures` and `skipped` arrays, `rateLimited: false`, and `requestsPerRepo: 4` with all three includes enabled.

```js
if (summary.reposFailed || summary.reposSkipped || summary.rateLimited) {
  throw new Error(`incomplete audit: ${JSON.stringify(summary.failures)}`);
}
const seen = new Set(items.map((r) => r.requestedAs.toLowerCase()));
const missing = wanted.filter((r) => !seen.has(r.toLowerCase()));
if (missing.length) throw new Error(`unaudited dependencies: ${missing.join(', ')}`);
```

That `requestsPerRepo: 4` is your budgeting figure. A 300-dependency tree is roughly 1,200 requests, which decides whether this runs per-PR or nightly. Nightly, for most teams, with the result cached and the PR job reading the cache.

## The delta is the alert

Absolute verdicts get ignored after the first fortnight; changes do not. Persist every run and diff it.

```sql
create table dep_audit (
  captured_at     timestamptz not null,
  requested_as    text        not null,
  full_name       text        not null,
  license         text,
  is_archived     boolean,
  pushed_at       timestamptz,
  last_release_at timestamptz,
  primary key (captured_at, requested_as)
);
```

```sql
select requested_as, captured_at, prev_license, license, prev_archived, is_archived
from (
  select requested_as, captured_at, license, is_archived,
         lag(license)     over w as prev_license,
         lag(is_archived) over w as prev_archived
  from dep_audit
  window w as (partition by requested_as order by captured_at)
) t
where prev_license is not null
  and (license is distinct from prev_license
       or is_archived is distinct from prev_archived);
```

That query is the relicensing detector. A dependency going from `Apache-2.0` to `BUSL-1.1` between two nightly runs is a legal event with a deadline attached, and you want to hear about it the week it happens rather than during an acquisition diligence review.

## What this gate cannot tell you

`license` describes the LICENSE file at the tip of the default branch as it stands right now. For next.js that branch is `canary`. Your lockfile pins a tag, possibly a very old one, and the licence at that tag may differ from the licence today, because relicensing usually applies going forward. So this gate is excellent at catching archival, ownership drift, release-stream death and licence *change*, and it is not a version-accurate licence determination. Keep that job in the tool that reads the tarball. Treating a green repo-metadata check as legal clearance for the version you actually ship is the one mistake here that will cost you real money.
