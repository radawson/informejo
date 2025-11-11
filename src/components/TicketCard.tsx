import Link from 'next/link'
import { format } from 'date-fns'
import { MessageSquare, Paperclip, User } from 'lucide-react'
import StatusBadge from './StatusBadge'
import PriorityBadge from './PriorityBadge'
import { Ticket } from '@/types'

interface TicketCardProps {
  ticket: Ticket
  isAdmin?: boolean
}

export default function TicketCard({ ticket, isAdmin = false }: TicketCardProps) {
  const ticketUrl = isAdmin ? `/admin/tickets/${ticket.id}` : `/tickets/${ticket.id}`

  return (
    <Link href={ticketUrl}>
      <div className="card hover:shadow-md transition-shadow cursor-pointer">
        <div className="flex justify-between items-start mb-3">
          <div className="flex-1">
            <h3 className="text-lg font-semibold text-gray-900 mb-1">{ticket.title}</h3>
            <p className="text-sm text-gray-500">
              Ticket #{ticket.id.slice(0, 8)}
            </p>
          </div>
          <div className="flex flex-col gap-2 items-end">
            <StatusBadge status={ticket.status} size="sm" />
            <PriorityBadge priority={ticket.priority} size="sm" />
          </div>
        </div>

        <p className="text-gray-600 text-sm mb-4 line-clamp-2">{ticket.description}</p>

        <div className="flex items-center justify-between text-sm text-gray-500">
          <div className="flex items-center gap-4">
            <span className="inline-flex items-center gap-1">
              <MessageSquare size={16} />
              {ticket._count?.comments || 0}
            </span>
            <span className="inline-flex items-center gap-1">
              <Paperclip size={16} />
              {ticket._count?.attachments || 0}
            </span>
          </div>
          <div className="flex items-center gap-2">
            {isAdmin && ticket.assignedTo && (
              <span className="inline-flex items-center gap-1 text-xs bg-gray-100 px-2 py-1 rounded">
                <User size={14} />
                {ticket.assignedTo.name}
              </span>
            )}
            <span className="text-xs">{format(new Date(ticket.createdAt), 'MMM d, yyyy')}</span>
          </div>
        </div>

        {isAdmin && !ticket.assignedToId && (
          <div className="mt-3 pt-3 border-t border-gray-200">
            <span className="text-xs font-medium text-orange-600">Unassigned</span>
          </div>
        )}

        {ticket.createdBy && isAdmin && (
          <div className="mt-2 text-xs text-gray-500 flex items-center gap-2">
            <span>
              Created by {ticket.createdBy.name}
              {ticket.createdBy.department && ` (${ticket.createdBy.department})`}
            </span>
            {ticket.createdBy.role === 'GUEST' && (
              <span className="px-2 py-0.5 bg-gray-100 text-gray-700 rounded-full text-xs font-medium">
                Guest User
              </span>
            )}
          </div>
        )}
      </div>
    </Link>
  )
}

