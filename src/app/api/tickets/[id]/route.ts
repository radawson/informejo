import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'
import { TicketStatus, TicketPriority } from '@/generated/prisma/client'
import { sendTicketStatusUpdateEmail, sendTicketAssignedEmail } from '@/lib/email'
import { emitToTicket, emitToAll, SocketEvents } from '@/lib/socketio-server'

const updateTicketSchema = z.object({
  title: z.string().min(5).max(200).optional(),
  description: z.string().min(10).optional(),
  status: z.nativeEnum(TicketStatus).optional(),
  priority: z.nativeEnum(TicketPriority).optional(),
  assignedToId: z.string().nullable().optional(),
})

// GET /api/tickets/[id] - Get single ticket
export async function GET(
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
        createdBy: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
            department: true,
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
    })

    if (!ticket) {
      return NextResponse.json({ error: 'Ticket not found' }, { status: 404 })
    }

    // Users can only view their own tickets
    if (session.user.role === 'USER' && ticket.createdById !== session.user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Filter out internal comments for non-admin users
    if (session.user.role !== 'ADMIN') {
      ticket.comments = ticket.comments.filter(comment => !comment.isInternal)
    }

    return NextResponse.json(ticket)
  } catch (error) {
    console.error('Error fetching ticket:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// PATCH /api/tickets/[id] - Update ticket
export async function PATCH(
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

    // Users can only update their own tickets (limited fields)
    if (session.user.role === 'USER' && ticket.createdById !== session.user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = await req.json()
    const data = updateTicketSchema.parse(body)

    // Only admins can update status, priority, and assignment
    if (session.user.role === 'USER') {
      delete data.status
      delete data.priority
      delete data.assignedToId
    }

    const oldStatus = ticket.status
    const oldAssignedToId = ticket.assignedToId

    const updatedTicket = await prisma.ticket.update({
      where: { id },
      data: {
        ...data,
        resolvedAt: data.status === TicketStatus.RESOLVED && !ticket.resolvedAt
          ? new Date()
          : ticket.resolvedAt,
      },
      include: {
        createdBy: true,
        assignedTo: true,
        comments: {
          include: {
            user: true,
          },
        },
        attachments: {
          include: {
            uploadedBy: true,
          },
        },
      },
    })

    // Send notifications
    if (data.status && data.status !== oldStatus) {
      // Notify ticket creator
      await sendTicketStatusUpdateEmail(
        updatedTicket,
        ticket.createdBy,
        oldStatus,
        data.status
      )
      
      // Notify assigned person (if different from creator)
      if (updatedTicket.assignedTo && updatedTicket.assignedTo.id !== ticket.createdBy.id) {
        await sendTicketStatusUpdateEmail(
          updatedTicket,
          updatedTicket.assignedTo,
          oldStatus,
          data.status
        )
      }
    }

    if (data.assignedToId !== undefined && data.assignedToId !== oldAssignedToId && data.assignedToId) {
      const assignedUser = await prisma.user.findUnique({
        where: { id: data.assignedToId },
      })
      if (assignedUser) {
        await sendTicketAssignedEmail(updatedTicket, assignedUser)
      }
    }

    // Emit socket event
    emitToAll(SocketEvents.TICKET_UPDATED, updatedTicket)
    emitToTicket(id, SocketEvents.TICKET_UPDATED, updatedTicket)

    return NextResponse.json(updatedTicket)
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid input', details: error.issues },
        { status: 400 }
      )
    }
    console.error('Error updating ticket:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// DELETE /api/tickets/[id] - Delete ticket (admin only)
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user || session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { id } = await params
    
    // Get ticket data before deletion for websocket event
    const ticket = await prisma.ticket.findUnique({
      where: { id },
      include: {
        createdBy: true,
        assignedTo: true,
      },
    })

    await prisma.ticket.delete({
      where: { id },
    })

    // Emit websocket event for ticket deletion
    if (ticket) {
      emitToAll(SocketEvents.TICKET_DELETED, { id, ticket })
      emitToTicket(id, SocketEvents.TICKET_DELETED, { id, ticket })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting ticket:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

