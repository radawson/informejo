import { prisma } from '@/lib/prisma'
import { Role, User } from '@/generated/prisma/client'
import { Prisma } from '@/generated/prisma/client'
import { isReservedSystemEmail } from '@/lib/system-user'

export type ReassignedCounts = {
  ticketsCreated: number
  ticketsAssigned: number
  comments: number
  attachments: number
  schedulesCreated: number
  schedulesAssigned: number
  calendarNotes: number
}

export type LinkKeycloakInput = {
  id: string
  email: string
  name: string
  role: Role
  /** When set (admin link), migrate this user row instead of email lookup */
  migrateFromUserId?: string
  activate?: boolean
}

export type LinkKeycloakResult = {
  user: User
  reassigned: ReassignedCounts
  linkedFromGuest: boolean
}

function normalizeEmail(email: string) {
  return email.trim().toLowerCase()
}

export async function getGuestLinkImpactCounts(userId: string): Promise<ReassignedCounts> {
  const [
    ticketsCreated,
    ticketsAssigned,
    comments,
    attachments,
    schedulesCreated,
    schedulesAssigned,
    calendarNotes,
  ] = await Promise.all([
    prisma.ticket.count({ where: { createdById: userId } }),
    prisma.ticket.count({ where: { assignedToId: userId } }),
    prisma.comment.count({ where: { userId } }),
    prisma.attachment.count({ where: { uploadedById: userId } }),
    prisma.schedule.count({ where: { createdById: userId } }),
    prisma.schedule.count({ where: { assignedToId: userId } }),
    prisma.calendarNote.count({ where: { createdById: userId } }),
  ])
  return {
    ticketsCreated,
    ticketsAssigned,
    comments,
    attachments,
    schedulesCreated,
    schedulesAssigned,
    calendarNotes,
  }
}

async function reassignUserForeignKeys(
  tx: Prisma.TransactionClient,
  oldId: string,
  newId: string
): Promise<ReassignedCounts> {
  const counts = await getGuestLinkImpactCounts(oldId)

  await tx.ticket.updateMany({ where: { createdById: oldId }, data: { createdById: newId } })
  await tx.ticket.updateMany({ where: { assignedToId: oldId }, data: { assignedToId: newId } })
  await tx.comment.updateMany({ where: { userId: oldId }, data: { userId: newId } })
  await tx.attachment.updateMany({ where: { uploadedById: oldId }, data: { uploadedById: newId } })
  await tx.schedule.updateMany({ where: { createdById: oldId }, data: { createdById: newId } })
  await tx.schedule.updateMany({ where: { assignedToId: oldId }, data: { assignedToId: newId } })
  await tx.calendarNote.updateMany({ where: { createdById: oldId }, data: { createdById: newId } })

  return counts
}

async function migrateUserToKeycloakId(
  tx: Prisma.TransactionClient,
  oldUser: User,
  keycloakId: string,
  data: { email: string; name: string; role: Role; isActive: boolean }
): Promise<ReassignedCounts> {
  const legacyEmail = `${oldUser.email}.legacy-${oldUser.id}`
  const magicToken = oldUser.magicToken
  const magicTokenExp = oldUser.magicTokenExp

  await tx.user.update({
    where: { id: oldUser.id },
    data: { magicToken: null, magicTokenExp: null },
  })

  await tx.user.create({
    data: {
      id: keycloakId,
      email: data.email,
      name: data.name,
      role: data.role,
      department: oldUser.department,
      password: null,
      isKeycloakUser: true,
      isActive: data.isActive,
      isSystem: false,
      magicToken,
      magicTokenExp,
      createdAt: oldUser.createdAt,
    },
  })

  await tx.user.update({
    where: { id: oldUser.id },
    data: { email: legacyEmail },
  })

  const reassigned = await reassignUserForeignKeys(tx, oldUser.id, keycloakId)

  await tx.user.delete({ where: { id: oldUser.id } })

  return reassigned
}

