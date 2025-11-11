'use client'

import { useEffect, useState, useRef } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useSession } from 'next-auth/react'
import Navbar from '@/components/Navbar'
import StatusBadge from '@/components/StatusBadge'
import PriorityBadge from '@/components/PriorityBadge'
import { TicketWithDetails, Comment, User, TicketStatus, TicketPriority } from '@/types'
import { ArrowLeft, MessageSquare, Paperclip, User as UserIcon, Clock, Upload, Settings } from 'lucide-react'
import Link from 'next/link'
import toast from 'react-hot-toast'
import { format } from 'date-fns'
import { useSocket } from '@/components/SocketProvider'

export default function AdminTicketDetailPage() {
  const params = useParams()
  const router = useRouter()
  const { data: session } = useSession()
  const { socket } = useSocket()
  const [ticket, setTicket] = useState<TicketWithDetails | null>(null)
  const [admins, setAdmins] = useState<User[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [comment, setComment] = useState('')
  const [isInternal, setIsInternal] = useState(false)
  const [isSubmittingComment, setIsSubmittingComment] = useState(false)
  const [isUploadingFile, setIsUploadingFile] = useState(false)
  const [isUpdating, setIsUpdating] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Form state for ticket updates
  const [editMode, setEditMode] = useState(false)
  const [formData, setFormData] = useState({
    status: '' as TicketStatus,
    priority: '' as TicketPriority,
    assignedToId: '',
  })

  const fetchTicket = async () => {
    try {
      const res = await fetch(`/api/tickets/${params.id}`)
      if (res.ok) {
        const data = await res.json()
        setTicket(data)
        setFormData({
          status: data.status,
          priority: data.priority,
          assignedToId: data.assignedToId || '',
        })
      } else if (res.status === 404) {
        toast.error('Ticket not found')
        router.push('/admin/tickets')
      } else {
        toast.error('Failed to load ticket')
      }
    } catch (error) {
      toast.error('Failed to load ticket')
    } finally {
      setIsLoading(false)
    }
  }

  const fetchAdmins = async () => {
    try {
      const res = await fetch('/api/users?role=ADMIN')
      if (res.ok) {
        const data = await res.json()
        setAdmins(data)
      }
    } catch (error) {
      console.error('Failed to fetch admins')
    }
  }

  useEffect(() => {
    fetchTicket()
    fetchAdmins()
  }, [params.id])

  useEffect(() => {
    if (!socket || !params.id) return

    socket.emit('join-ticket', params.id)

    socket.on('ticket:updated', (updatedTicket: TicketWithDetails) => {
      if (updatedTicket.id === params.id) {
        setTicket(updatedTicket)
        setFormData({
          status: updatedTicket.status,
          priority: updatedTicket.priority,
          assignedToId: updatedTicket.assignedToId || '',
        })
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

    return () => {
      socket.emit('leave-ticket', params.id)
      socket.off('ticket:updated')
      socket.off('comment:added')
      socket.off('attachment:added')
    }
  }, [socket, params.id])

  const handleUpdateTicket = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsUpdating(true)

    try {
      const res = await fetch(`/api/tickets/${params.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: formData.status,
          priority: formData.priority,
          assignedToId: formData.assignedToId || null,
        }),
      })

      if (res.ok) {
        toast.success('Ticket updated')
        setEditMode(false)
        fetchTicket()
      } else {
        toast.error('Failed to update ticket')
      }
    } catch (error) {
      toast.error('An error occurred')
    } finally {
      setIsUpdating(false)
    }
  }

  const handleCommentSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!comment.trim()) return

    setIsSubmittingComment(true)

    try {
      const res = await fetch(`/api/tickets/${params.id}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: comment, isInternal }),
      })

      if (res.ok) {
        setComment('')
        setIsInternal(false)
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

  const quickAssignToMe = async () => {
    if (!session?.user?.id) return
    
    setIsUpdating(true)
    try {
      const res = await fetch(`/api/tickets/${params.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ assignedToId: session.user.id }),
      })

      if (res.ok) {
        toast.success('Assigned to you')
        fetchTicket()
      } else {
        toast.error('Failed to assign ticket')
      }
    } catch (error) {
      toast.error('An error occurred')
    } finally {
      setIsUpdating(false)
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
      
      <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-6">
          <Link href="/admin/tickets" className="inline-flex items-center text-primary-600 hover:text-primary-700">
            <ArrowLeft size={20} className="mr-2" />
            Back to all tickets
          </Link>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-6">
            {/* Ticket Header */}
            <div className="card">
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

              <div className="grid grid-cols-2 gap-4 pt-4 border-t border-gray-200">
                <div>
                  <p className="text-sm text-gray-500 mb-1">Category</p>
                  <p className="font-medium">{ticket.category}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500 mb-1">Created</p>
                  <p className="font-medium">{format(new Date(ticket.createdAt), 'PPP')}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500 mb-1">Created By</p>
                  <p className="font-medium">
                    {ticket.createdBy.name}
                    {ticket.createdBy.department && ` (${ticket.createdBy.department})`}
                  </p>
                  <p className="text-xs text-gray-500">{ticket.createdBy.email}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500 mb-1">Assigned To</p>
                  <p className="font-medium">{ticket.assignedTo?.name || 'Unassigned'}</p>
                </div>
              </div>

              {!ticket.assignedToId && (
                <div className="mt-4 pt-4 border-t border-gray-200">
                  <button
                    onClick={quickAssignToMe}
                    disabled={isUpdating}
                    className="btn btn-primary w-full"
                  >
                    {isUpdating ? 'Assigning...' : 'Assign to Me'}
                  </button>
                </div>
              )}
            </div>

            {/* Description */}
            <div className="card">
              <h2 className="text-xl font-bold text-gray-900 mb-4">Description</h2>
              <p className="text-gray-700 whitespace-pre-wrap">{ticket.description}</p>
            </div>

            {/* Attachments */}
            {ticket.attachments && ticket.attachments.length > 0 && (
              <div className="card">
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
            <div className="card">
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
            <div className="card">
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
                      <div className="flex-shrink-0">
                        <div className="w-10 h-10 rounded-full bg-primary-100 flex items-center justify-center">
                          <UserIcon size={20} className="text-primary-600" />
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
                            {comment.isInternal && (
                              <span className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded">
                                Internal
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
                <div className="flex items-center justify-between">
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={isInternal}
                      onChange={(e) => setIsInternal(e.target.checked)}
                      className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                    />
                    <span className="text-sm text-gray-700">Internal note (admin only)</span>
                  </label>
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
          </div>

          {/* Sidebar - Ticket Management */}
          <div className="lg:col-span-1">
            <div className="card sticky top-8">
              <div className="flex items-center gap-2 mb-4">
                <Settings size={20} className="text-gray-600" />
                <h2 className="text-xl font-bold text-gray-900">Ticket Management</h2>
              </div>

              <form onSubmit={handleUpdateTicket} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                  <select
                    className="input"
                    value={formData.status}
                    onChange={(e) => setFormData({ ...formData, status: e.target.value as TicketStatus })}
                    disabled={!editMode}
                  >
                    <option value="OPEN">Open</option>
                    <option value="IN_PROGRESS">In Progress</option>
                    <option value="WAITING">Waiting</option>
                    <option value="RESOLVED">Resolved</option>
                    <option value="CLOSED">Closed</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Priority</label>
                  <select
                    className="input"
                    value={formData.priority}
                    onChange={(e) => setFormData({ ...formData, priority: e.target.value as TicketPriority })}
                    disabled={!editMode}
                  >
                    <option value="LOW">Low</option>
                    <option value="MEDIUM">Medium</option>
                    <option value="HIGH">High</option>
                    <option value="CRITICAL">Critical</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Assign To</label>
                  <select
                    className="input"
                    value={formData.assignedToId}
                    onChange={(e) => setFormData({ ...formData, assignedToId: e.target.value })}
                    disabled={!editMode}
                  >
                    <option value="">Unassigned</option>
                    {admins.map((admin) => (
                      <option key={admin.id} value={admin.id}>
                        {admin.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="flex gap-2">
                  {!editMode ? (
                    <button
                      type="button"
                      onClick={() => setEditMode(true)}
                      className="btn btn-primary w-full"
                    >
                      Edit Ticket
                    </button>
                  ) : (
                    <>
                      <button
                        type="button"
                        onClick={() => {
                          setEditMode(false)
                          setFormData({
                            status: ticket.status,
                            priority: ticket.priority,
                            assignedToId: ticket.assignedToId || '',
                          })
                        }}
                        className="btn btn-secondary flex-1"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        className="btn btn-primary flex-1"
                        disabled={isUpdating}
                      >
                        {isUpdating ? 'Saving...' : 'Save'}
                      </button>
                    </>
                  )}
                </div>
              </form>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}

