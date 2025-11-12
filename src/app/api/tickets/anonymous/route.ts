import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'
import { TicketStatus, TicketPriority, TicketCategory, Role } from '@prisma/client'
import { createMagicLink } from '@/lib/magic-link'
import { sendTicketCreatedEmail, sendNewTicketNotificationToAdmins } from '@/lib/email'
import { writeFile, mkdir } from 'fs/promises'
import path from 'path'
import { existsSync } from 'fs'

const UPLOAD_DIR = process.env.UPLOAD_DIR || './uploads'
const MAX_FILE_SIZE = parseInt(process.env.MAX_FILE_SIZE || '10485760') // 10MB

const anonymousTicketSchema = z.object({
  name: z.string().min(2),
  email: z.string().email(),
  title: z.string().min(5).max(200),
  description: z.string().min(10),
  category: z.nativeEnum(TicketCategory),
  priority: z.nativeEnum(TicketPriority).optional(),
})

/**
 * POST /api/tickets/anonymous
 * Submit a ticket without authentication
 * Creates a GUEST user if email doesn't exist
 * Supports file attachments via FormData
 */
export async function POST(req: NextRequest) {
  try {
    // Parse FormData
    const formData = await req.formData()
    
    // Extract ticket data from form fields
    const ticketData = {
      name: formData.get('name') as string,
      email: formData.get('email') as string,
      title: formData.get('title') as string,
      description: formData.get('description') as string,
      category: formData.get('category') as string,
      priority: formData.get('priority') as string | null,
    }

    // Validate ticket data
    const data = anonymousTicketSchema.parse({
      ...ticketData,
      priority: ticketData.priority ? ticketData.priority as TicketPriority : undefined,
    })

    // Find or create GUEST user
    let user = await prisma.user.findUnique({
      where: { email: data.email },
    })

    if (!user) {
      // Create new GUEST user
      user = await prisma.user.create({
        data: {
          email: data.email,
          name: data.name,
          role: Role.GUEST,
          isKeycloakUser: false,
          isActive: true,
        },
      })
      console.log('Created new GUEST user:', data.email)
    } else if (user.role !== Role.GUEST) {
      // Update name if user exists but is not GUEST
      if (user.name !== data.name) {
        await prisma.user.update({
          where: { id: user.id },
          data: { name: data.name },
        })
      }
    }

    // Create ticket
    const ticket = await prisma.ticket.create({
      data: {
        title: data.title,
        description: data.description,
        category: data.category,
        priority: data.priority || TicketPriority.MEDIUM,
        status: TicketStatus.OPEN,
        createdById: user.id,
      },
      include: {
        createdBy: true,
      },
    })

    // Handle file uploads - process in parallel for better performance
    const files = formData.getAll('files') as File[]
    let uploadedAttachments: any[] = []

    if (files.length > 0) {
      // Create upload directory if it doesn't exist
      const ticketDir = path.join(UPLOAD_DIR, ticket.id)
      if (!existsSync(ticketDir)) {
        await mkdir(ticketDir, { recursive: true })
      }

      // Filter and validate files first
      const validFiles = files.filter((file): file is File => {
        if (!file || !(file instanceof File)) return false
        if (file.size > MAX_FILE_SIZE) {
          console.warn(`File ${file.name} exceeds size limit, skipping`)
          return false
        }
        return true
      })

      // Process files in parallel for better performance
      const filePromises = validFiles.map(async (file, index) => {
        try {
          // Generate unique filename with index to avoid timestamp collisions
          const timestamp = Date.now()
          const sanitizedFileName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_')
          const fileName = `${timestamp}-${index}-${sanitizedFileName}`
          const filePath = path.join(ticketDir, fileName)

          // Save file (using arrayBuffer is fine for files up to 10MB)
          const bytes = await file.arrayBuffer()
          const buffer = Buffer.from(bytes)
          await writeFile(filePath, buffer)

          // Return attachment data for batch creation
          return {
            fileName: file.name,
            filePath: `/uploads/${ticket.id}/${fileName}`,
            fileSize: file.size,
            mimeType: file.type || 'application/octet-stream',
            ticketId: ticket.id,
            uploadedById: user.id,
          }
        } catch (fileError) {
          console.error(`Error uploading file ${file.name}:`, fileError)
          return null
        }
      })

      // Wait for all files to be written to disk
      const attachmentData = await Promise.all(filePromises)
      const validAttachmentData = attachmentData.filter((data): data is NonNullable<typeof data> => data !== null)

      // Batch create attachment records for better database performance
      if (validAttachmentData.length > 0) {
        uploadedAttachments = await Promise.all(
          validAttachmentData.map(data =>
            prisma.attachment.create({ data })
          )
        )
      }
    }

    // Generate magic link for ticket viewing
    const magicLink = await createMagicLink(user.id)

    // Return response immediately, then send emails asynchronously
    // This improves perceived performance for the user
    const response = NextResponse.json({
      success: true,
      ticketId: ticket.id,
      magicLink,
      attachmentsCount: uploadedAttachments.length,
      message: 'Ticket submitted successfully. Check your email for a link to view your ticket.',
    }, { status: 201 })

    // Send emails asynchronously (don't await - fire and forget)
    // This prevents blocking the response
    Promise.all([
      sendTicketCreatedEmail(ticket, user, magicLink),
      (async () => {
        const admins = await prisma.user.findMany({
          where: { role: Role.ADMIN, isActive: true },
        })
        await sendNewTicketNotificationToAdmins(ticket, user, admins)
      })(),
    ]).catch(error => {
      console.error('Error sending emails (non-blocking):', error)
      // Emails failing shouldn't break the ticket creation
    })

    console.log('Anonymous ticket created:', ticket.id, 'by', user.email, `with ${uploadedAttachments.length} attachment(s)`)

    return response
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid input', details: error.issues },
        { status: 400 }
      )
    }
    console.error('Error creating anonymous ticket:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

