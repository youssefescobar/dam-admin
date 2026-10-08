import { getToken } from '@/lib/auth'
import { apiBaseUrl } from '@/lib/api'
import { io, type Socket } from 'socket.io-client'

let socket: Socket | null = null
// Rooms are lost on every disconnect, so remember them and rejoin on each (re)connect.
const conversationRooms = new Set<string>()

export function getSocket(): Socket {
  if (!socket) {
    socket = io(apiBaseUrl(), {
      // Polling first so a proxy without websocket upgrade still works.
      transports: ['polling', 'websocket'],
      autoConnect: false,
      reconnectionAttempts: Infinity,
      reconnectionDelayMax: 5000,
      auth: (cb) => {
        cb({ token: getToken() || '' })
      },
    })
    const s = socket
    s.on('connect', () => {
      s.emit('join:admin-queue', {})
      for (const conversationId of conversationRooms) s.emit('join:conversation', { conversationId })
    })
  }
  return socket
}

export function connectAdminSocket() {
  const s = getSocket()
  if (!s.connected) s.connect()
  return s
}

export function joinAdminConversation(conversationId: string) {
  conversationRooms.add(conversationId)
  const s = connectAdminSocket()
  if (s.connected) s.emit('join:conversation', { conversationId })
}

export function disconnectSocket() {
  if (socket) {
    socket.disconnect()
    socket = null
  }
  conversationRooms.clear()
}
