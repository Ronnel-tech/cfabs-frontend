import { test } from 'node:test'
import assert from 'node:assert/strict'
import { emptyReportFilters, reportExportPath, reportParams, reportPath } from '../src/lib/reports.ts'
import { createApi, ApiError } from '../src/lib/api.ts'

test('report periods preserve campus offsets and require both valid boundaries', () => {
  const values = { ...emptyReportFilters(), start: '2026-11-01T00:00', end: '2026-12-01T00:00' }
  const params = new URLSearchParams(reportParams('facility', values))
  assert.equal(params.get('start'), '2026-11-01T00:00:00+08:00')
  assert.equal(params.get('end'), '2026-12-01T00:00:00+08:00')
  assert.equal(reportParams('facility', emptyReportFilters()), '')
  for (const change of [{ end: '' }, { start: '' }, { end: '2026-11-01T00:00' }, { end: '2026-02-30T00:00' }]) assert.throws(() => reportParams('facility', { ...values, ...change }))
})
test('report IDs, status and tracking filters follow their actual report scope', () => {
  const values = { ...emptyReportFilters(), resource_id: '7', department_id: '2', category_id: '3', requester_id: '4', status: 'RELEASED' }
  assert.equal(new URLSearchParams(reportParams('asset', values)).get('requester_id'), '4')
  assert.throws(() => reportParams('facility', values))
  const inventory = new URLSearchParams(reportParams('inventory', { ...values, status: 'active', tracking_mode: 'individual', start: 'invalid', end: 'invalid' }))
  assert.equal(inventory.has('start'), false)
  assert.equal(inventory.has('requester_id'), false)
  assert.equal(inventory.get('tracking_mode'), 'individual')
  for (const resource_id of ['0', '-1', '1.5', '1&status=active', '9007199254740992']) assert.throws(() => reportParams('asset', { ...values, resource_id }))
})
test('CSV and paginated JSON share filters while CSV omits pagination', () => {
  const filters = reportParams('asset', { ...emptyReportFilters(), department_id: '2', status: 'RELEASED' })
  const json = new URL(reportPath('asset', filters, 3), 'http://test.invalid')
  const csv = new URL(reportPath('asset', filters), 'http://test.invalid')
  assert.equal(json.searchParams.get('page'), '3')
  assert.equal(json.searchParams.get('per_page'), '20')
  assert.equal(csv.searchParams.has('page'), false)
  assert.equal(csv.searchParams.has('per_page'), false)
  assert.equal(csv.searchParams.get('status'), json.searchParams.get('status'))
  assert.equal(csv.searchParams.get('format'), 'csv')
})
const old = { access_token: 'old', refresh_token: 'refresh-old' }
test('operational CSV pins the displayed server period, including the rolling default', () => {
  const url = new URL(reportExportPath('facility', 'department_id=2', { start_utc: '2026-10-08 04:00:00', end_utc: '2026-11-07 04:00:00' }), 'http://test.invalid')
  assert.equal(url.searchParams.get('start'), '2026-10-08T04:00:00Z')
  assert.equal(url.searchParams.get('end'), '2026-11-07T04:00:00Z')
  assert.equal(url.searchParams.get('department_id'), '2')
  assert.equal(url.searchParams.has('page'), false)
  assert.throws(() => reportExportPath('asset', ''))
  assert.equal(reportExportPath('inventory', ''), '/reports/inventory?format=csv')
})
const rotated = { access_token: 'new', refresh_token: 'refresh-new' }
const csv = () => new Response('resource_id,resource_name\r\n1,Hall\r\n', { headers: { 'Content-Type': 'text/csv; charset=utf-8' } })
test('CSV downloads use bearer headers and preserve file contents without token URLs', async () => {
  const client = createApi(async (path, init) => {
    assert.equal(path, '/api/reports/facilities?format=csv')
    assert.equal(new Headers(init?.headers).get('Authorization'), 'Bearer old')
    assert.equal(new Headers(init?.headers).get('Accept'), 'text/csv')
    assert.equal(init?.cache, 'no-store')
    return csv()
  })
  client.setTokens(old)
  assert.equal(await (await client.download('/reports/facilities?format=csv')).text(), 'resource_id,resource_name\r\n1,Hall\r\n')
})
test('concurrent JSON and CSV failures share the existing refresh rotation', async () => {
  let refreshes = 0
  const client = createApi(async (path, init) => {
    if (path === '/api/auth/refresh') { refreshes++; return Response.json({ success: true, data: rotated }) }
    if (new Headers(init?.headers).get('Authorization') === 'Bearer old') return Response.json({ error: 'Unauthorized' }, { status: 401 })
    return String(path).includes('format=csv') ? csv() : Response.json({ success: true, data: { ok: true } })
  })
  client.setTokens(old)
  const [file, result] = await Promise.all([client.download('/reports/assets?format=csv'), client.request('/auth/me')])
  assert.equal((await file.text()).includes('Hall'), true)
  assert.deepEqual(result, { ok: true })
  assert.equal(refreshes, 1)
})
test('CSV rejects HTML and surfaces safe JSON errors for authorization and export limits', async () => {
  const bad = createApi(async () => new Response('<html>server page</html>', { headers: { 'Content-Type': 'text/html' } }))
  await assert.rejects(bad.download('/reports/assets?format=csv'), error => error instanceof ApiError && error.status === 502)
  for (const status of [403, 422]) {
    const client = createApi(async () => Response.json({ error: status === 403 ? 'Forbidden' : 'Narrow your filters' }, { status }))
    await assert.rejects(client.download('/reports/assets?format=csv'), error => error instanceof ApiError && error.status === status)
  }
})
test('downloads cannot finish under a changed account and preserve abort handling', async () => {
  let release!: (response: Response) => void
  const client = createApi(() => new Promise<Response>(done => { release = done }))
  client.setTokens(old)
  const pending = client.download('/reports/assets?format=csv')
  client.setTokens(rotated); release(csv())
  await assert.rejects(pending, error => error instanceof ApiError && error.status === 401)
  const aborted = createApi(async () => { throw new DOMException('Aborted', 'AbortError') })
  await assert.rejects(aborted.download('/reports/assets?format=csv'), error => error instanceof Error && error.name === 'AbortError')
})
