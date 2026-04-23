import type { PrismaClient } from '@/generated/prisma'

/** tenantId フィールドを持たないモデル — ガード対象外 */
const SKIP_MODELS = new Set(['Tenant', 'NurtureLeadSegment'])

/** tenantId なし書き込みは即エラー（テナント間データ混在は致命的） */
const WRITE_OPS = new Set([
  'create',
  'createMany',
  'update',
  'updateMany',
  'delete',
  'deleteMany',
  'upsert',
])

/**
 * upsert の複合 unique キー（例: `{ tenantId_hubspotId: { tenantId: 'x' } }`）に対応するため、
 * オブジェクトのいずれかの階層に tenantId キーが存在するかを再帰的に確認する。
 */
export function containsTenantId(
  obj: Record<string, unknown> | undefined,
  depth = 0,
): boolean {
  if (!obj || depth > 3) return false
  if (obj.tenantId !== undefined) return true
  for (const val of Object.values(obj)) {
    if (val !== null && typeof val === 'object' && !Array.isArray(val)) {
      if (containsTenantId(val as Record<string, unknown>, depth + 1)) return true
    }
  }
  return false
}

export function hasTenantId(operation: string, args: Record<string, unknown>): boolean {
  const where = args.where as Record<string, unknown> | undefined
  const data = args.data
  const create = args.create as Record<string, unknown> | undefined

  switch (operation) {
    case 'create':
      return containsTenantId(data as Record<string, unknown> | undefined)
    case 'createMany': {
      const rows = data as Record<string, unknown>[] | Record<string, unknown> | undefined
      const first = Array.isArray(rows) ? rows[0] : rows
      return containsTenantId(first as Record<string, unknown> | undefined)
    }
    case 'upsert':
      return containsTenantId(where) || containsTenantId(create)
    default:
      // findFirst / findMany / findUnique / update / delete / count など
      return containsTenantId(where)
  }
}

export function withTenantGuard(client: PrismaClient) {
  return client.$extends({
    query: {
      $allModels: {
        $allOperations({ model, operation, args, query }) {
          if (
            model != null &&
            !SKIP_MODELS.has(model) &&
            !hasTenantId(operation, args as Record<string, unknown>)
          ) {
            if (WRITE_OPS.has(operation)) {
              throw new Error(
                `[TenantGuard] ${model}.${operation} には tenantId が必須です。テナント間データ混在を防止しました。`,
              )
            }
            if (process.env.NODE_ENV === 'development') {
              console.warn(
                `[TenantGuard] ${model}.${operation}: where 句に tenantId がありません。` +
                  `意図的でなければスコープを追加してください。`,
              )
            }
          }
          return query(args)
        },
      },
    },
  })
}
