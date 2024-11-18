import { OpenAIWizard } from '../openai/OpenAIWizard'
import {
  CompleteJob,
  CreatePageOptions,
  IncompleteJob,
  ScraperOptions,
  ScraperReturnValue,
  ScraperUserDefinedOptions,
} from '../types/linkedin-scraper'
import { log, ScrapProcess } from '../utils/logger'
import {
  clearInput,
  clickOnCheckboxByLabel,
  clickOnNextPageButton,
  generateAIQuestion_jobDescription,
  generateAIQuestion_jobName,
  scrollToBottom,
  wait,
} from '../utils/utils'
import blockedHostsList from './blocked-hosts'
import { SessionExpired } from './errors'
import { getHostname } from './utils'

import _ from 'lodash'
import puppeteer, { Browser, Page } from 'puppeteer'
import treeKill from 'tree-kill'

/**
 * Un scraper utilisé pour trouver des offres d'empooi sur LinkedIn, à la base pour ma jeune copine Aude Lejeune.
 * Fortement inspiré de: https://github.com/josephlimtech/linkedin-profile-scraper-api/tree/master
 */
export default class LinkedInJobScraper {
  private LINKEDIN_URL = 'https://www.linkedin.com'
  readonly options: ScraperOptions = {
    cities: [],
    searchText: '',
    timeout: 10000,
    headless: true,
    country: 'France',
    sessionCookieValue: '',
    jobTitleBannedWords: [],
    optimizeUsingOpenAI: null,
    opportunitiesIdsToSkip: '',
    userAgent:
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36',
  }

  private browser: Browser | null = null
  private aiWizard: OpenAIWizard | null = null

  constructor(userDefinedOptions: ScraperUserDefinedOptions) {
    const errorPrefix = 'Error during setup.'

    if (!userDefinedOptions.sessionCookieValue) {
      throw new Error(`${errorPrefix} Option "sessionCookieValue" is required.`)
    }
    if (userDefinedOptions.sessionCookieValue && typeof userDefinedOptions.sessionCookieValue !== 'string') {
      throw new Error(`${errorPrefix} Option "sessionCookieValue" needs to be a string.`)
    }
    if (userDefinedOptions.userAgent && typeof userDefinedOptions.userAgent !== 'string') {
      throw new Error(`${errorPrefix} Option "userAgent" needs to be a string.`)
    }
    if (userDefinedOptions.timeout !== undefined && typeof userDefinedOptions.timeout !== 'number') {
      throw new Error(`${errorPrefix} Option "timeout" needs to be a number.`)
    }
    if (userDefinedOptions.headless !== undefined && typeof userDefinedOptions.headless !== 'boolean') {
      throw new Error(`${errorPrefix} Option "headless" needs to be a boolean.`)
    }
    if (
      userDefinedOptions.optimizeUsingOpenAI &&
      userDefinedOptions.optimizeUsingOpenAI.idealJobDescription.length > 256
    ) {
      throw new Error(`${errorPrefix} Your ideal job description is too long. Max 256 characters.`)
    }

    this.options = Object.assign(this.options, userDefinedOptions)
    log(ScrapProcess.SETUP, `Scraper options: ${JSON.stringify(this.options)}`)

    // mise en place de l'IA
    if (!this.options.optimizeUsingOpenAI) {
      log(ScrapProcess.SETUP, 'Skipping AI filtering')
    } else {
      this.aiWizard = new OpenAIWizard({
        apiKey: this.options.optimizeUsingOpenAI.apiKey,
        model: this.options.optimizeUsingOpenAI.model,
      })
    }
  }

