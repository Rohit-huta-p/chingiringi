# Product Search — Design

Date: 2026-08-15
Status: Approved, ready for implementation planning

## Problem

Two failures, one user journey.

**In-catalog search barely works.** `getProducts` matches with MongoDB `$text`
(`productController.js:30`) against the text index on `{name, description, category}`
(`productModel.js:112`). A `$text` index matches whole words only, with no typo
tolerance and no relevance ranking applied. Concretely:

- `"headph"` returns 0 results. There is no prefix matching.
- `"bluetoth"` returns 0 results. There is no fuzzy matching.
- A description-only match outranks a name match, because the pipeline always
  sorts by `newest`/`price` and never reads `textScore`.

**Zero results is a dead end.** The results screen renders "No products found"
(`CategoryProductsScreen.tsx:139`) and the user leaves. With a startup-sized
catalog this is the *common* path, not the edge case — the catalog size becomes
a hard ceiling on how useful search can ever be.

## Goals

1. Searches that should match, match — typos, partial words, sensible ranking.
2. A zero-result search ends in a useful action instead of a dead end.
3. Every search feeds a signal telling admin what to stock next.

## Non-goals

Personalized or embedding-based ranking, a separate search service, and any
cashback promise on off-catalog purchases. See Deferred.

## Existing assets this builds on

- `subidBuilder.js` already rewrites subids per merchant (amazon, flipkart,
  myntra, meesho, ajio, nykaa) and wraps Cuelinks. A merchant *search-results*
  URL is just a URL — the same click-log and commission plumbing applies.
- `logClick` already accepts an explicit `url` override (`clickController.js:36`),
  so fallback clicks need no new click infrastructure.
- MongoDB is Atlas (`mongodb+srv://`), so Atlas Search is available without
  adding a service. Works on shared tiers (M0 allows 3 search indexes).

---

## 1. Engine — Atlas Search replaces `$text`

### Index definition

Atlas Search index named `products` on the `products` collection:

| Field | Types |
|---|---|
| `name` | `autocomplete` (edgeGram, minGrams 2, maxGrams 15) **and** `string` |
| `description` | `string` |
| `category` | `string` |
| `merchant` | `string` |

The index is created in Atlas (UI or Admin API), **not** via a mongoose
`schema.index()` call. Mongoose cannot declare Atlas Search indexes. This makes
index creation a **deploy gate**: the index must exist in the target cluster
before the new query code ships, or every search returns an error.

The existing `$text` index on `{name, description, category}` is **kept, not
dropped**. It costs almost nothing and it is the degradation path in Error
handling below: if the Atlas index is missing or `$search` errors, the query
falls back to `$text` and search gets worse rather than breaking.

### Query

`compound.should` with `minimumShouldMatch: 1`:

| Clause | Path | Fuzzy | Boost | Fixes |
|---|---|---|---|---|
| `autocomplete` | `name` | maxEdits 1 | 5 | `"headph"` → Headphones |
| `text` | `name` | maxEdits 2 | 3 | `"bluetoth"` → Bluetooth |
| `text` | `description`, `category`, `merchant` | maxEdits 1 | 1 | broad recall |

The boost ladder is what makes a name match outrank a description match.

### Pipeline order

Atlas requires `$search` to be the **first** stage. The current pipeline
(`productController.js:65`) starts with `$match`, so the order inverts:

```
$search            — only when `search` is present; omitted entirely otherwise
$match             — isActive, category, price, coinsPrice, rating
$addFields         — _discount (unchanged), plus _score: { $meta: 'searchScore' }
$match             — minDiscount (unchanged)
$sort              — see below
$facet             — products + total (unchanged)
```

When `search` is absent the pipeline is exactly what exists today.

### Sort

Relevance becomes the default *only* when searching and the user has not chosen
a sort. If the client sends an explicit `sort`, the existing `SORT` map wins.
Since Atlas returns documents in descending score order, "sort by relevance"
means omitting the `$sort` stage, not adding one.

### Admin list is deliberately unchanged

