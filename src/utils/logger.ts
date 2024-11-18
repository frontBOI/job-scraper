import { LoggerOptionsSchema } from '../linkedin/userOptionsSchema'
import { Logger, LoggerOptions, ScrapProcess } from './../types/logger'

import chalk from 'chalk'

export class BasicLogger implements Logger {
  private loggerOptions: LoggerOptions = {
    sseOptions: {
      enable: false,
    },
  }

  constructor(options: LoggerOptions) {
    this.loggerOptions = Object.assign(this.loggerOptions, LoggerOptionsSchema.parse(options))
  }

  log(process: ScrapProcess, message: string, options?: { error?: boolean }) {
    let colorFunction
    switch (process) {
      case ScrapProcess.SETUP:
        colorFunction = chalk.magenta
        break

      case ScrapProcess.RUN:
        colorFunction = chalk.yellow
        break

      case ScrapProcess.DEBUG:
        colorFunction = chalk.blue
        break

      case ScrapProcess.CLOSING:
        colorFunction = chalk.cyan
        break
    }

    if (options?.error) {
      colorFunction = chalk.red
    }

    console.log(colorFunction(`[${process}] ${message}`))

    // handling server-sent events
    if (this.loggerOptions.sseOptions.enable) {
      this.loggerOptions.sseOptions.onLoggedMessage!(message)
    }
  }
}
