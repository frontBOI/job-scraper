import { array, boolean, number, object, string, z } from 'zod'

const OpenAIOptimizationOptionsSchema = object({
  apiKey: string(),
  model: string().optional(),
  language: z.enum(['fr', 'en']),
  idealJobDescription: string().max(256, { message: 'Your ideal job description is too long. Max 256 characters.' }),
})

export const ScraperUserDefinedOptionsSchema = object({
  timeout: number().optional(),
  country: string().optional(),
  userAgent: string().optional(),
  headless: boolean().optional(),
  cities: array(string()).optional(),
  opportunitiesIdsToSkip: string().optional(),
  jobTitleBannedWords: array(string()).optional(),
  optimizeUsingOpenAI: OpenAIOptimizationOptionsSchema.optional(),
  searchText: string().min(1, { message: 'Option "searchText" is required.' }),
  sessionCookieValue: string().min(1, { message: 'Option "sessionCookieValue" is required.' }),
})

// =======================================================================================================================
// =======================================================================================================================

const LoggerSSEOptionsSchema = object({
  enable: boolean(),
  onLoggedMessage: z.function(z.tuple([z.string()]), z.void()).optional(),
}).superRefine(({ enable, onLoggedMessage }, ctx) => {
  if (enable && !onLoggedMessage) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['onLoggedMessage'],
      message: 'You must provide a function for the "onLoggedMessage" option if you enable the logger.',
    })
  }
})

export const LoggerOptionsSchema = object({
  sseOptions: LoggerSSEOptionsSchema,
})
