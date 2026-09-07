"use client"

import * as React from "react"
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight } from "lucide-react"
import { format, parseISO, isValid } from "date-fns"

import { cn } from "@/lib/utils"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"

// ---------------------------------------------------------------------------
// Date helpers (exported so pages can build default values)
// ---------------------------------------------------------------------------

/** Returns the local date `n` days ago as an ISO `yyyy-MM-dd` string. */
export function isoDaysAgo(n: number): string {
  const d = new Date()
  d.setDate(d.getDate() - n)
  return format(d, "yyyy-MM-dd")
}

/** Returns today's local date as an ISO `yyyy-MM-dd` string. */
export function todayIso(): string {
  return format(new Date(), "yyyy-MM-dd")
}

/** Empty on first render, then last-N-days in local time — avoids SSR date mismatch. */
export function useIsoDateRange(days: number): DateRangeValue {
  const [range, setRange] = React.useState<DateRangeValue>({ startDate: "", endDate: "" })
  React.useEffect(() => {
    setRange({ startDate: isoDaysAgo(days), endDate: todayIso() })
  }, [days])
  return range
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface DateRangeValue {
  startDate: string
  endDate: string
}

export interface DateRangePickerProps {
  value: DateRangeValue
  onChange: (value: DateRangeValue) => void
  /** Preset lengths in days. Defaults to [7, 30, 60, 90, 180, 360]. */
  presets?: number[]
  className?: string
}

const DEFAULT_PRESETS = [7, 30, 60, 90, 180, 360]

const WEEKDAYS = ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"]

// ---------------------------------------------------------------------------
// Internal utilities
// ---------------------------------------------------------------------------

function parseIsoSafe(iso: string | undefined): Date | null {
  if (!iso) return null
  try {
    const d = parseISO(iso)
    return isValid(d) ? d : null
  } catch {
    return null
  }
}

function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate())
}

function isSameDay(a: Date | null, b: Date | null): boolean {
  if (!a || !b) return false
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  )
}

/** Which preset (in days) does `value` currently match, if any? */
function matchPreset(value: DateRangeValue, presets: number[]): number | null {
  const today = todayIso()
  if (value.endDate !== today) return null
  for (const n of presets) {
    if (value.startDate === isoDaysAgo(n)) return n
  }
  return null
}

/** Builds the 6-row (42-cell) month grid for a given month. */
function buildMonthGrid(year: number, month: number): Date[] {
  const firstOfMonth = new Date(year, month, 1)
  // Monday-first weekday index (Mon=0 … Sun=6)
  const offset = (firstOfMonth.getDay() + 6) % 7
  const cells: Date[] = []
  for (let i = 0; i < 42; i++) {
    cells.push(new Date(year, month, 1 - offset + i))
  }
  return cells
}

// ---------------------------------------------------------------------------
// Month calendar (self-contained, no external calendar dependency)
// ---------------------------------------------------------------------------

interface MonthCalendarProps {
  /** First day of the month to render */
  month: Date
  startDate: Date | null
  endDate: Date | null
  hoverDate: Date | null
  pendingStart: Date | null
  onSelect: (date: Date) => void
  onHover: (date: Date | null) => void
}

