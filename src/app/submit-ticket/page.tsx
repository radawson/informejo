'use client'

import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import toast from 'react-hot-toast'
import { Send, X, Paperclip } from 'lucide-react'

export default function AnonymousTicketPage() {
  const router = useRouter()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [selectedFiles, setSelectedFiles] = useState<File[]>([])
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    title: '',
    description: '',
    category: 'OTHER',
    priority: 'MEDIUM',
  })

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || [])
    const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10MB
    
    const validFiles = files.filter(file => {
      if (file.size > MAX_FILE_SIZE) {
        toast.error(`${file.name} exceeds 10MB size limit`)
        return false
      }
      return true
    })

    setSelectedFiles(prev => [...prev, ...validFiles])
    
    // Reset input to allow selecting the same file again
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  const removeFile = (index: number) => {
    setSelectedFiles(prev => prev.filter((_, i) => i !== index))
  }

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return bytes + ' B'
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB'
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)

    try {
      // Create FormData for file uploads
      const formDataToSend = new FormData()
      formDataToSend.append('name', formData.name)
      formDataToSend.append('email', formData.email)
      formDataToSend.append('title', formData.title)
      formDataToSend.append('description', formData.description)
      formDataToSend.append('category', formData.category)
      formDataToSend.append('priority', formData.priority)

      // Append all selected files
      selectedFiles.forEach((file) => {
        formDataToSend.append('files', file)
      })

      const res = await fetch('/api/tickets/anonymous', {
        method: 'POST',
        body: formDataToSend,
      })

      if (!res.ok) {
        const data = await res.json()
        toast.error(data.error || 'Failed to submit ticket')
        return
      }

      const { ticketId, magicLink } = await res.json()
      toast.success('Ticket submitted successfully! Check your email for updates.')
      
      // Show magic link (also sent via email)
      router.push(`/submit-ticket/success?ticket=${ticketId}`)
    } catch (error) {
      toast.error('An error occurred')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Simple Header */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <h1 className="text-2xl font-bold text-primary-600">IT Support</h1>
        </div>
      </div>

      <main className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-6">
          <h2 className="text-3xl font-bold text-gray-900">Submit a Support Ticket</h2>
          <p className="mt-2 text-gray-600">
            Fill out the form below and we'll get back to you as soon as possible. 
            You'll receive email updates about your ticket.
          </p>
          <p className="mt-2 text-sm text-gray-500">
            Have an account? <Link href="/login" className="text-primary-600 hover:text-primary-700 font-medium">Sign in here</Link>
          </p>
        </div>

        <div className="card">
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Contact Information */}
            <div className="border-b border-gray-200 pb-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Contact Information</h3>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-1">
                    Your Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    id="name"
                    type="text"
                    required
                    className="input"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="John Doe"
                  />
                </div>

                <div>
                  <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
                    Email Address <span className="text-red-500">*</span>
                  </label>
                  <input
                    id="email"
                    type="email"
                    required
                    className="input"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    placeholder="john@example.com"
                  />
                  <p className="mt-1 text-xs text-gray-500">We'll send ticket updates to this email</p>
                </div>
              </div>
            </div>

            {/* Issue Details */}
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Issue Details</h3>

              <div className="space-y-4">
                <div>
                  <label htmlFor="title" className="block text-sm font-medium text-gray-700 mb-1">
                    Issue Title <span className="text-red-500">*</span>
                  </label>
                  <input
                    id="title"
                    type="text"
                    required
                    className="input"
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                    placeholder="Brief description of the issue"
                    minLength={5}
                    maxLength={200}
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="category" className="block text-sm font-medium text-gray-700 mb-1">
                      Category <span className="text-red-500">*</span>
                    </label>
                    <select
                      id="category"
                      required
                      className="input"
                      value={formData.category}
                      onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                    >
                      <option value="HARDWARE">Hardware</option>
                      <option value="SOFTWARE">Software</option>
                      <option value="NETWORK">Network</option>
                      <option value="ACCESS">Access/Permissions</option>
                      <option value="OTHER">Other</option>
                    </select>
                  </div>

                  <div>
                    <label htmlFor="priority" className="block text-sm font-medium text-gray-700 mb-1">
                      Priority
                    </label>
                    <select
                      id="priority"
                      className="input"
                      value={formData.priority}
                      onChange={(e) => setFormData({ ...formData, priority: e.target.value })}
                    >
                      <option value="LOW">Low</option>
                      <option value="MEDIUM">Medium</option>
                      <option value="HIGH">High</option>
                      <option value="CRITICAL">Critical</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label htmlFor="description" className="block text-sm font-medium text-gray-700 mb-1">
                    Description <span className="text-red-500">*</span>
                  </label>
                  <textarea
                    id="description"
                    required
                    rows={8}
                    className="input resize-none"
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    placeholder="Please provide detailed information about your issue, including any error messages and steps to reproduce."
                    minLength={10}
                  />
                </div>

                <div>
                  <label htmlFor="attachments" className="block text-sm font-medium text-gray-700 mb-1">
                    Attachments
                  </label>
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <input
                        ref={fileInputRef}
                        id="attachments"
                        type="file"
                        multiple
                        className="hidden"
                        onChange={handleFileSelect}
                        accept="*/*"
                      />
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        className="btn btn-secondary flex items-center gap-2"
                      >
                        <Paperclip size={18} />
                        Add Files
                      </button>
                      <span className="text-sm text-gray-500">
                        Maximum 10MB per file
                      </span>
                    </div>
                    
                    {selectedFiles.length > 0 && (
                      <div className="mt-3 space-y-2">
                        {selectedFiles.map((file, index) => (
                          <div
                            key={index}
                            className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border border-gray-200"
                          >
                            <div className="flex items-center gap-2 flex-1 min-w-0">
                              <Paperclip size={16} className="text-gray-400 shrink-0" />
                              <span className="text-sm text-gray-700 truncate" title={file.name}>
                                {file.name}
                              </span>
                              <span className="text-xs text-gray-500 shrink-0">
                                ({formatFileSize(file.size)})
                              </span>
                            </div>
                            <button
                              type="button"
                              onClick={() => removeFile(index)}
                              className="ml-2 p-1 text-gray-400 hover:text-red-600 transition-colors"
                              aria-label="Remove file"
                            >
                              <X size={18} />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-4 pt-4 border-t border-gray-200">
              <Link href="/" className="btn btn-secondary">
                Cancel
              </Link>
              <button
                type="submit"
                className="btn btn-primary flex items-center gap-2"
                disabled={isSubmitting}
              >
                <Send size={20} />
                {isSubmitting ? 'Submitting...' : 'Submit Ticket'}
              </button>
            </div>
          </form>
        </div>
      </main>
    </div>
  )
}

