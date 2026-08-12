// Transport interface for pluggable delivery
export interface Transport {
  send(event: CapturedEvent): Promise<void>;
}

// Built-in console transport for logging
export class ConsoleTransport implements Transport {
  async send(event: CapturedEvent): Promise<void> {
    console.log(`[${event.timestamp}] ${event.fingerprint}: ${event.message} (count: ${event.groupCount})`);
  }
}

// Built-in in-memory transport for testing
export class InMemoryTransport implements Transport {
  private events: CapturedEvent[] = [];

  async send(event: CapturedEvent): Promise<void> {
    this.events.push(event);
  }

  getEvents(): CapturedEvent[] {
    return [...this.events];
  }

  clear(): void {
    this.events = [];
  }
}

// Breadcrumb for tracking events leading up to an error
interface Breadcrumb {
  timestamp: Date;
  message: string;
  level?: 'info' | 'warning' | 'error';
}

// Group tracking state
interface ErrorGroup {
  count: number;
  firstSeen: Date;
  lastSeen: Date;
  sample: Error;
}

// Captured event structure
export interface CapturedEvent {
  eventId: string;
  fingerprint: string;
  message: string;
  context?: Record<string, any>;
  breadcrumbs: Breadcrumb[];
  timestamp: Date;
  groupCount: number;
}

export class ErrorTracker {
  private transport: Transport;
  private groups: Map<string, ErrorGroup> = new Map();
  private breadcrumbs: Breadcrumb[] = [];
  private maxBreadcrumbs = 20;
  private rateLimitMap: Map<string, number[]> = new Map();
  private rateLimitPerMinute = 10;

  constructor(transport: Transport = new ConsoleTransport()) {
    this.transport = transport;
  }

  // Add a breadcrumb event
  addBreadcrumb(message: string, level: 'info' | 'warning' | 'error' = 'info'): void {
    this.breadcrumbs.push({ timestamp: new Date(), message, level });
    if (this.breadcrumbs.length > this.maxBreadcrumbs) {
      this.breadcrumbs.shift();
    }
  }

  // Capture an error with optional context
  async capture(error: Error, context?: Record<string, any>): Promise<string> {
    const fingerprint = this.generateFingerprint(error);

    // Check rate limit
    if (!this.checkRateLimit(fingerprint)) {
      const group = this.groups.get(fingerprint);
      if (group) {
        group.count++;
        group.lastSeen = new Date();
      }
      return '';
    }

    // Generate unique event ID
    const eventId = this.generateEventId();

    // Update or create group
    if (this.groups.has(fingerprint)) {
      const group = this.groups.get(fingerprint)!;
      group.count++;
      group.lastSeen = new Date();
    } else {
      this.groups.set(fingerprint, {
        count: 1,
        firstSeen: new Date(),
        lastSeen: new Date(),
        sample: error,
      });
    }

    const group = this.groups.get(fingerprint)!;
    const event: CapturedEvent = {
      eventId,
      fingerprint,
      message: error.message,
      context,
      breadcrumbs: [...this.breadcrumbs],
      timestamp: new Date(),
      groupCount: group.count,
    };

    await this.transport.send(event);
    return eventId;
  }

  // Generate a fingerprint: error type + message + normalized stack frame
  private generateFingerprint(error: Error): string {
    const stack = error.stack || '';
    const lines = stack.split('\n');

    // Extract first meaningful frame (skip "Error:" line)
    let frame = lines[1] || lines[0] || '';

    // Strip absolute paths and line/col numbers for true grouping
    frame = frame
      .replace(/\/.+?\//g, '//')  // Strip dir paths, keep filename
      .replace(/:\d+:\d+/g, ':*:*')  // Strip line:col numbers
      .replace(/at /g, '');

    return `${error.name}:${error.message}:${frame.trim()}`;
  }

  // Check rate limit: max N captures per minute per fingerprint
  private checkRateLimit(fingerprint: string): boolean {
    const now = Date.now();
    const oneMinuteAgo = now - 60 * 1000;

    let timestamps = this.rateLimitMap.get(fingerprint) || [];
    timestamps = timestamps.filter(ts => ts > oneMinuteAgo);

    if (timestamps.length >= this.rateLimitPerMinute) {
      this.rateLimitMap.set(fingerprint, timestamps);
      return false;
    }

    timestamps.push(now);
    this.rateLimitMap.set(fingerprint, timestamps);
    return true;
  }

  // Generate unique event ID
  private generateEventId(): string {
    return Math.random().toString(36).substring(2, 11);
  }

  // Get groups for inspection
  getGroups(): { fingerprint: string; group: ErrorGroup }[] {
    return Array.from(this.groups.entries()).map(([fingerprint, group]) => ({
      fingerprint,
      group,
    }));
  }

  // Set rate limit (for testing)
  setRateLimit(perMinute: number): void {
    this.rateLimitPerMinute = perMinute;
  }
}
