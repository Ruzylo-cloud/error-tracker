// Compile TS first: tsc
const { ErrorTracker, InMemoryTransport } = require('../dist/index.js');

async function demo() {
  const mem = new InMemoryTransport();
  const tracker = new ErrorTracker(mem);
  tracker.setRateLimit(3);

  // Add some breadcrumbs
  tracker.addBreadcrumb('User logged in', 'info');
  tracker.addBreadcrumb('API request started', 'info');

  // Demo 1: Same error from different line numbers groups together
  console.log('=== Demo 1: Grouping same error ===');
  const err = new Error('Connection timeout');

  await tracker.capture(err, { endpoint: '/users' });
  await tracker.capture(err, { endpoint: '/posts' });
  await tracker.capture(err, { endpoint: '/comments' });

  let groups = tracker.getGroups();
  console.log(`Groups count: ${groups.length}, First group count: ${groups[0].group.count}`);

  // Demo 2: Rate limiting kicks in
  console.log('\n=== Demo 2: Rate limiting ===');
  const id4 = await tracker.capture(err);  // 4th attempt
  const id5 = await tracker.capture(err);  // 5th attempt (rate limited)

  console.log(`Event 4 ID: ${id4 ? 'captured' : 'rate-limited'}`);
  console.log(`Event 5 ID: ${id5 ? 'captured' : 'rate-limited'}`);

  groups = tracker.getGroups();
  console.log(`Group count after rate limiting: ${groups[0].group.count}`);

  // Demo 3: Different error = different group
  console.log('\n=== Demo 3: Different errors ===');
  const dbErr = new Error('Database connection failed');
  const dbId = await tracker.capture(dbErr);
  console.log(`Database error captured: ${dbId ? 'yes (ID: ' + dbId + ')' : 'no (rate-limited)'}`);

  groups = tracker.getGroups();
  console.log(`Total groups: ${groups.length}`);
  groups.forEach((g, i) => {
    console.log(`  Group ${i + 1}: ${g.fingerprint.substring(0, 40)}... (count: ${g.group.count})`);
  });

  // Show in-memory events
  const events = mem.getEvents();
  console.log(`\nTotal events sent to transport: ${events.length}`);
  console.log(`First event has ${events[0].breadcrumbs.length} breadcrumbs attached`);
}

demo().catch(console.error);