  /**
   * Method to load Puppeteer in memory so we can re-use the browser instance.
   */
  private async setup() {
    try {
      log(ScrapProcess.SETUP, `Launching puppeteer in the ${this.options.headless ? 'background' : 'foreground'}...`)

      this.browser = await puppeteer.launch({
        headless: this.options.headless,
        args: [
          // ...(this.options.headless ? '--single-process' : '--start-maximized'),
          '--no-sandbox',
          '--disable-setuid-sandbox',
          "--proxy-server='direct://",
          '--proxy-bypass-list=*',
          '--disable-dev-shm-usage',
          '--disable-accelerated-2d-canvas',
          '--disable-gpu',
          '--disable-features=site-per-process',
          '--enable-features=NetworkService',
          '--allow-running-insecure-content',
          '--enable-automation',
          '--disable-background-timer-throttling',
          '--disable-backgrounding-occluded-windows',
          '--disable-renderer-backgrounding',
          '--disable-web-security',
          '--autoplay-policy=user-gesture-required',
          '--disable-background-networking',
          '--disable-breakpad',
          '--disable-client-side-phishing-detection',
          '--disable-component-update',
          '--disable-default-apps',
          '--disable-domain-reliability',
          '--disable-extensions',
          '--disable-features=AudioServiceOutOfProcess',
          '--disable-hang-monitor',
          '--disable-ipc-flooding-protection',
          '--disable-notifications',
          '--disable-offer-store-unmasked-wallet-cards',
          '--disable-popup-blocking',
          '--disable-print-preview',
          '--disable-prompt-on-repost',
          '--disable-speech-api',
          '--disable-sync',
          '--disk-cache-size=33554432',
          '--hide-scrollbars',
          '--ignore-gpu-blacklist',
          '--metrics-recording-only',
          '--mute-audio',
          '--no-default-browser-check',
          '--no-first-run',
          '--no-pings',
          '--no-zygote',
          '--password-store=basic',
          '--use-gl=swiftshader',
          '--use-mock-keychain',
        ],
        timeout: this.options.timeout,
      })

      log(ScrapProcess.SETUP, 'Puppeteer launched!')

      await this.checkIfLoggedIn()

      log(ScrapProcess.SETUP, 'Logged in !')
    } catch (err: any) {
      log(ScrapProcess.SETUP, `An error occurred during setup: ${err.message}`, true)
      await this.close() // Kill Puppeteer
    }
  }

  /**
   * Create a Puppeteer page with some extra settings to speed up the crawling process.
   */
  private async createPage(options?: CreatePageOptions): Promise<Page> {
    const defaultOptions: CreatePageOptions = {
      preservePreviousPage: false,
    }

    options = Object.assign(defaultOptions, options)

    if (!this.browser) {
      throw new Error('Browser not set.')
    }

    // Important: Do not block "stylesheet", makes the crawler not work for LinkedIn
    const blockedResources = ['image', 'media', 'font', 'texttrack', 'object', 'beacon', 'csp_report', 'imageset']

    try {
      const page = await this.browser.newPage()

      // Use already open page
      // This makes sure we don't have an extra open tab consuming memory
      if (!options.preservePreviousPage) {
        const firstPage = (await this.browser.pages())[0]
        await firstPage.close()
      }

      // A list of hostnames that are trackers
      // By blocking those requests we can speed up the crawling
      // This is kinda what a normal adblocker does, but really simple
      const blockedHosts = this.getBlockedHosts()
      const blockedResourcesByHost = ['script', 'xhr', 'fetch', 'document']

      // Block loading of resources, like images and css, we dont need that
      await page.setRequestInterception(true)

      page.on('request', req => {
        if (blockedResources.includes(req.resourceType())) {
          return req.abort()
        }

        const hostname = getHostname(req.url())

        // Block all script requests from certain host names
        if (blockedResourcesByHost.includes(req.resourceType()) && hostname && blockedHosts[hostname] === true) {
          return req.abort()
        }

        return req.continue()
      })

      await page.setUserAgent(this.options.userAgent)

      await page.setViewport({
        width: 1200,
        height: 720,
      })

      await page.setCookie({
        name: 'li_at',
        value: this.options.sessionCookieValue,
        domain: '.www.linkedin.com',
      })

      return page
    } catch (err: any) {
      log(ScrapProcess.SETUP, `An error occurred during page setup: ${err.message}`, true)
      await this.close() // Kill Puppeteer
      throw err
    }
  }

  /**
   * Simple method to check if the session is still active.
   */
  private async checkIfLoggedIn() {
    const page = await this.createPage()

    log(ScrapProcess.SETUP, 'Checking if we are still logged in...')

    // Go to the login page of LinkedIn
    // If we do not get redirected and stay on /login, we are logged out
    // If we get redirect to /feed, we are logged in
    await page.goto(`${this.LINKEDIN_URL}/login`)
    await page.waitForNetworkIdle()

    const url = page.url()
    const isLoggedIn = !url.endsWith('/login')

    if (isLoggedIn) {
      log(ScrapProcess.SETUP, 'All good. We are still logged in.')
    } else {
      const errorMessage =
        'Bad news, we are not logged in! Your session seems to be expired. Use your browser to login again with your LinkedIn credentials and extract the "li_at" cookie value for the "sessionCookieValue" option.'
      log(ScrapProcess.SETUP, errorMessage)
      throw new SessionExpired(errorMessage)
    }
  }

