import { useEffect, useRef, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Navigate } from 'react-router'
import { useAuth } from '../lib/session'
import { api } from '../lib/api'
import { canExportDocuments, reportExportPath, reportPath } from '../lib/reports'
import type { InventoryReport, OperationalReport, ReportMode, ReportFormat } from '../lib/reports'
import ReportFilters from '../components/ReportFilters'
import { BookingReportResults, InventoryReportResults } from '../components/ReportResults'
import { Button, ErrorState, Loading, PageHeading } from '../components/ui'

const reportNames: Record<ReportMode, string> = { facility: 'Facility bookings', asset: 'Asset bookings', inventory: 'Asset inventory' }
export default function Reports() {
  const { user } = useAuth()
  const allowed: ReportMode[] = []
  if (user?.permissions.includes('report.facility.view')) allowed.push('facility')
  if (user?.permissions.includes('report.asset.view')) allowed.push('asset', 'inventory')
  const [selected, setSelected] = useState<ReportMode>('facility')
  const mode = allowed.includes(selected) ? selected : allowed[0]
  if (!mode) return <Navigate to="/" replace />
  return <ReportPanel key={mode} mode={mode} allowed={allowed} onMode={setSelected} />
}

function ReportPanel({ mode, allowed, onMode }: { mode: ReportMode; allowed: ReportMode[]; onMode: (mode: ReportMode) => void }) {
  const { user } = useAuth()
  const documents = canExportDocuments(user?.role_name)
  const [selectedFormat, setFormat] = useState<ReportFormat>('csv')
  const format = documents ? selectedFormat : 'csv'
  const formatName = { csv: 'CSV', xlsx: 'Excel', pdf: 'PDF' }[format]
  const [page, setPage] = useState(1)
  const [filters, setFilters] = useState('')
  const [exporting, setExporting] = useState(false)
  const [feedback, setFeedback] = useState('')
  const [exportError, setExportError] = useState('')
  const download = useRef<AbortController | null>(null)
  useEffect(() => () => download.current?.abort(), [])
  const query = useQuery({ queryKey: ['reports', mode, filters, page], queryFn: ({ signal }) => api.request<OperationalReport | InventoryReport>(reportPath(mode, filters, page), { signal }) })
  async function exportReport() {
    if (download.current) return
    const controller = new AbortController()
    download.current = controller; setExporting(true); setFeedback(''); setExportError('')
    try {
      const blob = await api.download(reportExportPath(mode, filters, mode === 'inventory' ? undefined : query.data as OperationalReport, format), controller.signal, format)
      if (controller.signal.aborted) return
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url; link.download = mode === 'inventory' ? `asset-inventory.${format}` : `${mode}-bookings.${format}`
      document.body.append(link); link.click(); link.remove()
      window.setTimeout(() => URL.revokeObjectURL(url), 1000)
      setFeedback(`${formatName} download started using the applied filters.`)
    } catch (failure) {
      if (!controller.signal.aborted) setExportError(failure instanceof Error ? failure.message : 'Could not download this report.')
    } finally {
      download.current = null
      if (!controller.signal.aborted) setExporting(false)
    }
  }
  return <>
    <PageHeading eyebrow="Operational insights" title="Reports & exports">Review booking activity and inventory, then download the filtered results.</PageHeading>
    <div className="section-toolbar report-toolbar"><div className="field inline-field"><label htmlFor="report-kind">Report</label><select id="report-kind" value={mode} disabled={exporting} onChange={event => onMode(event.target.value as ReportMode)}>{allowed.map(value => <option key={value} value={value}>{reportNames[value]}</option>)}</select></div><div className="action-buttons">{documents && <div className="field inline-field"><label htmlFor="export-format">File format</label><select id="export-format" value={format} disabled={exporting} onChange={event => setFormat(event.target.value as ReportFormat)}><option value="csv">CSV</option><option value="xlsx">Excel (.xlsx)</option><option value="pdf">PDF</option></select></div>}<Button variant="secondary" disabled={query.isFetching || exporting} onClick={() => void query.refetch()}>Refresh</Button><Button disabled={exporting || query.isPending || !!query.error} onClick={() => void exportReport()}>{exporting ? `Preparing ${formatName}…` : `Download ${formatName}`}</Button></div></div>
    <ReportFilters mode={mode} disabled={exporting} onApply={params => { setFilters(params); setPage(1); setFeedback(''); setExportError('') }} />
    <p className="refresh-caption">Tables and downloads use the applied filters. CSV{documents ? ' and Excel include' : ' includes'} up to 10,000 resource rows.{documents && ' PDF includes up to 500 rows; Excel and PDF are restricted to system administrators.'} Reports refresh every 30 seconds while visible.</p>
    {feedback && <p className="notice" role="status">{feedback}</p>}{exportError && <p className="notice notice-error" role="alert">{exportError}</p>}
    {query.isPending ? <Loading label="Loading report…" /> : query.error ? <ErrorState error={query.error} retry={() => void query.refetch()} /> : query.data && (mode === 'inventory' ? <InventoryReportResults report={query.data as InventoryReport} /> : <BookingReportResults report={query.data as OperationalReport} />)}
    <div className="pagination"><Button variant="secondary" disabled={page === 1 || query.isFetching || exporting} onClick={() => setPage(page - 1)}>Previous</Button><span>Page {page}</span><Button variant="secondary" disabled={!query.data?.pagination.has_more || query.isFetching || exporting} onClick={() => setPage(page + 1)}>Next</Button></div>
  </>
}
