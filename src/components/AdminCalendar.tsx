'use client'

import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import FullCalendar from '@fullcalendar/react'
import dayGridPlugin from '@fullcalendar/daygrid'
import timeGridPlugin from '@fullcalendar/timegrid'
import interactionPlugin from '@fullcalendar/interaction'
import luxonPlugin from '@fullcalendar/luxon3'
import type { DateClickArg } from '@fullcalendar/interaction'
import type { DatesSetArg, EventClickArg, EventInput } from '@fullcalendar/core'
import toast from 'react-hot-toast'
import ScheduleEditor, { ScheduleRecord } from '@/components/ScheduleEditor'
import { ORG_TIME_ZONE } from '@/lib/recurrence'

interface AdminOption {
  id: string
  name: string
  isActive?: boolean
}

interface NoteDraft {
  id?: string
  day: string
  body: string
}

type Panel =
  | { type: 'choose'; date: string; time: string }
  | { type: 'note'; note: NoteDraft }
  | { type: 'schedule'; schedule: ScheduleRecord | null; date: string; time: string; ticketId?: string | null }

export default function AdminCalendar() {
  const [events, setEvents] = useState<EventInput[]>([])
  const [schedules, setSchedules] = useState<ScheduleRecord[]>([])
  const [admins, setAdmins] = useState<AdminOption[]>([])
  const [range, setRange] = useState<{ start: string; end: string } | null>(null)
  const [panel, setPanel] = useState<Panel | null>(null)
  const [isSavingNote, setIsSavingNote] = useState(false)
  const openedFromQuery = useRef(false)

  const loadSchedules = useCallback(async () => {
    const res = await fetch('/api/admin/schedules')
    if (res.ok) {
      setSchedules(await res.json())
    }
  }, [])

  const loadGeneration = useRef(0)

  const loadEvents = useCallback(async (start: string, end: string) => {
    const generation = ++loadGeneration.current
    const res = await fetch(`/api/admin/calendar?start=${encodeURIComponent(start)}&end=${encodeURIComponent(end)}`)
    if (generation !== loadGeneration.current) return
    if (res.ok) {
      const data = await res.json()
      if (generation !== loadGeneration.current) return
      setEvents(data.events)
    }
  }, [])

  const refresh = useCallback(async () => {
    await loadSchedules()
    if (range) await loadEvents(range.start, range.end)
  }, [loadSchedules, loadEvents, range])

  useEffect(() => {
    loadSchedules()
    fetch('/api/users?role=ADMIN')
      .then((res) => res.ok ? res.json() : [])
      .then((users: AdminOption[]) => {
        setAdmins(users.filter((user) => user.isActive !== false))
      })
      .catch(() => setAdmins([]))
  }, [loadSchedules])

  useEffect(() => {
    if (openedFromQuery.current) return
    const id = new URLSearchParams(window.location.search).get('schedule')
    if (!id || schedules.length === 0) return
    const schedule = schedules.find((item) => item.id === id)
    if (!schedule) return
    openedFromQuery.current = true
    setPanel({
      type: 'schedule',
      schedule,
      date: schedule.date,
      time: schedule.time,
    })
  }, [schedules])

  const onDatesSet = (arg: DatesSetArg) => {
    const next = { start: arg.startStr, end: arg.endStr }
    setRange(next)
    loadEvents(next.start, next.end)
  }

  const onDateClick = (arg: DateClickArg) => {
    const parsed = splitDateStr(arg.dateStr, arg.allDay)
    setPanel({ type: 'choose', date: parsed.date, time: parsed.time })
  }

  const onEventClick = async (arg: EventClickArg) => {
    const props = arg.event.extendedProps as {
      kind?: string
      scheduleId?: string
      ticketId?: string
      noteId?: string
      day?: string
      body?: string
    }

    if (props.kind === 'note' && props.noteId && props.day) {
      setPanel({
        type: 'note',
        note: { id: props.noteId, day: props.day, body: props.body || '' },
      })
      return
    }

    if (!props.scheduleId) return

    let schedule = schedules.find((item) => item.id === props.scheduleId) ?? null
    if (!schedule) {
      const res = await fetch(`/api/admin/schedules/${props.scheduleId}`)
      if (res.ok) schedule = await res.json()
    }
    const parsed = splitDateStr(arg.event.startStr, arg.event.allDay)
    setPanel({
      type: 'schedule',
      schedule,
      date: schedule?.date ?? parsed.date,
      time: schedule?.time ?? parsed.time,
      ticketId: props.ticketId,
    })
  }

  const saveNote = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!panel || panel.type !== 'note') return
    setIsSavingNote(true)
    try {
      const res = await fetch(
        panel.note.id ? `/api/admin/calendar/notes/${panel.note.id}` : '/api/admin/calendar/notes',
        {
          method: panel.note.id ? 'PATCH' : 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(panel.note.id
            ? { body: panel.note.body }
            : { day: panel.note.day, body: panel.note.body }),
        }
      )
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error || 'Could not save note')
        return
      }
      toast.success('Note saved')
      setPanel(null)
      await refresh()
    } catch {
      toast.error('Could not save note')
    } finally {
      setIsSavingNote(false)
    }
  }

  const deleteNote = async () => {
    if (!panel || panel.type !== 'note' || !panel.note.id) return
    if (!window.confirm('Delete this note?')) return
    const res = await fetch(`/api/admin/calendar/notes/${panel.note.id}`, { method: 'DELETE' })
    if (!res.ok) {
      toast.error('Could not delete note')
      return
    }
    toast.success('Note deleted')
    setPanel(null)
    await refresh()
  }

  const toggleSchedule = async (schedule: ScheduleRecord) => {
    const res = await fetch(`/api/admin/schedules/${schedule.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isActive: !schedule.isActive }),
    })
    if (!res.ok) {
      toast.error('Could not update schedule')
      return
    }
    await refresh()
  }

  return (
    <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_20rem] gap-6">
      <div className="card overflow-hidden">
        <FullCalendar
          plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin, luxonPlugin]}
          initialView="dayGridMonth"
          headerToolbar={{
            left: 'prev,next today',
            center: 'title',
            right: 'dayGridMonth,timeGridWeek,timeGridDay',
          }}
          timeZone={ORG_TIME_ZONE}
          height="auto"
          dayMaxEvents={4}
          nowIndicator
          events={events}
          dateClick={onDateClick}
          eventClick={onEventClick}
          datesSet={onDatesSet}
        />
        <div className="flex flex-wrap gap-4 px-2 pt-4 text-xs text-gray-600">
          <span className="inline-flex items-center gap-2"><span className="h-3 w-3 rounded-sm bg-primary-600" /> Upcoming</span>
          <span className="inline-flex items-center gap-2"><span className="h-3 w-3 rounded-sm bg-teal-700" /> Ticket created</span>
          <span className="inline-flex items-center gap-2"><span className="h-3 w-3 rounded-sm bg-amber-600" /> Note</span>
        </div>
      </div>

      <aside className="card h-fit">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900">Schedules</h2>
          <button
            type="button"
            className="text-sm text-primary-700 hover:underline"
            onClick={() => {
              const today = new Intl.DateTimeFormat('en-CA', { timeZone: ORG_TIME_ZONE }).format(new Date())
              setPanel({ type: 'schedule', schedule: null, date: today, time: '00:00:01' })
            }}
          >
            New
          </button>
        </div>
        {schedules.length === 0 ? (
          <p className="text-sm text-gray-500">No schedules yet. Click a day on the calendar to add one.</p>
        ) : (
          <ul className="space-y-3">
            {schedules.map((schedule) => (
              <li key={schedule.id} className="border border-gray-200 rounded-lg p-3">
                <button
                  type="button"
                  className="text-left w-full"
                  onClick={() => setPanel({
                    type: 'schedule',
                    schedule,
                    date: schedule.date,
                    time: schedule.time,
                  })}
                >
                  <p className="font-medium text-gray-900">{schedule.title}</p>
                  <p className="text-xs text-gray-500 mt-1">{schedule.summary}</p>
                </button>
                <button
                  type="button"
                  className="mt-2 text-xs text-primary-700 hover:underline"
                  onClick={() => toggleSchedule(schedule)}
                >
                  {schedule.isActive ? 'Pause' : 'Resume'}
                </button>
              </li>
            ))}
          </ul>
        )}
      </aside>

      {panel && (
        <CalendarDialog panel={panel} onClose={() => setPanel(null)}>
            {panel.type === 'choose' && (
              <div className="space-y-4">
                <div className="flex items-start justify-between">
                  <div>
                    <h2 id="calendar-dialog-title" tabIndex={-1} className="text-xl font-semibold text-gray-900 outline-none">{panel.date}</h2>
                    <p className="text-sm text-gray-500">Add something on this day.</p>
                  </div>
                  <button type="button" onClick={() => setPanel(null)} className="text-sm text-gray-500 hover:text-gray-800">Close</button>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={() => setPanel({ type: 'note', note: { day: panel.date, body: '' } })}
                  >
                    Leave a note
                  </button>
                  <button
                    type="button"
                    className="btn btn-primary"
                    onClick={() => setPanel({
                      type: 'schedule',
                      schedule: null,
                      date: panel.date,
                      time: panel.time,
                    })}
                  >
                    Schedule a ticket
                  </button>
                </div>
              </div>
            )}

            {panel.type === 'note' && (
              <form onSubmit={saveNote} className="space-y-4">
                <div className="flex items-start justify-between">
                  <div>
                    <h2 id="calendar-dialog-title" tabIndex={-1} className="text-xl font-semibold text-gray-900 outline-none">
                      {panel.note.id ? 'Edit note' : 'New note'}
                    </h2>
                    <p className="text-sm text-gray-500">{panel.note.day}. Visible to every admin.</p>
                  </div>
                  <button type="button" onClick={() => setPanel(null)} className="text-sm text-gray-500 hover:text-gray-800">Close</button>
                </div>
                <textarea
                  className="input min-h-32"
                  value={panel.note.body}
                  onChange={(event) => setPanel({
                    type: 'note',
                    note: { ...panel.note, body: event.target.value },
                  })}
                  required
                  maxLength={5000}
                />
                <div className="flex justify-between gap-3">
                  {panel.note.id ? (
                    <button type="button" onClick={deleteNote} className="btn btn-danger">Delete</button>
                  ) : <span />}
                  <div className="flex gap-2">
                    <button type="button" onClick={() => setPanel(null)} className="btn btn-secondary">Cancel</button>
                    <button type="submit" className="btn btn-primary" disabled={isSavingNote}>
                      {isSavingNote ? 'Saving...' : 'Save note'}
                    </button>
                  </div>
                </div>
              </form>
            )}

            {panel.type === 'schedule' && (
              <ScheduleEditor
                key={panel.schedule?.id ?? `${panel.date}-${panel.time}`}
                schedule={panel.schedule}
                date={panel.date}
                time={panel.time}
                admins={admins}
                ticketId={panel.ticketId}
                onClose={() => setPanel(null)}
                onSaved={async () => {
                  setPanel(null)
                  await refresh()
                }}
              />
            )}
        </CalendarDialog>
      )}
    </div>
  )
}

function CalendarDialog({
  panel,
  onClose,
  children,
}: {
  panel: Panel
  onClose: () => void
  children: ReactNode
}) {
  const dialogRef = useRef<HTMLDialogElement>(null)

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return
    if (!dialog.open) dialog.showModal()
    return () => {
      if (dialog.open) dialog.close()
    }
  }, [])

  const focusKey =
    panel.type === 'note'
      ? `note:${panel.note.id ?? 'new'}:${panel.note.day}`
      : panel.type === 'schedule'
        ? `schedule:${panel.schedule?.id ?? 'new'}:${panel.date}:${panel.time}`
        : `choose:${panel.date}:${panel.time}`

  useEffect(() => {
    dialogRef.current?.querySelector<HTMLElement>('#calendar-dialog-title')?.focus()
  }, [focusKey])

  return (
    <dialog
      ref={dialogRef}
      className="calendar-dialog"
      aria-labelledby="calendar-dialog-title"
      onCancel={(event) => {
        event.preventDefault()
        onClose()
      }}
    >
      {children}
    </dialog>
  )
}

function splitDateStr(dateStr: string, allDay: boolean) {
  if (allDay || dateStr.length === 10) {
    return { date: dateStr.slice(0, 10), time: '00:00:01' }
  }
  const time = dateStr.slice(11, 19)
  return {
    date: dateStr.slice(0, 10),
    time: time.length === 8 ? time : '00:00:01',
  }
}
