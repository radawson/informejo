import { z } from 'zod'
import { Prisma, TicketCategory, TicketPriority } from '@/generated/prisma/client'
import { prisma } from '@/lib/prisma'
import {
  ORG_TIME_ZONE,
  RecurrenceSpec,
  WeekdayToken,
  WEEKDAYS,
  buildRRule,
  defaultRecurrence,
  describeRecurrence,
  formatWallClock,
  parseRRule,
  parseWallClock,
  resolveNextFireAt,
  untilInstant,
} from '@/lib/recurrence'

const weekdaySchema = z.enum(WEEKDAYS)
const nthSchema = z.union([
  z.literal(1),
  z.literal(2),
  z.literal(3),
  z.literal(4),
  z.literal(-1),
])

export const scheduleBodySchema = z.object({
  title: z.string().trim().min(5).max(200),
  description: z.string().trim().min(10),
  category: z.nativeEnum(TicketCategory),
  priority: z.nativeEnum(TicketPriority).optional(),
  assignedToId: z.string().uuid().nullable().optional(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  time: z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/).nullable().optional(),
  repeats: z.boolean(),
  freq: z.enum(['DAILY', 'WEEKLY', 'MONTHLY', 'YEARLY']).optional(),
  interval: z.number().int().min(1).max(365).optional(),
  weekdays: z.array(weekdaySchema).max(7).optional(),
  monthlyMode: z.enum(['monthday', 'nth', 'lastDay']).optional(),
  monthDay: z.number().int().min(1).max(31).optional(),
  nth: nthSchema.optional(),
  nthWeekday: weekdaySchema.optional(),
  yearMonth: z.number().int().min(1).max(12).optional(),
  yearlyMode: z.enum(['monthday', 'nth', 'lastDay']).optional(),
  untilDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
  isActive: z.boolean().optional(),
})

export type ScheduleBody = z.infer<typeof scheduleBodySchema>

export function specFromBody(body: ScheduleBody): RecurrenceSpec {
  const defaults = defaultRecurrence()
  return {
    repeats: body.repeats,
    freq: body.freq ?? defaults.freq,
    interval: body.interval ?? defaults.interval,
    weekdays: (body.weekdays as WeekdayToken[] | undefined) ?? defaults.weekdays,
    monthlyMode: body.monthlyMode ?? defaults.monthlyMode,
    monthDay: body.monthDay ?? defaults.monthDay,
    nth: body.nth ?? defaults.nth,
    nthWeekday: body.nthWeekday ?? defaults.nthWeekday,
    yearMonth: body.yearMonth ?? defaults.yearMonth,
    yearlyMode: body.yearlyMode ?? defaults.yearlyMode,
    untilDate: body.repeats ? (body.untilDate ?? null) : null,
  }
}

export async function assertActiveAdmin(assignedToId: string | null | undefined) {
  if (!assignedToId) return null

  const admin = await prisma.user.findFirst({
    where: {
      id: assignedToId,
      role: 'ADMIN',
      isActive: true,
      isSystem: false,
    },
    select: { id: true },
  })

  if (!admin) {
    throw new ScheduleInputError('Assignee must be an active admin')
  }

  return admin.id
}

export class ScheduleInputError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ScheduleInputError'
  }
}

const scheduleInclude = Prisma.validator<Prisma.ScheduleInclude>()({
  assignedTo: {
    select: { id: true, name: true, email: true },
  },
  createdBy: {
    select: { id: true, name: true, email: true },
  },
  runs: {
    select: { scheduledFor: true },
    orderBy: { scheduledFor: 'desc' },
    take: 50,
  },
})

type ScheduleWithRelations = Prisma.ScheduleGetPayload<{ include: typeof scheduleInclude }>

export function serializeSchedule(schedule: ScheduleWithRelations) {
  const recurrence = parseRRule(schedule.rrule, schedule.repeats)
  const wall = formatWallClock(schedule.startsAt, schedule.timeZone)
  return {
    id: schedule.id,
    title: schedule.title,
    description: schedule.description,
    category: schedule.category,
    priority: schedule.priority,
    assignedToId: schedule.assignedToId,
    assignedTo: schedule.assignedTo,
    startsAt: schedule.startsAt,
    timeZone: schedule.timeZone,
    repeats: schedule.repeats,
    rrule: schedule.rrule,
    until: schedule.until,
    isActive: schedule.isActive,
    nextFireAt: schedule.nextFireAt,
    createdById: schedule.createdById,
    createdBy: schedule.createdBy,
    createdAt: schedule.createdAt,
    updatedAt: schedule.updatedAt,
    date: wall.date,
    time: wall.time,
    recurrence,
    summary: describeRecurrence(recurrence, schedule.startsAt, schedule.timeZone),
  }
}

