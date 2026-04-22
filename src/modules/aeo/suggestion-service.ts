import Anthropic from '@anthropic-ai/sdk'
import { prisma } from '@/lib/db/client'
import type { CitationGap } from './types'

const anthropic = new Anthropic()

export async function generateAndEnqueueSuggestion(
  tenantId: string,
  promptId: string,
  gaps: CitationGap[],
): Promise<string> {
  const prompt = await prisma.aeoPrompt.findFirst({
    where: { id: promptId, tenantId },
  })
  if (!prompt) throw new Error('Prompt not found')

  const gapSummary = gaps
    .slice(0, 5)
    .map(
      (g) =>
        `- ${g.engine}: ${g.competitorDomain} が ${g.competitorRank} 位で引用されているが自社は未引用`,
    )
    .join('\n')

  const message = await anthropic.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 1024,
    messages: [
      {
        role: 'user',
        content: `あなたはBtoBマーケティングの専門家です。以下のAI検索の引用ギャップを分析し、自社が引用されるようになるための具体的なコンテンツ改善提案を日本語で提供してください。

プロンプト: "${prompt.text}"

引用ギャップ:
${gapSummary}

200文字程度で簡潔に、具体的なアクションを提案してください。`,
      },
    ],
  })

  const suggestion =
    message.content[0].type === 'text' ? message.content[0].text : ''

  const item = await prisma.approvalItem.create({
    data: {
      tenantId,
      module: 'aeo',
      type: 'aeo_suggestion',
      payload: {
        promptId,
        promptText: prompt.text,
        gaps: gaps.slice(0, 5).map((g) => ({
          engine: g.engine,
          competitorDomain: g.competitorDomain,
          competitorRank: g.competitorRank,
        })),
        suggestion,
        generatedAt: new Date().toISOString(),
      },
    },
  })

  return item.id
}
