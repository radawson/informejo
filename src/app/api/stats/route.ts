import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { TicketStatus } from '@/generated/prisma/client'

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
      // Priority breakdown for closed tickets (RESOLVED and CLOSED combined for accounting)
      prisma.ticket.groupBy({
        by: ['priority'],
        where: { ...where, status: { in: [TicketStatus.RESOLVED, TicketStatus.CLOSED] } },
        _count: true,
      }),
    ])

    // For accounting purposes, both RESOLVED and CLOSED are considered "closed"
    const closedTicketsTotal = resolvedTickets + closedTickets

    const stats: any = {
      totalTickets,
      openTickets,
      inProgressTickets,
      waitingTickets,
      resolvedTickets, // Keep separate for display
      closedTickets, // Keep separate for display
      closedTicketsTotal, // Combined count for accounting
      criticalTickets,
      highPriorityTickets,
      // Priority breakdown for my tickets (available to all users)
      priorityBreakdown: {
        myTickets: myTicketsPriorities.reduce((acc: any, item: any) => ({ ...acc, [item.priority]: item._count }), {}),
        open: openPriorities.reduce((acc: any, item: any) => ({ ...acc, [item.priority]: item._count }), {}),
        inProgress: inProgressPriorities.reduce((acc: any, item: any) => ({ ...acc, [item.priority]: item._count }), {}),
        closed: resolvedPriorities.reduce((acc: any, item: any) => ({ ...acc, [item.priority]: item._count }), {}), // Renamed from "resolved" to "closed" to reflect both statuses
      },
    }

    // Admin-specific stats
    if (isAdmin) {
      const [unassignedTickets, myAssignedTickets, closedTicketsWithTime, allPriorities, unassignedPriorities, myAssignedPriorities] = await Promise.all([
        // Exclude both RESOLVED and CLOSED from unassigned (both are considered "closed" for accounting)
        prisma.ticket.count({ where: { assignedToId: null, status: { notIn: [TicketStatus.RESOLVED, TicketStatus.CLOSED] } } }),
        prisma.ticket.count({ where: { assignedToId: userId } }),
        // Include both RESOLVED and CLOSED for average resolution time calculation
        prisma.ticket.findMany({
          where: { 
            status: { in: [TicketStatus.RESOLVED, TicketStatus.CLOSED] },
            resolvedAt: { not: null } 
          },
          select: {
            createdAt: true,
            resolvedAt: true,
            category: true,
            priority: true,
          },
        }),
        // Priority breakdown for all tickets
        prisma.ticket.groupBy({
          by: ['priority'],
          _count: true,
        }),
        // Priority breakdown for unassigned tickets (exclude both RESOLVED and CLOSED)
        prisma.ticket.groupBy({
          by: ['priority'],
          where: { assignedToId: null, status: { notIn: [TicketStatus.RESOLVED, TicketStatus.CLOSED] } },
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

      // Calculate average resolution time in hours (includes both RESOLVED and CLOSED)
      if (closedTicketsWithTime.length > 0) {
        const totalsByCategory = closedTicketsWithTime.reduce((acc: Record<string, { total: number; count: number }>, ticket: any) => {
          const diff = ticket.resolvedAt!.getTime() - ticket.createdAt.getTime()
          const current = acc[ticket.category] ?? { total: 0, count: 0 }
          current.total += diff
          current.count += 1
          acc[ticket.category] = current
          return acc
        }, {})

        const totalsByPriority = closedTicketsWithTime.reduce((acc: Record<string, { total: number; count: number }>, ticket: any) => {
          const diff = ticket.resolvedAt!.getTime() - ticket.createdAt.getTime()
          const current = acc[ticket.priority] ?? { total: 0, count: 0 }
          current.total += diff
          current.count += 1
          acc[ticket.priority] = current
          return acc
        }, {})

        const totalTime = Object.values(totalsByCategory).reduce((acc, item) => acc + item.total, 0)
        const totalCount = Object.values(totalsByCategory).reduce((acc, item) => acc + item.count, 0)
        const avgTimeMs = totalCount > 0 ? totalTime / totalCount : 0
        stats.avgResolutionTime = Math.round(avgTimeMs / (1000 * 60 * 60)) // Convert to hours

        stats.avgResolutionTimeByCategory = Object.entries(totalsByCategory).reduce((acc: Record<string, number>, [category, value]) => {
          const avgCategoryMs = value.count > 0 ? value.total / value.count : 0
          acc[category] = Math.round(avgCategoryMs / (1000 * 60 * 60))
          return acc
        }, {})

        stats.avgResolutionTimeByPriority = Object.entries(totalsByPriority).reduce((acc: Record<string, number>, [priority, value]) => {
          const avgPriorityMs = value.count > 0 ? value.total / value.count : 0
          acc[priority] = Math.round(avgPriorityMs / (1000 * 60 * 60))
          return acc
        }, {})
      } else {
        stats.avgResolutionTime = 0
        stats.avgResolutionTimeByCategory = {}
        stats.avgResolutionTimeByPriority = {}
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

