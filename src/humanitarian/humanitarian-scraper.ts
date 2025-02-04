import Scraper from '../scraper/scraper'
import { scrapeCIDFF } from './cidff-scraper'
import { scrapeCoordinationSud } from './coordination-sud-scraper'
import { scrapeFranceVolontaire } from './france-volontaire-scraper'
import { scrapeLaGuilde } from './la-guilde-scraper'
import OptionsSchema from './schemas'
import { HumanitarianScraperOptions, HumanitarianScraperUserDefinedOptions, ScraperReturnValue } from './types'

/**
 * Scraper to find job opportunities in the humanitarian sector.
 */
export default class HumanitarianScraper extends Scraper {
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

    const results: any[] = []
    for (const scraper of [scrapeCoordinationSud, scrapeCIDFF, scrapeLaGuilde, scrapeFranceVolontaire]) {
      const data = await scraper({ logger: this.logger, createPage: this.createPage.bind(this) })
      results.push(data)
    }

    this.close()

    return results.flat()
  }
}
