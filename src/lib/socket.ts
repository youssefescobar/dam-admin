import { io, type Socket } from 'socket.io-client'
import { apiBaseUrl } from '@/lib/api'

let socket: Socket | null = null

export function getSocket(): Socket {
  if (!socket) {
    socket = io(apiBaseUrl(), {
      transports: ['websocket'],
      autoConnect: false,
    })
  }
  return socket
}

export function connectAdminSocket() {
  const s = getSocket()
  if (!s.connected) s.connect()
  s.emit('join:admin-queue')
  return s
}

export function disconnectSocket() {
  if (socket) {
    socket.disconnect()
    socket = null
  }
}
