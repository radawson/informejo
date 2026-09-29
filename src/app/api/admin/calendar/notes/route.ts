import { NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { requireAdmin } from '@/lib/admin-session'

const noteSchema = z.object({
  day: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  body: z.string().trim().min(1).max(5000),
})

export async function GET(req: Request) {
  const session = await requireAdmin()
  if (!session) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { searchParams } = new URL(req.url)
  const day = searchParams.get('day')
  const where = day && /^\d{4}-\d{2}-\d{2}$/.test(day) ? { day } : {}

  const notes = await prisma.calendarNote.findMany({
    where,
    include: { createdBy: { select: { id: true, name: true } } },
    orderBy: { createdAt: 'asc' },
  })

  return NextResponse.json(notes)
}

export async function POST(req: Request) {
  const session = await requireAdmin()
  if (!session) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  try {
    const body = noteSchema.parse(await req.json())
    const note = await prisma.calendarNote.create({
      data: {
        day: body.day,
        body: body.body,
        createdById: session.user.id,
      },
      include: { createdBy: { select: { id: true, name: true } } },
    })
    return NextResponse.json(note, { status: 201 })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid input', details: error.issues }, { status: 400 })
    }
    console.error('Error creating calendar note:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
