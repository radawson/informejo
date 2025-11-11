import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { TicketStatus } from '@prisma/client'

// GET /api/stats - Get dashboard statistics
export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const isAdmin = session.user.role === 'ADMIN'
    const userId = session.user.id

    const where = isAdmin ? {} : { createdById: userId }

    const [
      totalTickets,
      openTickets,
      inProgressTickets,
      waitingTickets,
      resolvedTickets,
      closedTickets,
      criticalTickets,
      highPriorityTickets,
      myTicketsPriorities,
      openPriorities,
      inProgressPriorities,
      resolvedPriorities,
    ] = await Promise.all([
      prisma.ticket.count({ where }),
      prisma.ticket.count({ where: { ...where, status: TicketStatus.OPEN } }),
      prisma.ticket.count({ where: { ...where, status: TicketStatus.IN_PROGRESS } }),
      prisma.ticket.count({ where: { ...where, status: TicketStatus.WAITING } }),
      prisma.ticket.count({ where: { ...where, status: TicketStatus.RESOLVED } }),
      prisma.ticket.count({ where: { ...where, status: TicketStatus.CLOSED } }),
      prisma.ticket.count({ where: { ...where, priority: 'CRITICAL' } }),
      prisma.ticket.count({ where: { ...where, priority: 'HIGH' } }),
      // Priority breakdown for all user's tickets
      prisma.ticket.groupBy({
        by: ['priority'],
        where,
        _count: true,
      }),
      // Priority breakdown for OPEN tickets
      prisma.ticket.groupBy({
        by: ['priority'],
        where: { ...where, status: TicketStatus.OPEN },
        _count: true,
      }),
      // Priority breakdown for IN_PROGRESS tickets
      prisma.ticket.groupBy({
        by: ['priority'],
        where: { ...where, status: TicketStatus.IN_PROGRESS },
        _count: true,
      }),
      // Priority breakdown for RESOLVED tickets (including CLOSED)
      prisma.ticket.groupBy({
        by: ['priority'],
        where: { ...where, status: { in: [TicketStatus.RESOLVED, TicketStatus.CLOSED] } },
        _count: true,
      }),
    ])

    const stats: any = {
      totalTickets,
      openTickets,
      inProgressTickets,
      waitingTickets,
      resolvedTickets,
      closedTickets,
      criticalTickets,
      highPriorityTickets,
      // Priority breakdown for my tickets (available to all users)
      priorityBreakdown: {
        myTickets: myTicketsPriorities.reduce((acc: any, item: any) => ({ ...acc, [item.priority]: item._count }), {}),
        open: openPriorities.reduce((acc: any, item: any) => ({ ...acc, [item.priority]: item._count }), {}),
        inProgress: inProgressPriorities.reduce((acc: any, item: any) => ({ ...acc, [item.priority]: item._count }), {}),
        resolved: resolvedPriorities.reduce((acc: any, item: any) => ({ ...acc, [item.priority]: item._count }), {}),
      },
    }

    // Admin-specific stats
    if (isAdmin) {
      const [unassignedTickets, myAssignedTickets, resolvedTicketsWithTime, allPriorities, unassignedPriorities, myAssignedPriorities] = await Promise.all([
        prisma.ticket.count({ where: { assignedToId: null, status: { not: TicketStatus.CLOSED } } }),
        prisma.ticket.count({ where: { assignedToId: userId } }),
        prisma.ticket.findMany({
          where: { status: TicketStatus.RESOLVED, resolvedAt: { not: null } },
          select: {
            createdAt: true,
            resolvedAt: true,
          },
        }),
        // Priority breakdown for all tickets
        prisma.ticket.groupBy({
          by: ['priority'],
          _count: true,
        }),
        // Priority breakdown for unassigned tickets
        prisma.ticket.groupBy({
          by: ['priority'],
          where: { assignedToId: null, status: { not: TicketStatus.CLOSED } },
          _count: true,
        }),
        // Priority breakdown for my assigned tickets
        prisma.ticket.groupBy({
          by: ['priority'],
          where: { assignedToId: userId },
          _count: true,
        }),
      ])

      stats.unassignedTickets = unassignedTickets
      stats.myAssignedTickets = myAssignedTickets

      // Add admin-specific priority breakdowns
      stats.priorityBreakdown.all = allPriorities.reduce((acc: any, item: any) => ({ ...acc, [item.priority]: item._count }), {})
      stats.priorityBreakdown.unassigned = unassignedPriorities.reduce((acc: any, item: any) => ({ ...acc, [item.priority]: item._count }), {})
      stats.priorityBreakdown.myAssigned = myAssignedPriorities.reduce((acc: any, item: any) => ({ ...acc, [item.priority]: item._count }), {})

      // Calculate average resolution time in hours
      if (resolvedTicketsWithTime.length > 0) {
        const totalTime = resolvedTicketsWithTime.reduce((acc: number, ticket: any) => {
          const diff = ticket.resolvedAt!.getTime() - ticket.createdAt.getTime()
          return acc + diff
        }, 0)
        const avgTimeMs = totalTime / resolvedTicketsWithTime.length
        stats.avgResolutionTime = Math.round(avgTimeMs / (1000 * 60 * 60)) // Convert to hours
      } else {
        stats.avgResolutionTime = 0
      }
    }

    return NextResponse.json(stats)
  } catch (error) {
    console.error('Error fetching stats:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

