import { useQuery } from "@tanstack/react-query";
import { api } from "../lib/api";
import {
  addDays,
  availabilityPath,
  campusTime,
  campusToday,
  daySchedule,
  localInput,
} from "../lib/availability";
import type { Availability } from "../lib/availability";
import { Button, ErrorState, Loading } from "./ui";

export default function FacilitySchedule({
  id,
  day,
  active,
  choose,
  disabled = false,
}: {
  id: string;
  day: string;
  active: boolean;
  disabled?: boolean;
  choose: (start: string, end: string) => void;
}) {
  const today = campusToday();
  const latest = addDays(today, 30);
  const valid =
    /^\d{4}-\d{2}-\d{2}$/.test(day) && day >= today && day <= latest;
  const endDay = valid ? addDays(day, 6) : day;
  const query = useQuery({
    queryKey: ["facility-schedule", id, day],
    enabled: valid && active,
    queryFn: ({ signal }) =>
      api.request<Availability>(
        availabilityPath(
          "facility",
          id,
          `${day}T08:00:00+08:00`,
          `${endDay}T17:00:00+08:00`,
        ),
        { signal },
      ),
  });
  if (!valid || !active) return null;
  return (
    <section className="schedule-section" aria-labelledby="schedule-heading">
      <div className="section-toolbar">
        <div>
          <h2 id="schedule-heading">Find an open time</h2>
          <p className="muted">
            Seven days from your selected start date · 8 AM–5 PM
          </p>
        </div>
      </div>
      {query.isPending ? (
        <Loading label="Loading facility schedule…" />
      ) : query.error ? (
        <ErrorState error={query.error} retry={() => void query.refetch()} />
      ) : (
        query.data && (
          <>
            {query.data.requires_schedule_review ? (
              <p className="notice">
                This facility’s custom schedule requires coordinator review.
              </p>
            ) : (
              <div className="week-schedule">
                {Array.from({ length: 7 }, (_, offset) => {
                  const date = addDays(day, offset);
                  const free =
                    date <= latest
                      ? daySchedule(date, query.data.unavailable_intervals)
                      : [];
                  return (
                    <article key={date} className="schedule-day">
                      <h3>
                        {new Intl.DateTimeFormat("en-PH", {
                          timeZone: "Asia/Manila",
                          weekday: "short",
                          month: "short",
                          day: "numeric",
                        }).format(new Date(`${date}T08:00:00+08:00`))}
                      </h3>
                      {date > latest ? (
                        <p className="muted">Outside booking window</p>
                      ) : free.length ? (
                        free.map(([from, to]) => (
                          <Button
                            key={from}
                            variant="secondary"
                            disabled={disabled}
                            onClick={() =>
                              choose(localInput(from), localInput(to))
                            }
                            aria-label={`Use available time on ${date}: ${campusTime(from)} to ${campusTime(to)}`}
                          >
                            {campusTime(from)}–{campusTime(to)}
                          </Button>
                        ))
                      ) : (
                        <p className="muted">No open time</p>
                      )}
                    </article>
                  );
                })}
              </div>
            )}
            <p className="refresh-caption">
              Open times exclude approved bookings and maintenance. Select a
              time to check it above. Back-to-back bookings are allowed.
            </p>
          </>
        )
      )}
    </section>
  );
}
