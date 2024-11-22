import ScraperUserDefinedOptionsSchema from '../scraper/schemas'

import { array, object, string } from 'zod'

export default object({
  country: string().optional(),
  cities: array(string()).optional(),
  opportunitiesIdsToSkip: string().optional(),
  jobTitleBannedWords: array(string()).optional(),
  searchText: string().min(1, { message: 'Option "searchText" is required.' }),
  sessionCookieValue: string().min(1, { message: 'Option "sessionCookieValue" is required.' }),
}).merge(ScraperUserDefinedOptionsSchema) // extend default scraper options
