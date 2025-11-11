import { Server as SocketIOServer } from 'socket.io'
import { NextRequest } from 'next/server'

export async function GET(req: NextRequest) {
  if ((global as any).io) {
    console.log('Socket.io server already running')
    return new Response('Socket server is running', { status: 200 })
  }

  const io = new SocketIOServer({
    cors: {
      origin: process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',
      methods: ['GET', 'POST'],
    },
  })

  io.on('connection', (socket) => {
    console.log('Client connected:', socket.id)

    socket.on('join-ticket', (ticketId: string) => {
      socket.join(`ticket:${ticketId}`)
      console.log(`Socket ${socket.id} joined ticket:${ticketId}`)
    })

    socket.on('leave-ticket', (ticketId: string) => {
      socket.leave(`ticket:${ticketId}`)
      console.log(`Socket ${socket.id} left ticket:${ticketId}`)
    })

    socket.on('disconnect', () => {
      console.log('Client disconnected:', socket.id)
    })
  })

  ;(global as any).io = io

  return new Response('Socket server initialized', { status: 200 })
}

