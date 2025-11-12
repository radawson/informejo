import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'
import { sendNewCommentEmail } from '@/lib/email'
import { emitToTicket, SocketEvents } from '@/lib/socketio-server'

const createCommentSchema = z.object({
  content: z.string().min(1),
  isInternal: z.boolean().optional(),
})

// POST /api/tickets/[id]/comments - Add comment to ticket
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params
    const ticket = await prisma.ticket.findUnique({
      where: { id },
      include: {
        createdBy: true,
        assignedTo: true,
      },
    })

    if (!ticket) {
      return NextResponse.json({ error: 'Ticket not found' }, { status: 404 })
    }

    // Users can only comment on their own tickets
    if (session.user.role === 'USER' && ticket.createdById !== session.user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = await req.json()
    const data = createCommentSchema.parse(body)

    // Only admins can create internal comments
    const isInternal = session.user.role === 'ADMIN' && data.isInternal

    const comment = await prisma.comment.create({
      data: {
        content: data.content,
        isInternal,
        ticketId: id,
        userId: session.user.id,
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

    // Send email notifications
    // Notify ticket creator
    if (ticket.createdBy.id !== session.user.id) {
      await sendNewCommentEmail(ticket, comment as any, ticket.createdBy, session.user as any)
    }

    // Notify assigned admin
    if (ticket.assignedTo && ticket.assignedTo.id !== session.user.id) {
      await sendNewCommentEmail(ticket, comment as any, ticket.assignedTo, session.user as any)
    }

    // Emit socket event
    emitToTicket(id, SocketEvents.COMMENT_ADDED, comment)

    return NextResponse.json(comment, { status: 201 })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid input', details: error.issues },
        { status: 400 }
      )
    }
    console.error('Error creating comment:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

