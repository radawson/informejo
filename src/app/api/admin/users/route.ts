import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/admin-session'
import { prisma } from '@/lib/prisma'
import { deriveAccountMetadata } from '@/lib/keycloak-user-link'
import { Role, Prisma } from '@/generated/prisma/client'

/**
 * GET /api/admin/users
 * List all users (admin only)
 */
export async function GET(req: NextRequest) {
  try {
    const session = await requireAdmin()
    if (!session) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { searchParams } = new URL(req.url)
    const search = searchParams.get('search') || ''
    const role = searchParams.get('role') || ''
    const ssoLink = searchParams.get('ssoLink') || ''

    const where: Prisma.UserWhereInput = { isSystem: false }

    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
      ]
    }

    if (role && Object.values(Role).includes(role as Role)) {
      where.role = role as Role
    }

    const users = await prisma.user.findMany({
      where,
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        department: true,
        isKeycloakUser: true,
        isActive: true,
        password: true,
        createdAt: true,
        _count: {
          select: {
            createdTickets: true,
            assignedTickets: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    })

    const enriched = users.map((user) => {
      const { password: _password, ...rest } = user
      const meta = deriveAccountMetadata(user)
      return {
        ...rest,
        accountSource: meta.accountSource,
        ssoLinkStatus: meta.ssoLinkStatus,
        userIdDisplay: user.id,
      }
    })

    const filtered =
      ssoLink === 'pending'
        ? enriched.filter((u) => u.ssoLinkStatus === 'pending')
        : enriched

    return NextResponse.json(filtered)
  } catch (error) {
    console.error('Error fetching users:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