  /**
   * Method to block know hosts that have some kind of tracking.
   * By blocking those hosts we speed up the crawling.
   *
   * More info: http://winhelp2002.mvps.org/hosts.htm
   */
  private getBlockedHosts(): Record<string, boolean> {
    const blockedHostsArray = blockedHostsList.split('\n')

    let blockedHostsObject = blockedHostsArray.reduce(
      (prev, curr) => {
        const frags = curr.split(' ')

        if (frags.length > 1 && frags[0] === '0.0.0.0') {
          prev[frags[1].trim()] = true
        }

        return prev
      },
      {} as Record<string, boolean>,
    )

    blockedHostsObject = {
      ...blockedHostsObject,
      'static.chartbeat.com': true,
      'scdn.cxense.com': true,
      'api.cxense.com': true,
      'www.googletagmanager.com': true,
      'connect.facebook.net': true,
      'platform.twitter.com': true,
      'tags.tiqcdn.com': true,
      'dev.visualwebsiteoptimizer.com': true,
      'smartlock.google.com': true,
      'cdn.embedly.com': true,
    }

    return blockedHostsObject
  }

  /**
   * Method to complete kill any Puppeteer process still active.
   * Freeing up memory.
   */
  public async close(page?: Page): Promise<void> {
    if (page) {
      log(ScrapProcess.CLOSING, 'Closing page...')
      await page.close()
      log(ScrapProcess.CLOSING, 'Page closed.')
    }

    if (this.browser) {
      log(ScrapProcess.CLOSING, 'Closing browser...')
      await this.browser.close()
      log(ScrapProcess.CLOSING, 'Browser closed.')

      const browserProcessPid = this.browser.process()?.pid

      // Completely kill the browser process to prevent zombie processes
      // https://docs.browserless.io/blog/2019/03/13/more-observations.html#tip-2-when-you-re-done-kill-it-with-fire
      if (browserProcessPid) {
        log(ScrapProcess.CLOSING, `Killing browser process pid: ${browserProcessPid}...`)

        treeKill(browserProcessPid, 'SIGKILL', err => {
          if (err) {
            throw new Error(`Failed to kill browser process pid: ${browserProcessPid} (${err.message})`)
          }

          log(ScrapProcess.CLOSING, `Killed browser pid: ${browserProcessPid}. Closed browser.`)
          return
        })
      }
    }

    return
  }

