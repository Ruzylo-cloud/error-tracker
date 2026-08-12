export class ErrorTracker {
  private dsn: string;
  
  constructor(dsn: string) { this.dsn = dsn; }
  
  capture(error: Error, context?: Record<string, any>): string {
    const id = Math.random().toString(36);
    console.log(JSON.stringify({
      eventId: id,
      message: error.message,
      stack: error.stack,
      context,
      timestamp: new Date(),
    }));
    return id;
  }
}
