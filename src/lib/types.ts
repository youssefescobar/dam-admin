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
  /** Internal notes, never shown to the customer. */
  staffNotes?: string
  quotedAt?: string | null
  /** Set by the backend once the reply-SLA reminder fired. */
  overdueRemindedAt?: string | null
  /** Set by the backend once the follow-up reminder fired. */
  followUpRemindedAt?: string | null
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
  editedAt?: string | null
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
  /** A file the customer sent in a chat form (CV, photo); `text` holds its name. */
  attachment?: { key: string; name?: string; contentType?: string } | null
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
  /** Days after quoting before staff get a follow-up reminder (0 = off). */
  quoteFollowUpDays: number
  complaintSlaHours: number
  botGreetingEn: string
  botGreetingAr: string
  officeHoursEnabled: boolean
  timezone: string
  officeDays: number[]
  officeStart: string
  officeEnd: string
  updatedAt?: string
}

export type ReportStatus = 'new' | 'in_progress' | 'resolved'

/** A file the customer attached in chat (private bucket key). */
export type ReportAttachment = {
  field: string
  key: string
  name: string
  contentType: string
}

/** A complaint or job application logged by Durra AI in the chat. */
export type Report = {
  _id: string
  type: 'complaint' | 'career'
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
  /** Job applications: the role or field applied for. */
  position?: string
  attachments?: ReportAttachment[]
  status: ReportStatus
  slaHours?: number | null
  createdAt?: string
  updatedAt?: string
}

export type UnansweredQuestion = {
  _id: string
  question: string
  language: 'en' | 'ar'
  reason: string
  count: number
  lastAskedAt: string
  conversationId?: string | null
  status: 'open' | 'resolved' | 'dismissed'
}

export type ChatAnalytics = {
  conversations: number
  handoverRate: number
  missRate: number
  misses: number
  handovers: Record<string, number>
  topics: Record<string, number>
}

export type ContentKind = 'news' | 'testimonial'

/** One language of a website content item; which fields matter depends on the kind. */
export type ContentText = {
  title?: string
  excerpt?: string
  body?: string
  quote?: string
  name?: string
  role?: string
}

export type SiteContentItem = {
  _id: string
  kind: ContentKind
  published: boolean
  slug?: string
  image?: string
  /** News only: images/videos in order; the first is the cover. */
  media?: string[]
  publishedAt?: string | null
  sortOrder?: number
  en: ContentText
  ar: ContentText
  createdAt?: string
  updatedAt?: string
}
