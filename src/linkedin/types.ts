import { ScraperOptions, ScraperUserDefinedOptions } from '../scraper/types'

export interface LinkedInScraperOptions extends ScraperOptions {
  country: string
  cities: string[]
  searchText: string
  sessionCookieValue: string
  jobTitleBannedWords: string[]
  opportunitiesIdsToSkip: string
}

export interface LinkedInScraperUserDefinedOptions extends ScraperUserDefinedOptions {
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