function MonthCalendar({
  month,
  startDate,
  endDate,
  hoverDate,
  pendingStart,
  onSelect,
  onHover,
}: MonthCalendarProps) {
  const today = startOfDay(new Date())
  const cells = buildMonthGrid(month.getFullYear(), month.getMonth())

  // Effective range for highlighting: while picking the end date, anchor on the
  // pending start and preview up to the hovered day; otherwise use the
  // committed range.
  const effStart = pendingStart ?? startDate
  const effEnd = pendingStart && hoverDate ? hoverDate : endDate

  const lo =
    effStart && effEnd && effEnd < effStart
      ? effEnd
      : effStart
  const hi =
    effStart && effEnd && effEnd < effStart
      ? effStart
      : effEnd

  return (
    <div className="w-[248px]">
      <div className="mb-2 grid grid-cols-7">
        {WEEKDAYS.map((wd) => (
          <div
            key={wd}
            className="flex h-8 items-center justify-center text-[11px] font-medium uppercase tracking-wide text-muted-foreground"
          >
            {wd}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7" onMouseLeave={() => onHover(null)}>
        {cells.map((day, i) => {
          const inMonth = day.getMonth() === month.getMonth()
          const isFuture = day > today
          const disabled = isFuture || !inMonth

          const isStart = isSameDay(day, effStart)
          const isEnd = isSameDay(day, effEnd)
          const isPending = isSameDay(day, pendingStart)
          const inRange =
            !!lo && !!hi && day > lo && day < hi && !disabled
          const isToday = isSameDay(day, today)

          return (
            <button
              key={i}
              type="button"
              disabled={disabled}
              onClick={() => onSelect(day)}
              onMouseEnter={() => !disabled && onHover(day)}
              aria-label={format(day, "d MMMM yyyy")}
              aria-pressed={isStart || isEnd || isPending}
              className={cn(
                "relative flex h-8 w-8 items-center justify-center rounded-md text-xs font-normal transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
                inMonth ? "text-foreground" : "text-muted-foreground/40",
                !disabled && "hover:bg-accent hover:text-accent-foreground",
                inRange && "bg-accent text-accent-foreground",
                isToday &&
                  !isStart &&
                  !isEnd &&
                  !isPending &&
                  "font-semibold text-primary",
                (isStart || isEnd || isPending) &&
                  "bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground",
                disabled && "pointer-events-none opacity-40"
              )}
            >
              {day.getDate()}
            </button>
          )
        })}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// DateRangePicker
// ---------------------------------------------------------------------------

export function DateRangePicker({
  value,
  onChange,
  presets = DEFAULT_PRESETS,
  className,
}: DateRangePickerProps) {
  const [open, setOpen] = React.useState(false)
  const [pendingStart, setPendingStart] = React.useState<Date | null>(null)
  const [hoverDate, setHoverDate] = React.useState<Date | null>(null)

  const startDate = parseIsoSafe(value.startDate)
  const endDate = parseIsoSafe(value.endDate)

  // Base month shown in the left calendar; right calendar shows base + 1 month.
  const [baseMonth, setBaseMonth] = React.useState<Date>(() => {
    const anchor = startDate ?? new Date()
    return new Date(anchor.getFullYear(), anchor.getMonth(), 1)
  })

  // Reset transient state each time the popover is opened / value changes.
  React.useEffect(() => {
    if (!open) {
      setPendingStart(null)
      setHoverDate(null)
    }
  }, [open])

  const activePreset = matchPreset(value, presets)

  const label = React.useMemo(() => {
    if (activePreset !== null) return `Last ${activePreset} days`
    if (startDate && endDate) {
      if (isSameDay(startDate, endDate)) return format(startDate, "d MMM yyyy")
      return `${format(startDate, "d MMM yyyy")} – ${format(endDate, "d MMM yyyy")}`
    }
    return "Select date range"
  }, [activePreset, startDate, endDate])

  const handlePreset = (n: number) => {
    onChange({ startDate: isoDaysAgo(n), endDate: todayIso() })
    setPendingStart(null)
    setOpen(false)
  }

  const handleDaySelect = (day: Date) => {
    if (!pendingStart) {
      // First click: pick the start date.
      setPendingStart(day)
      setHoverDate(null)
      return
    }
    // Second click: order the pair, commit and close.
    let s = pendingStart
    let e = day
    if (e < s) {
      ;[s, e] = [e, s]
    }
    onChange({ startDate: format(s, "yyyy-MM-dd"), endDate: format(e, "yyyy-MM-dd") })
    setPendingStart(null)
    setHoverDate(null)
    setOpen(false)
  }

  const rightMonth = new Date(
    baseMonth.getFullYear(),
    baseMonth.getMonth() + 1,
    1
  )

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={cn(
            "inline-flex h-9 items-center justify-center gap-2 whitespace-nowrap rounded-md border border-input bg-background px-3 text-sm font-medium shadow-sm transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
            className
          )}
        >
          <CalendarIcon className="size-4 shrink-0 text-muted-foreground" />
          <span className="tabular-nums">{label}</span>
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-auto p-4">
        {/* Preset row */}
        <div className="mb-4 flex flex-wrap items-center gap-1.5">
          {presets.map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => handlePreset(n)}
              className={cn(
                "h-8 rounded-md border px-3 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
                activePreset === n
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border bg-card text-muted-foreground hover:bg-accent hover:text-accent-foreground"
              )}
            >
              {n}d
            </button>
          ))}
        </div>

        {/* Custom range */}
        <div className="mb-2 flex items-center justify-between">
          <span className="text-xs font-medium text-muted-foreground">
            {pendingStart
              ? `Select end date (from ${format(pendingStart, "d MMM yyyy")})`
              : "Custom range — select start date"}
          </span>
        </div>

        <div className="flex gap-6">
          <div>
            <div className="mb-2 flex items-center justify-between">
              <button
                type="button"
                onClick={() =>
                  setBaseMonth(
                    new Date(baseMonth.getFullYear(), baseMonth.getMonth() - 1, 1)
                  )
                }
                aria-label="Previous month"
                className="inline-flex size-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              >
                <ChevronLeft className="size-4" />
              </button>
              <span className="text-sm font-semibold">
                {format(baseMonth, "MMMM yyyy")}
              </span>
              <span className="size-7" aria-hidden />
            </div>
            <MonthCalendar
              month={baseMonth}
              startDate={startDate}
              endDate={endDate}
              hoverDate={hoverDate}
              pendingStart={pendingStart}
              onSelect={handleDaySelect}
              onHover={setHoverDate}
            />
          </div>

          <div>
            <div className="mb-2 flex items-center justify-between">
              <span className="size-7" aria-hidden />
              <span className="text-sm font-semibold">
                {format(rightMonth, "MMMM yyyy")}
              </span>
              <button
                type="button"
                onClick={() =>
                  setBaseMonth(
                    new Date(baseMonth.getFullYear(), baseMonth.getMonth() + 1, 1)
                  )
                }
                aria-label="Next month"
                className="inline-flex size-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              >
                <ChevronRight className="size-4" />
              </button>
            </div>
            <MonthCalendar
              month={rightMonth}
              startDate={startDate}
              endDate={endDate}
              hoverDate={hoverDate}
              pendingStart={pendingStart}
              onSelect={handleDaySelect}
              onHover={setHoverDate}
            />
          </div>
        </div>
      </PopoverContent>
    </Popover>
  )
}

export default DateRangePicker
