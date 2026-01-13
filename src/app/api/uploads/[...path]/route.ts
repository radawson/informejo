import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { validateMagicToken } from '@/lib/magic-link'
import { readFile } from 'fs/promises'
import path from 'path'
import { existsSync } from 'fs'

const UPLOAD_DIR = process.env.UPLOAD_DIR || './uploads'

/**
 * GET /api/uploads/[...path]
 * Serve uploaded files with authorization
 * Path format: /api/uploads/{ticketId}/{filename}
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  try {
    const { path: pathSegments } = await params

    // Path should be [ticketId, filename]
    if (!pathSegments || pathSegments.length < 2) {
      return NextResponse.json(
        { error: 'Invalid path' },
        { status: 400 }
      )
    }

    const ticketId = pathSegments[0]
    const fileName = pathSegments.slice(1).join('/') // Handle filenames with slashes

    // Find the attachment to verify it exists and get the ticket
    const attachment = await prisma.attachment.findFirst({
      where: {
        ticketId,
        filePath: `/uploads/${ticketId}/${fileName}`,
      },
      include: {
        ticket: {
          include: {
            createdBy: {
              select: {
                id: true,
                magicToken: true,
                magicTokenExp: true,
              },
            },
          },
        },
      },
    })

    if (!attachment) {
      return NextResponse.json(
        { error: 'File not found' },
        { status: 404 }
      )
    }

    // Check authorization
    const session = await getServerSession(authOptions)
    let isAuthorized = false

    if (session?.user) {
      // Authenticated user: check if they're the ticket creator or an admin
      if (
        session.user.role === 'ADMIN' ||
        attachment.ticket.createdById === session.user.id
      ) {
        isAuthorized = true
      }
    } else {
      // Not authenticated: check for magic token
      const token = req.nextUrl.searchParams.get('token')
      if (token) {
        const userId = await validateMagicToken(token)
        if (userId && userId === attachment.ticket.createdById) {
          isAuthorized = true
        }
      }
    }

    if (!isAuthorized) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Build file path
    const filePath = path.join(UPLOAD_DIR, ticketId, fileName)

    // Check if file exists
    if (!existsSync(filePath)) {
      console.error(`File not found on disk: ${filePath}`)
      return NextResponse.json(
        { error: 'File not found on server' },
        { status: 404 }
      )
    }

    // Read file
    const fileBuffer = await readFile(filePath)

    // Determine content type
    const contentType = attachment.mimeType || 'application/octet-stream'

    // Return file with appropriate headers
    return new NextResponse(fileBuffer, {
      headers: {
        'Content-Type': contentType,
        'Content-Disposition': `inline; filename="${attachment.fileName}"`,
        'Content-Length': fileBuffer.length.toString(),
        'Cache-Control': 'private, max-age=3600',
      },
    })
  } catch (error) {
    console.error('Error serving file:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
