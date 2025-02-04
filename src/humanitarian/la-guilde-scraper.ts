import { Logger, ScrapProcess } from '../logger/types'
import { CreatePageOptions } from '../scraper/types'
import { wait } from '../utils/utils'
import { CompleteJob, HumanitarianScrapingSource } from './types'

import { Page } from 'puppeteer'

export async function scrapeLaGuilde({
  logger,
  createPage,
}: {
  logger: Logger
  createPage: (options?: CreatePageOptions) => Promise<Page>
}): Promise<CompleteJob[]> {
  logger.log(ScrapProcess.RUN, 'Scraping La Guilde')

  const page = await createPage()
  page.goto('https://la-guilde.org/en/agir-avec-nous/nos-actions/')

  // ============================================================================================================
  //                                                  SCRAPING
  // ============================================================================================================
  logger.log(ScrapProcess.RUN, 'Scraping all opportunities')

  // préparation pour le traitement page par page
  await wait(2000)
  let pageNumber = 1

  // ça ne sert à rien d'aller chercher toutes les annonces, on ne va vérifier qu'un subset en chargeant
  // X fois (il n'y a pas de pagination sur ce site, les annonces s'affichent à la suite)
  const MAX_PAGE_SEARCH = 4
  do {
    logger.log(ScrapProcess.RUN, `Clicking on "load more" (${pageNumber})`)
    await wait(4000) // on laisse bien le temps de charger

    // click sur next page
    await page.$eval('.ajaxLoadMore', el => {
      const button = el as HTMLButtonElement
      button.click()
    })

    pageNumber++
  } while (pageNumber <= MAX_PAGE_SEARCH)

  // extraction de tous les jobs
  const jobCardSelector = '.ajaxFilter-result article.section'
  const jobNamesAndLinks: { name: string; link: string }[] = await page.$$eval(jobCardSelector, jobCards =>
    jobCards.map(jobCard => {
      const jobName = jobCard.querySelector('div > div > h2 > a')?.textContent || 'Unknown'
      const jobLink = (jobCard.querySelector('div > div > h2 > a') as HTMLLinkElement)?.href || 'Unknown'

      return { name: jobName, link: jobLink }
    }),
  )

  // ============================================================================================================
  //                                                  RETOUR
  // ============================================================================================================
  logger.log(ScrapProcess.RUN, 'Done')
  return jobNamesAndLinks.map(({ name, link }) => ({
    name,
    link,
    id: name, // il n'y a pas d'id sur leur site
    source: HumanitarianScrapingSource.LA_GUILDE,
  }))
}
