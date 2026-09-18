import { getToken } from '@/lib/auth'
import { apiBaseUrl } from '@/lib/api'
import { io, type Socket } from 'socket.io-client'

let socket: Socket | null = null

export function getSocket(): Socket {
  if (!socket) {
    socket = io(apiBaseUrl(), {
      transports: ['websocket'],
      autoConnect: false,
      auth: (cb) => {
        cb({ token: getToken() || '' })
      },
    })
  }
  return socket
}

export function connectAdminSocket() {
  const s = getSocket()
  if (!s.connected) s.connect()
  s.emit('join:admin-queue', {})
  return s
}

export function disconnectSocket() {
  if (socket) {
    socket.disconnect()
    socket = null
  }
}
