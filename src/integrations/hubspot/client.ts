import type { HubSpotClient, HubSpotContact, HubSpotProperty } from './types'

interface HsContactProps {
  email?: string
  firstname?: string
  lastname?: string
  company?: string
  jobtitle?: string
  lifecyclestage?: string
  hs_lead_status?: string
  numberofemployees?: string
  annualrevenue?: string
  hs_email_open_count?: string
  hs_email_click_count?: string
  hs_email_last_open_date?: string
  [key: string]: string | undefined
}

interface HsContact {
  id: string
  properties: HsContactProps
}

interface HsPage {
  results: HsContact[]
  paging?: { next?: { after: string } }
}

interface HsPropertyRaw {
  name: string
  label: string
  type: string
  fieldType: string
  options?: { label: string; value: string; hidden?: boolean }[]
  hidden?: boolean
  calculated?: boolean
}

interface HsDealAssocResult {
  from: { id: string }
  to: { toObjectId: string }[]
}

interface HsDealBatchResult {
  results: { id: string; properties: Record<string, string | undefined> }[]
}

export interface CustomCondition {
  objectType: 'contact' | 'deal'
  field: string
  operator: 'eq' | 'neq' | 'contains' | 'in' | 'not_empty'
  value?: string | string[]
}

export interface HubSpotImportFilter {
  lifecycles?: string[]    // 含めるライフサイクルステージ（空=すべて）
  leadStatuses?: string[]  // 含めるリードステータス（空=すべて）
  customConditions?: CustomCondition[]
}

const BASE_PROPERTIES = 'email,firstname,lastname,company,jobtitle,lifecyclestage,hs_lead_status,numberofemployees,annualrevenue,hs_email_open_count,hs_email_click_count,hs_email_last_open_date'

// UIに表示しない完全内部プロパティのプレフィックス
const EXCLUDED_PROPERTY_PREFIXES = ['ingestionid_']
// 条件設定に使えないフィールドタイプ
const EXCLUDED_FIELD_TYPES = ['html', 'file']

function matchesCondition(value: string | undefined, condition: CustomCondition): boolean {
  const v = (value ?? '').toLowerCase().trim()
  const target = Array.isArray(condition.value) ? condition.value : [condition.value ?? '']
  switch (condition.operator) {
    case 'eq':   return v === target[0].toLowerCase()
    case 'neq':  return v !== target[0].toLowerCase()
    case 'contains': return v.includes(target[0].toLowerCase())
    case 'in':   return target.some((t) => v === t.toLowerCase())
    case 'not_empty': return v.length > 0
  }
}

export class HubSpotHttpClient implements HubSpotClient {
  private readonly baseUrl = 'https://api.hubapi.com'

  constructor(
    private readonly apiKey: string,
    private readonly importFilter?: HubSpotImportFilter,
  ) {}

  private headers() {
    return {
      Authorization: `Bearer ${this.apiKey}`,
      'Content-Type': 'application/json',
    }
  }

  async getProperties(objectType: 'contacts' | 'deals'): Promise<HubSpotProperty[]> {
    const res = await fetch(
      `${this.baseUrl}/crm/v3/properties/${objectType}?limit=500`,
      { headers: this.headers() },
    )
    if (!res.ok) throw new Error(`HubSpot properties error: ${res.status}`)
    const data = (await res.json()) as { results: HsPropertyRaw[] }
    return data.results
      .filter((p) => !p.hidden)
      .filter((p) => !EXCLUDED_FIELD_TYPES.includes(p.fieldType))
      .filter((p) => !EXCLUDED_PROPERTY_PREFIXES.some((pfx) => p.name.startsWith(pfx)))
      .map((p) => ({
        name: p.name,
        label: p.label,
        type: p.type,
        fieldType: p.fieldType,
        options: p.options?.filter((o) => !o.hidden).map((o) => ({ label: o.label, value: o.value })),
      }))
      .sort((a, b) => a.label.localeCompare(b.label))
  }

