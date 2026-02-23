import { Link } from 'react-router-dom';
import { tmdbService } from '../../services/tmdb';

interface CalendarEvent {
  id: string;
  type: 'episode' | 'movie';
  date: string;
  title: string;
  subtitle?: string;
  mediaId: number;
  mediaType: 'tv' | 'movie';
  posterPath: string | null;
}

interface CalendarGridProps {
  events: CalendarEvent[];
  currentMonth: Date;
  onMonthChange: (date: Date) => void;
}

export function CalendarGrid({ events, currentMonth, onMonthChange }: CalendarGridProps) {
  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  const daysOfWeek = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  const year = currentMonth.getFullYear();
  const month = currentMonth.getMonth();
  const firstDayOfMonth = new Date(year, month, 1);
  const lastDayOfMonth = new Date(year, month + 1, 0);
  const daysInMonth = lastDayOfMonth.getDate();
  const startingDayOfWeek = firstDayOfMonth.getDay();

  const eventsByDate = new Map<string, CalendarEvent[]>();
  events.forEach(event => {
    const dateKey = event.date;
    if (!eventsByDate.has(dateKey)) {
      eventsByDate.set(dateKey, []);
    }
    eventsByDate.get(dateKey)!.push(event);
  });

  function getEventsForDate(day: number): CalendarEvent[] {
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    return eventsByDate.get(dateStr) || [];
  }

  function previousMonth() {
    const newDate = new Date(currentMonth);
    newDate.setMonth(newDate.getMonth() - 1);
    onMonthChange(newDate);
  }

  function nextMonth() {
    const newDate = new Date(currentMonth);
    newDate.setMonth(newDate.getMonth() + 1);
    onMonthChange(newDate);
  }

  function isToday(day: number): boolean {
    const today = new Date();
    return today.getDate() === day &&
           today.getMonth() === month &&
           today.getFullYear() === year;
  }

  const days = [];
  for (let i = 0; i < startingDayOfWeek; i++) {
    days.push(<div key={`empty-${i}`} className="min-h-24 bg-gray-900/50" />);
  }

  for (let day = 1; day <= daysInMonth; day++) {
    const dayEvents = getEventsForDate(day);
    const today = isToday(day);

    days.push(
      <div
        key={day}
        className={`min-h-24 bg-gray-800 border border-gray-700 p-2 ${
          today ? 'ring-2 ring-primary-500' : ''
        }`}
      >
        <div className={`text-sm font-medium mb-1 ${today ? 'text-primary-400' : 'text-gray-400'}`}>
          {day}
        </div>
        <div className="space-y-1">
          {dayEvents.slice(0, 3).map((event) => (
            <Link
              key={event.id}
              to={`/details/${event.mediaType}/${event.mediaId}`}
              className="block text-xs bg-primary-600/20 hover:bg-primary-600/30 text-primary-300 px-1.5 py-1 rounded truncate transition-colors"
              title={event.title + (event.subtitle ? ` - ${event.subtitle}` : '')}
            >
              {event.type === 'episode' ? '📺' : '🎬'} {event.title}
            </Link>
          ))}
          {dayEvents.length > 3 && (
            <div className="text-xs text-gray-500 px-1.5">
              +{dayEvents.length - 3} more
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <button
          onClick={previousMonth}
          className="p-2 hover:bg-gray-700 rounded-lg transition-colors"
          aria-label="Previous month"
        >
          <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <h2 className="text-2xl font-bold text-white">
          {monthNames[month]} {year}
        </h2>
        <button
          onClick={nextMonth}
          className="p-2 hover:bg-gray-700 rounded-lg transition-colors"
          aria-label="Next month"
        >
          <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </button>
      </div>

      <div className="bg-gray-800 rounded-lg overflow-hidden">
        <div className="grid grid-cols-7 gap-px bg-gray-700">
          {daysOfWeek.map((day) => (
            <div
              key={day}
              className="bg-gray-800 py-3 text-center text-sm font-semibold text-gray-400"
            >
              {day}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-px bg-gray-700">
          {days}
        </div>
      </div>
    </div>
  );
}
