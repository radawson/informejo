import { Ticket, User } from '@/types'
import { TicketStatus } from '@/generated/prisma/client'
import { prisma } from '@/lib/prisma'
import { ensureSystemUser, SYSTEM_USER_EMAIL } from '@/lib/system-user'
import { resolveNextFireAt } from '@/lib/recurrence'
import { SCHEDULE_RUN_LOCK_KEY } from '@/lib/schedule-lock'
import { sendNewTicketNotificationToAdmins } from '@/lib/email'
import { emitToAll, SocketEvents } from '@/lib/socketio-server'

export async function runDueSchedules() {
  const systemUser = await ensureSystemUser()
  if (systemUser.email !== SYSTEM_USER_EMAIL) {
    throw new Error('System user is not configured')
  }

  const createdTickets = await prisma.$transaction(async (tx) => {
    const lockRows = await tx.$queryRaw<Array<{ locked: boolean }>>`
      SELECT pg_try_advisory_xact_lock(${SCHEDULE_RUN_LOCK_KEY}) AS locked
    `
    if (!lockRows[0]?.locked) {
      return []
    }

    const due = await tx.schedule.findMany({
      where: {
        isActive: true,
        nextFireAt: { lte: new Date() },
      },
      orderBy: { nextFireAt: 'asc' },
      include: {
        runs: { select: { scheduledFor: true } },
      },
    })

    const tickets = []

    for (const schedule of due) {
      if (!schedule.nextFireAt) continue
      const scheduledFor = schedule.nextFireAt
      const nextFireAt = resolveNextFireAt({
        startsAt: schedule.startsAt,
        timeZone: schedule.timeZone,
        repeats: schedule.repeats,
        rrule: schedule.rrule,
        until: schedule.until,
        now: new Date(),
        firedAt: [...schedule.runs.map((run) => run.scheduledFor), scheduledFor],
        mode: 'future-only',
      })

      const claim = await tx.schedule.updateMany({
        where: {
          id: schedule.id,
          isActive: true,
          nextFireAt: scheduledFor,
        },
        data: nextFireAt
          ? { nextFireAt, isActive: true }
          : { nextFireAt: null, isActive: false },
      })
      if (claim.count !== 1) continue

      let assignedToId = schedule.assignedToId
      if (assignedToId) {
        const assignee = await tx.user.findFirst({
          where: {
            id: assignedToId,
            role: 'ADMIN',
            isActive: true,
            isSystem: false,
          },
          select: { id: true },
        })
        if (!assignee) {
          assignedToId = null
          await tx.schedule.update({
            where: { id: schedule.id },
            data: { assignedToId: null },
          })
        }
      }

      const ticket = await tx.ticket.create({
        data: {
          title: schedule.title,
          description: schedule.description,
          category: schedule.category,
          priority: schedule.priority,
          status: TicketStatus.OPEN,
          createdById: systemUser.id,
          assignedToId,
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
          assignedTo: {
            select: {
              id: true,
              name: true,
              email: true,
              role: true,
            },
          },
        },
      })

      await tx.scheduleRun.create({
        data: {
          scheduleId: schedule.id,
          ticketId: ticket.id,
          scheduledFor,
        },
      })

      tickets.push(ticket)
    }

    return tickets
  })

  if (createdTickets.length === 0) {
    return { created: 0 }
  }

  const admins = await prisma.user.findMany({
    where: { role: 'ADMIN', isActive: true, isSystem: false },
  })

  for (const ticket of createdTickets) {
    try {
      await sendNewTicketNotificationToAdmins(
        ticket as unknown as Ticket,
        systemUser as unknown as User,
        admins as unknown as User[]
      )
    } catch (error) {
      console.error('[scheduler] Failed to email admins for ticket', ticket.id, error)
    }
    emitToAll(SocketEvents.TICKET_CREATED, ticket)
  }

  return { created: createdTickets.length }
}
