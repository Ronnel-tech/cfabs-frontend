import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createApi, ApiError } from '../src/lib/api.ts'
import { canExportDocuments, reportExportPath } from '../src/lib/reports.ts'

test('document controls are limited to the actual system administrator role', () => {
  assert.equal(canExportDocuments('system_admin'), true)
  for (const role of ['booking_admin', 'asset_custodian', 'faculty_employee', 'admin', null, undefined]) assert.equal(canExportDocuments(role), false)
})
test('Excel and PDF reuse filters, pin the displayed period and omit pagination', () => {
  for (const format of ['xlsx', 'pdf'] as const) {
    const path = reportExportPath('asset', 'resource_id=9&page=2&per_page=20', { start_utc: '2026-11-01 00:00:00', end_utc: '2026-11-02 00:00:00' }, format)
    const query = new URLSearchParams(path.split('?')[1])
    assert.equal(query.get('format'), format)
    assert.equal(query.get('resource_id'), '9')
    assert.equal(query.get('start'), '2026-11-01T00:00:00Z')
    assert.equal(query.has('page'), false)
    assert.equal(query.has('per_page'), false)
    assert.match(reportExportPath('inventory', 'tracking_mode=individual', undefined, format), new RegExp(`tracking_mode=individual&format=${format}`))
  }
})
test('binary downloads use matching MIME types and existing bearer authentication', async () => {
  for (const [format, mime, content] of [
    ['xlsx', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'PK\u0003\u0004'],
    ['pdf', 'application/pdf', '%PDF-1.7'],
  ] as const) {
    const client = createApi(async (path, init) => {
      assert.equal(new Headers(init?.headers).get('Accept'), mime)
      assert.equal(new Headers(init?.headers).get('Authorization'), 'Bearer private-token')
      assert.ok(!String(path).includes('private-token'))
      return new Response(content, { headers: { 'Content-Type': mime } })
    })
    client.setTokens({ access_token: 'private-token', refresh_token: 'refresh-token' })
    assert.equal(await (await client.download(`/reports/inventory?format=${format}`, undefined, format)).text(), content)
  }
})
test('document downloads reject mismatched files and preserve authorization failures', async () => {
  const client = createApi(async () => new Response('<html>error</html>', { headers: { 'Content-Type': 'text/html' } }))
  await assert.rejects(client.download('/reports/assets?format=pdf', undefined, 'pdf'), error => error instanceof ApiError && error.status === 502)
  const forbidden = createApi(async () => Response.json({ error: 'Only system administrators may export Excel or PDF reports.' }, { status: 403 }))
  await assert.rejects(forbidden.download('/reports/assets?format=xlsx', undefined, 'xlsx'), error => error instanceof ApiError && error.status === 403)
})
test('documents retain session-change protection and share native refresh rotation', async () => {
  let release!: (value: Response) => void
  const client = createApi(() => new Promise<Response>(resolve => { release = resolve }))
  client.setTokens({ access_token: 'before', refresh_token: 'refresh' })
  const pending = client.download('/reports/inventory?format=pdf', undefined, 'pdf')
  client.setTokens(null)
  release(new Response('%PDF-1.7', { headers: { 'Content-Type': 'application/pdf' } }))
  await assert.rejects(pending, error => error instanceof ApiError && error.status === 401)
  let refreshes = 0
  const rotating = createApi(async (path, init) => {
    if (path === '/api/auth/refresh') { refreshes++; return Response.json({ success: true, data: { access_token: 'new', refresh_token: 'rotated' } }) }
    if (new Headers(init?.headers).get('Authorization') === 'Bearer old') return Response.json({ error: 'Expired' }, { status: 401 })
    return new Response('%PDF-1.7', { headers: { 'Content-Type': 'application/pdf' } })
  })
  rotating.setTokens({ access_token: 'old', refresh_token: 'refresh' })
  await Promise.all([rotating.download('/reports/assets?format=pdf', undefined, 'pdf'), rotating.download('/reports/facilities?format=pdf', undefined, 'pdf')])
  assert.equal(refreshes, 1)
})
