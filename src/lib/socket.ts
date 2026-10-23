import { getToken } from '@/lib/auth'
import { apiBaseUrl, SESSION_EXPIRED_EVENT } from '@/lib/api'
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
    // The server refuses the handshake once the token expires; sign out instead of retrying forever.
    s.on('connect_error', (err) => {
      if (/expired token/i.test(err.message)) {
        disconnectSocket()
        window.dispatchEvent(new Event(SESSION_EXPIRED_EVENT))
      }
    })
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

/**
 * Emit and wait for the server's ack. While the socket is down socket.io would hold the emit
 * and never call back, so give up after 10 s: the caller shows "not sent" instead of a fake success.
 */
export function emitWithAck<T extends { ok?: boolean; error?: string }>(event: string, payload: unknown): Promise<T> {
  const s = connectAdminSocket()
  if (!s.connected) {
    return Promise.reject(new Error('Not connected to the server. Check your connection and try again.'))
  }
  return s
    .timeout(10_000)
    .emitWithAck(event, payload)
    .then(
      (ack: T) => {
        if (!ack?.ok) throw new Error(ack?.error || 'Something went wrong. Try again.')
        return ack
      },
      () => {
        throw new Error('The server didn’t answer. Try again.')
      }
    )
}

export function disconnectSocket() {
  if (socket) {
    socket.disconnect()
    socket = null
  }
  conversationRooms.clear()
}
