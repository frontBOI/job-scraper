export type SupportedLanguage = 'fr' | 'en'

export interface ScraperOptions {
  country: string
  timeout: number
  cities: string[]
  userAgent: string
  headless: boolean
  searchText: string
  sessionCookieValue: string
  jobTitleBannedWords: string[]
  opportunitiesIdsToSkip: string
  optimizeUsingOpenAI: OpenAIOptimizationOptions | null
}

export interface ScraperUserDefinedOptions {
  /**
   * The LinkedIn `li_at` session cookie value. Get this value by logging in to LinkedIn with the account you want to use for scraping.
   * Open your browser's Dev Tools and find the cookie with the name `li_at`. Use that value here.
   *
   * This script uses a known session cookie of a successful login into LinkedIn, instead of an e-mail and password to set you logged in.
   * I did this because LinkedIn has security measures by blocking login requests from unknown locations or requiring you to fill in Captcha's upon login.
   * So, if you run this from a server and try to login with an e-mail address and password, your login could be blocked.
   * By using a known session, we prevent this from happening and allows you to use this scraper on any server on any location.
   *
   * You probably need to get a new session cookie value when the scraper logs show it's not logged in anymore.
   */
  sessionCookieValue: string
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
   * The country in which you want to search for jobs
   *
   * Default: "France"
   */
  country?: string
  /**
   * The cities in which the CDI will be found
   *
   * Default: []
   */
  cities?: string[]
  /**
   * The text that will be typed in the LinkedIn search bar
   */
  searchText: string
  /**
   * IDs of opportunities you want to skip. This can be because you have already scraped them and don't want to process them again.
   *
   * Default: ""
   */
  opportunitiesIdsToSkip?: string
  /**
   * Elements you wish to filter out from the job title. For example, if you don't want to see job names with "finance" in it, you can add "finance" to this array.
   * Do not hesitate to look around in LinkedIn to find out what words are generally used in job titles, so that you know which one you want to filter
   *
   * Default: []
   */
  jobTitleBannedWords?: string[]
  /**
   * You can optimize the results by using OpenAI to find the best job for you: it will be used to read every job title and decide whether it's a good fit for you or not,
   * based on your "ideal job" description.
   *
   * Default: null (no optimization)
   */
  optimizeUsingOpenAI?: OpenAIOptimizationOptions
  /**
   * This class can work either with Server-Sent Events (SSE) or WebSocket to send real-time updates to a client: this allows the client to display the current state of the
   * scraping process by receiving messages from the server. Use this method to forward scraping logs to a client for example.
   *
   * Default: undefined
   */
  onLoggedMessage?: (message: string) => void
}

export interface OpenAIOptimizationOptions {
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
  language: SupportedLanguage
}

export interface CreatePageOptions {
  preservePreviousPage?: boolean
}

export interface CompleteJob {
  id: string
  name: string
  link: string
  error?: string
  description: string
  validatedByAi?: boolean
}

export type IncompleteJob = Pick<CompleteJob, 'name' | 'id'>

export interface ScraperReturnValue {
  allJobsIds: string[]
  rejectedJobs: CompleteJob[]
  validatedJobs: CompleteJob[]
}