  /**
   * Method to scrape a user profile.
   */
  public async run(): Promise<ScraperReturnValue> {
    try {
      await this.setup()
      const page = await this.createPage()
      page.goto(this.LINKEDIN_URL)

      // ============================================================================================================
      //                                               RECHERCHE
      // ============================================================================================================
      console.log('')

      // recherche globale
      log(ScrapProcess.RUN, `🔥 LOOKING FOR "${this.options.searchText}"`)
      await page.waitForSelector('input[placeholder="Recherche"]')
      await page.type('input[placeholder="Recherche"]', this.options.searchText)
      await page.waitForSelector('::-p-text("Voir tous les résultats")')
      await page.click('::-p-text("Voir tous les résultats")')

      // on ne garde que les emplois
      log(ScrapProcess.RUN, 'Refining search')
      await page.waitForSelector('ul.search-reusables__filter-list')
      await page.click('button::-p-text("Emplois")')

      // on cherche dans le pays souhaité
      await page.waitForSelector('[id^="jobs-search-box-location"]')
      await clearInput(page, '[id^="jobs-search-box-location"]')
      await page.type('[id^="jobs-search-box-location"]', this.options.country)
      await page.keyboard.press('Enter')

      // on filtre par ville
      if (this.options.cities.length > 0) {
        log(ScrapProcess.RUN, `Restraining to following cities: ${this.options.cities.map(c => `"${c}"`).join(', ')}`)
        await wait(2000)
        await page.waitForSelector('button::-p-text("Tous les filtres")')
        await page.click('button::-p-text("Tous les filtres")')
        await wait(1000)
        await page.waitForSelector('.search-reusables__value-label')
        for (const city of this.options.cities) {
          await clickOnCheckboxByLabel(page, city)
        }
        await wait(3000)
        await page.click('.artdeco-modal__actionbar button:not(:first-child)') // on clique sur "Afficher XXX résultats"
      }

      // préparation pour le traitement page par page
      await wait(4000)
      let pageNumber = 1
      let nextPageMethod = 1
      let hasNextPage = true

      // récupération de tous les jobs
      const jobCardSelector = '.scaffold-layout__list-container li div[data-view-name="job-card"]'
      const incompleteJobs: IncompleteJob[] = []
      do {
        log(ScrapProcess.RUN, `Gathering opportunities (page ${pageNumber})`)
        await page.waitForSelector(jobCardSelector)
        await wait(2000) // on laisse bien le temps de charger
        await scrollToBottom(page, '.scaffold-layout__list-container') // on scroll jusqu'à la fin de la liste des jobs pour tous les charger

        const currentIncompleteJobs: IncompleteJob[] = await page.$$eval(jobCardSelector, jobCards =>
          jobCards.map(jobCard => {
            const rawJobName =
              jobCard.querySelector('.job-card-list__title--link span:nth-child(1) > strong')?.textContent || 'Unknown'

            const jobId = jobCard.getAttribute('data-job-id') || 'Unknown'
            return { name: rawJobName, id: jobId }
          }),
        )

        incompleteJobs.push(...currentIncompleteJobs)

        const { hasHitLastPage, methodThatWorked } = await clickOnNextPageButton(page, nextPageMethod)
        hasNextPage = !hasHitLastPage
        nextPageMethod = methodThatWorked

        pageNumber++
      } while (hasNextPage)

      // ============================================================================================================
      //                                               FILTRAGE
      // ============================================================================================================
      let filteredIncompleteJobs: IncompleteJob[] = []
      console.log('')
      log(ScrapProcess.RUN, '⏭ FILTERING')
      log(ScrapProcess.RUN, `There are ${incompleteJobs.length} job opportunities BEFORE filtering`)

      /**
       * 1. Suppression des offres que l'on ne souhaite explicitement pas traiter
       */
      filteredIncompleteJobs = incompleteJobs.filter(job => !this.options.opportunitiesIdsToSkip?.includes(job.id))

      log(
        ScrapProcess.RUN,
        `There are ${filteredIncompleteJobs.length} job opportunities AFTER removing opportunities you listed to skip`,
      )

      /**
       * 2. Filtrage par mots bannis
       * On ne va conserver que les offres d'emploi qui n'ont pas un des mots bannis dans leur nom
       */
      filteredIncompleteJobs = filteredIncompleteJobs.filter(job => {
        const hasBannedWordInTitle = this.options.jobTitleBannedWords.some(bannedWord =>
          job.name.toLowerCase().includes(bannedWord.toLowerCase()),
        )
        return !hasBannedWordInTitle
      })

      log(
        ScrapProcess.RUN,
        `There are ${filteredIncompleteJobs.length} job opportunities AFTER filtering by banned words`,
      )

      /**
       * 3. ✨ Filtrage par IA ✨
       * Si l'IA est activée, on va demander à l'IA si l'offre d'emploi semble vraiment correspondre à ce qu'on recherche
       */
      if (this.aiWizard) {
        log(ScrapProcess.RUN, '✨ Using AI to better filter results ✨')

        // on va traiter X noms à la fois, l'IA ayant du mal avec un nombre plus important
        const batchSize = 20
        for (let i = 0; i < filteredIncompleteJobs.length; i += batchSize) {
          const question = generateAIQuestion_jobName(
            this.options.optimizeUsingOpenAI!.idealJobDescription,
            filteredIncompleteJobs.slice(i, i + batchSize).map(job => job.name),
            this.options.optimizeUsingOpenAI!.language,
          )

          const AIAnswer: string | null = await this.aiWizard.ask(question)
          if (!AIAnswer) {
            continue
          }

          // interprétation de la réponse de l'IA: calcul des index à supprimer
          const parsedAnswer = AIAnswer.split(',').map(a => a.trim())
          const indexesToRemove: number[] = []
          parsedAnswer.forEach((answer, index) => {
            if (answer === '-1') {
              indexesToRemove.push(index + i)
            }
          })

          _.pullAt(filteredIncompleteJobs, indexesToRemove) // suppression des éléments
        }

        log(ScrapProcess.RUN, `There are ${filteredIncompleteJobs.length} job opportunities AFTER filtering with AI`)
      }

      // ============================================================================================================
      //                                               SCRAPING
      // ============================================================================================================
      console.log('')
      log(ScrapProcess.RUN, '🔎 SCRAPING')

      // Pour chaque job, récupération des informations qui nous intéressent
      const results: CompleteJob[] = []
      for (const job of filteredIncompleteJobs) {
        log(
          ScrapProcess.RUN,
          `⌛️ Scraping job opportunity "${job.name}" (${filteredIncompleteJobs.length - results.length} remaining)`,
        )

        const result = await this.scrapeJobPosition(job.id)
        results.push(result)
        console.log('')
      }

      // ============================================================================================================
      //                                             FINAL RESULTS
      // ============================================================================================================
      log(
        ScrapProcess.RUN,
        `${results.filter(r => !r.error && r.validatedByAi !== false).length} validated job opportunities`,
      )
      log(
        ScrapProcess.RUN,
        `${results.filter(r => r.error || r.validatedByAi === false).length} opportunities rejected, (${
          results.filter(r => r.validatedByAi === false).length
        } by IA, ${results.filter(r => r.error).length} with error)`,
      )

      console.log('')
      console.log('Here are the jobs that got validated:')
      console.log(results.filter(r => !r.error && r.validatedByAi !== false).map(r => ({ name: r.name, id: r.id })))
      console.log('')

      this.close()

      return {
        allJobsIds: incompleteJobs.map(j => j.id),
        rejectedJobs: results.filter(r => r.error || r.validatedByAi === false),
        validatedJobs: results.filter(r => !r.error && r.validatedByAi !== false),
      }
    } catch (err: any) {
      log(ScrapProcess.RUN, `Error while looking for job opportunities: ${err.message}`, true)
      this.close()

      return {
        allJobsIds: [],
        rejectedJobs: [],
        validatedJobs: [],
      }
    }
  }

