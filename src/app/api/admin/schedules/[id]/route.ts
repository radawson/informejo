import { NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { requireAdmin } from '@/lib/admin-session'
import {
  getSchedule,
  ScheduleInputError,
  scheduleBodySchema,
  setScheduleActive,
  updateSchedule,
} from '@/lib/schedules'

const activeSchema = z.object({
  isActive: z.boolean(),
})

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await requireAdmin()
  if (!session) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { id } = await params
  const schedule = await getSchedule(id)
  if (!schedule) {
    return NextResponse.json({ error: 'Schedule not found' }, { status: 404 })
  }
  return NextResponse.json(schedule)
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await requireAdmin()
  if (!session) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { id } = await params

  try {
    const json = await req.json()
    const activeOnly = activeSchema.safeParse(json)
    if (activeOnly.success && json.title == null && json.date == null) {
      const schedule = await setScheduleActive(id, activeOnly.data.isActive)
      if (!schedule) {
        return NextResponse.json({ error: 'Schedule not found' }, { status: 404 })
      }
      return NextResponse.json(schedule)
    }

    const body = scheduleBodySchema.parse(json)
    const schedule = await updateSchedule(id, body)
    if (!schedule) {
      return NextResponse.json({ error: 'Schedule not found' }, { status: 404 })
    }
    return NextResponse.json(schedule)
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid input', details: error.issues }, { status: 400 })
    }
    if (error instanceof ScheduleInputError) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }
    console.error('Error updating schedule:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await requireAdmin()
  if (!session) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { id } = await params
  const existing = await prisma.schedule.findUnique({ where: { id }, select: { id: true } })
  if (!existing) {
    return NextResponse.json({ error: 'Schedule not found' }, { status: 404 })
  }

  await prisma.schedule.delete({ where: { id } })
  return NextResponse.json({ success: true })
}
