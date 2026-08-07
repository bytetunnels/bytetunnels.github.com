---
title: "A Weekly arXiv Digest Keyed to a Lab's Authors Rather Than a Keyword"
description: "arXiv authors are free-text strings, not identities. Here is how to build a weekly lab digest that survives that fact."
date: 2026-08-06 22:00:00 +0000
categories: ["Data Extraction"]
tags: ["arxiv", "research papers", "data extraction", "data pipelines", "automation", "nodejs", "text processing", "api"]
author: arman
image:
  path: /assets/img/2026-08-06-weekly-arxiv-digest-keyed-to-lab-authors-hero.jpg
  alt: "A Weekly arXiv Digest Keyed to a Lab's Authors Rather Than a Keyword"
---

The people whose work you follow do not publish under a stable keyword. A group drifts from long-context modelling to retrieval to evaluation over eighteen months, and the only durable handle on their output is the author list. arXiv gives you that list and then takes it straight back, because an author there is a free-text string, not an identity.

So an author watcher is mostly a matching problem wrapped around a fetch. The fetch I use is the [arXiv Scraper](https://apify.com/arman-bd/arxiv-papers-scraper) Actor on Apify; it takes search queries, category filters and a date floor, and drops normalised records into a dataset. Everything interesting happens after that.

## The shape of the data

Start with the smallest possible run so you can see the record shape before committing to it.

```js
import { ApifyClient } from 'apify-client';

const client = new ApifyClient({ token: process.env.APIFY_TOKEN });

const run = await client.actor('arman-bd/arxiv-papers-scraper').call({
  categories: ['cs.LG'],
  sortBy: 'submittedDate',
  maxResultsPerQuery: 6,
});

const { items } = await client.dataset(run.defaultDatasetId).listItems();
const { value: summary } = await client
  .keyValueStore(run.defaultKeyValueStoreId)
  .getRecord('RUN_SUMMARY');

console.log(items.length, summary.papersSaved, summary.queriesFailed);
```

That returned six rows in a little over three seconds. Here is one of them verbatim, with the abstract trimmed:

```json
{
  "arxivId": "2608.05141v1",
  "title": "OctoLong: Mid-Training On Cross-Repository Code Contexts Enhances Long-Context Modeling",
  "abstract": "Context lengths of language models (LMs) have dramatically increased, driven by the demands for in-context learning, self-improvement, and long-horizon agentic workflows…",
  "authors": ["Indraneil Paul", "Falko Helm", "Goran Glavaš"],
  "primaryCategory": "cs.AI",
  "categories": ["cs.AI", "cs.LG", "cs.SE"],
  "published": "2026-08-05T17:58:15Z",
  "updated": "2026-08-05T17:58:15Z",
  "doi": null,
  "journalRef": null,
  "comment": null,
  "pdfUrl": "https://arxiv.org/pdf/2608.05141v1",
  "absUrl": "https://arxiv.org/abs/2608.05141v1",
  "scrapedAt": "2026-08-06T23:25:50.311Z"
}
```

Note the mismatch already: that record came back from a `cs.LG` query, and its `primaryCategory` is `cs.AI`. Any later filter you write against `primaryCategory` will silently throw away papers you explicitly asked for. Test `categories`, the array.

The REST equivalent, if you would rather not add a dependency:

```bash
curl -X POST "https://api.apify.com/v2/acts/arman-bd~arxiv-papers-scraper/run-sync-get-dataset-items?token=$APIFY_TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"categories":["cs.LG"],"sortBy":"submittedDate","maxResultsPerQuery":6}'
```

The summary lives at `GET /v2/key-value-stores/{storeId}/records/RUN_SUMMARY`, so grab `defaultKeyValueStoreId` from a normal `/runs` call if you need it.

<figure>
  <img src="/assets/img/2026-08-06-weekly-arxiv-digest-keyed-to-lab-authors-fig1.png" alt="Roster-driven digest pipeline" loading="lazy">
  <figcaption>The roster drives query construction and matching; RUN_SUMMARY takes a separate path so a broken run cannot masquerade as a quiet week.</figcaption>
</figure>

## Queries that follow people

The roster is your configuration file. Each member needs an alias list from the start, because you will be adding to it for months.

```js
const roster = [
  { id: 'paul',   names: ['Indraneil Paul'] },
  { id: 'helm',   names: ['Falko Helm'] },
  { id: 'glavas', names: ['Goran Glavaš', 'Goran Glavas'] },
];

const CATEGORIES = ['cs.CL', 'cs.LG', 'cs.AI'];

const input = {
  searchQueries: roster.flatMap((m) => m.names.map((n) => `au:"${n}"`)),
  categories: CATEGORIES,
  fromDate: isoDaysAgo(10),
  sortBy: 'submittedDate',
  maxResultsPerQuery: 50,
};
```

Two things to check on the way back out. `summary.filters` echoes exactly which query list, category list and date floor were applied, so you can assert your input survived the trip rather than assuming it. And `summary.queriesRequested` should equal your query count. If it does not, your fan-out is not what you think it is.

Give `fromDate` a few days of deliberate overlap with your run cadence. Boundary semantics on any date filter are worth exactly zero trust, and overlap costs you nothing once deduplication is in place.

## Names are not identifiers

Fold aggressively before comparing. The sample above is the whole argument: a roster containing `Goran Glavas` will not match the string `Goran Glavaš` under any naive equality, and arXiv will hand you both spellings across a career.

```js
const fold = (s) => s
  .normalize('NFD')
  .replace(/\p{Diacritic}/gu, '')
  .toLowerCase()
  .replace(/[.\-']/g, ' ')
  .replace(/\s+/g, ' ')
  .trim();

const key = (name) => {
  const parts = fold(name).split(' ');
  const last = parts.pop();
  return `${last}|${(parts[0] ?? '')[0] ?? ''}`;
};
// key('Goran Glavaš') === key('G. Glavas') === 'glavas|g'
// key('Indraneil Paul') === key('I. Paul') === 'paul|i'
```

Surname plus first initial absorbs the two variations that actually occur: diacritics and abbreviated forenames. On its own, though, it is far too loose. `zhang|y` will match a substantial fraction of everything in cs.LG.

The fix is the non-obvious part: score the paper, not the author. A paper from the group you are watching almost always carries either two roster members or one roster member inside the group's usual categories. A lone common surname outside those categories is a stranger.

```js
const rosterKeys = new Map();
for (const m of roster) for (const n of m.names) rosterKeys.set(key(n), m.id);

function score(paper) {
  const hits = new Set(
    paper.authors.map(key).map((k) => rosterKeys.get(k)).filter(Boolean),
  );
  const onTopic = paper.categories.some((c) => CATEGORIES.includes(c));
  return { hits: [...hits], confident: hits.size >= 2 || (hits.size === 1 && onTopic) };
}
```

Everything that matches but fails `confident` goes to a review queue, not the bin. That queue is how the alias list grows.

## Deduplicate on the base identifier

An `au:` query does not return this week's work; it returns the matching back catalogue, clipped to `maxResultsPerQuery`. Without state, your Monday email is the same fifty papers every Monday. The version suffix in `arxivId` gives you both halves of what you need.

```js
const parse = (id) => {
  const m = /^(.+?)v(\d+)$/.exec(id);
  return m ? { base: m[1], version: Number(m[2]) } : { base: id, version: 1 };
};
// parse('2608.05141v1')  -> { base: '2608.05141', version: 1 }
// parse('cs/0501001v12') -> { base: 'cs/0501001', version: 12 }

function classify(paper, seen) {
  const { base, version } = parse(paper.arxivId);
  const prev = seen[base];
  if (!prev) return 'new';
  return version > prev.version ? 'revised' : null;
}
```

<figure>
  <img src="/assets/img/2026-08-06-weekly-arxiv-digest-keyed-to-lab-authors-fig2.png" alt="Version-aware identity check" loading="lazy">
  <figcaption>Splitting arxivId into base and version is what separates a genuinely new paper from a revision and from something you already emailed.</figcaption>
</figure>

Store `seen` keyed on `base`. Never key it on the full `arxivId`, or every revision reads as a fresh paper. Independently of your own state, `updated !== published` on a record tells you it is a revision even the first time you meet it, which is worth a marker in the email.

## The email

Group by member, sort by `published` descending, and keep it plain.

```js
const lines = fresh.map((p) => {
  const who = score(p).hits.join(', ');
  const day = p.published.slice(0, 10);
  const rev = p.updated !== p.published ? ' (revised)' : '';
  return `- [${day}] ${p.title}${rev}\n  ${who} · ${p.absUrl}`;
});
```

`comment`, `doi` and `journalRef` are all `null` on the sample, as they are on most fresh preprints. They fill in later, which makes a second schedule worthwhile: the same pipeline with `fromDate` removed and a larger `maxResultsPerQuery`, run monthly, backfills venue and DOI onto papers you already have.

## The failure mode to design for

An empty digest and a broken digest look identical in an inbox. `RUN_SUMMARY` carries `queriesFailed` and a `failures` array precisely so you can tell them apart. The reference run reports `queriesFailed: 0` with `failures: []` and `papersSaved: 6`.

Send the email even when there is nothing to report, with a footer stating queries requested, queries failed and papers saved. A quiet week should be something you have proven, not something you inferred from silence.
