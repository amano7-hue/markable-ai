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
}

export interface HubSpotClient {
  getContacts(): Promise<HubSpotContact[]>
  updateContactProperties(contactId: string, properties: Record<string, string | number>): Promise<void>
  testConnection(): Promise<{ portalId: string }>
}
