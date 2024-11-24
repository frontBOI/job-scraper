import { ScrapProcess } from '../logger/types'
import Scraper from '../scraper/scraper'
import {
  clearInput,
  clickOnLinkedInCheckboxByLabel,
  clickOnNextPageButton,
  generateAIQuestion_jobDescription,
  generateAIQuestion_jobName,
  scrollToBottom,
  wait,
} from '../utils/utils'
import { SessionExpired } from './errors'
import OptionsSchema from './schemas'
import {
  CompleteJob,
  IncompleteJob,
  LinkedInScraperOptions,
  LinkedInScraperUserDefinedOptions,
  ScraperReturnValue,
} from './types'

import _ from 'lodash'

/**
 * Job scraper used to find job offers on LinkedIn, initially for my beautiful girlfriend but then why not offer it to the web.
 * Greatly inspired by: https://github.com/josephlimtech/linkedin-profile-scraper-api/tree/master
 */
export default class LinkedInJobScraper extends Scraper {
  private LINKEDIN_URL = 'https://www.linkedin.com'
  protected options: LinkedInScraperOptions = {
    cities: [],
    searchText: '',
    timeout: 10000,
    headless: true,
    userCookies: [],
    country: 'France',
    sessionCookieValue: '',
    jobTitleBannedWords: [],
    opportunitiesIdsToSkip: '',
    userAgent:
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36',
  }

  constructor(options: LinkedInScraperUserDefinedOptions) {
    super(options)
    this.options.userCookies = [{ name: 'li_at', value: options.sessionCookieValue, domain: '.www.linkedin.com' }]
    this.options = Object.assign(this.options, OptionsSchema.parse(options))
  }

  /**
   * Simple method to check if the session is still active.
   */
  private async checkIfLoggedIn() {
    const page = await this.createPage()

    this.logger.log(ScrapProcess.SETUP, 'Checking if we are still logged in...')

    // Go to the login page of LinkedIn
    // If we do not get redirected and stay on /login, we are logged out
    // If we get redirect to /feed, we are logged in
    await page.goto(`${this.LINKEDIN_URL}/login`)
    await page.waitForNetworkIdle()

    const url = page.url()
    const isLoggedIn = !url.endsWith('/login')

    if (isLoggedIn) {
      this.logger.log(ScrapProcess.SETUP, 'All good. We are still logged in.')
    } else {
      const errorMessage =
        'Bad news, we are not logged in! Your session seems to be expired. Use your browser to login again with your LinkedIn credentials and extract the "li_at" cookie value for the "sessionCookieValue" option.'
      this.logger.log(ScrapProcess.SETUP, errorMessage)
      throw new SessionExpired(errorMessage)
    }
  }

