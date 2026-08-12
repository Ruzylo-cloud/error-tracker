# error-tracker

Error capture with automatic grouping, rate limiting, and breadcrumb history. Identical logical errors (same message + normalized stack frame) are grouped together regardless of where they occur.

## Quickstart

```typescript
import { ErrorTracker, ConsoleTransport } from 'error-tracker';

const tracker = new ErrorTracker(new ConsoleTransport());

tracker.addBreadcrumb('User clicked button');
tracker.addBreadcrumb('API request started');

try {
  throw new Error('Connection timeout');
} catch (e) {
  await tracker.capture(e as Error, { userId: 123 });
}
```

## API

### Constructor

```typescript
new ErrorTracker(transport?: Transport)
```

Default: ConsoleTransport (logs to console)

### Methods

#### `capture(error, context?)`

```typescript
await tracker.capture(error, { userId: 123, endpoint: '/api/foo' })
```

Returns event ID (empty string if rate-limited). Captures error with fingerprint-based grouping. Identical errors group together.

#### `addBreadcrumb(message, level?)`

```typescript
tracker.addBreadcrumb('user clicked save', 'info');
tracker.addBreadcrumb('payment failed', 'error');
```

Adds event to breadcrumb history (last 20 events, auto-FIFO). Breadcrumbs attached to next capture.

#### `getGroups()`

```typescript
const groups = tracker.getGroups();
// [{ fingerprint: 'Error:/*/:*:*', group: { count: 5, firstSeen, lastSeen, sample } }, ...]
```

#### `setRateLimit(perMinute)`

```typescript
tracker.setRateLimit(5); // Max 5 captures per minute per fingerprint
```

### Transports

**ConsoleTransport** — Logs to console (default)

**InMemoryTransport** — Stores events in-memory for testing
```typescript
const mem = new InMemoryTransport();
const tracker = new ErrorTracker(mem);
await tracker.capture(new Error('test'));
console.log(mem.getEvents()); // [CapturedEvent]
mem.clear();
```

**Custom Transport** — Implement the `Transport` interface
```typescript
class MyTransport implements Transport {
  async send(event: CapturedEvent): Promise<void> {
    await fetch('/api/errors', { method: 'POST', body: JSON.stringify(event) });
  }
}
```

## Grouping

Fingerprint = error name + normalized top stack frame:
- Absolute paths → `/*`
- Line:col numbers → `:*:*`

So errors with same message and caller (even different line numbers) group together.

## Scope & Limits

- **Grouping only** — no distributed tracing; breadcrumbs are local ring buffer (20 events)
- **Rate limiting per fingerprint** — default 10 captures/min; stops new frames of same error after limit
- **No persistence** — in-memory only; restart clears groups
- **No dependency on external services** — zero runtime deps
- **Synchronous grouping, async sending** — send to transport is awaited but doesn't block grouping

## Example

```typescript
const tracker = new ErrorTracker(new ConsoleTransport());
tracker.setRateLimit(3);

// These three errors have same fingerprint (same caller)
const err = new Error('timeout');
await tracker.capture(err);  // eventId returned
await tracker.capture(err);  // eventId returned
await tracker.capture(err);  // eventId returned
await tracker.capture(err);  // '' (rate limited, but group.count increases)

const groups = tracker.getGroups();
console.log(groups[0].group.count); // 4
```

## License

MIT

---

Sponsored by [Ferrow](https://ferrow.ai)

---
Part of the [ferrow-toolkit](https://github.com/FerrowAI/ferrow-toolkit) collection · Sponsored by [Ferrow](https://ferrow.ai)
