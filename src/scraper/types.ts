import { LoggerOptions } from '../logger/types'

export interface ScraperOptions extends LoggerOptions {
  timeout: number
  userAgent: string
  headless: boolean
  userCookies: UserCookie[]
  optimizeWithAI?: OptimizeWithAIOptions
  onLoggedMessage?: (message: string) => void
}

export interface ScraperUserDefinedOptions extends LoggerOptions {
  /**
   * Set a custom user agent if you like.
   *
   * Default: `Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36`
   */
  userAgent?: string
  /**
   * Use a custom timeout to set the maximum time you want to wait for the scraper
   * to do his job.
   *
   * Default: 10000 (10 seconds)
   */
  timeout?: number
  /**
   * Start the scraper in headless mode, or not.
   *
   * Default: true
   */
  headless?: boolean
  /**
   * You can optimize the results by using OpenAI to find the best job for you: it will be used to read every job title and decide whether it's a good fit for you or not,
   * based on your "ideal job" description.
   *
   * Default: null (no optimization)
   */
  optimizeWithAI?: OptimizeWithAIOptions
  /**
   * You can set custom cookies to be used by the scraper.
   *
   * Defaul: []
   */
  userCookies?: UserCookie[]
}

export type AISupportedLanguage = 'fr' | 'en'
export interface OptimizeWithAIOptions {
  /**
   * The model to use for OpenAI
   *
   * Default: "gpt-4o-mini"
   */
  model?: string
  /**
   * The OpenAI API key
   */
  apiKey: string
  /**
   * In this field, you can describe your ideal job. The scraper will use this description to filter out the jobs that are not a good fit for you.
   * You can describe what you want, but also what you don't want, so that AI can understand your preferences.
   *
   * Max-length: 256 characters
   */
  idealJobDescription: string
  /**
   * The language in which the ideal job description is written.
   */
  language: AISupportedLanguage
}

export interface CreatePageOptions {
  preservePreviousPage?: boolean
}

export interface UserCookie {
  name: string
  value: string
  domain: string
}
