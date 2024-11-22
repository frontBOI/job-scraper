import ScraperUserDefinedOptionsSchema from '../scraper/schemas'

import { object, string } from 'zod'

export default object({
  opportunitiesIdsToSkip: string().optional(),
}).merge(ScraperUserDefinedOptionsSchema) // extend default scraper options
