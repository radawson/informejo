import { DateTime } from 'luxon'
import { Frequency, RRule, Weekday } from 'rrule'

export const ORG_TIME_ZONE = 'America/New_York'

export const WEEKDAYS = ['MO', 'TU', 'WE', 'TH', 'FR', 'SA', 'SU'] as const
export type WeekdayToken = (typeof WEEKDAYS)[number]

export type RecurrenceFreq = 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'YEARLY'
export type MonthMode = 'monthday' | 'nth' | 'lastDay'

export interface RecurrenceSpec {
  repeats: boolean
  freq: RecurrenceFreq
  interval: number
  weekdays: WeekdayToken[]
  monthlyMode: MonthMode
  monthDay: number
  nth: 1 | 2 | 3 | 4 | -1
  nthWeekday: WeekdayToken
  yearMonth: number
  yearlyMode: MonthMode
  untilDate: string | null
}

const WEEKDAY_LABELS: Record<WeekdayToken, string> = {
  MO: 'Monday',
  TU: 'Tuesday',
  WE: 'Wednesday',
  TH: 'Thursday',
  FR: 'Friday',
  SA: 'Saturday',
  SU: 'Sunday',
}

const NTH_LABELS: Record<number, string> = {
  1: 'first',
  2: 'second',
  3: 'third',
  4: 'fourth',
  [-1]: 'last',
}

const FREQ_BY_NAME: Record<RecurrenceFreq, Frequency> = {
  DAILY: Frequency.DAILY,
  WEEKLY: Frequency.WEEKLY,
  MONTHLY: Frequency.MONTHLY,
  YEARLY: Frequency.YEARLY,
}

const SAME_INSTANT_MS = 1500
const MAX_OCCURRENCES = 500

export function isCalendarDay(day: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return false
  const [year, month, date] = day.split('-').map(Number)
  const dt = DateTime.fromObject({ year, month, day: date }, { zone: 'utc' })
  return dt.isValid && dt.toFormat('yyyy-MM-dd') === day
}

export function weekdayTokenForDate(date: string): WeekdayToken {
  const dt = DateTime.fromISO(date)
  if (!dt.isValid) return 'MO'
  return WEEKDAYS[dt.weekday - 1] ?? 'MO'
}

export function defaultRecurrence(): RecurrenceSpec {
  return {
    repeats: false,
    freq: 'MONTHLY',
    interval: 1,
    weekdays: ['MO'],
    monthlyMode: 'monthday',
    monthDay: 1,
    nth: 1,
    nthWeekday: 'MO',
    yearMonth: 1,
    yearlyMode: 'monthday',
    untilDate: null,
  }
}

function clamp(value: number, min: number, max: number) {
  if (!Number.isFinite(value)) return min
  return Math.min(max, Math.max(min, Math.trunc(value)))
}

function pad(value: number) {
  return String(Math.trunc(value)).padStart(2, '0')
}

export function toFloating(dt: DateTime): Date {
  return new Date(Date.UTC(dt.year, dt.month - 1, dt.day, dt.hour, dt.minute, dt.second))
}

export function fromFloating(date: Date, zone: string): DateTime {
  return DateTime.fromObject(
    {
      year: date.getUTCFullYear(),
      month: date.getUTCMonth() + 1,
      day: date.getUTCDate(),
      hour: date.getUTCHours(),
      minute: date.getUTCMinutes(),
      second: date.getUTCSeconds(),
    },
    { zone }
  )
}

export function parseWallClock(
  date: string,
  time: string | null | undefined,
  timeZone = ORG_TIME_ZONE
): Date {
  const [year, month, day] = date.split('-').map(Number)
  let hour = 0
  let minute = 0
  let second = 1

  if (time && time.trim() !== '') {
    const parts = time.split(':').map((part) => Number(part))
    hour = parts[0] ?? 0
    minute = parts[1] ?? 0
    second = parts.length >= 3 ? (parts[2] ?? 0) : 0
  }

  const dt = DateTime.fromObject(
    { year, month, day, hour, minute, second },
    { zone: timeZone }
  )
  if (!dt.isValid) {
    throw new Error(dt.invalidExplanation || 'Invalid date')
  }
  return dt.toJSDate()
}

