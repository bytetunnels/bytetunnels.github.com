---
title: "Rank an Anime Season by Favourites, Not by Its Average Score"
description: "averageScore squeezes every title into a ten-point band; favourites/popularity spreads them over an order of magnitude."
date: 2026-08-06 20:00:00 +0000
categories: ["Data Extraction"]
tags: ["anilist", "anime", "data extraction", "data pipelines", "javascript", "sql", "statistics", "api"]
author: arman
image:
  path: /assets/img/2026-08-06-rank-anime-season-by-favourites-not-average-score-hero.jpg
  alt: "Rank an Anime Season by Favourites, Not by Its Average Score"
---

Frieren: Beyond Journey's End has an `averageScore` of 91 and 467,408 people with it on a list, of whom 55,099 marked it a favourite. The 91 tells you almost nothing you didn't already know; the 11.79% tells you something structural, because unlike the score it does not change shape when the audience grows.

`averageScore` is a bounded mean over self-selected raters. People who finish a show are the ones who liked it enough to finish, so the numbers pile up in a narrow band near the top, and the gap between a 91 and an 84 is a handful of points that a few thousand mood-driven votes can move. `favourites / popularity` is a rate: of everyone who touched this title at all, what fraction cared enough to pin it. That ratio is scale-free. A 500k-audience show and a 5k-audience show can be compared directly, and in practice the rate spreads titles across an order of magnitude rather than a ten-point band. That's the axis I want a seasonal watchlist sorted on.

## The run

