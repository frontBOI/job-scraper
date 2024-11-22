import loggerOptionsSchema from '../logger/schemas'

import { boolean, number, object, string, z } from 'zod'

const OptimizeWithAIOptionsSchema = object({
  apiKey: string(),
  model: string().optional(),
  language: z.enum(['fr', 'en']),
  idealJobDescription: string().max(256, { message: 'Your ideal job description is too long. Max 256 characters.' }),
})

export default object({
  timeout: number().optional(),
  userAgent: string().optional(),
  headless: boolean().optional(),
  optimizeWithAI: OptimizeWithAIOptionsSchema.optional().nullable(),
}).merge(loggerOptionsSchema) // extend the LoggerOptionsSchema
