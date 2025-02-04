import { ScraperOptions, ScraperUserDefinedOptions } from '../scraper/types'

export enum HumanitarianScrapingSource {
  CIDFF = 'CIDFF',
  LA_GUILDE = 'La Guilde',
  COORDINATION_SUD = 'Coordination Sud',
  FRANCE_VOLONTAIRE = 'France volontaire',
}

export interface HumanitarianScraperOptions extends ScraperOptions {
  opportunitiesIdsToSkip: CompleteJob[]
}

export interface HumanitarianScraperUserDefinedOptions extends ScraperUserDefinedOptions {
  /**
   * Object of opportunities you want to skip. This can be because you have already scraped them and don't want to process them again.
   * Because multiple sites are scraped for humanitarian jobs, this object should be an array of objects with the id and source of the opportunity.
   *
   * Default: []
   */
  opportunitiesIdsToSkip?: CompleteJob[]
}

export interface CompleteJob {
  id: string
  name: string
  link: string
  source: HumanitarianScrapingSource
}

export type ScraperReturnValue = CompleteJob[]
