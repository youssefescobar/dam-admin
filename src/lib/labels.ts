/** Display names for the backend's status codes and option lists, shared by chips, filters and forms. */

export const QUOTE_STATUS_LABEL: Record<string, string> = {
  new: 'New',
  quoted: 'Quoted',
  won: 'Won',
  lost: 'Lost',
}

export const CONVERSATION_STATUS_LABEL: Record<string, string> = {
  needs_human: 'Needs you',
  mine: 'Mine',
  claimed: 'Claimed',
  ai_handling: 'With Durra AI',
  closed: 'Closed',
}

export const REPORT_STATUS_LABEL: Record<string, string> = {
  new: 'New',
  in_progress: 'In progress',
  resolved: 'Resolved',
}

export const REPORT_TYPE_LABEL: Record<string, string> = {
  complaint: 'Complaint',
  career: 'Job application',
}

export const DEPARTMENTS = [
  { value: 'sales', label: 'Sales' },
  { value: 'hajj', label: 'Hajj' },
  { value: 'corporate', label: 'Corporate' },
  { value: 'operations', label: 'Operations' },
  { value: 'support', label: 'Support' },
] as const

export const CUSTOMER_TYPES = [
  { value: 'group', label: 'Group' },
  { value: 'corporate', label: 'Corporate' },
  { value: 'company', label: 'Company' },
  { value: 'government', label: 'Government' },
  { value: 'school', label: 'School' },
  { value: 'hajj_mission', label: 'Hajj mission' },
  { value: 'tourism', label: 'Tourism' },
] as const
