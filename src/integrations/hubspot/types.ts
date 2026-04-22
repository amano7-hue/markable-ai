export interface HubSpotContact {
  id: string
  email: string
  firstName?: string
  lastName?: string
  company?: string
  jobTitle?: string
  lifecycle?: string
  leadStatus?: string
}

export interface HubSpotClient {
  getContacts(limit?: number): Promise<HubSpotContact[]>
  testConnection(): Promise<{ portalId: string }>
}
