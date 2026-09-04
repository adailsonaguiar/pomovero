package main

import (
	"context"
	"database/sql"
	"fmt"
	"os"
	"path/filepath"
	"strings"
	"time"

	_ "github.com/mattn/go-sqlite3" // SQLite driver
	"github.com/wailsapp/wails/v2/pkg/runtime"
)

type SessionLog struct {
	ID        int       `json:"id"`
	Type      string    `json:"type"`      // "focus" ou "break"
	Duration  int       `json:"duration"`  // em segundos
	CreatedAt time.Time `json:"created_at"`
}

type Settings struct {
	FocusDuration     int  `json:"focusDuration"`
	BreakDuration     int  `json:"breakDuration"`
	LongBreakDuration int  `json:"longBreakDuration"`
	LongBreakInterval int  `json:"longBreakInterval"`
	StartSoundEnabled bool `json:"startSoundEnabled"`
	AlarmSoundEnabled bool `json:"alarmSoundEnabled"`
}

type App struct {
	ctx           context.Context
	Name          string // Dummy exported field for Wails bindings
	timerCancel   chan struct{}
	isTimerActive bool
	db            *sql.DB
	settings      Settings
}

func NewApp() *App {
	return &App{
		Name:        "PomoVeroApp", // Initialize the exported field
		timerCancel: make(chan struct{}),

	}
}

func (a *App) startup(ctx context.Context) {
	a.ctx = ctx
	a.initDatabase()
	a.initSettings()
}

func (a *App) initDatabase() {
	configDir, err := os.UserConfigDir()
	if err != nil {
		fmt.Printf("Failed to get user config directory: %v\n", err)
		return
	}

	appDir := filepath.Join(configDir, "pomo_vero")
	if err := os.MkdirAll(appDir, 0o755); err != nil {
		fmt.Printf("Failed to create app config directory: %v\n", err)
		return
	}

	dbPath := filepath.Join(appDir, "session_logs.db")
	a.db, err = sql.Open("sqlite3", dbPath)
	if err != nil {
		fmt.Printf("Failed to open database: %v\n", err)
		return
	}

	if err := a.db.Ping(); err != nil {
		fmt.Printf("Failed to ping database: %v\n", err)
		return
	}

	createTableSQL := `CREATE TABLE IF NOT EXISTS session_logs (
		id INTEGER PRIMARY KEY AUTOINCREMENT,
		type TEXT NOT NULL,
		duration INTEGER NOT NULL,
		created_at DATETIME DEFAULT CURRENT_TIMESTAMP
	);`

	_, err = a.db.Exec(createTableSQL)
	if err != nil {
		fmt.Printf("Failed to create session_logs table: %v\n", err)
	}
}

func (a *App) initSettings() {
	createSettingsTableSQL := `CREATE TABLE IF NOT EXISTS settings (
		id INTEGER PRIMARY KEY AUTOINCREMENT,
		focus_duration INTEGER NOT NULL,
		break_duration INTEGER NOT NULL,
		long_break_duration INTEGER NOT NULL DEFAULT 900,
		long_break_interval INTEGER NOT NULL DEFAULT 4,
		start_sound_enabled INTEGER NOT NULL DEFAULT 1,
		alarm_sound_enabled INTEGER NOT NULL DEFAULT 1
	);`

	_, err := a.db.Exec(createSettingsTableSQL)
	if err != nil {
		fmt.Printf("Failed to create settings table: %v\n", err)
		return
	}

	// Migrations for existing databases
	migrations := []string{
		`ALTER TABLE settings ADD COLUMN long_break_duration INTEGER NOT NULL DEFAULT 900`,
		`ALTER TABLE settings ADD COLUMN long_break_interval INTEGER NOT NULL DEFAULT 4`,
		`ALTER TABLE settings ADD COLUMN start_sound_enabled INTEGER NOT NULL DEFAULT 1`,
		`ALTER TABLE settings ADD COLUMN alarm_sound_enabled INTEGER NOT NULL DEFAULT 1`,
	}
	for _, migration := range migrations {
		_, err = a.db.Exec(migration)
		if err != nil && !strings.Contains(err.Error(), "duplicate column name") {
			fmt.Printf("Failed to migrate settings table: %v\n", err)
		}
	}

	// Check if settings exist, if not, insert defaults
	row := a.db.QueryRow("SELECT focus_duration, break_duration, long_break_duration, long_break_interval, start_sound_enabled, alarm_sound_enabled FROM settings LIMIT 1")
	var focus, breakD, longBreak, longBreakInterval int
	var startSound, alarmSound bool
	err = row.Scan(&focus, &breakD, &longBreak, &longBreakInterval, &startSound, &alarmSound)

	if err == sql.ErrNoRows {
		_, err = a.db.Exec("INSERT INTO settings (focus_duration, break_duration, long_break_duration, long_break_interval, start_sound_enabled, alarm_sound_enabled) VALUES (?, ?, ?, ?, ?, ?)", 1500, 300, 900, 4, 1, 1)
		if err != nil {
			fmt.Printf("Failed to insert default settings: %v\n", err)
		}
		a.settings = Settings{FocusDuration: 1500, BreakDuration: 300, LongBreakDuration: 900, LongBreakInterval: 4, StartSoundEnabled: true, AlarmSoundEnabled: true}
	} else if err != nil {
		fmt.Printf("Failed to query settings: %v\n", err)
	} else {
		a.settings = Settings{FocusDuration: focus, BreakDuration: breakD, LongBreakDuration: longBreak, LongBreakInterval: longBreakInterval, StartSoundEnabled: startSound, AlarmSoundEnabled: alarmSound}
	}
}

