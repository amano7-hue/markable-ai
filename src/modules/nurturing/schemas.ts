import { z } from 'zod'

const SegmentCriteriaSchema = z.object({
  lifecycle: z.array(z.string()).optional(),
  minIcpScore: z.number().min(0).max(100).optional(),
  company: z.string().max(200).optional(),
  // エンゲージメント系フィルター
  minEmailOpenCount: z.number().min(0).optional(),
  minEmailClickCount: z.number().min(0).optional(),
  notEngagedDays: z.number().min(1).optional(), // 最終開封からN日以上経過
})

export const CreateSegmentSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
  criteria: SegmentCriteriaSchema,
  projectId: z.string().optional(),
})

export const GenerateEmailSchema = z.object({
  segmentId: z.string(),
  goal: z.string().min(1).max(100),
})

export type CreateSegmentInput = z.infer<typeof CreateSegmentSchema>
export type GenerateEmailInput = z.infer<typeof GenerateEmailSchema>
