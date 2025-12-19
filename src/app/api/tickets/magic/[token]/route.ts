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
    
    if (!token || typeof token !== 'string' || token.trim().length === 0) {
      return NextResponse.json(
        { error: 'Invalid token' },
        { status: 400 }
      )
    }

    const trimmedToken = token.trim()
    let userId: string | null = null
    let specificTicketId: string | null = null

    // Check if input is a ticket ID prefix (12+ characters, admin shortcut) or a full magic token (64 hex characters)
    // 12+ character prefixes are supported as an admin convenience feature
    // Full UUIDs (36 chars with dashes, 32 chars without) can also be used
    if (trimmedToken.length >= 12 && trimmedToken.length < 64) {
      // This is a ticket ID prefix (admin shortcut) - find tickets that start with this ID
      // and check if the creator has a valid magic token
      // Note: Full UUIDs (with or without dashes) are also supported
      // Normalize the token by removing dashes for comparison
      const normalizedToken = trimmedToken.replace(/-/g, '').toLowerCase()
      // Search case-insensitively (UUIDs in DB have dashes, but we'll normalize for comparison)
      const matchingTickets = await prisma.ticket.findMany({
        where: {
          id: {
            startsWith: trimmedToken,
            mode: 'insensitive',
          },
        },
        include: {
          createdBy: {
            select: {
              id: true,
              magicToken: true,
              magicTokenExp: true,
            },
          },
        },
        orderBy: {
          createdAt: 'desc',
        },
      })

      // Filter tickets by normalized ID comparison (handles UUIDs with/without dashes)
      const filteredTickets = matchingTickets.filter(ticket => {
        const normalizedTicketId = ticket.id.replace(/-/g, '').toLowerCase()
        return normalizedTicketId.startsWith(normalizedToken)
      })

      if (filteredTickets.length === 0) {
        return NextResponse.json(
          { error: 'Ticket not found' },
          { status: 404 }
        )
      }

      // If multiple tickets match, find the one where the creator has a valid magic token
      // This handles collisions gracefully
      let foundTicket = null
      for (const ticket of filteredTickets) {
        if (ticket.createdBy.magicToken && ticket.createdBy.magicTokenExp) {
          // Check if token is not expired
          if (ticket.createdBy.magicTokenExp >= new Date()) {
            const normalizedTicketId = ticket.id.replace(/-/g, '').toLowerCase()
            // Prefer exact match if available
            if (normalizedTicketId === normalizedToken) {
              foundTicket = ticket
              break
            }
            // Otherwise, use the first matching ticket
            if (!foundTicket) {
              foundTicket = ticket
            }
          }
        }
      }

      if (!foundTicket) {
        return NextResponse.json(
          { error: 'Invalid or expired ticket access code. Please use the full link from your email.' },
          { status: 401 }
        )
      }

      userId = foundTicket.createdBy.id
      specificTicketId = foundTicket.id
    } else {
      // This is a full magic token - validate it
      userId = await validateMagicToken(trimmedToken)

      if (!userId) {
        return NextResponse.json(
          { error: 'Invalid or expired token' },
          { status: 401 }
        )
      }
    }

    // If we have a specific ticket ID (from short ID lookup), fetch that ticket
    // Otherwise, get all tickets for this user and return the most recent
    const tickets = await prisma.ticket.findMany({
      where: specificTicketId 
        ? { id: specificTicketId, createdById: userId } // Ensure the ticket belongs to the user
        : { createdById: userId },
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

    // Return the specific ticket (if found by ID) or the most recent ticket
    return NextResponse.json(tickets[0])
  } catch (error) {
    console.error('Error fetching ticket via magic link:', error)
    // Log more details for debugging
    if (error instanceof Error) {
      console.error('Error message:', error.message)
      console.error('Error stack:', error.stack)
    }
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

