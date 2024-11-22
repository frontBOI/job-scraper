import { object, z } from 'zod'

export default object({
  onLoggedMessage: z.function(z.tuple([z.string()]), z.void()).optional(),
})
