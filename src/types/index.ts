import { Role, TicketStatus, TicketPriority, TicketCategory } from '@/generated/prisma/client'

export type { Role, TicketStatus, TicketPriority, TicketCategory }

export interface User {
  id: string
  email: string
  name: string
  role: Role
  department?: string | null
  isKeycloakUser: boolean
  createdAt: Date
  updatedAt: Date
}

export interface Ticket {
  id: string
  title: string
  description: string
  status: TicketStatus
  priority: TicketPriority
  category: TicketCategory
  createdById: string
  assignedToId?: string | null
  createdAt: Date
  updatedAt: Date
  resolvedAt?: Date | null
  createdBy?: User
  assignedTo?: User | null
  comments?: Comment[]
  attachments?: Attachment[]
  _count?: {
    comments: number
    attachments: number
  }
}

export interface Comment {
  id: string
  content: string
  isInternal: boolean
  ticketId: string
  userId: string
  createdAt: Date
  user?: User
}

export interface Attachment {
  id: string
  fileName: string
  filePath: string
  fileSize: number
  mimeType: string
  ticketId: string
  uploadedById: string
  createdAt: Date
  uploadedBy?: User
}

export interface TicketWithDetails extends Ticket {
  createdBy: User
  assignedTo: User | null
  comments: (Comment & { user: User })[]
  attachments: (Attachment & { uploadedBy: User })[]
  _count: {
    comments: number
    attachments: number
  }
}

export interface DashboardStats {
  totalTickets: number
  openTickets: number
  inProgressTickets: number
  waitingTickets: number
  resolvedTickets: number // Individual count for display
  closedTickets: number // Individual count for display
  closedTicketsTotal: number // Combined count for accounting (RESOLVED + CLOSED)
  criticalTickets: number
  highPriorityTickets: number
  unassignedTickets?: number
  myAssignedTickets?: number
  avgResolutionTime?: number
  avgResolutionTimeByCategory?: Partial<Record<TicketCategory, number>>
  avgResolutionTimeByPriority?: Partial<Record<TicketPriority, number>>
  priorityBreakdown?: {
    myTickets: {
      LOW?: number
      MEDIUM?: number
      HIGH?: number
      CRITICAL?: number
    }
    open?: {
      LOW?: number
      MEDIUM?: number
      HIGH?: number
      CRITICAL?: number
    }
    inProgress?: {
      LOW?: number
      MEDIUM?: number
      HIGH?: number
      CRITICAL?: number
    }
    closed?: {
      LOW?: number
      MEDIUM?: number
      HIGH?: number
      CRITICAL?: number
    }
    all?: {
      LOW?: number
      MEDIUM?: number
      HIGH?: number
      CRITICAL?: number
    }
    unassigned?: {
      LOW?: number
      MEDIUM?: number
      HIGH?: number
      CRITICAL?: number
    }
    myAssigned?: {
      LOW?: number
      MEDIUM?: number
      HIGH?: number
      CRITICAL?: number
    }
  }
}

