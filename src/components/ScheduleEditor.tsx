'use client'

import { useState } from 'react'
import { TicketCategory, TicketPriority } from '@/types'
import { WEEKDAYS } from '@/lib/recurrence'
import toast from 'react-hot-toast'

export interface ScheduleRecord {
  id: string
  title: string
  description: string
  category: TicketCategory
  priority: TicketPriority
  assignedToId: string | null
  isActive: boolean
  date: string
  time: string
  summary: string
  nextFireAt: string | null
  recurrence: {
    repeats: boolean
    freq: 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'YEARLY'
    interval: number
    weekdays: string[]
    monthlyMode: 'monthday' | 'nth' | 'lastDay'
    monthDay: number
    nth: 1 | 2 | 3 | 4 | -1
    nthWeekday: string
    yearMonth: number
    yearlyMode: 'monthday' | 'nth' | 'lastDay'
    untilDate: string | null
  }
}

interface AdminOption {
  id: string
  name: string
}

interface ScheduleEditorProps {
  schedule: ScheduleRecord | null
  date: string
  time: string
  admins: AdminOption[]
  ticketId?: string | null
  onClose: () => void
  onSaved: () => void
}

const WEEKDAY_LABELS: Record<string, string> = {
  MO: 'Mon',
  TU: 'Tue',
  WE: 'Wed',
  TH: 'Thu',
  FR: 'Fri',
  SA: 'Sat',
  SU: 'Sun',
}

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

