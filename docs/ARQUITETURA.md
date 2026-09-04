# Arquitetura do pomo_vero — Comunicação Backend-Frontend

## 1. Visão geral

**pomo_vero** é um aplicativo desktop de timer Pomodoro construído com o framework **Wails v2**. Diferente de Electron ou Tauri, o Wails embute uma interface web (HTML/JS/CSS) dentro de uma janela nativa controlada por um binário Go. O frontend roda em uma WebView do sistema (WebKit no macOS, Edge/WebView2 no Windows) e o backend é o próprio processo Go.

```
┌──────────────────────────────────────────────────┐
│  Janela Nativa (macOS/Windows)                   │
│  ┌────────────────────────────────────────────┐  │
│  │  WebView (WebKit / Edge WebView2)          │  │
│  │  ┌──────────────────────────────────────┐  │  │
│  │  │  Frontend (React + TypeScript)       │  │  │
│  │  │                                      │  │  │
│  │  │  App.tsx → TimerCard, Insights,      │  │  │
│  │  │  RecentSessions, SettingsView        │  │  │
│  │  │                                      │  │  │
│  │  │  usePomodoro.ts (hook central)       │  │  │
│  │  └──────────────┬───────────────────────┘  │  │
│  │                 │ IPC (RPC + Eventos)       │  │
│  │  ┌──────────────▼───────────────────────┐  │  │
│  │  │  Wails Bridge (auto-gerado)          │  │  │
│  │  │  wailsjs/go/main/App.js    (RPC)     │  │  │
│  │  │  wailsjs/runtime/runtime.js (Eventos)│  │  │
│  │  └──────────────┬───────────────────────┘  │  │
│  └─────────────────┼──────────────────────────┘  │
│                    │                              │
│  ┌─────────────────▼──────────────────────────┐  │
│  │  Backend (Go)                              │  │
│  │  app.go → timer, SQLite, settings, logs    │  │
│  │  main.go → bootstrap Wails                 │  │
│  └────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────┘
```

### Stack tecnológico

| Camada | Tecnologia |
|--------|-----------|
| Backend | Go 1.25 + Wails v2.13.0 + SQLite (go-sqlite3) |
| Frontend | React 18 + TypeScript + Vite 7 + Tailwind CSS v4 |
| IPC | Wails Bindings (RPC) + Wails Events (pub/sub) |
| Persistência | SQLite3 (`session_logs.db`) |
| Som | Web Audio API (frontend) |
| Notificações | Notification API do navegador (frontend) |

---

## 2. Inicialização do aplicativo

O fluxo de inicialização acontece em 3 estágios:

### 2.1. Bootstrap Go (`main.go:14-31`)

1. Cria instância de `App` via `NewApp()`
2. Chama `wails.Run()` com as opções:
   - **Title**: `"pomo_vero"`
   - **Tamanho**: 1024 x 768 px
   - **AssetServer**: aponta para o frontend compilado (`frontend/dist`), embutido no binário via `//go:embed`
   - **BackgroundColour**: `#1B2636` (azul escuro)
   - **OnStartup**: callback `app.startup` — executado quando a janela está pronta
   - **Bind**: registra o struct `App` para expor seus métodos ao frontend

### 2.2. Startup do backend (`app.go:46-50`)

Quando `OnStartup` dispara, o Go executa:

1. **`initDatabase()`** — abre/cria o arquivo `session_logs.db` com a tabela `session_logs`
2. **`initSettings()`** — cria tabela `settings` com valores padrão (foco: 1500s, pausa curta: 300s, pausa longa: 900s, sons ativados). Aplica migrações para bases existentes

### 2.3. Inicialização do frontend (`main.tsx:6-12`)

A WebView carrega `index.html` → `main.tsx` → renderiza `<App />` dentro de `React.StrictMode`. O componente `App` chama `usePomodoro()`, que dispara a primeira comunicação com o backend (ver seção 3).

---

## 3. Canais de comunicação

A comunicação entre frontend e backend usa **dois mecanismos distintos** do Wails:

