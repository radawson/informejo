import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { validateMagicToken } from '@/lib/magic-link'
import { z } from 'zod'
import { emitToTicket, SocketEvents } from '@/lib/socketio-server'

const commentSchema = z.object({
  content: z.string().min(1),
})

/**
 * POST /api/tickets/magic/[token]/comment
 * Add comment to ticket using magic link token
 */
export async function POST(
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

    const body = await req.json()
    const { content } = commentSchema.parse(body)

    // Get the most recent ticket for this user
    const ticket = await prisma.ticket.findFirst({
      where: { createdById: userId },
      orderBy: { createdAt: 'desc' },
      include: {
        assignedTo: true,
        createdBy: true,
      },
    })

    if (!ticket) {
      return NextResponse.json(
        { error: 'Ticket not found' },
        { status: 404 }
      )
    }

    // Create comment
    const comment = await prisma.comment.create({
      data: {
        content,
        isInternal: false,
        ticketId: ticket.id,
        userId: userId,
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
    })

    // TODO: Send notification email to assigned admin

    // Emit websocket event for comment creation
    emitToTicket(ticket.id, SocketEvents.COMMENT_ADDED, comment)

    return NextResponse.json(comment, { status: 201 })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid input', details: error.issues },
        { status: 400 }
      )
    }
    console.error('Error creating comment via magic link:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

