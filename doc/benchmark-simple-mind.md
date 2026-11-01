# Benchmark report

Regenerate with `node scripts/benchmark.mjs`. Stages run 3 times and the median is kept.
Parse, layout, and paths run in Node with synthetic node sizes; the two render columns are the
jsdom DOM-mount cost of the keyed update, so they measure our JavaScript work rather than browser
layout and paint.

| Nodes | Parse | Layout | Paths | First render | Incremental render | Serialize |
| --- | --- | --- | --- | --- | --- | --- |
| 100 | 0.1 ms | 0.2 ms | 0.1 ms (4k chars) | 68.1 ms | 22.8 ms | 0.1 ms |
| 500 | 0.3 ms | 0.3 ms | 0.2 ms (21k chars) | 232.4 ms | 99.3 ms | 0.1 ms |
| 1000 | 0.4 ms | 0.6 ms | 0.3 ms (42k chars) | 442.3 ms | 186.0 ms | 0.3 ms |

Environment: Node v24.20.0, win32.

## Budgets

- A single edit stays under 100 ms on desktop. The incremental render column is the closest
  automated proxy for it.
- First render of 1,000 nodes stays within one interaction of the initial fit.

<!-- manual-results -->
## Real browser check

Recorded on 2026-11-02 in the Chromium canvas that hosts `MapCanvas`, timing `setSource` followed by a
forced layout flush over the same synthetic outlines.

| Nodes | First render | Re-render with one label changed |
| --- | --- | --- |
| 100 | 19.0 ms | 5.0 ms |
| 500 | 94.1 ms | 16.8 ms |
| 1,000 | 186.2 ms | 33.3 ms |

An edit at 1,000 nodes costs 33 ms, so the 100 ms budget holds with room to spare. First render is
dominated by per-label measurement: a re-render over identical labels costs about a fifth of it
because the measurement cache absorbs that work.

Culling was checked at 2,000 nodes, above the 1,200 threshold: 273 node elements stayed mounted for
the viewport plus its margin, first render took 266.3 ms, and switching back to a one-node map left
exactly one element mounted, so culled nodes are removed rather than hidden.

Next lever: batch label measurement so the browser performs one layout pass per render instead of one
per measured label.