### 3.1. Canal RPC: Frontend → Backend (chamadas de função)

O frontend chama métodos Go como se fossem funções JavaScript assíncronas que retornam Promises.

**Como funciona tecnicamente:**

O Wails gera automaticamente arquivos de bridge em `frontend/wailsjs/go/main/`:

- **`App.js`** — wrappers JavaScript que chamam `window['go']['main']['App']['NomeDoMetodo'](...)`
- **`App.d.ts`** — declarações TypeScript com tipos corretos
- **`models.ts`** — classes TypeScript equivalentes aos structs Go (com serialização JSON automática)

Quando o frontend chama `StartTimer(1500, 'focus')`, o fluxo é:

```
React (TypeScript)
  → App.js: window['go']['main']['App']['StartTimer'](1500, 'focus')
    → Wails Runtime IPC
      → app.go: func (a *App) StartTimer(durationSeconds int, sessionType string)
```

Os parâmetros são serializados como JSON pelo Wails runtime. O retorno (se houver) também é desserializado automaticamente.

### 3.2. Canal de Eventos: Backend → Frontend (pub/sub)

O backend Go emite eventos em tempo real que o frontend escuta.

**Como funciona tecnicamente:**

- **Go emite**: `runtime.EventsEmit(a.ctx, "nome_do_evento", dados...)`
- **Frontend escuta**: `EventsOn('nome_do_evento', callback)` do módulo `wailsjs/runtime/runtime.js`

O runtime.js por sua vez chama `window.runtime.EventsOnMultiple()`, que é injetado pela WebView nativa e conecta ao listener Go.

---

## 4. Momentos de comunicação: o ciclo completo

Abaixo, cada interação entre frontend e backend documentada com o gatilho, o fluxo de dados e os arquivos envolvidos.

---

### Momento 1: Carregamento inicial — busca de configurações

**Gatilho:** `useEffect` de montagem no hook `usePomodoro()` (`usePomodoro.ts:41`)

**Fluxo:**

```
Frontend                     Backend
───────                     ───────
usePomodoro mount
  │
  ├─ GetSettings() ────────► GetSettings() [app.go:122]
  │                          │
  │                          ├─ SQL: SELECT ... FROM settings LIMIT 1
  │                          │
  │                          └─ retorna struct Settings
  │◄─────── Promise<Settings> ──────┘
  │
  ├─ Atualiza todos os useState com valores do banco
  ├─ Atualiza refs (durationsRef, modeRef, activeRef, soundRef)
  └─ Seta timeLeft = durationsRef[modeRef.current]
```

**Dados trafegados:**

```json
{
  "focusDuration": 1500,
  "breakDuration": 300,
  "longBreakDuration": 900,
  "startSoundEnabled": true,
  "alarmSoundEnabled": true
}
```

**Ao mesmo tempo,** o hook registra os listeners de evento:

```typescript
EventsOn('timer_tick', callback)     // ← ouvindo ticks do timer
EventsOn('timer_finished', callback) // ← ouvindo fim de sessão
```

---

### Momento 2: Início de um timer (usuário clica Play)

**Gatilho:** Clique no botão Play em `TimerCard.tsx:65` → `App.tsx:75` chama `startTimer(currentMode)`

**Fluxo detalhado:**

```
App.tsx                    usePomodoro.ts              Backend Go
──────                     ─────────────               ──────────
onStart() ───────────────► startTimer(mode)
                           │
                           ├─ Se startSoundEnabled:
                           │    playStartSound()        ← Web Audio API (local)
                           │    (2 tons: 660Hz + 880Hz)
                           │
                           ├─ setIsActive(true)
                           ├─ setCurrentMode(mode)
                           ├─ setTimeLeft(duration)
                           │
                           └─ StartTimer(dur, type) ──► StartTimer() [app.go:147]
                                                        │
                                                        ├─ Se já ativo: chama StopTimer()
                                                        ├─ Se modo "focus":
                                                        │    runtime.WindowMinimise(ctx)
                                                        │    (minimiza a janela imediatamente)
                                                        ├─ isTimerActive = true
                                                        │
                                                        └─ Goroutine inicia:
                                                           ticker a cada 1 segundo
```

