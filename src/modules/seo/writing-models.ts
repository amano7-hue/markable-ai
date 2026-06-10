export const WRITING_MODELS = [
  // Gemini
  { value: 'gemini-2.5-flash',  label: 'Gemini 2.5 Flash（デフォルト）', provider: 'gemini' },
  { value: 'gemini-2.5-pro',    label: 'Gemini 2.5 Pro',                 provider: 'gemini' },
  { value: 'gemini-2.0-flash',  label: 'Gemini 2.0 Flash',               provider: 'gemini' },
  // OpenAI
  { value: 'gpt-4o',            label: 'GPT-4o',                         provider: 'openai' },
  { value: 'gpt-4o-mini',       label: 'GPT-4o mini',                    provider: 'openai' },
  { value: 'gpt-4.1',           label: 'GPT-4.1',                        provider: 'openai' },
  { value: 'gpt-4.1-mini',      label: 'GPT-4.1 mini',                   provider: 'openai' },
  { value: 'o4-mini',           label: 'o4-mini（推論）',                 provider: 'openai' },
  // Anthropic
  { value: 'claude-opus-4-6',           label: 'Claude Opus 4.6',        provider: 'anthropic' },
  { value: 'claude-sonnet-4-6',         label: 'Claude Sonnet 4.6',      provider: 'anthropic' },
  { value: 'claude-haiku-4-5-20251001', label: 'Claude Haiku 4.5',       provider: 'anthropic' },
] as const

export type WritingModelValue = typeof WRITING_MODELS[number]['value']
