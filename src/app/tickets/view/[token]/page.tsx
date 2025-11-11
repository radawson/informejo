'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { format } from 'date-fns'
import { ArrowLeft, MessageSquare, Paperclip, Clock, AlertCircle, CheckCircle } from 'lucide-react'
import StatusBadge from '@/components/StatusBadge'
import PriorityBadge from '@/components/PriorityBadge'
import { TicketWithDetails } from '@/types'
import toast from 'react-hot-toast'

export default function MagicLinkTicketView() {
  const params = useParams()
  const token = params.token as string
  const [ticket, setTicket] = useState<TicketWithDetails | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isInvalid, setIsInvalid] = useState(false)
  const [comment, setComment] = useState('')
  const [isSubmittingComment, setIsSubmittingComment] = useState(false)

  const fetchTicket = async () => {
    try {
      const res = await fetch(`/api/tickets/magic/${token}`)
      if (res.ok) {
        const data = await res.json()
        setTicket(data)
        setIsInvalid(false)
      } else if (res.status === 404 || res.status === 401) {
        setIsInvalid(true)
        toast.error('Invalid or expired link')
      } else {
        toast.error('Failed to load ticket')
      }
    } catch (error) {
      toast.error('Failed to load ticket')
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    fetchTicket()
  }, [token])

  const handleCommentSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!comment.trim() || !ticket) return

    setIsSubmittingComment(true)

    try {
      const res = await fetch(`/api/tickets/magic/${token}/comment`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: comment }),
      })

      if (res.ok) {
        setComment('')
        toast.success('Comment added')
        fetchTicket() // Refresh to show new comment
      } else {
        toast.error('Failed to add comment')
      }
    } catch (error) {
      toast.error('An error occurred')
    } finally {
      setIsSubmittingComment(false)
    }
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading ticket...</p>
        </div>
      </div>
    )
  }

  if (isInvalid || !ticket) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="bg-white border-b border-gray-200">
          <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
            <h1 className="text-2xl font-bold text-primary-600">IT Support</h1>
          </div>
        </div>

        <main className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="card text-center">
            <AlertCircle className="h-16 w-16 text-red-500 mx-auto mb-4" />
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Invalid or Expired Link</h2>
            <p className="text-gray-600 mb-6">
              This ticket viewing link is invalid or has expired. Please check your email for the correct link.
            </p>
            <Link href="/submit-ticket" className="btn btn-primary inline-flex">
              Submit a New Ticket
            </Link>
          </div>
        </main>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Simple Header */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between">
          <h1 className="text-2xl font-bold text-primary-600">IT Support</h1>
          <Link href="/login" className="text-sm text-primary-600 hover:text-primary-700">
            Have an account? Sign in
          </Link>
        </div>
      </div>

      <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-6">
          <p className="text-sm text-gray-500 mb-2">Viewing as: {ticket.createdBy.email}</p>
        </div>

        {/* Ticket Header */}
        <div className="card mb-6">
          <div className="flex justify-between items-start mb-4">
            <div className="flex-1">
              <h2 className="text-3xl font-bold text-gray-900 mb-2">{ticket.title}</h2>
              <p className="text-sm text-gray-500">Ticket #{ticket.id.slice(0, 8)}</p>
            </div>
            <div className="flex flex-col gap-2 items-end">
              <StatusBadge status={ticket.status} />
              <PriorityBadge priority={ticket.priority} />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-4 border-t border-gray-200">
            <div>
              <p className="text-sm text-gray-500 mb-1">Category</p>
              <p className="font-medium">{ticket.category}</p>
            </div>
            <div>
              <p className="text-sm text-gray-500 mb-1">Created</p>
              <p className="font-medium">{format(new Date(ticket.createdAt), 'PPP')}</p>
            </div>
            <div>
              <p className="text-sm text-gray-500 mb-1">Status</p>
              <p className="font-medium">
                {ticket.assignedTo ? `Assigned to ${ticket.assignedTo.name}` : 'Awaiting assignment'}
              </p>
            </div>
          </div>
        </div>

        {/* Status Info Banner */}
        {ticket.status === 'RESOLVED' && (
          <div className="card mb-6 bg-green-50 border-green-200">
            <div className="flex items-center gap-3">
              <CheckCircle className="h-6 w-6 text-green-600" />
              <div>
                <p className="font-semibold text-green-900">Issue Resolved</p>
                <p className="text-sm text-green-800">
                  This ticket has been marked as resolved. If you need further assistance, please add a comment below.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Description */}
        <div className="card mb-6">
          <h3 className="text-xl font-bold text-gray-900 mb-4">Description</h3>
          <p className="text-gray-700 whitespace-pre-wrap">{ticket.description}</p>
        </div>

        {/* Attachments */}
        {ticket.attachments && ticket.attachments.length > 0 && (
          <div className="card mb-6">
            <h3 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
              <Paperclip size={20} />
              Attachments ({ticket.attachments.length})
            </h3>
            <div className="space-y-2">
              {ticket.attachments.map((attachment) => (
                <a
                  key={attachment.id}
                  href={attachment.filePath}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <Paperclip size={16} className="text-gray-500" />
                    <div>
                      <p className="font-medium text-gray-900">{attachment.fileName}</p>
                      <p className="text-xs text-gray-500">
                        {format(new Date(attachment.createdAt), 'PPP')}
                      </p>
                    </div>
                  </div>
                  <span className="text-sm text-gray-500">
                    {(attachment.fileSize / 1024).toFixed(1)} KB
                  </span>
                </a>
              ))}
            </div>
          </div>
        )}

        {/* Comments */}
        <div className="card mb-6">
          <h3 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
            <MessageSquare size={20} />
            Updates & Comments ({ticket.comments.length})
          </h3>

          {/* Comment List */}
          <div className="space-y-4 mb-6">
            {ticket.comments.length === 0 ? (
              <p className="text-gray-500 text-center py-4">No updates yet</p>
            ) : (
              ticket.comments.map((comment) => (
                <div key={comment.id} className="flex gap-4">
                  <div className="flex-shrink-0">
                    <div className="w-10 h-10 rounded-full bg-primary-100 flex items-center justify-center">
                      <span className="text-primary-600 font-semibold text-sm">
                        {comment.user.name.charAt(0).toUpperCase()}
                      </span>
                    </div>
                  </div>
                  <div className="flex-1 bg-gray-50 rounded-lg p-4">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <p className="font-medium text-gray-900">{comment.user.name}</p>
                        {comment.user.role === 'ADMIN' && (
                          <span className="text-xs bg-primary-100 text-primary-700 px-2 py-0.5 rounded">
                            IT Support
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-gray-500 flex items-center gap-1">
                        <Clock size={14} />
                        {format(new Date(comment.createdAt), 'PPP p')}
                      </p>
                    </div>
                    <p className="text-gray-700 whitespace-pre-wrap">{comment.content}</p>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Add Comment Form */}
          <form onSubmit={handleCommentSubmit} className="border-t border-gray-200 pt-4">
            <label htmlFor="comment" className="block text-sm font-medium text-gray-700 mb-2">
              Add a comment or provide additional information
            </label>
            <textarea
              id="comment"
              className="input resize-none mb-4"
              rows={4}
              placeholder="Type your message here..."
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              disabled={isSubmittingComment}
            />
            <div className="flex justify-end">
              <button
                type="submit"
                className="btn btn-primary"
                disabled={isSubmittingComment || !comment.trim()}
              >
                {isSubmittingComment ? 'Adding...' : 'Add Comment'}
              </button>
            </div>
          </form>
        </div>

        {/* Info Box */}
        <div className="card bg-blue-50 border-blue-200">
          <p className="text-sm text-blue-800">
            <strong>Note:</strong> This is a secure link to view your ticket. You'll receive email notifications when there are updates. 
            Bookmark this page or save the link from your email to check back later.
          </p>
        </div>
      </main>
    </div>
  )
}

