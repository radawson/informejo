'use client'

import dynamic from 'next/dynamic'
import Navbar from '@/components/Navbar'

const AdminCalendar = dynamic(() => import('@/components/AdminCalendar'), {
  ssr: false,
  loading: () => <p className="text-gray-600">Loading calendar...</p>,
})

export default function AdminCalendarPage() {
  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-gray-900">Calendar</h1>
          <p className="mt-1 text-gray-600">
            Schedule ticket reminders and leave notes on a day. Click an empty day or time to add one.
          </p>
        </div>
        <AdminCalendar />
      </main>
    </div>
  )
}
