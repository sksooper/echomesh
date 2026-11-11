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
