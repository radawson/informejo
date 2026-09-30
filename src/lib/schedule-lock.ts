import { Prisma } from '@/generated/prisma/client'
import { prisma } from '@/lib/prisma'

export const SCHEDULE_RUN_LOCK_KEY = BigInt(814271901)

export async function withScheduleLock<T>(
  fn: (tx: Prisma.TransactionClient) => Promise<T>
): Promise<T> {
  return prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(${SCHEDULE_RUN_LOCK_KEY})`
    return fn(tx)
  })
}