The data comes from the [AniList Scraper](https://apify.com/arman-bd/anilist-anime-scraper) Actor on Apify. One call, two reads: the dataset for the records, the key-value store for the run's own account of itself.

```js
import { ApifyClient } from 'apify-client';

const client = new ApifyClient({ token: process.env.APIFY_TOKEN });

const run = await client.actor('arman-bd/anilist-anime-scraper').call({
  searchTerms: ['Frieren', 'Vinland Saga'],
  mediaType: 'ANIME',
  maxResults: 6,
});

const { items } = await client.dataset(run.defaultDatasetId).listItems();
const { value: summary } = await client
  .keyValueStore(run.defaultKeyValueStoreId)
  .getRecord('RUN_SUMMARY');

console.log(summary.titlesSaved, items.length); // 6 6
```

That run returned 6 rows in 4.931 seconds. Here is one of them, verbatim except that `description` and a couple of array fields are trimmed with `…`:

```json
{
  "id": 154587,
  "titleRomaji": "Sousou no Frieren",
  "titleEnglish": "Frieren: Beyond Journey’s End",
  "titleNative": "葬送のフリーレン",
  "type": "ANIME", "format": "TV", "status": "FINISHED",
  "episodes": 28, "chapters": null,
  "averageScore": 91, "popularity": 467408, "favourites": 55099,
  "genres": ["Adventure", "Drama", "Fantasy"],
  "tags": ["Travel", "Magic", "Elf"],
  "studios": ["MADHOUSE", "Toho", "Shogakukan"],
  "startDate": "2023-09-29", "endDate": "2024-03-22", "season": "FALL 2023",
  "coverImage": "https://s4.anilist.co/…/bx154587-qQTzQnEJJ3oB.jpg",
  "description": "The adventure is over but life goes on for an elf mage …",
  "scrapedAt": "2026-08-06T23:25:50.243Z"
}
```

The full field set is exactly: `averageScore, chapters, coverImage, description, endDate, episodes, favourites, format, genres, id, popularity, scrapedAt, season, startDate, status, studios, tags, titleEnglish, titleNative, titleRomaji, type`. Everything below is built from those and nothing else.

Prefer not to add a dependency? Here is the raw REST equivalent. This one endpoint runs the Actor and hands back the dataset in a single request:

```bash
curl -s -X POST \
  "https://api.apify.com/v2/acts/arman-bd~anilist-anime-scraper/run-sync-get-dataset-items?token=$APIFY_TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"searchTerms":["Frieren","Vinland Saga"],"mediaType":"ANIME","maxResults":6}' \
  > season.json
```

For an actual season you swap the search terms out. `RUN_SUMMARY.filters` shows the knobs the run understands: `searchTerms`, `mediaType`, `season`, `seasonYear`, `genres`, `maxResults`. So `{"season":"FALL","seasonYear":2023,"mediaType":"ANIME","maxResults":60}` is the shape you want. The summary also reports `apiRequests: 2` against a `rateLimitPerMin` of 30, which is the budget you're pacing against when the term list gets long.

<figure>
  <img src="/assets/img/2026-08-06-rank-anime-season-by-favourites-not-average-score-fig1.png" alt="Run, verify, rank" loading="lazy">
  <figcaption>The RUN_SUMMARY read is a gate, not a log line: a ranking built on a partial dataset looks perfectly plausible, so the completeness check has to run before the ranker does.</figcaption>
</figure>

## Read the summary before you trust the ranking

A ranking computed over a partial pull is worse than no ranking, because it looks fine. `RUN_SUMMARY` exists to stop that, and it is two lines of guard:

```js
if (summary.sourcesFailed > 0) {
  throw new Error(`incomplete pull: ${JSON.stringify(summary.failures)}`);
}
const byId = new Map(items.map((t) => [t.id, t]));
const titles = [...byId.values()];
```

The dedupe matters more than it looks. `titlesPerSource` for this run was `{ "Frieren": 3, "Vinland Saga": 3 }`. Separate search terms that happen to surface the same title give you the same `id` twice, and a duplicate row quietly double-weights a studio in any aggregate you build later.

## The rate is scale-free; it is not noise-free

Here's the part that catches people. `favourites / popularity` is a Bernoulli rate with `n = popularity`, so its sampling error scales with `1/√n`. Sort a season by the raw rate and the top of your list will be small, obscure titles whose 40-out-of-150 is mostly luck. The fix is to rank on the lower bound of the interval instead of the point estimate, which penalises small denominators automatically:

```js
function wilsonLower(successes, n, z = 1.96) {
  if (!n) return 0;
  const p = successes / n;
  const z2 = z * z;
  return (p + z2 / (2 * n) - z * Math.sqrt((p * (1 - p) + z2 / (4 * n)) / n))
    / (1 + z2 / n);
}

const devotion = (t) => wilsonLower(t.favourites ?? 0, t.popularity ?? 0);
```

For Frieren, `n` is 467,408 and the correction is invisible: 11.788% point estimate, 11.696% lower bound. For a title with 90 favourites out of 300 list entries the same function turns 30% into 25.1%. The shrinkage is entirely proportional to how little you know. One function, no tuning parameter beyond `z`, and the small-`n` problem stops existing.

## The other bias is time

`popularity` counts everyone with the title on a list, including plan-to-watch. A show that is still airing accumulates those entries before anyone has had the chance to fall in love with it, so its denominator runs ahead of its numerator and its devotion rate is structurally depressed. Rank a currently-broadcasting season against finished ones and you will conclude, wrongly, that nothing good is airing.

So gate on `status`, and if you're comparing across years, be aware you're still comparing titles with different amounts of time to accrue favourites:

```js
const ranked = titles
  .filter((t) => t.status === 'FINISHED' && (t.popularity ?? 0) >= 1000)
  .map((t) => ({ ...t, devotion: devotion(t) }))
  .sort((a, b) => b.devotion - a.devotion);
```

The sample record passes both gates: `status: "FINISHED"`, and a devotion of 0.1170 that would be a strong showing in any season.

<figure>
  <img src="/assets/img/2026-08-06-rank-anime-season-by-favourites-not-average-score-fig2.png" alt="One rate, two league tables" loading="lazy">
  <figcaption>Title-level and aggregate rankings share the same rate computation, but the aggregate path pools favourites and popularity before dividing. Averaging per-title rates would weight a 300-viewer show like a 300,000-viewer one.</figcaption>
</figure>

## From a ranking to a watchlist

A ranking isn't a watchlist until it respects the thing you're actually short of, which is evenings. `episodes` is in the record (28 for Frieren, roughly eleven hours at 23 minutes each), so a greedy fill under an episode budget converts the ordering into a plan. `episodes` is null for titles that haven't finished. That's another reason the status filter comes first.

```js
let used = 0;
const plan = [];
for (const t of ranked) {
  if (!t.episodes || used + t.episodes > 120) continue;
  plan.push(`${t.titleEnglish ?? t.titleRomaji} · ${t.episodes} eps, ` +
    `${(t.devotion * 100).toFixed(1)}% devotion, score ${t.averageScore}`);
  used += t.episodes;
}
```

Keep `averageScore` in the output line even though you didn't sort on it. The rows where the two disagree most sharply are the interesting ones: a high score with a low devotion rate is competent and forgettable, and the reverse is a title with a small, serious audience that the mean has flattened.

The same machinery aggregates. Pool the raw counts before dividing, because summing per-title rates weights a 300-viewer title the same as a 300,000-viewer one:

```sql
SELECT s AS studio,
       SUM(favourites) AS fav,
       SUM(popularity) AS pop,
       SUM(favourites)::DOUBLE / SUM(popularity) AS devotion
FROM 'season.json', UNNEST(studios) AS u(s)
WHERE status = 'FINISHED'
GROUP BY s HAVING SUM(popularity) > 50000
ORDER BY devotion DESC;
```

Swap `studios` for `genres` or `tags` and you get a genre league table off the same three fields.

The trap to avoid is the one that makes this look easy: `favourites / popularity` is only comparable across titles that have had comparable time and comparable exposure. Filter to `status = 'FINISHED'`, hold `season` and `seasonYear` fixed when you can, rank on the lower bound rather than the rate, and re-pull rather than reuse. `scrapedAt` is in every record precisely so you can tell how stale your denominators are.
