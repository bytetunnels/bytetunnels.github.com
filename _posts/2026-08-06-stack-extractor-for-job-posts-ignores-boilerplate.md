---
title: "The Stack Extractor for Job Posts That Ignores the Boilerplate First"
description: "One free-text field, thirteen structured ones, and a ranking that goes wrong until you strip what every posting on the board shares."
date: 2026-08-06 23:00:00 +0000
categories: ["Data Extraction"]
tags: ["job boards", "ashby", "data extraction", "data engineering", "text processing", "pattern matching", "javascript", "sql"]
author: arman
image:
  path: /assets/img/2026-08-06-stack-extractor-for-job-posts-ignores-boilerplate-hero.jpg
  alt: "The Stack Extractor for Job Posts That Ignores the Boilerplate First"
---

An Ashby posting record has thirteen structured fields and one blob. Everything you actually want to know about a company's stack lives in the blob, `descriptionPlain`. The first extractor you write over it will happily rank the company's own boilerplate above its real technologies, because the "ABOUT RAMP" preamble and the benefits section repeat, near-verbatim, in every posting on the board.

That is the whole engineering problem in one sentence. Below is a corpus builder that handles it, plus a ranking that measures something more useful than keyword frequency.

## Pull a board

The postings come from the [Ashby Jobs Scraper](https://apify.com/arman-bd/ashby-jobs-scraper) on Apify. One call, one dataset, one summary record:

```js
// npm i apify-client
import { ApifyClient } from 'apify-client';

const client = new ApifyClient({ token: process.env.APIFY_TOKEN });

const run = await client.actor('arman-bd/ashby-jobs-scraper').call({
  boards: ['ramp'],
  includeCompensation: true,
  maxJobsPerBoard: 6,
});

const { items } = await client.dataset(run.defaultDatasetId).listItems();
const { value: summary } = await client
  .keyValueStore(run.defaultKeyValueStoreId)
  .getRecord('RUN_SUMMARY');

console.log(summary.jobsSaved, 'saved,', summary.jobsWithCompensation, 'with pay');
```

That exact input returned 6 rows in 3.276s, and `RUN_SUMMARY` came back as `{ boardsRequested: 1, boardsFailed: 0, failures: [], jobsSaved: 6, jobsWithCompensation: 6, … }`. Read that record on every run before you touch the dataset: `boardsFailed` and `failures` tell you whether a gap in your corpus is a hiring signal or a scrape that half-worked. Silently ranking technologies over a corpus that lost three boards is the kind of mistake that survives review.

The same thing over REST, if you would rather not add a dependency:

```bash
curl -sX POST "https://api.apify.com/v2/acts/arman-bd~ashby-jobs-scraper/run-sync-get-dataset-items?token=$APIFY_TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"boards":["ramp"],"includeCompensation":true,"maxJobsPerBoard":6}' > jobs.json

curl -s "https://api.apify.com/v2/acts/arman-bd~ashby-jobs-scraper/runs/last/key-value-store/records/RUN_SUMMARY?token=$APIFY_TOKEN"
```

For a real corpus, put every board slug you care about in `boards` and set `maxJobsPerBoard` to `0` for no cap. Leave `searchTerms` empty. Filtering titles to "engineer" throws away the data science and infrastructure postings, which is exactly where half the interesting tooling shows up.

## What a record looks like

One row from that run, long strings trimmed with `…`:

```json
{
  "board": "ramp",
  "jobId": "34413f8d-26bf-4bbc-8ade-eb309a0e2245",
  "title": "Security Engineer, Cloud",
  "team": "Backend",
  "location": "New York, NY (HQ)",
  "employmentType": "FullTime",
  "isRemote": true,
  "compensationMin": 211400,
  "compensationMax": 290600,
  "currency": "USD",
  "publishedAt": "2026-04-07T17:12:35.753+00:00",
  "applyUrl": "https://jobs.ashbyhq.com/ramp/34413f8d-26bf-4bbc-8ade-eb309a0e2245/application",
  "descriptionPlain": "ABOUT RAMP\n\nRamp is building the smart infrastructure for finance teams…",
  "scrapedAt": "2026-08-06T23:25:50.343Z"
}
```

Note what you get for free: `team` for grouping, `compensationMin`/`compensationMax`/`currency` for the pay axis, `publishedAt` for time series (`scrapedAt` is when you looked, not when they posted). `jobId` is your primary key, and it is stable enough to diff two runs a fortnight apart.

## Two passes, not one

Do not match technologies on the first read of a board. Read it twice: once to find out which lines every posting shares, and once to extract from what remains.

```js
import { createHash } from 'node:crypto';

const norm = (l) => l.trim().replace(/\s+/g, ' ').toLowerCase();
const key = (l) => createHash('sha1').update(norm(l)).digest('hex').slice(0, 12);

function sharedLines(rows, threshold = 0.6) {
  const counts = new Map();
  for (const r of rows) {
    const lines = new Set(r.descriptionPlain.split('\n').map(norm).filter(Boolean));
    for (const l of lines) counts.set(key(l), (counts.get(key(l)) ?? 0) + 1);
  }
  const min = Math.max(2, Math.ceil(rows.length * threshold));
  return new Set([...counts].filter(([, c]) => c >= min).map(([k]) => k));
}
```

Group rows by `board` before calling it. Shared-line sets are a per-company property, and pooling boards will strip nothing.

Here is the trap, and it is the reason this section is not two lines long. At a company where every backend posting carries the sentence "our services are written in Go, backed by Postgres and deployed on Kubernetes", a 60% shared-line filter deletes the single truest sentence in the corpus. Boilerplate detection and stack detection find the same thing, because a stack blurb is boilerplate.

The fix uses `team`. Compute the shared-line set twice: once across the whole board, and once within each `(board, team)` group. A line shared across every team is company copy (mission, benefits, EEO) and should be dropped. A line shared inside one team but absent from the others is that team's stack description, and it should count once for the team rather than once per posting, or a team with fourteen open backend roles will make its stack look fourteen times more in demand than a team with one.

<figure>
  <img src="/assets/img/2026-08-06-stack-extractor-for-job-posts-ignores-boilerplate-fig1.png" alt="Two passes over one board's postings" loading="lazy">
  <figcaption>The first pass never extracts anything. It only learns which lines the board repeats. Lines shared across every team are company copy and get dropped; lines shared inside a single team are that team's stack blurb and are counted once for the team, not once per posting.</figcaption>
</figure>

## Matching without the false positives

Keep a dictionary of canonical ids with alias patterns, and always resolve to the id before counting. `Postgres` and `PostgreSQL` in the same posting are one vote, not two. The same discipline that keeps a [regex-based extractor honest without a parser](/posts/regex-for-web-scraping-extracting-data-without-parser/) applies here: anchor the patterns, then normalise to a canonical id.

```js
const TECH = {
  go:         [/\bgolang\b/i, /\bgo\b/i],
  python:     [/\bpython\b/i],
  typescript: [/\btypescript\b/i],
  postgres:   [/\bpostgres(ql)?\b/i],
  kafka:      [/\bkafka\b/i],
  kubernetes: [/\bkubernetes\b/i, /\bk8s\b/i],
  terraform:  [/\bterraform\b/i],
  aws:        [/\b(aws|amazon web services)\b/i],
};

// Short names collide with English. Require a stack cue on the same line.
const AMBIGUOUS = new Set(['go', 'r', 'c', 'swift', 'rust']);
const CUE = /\b(experience|proficien|stack|written in|languages?|codebase|familiar|using)\b/i;
```

Then match line by line, and return a set:

```js
function techIn(text, dropped) {
  const hits = new Set();
  for (const line of text.split('\n')) {
    if (dropped.has(key(norm(line)))) continue;
    for (const [id, pats] of Object.entries(TECH)) {
      if (!pats.some((p) => p.test(line))) continue;
      if (AMBIGUOUS.has(id) && !CUE.test(line)) continue;
      hits.add(id);
    }
  }
  return [...hits];
}
```

A `Set`, not an array, is the second half of the design. "Go" appearing nine times in one posting is one company wanting one Go engineer. Mention counts measure how verbose a recruiter is; posting counts measure demand.

Before you trust the dictionary, spend twenty minutes on the inverse: collect every line that matched nothing and skim it. That is where you find the tools you forgot: the internal-sounding ones, the ones with names that are also verbs.

## Rank by the band, not by the count

Two tables are enough:

```sql
create table posting (
  job_id text primary key, board text, team text, title text,
  is_remote boolean, comp_min numeric, comp_max numeric,
  currency text, published_at timestamptz
);
create table posting_tech (
  job_id text references posting, tech_id text, primary key (job_id, tech_id)
);
```

Counting postings per `tech_id` gives you a popularity list, and popularity lists are boring. Python and AWS win everywhere. The interesting ranking uses the pay fields, which is why `includeCompensation: true` matters at collection time: in the run above, all 6 rows had a band, and `RUN_SUMMARY.jobsWithCompensation` is your denominator for how much of the corpus can participate.

```sql
select t.tech_id,
       count(*) as postings,
       percentile_cont(0.5) within group (
         order by (p.comp_min + p.comp_max) / 2.0
       ) as median_mid
from posting_tech t join posting p using (job_id)
where p.currency = 'USD' and p.comp_min is not null
  and p.title !~* '\m(staff|principal|director|vp)\M'
group by t.tech_id having count(*) >= 20
order by median_mid desc;
```

The seniority filter in the `where` clause is not optional. A compensation band belongs to a role, not to a technology, so any tool that clusters in staff-and-above postings inherits their bands and floats to the top of an unfiltered ranking. Bucket by seniority and compare within bucket, or you are ranking job titles with extra steps.

<figure>
  <img src="/assets/img/2026-08-06-stack-extractor-for-job-posts-ignores-boilerplate-fig2.png" alt="Where the two rankings disagree" loading="lazy">
  <figcaption>Posting count and median pay band are computed over the same join but answer different questions. Comparing them inside a seniority bucket is what separates table-stakes tooling from scarce tooling.</figcaption>
</figure>

What you are looking for is the disagreement between the two orderings. A technology high on posting count and low on median band is table stakes: everyone asks, nobody pays extra. High on band and low on count is scarcity. That gap is the only output of this pipeline that tells you something you did not already know.

## Before you publish a chart of it

Re-run the same boards monthly, key on `jobId`, and rank on `publishedAt` months rather than on whatever happened to be open the day you scraped: a board is a snapshot of unfilled roles, and a technology can drop off it because the team finished hiring. Keep the raw `descriptionPlain` alongside the extracted rows, because your dictionary will change and you will want to re-derive without re-scraping. And check `failures` in `RUN_SUMMARY` every single time before you let a number out of the door.
