'use client'

import { useEffect, useState, useRef } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Navbar from '@/components/Navbar'
import StatusBadge from '@/components/StatusBadge'
import PriorityBadge from '@/components/PriorityBadge'
import { TicketWithDetails, Comment } from '@/types'
import { ArrowLeft, MessageSquare, Paperclip, User, Clock, Upload } from 'lucide-react'
import Link from 'next/link'
import toast from 'react-hot-toast'
import { format } from 'date-fns'
import { useSocket } from '@/components/SocketProvider'

export default function TicketDetailPage() {
  const params = useParams()
  const router = useRouter()
  const { socket } = useSocket()
  const [ticket, setTicket] = useState<TicketWithDetails | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [comment, setComment] = useState('')
  const [isSubmittingComment, setIsSubmittingComment] = useState(false)
  const [isUploadingFile, setIsUploadingFile] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const fetchTicket = async () => {
    try {
      const res = await fetch(`/api/tickets/${params.id}`)
      if (res.ok) {
        const data = await res.json()
        setTicket(data)
      } else if (res.status === 404) {
        toast.error('Ticket not found')
        router.push('/tickets')
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
  }, [params.id])

  useEffect(() => {
    if (!socket || !params.id) return

    socket.emit('join-ticket', params.id)

    socket.on('ticket:updated', (updatedTicket: TicketWithDetails) => {
      if (updatedTicket.id === params.id) {
        setTicket(updatedTicket)
      }
    })

    socket.on('comment:added', (newComment: Comment) => {
      setTicket((prev) => {
        if (!prev) return prev
        return {
          ...prev,
          comments: [...prev.comments, newComment as any],
        }
      })
    })

    socket.on('attachment:added', (newAttachment: any) => {
      setTicket((prev) => {
        if (!prev) return prev
        return {
          ...prev,
          attachments: [...prev.attachments, newAttachment],
        }
      })
    })

    socket.on('ticket:deleted', (data: { id: string }) => {
      if (data.id === params.id) {
        toast.error('This ticket has been deleted')
        router.push('/tickets')
      }
    })

    return () => {
      socket.emit('leave-ticket', params.id)
      socket.off('ticket:updated')
      socket.off('ticket:deleted')
      socket.off('comment:added')
      socket.off('attachment:added')
    }
  }, [socket, params.id])

  const handleCommentSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!comment.trim()) return

    setIsSubmittingComment(true)

    try {
      const res = await fetch(`/api/tickets/${params.id}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: comment }),
      })

      if (res.ok) {
        setComment('')
        toast.success('Comment added')
      } else {
        toast.error('Failed to add comment')
      }
    } catch (error) {
      toast.error('An error occurred')
    } finally {
      setIsSubmittingComment(false)
    }
  }

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setIsUploadingFile(true)

    try {
      const formData = new FormData()
      formData.append('file', file)

      const res = await fetch(`/api/tickets/${params.id}/attachments`, {
        method: 'POST',
        body: formData,
      })

      if (res.ok) {
        toast.success('File uploaded')
        fetchTicket()
      } else {
        const data = await res.json()
        toast.error(data.error || 'Failed to upload file')
      }
    } catch (error) {
      toast.error('An error occurred')
    } finally {
      setIsUploadingFile(false)
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    }
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Navbar />
        <div className="flex items-center justify-center h-96">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto"></div>
            <p className="mt-4 text-gray-600">Loading ticket...</p>
          </div>
        </div>
      </div>
    )
  }

  if (!ticket) return null

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      
      <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-6">
          <Link href="/tickets" className="inline-flex items-center text-primary-600 hover:text-primary-700">
            <ArrowLeft size={20} className="mr-2" />
            Back to tickets
          </Link>
        </div>

        {/* Ticket Header */}
        <div className="card mb-6">
          <div className="flex justify-between items-start mb-4">
            <div className="flex-1">
              <h1 className="text-3xl font-bold text-gray-900 mb-2">{ticket.title}</h1>
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
              <p className="text-sm text-gray-500 mb-1">Assigned To</p>
              <p className="font-medium">{ticket.assignedTo?.name || 'Unassigned'}</p>
            </div>
          </div>
        </div>

        {/* Description */}
        <div className="card mb-6">
          <h2 className="text-xl font-bold text-gray-900 mb-4">Description</h2>
          <p className="text-gray-700 whitespace-pre-wrap">{ticket.description}</p>
        </div>

        {/* Attachments */}
        {ticket.attachments && ticket.attachments.length > 0 && (
          <div className="card mb-6">
            <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
              <Paperclip size={20} />
              Attachments ({ticket.attachments.length})
            </h2>
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
                        Uploaded by {attachment.uploadedBy.name} on {format(new Date(attachment.createdAt), 'PPP')}
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

        {/* Upload File */}
        <div className="card mb-6">
          <h2 className="text-xl font-bold text-gray-900 mb-4">Add Attachment</h2>
          <div className="flex items-center gap-4">
            <input
              ref={fileInputRef}
              type="file"
              onChange={handleFileUpload}
              disabled={isUploadingFile}
              className="hidden"
              id="file-upload"
            />
            <label
              htmlFor="file-upload"
              className={`btn btn-secondary flex items-center gap-2 cursor-pointer ${
                isUploadingFile ? 'opacity-50 cursor-not-allowed' : ''
              }`}
            >
              <Upload size={20} />
              {isUploadingFile ? 'Uploading...' : 'Upload File'}
            </label>
            <p className="text-sm text-gray-500">Max file size: 10MB</p>
          </div>
        </div>

        {/* Comments */}
        <div className="card mb-6">
          <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
            <MessageSquare size={20} />
            Comments ({ticket.comments.length})
          </h2>

          {/* Comment List */}
          <div className="space-y-4 mb-6">
            {ticket.comments.length === 0 ? (
              <p className="text-gray-500 text-center py-4">No comments yet</p>
            ) : (
              ticket.comments.map((comment) => (
                <div key={comment.id} className="flex gap-4">
                  <div className="shrink-0">
                    <div className="w-10 h-10 rounded-full bg-primary-100 flex items-center justify-center">
                      <User size={20} className="text-primary-600" />
                    </div>
                  </div>
                  <div className="flex-1 bg-gray-50 rounded-lg p-4">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <p className="font-medium text-gray-900">{comment.user.name}</p>
                        {comment.user.role === 'ADMIN' && (
                          <span className="text-xs bg-primary-100 text-primary-700 px-2 py-0.5 rounded">
                            Admin
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
            <textarea
              className="input resize-none mb-4"
              rows={4}
              placeholder="Add a comment..."
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
      </main>
    </div>
  )
}

