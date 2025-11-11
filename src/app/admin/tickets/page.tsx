'use client'

import { useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import Navbar from '@/components/Navbar'
import TicketCard from '@/components/TicketCard'
import { Ticket, TicketStatus, TicketPriority } from '@/types'
import { Filter, Search } from 'lucide-react'
import toast from 'react-hot-toast'
import { useSocket } from '@/components/SocketProvider'

export default function AdminTicketsPage() {
  const searchParams = useSearchParams()
  const { socket } = useSocket()
  const [tickets, setTickets] = useState<Ticket[]>([])
  const [filteredTickets, setFilteredTickets] = useState<Ticket[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState<TicketStatus | 'ALL'>('ALL')
  const [priorityFilter, setPriorityFilter] = useState<TicketPriority | 'ALL'>('ALL')
  const [assignmentFilter, setAssignmentFilter] = useState<'ALL' | 'ASSIGNED' | 'UNASSIGNED'>('ALL')

  const fetchTickets = async () => {
    try {
      const res = await fetch('/api/tickets')
      if (res.ok) {
        const data = await res.json()
        setTickets(data)
        setFilteredTickets(data)
      } else {
        toast.error('Failed to load tickets')
      }
    } catch (error) {
      toast.error('Failed to load tickets')
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    fetchTickets()
  }, [])

  useEffect(() => {
    if (!socket) return

    socket.on('ticket:created', (ticket: Ticket) => {
      setTickets((prev) => [ticket, ...prev])
      toast.success('New ticket created')
    })

    socket.on('ticket:updated', (updatedTicket: Ticket) => {
      setTickets((prev) =>
        prev.map((t) => (t.id === updatedTicket.id ? updatedTicket : t))
      )
    })

    return () => {
      socket.off('ticket:created')
      socket.off('ticket:updated')
    }
  }, [socket])

  useEffect(() => {
    let filtered = tickets

    // Apply search filter
    if (searchTerm) {
      filtered = filtered.filter(
        (ticket) =>
          ticket.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
          ticket.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
          ticket.createdBy?.name.toLowerCase().includes(searchTerm.toLowerCase())
      )
    }

    // Apply status filter
    if (statusFilter !== 'ALL') {
      filtered = filtered.filter((ticket) => ticket.status === statusFilter)
    }

    // Apply priority filter
    if (priorityFilter !== 'ALL') {
      filtered = filtered.filter((ticket) => ticket.priority === priorityFilter)
    }

    // Apply assignment filter
    if (assignmentFilter === 'UNASSIGNED') {
      filtered = filtered.filter((ticket) => !ticket.assignedToId)
    } else if (assignmentFilter === 'ASSIGNED') {
      filtered = filtered.filter((ticket) => ticket.assignedToId)
    }

    setFilteredTickets(filtered)
  }, [tickets, searchTerm, statusFilter, priorityFilter, assignmentFilter])

  useEffect(() => {
    const filter = searchParams.get('filter')
    if (filter === 'unassigned') {
      setAssignmentFilter('UNASSIGNED')
    } else if (filter === 'assigned-to-me') {
      // This would require session data, handled by API
    }
  }, [searchParams])

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Navbar />
        <div className="flex items-center justify-center h-96">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto"></div>
            <p className="mt-4 text-gray-600">Loading tickets...</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-8">All Tickets</h1>

        {/* Filters */}
        <div className="card mb-6">
          <div className="space-y-4">
            <div className="flex flex-col md:flex-row gap-4">
              <div className="flex-1">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
                  <input
                    type="text"
                    placeholder="Search tickets or users..."
                    className="input pl-10"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                </div>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <select
                className="input"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as any)}
              >
                <option value="ALL">All Status</option>
                <option value="OPEN">Open</option>
                <option value="IN_PROGRESS">In Progress</option>
                <option value="WAITING">Waiting</option>
                <option value="RESOLVED">Resolved</option>
                <option value="CLOSED">Closed</option>
              </select>
              <select
                className="input"
                value={priorityFilter}
                onChange={(e) => setPriorityFilter(e.target.value as any)}
              >
                <option value="ALL">All Priority</option>
                <option value="LOW">Low</option>
                <option value="MEDIUM">Medium</option>
                <option value="HIGH">High</option>
                <option value="CRITICAL">Critical</option>
              </select>
              <select
                className="input"
                value={assignmentFilter}
                onChange={(e) => setAssignmentFilter(e.target.value as any)}
              >
                <option value="ALL">All Tickets</option>
                <option value="UNASSIGNED">Unassigned</option>
                <option value="ASSIGNED">Assigned</option>
              </select>
            </div>
          </div>
        </div>

        {/* Results Summary */}
        <div className="mb-4">
          <p className="text-sm text-gray-600">
            Showing <span className="font-medium">{filteredTickets.length}</span> of{' '}
            <span className="font-medium">{tickets.length}</span> tickets
          </p>
        </div>

        {/* Tickets List */}
        {filteredTickets.length === 0 ? (
          <div className="card text-center py-12">
            <Filter className="mx-auto h-12 w-12 text-gray-400" />
            <h3 className="mt-2 text-sm font-medium text-gray-900">No tickets found</h3>
            <p className="mt-1 text-sm text-gray-500">Try adjusting your filters</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4">
            {filteredTickets.map((ticket) => (
              <TicketCard key={ticket.id} ticket={ticket} isAdmin />
            ))}
          </div>
        )}
      </main>
    </div>
  )
}

