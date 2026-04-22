import { z } from 'zod'

const SegmentCriteriaSchema = z.object({
  lifecycle: z.array(z.string()).optional(),
  minIcpScore: z.number().min(0).max(100).optional(),
  company: z.string().max(200).optional(),
})

export const CreateSegmentSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
  criteria: SegmentCriteriaSchema,
})

export const GenerateEmailSchema = z.object({
  segmentId: z.string(),
  goal: z.string().min(1).max(100),
})

export type CreateSegmentInput = z.infer<typeof CreateSegmentSchema>
export type GenerateEmailInput = z.infer<typeof GenerateEmailSchema>
