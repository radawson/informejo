import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/admin-session'
import { prisma } from '@/lib/prisma'
import { deriveAccountMetadata, getGuestLinkImpactCounts } from '@/lib/keycloak-user-link'

/**
 * GET /api/admin/users/[id]/sso-link-preview
 * Preview FK impact before linking a guest to a Keycloak id
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await requireAdmin()
  if (!session) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { id } = await params
  const user = await prisma.user.findUnique({ where: { id } })
  if (!user || user.isSystem) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 })
  }

  const meta = deriveAccountMetadata(user)
  if (meta.ssoLinkStatus !== 'pending') {
    return NextResponse.json(
      { error: 'User is not eligible for SSO link (must be a pending guest account)' },
      { status: 400 }
    )
  }

  const reassigned = await getGuestLinkImpactCounts(id)

  return NextResponse.json({
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      isActive: user.isActive,
    },
    reassigned,
  })
}
