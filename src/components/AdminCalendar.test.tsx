import '@testing-library/jest-dom'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import { DateTime } from 'luxon'
import { ORG_TIME_ZONE } from '@/lib/recurrence'
import AdminCalendar from './AdminCalendar'

beforeEach(() => {
  window.history.replaceState({}, '', '/')
  global.fetch = jest.fn(async (input) => ({
    ok: true,
    json: async () => String(input).startsWith('/api/admin/calendar?') ? { events: [] } : [],
  })) as jest.Mock
})

afterEach(() => {
  jest.restoreAllMocks()
})

it('loads calendar ranges and switches between month, week, and day views', async () => {
  render(<AdminCalendar />)
  await waitFor(() => expect(global.fetch).toHaveBeenCalledWith(expect.stringMatching(/^\/api\/admin\/calendar\?start=/)))
  const calendarRequest = (global.fetch as jest.Mock).mock.calls.find(([url]) => String(url).startsWith('/api/admin/calendar?'))![0]
  const params = new URL(calendarRequest, 'http://localhost').searchParams
  for (const boundary of ['start', 'end']) {
    const date = DateTime.fromISO(params.get(boundary)!, { zone: ORG_TIME_ZONE })
    expect(date.isValid).toBe(true)
    expect(date.hour).toBe(0)
  }
  expect(screen.getByRole('tab', { name: /month view/i })).toHaveAttribute('aria-selected', 'true')

  fireEvent.click(screen.getByRole('tab', { name: /week view/i }))
  await waitFor(() => expect(screen.getByRole('tab', { name: /week view/i })).toHaveAttribute('aria-selected', 'true'))

  fireEvent.click(screen.getByRole('tab', { name: /day view/i }))
  await waitFor(() => expect(screen.getByRole('tab', { name: /day view/i })).toHaveAttribute('aria-selected', 'true'))
})
