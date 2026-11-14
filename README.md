# EchoMesh

Chmurowa platforma do inteligentnego monitoringu hałasu miejskiego i zdarzeń akustycznych (Wrocław).

Projekt studencki budowany od zera, krok po kroku — każda zmiana ma osobny commit.

**Status:** wersja v1 (MVP) w budowie.

## Stack
- Frontend: React + Vite + TypeScript + Tailwind CSS
- Backend: NestJS (TypeScript), sterownik `pg`
- Baza: PostgreSQL 16 + PostGIS + pgRouting
- Infrastruktura: Docker Compose

## Uruchomienie
```bash
cp .env.example .env
docker compose up --build
```
- Aplikacja: http://localhost:5173 (karta „Stan systemu”)
- API: http://localhost:3000/health

## Przydatne komendy
| Sytuacja | Komenda |
|---|---|
| Start w tle | `docker compose up -d` |
| Zmiana zależności (`package.json`) | `docker compose up -d --build -V` |
| Zmiana `.env` | `docker compose up -d --force-recreate backend` |
| Logi | `docker compose logs -f backend` |
| Reset bazy do danych demo | `docker compose down -v` (kasuje wolumen!) |

Skrypt `db/init.sql` wykonuje się tylko na pustym wolumenie — po jego zmianie potrzebny jest `down -v`.

## API (stan na v1, sesja 2)
| Metoda | Ścieżka | Opis |
|---|---|---|
| GET | `/health` | stan API i bazy (wersje PostGIS / pgRouting) |
| GET | `/sensors` | lista czujników z ostatnim odczytem i flagą `stale` |
| GET | `/sensors/:id` | szczegóły jednego czujnika |
| POST | `/measurements` | nowy pomiar `{ "sensorId": 1, "dbLevel": 72.5 }` (publiczny) |
| GET | `/measurements?sensorId=1&hours=24` | historia odczytów czujnika |
| GET | `/alerts?hours=24&minDb=75&sensorId=2&limit=50` | strumień alertów (wszystkie filtry opcjonalne) |

Walidacja: `sensorId` ≥ 1 (czujnik musi istnieć i być aktywny), `dbLevel` w zakresie 0–200.

## Alerty
- Pomiar >= `ALERT_THRESHOLD_DB` (domyślnie 75 dB) tworzy alert (`alertCreated: true` w odpowiedzi `POST /measurements`).
- Ochrona przed zalewem: maksymalnie jeden alert na czujnik w ciągu `ALERT_COOLDOWN_SECONDS` (domyślnie 60 s).
- Ważność: >= 85 dB krytyczny, w przeciwnym razie ostrzeżenie (liczona na froncie).

## Symulator strumienia danych
```powershell
.\scripts\simulate.ps1                        # Windows PowerShell, czujniki 1-5 co 2 s
.\scripts\simulate.ps1 -Sensors 1,3 -Interval 5
```
```bash
bash scripts/simulate.sh                      # Linux / macOS / Git Bash
SENSORS="1 3" INTERVAL=5 bash scripts/simulate.sh
```
Karty czujników na stronie głównej odświeżają się co 5 s. Odczyt starszy niż 60 min jest szary (nieaktualny).
