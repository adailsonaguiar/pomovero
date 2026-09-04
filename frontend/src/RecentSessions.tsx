import { useCallback, useEffect, useState } from 'react';
import { GetSessionLogs } from '../wailsjs/go/main/App';
import { EventsOn } from '../wailsjs/runtime/runtime';

interface RecentSession {
  title: string;
  when: string;
  dur: string;
}

function formatWhen(date: Date): string {
  const now = new Date();
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);

  const time = `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;

  const sameDay = (a: Date, b: Date) =>
    a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();

  if (sameDay(date, now)) return `Hoje, ${time}`;
  if (sameDay(date, yesterday)) return `Ontem, ${time}`;
  return `${String(date.getDate()).padStart(2, '0')}/${String(date.getMonth() + 1).padStart(2, '0')}, ${time}`;
}

export function RecentSessions() {
  const [sessions, setSessions] = useState<RecentSession[]>([]);

  const loadSessions = useCallback(() => {
    GetSessionLogs()
      .then((logs) => {
        if (!logs) return;
        const recent = logs.slice(0, 4).map((log) => {
          const date = new Date(log.created_at);
          return {
            title: log.type === 'focus' ? 'Sessão de foco' : 'Pausa',
            when: formatWhen(date),
            dur: `${Math.round(log.duration / 60)} min`,
          };
        });
        setSessions(recent);
      })
      .catch((err) => {
        console.error('Erro ao carregar sessões recentes:', err);
      });
  }, []);

  useEffect(() => {
    loadSessions();
  }, [loadSessions]);

  useEffect(() => {
    const off = EventsOn('timer_finished', () => {
      loadSessions();
    });
    return () => {
      off();
    };
  }, [loadSessions]);

  if (sessions.length === 0) return null;

  return (
    <section className="block">
      <div className="block-head">
        <h2>Sessões recentes</h2>
      </div>
      <div className="sessions">
        {sessions.map((s, i) => (
          <div className="glass session" key={i}>
            <div className="session-left">
              <div className="tomato">
                <svg viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 2C9 2 6 4 6 7c0 1.5.5 2.8 1.4 3.8C5.5 12 4 14.5 4 17c0 3.3 2.7 6 6 6h4c3.3 0 6-2.7 6-6 0-2.5-1.5-5-3.4-6.2C17.5 9.8 18 8.5 18 7c0-3-3-5-6-5z" />
                </svg>
              </div>
              <div>
                <p className="title">{s.title}</p>
                <p className="when">{s.when}</p>
              </div>
            </div>
            <span className="dur">{s.dur}</span>
          </div>
        ))}
      </div>
    </section>
  );
}
