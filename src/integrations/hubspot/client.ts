import type { HubSpotClient, HubSpotContact } from './types'

interface HsContactProps {
  email?: string
  firstname?: string
  lastname?: string
  company?: string
  jobtitle?: string
  lifecyclestage?: string
  hs_lead_status?: string
}

interface HsContact {
  id: string
  properties: HsContactProps
}

interface HsPage {
  results: HsContact[]
  paging?: { next?: { after: string } }
}

const PROPERTIES = 'email,firstname,lastname,company,jobtitle,lifecyclestage,hs_lead_status'

export class HubSpotHttpClient implements HubSpotClient {
  private readonly baseUrl = 'https://api.hubapi.com'

  constructor(private readonly apiKey: string) {}

  private headers() {
    return {
      Authorization: `Bearer ${this.apiKey}`,
      'Content-Type': 'application/json',
    }
  }

  async getContacts(limit = 500): Promise<HubSpotContact[]> {
    const contacts: HubSpotContact[] = []
    let after: string | undefined

    while (contacts.length < limit) {
      const url = new URL(`${this.baseUrl}/crm/v3/objects/contacts`)
      url.searchParams.set('limit', '100')
      url.searchParams.set('properties', PROPERTIES)
      if (after) url.searchParams.set('after', after)

      const res = await fetch(url.toString(), { headers: this.headers() })
      if (!res.ok) throw new Error(`HubSpot API error: ${res.status}`)

      const page = (await res.json()) as HsPage
      for (const c of page.results) {
        const p = c.properties
        if (p.email) {
          contacts.push({
            id: c.id,
            email: p.email,
            firstName: p.firstname,
            lastName: p.lastname,
            company: p.company,
            jobTitle: p.jobtitle,
            lifecycle: p.lifecyclestage,
            leadStatus: p.hs_lead_status,
          })
        }
      }

      after = page.paging?.next?.after
      if (!after) break
    }

    return contacts
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