  /**
   * Scrape une offre d'emploi particulière et en extraie ce qu'on veut
   * @param jobUrl l'id de l'offre d'emploi LinkedIn
   */
  private async scrapeJobPosition(jobId: string): Promise<CompleteJob> {
    const page = await this.createPage({ preservePreviousPage: true })
    const link = `${this.LINKEDIN_URL}/jobs/view/${jobId}`

    try {
      await page.goto(`${this.LINKEDIN_URL}/jobs/view/${jobId}`)

      await page.waitForSelector('.job-details-jobs-unified-top-card__job-title')
      await page.waitForSelector('.jobs-description-content__text--stretch')

      const name =
        (await page.$eval('.job-details-jobs-unified-top-card__job-title', el => el.textContent?.trim())) ||
        'Impossible à récupérer'

      await page.click('::-p-text("Voir plus")')
      const description =
        (await page.$eval('.jobs-description-content__text--stretch', el => el.textContent?.trim())) ||
        'Impossible à récupérer'

      // utilisation de l'IA pour déterminer si la description correspond réellement
      let validatedByAi = true
      if (this.aiWizard) {
        log(ScrapProcess.RUN, '✨ Using AI to analize job description ✨"')
        const question = generateAIQuestion_jobDescription(
          this.options.optimizeUsingOpenAI!.idealJobDescription,
          description,
          this.options.optimizeUsingOpenAI!.language,
        )

        const AIAnswer: string | null = await this.aiWizard.ask(question)
        if (AIAnswer === '-1') {
          log(ScrapProcess.RUN, '❌ AI did not validate job description')
          validatedByAi = false
        } else {
          log(ScrapProcess.RUN, '✅ AI validated job description')
          validatedByAi = true
        }
      }

      await page.close()

      log(ScrapProcess.RUN, `✅ Done scraping "${name}"`)

      return {
        name,
        link,
        id: jobId,
        description,
        ...(!validatedByAi && { validatedByAi: false }),
      }
    } catch (err: any) {
      log(ScrapProcess.RUN, `❌ Error while scraping: ${err.message}`, true)
      return {
        link,
        name: '',
        id: jobId,
        description: '',
        error: err.message,
      }
    }
  }
}
