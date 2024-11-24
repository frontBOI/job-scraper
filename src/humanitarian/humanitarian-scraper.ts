import { ScrapProcess } from '../logger/types'
import Scraper from '../scraper/scraper'
import { coordinationSud_clickOnCheckboxByLabel, wait } from '../utils/utils'
import OptionsSchema from './schemas'
import {
  CompleteJob,
  HumanitarianScraperOptions,
  HumanitarianScraperUserDefinedOptions,
  HumanitarianScrapingSource,
  ScraperReturnValue,
} from './types'

/**
 * Scraper to find job opportunities in the humanitarian sector.
 */
export default class HumanitarianScraper extends Scraper {
  private COORDINATION_SUD_URL = 'https://www.coordinationsud.org/espace-emploi/'
  private CIDFF_URL = 'https://fncidff.info/postuler/'

  protected options: HumanitarianScraperOptions = {
    timeout: 10000,
    headless: true,
    userCookies: [],
    opportunitiesIdsToSkip: [],
    userAgent:
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36',
  }

  constructor(options: HumanitarianScraperUserDefinedOptions) {
    super(options)
    this.options = Object.assign(this.options, OptionsSchema.parse(options))
  }

  public async run(): Promise<ScraperReturnValue> {
    await this.setup()
    const resultsCoordinationSud = await this.scrapeCoordinationSud()
    const resultsCIDFF = await this.scrapeCIDFF()

    this.close()

    return [...resultsCoordinationSud, ...resultsCIDFF]
  }

  private async scrapeCoordinationSud(): Promise<CompleteJob[]> {
    const page = await this.createPage()
    page.goto(this.COORDINATION_SUD_URL)
    await page.waitForNetworkIdle()

    // ============================================================================================================
    //                                                FILTRAGE
    // ============================================================================================================
    // filtrage
    await page.waitForSelector('::-p-text("Rechercher & filtrer")')
    await page.click('::-p-text("Rechercher & filtrer")')
    await page.waitForSelector('.search-filters')

    // on clique sur tous les "Voir plus"
    await page.$$eval('::-p-text("Voir plus")', elements => (elements as HTMLLinkElement[]).forEach(e => e.click()))

    await wait(2000)

    await coordinationSud_clickOnCheckboxByLabel(page, 'Europe')
    await page.waitForNetworkIdle()
    await coordinationSud_clickOnCheckboxByLabel(page, 'Contrat à Durée Déterminée')
    await page.waitForNetworkIdle()
    await coordinationSud_clickOnCheckboxByLabel(page, 'Contrat à Durée Indéterminée')
    await page.waitForNetworkIdle()
    await coordinationSud_clickOnCheckboxByLabel(page, 'Droit')
    await page.waitForNetworkIdle()
    await coordinationSud_clickOnCheckboxByLabel(page, 'Droits humains')
    await page.waitForNetworkIdle()
    await coordinationSud_clickOnCheckboxByLabel(page, 'Genre')
    await page.waitForNetworkIdle()
    await coordinationSud_clickOnCheckboxByLabel(page, 'Migration')
    await page.waitForNetworkIdle()
    await coordinationSud_clickOnCheckboxByLabel(page, 'Développement économique et local')
    await page.waitForNetworkIdle()
    await coordinationSud_clickOnCheckboxByLabel(page, 'Gestion de projet')
    await page.waitForNetworkIdle()
    await coordinationSud_clickOnCheckboxByLabel(page, 'Programme')
    await page.waitForNetworkIdle()

    // on ferme les filtres
    await page.mouse.click(1100, 360)

    // ============================================================================================================
    //                                                  SCRAPING
    // ============================================================================================================

    // préparation pour le traitement page par page
    await wait(2000)
    let pageNumber = 1
    let hasNextPage = true

    // récupération de tous les jobs
    const jobCardSelector = 'article.post-entry'
    const jobNames: string[] = []
    do {
      this.logger.log(ScrapProcess.RUN, `Gathering opportunities (page ${pageNumber})`)
      await wait(4000) // on laisse bien le temps de charger

      const currentJobNames: string[] = await page.$$eval(jobCardSelector, jobCards =>
        jobCards.map(jobCard => {
          const jobName = jobCard.querySelector('header.entry-content-header > h3 > a')?.textContent || 'Unknown'

          return jobName
        }),
      )

      jobNames.push(...currentJobNames)

      // click sur next page
      hasNextPage = await page.$eval('.facetwp-pager', pager => {
        for (let i = 0; i < pager.children.length; i++) {
          const currentPage = pager.children[i]
          const nextPage = pager.children[i + 1] as HTMLLinkElement | undefined
          if (currentPage.classList.contains('active')) {
            if (nextPage) {
              nextPage.click()
              return true
            } else {
              return false
            }
          }
        }
        return false
      })

      await wait(2000)
      pageNumber++
    } while (hasNextPage)

    // ============================================================================================================
    //                                                  RETOUR
    // ============================================================================================================
    return jobNames.map(name => ({
      name,
      id: name, // il n'y a pas d'id sur leur site
      source: HumanitarianScrapingSource.COORDINATION_SUD,
      link: `${this.COORDINATION_SUD_URL}/espace-emploi/${name}`,
    }))
  }

  /**
   * Sur ce site, il n'y a qu'une petite liste d'offres, pas de système de filtre. Chaque fois que je passe, je vois donc devoir
   * mémoriser toutes les offres présentées et si une change, je la considère comme nouvelle et je mets à jour la liste des offres.
   */
  private async scrapeCIDFF(): Promise<CompleteJob[]> {
    const page = await this.createPage()
    page.goto(this.CIDFF_URL)
    await page.waitForNetworkIdle()

    // ============================================================================================================
    //                                                FILTRAGE
    // ============================================================================================================
    await page.waitForSelector('.jobs__list')

    const allJobs: { name: string; link: string }[] = await page.$$eval('.jobs__list .jobs__list-item', jobCards =>
      jobCards.map(job => ({
        name: job.querySelector('span')?.textContent?.trim() || '',
        link: job.querySelector('a')?.href || '',
      })),
    )

    // ============================================================================================================
    //                                                  RETOUR
    // ============================================================================================================
    return allJobs.map(job => ({
      id: job.name, // il n'y a pas d'id sur leur site
      name: job.name,
      link: job.link,
      source: HumanitarianScrapingSource.CIDFF,
    }))
  }
}