**Comportamento da janela no modo foco:** A janela é minimizada automaticamente para evitar distrações (`app.go:156`).

---

### Momento 3: Ticks do timer (a cada 1 segundo)

Este é o **fluxo contínuo mais frequente**. Enquanto o timer está ativo, o backend emite eventos a cada 1 segundo.

**Gatilho:** Goroutine com `time.NewTicker(1 * time.Second)` (`app.go:160`)

**Fluxo:**

```
Backend Go (app.go:165-181)           Frontend (usePomodoro.ts:58-59)
──────────────                        ────────────
for {
  select {
  case <-ticker.C:
    remaining--
    runtime.EventsEmit(ctx,           EventsOn('timer_tick', (remaining) => {
      "timer_tick", remaining)          setTimeLeft(remaining)
      │                                })
      │                                   │
      └───────────────────────────────────┘
            (evento IPC a cada 1s)       Atualiza o estado React
                                         TimerCard re-renderiza:
                                           - Círculo SVG avança
                                           - Tempo MM:SS atualiza
  }
}
```

**Dado trafegado:** um único `int` (segundos restantes).

**O frontend NÃO faz polling.** O backend empurra cada tick proativamente via evento.

---

### Momento 4: Timer chega a zero — fim de sessão

**Gatilho:** `remaining <= 0` dentro da goroutine (`app.go:174`)

**Fluxo completo:**

```
Backend Go                               Frontend
──────────                               ────────
remaining <= 0
  │
  ├─ onSessionComplete(type, duration) [app.go:191]
  │   │
  │   ├─ saveSessionToDatabase() [app.go:200]
  │   │   └─ SQL: INSERT INTO session_logs(type, duration, created_at)
  │   │
  │   ├─ runtime.WindowUnminimise(ctx)       (restaura a janela)
  │   ├─ runtime.WindowShow(ctx)             (mostra a janela)
  │   │
  │   └─ runtime.EventsEmit(ctx,             EventsOn('timer_finished', (type) => {
  │       "timer_finished", type)  ────────►   setIsActive(false)
  │                                             │
  │                                             ├─ Se alarmSoundEnabled:
  │                                             │    playAlarmSound()
  │                                             │    (2 rounds, 880Hz square + 1760Hz sine)
  │                                             │
  │                                             ├─ Decide próximo modo:
  │                                             │   focus → short, break → focus
  │                                             │
  │                                             ├─ setCurrentMode(nextMode)
  │                                             ├─ setTimeLeft(duração do próximo modo)
  │                                             │
  │                                             └─ new Notification(...)
  │                                                  "Hora de descansar!" / "De volta ao trabalho!"
  │                                            })
```

**Dado trafegado:** string `"focus"` ou `"break"` indicando o tipo da sessão concluída.

---

### Momento 5: Usuário pausa o timer

**Gatilho:** Clique no botão Pause em `TimerCard.tsx:67` → `App.tsx:76` chama `stopTimer()`

**Fluxo:**

```
usePomodoro.ts                      Backend Go
─────────────                       ──────────
stopTimer()
  ├─ setIsActive(false)
  └─ StopTimer() ─────────────────► StopTimer() [app.go:184]
                                    │
                                    ├─ close(a.timerCancel)
                                    │   └─ Goroutine recebe <-a.timerCancel
                                    │     └─ return (encerra o ticker)
                                    │
                                    └─ isTimerActive = false
```

**Nenhum dado retorna.** É uma chamada fire-and-forget. O canal `timerCancel` é fechado, o que faz a goroutine sair do `select` e retornar.

---

### Momento 6: Usuário reseta o timer

**Gatilho:** Clique no botão Reset em `TimerCard.tsx:59` → `App.tsx:77` chama `resetTimer()`

**Fluxo:**

```
usePomodoro.ts
─────────────
resetTimer()
  ├─ stopTimer()  → mesmo fluxo do Momento 5 (pausa o backend)
  └─ setTimeLeft(durationsRef.current[modeRef.current])
     (reseta o display local para o valor cheio)
```