  /**
   * Method to scrape a user profile.
   */
  public async run(): Promise<ScraperReturnValue> {
    try {
      await this.setup()
      await this.checkIfLoggedIn()
      const page = await this.createPage()
      page.goto(this.LINKEDIN_URL)
      console.log('')

      // ============================================================================================================
      //                                               RECHERCHE
      // ============================================================================================================
      // recherche globale
      this.logger.log(ScrapProcess.RUN, `🔥 LOOKING FOR "${this.options.searchText}"`)
      await page.waitForSelector('input[placeholder="Recherche"]')
      await page.type('input[placeholder="Recherche"]', this.options.searchText)
      await page.waitForSelector('::-p-text("Voir tous les résultats")')
      await page.click('::-p-text("Voir tous les résultats")')

      // on ne garde que les emplois
      this.logger.log(ScrapProcess.RUN, 'Refining search')
      await page.waitForSelector('ul.search-reusables__filter-list')
      await page.click('button::-p-text("Emplois")')

      // on cherche dans le pays souhaité
      await page.waitForSelector('[id^="jobs-search-box-location"]')
      await clearInput(page, '[id^="jobs-search-box-location"]')
      await page.type('[id^="jobs-search-box-location"]', this.options.country)
      await page.keyboard.press('Enter')

      // on filtre par ville
      if (this.options.cities.length > 0) {
        this.logger.log(
          ScrapProcess.RUN,
          `Restraining to following cities: ${this.options.cities.map(c => `"${c}"`).join(', ')}`,
        )
        await wait(2000)
        await page.waitForSelector('button::-p-text("Tous les filtres")')
        await page.click('button::-p-text("Tous les filtres")')
        await wait(1000)
        await page.waitForSelector('.search-reusables__value-label')
        for (const city of this.options.cities) {
          await clickOnLinkedInCheckboxByLabel(page, city)
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
        this.logger.log(ScrapProcess.RUN, `Gathering opportunities (page ${pageNumber})`)
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

        const { hasHitLastPage, methodThatWorked } = await clickOnNextPageButton(page, nextPageMethod, this.logger)
        hasNextPage = !hasHitLastPage
        nextPageMethod = methodThatWorked

        pageNumber++
      } while (hasNextPage)

      // ============================================================================================================
      //                                               FILTRAGE
      // ============================================================================================================
      let filteredIncompleteJobs: IncompleteJob[] = []
      console.log('')
      this.logger.log(ScrapProcess.RUN, '⏭ FILTERING')
      this.logger.log(ScrapProcess.RUN, `There are ${incompleteJobs.length} job opportunities BEFORE filtering`)

      /**
       * 1. Suppression des offres que l'on ne souhaite explicitement pas traiter
       */
      filteredIncompleteJobs = incompleteJobs.filter(job => !this.options.opportunitiesIdsToSkip?.includes(job.id))

      this.logger.log(
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

      this.logger.log(
        ScrapProcess.RUN,
        `There are ${filteredIncompleteJobs.length} job opportunities AFTER filtering by banned words`,
      )

      /**
       * 3. ✨ Filtrage par IA ✨
       * Si l'IA est activée, on va demander à l'IA si l'offre d'emploi semble vraiment correspondre à ce qu'on recherche
       */
      if (this.aiWizard) {
        this.logger.log(ScrapProcess.RUN, '✨ Using AI to better filter results ✨')

        // on va traiter X noms à la fois, l'IA ayant du mal avec un nombre plus important
        const batchSize = 20
        for (let i = 0; i < filteredIncompleteJobs.length; i += batchSize) {
          const question = generateAIQuestion_jobName(
            this.options.optimizeWithAI!.idealJobDescription,
            filteredIncompleteJobs.slice(i, i + batchSize).map(job => job.name),
            this.options.optimizeWithAI!.language,
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

        this.logger.log(
          ScrapProcess.RUN,
          `There are ${filteredIncompleteJobs.length} job opportunities AFTER filtering with AI`,
        )
      }

      // ============================================================================================================
      //                                               SCRAPING
      // ============================================================================================================
      console.log('')
      this.logger.log(ScrapProcess.RUN, '🔎 SCRAPING')

      // Pour chaque job, récupération des informations qui nous intéressent
      const results: CompleteJob[] = []
      for (const job of filteredIncompleteJobs) {
        this.logger.log(
          ScrapProcess.RUN,
          `⌛️ Scraping job opportunity "${job.name}" ["${job.id}"] (${filteredIncompleteJobs.length - results.length} remaining)`,
        )

        const result = await this.scrapeJobPosition(job.id)
        results.push(result)
        console.log('')
      }

      // ============================================================================================================
      //                                             FINAL RESULTS
      // ============================================================================================================
      this.logger.log(
        ScrapProcess.RUN,
        `${results.filter(r => !r.error && r.validatedByAi !== false).length} validated job opportunities`,
      )
      this.logger.log(
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
      this.logger.log(ScrapProcess.RUN, `Error while looking for job opportunities: ${err.message}`, { error: true })
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
        this.logger.log(ScrapProcess.RUN, '✨ Using AI to analize job description ✨"')
        const question = generateAIQuestion_jobDescription(
          this.options.optimizeWithAI!.idealJobDescription,
          description,
          this.options.optimizeWithAI!.language,
        )

        const AIAnswer: string | null = await this.aiWizard.ask(question)
        if (AIAnswer === '-1') {
          this.logger.log(ScrapProcess.RUN, '❌ AI did not validate job description')
          validatedByAi = false
        } else {
          this.logger.log(ScrapProcess.RUN, '✅ AI validated job description')
          validatedByAi = true
        }
      }

      await page.close()

      this.logger.log(ScrapProcess.RUN, `✅ Done scraping "${name}"`)

      return {
        name,
        link,
        id: jobId,
        description,
        ...(!validatedByAi && { validatedByAi: false }),
      }
    } catch (err: any) {
      this.logger.log(ScrapProcess.RUN, `❌ Error while scraping: ${err.message}`, { error: true })
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
