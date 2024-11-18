export enum ScrapProcess {
  RUN = 'Run',
  DEBUG = 'Debug',
  CLOSING = 'Closing',
  SETUP = 'Setup',
}

export interface LoggerOptions {
  sseOptions: ServerSideEventsOptions
}

export interface ServerSideEventsOptions {
  enable: boolean
  onLoggedMessage?: (message: string) => void
}

export interface Logger {
  log(process: ScrapProcess, message: string, options?: { error?: boolean })
}
