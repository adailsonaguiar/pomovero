import { useCallback, useEffect, useState } from 'react';
import { GetSessionLogs } from '../wailsjs/go/main/App';
import { EventsOn } from '../wailsjs/runtime/runtime';

interface DayData {
  day: string;
  minutes: number;
  isToday: boolean;
}

function formatDuration(totalSeconds: number): string {
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  if (h > 0 && m > 0) return `${h}h ${m}m`;
  if (h > 0) return `${h}h`;
  return `${m}m`;
}

function sameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

export function InsightsView() {
  const [days, setDays] = useState<DayData[]>([]);
  const [totalFocus, setTotalFocus] = useState(0);
  const [sessionCount, setSessionCount] = useState(0);
  const [delta, setDelta] = useState<number | null>(null);
  const [avgFocus, setAvgFocus] = useState(0);

  const loadInsights = useCallback(() => {
    GetSessionLogs()
      .then((logs) => {
        if (!logs) logs = [];

        const dayNames = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
        const last7Days = Array.from({ length: 7 }, (_, i) => {
          const d = new Date();
          d.setDate(d.getDate() - (6 - i));
          return d;
        });

        let total = 0;
        let count = 0;
        let prevCount = 0;

        const now = new Date();
        const sevenDaysAgo = new Date(now);
        sevenDaysAgo.setDate(now.getDate() - 6);
        sevenDaysAgo.setHours(0, 0, 0, 0);
        const fourteenDaysAgo = new Date(now);
        fourteenDaysAgo.setDate(now.getDate() - 13);
        fourteenDaysAgo.setHours(0, 0, 0, 0);

        const processed: DayData[] = last7Days.map((date) => {
          let focusSeconds = 0;
          logs.forEach((log) => {
            if (!log.created_at || log.type !== 'focus') return;
            const logDate = new Date(log.created_at);
            if (sameDay(logDate, date)) focusSeconds += log.duration;
          });
          return {
            day: dayNames[date.getDay()],
            minutes: Math.round(focusSeconds / 60),
            isToday: sameDay(date, now),
          };
        });

        logs.forEach((log) => {
          if (!log.created_at || log.type !== 'focus') return;
          const logDate = new Date(log.created_at);
          if (logDate >= sevenDaysAgo) {
            total += log.duration;
            count++;
          } else if (logDate >= fourteenDaysAgo) {
            prevCount++;
          }
        });

        setDays(processed);
        setTotalFocus(total);
        setSessionCount(count);
        setDelta(prevCount > 0 ? Math.round(((count - prevCount) / prevCount) * 100) : null);
        setAvgFocus(Math.round(total / 7));
      })
      .catch((err) => {
        console.error('Erro ao carregar insights do SQLite:', err);
      });
  }, []);

  useEffect(() => {
    loadInsights();
  }, [loadInsights]);

  useEffect(() => {
    const off = EventsOn('timer_finished', () => {
      loadInsights();
    });
    return () => {
      off();
    };
  }, [loadInsights]);

  const max = Math.max(...days.map((d) => d.minutes), 1);

  return (
    <section className="block">
      <div className="block-head">
        <h2>Insights semanais</h2>
        <span>Últimos 7 dias</span>
      </div>

      <div className="glass insights-card">
        <div className="total">
          <span className="big">{formatDuration(totalFocus)}</span>
          <span className="sub">de foco total</span>
        </div>
        <div className="chart">
          {days.map((d, i) => (
            <div className="bar-col" key={i}>
              <div className="bar-wrap">
                <div
                  className={`bar ${d.isToday ? 'today' : ''}`}
                  style={{ height: `${Math.max((d.minutes / max) * 100, 12)}%` }}
                />
              </div>
              <span className={`bar-label ${d.isToday ? 'today' : ''}`}>{d.day}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="stats">
        <div className="glass stat">
          <div className="stat-head">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" />
              <path d="M12 6v6l4 2" />
            </svg>
            <span>Sessões</span>
          </div>
          <p className="val">{sessionCount}</p>
          <p className="delta">
            {delta === null ? 'últimos 7 dias' : `${delta >= 0 ? '+' : ''}${delta}% vs semana anterior`}
          </p>
        </div>
        <div className="glass stat">
          <div className="stat-head">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="3" />
              <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
            </svg>
            <span>Foco médio</span>
          </div>
          <p className="val">{formatDuration(avgFocus)}</p>
          <p className="delta">por dia em média</p>
        </div>
      </div>
    </section>
  );
}
