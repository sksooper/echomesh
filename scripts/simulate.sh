#!/usr/bin/env bash
# Symulator strumienia danych: cyklicznie wysyła pomiary do POST /measurements.
# Użycie: bash scripts/simulate.sh            (domyślnie czujniki 1-5, co 2 s)
#         SENSORS="1 3" INTERVAL=5 bash scripts/simulate.sh
API="${API:-http://localhost:3000}"
SENSORS="${SENSORS:-1 2 3 4 5}"
INTERVAL="${INTERVAL:-2}"

echo "Symulator -> $API (Ctrl+C aby zatrzymać)"
while true; do
  for id in $SENSORS; do
    # zwykły poziom 45-80 dB; co ~10. pomiar skok 80-95 dB (przekroczenie progu)
    db=$(LC_ALL=C awk -v s="$RANDOM" 'BEGIN { srand(s); printf "%.1f", 45 + rand() * 35 }')
    if [ $((RANDOM % 10)) -eq 0 ]; then
      db=$(LC_ALL=C awk -v s="$RANDOM" 'BEGIN { srand(s); printf "%.1f", 80 + rand() * 15 }')
    fi
    curl -s -o /dev/null -w "czujnik $id -> $db dB (HTTP %{http_code})\n" \
      -X POST "$API/measurements" \
      -H 'Content-Type: application/json' \
      -d "{\"sensorId\":$id,\"dbLevel\":$db}"
  done
  sleep "$INTERVAL"
done
