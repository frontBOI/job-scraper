import { ScraperOptions, ScraperUserDefinedOptions } from '../scraper/types'

export enum HumanitarianScrapingSources {
  COORDINATION_SUD = 'Coordination Sud',
  CIDFF = 'CIDFF',
}

export interface HumanitarianScraperOptions extends ScraperOptions {
  opportunitiesIdsToSkip: Pick<CompleteJob, 'id' | 'source'>[]
}

export interface HumanitarianScraperUserDefinedOptions extends ScraperUserDefinedOptions {
  /**
   * Object of opportunities you want to skip. This can be because you have already scraped them and don't want to process them again.
   * Because multiple sites are scraped for humanitarian jobs, this object should be an array of objects with the id and source of the opportunity.
   *
   * Default: []
   */
  opportunitiesIdsToSkip?: Pick<CompleteJob, 'id' | 'source'>[]
}

export interface CompleteJob {
  id: string
  name: string
  link: string
  source: HumanitarianScrapingSources
}

export type ScraperReturnValue = CompleteJob[]
