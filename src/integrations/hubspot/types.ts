export interface HubSpotContact {
  id: string
  email: string
  firstName?: string
  lastName?: string
  company?: string
  jobTitle?: string
  lifecycle?: string
  leadStatus?: string
  numberOfEmployees?: number
  annualRevenue?: number
  emailOpenCount?: number
  emailClickCount?: number
  lastEmailOpenAt?: Date
}

export interface HubSpotPropertyOption {
  label: string
  value: string
}

export interface HubSpotProperty {
  name: string
  label: string
  type: string       // string, number, enumeration, date, bool
  fieldType: string  // text, select, checkbox, booleancheckbox, etc.
  options?: HubSpotPropertyOption[]
}

export interface HubSpotClient {
  getContacts(): Promise<HubSpotContact[]>
  getProperties(objectType: 'contacts' | 'deals'): Promise<HubSpotProperty[]>
  updateContactProperties(contactId: string, properties: Record<string, string | number>): Promise<void>
  testConnection(): Promise<{ portalId: string }>
}
