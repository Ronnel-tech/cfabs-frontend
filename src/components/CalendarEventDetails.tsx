import { useEffect, useRef } from 'react';
import { Link } from 'react-router';
import { Button } from './ui';
import { calendarCategories } from '../lib/calendar';
import type { CalendarRecord } from '../lib/calendar';
import { campusDate } from '../lib/types';
import { requestLink, statusLabel } from '../lib/bookings';

export default function CalendarEventDetails({ event, close }: { event: CalendarRecord; close: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => { dialog.current?.showModal(); }, []);
  return <dialog ref={dialog} className="decision-dialog calendar-detail" aria-labelledby="calendar-detail-title" onCancel={close}>
    <h2 id="calendar-detail-title">{event.resource_name}</h2>
    <p>{calendarCategories[event.type]} · <span className="role-name">{statusLabel(event.status)}</span></p>
    <dl>
      <dt>Scheduled start</dt><dd>{campusDate(event.scheduled_start, true)}</dd>
      <dt>{event.kind === 'asset' && event.type === 'asset_booking' ? 'Expected return' : 'End'}</dt>
      <dd>{event.scheduled_end ? campusDate(event.scheduled_end, true) : 'Open until maintenance is completed'}</dd>
      {event.resource_status !== 'active' && <><dt>Resource status</dt><dd>{event.resource_status}</dd></>}
      {event.booking_reference && <><dt>Reference</dt><dd>{event.booking_reference}</dd></>}
      {event.quantity_requested !== undefined && <><dt>Requested quantity</dt><dd>{event.quantity_requested}</dd></>}
    </dl>
    {event.description && <p className="calendar-description">{event.description}</p>}
    {!event.can_view_details && <p className="muted">Only the resource schedule is shared. Requester information and request details are private.</p>}
    <p className="notice">{event.status === 'PENDING' ? 'Pending requests do not reserve resources. ' : ['REJECTED', 'CANCELLED', 'COMPLETED'].includes(event.status) ? 'This booking does not reserve its scheduled time. ' : ''}Check availability for current stock, overdue custody, inspection holds, and maintenance. Calendar events do not guarantee availability.</p>
    <div className="action-buttons">
      <Button type="button" variant="secondary" onClick={close}>Close</Button>
      {event.can_view_details && event.booking_id && <Link className="button button-primary" to={requestLink(event.kind, event.booking_id)}>View request</Link>}
      <Link className="button button-secondary" to={`/${event.kind === 'facility' ? 'facilities' : 'assets'}/${event.resource_id}`}>Check availability</Link>
    </div>
  </dialog>;
}
