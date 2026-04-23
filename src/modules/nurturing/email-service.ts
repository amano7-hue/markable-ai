import Anthropic from '@anthropic-ai/sdk'
import { prisma } from '@/lib/db/client'
import type { GenerateEmailInput } from './schemas'

const anthropic = new Anthropic()

export function parseEmailDraftOutput(
  rawText: string,
  fallbackSubject: string,
): { subject: string; body: string } {
  const lines = rawText.split('\n')
  const subjectLine = lines.find((l) => l.startsWith('件名:'))
  const subject = subjectLine ? subjectLine.replace('件名:', '').trim() : fallbackSubject
  const separatorIdx = lines.indexOf('---')
  const body = separatorIdx >= 0 ? lines.slice(separatorIdx + 1).join('\n').trim() : rawText.trim()
  return { subject, body }
}

const GOAL_LABELS: Record<string, string> = {
  '初回接触': '初回接触メール（認知・興味喚起）',
  '商談化促進': '商談化促進メール（デモ・提案の打診）',
  '失注後フォロー': '失注後フォローメール（関係継続）',
  '事例紹介': '成功事例紹介メール',
  '機能アップデート': '新機能・アップデートのお知らせ',
}

export async function generateEmailDraft(tenantId: string, input: GenerateEmailInput) {
  const segment = await prisma.nurtureSegment.findFirst({
    where: { id: input.segmentId, tenantId },
    include: {
      leads: {
        take: 3,
        include: { lead: { select: { jobTitle: true, lifecycle: true } } },
      },
    },
  })
  if (!segment) throw new Error('Segment not found')

  const leadContext = segment.leads
    .map((ls) => `- 役職: ${ls.lead.jobTitle ?? '不明'}, ライフサイクル: ${ls.lead.lifecycle ?? '不明'}`)
    .join('\n')

  const goalLabel = GOAL_LABELS[input.goal] ?? input.goal

  const msg = await anthropic.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 1024,
    messages: [
      {
        role: 'user',
        content: `BtoBマーケティング向けの${goalLabel}を作成してください。

セグメント名: "${segment.name}"
${segment.description ? `セグメント説明: ${segment.description}` : ''}

代表的なリード属性:
${leadContext || '- 情報なし'}

以下の形式で出力してください:
件名: [メール件名]
---
[メール本文（300〜400文字）]`,
      },
    ],
  })

  const rawText = msg.content[0].type === 'text' ? msg.content[0].text : ''
  const { subject, body } = parseEmailDraftOutput(rawText, `${goalLabel} - ${segment.name}`)

  const draft = await prisma.nurtureEmailDraft.create({
    data: { tenantId, segmentId: input.segmentId, subject, body },
  })

  await prisma.approvalItem.create({
    data: {
      tenantId,
      module: 'nurturing',
      type: 'nurturing_email_draft',
      payload: {
        draftId: draft.id,
        segmentId: input.segmentId,
        segmentName: segment.name,
        goal: input.goal,
        subject,
        body,
        generatedAt: new Date().toISOString(),
      },
    },
  })

  return { draftId: draft.id }
}

export async function listDrafts(tenantId: string, status?: string) {
  return prisma.nurtureEmailDraft.findMany({
    where: {
      tenantId,
      ...(status ? { status: status as 'PENDING' | 'APPROVED' | 'REJECTED' } : {}),
    },
    include: { segment: { select: { name: true } } },
    orderBy: { createdAt: 'desc' },
  })
}

export async function getDraft(tenantId: string, draftId: string) {
  return prisma.nurtureEmailDraft.findFirst({
    where: { id: draftId, tenantId },
    include: { segment: { select: { name: true } } },
  })
}
