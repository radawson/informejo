import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAdmin } from '@/lib/admin-session'
import { ORG_TIME_ZONE, formatWallClock, occurrencesBetween } from '@/lib/recurrence'

const SAME_INSTANT_MS = 1500

export async function GET(req: NextRequest) {
  const session = await requireAdmin()
  if (!session) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { searchParams } = new URL(req.url)
  const start = new Date(searchParams.get('start') || '')
  const end = new Date(searchParams.get('end') || '')
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    return NextResponse.json({ error: 'start and end are required' }, { status: 400 })
  }

  try {
    const startDay = formatWallClock(start, ORG_TIME_ZONE).date
    const endDay = formatWallClock(new Date(end.getTime() - 1), ORG_TIME_ZONE).date

    const [schedules, runs, notes] = await Promise.all([
      prisma.schedule.findMany({
        where: { isActive: true },
      }),
      prisma.scheduleRun.findMany({
        where: {
          scheduledFor: { gte: start, lte: end },
        },
        include: {
          schedule: { select: { id: true, title: true } },
          ticket: { select: { id: true, title: true, status: true } },
        },
      }),
      prisma.calendarNote.findMany({
        where: {
          day: { gte: startDay, lte: endDay },
        },
        include: {
          createdBy: { select: { id: true, name: true } },
        },
        orderBy: { createdAt: 'asc' },
      }),
    ])

    const events: Array<Record<string, unknown>> = []

    for (const run of runs) {
      events.push({
        id: `run:${run.id}`,
        title: run.ticket.title,
        start: run.scheduledFor.toISOString(),
        allDay: false,
        backgroundColor: '#0f766e',
        borderColor: '#0f766e',
        extendedProps: {
          kind: 'run',
          scheduleId: run.scheduleId,
          ticketId: run.ticketId,
          ticketStatus: run.ticket.status,
          scheduleTitle: run.schedule.title,
        },
      })
    }

    for (const schedule of schedules) {
      const occurrences = occurrencesBetween(
        schedule.startsAt,
        schedule.timeZone,
        schedule.repeats,
        schedule.rrule,
        schedule.until,
        start,
        end
      )

      for (const occurrence of occurrences) {
        const alreadyFired = runs.some(
          (run) =>
            run.scheduleId === schedule.id &&
            Math.abs(run.scheduledFor.getTime() - occurrence.getTime()) < SAME_INSTANT_MS
        )
        if (alreadyFired) continue

        events.push({
          id: `occurrence:${schedule.id}:${occurrence.toISOString()}`,
          title: schedule.title,
          start: occurrence.toISOString(),
          allDay: false,
          backgroundColor: '#2563eb',
          borderColor: '#2563eb',
          extendedProps: {
            kind: 'occurrence',
            scheduleId: schedule.id,
          },
        })
      }
    }

    for (const note of notes) {
      const preview = note.body.trim().split('\n')[0].slice(0, 48)
      events.push({
        id: `note:${note.id}`,
        title: preview || 'Note',
        start: note.day,
        allDay: true,
        backgroundColor: '#d97706',
        borderColor: '#d97706',
        extendedProps: {
          kind: 'note',
          noteId: note.id,
          day: note.day,
          body: note.body,
          authorName: note.createdBy.name,
        },
      })
    }

    return NextResponse.json({ events })
  } catch (error) {
    console.error('Error loading calendar:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
