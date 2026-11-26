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
| POST | `/chat/report` | zgłoszenie hałasu `{ message, lat, lng }` — analiza, weryfikacja z wydarzeniami, odpowiedź chatbota |
| GET | `/chat/reports/mine` | własne zgłoszenia użytkownika ze statusami |
| GET | `/chat/reports?review=pending` | kolejka moderacji (z treścią zgłoszeń) — **analityk** |
| POST | `/routes/walk` | najkrótsza trasa piesza `{ from: { lat, lng }, to: { lat, lng } }` → `{ coordinates, distanceM, durationMin }` |
| PATCH | `/chat/reports/:id/review` | `{ decision: "approved" \| "rejected" }` — **analityk**; zatwierdzenie tworzy alert na mapie |
| GET | `/sensors` | lista czujników z ostatnim odczytem i flagą `stale` |
| GET | `/sensors/:id` | szczegóły jednego czujnika |
| POST | `/measurements` | nowy pomiar `{ "sensorId": 1, "dbLevel": 72.5 }` (publiczny) |
| GET | `/measurements?sensorId=1&hours=24` | historia odczytów czujnika |
| GET | `/alerts?hours=24&minDb=75&sensorId=2&source=report&limit=50` | strumień alertów (filtry opcjonalne; `source`: `measurement` / `report`) |
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

## Zgłoszenia hałasu (chatbot)
- Zalogowany użytkownik klika **„Zgłoś hałas”** (lewy górny róg mapy), opisuje hałas i **wskazuje miejsce na mapie** (kliknięcie albo przeciągnięcie znacznika-rombu).
- Backend analizuje treść regułami (`chatbot/analysis.ts`, słowa kluczowe PL/EN/UA): czy to hałas, jaki typ (muzyka, remont, ruch, alarm, petardy, głosy, zwierzęta), czy na zewnątrz / w budynku, kiedy (np. „wczoraj o 22”), czy zgłoszenie jest wiarygodne (np. nie dotyczy przyszłości, nie jest „testem”), oraz dobiera 2–3 porady.
- Weryfikacja z harmonogramem wydarzeń (`ChatbotService.verify`): najpierw **po lokalizacji** (trwające wydarzenie w promieniu `EVENT_RADIUS_M`), potem **po nazwie z treści** (`chatbot/event-matcher.ts`). Wynik zapisany w `chat_reports.status`:

| Status | Znaczenie | Moderacja (`review_status`) |
|---|---|---|
| `planned` | hałas zaplanowany (wydarzenie), zgłoszenie odrzucone automatycznie | `none` |
| `needs_info` | treść nie opisuje hałasu lub jest niewiarygodna — prośba o doprecyzowanie | `none` |
| `incident` | prawdziwy incydent, czeka na analityka | `pending` |

- Limit zgłoszeń: `CHAT_MAX_REPORTS_PER_HOUR` (domyślnie 10 na użytkownika; po przekroczeniu 429).
- Pole `chat_reports.analysis` (JSONB) przechowuje szczegóły analizy (typ hałasu, miejsce, uwagi, `usedLlm`).

### LLM (analiza zgłoszeń)
- Gdy ustawiony jest `LLM_API_KEY`, treść analizuje model językowy (API zgodne z OpenAI, domyślnie Groq: `LLM_BASE_URL`, `LLM_MODEL`, `LLM_TIMEOUT_MS`). **Jedno zapytanie na zgłoszenie**, krótki angielski prompt, pamięć podręczna 10 min.
- Model zwraca JSON: czy to hałas, wiarygodność, nazwa wydarzenia (z listy trwających), typ, miejsce, czas, porady. Odpowiedź jest **walidowana** (nieznane pola i wartości są odrzucane); treść zgłoszenia trafia do promptu jako dane w znaczniku `<report>`, a nie jako polecenia.
- Bez klucza, przy timeoucie, błędzie HTTP lub niepoprawnej odpowiedzi chatbot **sam przechodzi na reguły** (tryb awaryjny) — zgłoszenia działają zawsze. Po zmianie `.env`: `docker compose up -d --force-recreate backend`.

### Moderacja i alerty ze zgłoszeń
- Zgłoszenia `incident` trafiają do kolejki (zakładka **Moderacja** dla analityka i administratora). **Zatwierdzenie** w jednej transakcji ustawia `review_status = approved` i tworzy alert `source = report` — widoczny dla wszystkich jako marker na mapie i w strumieniu zdarzeń, **bez treści zgłoszenia** (prywatność). **Odrzucenie** tylko zmienia status.
- Mieszkaniec widzi stan swoich zgłoszeń w zakładce **Zgłoszenia** (zaplanowane / do doprecyzowania / czeka / zatwierdzone / odrzucone).

### Głos
- W oknie czatu przycisk **„Mów zamiast pisać”** (rozpoznawanie mowy, Web Speech API, `pl-PL`) i opcja **„Czytaj odpowiedzi”** (synteza mowy). Działa w przeglądarkach z obsługą Web Speech API (Chrome / Edge / Safari); w pozostałych przycisk jest ukryty.

## Trasy piesze (część 1: najkrótsza trasa)
- **Import dróg z OpenStreetMap** (jednorazowo, wymaga internetu w kontenerze): `docker compose exec backend npm run import:osm`. Skrypt pobiera przez Overpass API drogi i ścieżki dostępne dla pieszych z obszaru `OSM_BBOX` (domyślnie centrum Wrocławia), buduje graf (`road_vertices` = węzły OSM, `road_edges` = odcinki między sąsiednimi węzłami) i zapisuje go w jednej transakcji; ponowne uruchomienie zastępuje dane. Tabele powstają w skrypcie (`IF NOT EXISTS`), więc nie trzeba kasować bazy.
- **`POST /routes/walk`**: punkt jest „przyciągany” do najbliższego wierzchołka grafu (indeks GIST, operator `<->`; dalej niż 500 m od drogi → 400), potem `pgr_dijkstra` (pgRouting) liczy najkrótszą trasę po nieskierowanym grafie. Do algorytmu trafiają tylko krawędzie z prostokąta wokół startu i celu, więc zapytanie nie ładuje całej sieci. Czas = dystans przy 5 km/h. Brak zaimportowanych dróg → 503, brak połączenia punktów → 404.
- Na froncie: zakładka **Trasa** — punkty A i B wskazuje się kliknięciem na mapie, wynik (dystans, czas) widać w panelu, a niebieska linia na mapie.
- Ograniczenia v1: trasa jest najkrótsza (hałas w kosztach dojdzie w kolejnej sesji), tylko pieszo; punkt przyciągany jest do węzła, a nie do dowolnego miejsca na odcinku.

## Testy jednostkowe (backend)
- `docker compose exec backend npm test` — wbudowany runner `node:test`, bez dodatkowych zależności. Obejmuje czyste moduły: hasła, JWT, role, analizę zgłoszeń, dopasowanie wydarzeń, walidację odpowiedzi LLM, graf dróg i zapytanie Overpass (pliki `*.test.ts` obok kodu).
