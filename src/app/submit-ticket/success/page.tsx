'use client'

import { Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { CheckCircle, Mail, ExternalLink } from 'lucide-react'

function SuccessContent() {
  const searchParams = useSearchParams()
  const ticketId = searchParams.get('ticket')

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Simple Header */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <h1 className="text-2xl font-bold text-primary-600">IT Support</h1>
        </div>
      </div>

      <main className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="card text-center">
          <div className="flex justify-center mb-6">
            <div className="rounded-full bg-green-100 p-6">
              <CheckCircle className="h-16 w-16 text-green-600" />
            </div>
          </div>

          <h2 className="text-3xl font-bold text-gray-900 mb-4">
            Ticket Submitted Successfully!
          </h2>

          {ticketId && (
            <div className="mb-6">
              <p className="text-lg text-gray-700 mb-2">Your ticket ID:</p>
              <p className="text-2xl font-mono font-semibold text-primary-600">
                #{ticketId.slice(0, 8)}
              </p>
            </div>
          )}

          <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 mb-8 text-left">
            <div className="flex items-start gap-3">
              <Mail className="h-6 w-6 text-blue-600 flex-shrink-0 mt-1" />
              <div>
                <h3 className="font-semibold text-blue-900 mb-2">Check Your Email</h3>
                <p className="text-blue-800 text-sm">
                  We've sent you an email with:
                </p>
                <ul className="list-disc list-inside text-blue-800 text-sm mt-2 space-y-1">
                  <li>A unique link to view and track your ticket</li>
                  <li>Your ticket details</li>
                  <li>Information about next steps</li>
                </ul>
                <p className="text-blue-700 text-xs mt-3">
                  <strong>Important:</strong> Save the link from your email - you'll need it to check your ticket status later.
                </p>
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <div className="bg-gray-50 rounded-lg p-4">
              <h3 className="font-semibold text-gray-900 mb-2">What happens next?</h3>
              <ol className="text-left text-gray-700 space-y-2">
                <li className="flex items-start gap-2">
                  <span className="font-semibold text-primary-600">1.</span>
                  <span>Our IT team will review your ticket</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="font-semibold text-primary-600">2.</span>
                  <span>You'll receive email notifications for any updates</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="font-semibold text-primary-600">3.</span>
                  <span>Use the magic link in your email to view ticket progress</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="font-semibold text-primary-600">4.</span>
                  <span>We'll work to resolve your issue as quickly as possible</span>
                </li>
              </ol>
            </div>

            <div className="pt-6 space-y-3">
              <Link 
                href="/submit-ticket" 
                className="btn btn-primary w-full flex items-center justify-center gap-2"
              >
                <ExternalLink size={20} />
                Submit Another Ticket
              </Link>
              <Link 
                href="/" 
                className="btn btn-secondary w-full"
              >
                Back to Home
              </Link>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}

export default function TicketSuccessPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gray-50">
        <div className="flex items-center justify-center h-96">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto"></div>
            <p className="mt-4 text-gray-600">Loading...</p>
          </div>
        </div>
      </div>
    }>
      <SuccessContent />
    </Suspense>
  )
}