export default function ScheduleEditor({
  schedule,
  date,
  time,
  admins,
  ticketId,
  onClose,
  onSaved,
}: ScheduleEditorProps) {
  const recurrence = schedule?.recurrence
  const [title, setTitle] = useState(schedule?.title ?? '')
  const [description, setDescription] = useState(schedule?.description ?? '')
  const [category, setCategory] = useState<TicketCategory>(schedule?.category ?? 'OTHER')
  const [priority, setPriority] = useState<TicketPriority>(schedule?.priority ?? 'MEDIUM')
  const [assignedToId, setAssignedToId] = useState(schedule?.assignedToId ?? '')
  const [eventDate, setEventDate] = useState(schedule?.date ?? date)
  const [eventTime, setEventTime] = useState(schedule?.time ?? time ?? '00:00:01')
  const [repeats, setRepeats] = useState(recurrence?.repeats ?? false)
  const [freq, setFreq] = useState(recurrence?.freq ?? 'MONTHLY')
  const [interval, setIntervalValue] = useState(recurrence?.interval ?? 1)
  const [weekdays, setWeekdays] = useState<string[]>(recurrence?.weekdays ?? ['MO'])
  const [monthlyMode, setMonthlyMode] = useState(recurrence?.monthlyMode ?? 'monthday')
  const [monthDay, setMonthDay] = useState(recurrence?.monthDay ?? (Number(date.slice(8, 10)) || 1))
  const [nth, setNth] = useState<1 | 2 | 3 | 4 | -1>(recurrence?.nth ?? 1)
  const [nthWeekday, setNthWeekday] = useState(recurrence?.nthWeekday ?? 'MO')
  const [yearMonth, setYearMonth] = useState(recurrence?.yearMonth ?? (Number(date.slice(5, 7)) || 1))
  const [yearlyMode, setYearlyMode] = useState(recurrence?.yearlyMode ?? 'monthday')
  const [untilDate, setUntilDate] = useState(recurrence?.untilDate ?? '')
  const [isActive, setIsActive] = useState(schedule?.isActive ?? true)
  const [isSaving, setIsSaving] = useState(false)

  const toggleWeekday = (day: string) => {
    setWeekdays((current) => {
      if (current.includes(day)) {
        const next = current.filter((value) => value !== day)
        return next.length > 0 ? next : current
      }
      return [...current, day]
    })
  }

  const save = async (event: React.FormEvent) => {
    event.preventDefault()
    setIsSaving(true)

    const payload = {
      title,
      description,
      category,
      priority,
      assignedToId: assignedToId || null,
      date: eventDate,
      time: eventTime || '00:00:01',
      repeats,
      freq,
      interval: Number(interval) || 1,
      weekdays,
      monthlyMode,
      monthDay: Number(monthDay) || 1,
      nth,
      nthWeekday,
      yearMonth: Number(yearMonth) || 1,
      yearlyMode,
      untilDate: repeats && untilDate ? untilDate : null,
      isActive,
    }

    try {
      const res = await fetch(schedule ? `/api/admin/schedules/${schedule.id}` : '/api/admin/schedules', {
        method: schedule ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error || 'Could not save schedule')
        return
      }
      toast.success(schedule ? 'Schedule updated' : 'Schedule created')
      onSaved()
    } catch {
      toast.error('Could not save schedule')
    } finally {
      setIsSaving(false)
    }
  }

  const remove = async () => {
    if (!schedule) return
    if (!window.confirm('Delete this schedule? Tickets it already created will stay.')) return

    const res = await fetch(`/api/admin/schedules/${schedule.id}`, { method: 'DELETE' })
    if (!res.ok) {
      toast.error('Could not delete schedule')
      return
    }
    toast.success('Schedule deleted')
    onSaved()
  }

  return (
    <form onSubmit={save} className="space-y-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold text-gray-900">
            {schedule ? 'Edit schedule' : 'New schedule'}
          </h2>
          <p className="text-sm text-gray-500">
            A schedule creates a ticket each time it comes due. Times use Eastern Time.
          </p>
        </div>
        <button type="button" onClick={onClose} className="text-sm text-gray-500 hover:text-gray-800">
          Close
        </button>
      </div>

      {ticketId && (
        <a href={`/admin/tickets/${ticketId}`} className="text-sm text-primary-700 hover:underline">
          Open the ticket from this occurrence
        </a>
      )}

      <label className="block text-sm font-medium text-gray-700">
        Title
        <input className="input mt-1" value={title} onChange={(event) => setTitle(event.target.value)} required minLength={5} maxLength={200} />
      </label>

      <label className="block text-sm font-medium text-gray-700">
        Description
        <textarea className="input mt-1 min-h-24" value={description} onChange={(event) => setDescription(event.target.value)} required minLength={10} />
      </label>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <label className="block text-sm font-medium text-gray-700">
          Category
          <select className="input mt-1" value={category} onChange={(event) => setCategory(event.target.value as TicketCategory)}>
            <option value="HARDWARE">Hardware</option>
            <option value="SOFTWARE">Software</option>
            <option value="NETWORK">Network</option>
            <option value="ACCESS">Access/Permissions</option>
            <option value="OTHER">Other</option>
          </select>
        </label>
        <label className="block text-sm font-medium text-gray-700">
          Priority
          <select className="input mt-1" value={priority} onChange={(event) => setPriority(event.target.value as TicketPriority)}>
            <option value="LOW">Low</option>
            <option value="MEDIUM">Medium</option>
            <option value="HIGH">High</option>
            <option value="CRITICAL">Critical</option>
          </select>
        </label>
      </div>

      <label className="block text-sm font-medium text-gray-700">
        Assign to
        <select className="input mt-1" value={assignedToId} onChange={(event) => setAssignedToId(event.target.value)}>
          <option value="">Leave unassigned</option>
          {admins.map((admin) => (
            <option key={admin.id} value={admin.id}>{admin.name}</option>
          ))}
        </select>
      </label>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <label className="block text-sm font-medium text-gray-700">
          Date
          <input type="date" className="input mt-1" value={eventDate} onChange={(event) => setEventDate(event.target.value)} required />
        </label>
        <label className="block text-sm font-medium text-gray-700">
          Time
          <input
            type="time"
            step={1}
            className="input mt-1"
            value={eventTime}
            onChange={(event) => setEventTime(event.target.value || '00:00:01')}
          />
        </label>
      </div>
      <p className="text-xs text-gray-500">Leave the time blank and it is saved as 12:00:01 AM Eastern.</p>

      <label className="flex items-center gap-2 text-sm font-medium text-gray-700">
        <input type="checkbox" checked={repeats} onChange={(event) => setRepeats(event.target.checked)} />
        Repeats
      </label>

      {repeats && (
        <div className="space-y-4 rounded-lg border border-gray-200 p-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <label className="block text-sm font-medium text-gray-700">
              Every
              <input
                type="number"
                min={1}
                max={365}
                className="input mt-1"
                value={interval}
                onChange={(event) => setIntervalValue(Number(event.target.value))}
              />
            </label>
            <label className="block text-sm font-medium text-gray-700">
              Frequency
              <select className="input mt-1" value={freq} onChange={(event) => setFreq(event.target.value as typeof freq)}>
                <option value="DAILY">Days</option>
                <option value="WEEKLY">Weeks</option>
                <option value="MONTHLY">Months</option>
                <option value="YEARLY">Years</option>
              </select>
            </label>
          </div>

          {freq === 'WEEKLY' && (
            <div className="flex flex-wrap gap-2">
              {WEEKDAYS.map((day) => (
                <label key={day} className="flex items-center gap-1 text-sm">
                  <input type="checkbox" checked={weekdays.includes(day)} onChange={() => toggleWeekday(day)} />
                  {WEEKDAY_LABELS[day]}
                </label>
              ))}
            </div>
          )}

          {freq === 'MONTHLY' && (
            <MonthPattern
              mode={monthlyMode}
              onMode={setMonthlyMode}
              monthDay={monthDay}
              onMonthDay={setMonthDay}
              nth={nth}
              onNth={setNth}
              nthWeekday={nthWeekday}
              onNthWeekday={setNthWeekday}
            />
          )}

          {freq === 'YEARLY' && (
            <div className="space-y-3">
              <label className="block text-sm font-medium text-gray-700">
                Month
                <select className="input mt-1" value={yearMonth} onChange={(event) => setYearMonth(Number(event.target.value))}>
                  {MONTHS.map((month, index) => (
                    <option key={month} value={index + 1}>{month}</option>
                  ))}
                </select>
              </label>
              <MonthPattern
                mode={yearlyMode}
                onMode={setYearlyMode}
                monthDay={monthDay}
                onMonthDay={setMonthDay}
                nth={nth}
                onNth={setNth}
                nthWeekday={nthWeekday}
                onNthWeekday={setNthWeekday}
              />
            </div>
          )}

          <label className="block text-sm font-medium text-gray-700">
            End date
            <input type="date" className="input mt-1" value={untilDate} onChange={(event) => setUntilDate(event.target.value)} />
          </label>
          <p className="text-xs text-gray-500">Leave the end date empty to keep the schedule until it is turned off.</p>
        </div>
      )}

      {schedule && (
        <label className="flex items-center gap-2 text-sm font-medium text-gray-700">
          <input type="checkbox" checked={isActive} onChange={(event) => setIsActive(event.target.checked)} />
          Active
        </label>
      )}

      <div className="flex flex-wrap justify-between gap-3 pt-2">
        {schedule ? (
          <button type="button" onClick={remove} className="btn btn-danger">
            Delete schedule
          </button>
        ) : <span />}
        <div className="flex gap-2">
          <button type="button" onClick={onClose} className="btn btn-secondary">Cancel</button>
          <button type="submit" className="btn btn-primary" disabled={isSaving}>
            {isSaving ? 'Saving...' : 'Save'}
          </button>
        </div>
      </div>
    </form>
  )
}

