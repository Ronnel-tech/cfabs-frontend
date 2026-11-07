import { useCallback, useMemo, useRef, useState } from 'react';
import { Link, Navigate } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import FullCalendar from '@fullcalendar/react';
import type { CalendarRef, DatesSetInfo, DateSelectInfo, DateClickInfo, EventClickInfo, EventDisplayInfo } from '@fullcalendar/react';
import dayGrid from '@fullcalendar/react/daygrid';
import timeGrid from '@fullcalendar/react/timegrid';
import list from '@fullcalendar/react/list';
import interaction from '@fullcalendar/react/interaction';
import classic from '@fullcalendar/react/themes/classic';
import '@fullcalendar/react/skeleton.css';
import '@fullcalendar/react/themes/classic/theme.css';
import '@fullcalendar/react/themes/classic/palette.css';
import '../calendar.css';
import { api } from '../lib/api';
import { useAuth } from '../lib/session';
import { canRequest } from '../lib/booking-access';
import { addDays, campusToday, rangeError } from '../lib/availability';
import type { ResourceKind } from '../lib/availability';
import { calendarCategories, calendarPath, calendarRange, calendarResourceLink, calendarSelection, emptyCalendarFilters } from '../lib/calendar';
import type { CalendarCategory, CalendarFeed, CalendarFilters, CalendarRecord } from '../lib/calendar';
import type { CatalogRecord } from '../lib/catalog';
import { catalogName } from '../lib/catalog';
import { statusLabel } from '../lib/bookings';
import { Button, ErrorState, PageHeading } from '../components/ui';
import CalendarEventDetails from '../components/CalendarEventDetails';

const plugins = [classic, dayGrid, timeGrid, list, interaction];
const toolbar = { start: 'prev,next today', center: 'title', end: 'dayGridMonth,timeGridWeek,timeGridDay,listWeek' };
const rangeToolbar = { ...toolbar, start: '' };
const buttons = { today: { text: 'Today' }, dayGridMonth: { text: 'Month' }, timeGridWeek: { text: 'Week' }, timeGridDay: { text: 'Day' }, listWeek: { text: 'Agenda' } };
const eventTimeFormat = { hour: 'numeric', minute: '2-digit', meridiem: 'short' } as const;
const categories = Object.entries(calendarCategories) as [CalendarCategory, string][];
function eventClasses(info: EventDisplayInfo) {
  const record = info.event.extendedProps.record as CalendarRecord;
  return `calendar-${record.type} calendar-status-${record.status.toLowerCase()}`;
}
function renderEvent(info: EventDisplayInfo) {
  const record = info.event.extendedProps.record as CalendarRecord;
  return <span className="calendar-event-text"><strong>{info.timeText} {record.resource_name}</strong><span>{calendarCategories[record.type]} · {statusLabel(record.status)}{record.open_ended ? ' · ongoing' : ''}</span></span>;
}
async function catalog(path: string, signal: AbortSignal): Promise<CatalogRecord[]> {
  const rows: CatalogRecord[] = [];
  for (let page = 1; ; page++) {
    const batch = await api.request<CatalogRecord[]>(`/${path}?per_page=100&page=${page}`, { signal });
    rows.push(...batch);
    if (batch.length < 100) return rows;
  }
}