---

### Momento 7: Troca de modo (Foco / Pausa curta / Pausa longa)

**Gatilho:** Clique em um dos botões de modo em `App.tsx:58-68` → `selectMode(mode)`

**Fluxo:**

```
usePomodoro.ts
─────────────
selectMode(mode)
  ├─ stopTimer()            → pausa o backend (Momento 5)
  ├─ setCurrentMode(mode)
  └─ setTimeLeft(durationsRef.current[mode])
     (atualiza para a duração do novo modo)
```

---

### Momento 8: Abertura e salvamento de configurações

**Gatilho:** Clique no ícone de engrenagem (`App.tsx:50`) → modal `SettingsView` → botão Salvar (`SettingsView.tsx:107`)

**Fluxo de salvamento:**

```
SettingsView.tsx                    usePomodoro.ts              Backend Go
─────────────                       ─────────────               ──────────
onSave(focus,break,...) ──────────► updateSettings(...)
                                    │
                                    ├─ SaveSettings(...) ──────► SaveSettings() [app.go:136]
                                    │                            │
                                    │                            └─ SQL: UPDATE settings SET ...
                                    │◄─────── Promise<void> ──────┘
                                    │
                                    ├─ Atualiza todos os useState
                                    ├─ Atualiza durationsRef
                                    ├─ Atualiza soundRefs
                                    │
                                    └─ Se timer não está ativo:
                                         setTimeLeft(novo valor)
```

**Dados trafegados (ida):**

```
SaveSettings(
  1500,   // focusDuration em segundos
  300,    // breakDuration em segundos
  900,    // longBreakDuration em segundos
  true,   // startSoundEnabled
  true    // alarmSoundEnabled
)
```

---

### Momento 9: Carregamento das sessões (Insights e Recentes)

**Gatilho:** Montagem dos componentes `InsightsView` e `RecentSessions` (dentro de `App.tsx:80-82`)

**Fluxo:**

```
InsightsView.tsx / RecentSessions.tsx       Backend Go
──────────────────────────────────          ──────────
useEffect mount
  │
  └─ GetSessionLogs() ────────────────────► GetSessionLogs() [app.go:209]
                                             │
                                             └─ SQL: SELECT * FROM session_logs
                                                  ORDER BY created_at DESC
                                             │
                                             └─ Retorna []SessionLog
◄────────────────── Promise<SessionLog[]>
  │
  ├─ InsightsView:
  │   ├─ Filtra últimos 7 dias
  │   ├─ Calcula total de foco, contagem de sessões
  │   ├─ Calcula delta vs semana anterior
  │   └─ Renderiza gráfico de barras + cards de estatísticas
  │
  └─ RecentSessions:
      ├─ Pega 4 sessões mais recentes
      ├─ Formata data (Hoje/Ontem/DD/MM)
      └─ Renderiza lista de cards
```

**Dado trafegado (retorno):**

```json
[
  {
    "id": 42,
    "type": "focus",
    "duration": 1500,
    "created_at": "2026-07-17T10:30:00Z"
  },
  ...
]
```

---

## 5. Resumo dos fluxos de comunicação

| Momento | Direção | Canal | Método/Evento | Frequência |
|---------|---------|-------|---------------|------------|
| App inicia | FE → BE | RPC | `GetSettings()` | 1 vez |
| App inicia | BE → FE | Evento | `timer_tick` (registro) | 1 vez |
| App inicia | BE → FE | Evento | `timer_finished` (registro) | 1 vez |
| Play pressionado | FE → BE | RPC | `StartTimer(dur, type)` | Sob demanda |
| Play pressionado | BE → Janela | Nativo | `WindowMinimise()` (se focus) | Sob demanda |
| Timer rodando | BE → FE | Evento | `timer_tick` ← `EventsEmit` | **1 vez/segundo** |
| Timer chega a 0 | BE → FE | Evento | `timer_finished` ← `EventsEmit` | Ao fim da sessão |
| Timer chega a 0 | BE → SQLite | Local | `INSERT session_logs` | Ao fim da sessão |
| Timer chega a 0 | BE → Janela | Nativo | `WindowUnminimise()` + `WindowShow()` | Ao fim da sessão |
| Pause pressionado | FE → BE | RPC | `StopTimer()` | Sob demanda |
| Reset pressionado | FE → BE | RPC | `StopTimer()` | Sob demanda |
| Modo alterado | FE → BE | RPC | `StopTimer()` | Sob demanda |
| Config salva | FE → BE | RPC | `SaveSettings(...)` | Sob demanda |
| Insights carrega | FE → BE | RPC | `GetSessionLogs()` | 1 vez + quando reabre |
| Sessões recentes | FE → BE | RPC | `GetSessionLogs()` | 1 vez + quando reabre |

