import { expect, test, type Page } from '@playwright/test'

const API = process.env.VITE_API_BASE_URL || 'http://127.0.0.1:3000'
const EMAIL = process.env.E2E_ADMIN_EMAIL || ''
const PASSWORD = process.env.E2E_ADMIN_PASSWORD || ''

test.skip(!EMAIL || !PASSWORD, 'Set E2E_ADMIN_EMAIL and E2E_ADMIN_PASSWORD (see e2e/README.md)')

async function login(page: Page) {
  await page.goto('/login')
  await page.getByLabel('Email').fill(EMAIL)
  await page.getByLabel('Password').fill(PASSWORD)
  await page.getByRole('button', { name: 'Sign in' }).click()
  await expect(page.getByRole('heading', { name: 'Quotes' })).toBeVisible()
}

/** A customer asks for a person through the public chat, so the inbox has a waiting chat. */
async function customerAsksForHuman(name: string) {
  const phone = `+9665${String(Date.now()).slice(-8)}`
  const session = await fetch(`${API}/chat/session`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, phone, lang: 'en' }),
  }).then((r) => r.json())
  const res = await fetch(`${API}/chat/message`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ conversationId: session.conversationId, customerPhone: phone, choiceId: 'human', lang: 'en' }),
  })
  expect(res.ok).toBe(true)
  return session.conversationId as string
}

test('quotes, inbox claim and reply, settings', async ({ page }) => {
  const name = `E2E ${Date.now()}`
  const conversationId = await customerAsksForHuman(name)
  await login(page)

  await page.goto(`/inbox?c=${conversationId}`)
  await page.getByRole('button', { name: 'Claim chat' }).click()
  await expect(page.getByText('You’re on this chat')).toBeVisible()
  await page.getByLabel('Reply').fill('Hello from the smoke test')
  await page.getByRole('button', { name: 'Send' }).click()
  await expect(page.getByLabel('Reply')).toHaveValue('')
  await expect(page.getByText('Hello from the smoke test')).toBeVisible()

  await page.goto('/settings')
  await expect(page.getByRole('heading', { name: 'Company settings' })).toBeVisible()
  await page.getByRole('button', { name: /save/i }).first().click()
  await expect(page.getByText('Settings saved')).toBeVisible()
})

test('settings that fail to load show an error, never an empty form', async ({ page }) => {
  await login(page)
  await page.route(`${API}/settings`, (route) =>
    route.fulfill({ status: 500, contentType: 'application/json', body: '{"error":"boom"}' })
  )
  await page.goto('/settings')
  await expect(page.getByText('Couldn’t load this')).toBeVisible()
  await expect(page.getByRole('button', { name: /save/i })).toHaveCount(0)
})

test('an expired login goes back to the login page', async ({ page }) => {
  await login(page)
  await page.evaluate(() => localStorage.setItem('damic_admin_token', 'expired.bad.token'))
  await page.goto('/quotes')
  await expect(page).toHaveURL(/\/login$/)
})

test('a quote can be deleted after confirming', async ({ page }) => {
  const name = `E2E delete ${Date.now()}`
  const res = await fetch(`${API}/quotes`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      customerName: name,
      customerContact: `+9665${String(Date.now()).slice(-8)}`,
      pickup: 'Makkah',
      dropoff: 'Madinah',
      date: '2026-12-01',
      passengers: 2,
    }),
  })
  expect(res.ok).toBe(true)
  await login(page)

  const row = page.getByRole('row').filter({ hasText: name })
  await row.getByRole('button', { name: 'Actions' }).click()
  await page.getByRole('menuitem', { name: 'Delete' }).click()
  await page.getByRole('button', { name: 'Cancel' }).click()
  await expect(row).toBeVisible()

  await row.getByRole('button', { name: 'Actions' }).click()
  await page.getByRole('menuitem', { name: 'Delete' }).click()
  await page.getByRole('button', { name: 'Delete quote' }).click()
  await expect(page.getByText('Quote deleted')).toBeVisible()
  await expect(row).toHaveCount(0)
})
