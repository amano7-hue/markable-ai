import { z } from 'zod'

export const CreatePromptSchema = z.object({
  text: z.string().min(5).max(500),
  industry: z.string().max(100).optional(),
  competitors: z.array(z.string().max(253)).max(10).optional(),
})

export const UpdatePromptSchema = z.object({
  text: z.string().min(5).max(500).optional(),
  isActive: z.boolean().optional(),
})

export const AddCompetitorSchema = z.object({
  domain: z.string().max(253),
})

export type CreatePromptInput = z.infer<typeof CreatePromptSchema>
export type UpdatePromptInput = z.infer<typeof UpdatePromptSchema>
