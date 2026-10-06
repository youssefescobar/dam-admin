export type QuoteLeg = {
  from: string
  to: string
  date?: string
  time?: string
}

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
  language?: string
  customerType?: string
  organization?: string
  email?: string
  serviceType?: string
  originCity?: string
  destinationCity?: string
  returnDatetime?: string | null
  tripType?: string
  busCount?: number | null
  busClass?: string
  luggageNotes?: string
  accessibilityNeeds?: string
  specialRequirements?: string
  stops?: string
  legs?: QuoteLeg[]
  departureTime?: string
  waitingHours?: number | null
  needsSupervisors?: boolean
  needsTracking?: boolean
  needsBranding?: boolean
  needsAirportReception?: boolean
  leadId?: string
  preferredContactChannel?: string
  consent?: boolean
  priority?: 'normal' | 'high' | 'urgent'
  assignedDepartment?: string
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
  sourceId?: string | null
  intent?: string
  category?: string
  locale?: 'en' | 'ar' | ''
  escalate?: boolean
  requiresLiveData?: boolean
  createdAt?: string
  updatedAt?: string
}

export type CompanySettings = {
  _id?: string
  legalNameAr: string
  legalNameEn: string
  email: string
  phones: string[]
  whatsappNumber: string
  addressAr: string
  addressEn: string
  workingHoursAr: string
  workingHoursEn: string
  fleetSizeNote: string
  baggagePolicy: string
  cancellationPolicy: string
  childFareNote: string
  quoteSlaHours: number
  complaintSlaHours: number
  botGreetingEn: string
  botGreetingAr: string
  botClosingEn: string
  botClosingAr: string
  updatedAt?: string
}

export type ReportStatus = 'new' | 'in_progress' | 'resolved'

/** A complaint or lost-item report logged by Durri in the chat. */
export type Report = {
  _id: string
  type: 'complaint' | 'lost_found'
  refNumber: string
  customerId?: string
  conversationId?: string | null
  name?: string
  phone?: string
  tripNumber?: string
  incidentDate?: string
  incidentTime?: string
  seat?: string
  description?: string
  status: ReportStatus
  slaHours?: number | null
  createdAt?: string
  updatedAt?: string
}
