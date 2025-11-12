'use client'

import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import Navbar from '@/components/Navbar'
import StatsCard from '@/components/StatsCard'
import TicketCard from '@/components/TicketCard'
import { Ticket, DashboardStats } from '@/types'
import { Ticket as TicketIcon, Clock, CheckCircle, XCircle, AlertCircle, Plus } from 'lucide-react'
import Link from 'next/link'
import toast from 'react-hot-toast'
import { useSocket } from '@/components/SocketProvider'

export default function DashboardPage() {
  const { data: session } = useSession()
  const { socket } = useSocket()
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [recentTickets, setRecentTickets] = useState<Ticket[]>([])
  const [isLoading, setIsLoading] = useState(true)

  const fetchData = async () => {
    try {
      const [statsRes, ticketsRes] = await Promise.all([
        fetch('/api/stats'),
        fetch('/api/tickets'),
      ])

      if (statsRes.ok) {
        const statsData = await statsRes.json()
        setStats(statsData)
      }

      if (ticketsRes.ok) {
        const ticketsData = await ticketsRes.json()
        setRecentTickets(ticketsData.slice(0, 5))
      }
    } catch (error) {
      toast.error('Failed to load dashboard data')
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
  }, [])

  useEffect(() => {
    if (!socket) return

    socket.on('ticket:created', () => {
      fetchData()
    })

    socket.on('ticket:updated', () => {
      fetchData()
    })

    socket.on('ticket:deleted', () => {
      fetchData()
    })

    return () => {
      socket.off('ticket:created')
      socket.off('ticket:updated')
      socket.off('ticket:deleted')
    }
  }, [socket])

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Navbar />
        <div className="flex items-center justify-center h-96">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto"></div>
            <p className="mt-4 text-gray-600">Loading...</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Welcome, {session?.user?.name || 'Guest'}</h1>
            <p className="text-gray-600 mt-1">Here's an overview of your support tickets</p>
          </div>
          <Link href="/tickets/new" className="btn btn-primary flex items-center gap-2">
            <Plus size={20} />
            New Ticket
          </Link>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <StatsCard
            title={session?.user?.name ? "My Tickets" : "All Tickets"}
            priorityData={stats?.priorityBreakdown?.myTickets}
            value={0}
            icon={TicketIcon}
            color="blue"
          />
          <StatsCard
            title="Open"
            priorityData={stats?.priorityBreakdown?.open}
            value={0}
            icon={Clock}
            color="yellow"
          />
          <StatsCard
            title="In Progress"
            priorityData={stats?.priorityBreakdown?.inProgress}
            value={0}
            icon={AlertCircle}
            color="purple"
          />
          <StatsCard
            title="Resolved"
            priorityData={stats?.priorityBreakdown?.resolved}
            value={0}
            icon={CheckCircle}
            color="green"
          />
        </div>

        {/* Recent Tickets */}
        <div className="mb-8">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-2xl font-bold text-gray-900">Recent Tickets</h2>
            <Link href="/tickets" className="text-primary-600 hover:text-primary-700 font-medium">
              View all →
            </Link>
          </div>

          {recentTickets.length === 0 ? (
            <div className="card text-center py-12">
              <TicketIcon className="mx-auto h-12 w-12 text-gray-400" />
              <h3 className="mt-2 text-sm font-medium text-gray-900">No tickets yet</h3>
              <p className="mt-1 text-sm text-gray-500">Get started by creating a new support ticket.</p>
              <Link href="/tickets/new" className="mt-4 inline-flex btn btn-primary">
                <Plus size={20} className="mr-2" />
                New Ticket
              </Link>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4">
              {recentTickets.map((ticket) => (
                <TicketCard key={ticket.id} ticket={ticket} />
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  )
}

