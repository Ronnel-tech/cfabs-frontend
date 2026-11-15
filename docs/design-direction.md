# CFABS visual direction

This direction follows the project owner's dark SaaS dashboard reference with orange accents. The product serves campus requesters and staff who need to find availability, review bookings, and understand what requires action.

## Design plan

- **Color:** canvas `#0B0B0B`, navigation `#111111`, panels `#171717`, raised controls `#242424`, text `#F4F4F3`, action orange `#E85002`. Green, blue, amber, and red are reserved for status or distinct data series.
- **Type:** Inter when available, Segoe UI fallback. Sentence case headings and labels; one compact type scale. Counts are prominent only when they help compare workload.
- **Layout:** left aligned content and compact navigation. The dashboard opens with the current task and period, then status counts, a real-data comparison chart, and follow-up panels. Forms keep labels close to controls. Calendar dates, events, and controls must remain readable against the dark surface.

```text
Desktop: [navigation] [heading and actions                         ]
                      [status counts                                ]
                      [booking status chart] [facility / asset mix]
                      [follow-up work      ] [booking guidance     ]

Mobile:  [brand / menu]
         [heading]
         [actions]
         [counts in two columns]
         [chart]
         [follow-up work]
```

## Critique against the references

The first theme pass changed color without changing hierarchy. The later large gradient and concentric rings in the dashboard and sign-in page still looked like generic generated decoration. The project owner supplied a dotted orange and violet artwork to replace the sign-in ring; keep it confined to the sign-in introduction, with a dark fade behind the copy. Four later references establish warm abstract imagery for dashboard metric cards and softer iOS-style rounded corners. Use each image as a subdued card background with dark coverage behind text. The chart remains the main data visual because it displays real booking counts. Keep other panels quiet: fine borders, clear spacing, and restrained orange actions.

## Review criteria

Check sign-in, dashboard, calendar, a form, and a data table at desktop and mobile widths. Review empty, loading, and error states where possible. Check keyboard focus, contrast, overflow, chart readability, and reduced motion. Backend-dependent pages need a live authenticated pass when a local backend is available.
