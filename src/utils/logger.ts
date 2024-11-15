import chalk from 'chalk'

export enum ScrapProcess {
  RUN = 'Run',
  DEBUG = 'Debug',
  CLOSING = 'Closing',
  SETUP = 'Setup',
}

export function log(process: ScrapProcess, message: string, error?: boolean) {
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

  if (error) {
    colorFunction = chalk.red
  }

  console.log(colorFunction(`[${process}] ${message}`))
}
