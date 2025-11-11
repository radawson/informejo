import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { validateMagicToken } from '@/lib/magic-link'

/**
 * GET /api/tickets/magic/[token]
 * View ticket using magic link token
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params
    // Validate magic token and get user ID
    const userId = await validateMagicToken(token)

    if (!userId) {
      return NextResponse.json(
        { error: 'Invalid or expired token' },
        { status: 401 }
      )
    }

    // Get all tickets for this user (in case they submitted multiple)
    const tickets = await prisma.ticket.findMany({
      where: { createdById: userId },
      include: {
        createdBy: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
          },
        },
        assignedTo: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
          },
        },
        comments: {
          where: {
            isInternal: false, // Hide internal notes from GUEST users
          },
          include: {
            user: {
              select: {
                id: true,
                name: true,
                email: true,
                role: true,
              },
            },
          },
          orderBy: {
            createdAt: 'asc',
          },
        },
        attachments: {
          include: {
            uploadedBy: {
              select: {
                id: true,
                name: true,
                email: true,
              },
            },
          },
          orderBy: {
            createdAt: 'desc',
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    })

    if (tickets.length === 0) {
      return NextResponse.json(
        { error: 'No tickets found' },
        { status: 404 }
      )
    }

    // Return the most recent ticket
    return NextResponse.json(tickets[0])
  } catch (error) {
    console.error('Error fetching ticket via magic link:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