---

## 6. Detalhes da persistência (SQLite)

### Tabela `session_logs`

| Coluna | Tipo | Descrição |
|--------|------|-----------|
| `id` | INTEGER PK | Auto-incremento |
| `type` | TEXT | `"focus"` ou `"break"` |
| `duration` | INTEGER | Duração em segundos |
| `created_at` | DATETIME | Timestamp de criação |

### Tabela `settings`

| Coluna | Tipo | Padrão | Descrição |
|--------|------|--------|-----------|
| `id` | INTEGER PK | — | Sempre 1 (single-row) |
| `focus_duration` | INTEGER | 1500 | Foco em segundos (25 min) |
| `break_duration` | INTEGER | 300 | Pausa curta em segundos (5 min) |
| `long_break_duration` | INTEGER | 900 | Pausa longa em segundos (15 min) |
| `start_sound_enabled` | INTEGER | 1 | Som ao iniciar (bool) |
| `alarm_sound_enabled` | INTEGER | 1 | Alarme ao finalizar (bool) |

O banco é criado no diretório de trabalho do aplicativo como `./session_logs.db`. Como é um arquivo local, **não há rede envolvida** — todas as operações são I/O de disco.

---

## 7. Sistema de som

O som é gerado **inteiramente no frontend** via Web Audio API (`sounds.ts`). O backend não tem envolvimento com áudio.

- **Som de início** (`playStartSound`): dois tons suaves (660Hz → 880Hz, senoidal)
- **Alarme** (`playAlarmSound`): 2 rounds de 3 bipes cada (880Hz quadrada + 1760Hz senoidal)

O AudioContext é criado sob demanda e reativado se estiver suspenso. O toggle de som (configuração) apenas controla se as funções são chamadas — o som em si é sempre local ao frontend.

---

## 8. Glossário de arquivos relevantes

| Arquivo | Papel |
|---------|-------|
| `main.go` | Bootstrap do Wails, bind do `App`, configuração da janela |
| `app.go` | Lógica de negócio: timer (goroutine), SQLite, configurações |
| `frontend/src/main.tsx` | Entrada React, renderiza `<App />` |
| `frontend/src/App.tsx` | Layout principal, orquestra todos os componentes |
| `frontend/src/usePomodoro.ts` | **Hook central**: estado, IPC, eventos, sons |
| `frontend/src/TimerCard.tsx` | UI do timer circular (SVG) |
| `frontend/src/InsightsView.tsx` | Gráfico de foco semanal |
| `frontend/src/RecentSessions.tsx` | Lista de últimas sessões |
| `frontend/src/SettingsView.tsx` | Modal de configurações |
| `frontend/src/sounds.ts` | Web Audio API para bipes e alarmes |
| `frontend/wailsjs/go/main/App.js` | Bridge JS auto-gerada → `window['go']...` |
| `frontend/wailsjs/go/main/App.d.ts` | Tipos TS dos métodos Go |
| `frontend/wailsjs/go/models.ts` | Modelos TS espelhando structs Go |
| `frontend/wailsjs/runtime/runtime.js` | Runtime Wails: `EventsOn`, `WindowMinimise`, etc. |
| `wails.json` | Configuração do projeto Wails |
| `session_logs.db` | Banco SQLite (criado em runtime) |
