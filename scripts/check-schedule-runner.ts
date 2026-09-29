import { prisma } from '../src/lib/prisma'
import { createSchedule } from '../src/lib/schedules'
import { runDueSchedules } from '../src/lib/schedule-runner'

async function main() {
  const admin = await prisma.user.create({
    data: {
      email: 'admin-test@example.com',
      name: 'Admin Test',
      role: 'ADMIN',
      isActive: true,
      password: 'x',
    },
  })

  const schedule = await createSchedule({
    title: 'Renew the certificate',
    description: 'Check the TLS certificate and renew it.',
    category: 'OTHER',
    priority: 'HIGH',
    assignedToId: admin.id,
    date: '2020-01-31',
    time: '',
    repeats: true,
    freq: 'MONTHLY',
    interval: 1,
    monthlyMode: 'lastDay',
  }, admin.id)

  const first = await runDueSchedules()
  const stored = await prisma.schedule.findUniqueOrThrow({ where: { id: schedule.id } })
  const second = await runDueSchedules()
  const tickets = await prisma.ticket.findMany({ include: { scheduleRun: true, assignedTo: true, createdBy: true } })

  if (first.created !== 1) throw new Error(`expected 1 created, got ${first.created}`)
  if (second.created !== 0) throw new Error(`expected no backfill, got ${second.created}`)
  if (!stored.nextFireAt || stored.nextFireAt.getTime() <= Date.now()) {
    throw new Error(`next fire should be in the future, got ${stored.nextFireAt}`)
  }
  if (tickets.length !== 1) throw new Error(`expected 1 ticket, got ${tickets.length}`)
  if (tickets[0].assignedToId !== admin.id) throw new Error('ticket was not assigned to the admin')
  if (tickets[0].createdBy.email !== 'system@informejo.local') throw new Error('ticket creator is not the system user')
  if (!tickets[0].scheduleRun) throw new Error('ticket is missing its schedule run')
  if (tickets[0].title !== 'Renew the certificate') throw new Error('unexpected title')

  const note = await prisma.calendarNote.create({
    data: { day: '2026-10-01', body: 'Inventory day', createdById: admin.id },
  })
  if (note.day !== '2026-10-01') throw new Error('note was not stored')

  console.log('schedule runner checks passed', stored.nextFireAt.toISOString())
  await prisma.$disconnect()
}

main().catch(async (error) => {
  console.error(error)
  await prisma.$disconnect()
  process.exit(1)
})