export class KeycloakLinkError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'KeycloakLinkError'
  }
}

export async function linkKeycloakUserToDatabase(
  input: LinkKeycloakInput
): Promise<LinkKeycloakResult> {
  const email = normalizeEmail(input.email)
  if (isReservedSystemEmail(email)) {
    throw new KeycloakLinkError('Reserved system email cannot use Keycloak')
  }

  const existingById = await prisma.user.findUnique({ where: { id: input.id } })
  if (existingById) {
    if (existingById.isSystem) {
      throw new KeycloakLinkError('System user cannot use Keycloak')
    }
    const user = await prisma.user.update({
      where: { id: input.id },
      data: {
        email: existingById.email.toLowerCase() === email ? undefined : email,
        name: input.name,
        role: input.role,
        isKeycloakUser: true,
        password: null,
        ...(input.activate === true ? { isActive: true } : {}),
      },
    })
    return {
      user,
      reassigned: emptyReassigned(),
      linkedFromGuest: false,
    }
  }

  let guestUser: User | null = null

  if (input.migrateFromUserId) {
    guestUser = await prisma.user.findUnique({ where: { id: input.migrateFromUserId } })
    if (!guestUser) {
      throw new KeycloakLinkError('Guest user not found')
    }
    if (guestUser.isSystem) {
      throw new KeycloakLinkError('Cannot link system user')
    }
    if (guestUser.id === input.id) {
      guestUser = null
    }
  } else {
    guestUser = await prisma.user.findFirst({
      where: { email: { equals: email, mode: 'insensitive' } },
    })
    if (guestUser && guestUser.id === input.id) {
      guestUser = null
    }
  }

  if (guestUser) {
    if (guestUser.isSystem) {
      throw new KeycloakLinkError('Cannot replace system user')
    }

    const isActive =
      input.activate !== undefined ? input.activate : guestUser.role === Role.GUEST ? true : guestUser.isActive

    const result = await prisma.$transaction(async (tx) => {
      const fresh = await tx.user.findUnique({ where: { id: guestUser!.id } })
      if (!fresh) throw new KeycloakLinkError('Guest user not found')
      const reassigned = await migrateUserToKeycloakId(tx, fresh, input.id, {
        email,
        name: input.name || fresh.name,
        role: input.role,
        isActive,
      })
      const user = await tx.user.findUniqueOrThrow({ where: { id: input.id } })
      return { user, reassigned }
    })

    return { ...result, linkedFromGuest: true }
  }

  const user = await prisma.user.create({
    data: {
      id: input.id,
      email,
      name: input.name || 'User',
      role: input.role,
      isKeycloakUser: true,
      isActive: input.activate !== false,
      password: null,
    },
  })

  return {
    user,
    reassigned: emptyReassigned(),
    linkedFromGuest: false,
  }
}

function emptyReassigned(): ReassignedCounts {
  return {
    ticketsCreated: 0,
    ticketsAssigned: 0,
    comments: 0,
    attachments: 0,
    schedulesCreated: 0,
    schedulesAssigned: 0,
    calendarNotes: 0,
  }
}

export type AccountSource = 'guest' | 'local' | 'sso'
export type SsoLinkStatus = 'linked' | 'pending' | 'local_only'

export function deriveAccountMetadata(user: {
  role: Role
  isKeycloakUser: boolean
  password: string | null
}) {
  let accountSource: AccountSource = 'local'
  if (user.isKeycloakUser) {
    accountSource = 'sso'
  } else if (user.role === Role.GUEST) {
    accountSource = 'guest'
  } else if (user.password) {
    accountSource = 'local'
  } else {
    accountSource = 'guest'
  }

  let ssoLinkStatus: SsoLinkStatus = 'local_only'
  if (user.isKeycloakUser) {
    ssoLinkStatus = 'linked'
  } else if (user.role === Role.GUEST || (!user.isKeycloakUser && !user.password)) {
    ssoLinkStatus = 'pending'
  }

  return { accountSource, ssoLinkStatus }
}