  async getContacts(): Promise<HubSpotContact[]> {
    const contactConditions = this.importFilter?.customConditions?.filter((c) => c.objectType === 'contact') ?? []
    const dealConditions = this.importFilter?.customConditions?.filter((c) => c.objectType === 'deal') ?? []

    // カスタムコンタクト条件のフィールドを PROPERTIES に追加
    const extraFields = contactConditions.map((c) => c.field).filter((f) => !BASE_PROPERTIES.includes(f))
    const properties = extraFields.length > 0 ? `${BASE_PROPERTIES},${extraFields.join(',')}` : BASE_PROPERTIES

    const contacts: HubSpotContact[] = []
    let after: string | undefined

    while (true) {
      const url = new URL(`${this.baseUrl}/crm/v3/objects/contacts`)
      url.searchParams.set('limit', '100')
      url.searchParams.set('properties', properties)
      if (after) url.searchParams.set('after', after)

      const res = await fetch(url.toString(), { headers: this.headers() })
      if (!res.ok) throw new Error(`HubSpot API error: ${res.status}`)

      const page = (await res.json()) as HsPage
      for (const c of page.results) {
        const p = c.properties
        if (!p.email) continue

        // ライフサイクルフィルター
        if (this.importFilter?.lifecycles?.length && p.lifecyclestage) {
          if (!this.importFilter.lifecycles.includes(p.lifecyclestage)) continue
        }
        // リードステータスフィルター
        if (this.importFilter?.leadStatuses?.length && p.hs_lead_status) {
          if (!this.importFilter.leadStatuses.includes(p.hs_lead_status)) continue
        }
        // コンタクトカスタム条件フィルター
        let passContact = true
        for (const cond of contactConditions) {
          if (!matchesCondition(p[cond.field], cond)) { passContact = false; break }
        }
        if (!passContact) continue

        contacts.push({
          id: c.id,
          email: p.email,
          firstName: p.firstname,
          lastName: p.lastname,
          company: p.company,
          jobTitle: p.jobtitle,
          lifecycle: p.lifecyclestage,
          leadStatus: p.hs_lead_status,
          numberOfEmployees: p.numberofemployees ? parseInt(p.numberofemployees, 10) : undefined,
          annualRevenue: p.annualrevenue ? parseFloat(p.annualrevenue) : undefined,
          emailOpenCount: p.hs_email_open_count ? parseInt(p.hs_email_open_count, 10) : 0,
          emailClickCount: p.hs_email_click_count ? parseInt(p.hs_email_click_count, 10) : 0,
          lastEmailOpenAt: p.hs_email_last_open_date ? new Date(p.hs_email_last_open_date) : undefined,
        })
      }

      after = page.paging?.next?.after
      if (!after) break
    }

    // 取引条件フィルター（バッチ処理）
    if (dealConditions.length > 0 && contacts.length > 0) {
      return this.applyDealConditions(contacts, dealConditions)
    }

    return contacts
  }

  private async applyDealConditions(contacts: HubSpotContact[], conditions: CustomCondition[]): Promise<HubSpotContact[]> {
    const dealFields = [...new Set(conditions.map((c) => c.field))]

    // バッチで取引の関連付けを取得（100件ずつ）
    const BATCH = 100
    const contactDealMap = new Map<string, string[]>()

    for (let i = 0; i < contacts.length; i += BATCH) {
      const slice = contacts.slice(i, i + BATCH)
      const res = await fetch(`${this.baseUrl}/crm/v4/associations/contacts/deals/batch/read`, {
        method: 'POST',
        headers: this.headers(),
        body: JSON.stringify({ inputs: slice.map((c) => ({ id: c.id })) }),
      })
      if (!res.ok) continue
      const data = (await res.json()) as { results: HsDealAssocResult[] }
      for (const r of data.results) {
        contactDealMap.set(r.from.id, r.to.map((t) => t.toObjectId))
      }
    }

    // 取引のプロパティをバッチ取得
    const allDealIds = [...new Set([...contactDealMap.values()].flat())]
    const dealPropsMap = new Map<string, Record<string, string | undefined>>()

    for (let i = 0; i < allDealIds.length; i += BATCH) {
      const slice = allDealIds.slice(i, i + BATCH)
      const res = await fetch(`${this.baseUrl}/crm/v3/objects/deals/batch/read`, {
        method: 'POST',
        headers: this.headers(),
        body: JSON.stringify({
          inputs: slice.map((id) => ({ id })),
          properties: dealFields,
        }),
      })
      if (!res.ok) continue
      const data = (await res.json()) as HsDealBatchResult
      for (const d of data.results) {
        dealPropsMap.set(d.id, d.properties)
      }
    }

    // 各コンタクトに関連する取引がすべての条件を満たすか確認
    return contacts.filter((contact) => {
      const dealIds = contactDealMap.get(contact.id) ?? []
      if (dealIds.length === 0) return false
      return dealIds.some((dealId) => {
        const props = dealPropsMap.get(dealId)
        if (!props) return false
        return conditions.every((cond) => matchesCondition(props[cond.field], cond))
      })
    })
  }

  async updateContactProperties(
    contactId: string,
    properties: Record<string, string | number>,
  ): Promise<void> {
    const res = await fetch(
      `${this.baseUrl}/crm/v3/objects/contacts/${contactId}`,
      {
        method: 'PATCH',
        headers: this.headers(),
        body: JSON.stringify({ properties }),
      },
    )
    if (!res.ok) throw new Error(`HubSpot update failed: ${res.status}`)
  }

  async testConnection(): Promise<{ portalId: string }> {
    const res = await fetch(`${this.baseUrl}/integrations/v1/me`, {
      headers: this.headers(),
    })
    if (!res.ok) throw new Error(`HubSpot auth failed: ${res.status}`)
    const data = (await res.json()) as { portalId: number }
    return { portalId: String(data.portalId) }
  }
}