export function formatWallClock(instant: Date, timeZone = ORG_TIME_ZONE) {
  const dt = DateTime.fromJSDate(instant, { zone: timeZone })
  return {
    date: dt.toFormat('yyyy-MM-dd'),
    time: dt.toFormat('HH:mm:ss'),
  }
}

export function untilInstant(
  untilDate: string | null | undefined,
  timeZone = ORG_TIME_ZONE
): Date | null {
  if (!untilDate) return null
  const dt = DateTime.fromISO(untilDate, { zone: timeZone }).endOf('day')
  if (!dt.isValid) {
    throw new Error('Invalid end date')
  }
  return dt.toJSDate()
}

function untilToken(untilDate: string, timeZone: string) {
  const end = DateTime.fromISO(untilDate, { zone: timeZone }).endOf('day')
  return `${end.year}${pad(end.month)}${pad(end.day)}T${pad(end.hour)}${pad(end.minute)}${pad(end.second)}Z`
}

export function buildRRule(spec: RecurrenceSpec, timeZone = ORG_TIME_ZONE): string | null {
  if (!spec.repeats) return null

  const interval = clamp(spec.interval || 1, 1, 365)
  const parts = [`FREQ=${spec.freq}`, `INTERVAL=${interval}`]

  if (spec.freq === 'WEEKLY') {
    const days = spec.weekdays.length > 0 ? spec.weekdays : ['MO']
    parts.push(`BYDAY=${days.join(',')}`)
  } else if (spec.freq === 'MONTHLY') {
    if (spec.monthlyMode === 'lastDay') {
      parts.push('BYMONTHDAY=-1')
    } else if (spec.monthlyMode === 'nth') {
      parts.push(`BYDAY=${spec.nth}${spec.nthWeekday}`)
    } else {
      parts.push(`BYMONTHDAY=${clamp(spec.monthDay, 1, 31)}`)
    }
  } else if (spec.freq === 'YEARLY') {
    parts.push(`BYMONTH=${clamp(spec.yearMonth, 1, 12)}`)
    if (spec.yearlyMode === 'lastDay') {
      parts.push('BYMONTHDAY=-1')
    } else if (spec.yearlyMode === 'nth') {
      parts.push(`BYDAY=${spec.nth}${spec.nthWeekday}`)
    } else {
      parts.push(`BYMONTHDAY=${clamp(spec.monthDay, 1, 31)}`)
    }
  }

  if (spec.untilDate) {
    parts.push(`UNTIL=${untilToken(spec.untilDate, timeZone)}`)
  }

  return parts.join(';')
}

function asArray<T>(value: T | T[] | null | undefined): T[] {
  if (value == null) return []
  return Array.isArray(value) ? value : [value]
}

function weekdayParts(value: Weekday | number): { token: WeekdayToken; nth: number | null } {
  if (typeof value === 'number') {
    return { token: WEEKDAYS[value] ?? 'MO', nth: null }
  }
  return {
    token: WEEKDAYS[value.weekday] ?? 'MO',
    nth: value.n ?? null,
  }
}

