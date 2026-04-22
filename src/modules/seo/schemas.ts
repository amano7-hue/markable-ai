import { z } from 'zod'

export const CreateKeywordSchema = z.object({
  text: z.string().min(2).max(200),
  intent: z.enum(['informational', 'commercial', 'navigational']).optional(),
})

export const UpdateKeywordSchema = z.object({
  text: z.string().min(2).max(200).optional(),
  isActive: z.boolean().optional(),
})

export const GenerateArticleSchema = z.object({
  keywordId: z.string().optional(),
  title: z.string().min(5).max(200),
})

export type CreateKeywordInput = z.infer<typeof CreateKeywordSchema>
export type UpdateKeywordInput = z.infer<typeof UpdateKeywordSchema>
export type GenerateArticleInput = z.infer<typeof GenerateArticleSchema>