func (a *App) GetSettings() Settings {
	row := a.db.QueryRow("SELECT focus_duration, break_duration, long_break_duration, long_break_interval, start_sound_enabled, alarm_sound_enabled FROM settings LIMIT 1")
	var focus, breakD, longBreak, longBreakInterval int
	var startSound, alarmSound bool
	err := row.Scan(&focus, &breakD, &longBreak, &longBreakInterval, &startSound, &alarmSound)
	if err != nil {
		fmt.Printf("Failed to get settings from database: %v\n", err)
		return a.settings
	}
	a.settings = Settings{FocusDuration: focus, BreakDuration: breakD, LongBreakDuration: longBreak, LongBreakInterval: longBreakInterval, StartSoundEnabled: startSound, AlarmSoundEnabled: alarmSound}
	return a.settings
}

func (a *App) SaveSettings(focusDuration, breakDuration, longBreakDuration, longBreakInterval int, startSoundEnabled, alarmSoundEnabled bool) error {
	_, err := a.db.Exec("UPDATE settings SET focus_duration = ?, break_duration = ?, long_break_duration = ?, long_break_interval = ?, start_sound_enabled = ?, alarm_sound_enabled = ? WHERE id = 1", focusDuration, breakDuration, longBreakDuration, longBreakInterval, startSoundEnabled, alarmSoundEnabled)
	if err != nil {
		fmt.Printf("Failed to update settings: %v\n", err)
		return err
	}
	a.settings = Settings{FocusDuration: focusDuration, BreakDuration: breakDuration, LongBreakDuration: longBreakDuration, LongBreakInterval: longBreakInterval, StartSoundEnabled: startSoundEnabled, AlarmSoundEnabled: alarmSoundEnabled}
	return nil
}

func (a *App) StartTimer(durationSeconds int, sessionType string) {
	if a.isTimerActive {
		a.StopTimer()
	}

	a.isTimerActive = true
	a.timerCancel = make(chan struct{})

	if sessionType == "focus" {
		runtime.WindowMinimise(a.ctx)
	}

	go func() {
		ticker := time.NewTicker(1 * time.Second)
		defer ticker.Stop()

		remaining := durationSeconds

		for {
			select {
			case <-a.timerCancel:
				a.isTimerActive = false
				return
			case <-ticker.C:
				remaining--
				runtime.EventsEmit(a.ctx, "timer_tick", remaining)

				if remaining <= 0 {
					a.isTimerActive = false
					a.onSessionComplete(sessionType, durationSeconds)
					return
				}
			}
		}
	}()
}

func (a *App) StopTimer() {
	if a.isTimerActive {
		close(a.timerCancel)
		a.isTimerActive = false
	}
}

func (a *App) onSessionComplete(sessionType string, duration int) {
	a.saveSessionToDatabase(sessionType, duration)

	runtime.WindowUnminimise(a.ctx)
	runtime.WindowShow(a.ctx)
	// runtime.WindowFocus(a.ctx) // Garante que a janela volte ao foco
	runtime.EventsEmit(a.ctx, "timer_finished", sessionType)
}

func (a *App) saveSessionToDatabase(sessionType string, duration int) {
	insertSQL := `INSERT INTO session_logs(type, duration, created_at) VALUES(?, ?, ?)`
	_, err := a.db.Exec(insertSQL, sessionType, duration, time.Now())
	if err != nil {
		fmt.Printf("Failed to save session to database: %v\n", err)
	}
	fmt.Printf("Sessão salva: type=%s, duration=%d\n", sessionType, duration)
}

func (a *App) GetSessionLogs() []SessionLog {
	rows, err := a.db.Query("SELECT id, type, duration, created_at FROM session_logs ORDER BY created_at DESC")
	if err != nil {
		fmt.Printf("Failed to get session logs: %v\n", err)
		return nil
	}
	defer rows.Close()

	var sessions []SessionLog
	for rows.Next() {
		var session SessionLog
		if err := rows.Scan(&session.ID, &session.Type, &session.Duration, &session.CreatedAt); err != nil {
			fmt.Printf("Failed to scan session log: %v\n", err)
			continue
		}
		sessions = append(sessions, session)
	}
	return sessions
}

func (a *App) Ping() string {
	return "Pong!"
}
