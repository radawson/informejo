import { NextResponse } from 'next/server'
import { runDueSchedules } from '@/lib/schedule-runner'

export async function POST(req: Request) {
  const expected = process.env['SCHEDULE_INTERNAL_SECRET']
  const provided = req.headers.get('x-schedule-secret')

  if (!expected || !provided || provided !== expected) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  try {
    const result = await runDueSchedules()
    return NextResponse.json(result)
  } catch (error) {
    console.error('[scheduler] Failed to run due schedules:', error)
    return NextResponse.json({ error: 'Scheduler failed' }, { status: 500 })
  }
}
