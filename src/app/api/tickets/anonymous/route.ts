import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'
import { TicketStatus, TicketPriority, TicketCategory, Role } from '@prisma/client'
import { createMagicLink } from '@/lib/magic-link'
import { sendTicketCreatedEmail, sendNewTicketNotificationToAdmins } from '@/lib/email'

const anonymousTicketSchema = z.object({
  name: z.string().min(2),
  email: z.string().email(),
  title: z.string().min(5).max(200),
  description: z.string().min(10),
  category: z.nativeEnum(TicketCategory),
  priority: z.nativeEnum(TicketPriority).optional(),
})

/**
 * POST /api/tickets/anonymous
 * Submit a ticket without authentication
 * Creates a GUEST user if email doesn't exist
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const data = anonymousTicketSchema.parse(body)

    // Find or create GUEST user
    let user = await prisma.user.findUnique({
      where: { email: data.email },
    })

    if (!user) {
      // Create new GUEST user
      user = await prisma.user.create({
        data: {
          email: data.email,
          name: data.name,
          role: Role.GUEST,
          isKeycloakUser: false,
          isActive: true,
        },
      })
      console.log('Created new GUEST user:', data.email)
    } else if (user.role !== Role.GUEST) {
      // Update name if user exists but is not GUEST
      if (user.name !== data.name) {
        await prisma.user.update({
          where: { id: user.id },
          data: { name: data.name },
        })
      }
    }

    // Create ticket
    const ticket = await prisma.ticket.create({
      data: {
        title: data.title,
        description: data.description,
        category: data.category,
        priority: data.priority || TicketPriority.MEDIUM,
        status: TicketStatus.OPEN,
        createdById: user.id,
      },
      include: {
        createdBy: true,
      },
    })

    // Generate magic link for ticket viewing
    const magicLink = await createMagicLink(user.id)

    // Send confirmation email with magic link
    await sendTicketCreatedEmail(ticket, user, magicLink)

    // Notify admins
    const admins = await prisma.user.findMany({
      where: { role: Role.ADMIN, isActive: true },
    })
    await sendNewTicketNotificationToAdmins(ticket, user, admins)

    console.log('Anonymous ticket created:', ticket.id, 'by', user.email)

    return NextResponse.json({
      success: true,
      ticketId: ticket.id,
      magicLink,
      message: 'Ticket submitted successfully. Check your email for a link to view your ticket.',
    }, { status: 201 })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid input', details: error.issues },
        { status: 400 }
      )
    }
    console.error('Error creating anonymous ticket:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