`getAllProductsAdmin` (`productController.js:233`) keeps its `$regex` `$or`.
This is a different job: admin needs infix matching ("find the one with 'v2' in
the name") across inactive rows, on 20-row pages. Regex serves that better than
relevance ranking. The apparent inconsistency is intentional.

### Testability

Atlas Search cannot run under an in-memory Mongo, so the query construction is
extracted as a pure function:

```js
buildSearchPipeline({ search, category, filters, sort, page, limit }) → stage[]
```

`getProducts` becomes a thin caller. The pure function is unit-tested
exhaustively; one smoke test runs against a real cluster.

---

## 2. Search-as-you-type

Debounce the existing search input (`MobileHomeScreen.tsx:292`) at 250ms and
refetch, so the results grid updates live.

No suggest endpoint and no dropdown component. The catalog is small and Atlas
latency is single-digit milliseconds, so a live-updating grid is both better UX
and a fraction of the code of an autocomplete dropdown.

---

## 3. Zero-result cascade

When a search returns `total === 0`, the results screen shows three layers in
order.

**Layer 1 — Near-misses.** Re-run the same `$search` with the *filters* dropped
(price, coins, rating, discount, category). Header: "No exact match — closest in
store". This exists because the filter is frequently the real cause of the empty
result, not the catalog.

This runs **server-side inside the same request**, not as a second client call:
when `total === 0` and a search term was given, `getProducts` runs the unfiltered
search and returns up to 6 results as `data.nearMisses`. One round trip, and the
client never has to know the re-query rules.

**Layer 2 — Merchant fallback chips.** Amazon, Flipkart, Myntra, Meesho. Copy is
*"Not stocked yet — search Amazon →"*.

**No cashback is promised.** Amazon reports give totals with no per-order sub-tag,
so per-user cashback is reconciled by hand today. Promising cashback across the
entire off-catalog long tail would be an unbounded manual liability. The click is
still logged with a subid, so the affiliate commission is earned and the data is
captured for a later upgrade to real cashback.

**Layer 3 — Demand log.** Silent, server-side. See section 5.

**The merchant strip also renders at the bottom of every search results page**,
not only empty ones. This avoids a tuning threshold, and a 2-result page is
nearly as much of a dead end as a 0-result one.

---

## 4. Merchant search URLs — built server-side

A `MERCHANT_SEARCH_URL` map lives next to `subidBuilder.js`:

```js
amazon:   (q) => `https://www.amazon.in/s?k=${encodeURIComponent(q)}`
flipkart: (q) => `https://www.flipkart.com/search?q=${encodeURIComponent(q)}`
myntra:   (q) => `https://www.myntra.com/${slug(q)}?rawQuery=${encodeURIComponent(q)}`
meesho:   (q) => `https://www.meesho.com/search?q=${encodeURIComponent(q)}`
```

`slug(q)` is Myntra-specific: lowercase, strip characters outside `[a-z0-9 ]`,
collapse whitespace, join with `-`. Myntra's search path is a slug segment with
the raw query carried in `rawQuery`.

`logClick` accepts `{ merchant, searchQuery }` in addition to its existing inputs,
builds the URL from the map, and then runs the **existing, unmodified** prep
pipeline: Amazon tag → Cuelinks wrap → subid append. The click row records
`source: 'search_fallback'` and the `searchQuery`.

The chip list itself (which four merchants, their labels and icons) stays in the
app. URLs live on the server.

**Why the split:** the app ships via EAS. A merchant that changes its search URL
format is a Render deploy to fix if the URL is server-side, and an app store
release if it is not. Adding a *new* merchant is rare and can wait for a release;
a *broken* URL cannot.

### Cuelinks wrapping for fallback clicks

Today Cuelinks wrapping is gated on `dealDoc.viaCuelinks` (`clickController.js:74`).
Fallback clicks have no deal, so under the current gate a Flipkart, Myntra, or
Meesho fallback would earn **nothing** — those merchants have no direct affiliate
tag in the system; Cuelinks is the entire revenue path for them.

Therefore: fallback clicks to non-Amazon merchants are Cuelinks-wrapped whenever
`settings.cuelinksPublisherId` is set. Amazon is excluded because it monetizes
directly through the associate tag.

---

## 5. Demand log

New collection, one document per normalized query:

```js
SearchQuery {
  q: String,               // lowercased, trimmed, whitespace-collapsed; unique index
  count: Number,           // $inc on every search
  lastResultCount: Number, // 0 marks a true miss
  lastSeenAt: Date,
}
```

Upserted from `getProducts` whenever `search` is present. Fire-and-forget with
`.catch(() => {})` — a logging failure must never turn a working search into a 500.

Every search is logged, not only misses. Knowing which queries succeed *and* are
popular is as useful as knowing which fail; `lastResultCount` separates them.

`q` is normalized before storage so `"Bluetooth "`, `"bluetooth"`, and
`"Bluetooth"` collapse into one row. No user IDs are stored — the aggregate is
the whole point, and per-user search history is a privacy liability with no use here.

**Admin surface:** a new "Search" section in `ADMIN_NAV_ITEMS`
(`MobileAdminNav.tsx:16`) listing queries sorted by `count` desc, with a filter
for `lastResultCount === 0` ("searched, not stocked").

---

## 6. Deferred

| Deferred | Add when |
|---|---|
| Synonyms (`mobile`→phone, `chappal`→sandals) | the demand log surfaces real name-mismatch pairs — it tells you *which* synonyms are needed, so building it first is guesswork |
| "Notify me when added" | restock latency drops below ~a week; a notification three weeks late reads as spam, and the demand log already gives admin the same intel with no promise attached |
| Cashback on fallback purchases | per-order attribution exists (Cuelinks per-order reporting, or click-log matching) |
| Embedding / personalized ranking | catalog is far too small for either to beat lexical search |

---

## Error handling

| Failure | Behavior |
|---|---|
| Atlas index missing or `$search` errors | Log the error; fall back to the current `$text` query so search degrades rather than 500s |
| Demand-log upsert fails | Swallowed; search response is unaffected |
| Unknown `merchant` sent to `logClick` | 400; no click row written |
| Empty or whitespace-only `searchQuery` on a fallback click | 400; no merchant URL is constructed |
| Near-miss re-query returns nothing | Layer 1 is omitted; merchant chips still render |

## Testing

**Pure unit tests** on `buildSearchPipeline` — the bulk of the coverage:
- `$search` is stage 0 when `search` is present, and absent entirely when it is not
- filters land in the `$match` *after* `$search`, never before it
- explicit `sort` produces a `$sort` stage; default sort with a search produces none
- fuzzy config and boosts match the table in section 1

**Integration:**
- one smoke test against a real Atlas cluster: `"bluetoth"` finds Bluetooth,
  `"headph"` finds Headphones, a name match outranks a description-only match
- demand log: same query twice → one row, `count === 2`
- filters + search combined return the intersection, not the union

**Click path:**
- `{ merchant: 'amazon', searchQuery }` produces a tagged URL carrying `ascsubtag`
- `{ merchant: 'flipkart', searchQuery }` with a publisher ID set produces a
  Cuelinks-wrapped URL
- unknown merchant → 400