function floatingDay(date: Date) {
  return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}`
}

export function parseRRule(rule: string | null | undefined, repeats: boolean): RecurrenceSpec {
  const spec = defaultRecurrence()
  spec.repeats = repeats
  if (!repeats || !rule) return spec

  const options = RRule.parseString(rule)
  if (options.freq === Frequency.DAILY) spec.freq = 'DAILY'
  else if (options.freq === Frequency.WEEKLY) spec.freq = 'WEEKLY'
  else if (options.freq === Frequency.MONTHLY) spec.freq = 'MONTHLY'
  else if (options.freq === Frequency.YEARLY) spec.freq = 'YEARLY'

  spec.interval = options.interval || 1

  const monthDays = asArray(options.bymonthday)
  const months = asArray(options.bymonth)
  const weekdays = asArray(options.byweekday).map((value) =>
    weekdayParts(value as Weekday | number)
  )

  if (spec.freq === 'WEEKLY') {
    const tokens = weekdays.map((day) => day.token)
    spec.weekdays = tokens.length > 0 ? tokens : ['MO']
  }

  if (spec.freq === 'MONTHLY' || spec.freq === 'YEARLY') {
    const nthDay = weekdays.find((day) => day.nth != null)
    const mode: MonthMode = monthDays.includes(-1)
      ? 'lastDay'
      : nthDay
        ? 'nth'
        : 'monthday'

    if (spec.freq === 'MONTHLY') spec.monthlyMode = mode
    else spec.yearlyMode = mode

    const positiveDay = monthDays.find((day) => day > 0)
    if (positiveDay) spec.monthDay = positiveDay
    if (nthDay) {
      spec.nth = (nthDay.nth === 1 || nthDay.nth === 2 || nthDay.nth === 3 || nthDay.nth === 4 || nthDay.nth === -1)
        ? nthDay.nth
        : 1
      spec.nthWeekday = nthDay.token
    }
  }

  if (months[0]) spec.yearMonth = months[0]
  if (options.until) spec.untilDate = floatingDay(options.until)

  return spec
}

export function describeRecurrence(
  spec: RecurrenceSpec,
  startsAt: Date,
  timeZone = ORG_TIME_ZONE
) {
  const when = DateTime.fromJSDate(startsAt, { zone: timeZone })
  const timeLabel = when.toFormat('h:mm:ss a')

  if (!spec.repeats) {
    return `Once on ${when.toFormat('MMM d, yyyy')} at ${timeLabel}`
  }

  const interval = spec.interval || 1
  const unit: Record<RecurrenceFreq, [string, string]> = {
    DAILY: ['day', 'days'],
    WEEKLY: ['week', 'weeks'],
    MONTHLY: ['month', 'months'],
    YEARLY: ['year', 'years'],
  }
  const unitLabel = interval === 1 ? unit[spec.freq][0] : `${interval} ${unit[spec.freq][1]}`
  let pattern = `Every ${unitLabel}`

  if (spec.freq === 'WEEKLY') {
    const days = (spec.weekdays.length > 0 ? spec.weekdays : ['MO' as WeekdayToken])
      .filter((day): day is WeekdayToken => day in WEEKDAY_LABELS)
      .map((day) => WEEKDAY_LABELS[day])
    pattern += ` on ${days.join(', ')}`
  } else if (spec.freq === 'MONTHLY') {
    pattern += monthlyPhrase(spec.monthlyMode, spec)
  } else if (spec.freq === 'YEARLY') {
    const month = DateTime.fromObject({ month: clamp(spec.yearMonth, 1, 12) }).toFormat('LLLL')
    if (spec.yearlyMode === 'lastDay') pattern += ` on the last day of ${month}`
    else if (spec.yearlyMode === 'nth') {
      pattern += ` on the ${NTH_LABELS[spec.nth]} ${WEEKDAY_LABELS[spec.nthWeekday]} of ${month}`
    } else pattern += ` on ${month} ${spec.monthDay}`
  }

  pattern += ` at ${timeLabel}`
  if (spec.untilDate) pattern += ` until ${spec.untilDate}`
  return pattern
}

function monthlyPhrase(mode: MonthMode, spec: RecurrenceSpec) {
  if (mode === 'lastDay') return ' on the last day'
  if (mode === 'nth') return ` on the ${NTH_LABELS[spec.nth]} ${WEEKDAY_LABELS[spec.nthWeekday]}`
  return ` on day ${spec.monthDay}`
}

function ruleFor(
  startsAt: Date,
  timeZone: string,
  repeats: boolean,
  rrule: string | null,
  until: Date | null
) {
  const wall = DateTime.fromJSDate(startsAt, { zone: timeZone })
  const dtstart = toFloating(wall)

  if (!repeats || !rrule) {
    return new RRule({
      freq: FREQ_BY_NAME.DAILY,
      count: 1,
      dtstart,
    })
  }

  const options = RRule.parseString(rrule)
  if (until) {
    options.until = toFloating(DateTime.fromJSDate(until, { zone: timeZone }))
  }

  return new RRule({
    ...options,
    dtstart,
  })
}

export function occurrencesBetween(
  startsAt: Date,
  timeZone: string,
  repeats: boolean,
  rrule: string | null,
  until: Date | null,
  rangeStart: Date,
  rangeEnd: Date
): Date[] {
  if (rangeEnd < rangeStart) return []

  if (!repeats) {
    if (startsAt >= rangeStart && startsAt <= rangeEnd && (!until || startsAt <= until)) {
      return [startsAt]
    }
    return []
  }

  if (!rrule) return []

  const rule = ruleFor(startsAt, timeZone, true, rrule, until)
  const startWall = DateTime.fromJSDate(rangeStart, { zone: timeZone }).minus({ days: 1 })
  const endWall = DateTime.fromJSDate(rangeEnd, { zone: timeZone }).plus({ days: 1 })
  const floats = rule.between(toFloating(startWall), toFloating(endWall), true)
  const results: Date[] = []

  for (const floatDate of floats) {
    const instant = fromFloating(floatDate, timeZone)
    if (!instant.isValid) continue
    const js = instant.toJSDate()
    if (js < startsAt || js < rangeStart || js > rangeEnd) continue
    if (until && js > until) continue
    results.push(js)
    if (results.length >= MAX_OCCURRENCES) break
  }

  return results
}

function wasFired(instant: Date, firedAt: Date[]) {
  return firedAt.some((fired) => Math.abs(fired.getTime() - instant.getTime()) < SAME_INSTANT_MS)
}

type FireInput = {
  startsAt: Date
  timeZone: string
  repeats: boolean
  rrule: string | null
  until: Date | null
  firedAt: Date[]
}

function instantFromFloating(floatDate: Date, timeZone: string) {
  const instant = fromFloating(floatDate, timeZone)
  if (!instant.isValid) return null
  return instant.toJSDate()
}

function nextUnfiredAfter(input: FireInput, after: Date): Date | null {
  if (!input.repeats) {
    if (input.startsAt.getTime() > after.getTime() && !wasFired(input.startsAt, input.firedAt)) {
      return input.startsAt
    }
    return null
  }

  const rule = ruleFor(input.startsAt, input.timeZone, true, input.rrule, input.until)
  let cursor = after

  for (let i = 0; i < 50; i++) {
    const floatDate = rule.after(toFloating(DateTime.fromJSDate(cursor, { zone: input.timeZone })), false)
    if (!floatDate) return null
    const js = instantFromFloating(floatDate, input.timeZone)
    if (!js) return null
    if (js < input.startsAt) {
      cursor = js
      continue
    }
    if (input.until && js > input.until) return null
    if (!wasFired(js, input.firedAt)) return js
    cursor = js
  }

  return null
}

function latestUnfiredOnOrBefore(input: FireInput, now: Date): Date | null {
  if (!input.repeats) {
    if (input.startsAt.getTime() <= now.getTime() && !wasFired(input.startsAt, input.firedAt)) {
      return input.startsAt
    }
    return null
  }

  const rule = ruleFor(input.startsAt, input.timeZone, true, input.rrule, input.until)
  let cursor = now
  let inclusive = true

  for (let i = 0; i < 50; i++) {
    const floatDate = rule.before(
      toFloating(DateTime.fromJSDate(cursor, { zone: input.timeZone })),
      inclusive
    )
    if (!floatDate) return null
    const js = instantFromFloating(floatDate, input.timeZone)
    if (!js || js < input.startsAt) return null
    if (input.until && js > input.until) {
      cursor = new Date(js.getTime() - 1000)
      inclusive = false
      continue
    }
    if (!wasFired(js, input.firedAt)) return js
    cursor = new Date(js.getTime() - 1000)
    inclusive = false
  }

  return null
}

export function resolveNextFireAt(input: FireInput & {
  now: Date
  mode: 'catch-up' | 'future-only'
}): Date | null {
  if (input.mode === 'catch-up') {
    const overdue = latestUnfiredOnOrBefore(input, input.now)
    if (overdue) return overdue
  }

  return nextUnfiredAfter(input, input.now)
}
