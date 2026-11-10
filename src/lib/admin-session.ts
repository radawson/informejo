import { getServerSession, Session } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { linkKeycloakUserToDatabase, KeycloakLinkError } from '@/lib/keycloak-user-link'
import { Role } from '@/generated/prisma/client'

export type ResolvedSession = Session & {
  user: Session['user'] & {
    id: string
    role: Role
    isKeycloakUser: boolean
    isActive: boolean
    department?: string | null
  }
}

export async function resolveSessionUser(): Promise<ResolvedSession | null> {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return null

  let dbUser = await prisma.user.findUnique({
    where: { id: session.user.id },
  })

  if (!dbUser && session.user.email && session.user.isKeycloakUser) {
    try {
      const linked = await linkKeycloakUserToDatabase({
        id: session.user.id,
        email: session.user.email,
        name: session.user.name || 'User',
        role: (session.user.role as Role) || Role.USER,
      })
      dbUser = linked.user
    } catch (err) {
      if (!(err instanceof KeycloakLinkError)) {
        console.error('resolveSessionUser link failed:', err)
      }
      return null
    }
  }

  if (!dbUser || !dbUser.isActive) {
    if (dbUser && !dbUser.isActive) {
      return null
    }
    if (!dbUser) return null
  }

  return {
    ...session,
    user: {
      ...session.user,
      id: dbUser.id,
      role: dbUser.role,
      isKeycloakUser: dbUser.isKeycloakUser,
      isActive: dbUser.isActive,
      department: dbUser.department ?? session.user.department,
      email: dbUser.email,
      name: dbUser.name,
    },
  }
}

export async function requireAuthenticated(): Promise<ResolvedSession | null> {
  return resolveSessionUser()
}

export async function requireAdmin(): Promise<ResolvedSession | null> {
  const session = await resolveSessionUser()
  if (!session?.user || session.user.role !== Role.ADMIN) return null
  return session
}
