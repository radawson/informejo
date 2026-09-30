import { prisma } from '@/lib/prisma'

export const SYSTEM_USER_EMAIL = 'system@informejo.local'
export const SYSTEM_USER_NAME = 'Informejo'

export function isReservedSystemEmail(email: string) {
  return email.trim().toLowerCase() === SYSTEM_USER_EMAIL
}

export async function ensureSystemUser() {
  const existing = await prisma.user.findFirst({
    where: {
      email: { equals: SYSTEM_USER_EMAIL, mode: 'insensitive' },
    },
  })

  if (existing) {
    const alreadySafe =
      existing.isSystem &&
      existing.name === SYSTEM_USER_NAME &&
      existing.password == null &&
      existing.role === 'USER' &&
      !existing.isKeycloakUser

    if (alreadySafe) return existing

    return prisma.user.update({
      where: { id: existing.id },
      data: {
        isSystem: true,
        name: SYSTEM_USER_NAME,
        password: null,
        role: 'USER',
        isKeycloakUser: false,
        isActive: true,
      },
    })
  }

  return prisma.user.create({
    data: {
      email: SYSTEM_USER_EMAIL,
      name: SYSTEM_USER_NAME,
      password: null,
      role: 'USER',
      isSystem: true,
      isActive: true,
      isKeycloakUser: false,
    },
  })
}
