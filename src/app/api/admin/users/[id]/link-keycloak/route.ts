import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/admin-session'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'
import { Role } from '@/generated/prisma/client'
import {
  deriveAccountMetadata,
  KeycloakLinkError,
  linkKeycloakUserToDatabase,
} from '@/lib/keycloak-user-link'

const linkSchema = z.object({
  keycloakId: z.string().uuid(),
  role: z.nativeEnum(Role).optional(),
  activate: z.boolean().optional(),
})

/**
 * POST /api/admin/users/[id]/link-keycloak
 * Manually migrate a guest user to a Keycloak subject id
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await requireAdmin()
  if (!session) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { id: guestUserId } = await params

  try {
    const body = await req.json()
    const data = linkSchema.parse(body)

    const guest = await prisma.user.findUnique({ where: { id: guestUserId } })
    if (!guest || guest.isSystem) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    const meta = deriveAccountMetadata(guest)
    if (meta.ssoLinkStatus !== 'pending') {
      return NextResponse.json(
        { error: 'User is not eligible for SSO link' },
        { status: 400 }
      )
    }

    const conflict = await prisma.user.findUnique({ where: { id: data.keycloakId } })
    if (conflict && conflict.id !== guestUserId) {
      return NextResponse.json(
        { error: 'Keycloak user id is already assigned to another account' },
        { status: 409 }
      )
    }

    const role = data.role ?? (guest.role === Role.GUEST ? Role.USER : guest.role)
    if (role === Role.GUEST) {
      return NextResponse.json({ error: 'Linked SSO users cannot remain GUEST' }, { status: 400 })
    }

    const result = await linkKeycloakUserToDatabase({
      id: data.keycloakId,
      email: guest.email,
      name: guest.name,
      role,
      migrateFromUserId: guestUserId,
      activate: data.activate ?? true,
    })

    console.log(
      `User ${guest.email} linked to Keycloak ${data.keycloakId} by ${session.user.email}`
    )

    const userMeta = deriveAccountMetadata(result.user)

    return NextResponse.json({
      user: {
        ...result.user,
        accountSource: userMeta.accountSource,
        ssoLinkStatus: userMeta.ssoLinkStatus,
        userIdDisplay: result.user.id,
      },
      reassigned: result.reassigned,
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid input', details: error.issues },
        { status: 400 }
      )
    }
    if (error instanceof KeycloakLinkError) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }
    console.error('Error linking Keycloak user:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