function scheduleDataFromBody(body: ScheduleBody) {
  const spec = specFromBody(body)
  let startsAt: Date
  let until: Date | null
  try {
    startsAt = parseWallClock(body.date, body.time, ORG_TIME_ZONE)
    until = untilInstant(spec.untilDate, ORG_TIME_ZONE)
  } catch (error) {
    throw new ScheduleInputError(error instanceof Error ? error.message : 'Invalid date')
  }

  if (until && until < startsAt) {
    throw new ScheduleInputError('End date must be on or after the first occurrence')
  }

  return {
    title: body.title,
    description: body.description,
    category: body.category,
    priority: body.priority ?? TicketPriority.MEDIUM,
    startsAt,
    timeZone: ORG_TIME_ZONE,
    repeats: spec.repeats,
    rrule: buildRRule(spec, ORG_TIME_ZONE),
    until,
  }
}

export async function createSchedule(body: ScheduleBody, createdById: string) {
  const assignedToId = await assertActiveAdmin(body.assignedToId)
  const data = scheduleDataFromBody(body)
  const nextFireAt = resolveNextFireAt({
    startsAt: data.startsAt,
    timeZone: data.timeZone,
    repeats: data.repeats,
    rrule: data.rrule,
    until: data.until,
    now: new Date(),
    firedAt: [],
    mode: 'catch-up',
  })

  const schedule = await prisma.schedule.create({
    data: {
      ...data,
      createdById,
      assignedToId,
      isActive: nextFireAt != null,
      nextFireAt,
    },
    include: scheduleInclude,
  })

  return serializeSchedule(schedule)
}

export async function updateSchedule(id: string, body: ScheduleBody) {
  const existing = await prisma.schedule.findUnique({
    where: { id },
    include: { runs: { select: { scheduledFor: true } } },
  })
  if (!existing) return null

  const assignedToId = await assertActiveAdmin(body.assignedToId)
  const data = scheduleDataFromBody(body)
  const isActive = body.isActive ?? existing.isActive
  const firedAt = existing.runs.map((run) => run.scheduledFor)
  const nextFireAt = isActive
    ? resolveNextFireAt({
        startsAt: data.startsAt,
        timeZone: data.timeZone,
        repeats: data.repeats,
        rrule: data.rrule,
        until: data.until,
        now: new Date(),
        firedAt,
        mode: 'catch-up',
      })
    : existing.nextFireAt

  const schedule = await prisma.schedule.update({
    where: { id },
    data: {
      ...data,
      assignedToId,
      isActive: isActive && nextFireAt != null,
      nextFireAt: isActive ? nextFireAt : existing.nextFireAt,
    },
    include: scheduleInclude,
  })

  return serializeSchedule(schedule)
}

export async function setScheduleActive(id: string, isActive: boolean) {
  const existing = await prisma.schedule.findUnique({
    where: { id },
    include: { runs: { select: { scheduledFor: true } } },
  })
  if (!existing) return null

  if (!isActive) {
    const schedule = await prisma.schedule.update({
      where: { id },
      data: { isActive: false },
      include: scheduleInclude,
    })
    return serializeSchedule(schedule)
  }

  const nextFireAt = resolveNextFireAt({
    startsAt: existing.startsAt,
    timeZone: existing.timeZone,
    repeats: existing.repeats,
    rrule: existing.rrule,
    until: existing.until,
    now: new Date(),
    firedAt: existing.runs.map((run) => run.scheduledFor),
    mode: 'future-only',
  })

  const schedule = await prisma.schedule.update({
    where: { id },
    data: {
      isActive: nextFireAt != null,
      nextFireAt,
    },
    include: scheduleInclude,
  })

  return serializeSchedule(schedule)
}

export async function listSchedules() {
  const schedules = await prisma.schedule.findMany({
    include: scheduleInclude,
    orderBy: [{ isActive: 'desc' }, { nextFireAt: 'asc' }],
  })
  return schedules.map(serializeSchedule)
}

export async function getSchedule(id: string) {
  const schedule = await prisma.schedule.findUnique({
    where: { id },
    include: scheduleInclude,
  })
  return schedule ? serializeSchedule(schedule) : null
}
