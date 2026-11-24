# Feature Build Playbook

The repeatable process used to ship the buyer **Live reels-swipe + shuffle** feature
([spec doc](https://claude.ai/code/artifact/e271c4dc-8a97-462f-aaf5-547b03bd0b73),
commit `8c42b9c`), written so the same flow can be re-run for any screen-level
feature — e.g. the **Products Page**. Hand this file to a fresh Claude Code
session and tell it which screen to work on.

> The loop: **Orient → Align (spec + locked decisions) → Implement in phases →
> Verify → Land (commit/push)**, with a living spec doc + memory kept in sync.

---

## 0. Orient before touching code

1. **Re-read the target screen and its neighbours** — the screen file, its data
   source (the `fetch*` / react-query hook + key), and the primitives it builds
   on. On a resumed session, files change on disk; re-read, don't trust memory.
2. **Graph first, then grep** (per `CLAUDE.md`): find **entry points** (who
   `navigate`s here), **where the data is produced/ordered**, and existing
   **props/hooks that already do half the work**.
3. **Note the cheap wins.** A primitive that already supports the change shapes
   the whole plan. *Live example:* `VideoLayer` already had `isActive` (pauses
   when false) and `useSocket` already suspended on `streamId: null` — so
   "only the visible page plays + holds a socket" was nearly free.
4. **Check git state**: `git status`, `git log --oneline -6`. Parallel sessions
   run on `v2-live-feat` — never assume the working tree is only yours.

## 1. Align — spec + locked decisions (before building)

1. **Play back your understanding first** — a quick ASCII wireframe or one-screen
   summary. Fixing a diagram is cheaper than fixing code.
2. **Ask only the blocking questions** — surface (mobile / desktop / both)?
   defaults? scope? edge behavior? Decisions that change *what you build*. Don't
   survey everything.
3. **Write a spec as a Claude Doc** (this project keeps specs as docs). The
   section set that worked:
   - Goal & scope (which surface; what's explicitly **out**)
   - Decisions (locked) — a small table
   - Current state (how it works today + the reusable primitives)
   - The design (one block per sub-feature; a mermaid diagram if it shows a real mechanism)
   - Files (new / edit; backend yes/no)
   - Edge cases & details
   - Risks & mitigations
   - Implementation phases (ordered, each independently testable)
   - QA checklist (on device)
   - Out of scope & open questions

## 2. Implement in independently-shippable phases

Order **low-risk first** so value lands even if later phases slip.
*Live order was:* shuffle → extract page → pager → polish.

Three lift-able patterns from this codebase:

- **Extract a heavy screen into a prop-driven, "active-gated" component.**
  Move the body into `components/XPage.tsx` taking `{ data, isActive, isAdjacent, onExit }`.
  Keep the old route as a **thin host** that renders one always-active instance,
  so existing entry points keep working. Gate expensive subsystems (video,
  sockets, network fetches, keyboard listeners) on `isActive` so a list can
  mount many pages but only the visible one is "hot":
  ```tsx
  useSocket({ streamId: isActive ? id : null, /* … */ });          // only active joins
  const shouldLoadVideo = isActive || isAdjacent;                   // pre-warm the neighbour
  useEffect(() => { if (!isActive && !isAdjacent) return; fetchOnce(); }, [id, isActive, isAdjacent]);
  ```

- **Vertical reels pager** (`screens/.../XFeedScreen.tsx`): a paging `FlatList`
  of full-screen items.
  ```tsx
  <FlatList
    data={items}
    extraData={activeIndex}                    // REQUIRED — or rows never re-flip isActive
    getItemLayout={(_, i) => ({ length: pageH, offset: pageH * i, index: i })}
    initialScrollIndex={startIndex}
    pagingEnabled snapToInterval={pageH} decelerationRate="fast" disableIntervalMomentum
    windowSize={3} initialNumToRender={2} maxToRenderPerBatch={2} removeClippedSubviews
    onViewableItemsChanged={onViewRef.current}          // set activeIndex at ~80% visible
    viewabilityConfig={viewCfgRef.current}             // { itemVisiblePercentThreshold: 80 }
    renderItem={({ item, index }) => (
      <View style={{ height: pageH }}>
        <XPage data={item} isActive={index === activeIndex} isAdjacent={Math.abs(index - activeIndex) === 1} onExit={goBack} />
      </View>
    )}
  />
  ```
  Measure `pageH` with `onLayout` and only render the list once `pageH > 0`.
  Paging **can't scroll past the ends**, so "resist at the last item" is free.
  Disable any *nested* vertical scroll inside a page (e.g. chat list
  `scrollEnabled={false}`) so the page-swipe wins the gesture.

- **Seeded shuffle** (`utils/seededShuffle.ts`): shuffle client-side with a seed
  **fixed once per screen mount** (a `useState` initializer) → randomized per
  visit but **stable across the 30s refetch**. Do **not** shuffle in the
  `queryFn`/backend — that re-randomizes on every poll and reorders under the
  user. Pass the *same* shuffled array + tapped index to the pager so grid and
  swipe order match.

## 3. Verify honestly

- `npx tsc --noEmit` after each phase — filter to the touched files, and confirm
  the **total** error count is 0.
- Reload the running dev server (Metro) to confirm the **bundle compiles**; read
  the console for errors. A broken import fails the whole bundle, so a clean boot
  is a real signal.
- When the real screen is unreachable (auth wall, no live data, no device, or the
  Metro port is serving a different app), say plainly **what's verified**
  (compiles / boots) vs **what's pending** (on-device behavior), and build a
  faithful **HTML preview** for layout if useful. Never claim device-verified
  when you couldn't run it.

## 4. Land it (concurrent-session safe)

- **Stage only your files.** For a file that *also* holds another session's
  uncommitted hunks, partial-stage — build a patch of just your hunks and
  `git apply --cached` it; **never `git add -A`**, never sweep other sessions'
  work into your commit.
- The **graphify pre-commit hook** rebuilds the graph over the whole tree and
  takes minutes, so the commit will background — wait for it, don't re-run.
- **Push only after `git fetch` + a fast-forward check** (`git merge-base
  --is-ancestor origin/<branch> HEAD`); never `--force`.
- Keep **memory** and the **spec doc** status in sync (built → committed →
  pushed; note what's still unverified).

## Repo-specific notes (ChingiRingi)

- **Graph first** (`code-review-graph` / `graphify`) before Grep/Glob/Read.
- **Backend response shape:** parse `res.data.data.X` — the axios interceptor
  returns the full response, data is nested under `{status, data:{…}}`.
- **Branch:** work happens on `v2-live-feat` with **parallel sessions** — check
  `git log` before pushing; the user commits/pushes on explicit say-so.
- **No device / iOS sim here; the Android build is broken.** Web checks go
  through Metro *when a free port is serving this app* (it sometimes isn't).
- **Specs → Claude Docs; playbooks/guides → `Docs/`.**

---

## Apply this to the Products Page

Fill these in first (don't assume — grep/graph to confirm):

- **Which file is the Products page?** (search for the Products tab/screen
  component and its route name). There may be separate **mobile** and **desktop**
  paths in one file, as `OfflineStoresScreen` has.
- **Data source**: the `fetch*` function + the react-query key + the backend
  endpoint. What's the **current ordering**?
- **Entry points**: who `navigate`s to Products, and to the product detail?
- **Reusable primitives already present**: product card, grid, category tiles
  (`CategoryTiles`), filters sheet, `getCategoryColor`, etc.
- **The change(s) you actually want** on Products, and the **surface** (mobile /
  desktop / both).

Then run the loop: **spec doc (with locked decisions) → low-risk-first phases →
tsc + bundle verify → concurrent-safe commit → fast-forward push**, updating the
memory and the spec as you go.

### Starter prompt (paste into a fresh session)

> Read `Docs/Feature_Build_Playbook.md` and follow it for the **Products Page**.
> First orient: find the Products screen file(s), its data source (fetch + react-query
> key + backend endpoint), current ordering, entry points, and the reusable
> primitives it already uses — using the knowledge graph first. Then play back your
> understanding and ask me only the blocking decisions (surface, the specific
> change, defaults, scope). Don't write code yet — produce the spec as a Claude Doc.
> The change I want is: **<describe it>**.