function MonthPattern({
  mode,
  onMode,
  monthDay,
  onMonthDay,
  nth,
  onNth,
  nthWeekday,
  onNthWeekday,
}: {
  mode: 'monthday' | 'nth' | 'lastDay'
  onMode: (mode: 'monthday' | 'nth' | 'lastDay') => void
  monthDay: number
  onMonthDay: (day: number) => void
  nth: 1 | 2 | 3 | 4 | -1
  onNth: (nth: 1 | 2 | 3 | 4 | -1) => void
  nthWeekday: string
  onNthWeekday: (day: string) => void
}) {
  return (
    <div className="space-y-3">
      <label className="flex items-center gap-2 text-sm">
        <input type="radio" checked={mode === 'monthday'} onChange={() => onMode('monthday')} />
        Day of the month
        <input
          type="number"
          min={1}
          max={31}
          className="input w-24"
          value={monthDay}
          onChange={(event) => onMonthDay(Number(event.target.value))}
          disabled={mode !== 'monthday'}
        />
      </label>
      <label className="flex flex-wrap items-center gap-2 text-sm">
        <input type="radio" checked={mode === 'nth'} onChange={() => onMode('nth')} />
        The
        <select className="input w-auto" value={nth} onChange={(event) => onNth(Number(event.target.value) as 1 | 2 | 3 | 4 | -1)} disabled={mode !== 'nth'}>
          <option value={1}>first</option>
          <option value={2}>second</option>
          <option value={3}>third</option>
          <option value={4}>fourth</option>
          <option value={-1}>last</option>
        </select>
        <select className="input w-auto" value={nthWeekday} onChange={(event) => onNthWeekday(event.target.value)} disabled={mode !== 'nth'}>
          {WEEKDAYS.map((day) => (
            <option key={day} value={day}>{WEEKDAY_LABELS[day]}</option>
          ))}
        </select>
      </label>
      <label className="flex items-center gap-2 text-sm">
        <input type="radio" checked={mode === 'lastDay'} onChange={() => onMode('lastDay')} />
        Last day of the month
      </label>
    </div>
  )
}
