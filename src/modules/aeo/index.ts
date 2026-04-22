export type { PromptWithStats, CitationGap, AeoSuggestionPayload } from './types'
export { parseAeoSuggestionPayload } from './types'
export { CreatePromptSchema, UpdatePromptSchema, AddCompetitorSchema } from './schemas'
export type { CreatePromptInput, UpdatePromptInput } from './schemas'

export {
  listPrompts,
  getPrompt,
  createPrompt,
  updatePrompt,
  deletePrompt,
  addCompetitor,
  removeCompetitor,
} from './prompt-service'

export {
  syncDailySnapshots,
  getSnapshotsForPrompt,
  detectCitationGaps,
} from './snapshot-service'

export { generateAndEnqueueSuggestion } from './suggestion-service'
export { getTemplates } from './template-service'
export type { AeoTemplate } from './template-service'
