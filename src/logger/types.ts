export enum ScrapProcess {
  RUN = 'Run',
  DEBUG = 'Debug',
  CLOSING = 'Closing',
  SETUP = 'Setup',
}

export interface LoggerOptions {
  /**
   * This logger can work either with Server-Sent Events (SSE) or WebSocket to send real-time updates to a client: this allows the client to display the current state of the
   * scraping process by receiving messages from the server. Use this method to forward scraping logs to a client for example.
   *
   * Default: undefined
   */
  onLoggedMessage?: (message: string) => void
}

export interface Logger {
  log(process: ScrapProcess, message: string, options?: { error?: boolean })
}
