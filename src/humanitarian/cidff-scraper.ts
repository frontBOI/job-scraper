import { Logger, ScrapProcess } from '../logger/types'
import { CreatePageOptions } from '../scraper/types'
import { CompleteJob, HumanitarianScrapingSource } from './types'

import { Page } from 'puppeteer'

/**
 * Sur ce site, il n'y a qu'une petite liste d'offres, pas de système de filtre. Chaque fois que je passe, je vois donc devoir
 * mémoriser toutes les offres présentées et si une change, je la considère comme nouvelle et je mets à jour la liste des offres.
 */
export async function scrapeCIDFF({
  logger,
  createPage,
}: {
  logger: Logger
  createPage: (options?: CreatePageOptions) => Promise<Page>
}): Promise<CompleteJob[]> {
  logger.log(ScrapProcess.RUN, 'Scraping CIDFF opportunites')

  const page = await createPage()
  page.goto('https://fncidff.info/postuler/')
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
  logger.log(ScrapProcess.RUN, 'Done')
  return allJobs.map(job => ({
    id: job.name, // il n'y a pas d'id sur leur site
    name: job.name,
    link: job.link,
    source: HumanitarianScrapingSource.CIDFF,
  }))
}
