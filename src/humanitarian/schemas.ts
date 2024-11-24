import ScraperUserDefinedOptionsSchema from '../scraper/schemas'
import { HumanitarianScrapingSource } from './types'

import { array, nativeEnum, object, string } from 'zod'

const CompleteJobSchema = object({
  id: string(),
  name: string(),
  link: string(),
  source: nativeEnum(HumanitarianScrapingSource),
})

export default object({
  opportunitiesIdsToSkip: array(CompleteJobSchema).optional(),
}).merge(ScraperUserDefinedOptionsSchema) // extend default scraper options
