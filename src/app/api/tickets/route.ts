import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'
import { TicketStatus, TicketPriority, TicketCategory } from '@prisma/client'
import { sendTicketCreatedEmail, sendNewTicketNotificationToAdmins } from '@/lib/email'

const createTicketSchema = z.object({
  title: z.string().min(5).max(200),
  description: z.string().min(10),
  category: z.nativeEnum(TicketCategory),
  priority: z.nativeEnum(TicketPriority).optional(),
})

// GET /api/tickets - List tickets (filtered by user role)
export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(req.url)
    const status = searchParams.get('status') as TicketStatus | null
    const priority = searchParams.get('priority') as TicketPriority | null
    const assignedToMe = searchParams.get('assignedToMe') === 'true'

    const where: any = {}

    // Regular users only see their own tickets
    if (session.user.role === 'USER') {
      where.createdById = session.user.id
    }

    // Admins can filter by assigned to them
    if (session.user.role === 'ADMIN' && assignedToMe) {
      where.assignedToId = session.user.id
    }

    if (status) {
      where.status = status
    }

    if (priority) {
      where.priority = priority
    }

    const tickets = await prisma.ticket.findMany({
      where,
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
        _count: {
          select: {
            comments: true,
            attachments: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    })

    return NextResponse.json(tickets)
  } catch (error) {
    console.error('Error fetching tickets:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// POST /api/tickets - Create a new ticket
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json()
    const data = createTicketSchema.parse(body)

    const ticket = await prisma.ticket.create({
      data: {
        title: data.title,
        description: data.description,
        category: data.category,
        priority: data.priority || TicketPriority.MEDIUM,
        status: TicketStatus.OPEN,
        createdById: session.user.id,
      },
      include: {
        createdBy: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
            department: true,
            isKeycloakUser: true,
            createdAt: true,
            updatedAt: true,
          },
        },
        assignedTo: true,
      },
    })

    // Send confirmation email to user
    await sendTicketCreatedEmail(ticket, session.user as any)

    // Get all admins and notify them
    const admins = await prisma.user.findMany({
      where: { role: 'ADMIN' },
    })
    await sendNewTicketNotificationToAdmins(ticket, session.user as any, admins)

    // Emit socket event
    if ((global as any).io) {
      (global as any).io.emit('ticket:created', ticket)
    }

    return NextResponse.json(ticket, { status: 201 })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid input', details: error.issues },
        { status: 400 }
      )
    }
    console.error('Error creating ticket:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

