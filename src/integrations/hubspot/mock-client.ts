import type { HubSpotClient, HubSpotContact } from './types'

const MOCK_CONTACTS: HubSpotContact[] = [
  { id: 'hs1', email: 'cto@acme.co.jp', firstName: '田中', lastName: '一郎', company: 'ACME株式会社', jobTitle: 'CTO', lifecycle: 'marketingqualifiedlead' },
  { id: 'hs2', email: 'marketing@betacorp.jp', firstName: '鈴木', lastName: '花子', company: 'ベータコープ', jobTitle: 'Marketing Manager', lifecycle: 'lead' },
  { id: 'hs3', email: 'ceo@gamma.jp', firstName: '佐藤', lastName: '次郎', company: 'ガンマ株式会社', jobTitle: 'CEO', lifecycle: 'salesqualifiedlead' },
  { id: 'hs4', email: 'vp@delta-tech.co.jp', firstName: '伊藤', lastName: '三郎', company: 'デルタテック', jobTitle: 'VP of Sales', lifecycle: 'marketingqualifiedlead' },
  { id: 'hs5', email: 'director@epsilon.co.jp', firstName: '渡辺', lastName: '四郎', company: 'イプシロン', jobTitle: 'Director of Operations', lifecycle: 'lead' },
  { id: 'hs6', email: 'cmo@zeta.jp', firstName: '山本', lastName: '五郎', company: 'ゼータ株式会社', jobTitle: 'CMO', lifecycle: 'opportunity' },
  { id: 'hs7', email: 'pm@eta-sys.co.jp', firstName: '中村', lastName: '六子', company: 'イータシステムズ', jobTitle: 'Product Manager', lifecycle: 'lead' },
  { id: 'hs8', email: 'coo@theta.jp', firstName: '小林', lastName: '七郎', company: 'シータ株式会社', jobTitle: 'COO', lifecycle: 'salesqualifiedlead' },
  { id: 'hs9', email: 'engineer@iota.co.jp', firstName: '加藤', lastName: '八子', company: 'イオタ', jobTitle: 'Senior Engineer', lifecycle: 'lead' },
  { id: 'hs10', email: 'biz@kappa.jp', firstName: '吉田', lastName: '九郎', company: 'カッパテック', jobTitle: 'Business Dev Manager', lifecycle: 'marketingqualifiedlead' },
  { id: 'hs11', email: 'cfo@lambda.co.jp', firstName: '山田', lastName: '十子', company: 'ラムダ株式会社', jobTitle: 'CFO', lifecycle: 'lead' },
  { id: 'hs12', email: 'sales@mu.jp', firstName: '松本', lastName: '一郎', company: 'ミュー株式会社', jobTitle: 'Sales Director', lifecycle: 'salesqualifiedlead' },
  { id: 'hs13', email: 'hr@nu.co.jp', firstName: '井上', lastName: '花子', company: 'ニュー', jobTitle: 'HR Manager', lifecycle: 'lead' },
  { id: 'hs14', email: 'cto@xi-cloud.jp', firstName: '木村', lastName: '次郎', company: 'クサイクラウド', jobTitle: 'CTO', lifecycle: 'marketingqualifiedlead' },
  { id: 'hs15', email: 'founder@omicron.jp', firstName: '林', lastName: '三郎', company: 'オミクロン', jobTitle: 'Founder & CEO', lifecycle: 'opportunity' },
  { id: 'hs16', email: 'vp.marketing@pi.co.jp', firstName: '清水', lastName: '四子', company: 'パイ株式会社', jobTitle: 'VP of Marketing', lifecycle: 'salesqualifiedlead' },
  { id: 'hs17', email: 'analyst@rho.jp', firstName: '斎藤', lastName: '五郎', company: 'ロー', jobTitle: 'Business Analyst', lifecycle: 'lead' },
  { id: 'hs18', email: 'cso@sigma.co.jp', firstName: '橋本', lastName: '六郎', company: 'シグマ株式会社', jobTitle: 'Chief Strategy Officer', lifecycle: 'marketingqualifiedlead' },
  { id: 'hs19', email: 'tech.lead@tau.jp', firstName: '藤原', lastName: '七子', company: 'タウテック', jobTitle: 'Tech Lead', lifecycle: 'lead' },
  { id: 'hs20', email: 'ceo@upsilon.co.jp', firstName: '岡田', lastName: '八郎', company: 'ウプシロン株式会社', jobTitle: 'CEO', lifecycle: 'opportunity' },
]

export class HubSpotMockClient implements HubSpotClient {
  async getContacts(_limit = 500): Promise<HubSpotContact[]> {
    return MOCK_CONTACTS
  }

  async testConnection(): Promise<{ portalId: string }> {
    return { portalId: 'mock-portal-12345' }
  }
}
