import { DateTime } from 'luxon'
import {
  buildRRule,
  occurrencesBetween,
  parseRRule,
  parseWallClock,
  resolveNextFireAt,
  type RecurrenceSpec,
} from '../src/lib/recurrence'

const zone = 'America/New_York'

function base(overrides: Partial<RecurrenceSpec> = {}): RecurrenceSpec {
  return {
    repeats: true,
    freq: 'MONTHLY',
    interval: 1,
    weekdays: ['MO'],
    monthlyMode: 'nth',
    monthDay: 1,
    nth: 1,
    nthWeekday: 'MO',
    yearMonth: 1,
    yearlyMode: 'monthday',
    untilDate: null,
    ...overrides,
  }
}

function fmt(date: Date) {
  return DateTime.fromJSDate(date, { zone }).toFormat('yyyy-MM-dd HH:mm:ss')
}

const firstMonday = buildRRule(base())
if (firstMonday !== 'FREQ=MONTHLY;INTERVAL=1;BYDAY=1MO') {
  throw new Error(`unexpected first monday rule: ${firstMonday}`)
}
const parsed = parseRRule(firstMonday, true)
if (parsed.monthlyMode !== 'nth' || parsed.nth !== 1 || parsed.nthWeekday !== 'MO') {
  throw new Error(`failed to parse first monday: ${JSON.stringify(parsed)}`)
}

const mondays = occurrencesBetween(
  parseWallClock('2026-01-05', '00:00:01'),
  zone,
  true,
  firstMonday,
  null,
  parseWallClock('2026-01-01', '00:00:00'),
  parseWallClock('2026-04-01', '00:00:00')
).map(fmt)
if (mondays.join(',') !== '2026-01-05 00:00:01,2026-02-02 00:00:01,2026-03-02 00:00:01') {
  throw new Error(`unexpected mondays: ${mondays.join(',')}`)
}

const lastDayRule = buildRRule(base({ monthlyMode: 'lastDay' }))
if (parseRRule(lastDayRule, true).monthlyMode !== 'lastDay') {
  throw new Error('failed to parse last day')
}
const lastDays = occurrencesBetween(
  parseWallClock('2026-01-31', '00:00:01'),
  zone,
  true,
  lastDayRule,
  null,
  parseWallClock('2026-01-01', '00:00:01'),
  parseWallClock('2026-03-31', '23:59:59')
).map(fmt)
if (lastDays.join(',') !== '2026-01-31 00:00:01,2026-02-28 00:00:01,2026-03-31 00:00:01') {
  throw new Error(`unexpected last days: ${lastDays.join(',')}`)
}

const daily = buildRRule(base({ freq: 'DAILY', interval: 30 }))
const start = parseWallClock('2026-01-01', '00:00:01')
const now = parseWallClock('2026-04-15', '12:00:00')
const due = resolveNextFireAt({
  startsAt: start,
  timeZone: zone,
  repeats: true,
  rrule: daily,
  until: null,
  now,
  firedAt: [],
  mode: 'catch-up',
})
if (!due || fmt(due) !== '2026-04-01 00:00:01') {
  throw new Error(`unexpected catch-up: ${due && fmt(due)}`)
}
const following = resolveNextFireAt({
  startsAt: start,
  timeZone: zone,
  repeats: true,
  rrule: daily,
  until: null,
  now,
  firedAt: [due],
  mode: 'future-only',
})
if (!following || fmt(following) !== '2026-05-01 00:00:01') {
  throw new Error(`unexpected next: ${following && fmt(following)}`)
}

const blank = parseWallClock('2026-10-01', '')
if (fmt(blank) !== '2026-10-01 00:00:01') {
  throw new Error(`unexpected default time: ${fmt(blank)}`)
}

console.log('recurrence checks passed')
