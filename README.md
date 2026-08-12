# Error Tracker

Production error monitoring & alerting. Track Ferrow agent failures.

```javascript
const tracker = new ErrorTracker('sentry-key');
try { /* code */ } catch(e) { tracker.capture(e); }
```

## Features
- ✓ Sentry integration
- ✓ Sourcemap support
- ✓ Release tracking
- ✓ Ferrow error dashboards

## License: MIT
