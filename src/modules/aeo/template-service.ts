export interface AeoTemplate {
  id: string
  industry: string
  text: string
}

const TEMPLATES: AeoTemplate[] = [
  {
    id: 'btob-saas-crm',
    industry: 'BtoB SaaS',
    text: '中小企業向けのCRMツールを選ぶ際の比較ポイントは何ですか？',
  },
  {
    id: 'btob-saas-marketing',
    industry: 'BtoB SaaS',
    text: 'BtoBマーケティングオートメーションツールのおすすめを教えてください。',
  },
  {
    id: 'manufacturing-dx',
    industry: '製造業',
    text: '製造業のDXを推進するためのおすすめのソリューションは何ですか？',
  },
  {
    id: 'manufacturing-iot',
    industry: '製造業',
    text: '工場の生産管理にIoTを導入する際に参考になる事例や製品を教えてください。',
  },
  {
    id: 'professional-services-consulting',
    industry: 'プロフェッショナルサービス',
    text: '経営コンサルティングファームを選ぶ際の評判や実績の調べ方を教えてください。',
  },
  {
    id: 'professional-services-hr',
    industry: 'プロフェッショナルサービス',
    text: '採用管理システム（ATS）のおすすめを中堅企業向けに教えてください。',
  },
  {
    id: 'finance-accounting',
    industry: '金融・会計',
    text: '中小企業向けのクラウド会計ソフトを比較したいのですが、どれがおすすめですか？',
  },
  {
    id: 'logistics-scm',
    industry: '物流・SCM',
    text: 'サプライチェーン管理を効率化するためのソフトウェアソリューションを教えてください。',
  },
]

export function getTemplates(industry?: string): AeoTemplate[] {
  if (!industry) return TEMPLATES
  return TEMPLATES.filter((t) =>
    t.industry.toLowerCase().includes(industry.toLowerCase()),
  )
}
