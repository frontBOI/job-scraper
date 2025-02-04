import { Logger, ScrapProcess } from '../logger/types'
import { CreatePageOptions } from '../scraper/types'
import { coordinationSud_clickOnCheckboxByLabel, wait } from '../utils/utils'
import { CompleteJob, HumanitarianScrapingSource } from './types'

import { Page } from 'puppeteer'

export async function scrapeCoordinationSud({
  logger,
  createPage,
}: {
  logger: Logger
  createPage: (options?: CreatePageOptions) => Promise<Page>
}): Promise<CompleteJob[]> {
  logger.log(ScrapProcess.RUN, 'Scraping Coordination Sud')

  const page = await createPage()
  page.goto('https://www.coordinationsud.org/espace-emploi/')
  await page.waitForNetworkIdle()

  // ============================================================================================================
  //                                                FILTRAGE
  // ============================================================================================================
  logger.log(ScrapProcess.RUN, 'Filtering')
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
  logger.log(ScrapProcess.RUN, 'Scraping all opportunities')

  // préparation pour le traitement page par page
  await wait(2000)
  let pageNumber = 1
  let hasNextPage = true

  // récupération de tous les jobs
  const jobCardSelector = 'article.post-entry'
  const jobNamesAndLinks: { name: string; link: string }[] = []
  do {
    logger.log(ScrapProcess.RUN, `Gathering opportunities (page ${pageNumber})`)
    await wait(4000) // on laisse bien le temps de charger

    const currentJobNames: { name: string; link: string }[] = await page.$$eval(jobCardSelector, jobCards =>
      jobCards.map(jobCard => {
        const jobName = jobCard.querySelector('header.entry-content-header > h3 > a')?.textContent || 'Unknown'
        const jobLink =
          (jobCard.querySelector('header.entry-content-header > h3 > a') as HTMLLinkElement)?.href || 'Unknown'

        return { name: jobName, link: jobLink }
      }),
    )

    jobNamesAndLinks.push(...currentJobNames)

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
  logger.log(ScrapProcess.RUN, 'Done')
  return jobNamesAndLinks.map(({ name, link }) => ({
    name,
    link,
    id: name, // il n'y a pas d'id sur leur site
    source: HumanitarianScrapingSource.COORDINATION_SUD,
  }))
}
