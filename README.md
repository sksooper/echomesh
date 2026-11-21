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
| GET | `/health` | stan API i bazy (wersje PostGIS / pgRouting) — publiczny |
| POST | `/auth/register` | rejestracja konta mieszkańca, zwraca `{ token, user }` — publiczny |
| POST | `/auth/login` | logowanie, zwraca `{ token, user }` — publiczny |
| GET | `/auth/me` | zalogowany użytkownik (przywracanie sesji) |
| GET | `/sensors` | lista czujników z ostatnim odczytem i flagą `stale` |
| GET | `/sensors/:id` | szczegóły jednego czujnika |
| POST | `/measurements` | nowy pomiar `{ "sensorId": 1, "dbLevel": 72.5 }` (publiczny) |
| GET | `/measurements?sensorId=1&hours=24` | historia odczytów czujnika |
| GET | `/alerts?hours=24&minDb=75&sensorId=2&limit=50` | strumień alertów (wszystkie filtry opcjonalne) |
| GET | `/city-events?scope=current` | wydarzenia miejskie: `current` (trwające + zaplanowane), `active`, `all` |
| GET | `/city-events/:id` | jedno wydarzenie |
| POST | `/city-events` | nowe wydarzenie `{ title, startTime, endTime, lat, lng }` — **admin** |
| PATCH | `/city-events/:id` | zmiana wybranych pól (`lat` i `lng` razem) — **admin** |
| DELETE | `/city-events/:id` | usunięcie wydarzenia (204) — **admin** |

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

## Mapa i model hałasu (frontend)
- Mapa: Leaflet + kafelki OpenStreetMap (© autorzy OpenStreetMap, ODbL). Znaczniki czujników mają kolor wg poziomu dB i pulsują, gdy odczyt jest świeży; szary = brak odczytu lub starszy niż 60 min.
- Kliknięcie czujnika na mapie lub na liście zaznacza go po obu stronach i przesuwa mapę.
- Mapa termiczna: obraz rysowany na `<canvas>` z modelu IDW — `idw = Σ(dB/d²) / Σ(1/d²)` — zmieszanego z tłem 50 dB; wpływ czujnika wygasa płynnie do 1500 m (`lib/noise-model.ts`, `lib/heatmap.ts`).
- Warstwy (czujniki / mapa termiczna) można wyłączać w prawym górnym rogu mapy; legenda jest w lewym dolnym rogu.

## Wydarzenia miejskie (CityEvents)
- Strefa wydarzenia to koło o promieniu `EVENT_RADIUS_M` (domyślnie 300 m) wokół punktu. Na mapie: trwające = fioletowa pełna linia, zaplanowane = szara przerywana.
- Alert z pomiaru dostaje dopisek „(w pobliżu trwa wydarzenie: …)”, gdy czujnik leży w strefie trwającego wydarzenia (`CityEventsService.findActiveNear`, odległość w metrach przez `::geography`).
- Model hałasu dolicza do +20 dB w środku strefy trwającego wydarzenia (malejąco do 1,5 × promienia).
- Przykład (PowerShell):
```powershell
$e = '{"title":"Koncert testowy","startTime":"2026-11-20T18:00:00Z","endTime":"2026-11-20T22:00:00Z","lat":51.1100,"lng":17.0322}'
Invoke-RestMethod -Method Post -Uri http://localhost:3000/city-events -ContentType application/json -Body $e
```
- Zapis, edycja i usuwanie wydarzeń: tylko rola `admin`.

## Uwierzytelnianie i role
- Rejestracja tworzy konto **mieszkańca**; hasło jest skracane algorytmem scrypt (losowa sól). Logowanie zwraca token JWT (HS256, domyślnie 8 h), który frontend wysyła w `Authorization: Bearer <token>`.
- Globalne strażniki: `AuthGuard` (token → użytkownik z bazy, przy każdym żądaniu) i `RolesGuard`. **Każdy endpoint wymaga logowania**, chyba że ma `@Public()`: `/health`, `/auth/register`, `/auth/login` i `POST /measurements` (symulator nie ma konta).
- Role dziedziczą uprawnienia: `admin` ⊃ `analyst` ⊃ `resident`. `@Roles('admin')` wpuszcza tylko administratora, `@Roles('analyst')` — analityka i administratora. Brak tokenu = 401, zbyt niska rola = 403.
- Konta demonstracyjne (gdy `SEED_DEMO_USERS=true`):

| Rola | E-mail | Hasło |
|---|---|---|
| Mieszkaniec | `mieszkaniec@echomesh.test` | `Mieszkaniec123!` |
| Analityk | `analityk@echomesh.test` | `Analityk123!` |
| Administrator | `admin@echomesh.test` | `Admin123!` |

- Zmienne `.env`: `JWT_SECRET` (w produkcji długi, losowy ciąg), `JWT_EXPIRES_IN_SECONDS`, `SEED_DEMO_USERS`. Po zmianie: `docker compose up -d --force-recreate backend`.
- Nadanie roli ręcznie (do czasu panelu administratora): `docker compose exec db psql -U echomesh -d echomesh -c "UPDATE users SET role='analyst' WHERE email='jan@example.com'"`.
- Symulator nadal działa bez logowania (`POST /measurements` jest publiczny).
