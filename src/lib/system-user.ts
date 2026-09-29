import { prisma } from '@/lib/prisma'

export const SYSTEM_USER_EMAIL = 'system@informejo.local'
export const SYSTEM_USER_NAME = 'Informejo'

export async function ensureSystemUser() {
  const existing = await prisma.user.findUnique({
    where: { email: SYSTEM_USER_EMAIL },
  })

  if (existing) {
    if (!existing.isSystem || existing.name !== SYSTEM_USER_NAME) {
      return prisma.user.update({
        where: { id: existing.id },
        data: { isSystem: true, name: SYSTEM_USER_NAME },
      })
    }
    return existing
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
