export type Quote = {
  _id: string
  customerName: string
  customerContact: string
  pickup: string
  dropoff: string
  date: string
  vehicleType: string
  passengers: number
  notes?: string
  status: 'new' | 'quoted' | 'won' | 'lost'
  quotedPrice: number | null
  conversationId?: string
  createdAt?: string
}

export type Conversation = {
  _id: string
  customerId: string
  status: 'ai_handling' | 'needs_human' | 'claimed' | 'closed'
  assignedAdminId?: string | null
  lastActivityAt?: string
  lastCustomerMessageAt?: string | null
  lastAdminMessageAt?: string | null
  hasUnreadCustomerReply?: boolean
  updatedAt?: string
  createdAt?: string
  customer?: {
    id: string
    name: string
    contact: string
    email?: string | null
    phone?: string | null
  } | null
}

export type ChatMessage = {
  _id: string
  conversationId: string
  sender: 'customer' | 'ai' | 'admin' | 'system'
  text: string
  createdAt: string
}

export type KbEntry = {
  _id: string
  title: string
  content: string
  createdAt?: string
  updatedAt?: string
}
