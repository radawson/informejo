'use client'

import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import Navbar from '@/components/Navbar'
import StatsCard from '@/components/StatsCard'
import TicketCard from '@/components/TicketCard'
import { Ticket, DashboardStats } from '@/types'
import { Ticket as TicketIcon, Clock, CheckCircle, AlertTriangle, Users, Timer } from 'lucide-react'
import Link from 'next/link'
import toast from 'react-hot-toast'
import { useSocket } from '@/components/SocketProvider'

interface VersionInfo {
  version: string
  name: string
}

export default function AdminDashboardPage() {
  const { data: session } = useSession()
  const { socket } = useSocket()
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [unassignedTickets, setUnassignedTickets] = useState<Ticket[]>([])
  const [myTickets, setMyTickets] = useState<Ticket[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [version, setVersion] = useState<VersionInfo | null>(null)

  const fetchData = async () => {
    try {
      const [statsRes, unassignedRes, myTicketsRes, versionRes] = await Promise.all([
        fetch('/api/stats'),
        fetch('/api/tickets?status=OPEN'),
        fetch('/api/tickets?assignedToMe=true'),
        fetch('/api/version'),
      ])

      if (statsRes.ok) {
        const statsData = await statsRes.json()
        setStats(statsData)
      }

      if (unassignedRes.ok) {
        const data = await unassignedRes.json()
        setUnassignedTickets(data.filter((t: Ticket) => !t.assignedToId).slice(0, 5))
      }

      if (myTicketsRes.ok) {
        const data = await myTicketsRes.json()
        setMyTickets(data.slice(0, 5))
      }

      if (versionRes.ok) {
        const versionData = await versionRes.json()
        setVersion(versionData)
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
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Admin Dashboard</h1>
          <p className="text-gray-600 mt-1">System-wide ticket overview and management</p>
        </div>

        {/* Stats Grid with Pie Charts */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <StatsCard
            title="Total Tickets"
            priorityData={stats?.priorityBreakdown?.all}
            value={0}
            icon={TicketIcon}
            color="blue"
          />
          <StatsCard
            title="Unassigned Tickets"
            priorityData={stats?.priorityBreakdown?.unassigned}
            value={0}
            icon={AlertTriangle}
            color="red"
          />
          <StatsCard
            title="Assigned to Me"
            priorityData={stats?.priorityBreakdown?.myAssigned}
            value={0}
            icon={Users}
            color="purple"
          />
          <StatsCard
            title="Avg Resolution Time"
            value={`${stats?.avgResolutionTime || 0}h`}
            icon={Timer}
            color="green"
            subtitle="Hours"
          />
        </div>

        {/* Secondary Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <div className="card">
            <p className="text-sm text-gray-600 mb-1">Open</p>
            <p className="text-2xl font-bold text-blue-600">{stats?.openTickets || 0}</p>
          </div>
          <div className="card">
            <p className="text-sm text-gray-600 mb-1">In Progress</p>
            <p className="text-2xl font-bold text-purple-600">{stats?.inProgressTickets || 0}</p>
          </div>
          <div className="card">
            <p className="text-sm text-gray-600 mb-1">Waiting</p>
            <p className="text-2xl font-bold text-yellow-600">{stats?.waitingTickets || 0}</p>
          </div>
          <div className="card">
            <p className="text-sm text-gray-600 mb-1">Closed</p>
            <p className="text-2xl font-bold text-green-600">{stats?.closedTicketsTotal || 0}</p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Unassigned Tickets */}
          <div>
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-2xl font-bold text-gray-900">Unassigned Tickets</h2>
              <Link href="/admin/tickets?filter=unassigned" className="text-primary-600 hover:text-primary-700 font-medium">
                View all →
              </Link>
            </div>

            {unassignedTickets.length === 0 ? (
              <div className="card text-center py-12">
                <CheckCircle className="mx-auto h-12 w-12 text-green-400" />
                <h3 className="mt-2 text-sm font-medium text-gray-900">All caught up!</h3>
                <p className="mt-1 text-sm text-gray-500">No unassigned tickets at the moment.</p>
              </div>
            ) : (
              <div className="space-y-4">
                {unassignedTickets.map((ticket) => (
                  <TicketCard key={ticket.id} ticket={ticket} isAdmin />
                ))}
              </div>
            )}
          </div>

          {/* My Assigned Tickets */}
          <div>
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-2xl font-bold text-gray-900">My Assigned Tickets</h2>
              <Link href="/admin/tickets?filter=assigned-to-me" className="text-primary-600 hover:text-primary-700 font-medium">
                View all →
              </Link>
            </div>

            {myTickets.length === 0 ? (
              <div className="card text-center py-12">
                <TicketIcon className="mx-auto h-12 w-12 text-gray-400" />
                <h3 className="mt-2 text-sm font-medium text-gray-900">No tickets assigned</h3>
                <p className="mt-1 text-sm text-gray-500">You don't have any tickets assigned to you.</p>
              </div>
            ) : (
              <div className="space-y-4">
                {myTickets.map((ticket) => (
                  <TicketCard key={ticket.id} ticket={ticket} isAdmin />
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Version Info */}
        {version && (
          <div className="mt-8 pt-6 border-t border-gray-200">
            <p className="text-xs text-gray-500 text-center">
              {version.name} v{version.version}
            </p>
          </div>
        )}
      </main>
    </div>
  )
}