export default function CalendarPage() {
  const { user } = useAuth();
  const facility = !!user?.permissions.includes('facility.view');
  const asset = !!user?.permissions.includes('asset.view');
  const calendar = useRef<CalendarRef>(null);
  const checkHeading = useRef<HTMLHeadingElement>(null);
  const [filters, setFilters] = useState<CalendarFilters>({ ...emptyCalendarFilters });
  const [range, setRange] = useState<{ start: string; end: string; view: string } | null>(null);
  const [goDate, setGoDate] = useState(campusToday);
  const [initialView] = useState(() => window.matchMedia('(max-width: 760px)').matches ? 'listWeek' : 'dayGridMonth');
  const [customRange, setCustomRange] = useState(() => ({ from: campusToday(), through: addDays(campusToday(), 29) }));
  const [customWindow, setCustomWindow] = useState<{ start: string; end: string } | null>(null);
  const [customError, setCustomError] = useState('');
  const views = useMemo(() => ({ listRange: { type: 'list', visibleRange: customWindow ?? undefined, headerToolbar: rangeToolbar } }), [customWindow]);
  const [period, setPeriod] = useState(() => ({ start: `${addDays(campusToday(), 1)}T09:00`, end: `${addDays(campusToday(), 1)}T10:00` }));
  const [resource, setResource] = useState('');
  const [selected, setSelected] = useState('');
  const departmentAllowed = ['facility_booking', 'asset_booking'].includes(filters.type)
    && !!user?.permissions.includes(`${filters.type}.view_all`);
  const options = useQuery({
    queryKey: ['calendar-options', facility, asset], enabled: facility || asset,
    queryFn: async ({ signal }) => {
      const [facilities, assets, facilityCategories, assetCategories] = await Promise.all([
        facility ? catalog('facilities', signal) : [], asset ? catalog('assets', signal) : [],
        facility ? catalog('facility-categories', signal) : [], asset ? catalog('asset-categories', signal) : [],
      ]);
      return { facilities, assets, facilityCategories, assetCategories };
    },
    refetchInterval: false,
  });
  const departments = useQuery({ queryKey: ['calendar-departments'], enabled: departmentAllowed, queryFn: ({ signal }) => catalog('departments', signal), refetchInterval: false });
  const query = useQuery({
    queryKey: ['calendar-events', range?.start, range?.end, filters], enabled: (facility || asset) && !!range,
    queryFn: ({ signal }) => api.request<CalendarFeed>(calendarPath(range!.start, range!.end, filters), { signal }),
    staleTime: 0,
  });
  const events = useMemo(() => query.error ? [] : (query.data?.events ?? []).map((record) => ({
    id: record.id, title: `${calendarCategories[record.type]} · ${record.resource_name} · ${statusLabel(record.status)}`,
    start: record.start, end: record.end,
    extendedProps: { record },
  })), [query.data, query.error]);
  const onDates = useCallback((info: DatesSetInfo) => {
    const start = info.start.toISOString(), end = info.end.toISOString();
    const view = info.view.type;
    setRange((before) => before?.start === start && before.end === end && before.view === view ? before : { start, end, view });
  }, []);
  const onSelect = useCallback((info: DateSelectInfo) => {
    setPeriod(calendarSelection(info.startStr, info.endStr, info.allDay));
    checkHeading.current?.focus();
  }, []);
  const onDateClick = useCallback((info: DateClickInfo) => {
    const end = new Date(info.date.getTime() + 3600000).toISOString();
    setPeriod(calendarSelection(info.dateStr, end, info.allDay));
    checkHeading.current?.focus();
  }, []);
  const onEvent = useCallback((info: EventClickInfo) => { setSelected(info.event.id); }, []);
  const selectedEvent = !query.error ? query.data?.events.find((event) => event.id === selected) : undefined;
  if (!facility && !asset) return <Navigate to="/" replace />;

  function change(key: keyof CalendarFilters, value: string) {
    setSelected('');
    if ((key === 'facility_id' || key === 'asset_id') && value) setResource(`${key === 'facility_id' ? 'facility' : 'asset'}:${value}`);
    setFilters((before) => {
      const next = { ...before, [key]: value };
      if (key === 'type') {
        next.department_id = '';
        if (value.endsWith('_maintenance')) next.status = '';
        if (value.startsWith('facility')) { next.asset_id = ''; next.asset_category_id = ''; }
        if (value.startsWith('asset')) { next.facility_id = ''; next.facility_category_id = ''; }
      }
      return next;
    });
  }
  function filter(key: keyof CalendarFilters, label: string, rows: { value: string; label: string }[], disabled = false) {
    return <div className="field"><label htmlFor={`calendar-${key}`}>{label}</label><select id={`calendar-${key}`} value={filters[key]} disabled={disabled} onChange={(event) => change(key, event.target.value)}><option value="">All</option>{rows.map((row) => <option key={row.value} value={row.value}>{row.label}</option>)}</select></div>;
  }
  const records = (rows: CatalogRecord[] = []) => rows.map((row) => ({ value: String(row.id), label: catalogName(row) }));
  const [kind, resourceId] = resource.split(':') as [ResourceKind, string];
  const periodError = resource ? rangeError(kind, period.start, period.end) : '';
  return <>
    <PageHeading eyebrow="Plan your campus time" title="Booking calendar">Facility and asset bookings, with maintenance schedules. All times are Philippine Standard Time (UTC+8).</PageHeading>
    <section className="calendar-filters" aria-label="Calendar filters">
      <div className="calendar-filter-grid">
        {filter('type', 'Event category', categories.filter(([type]) => type.startsWith('facility') ? facility : asset).map(([value, label]) => ({ value, label })))}
        {filter('status', 'Booking status', ['PENDING','APPROVED','READY_FOR_RELEASE','RELEASED','RETURNED','COMPLETED','REJECTED','CANCELLED'].map((value) => ({ value, label: statusLabel(value) })), filters.type.endsWith('_maintenance'))}
        {facility && filter('facility_id', 'Facility', records(options.data?.facilities), options.isPending)}
        {asset && filter('asset_id', 'Asset', records(options.data?.assets), options.isPending)}
        {facility && filter('facility_category_id', 'Facility category', records(options.data?.facilityCategories), options.isPending)}
        {asset && filter('asset_category_id', 'Asset category', records(options.data?.assetCategories), options.isPending)}
        {filter('department_id', 'Requester department', records(departments.data), !departmentAllowed || departments.isPending || !!departments.error)}
        <div className="field"><label htmlFor="calendar-go-date">Go to date</label><div className="action-buttons"><input id="calendar-go-date" type="date" value={goDate} onChange={(event) => setGoDate(event.target.value)} /><Button type="button" variant="secondary" disabled={!goDate || range?.view === 'listRange'} onClick={() => calendar.current?.getApi().gotoDate(goDate)}>Go</Button></div></div>
      </div>
      <p className="muted">Calendar navigation sets the date range. Department filtering requires one booking category and permission to view all its requests. A booking-status filter hides maintenance.</p>
      {options.error && <ErrorState error={options.error} retry={() => void options.refetch()} />}
      {departmentAllowed && departments.error && <ErrorState error={departments.error} retry={() => void departments.refetch()} />}
      <Button type="button" variant="quiet" onClick={() => { setFilters({ ...emptyCalendarFilters }); setSelected(''); }}>Clear filters</Button>
      <details className="calendar-range">
        <summary>Choose a custom date range</summary>
        <form className="calendar-filter-grid" onSubmit={(event) => {
          event.preventDefault();
          try {
            const selectedRange = calendarRange(customRange.from, customRange.through);
            setCustomWindow(selectedRange);
            calendar.current?.getApi().changeView('listRange', selectedRange.start);
            setCustomError('');
          }
          catch (failure) { setCustomError(failure instanceof Error ? failure.message : 'Choose valid dates.'); }
        }}>
          <div className="field"><label htmlFor="calendar-range-from">From date</label><input id="calendar-range-from" type="date" required value={customRange.from} onChange={(event) => setCustomRange({ ...customRange, from: event.target.value })} /></div>
          <div className="field"><label htmlFor="calendar-range-through">Through date</label><input id="calendar-range-through" type="date" required value={customRange.through} onChange={(event) => setCustomRange({ ...customRange, through: event.target.value })} /></div>
          <Button type="submit" variant="secondary">Show date range</Button>
        </form>
        {customError && <p role="alert" className="notice notice-error">{customError}</p>}
      </details>
    </section>
    <section className="surface calendar-check" aria-labelledby="calendar-check-heading">
      <h2 id="calendar-check-heading" ref={checkHeading} tabIndex={-1}>Check a time</h2>
      <p className="muted">Choose a calendar date or time range, then check a resource. A date-only selection starts with 9–10 AM; adjust it below.</p>
      <div className="calendar-filter-grid">
        <div className="field"><label htmlFor="calendar-resource">Resource to check</label><select id="calendar-resource" value={resource} onChange={(event) => setResource(event.target.value)} disabled={options.isPending}><option value="">Choose a resource</option>{options.data?.facilities.map((row) => <option key={`facility:${row.id}`} value={`facility:${row.id}`}>Facility · {catalogName(row)}</option>)}{options.data?.assets.map((row) => <option key={`asset:${row.id}`} value={`asset:${row.id}`}>Asset · {catalogName(row)}</option>)}</select></div>
        <div className="field"><label htmlFor="calendar-start">Start date and time</label><input id="calendar-start" type="datetime-local" value={period.start} onChange={(event) => setPeriod({ ...period, start: event.target.value })} /></div>
        <div className="field"><label htmlFor="calendar-end">End or expected return</label><input id="calendar-end" type="datetime-local" value={period.end} onChange={(event) => setPeriod({ ...period, end: event.target.value })} /></div>
      </div>
      {periodError && <p className="notice notice-error" role="alert">{periodError}</p>}
      {resource && !periodError ? <Link className="button button-primary" to={calendarResourceLink(kind, Number(resourceId), period)}>{canRequest(user, kind) ? 'Check availability and request' : 'View schedule and availability'}</Link> : <p className="muted">Select a resource and valid dates to continue.</p>}
    </section>
    <section className={`campus-calendar ${range?.view === 'dayGridMonth' ? 'calendar-month' : ''}`} aria-label="Campus booking calendar" aria-busy={query.isFetching}>
      <div className="section-toolbar"><p className="muted" role="status">{query.isFetching ? 'Updating calendar…' : query.error ? 'Calendar could not be loaded.' : `${events.length} ${events.length === 1 ? 'event' : 'events'} · updates every 30 seconds while visible`}</p><Button type="button" variant="secondary" disabled={!range || query.isFetching} onClick={() => void query.refetch()}>Refresh calendar</Button></div>
      {query.error && <ErrorState error={query.error} retry={() => void query.refetch()} />}
      <div className="calendar-legend">{categories.filter(([type]) => type.startsWith('facility') ? facility : asset).map(([type, label]) => <span key={type} className={`calendar-${type}`}>{label}</span>)}</div>
      <FullCalendar ref={calendar} plugins={plugins} views={views} timeZone="Asia/Manila" initialView={initialView} headerToolbar={range?.view === 'listRange' ? rangeToolbar : toolbar} headerToolbarClass="campus-calendar-toolbar" toolbarTitleClass="campus-calendar-title" buttons={buttons} height="auto" events={events} datesSet={onDates} eventContent={renderEvent} eventClass={eventClasses} eventClick={onEvent} dateClick={onDateClick} select={onSelect} selectable editable={false} eventInteractive dayMaxEvents={3} nowIndicator eventTimeFormat={eventTimeFormat} noEventsContent={query.isFetching ? 'Loading schedule…' : query.error ? 'Schedule could not be loaded. Try again above.' : 'No visible events match your filters.'} />
      {!query.isFetching && !query.error && events.length === 0 && <p className="notice" role="status">No visible events match this date range and filters. Check availability before making a request.</p>}
    </section>
    <p className="notice">Pending requests do not reserve resources. Other users’ confirmed bookings show shared schedule information only. Asset quantities, overdue custody and inspection holds are checked by the existing availability service; an empty calendar is not proof that stock is available.</p>
    {selectedEvent && <CalendarEventDetails key={selectedEvent.id} event={selectedEvent} close={() => setSelected('')} />}
  </>;
}
