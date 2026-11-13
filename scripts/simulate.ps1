# Symulator strumienia danych: cyklicznie wysyła pomiary do POST /measurements.
# Użycie: .\scripts\simulate.ps1                       (domyślnie czujniki 1-5, co 2 s)
#         .\scripts\simulate.ps1 -Sensors 1,3 -Interval 5
param(
  [string]$Api = "http://localhost:3000",
  [int[]]$Sensors = 1..5,
  [int]$Interval = 2
)

Write-Host "Symulator -> $Api (Ctrl+C aby zatrzymać)"
while ($true) {
  foreach ($id in $Sensors) {
    # zwykły poziom 45-80 dB; co ~10. pomiar skok 80-95 dB (przekroczenie progu)
    $db = [math]::Round(45 + (Get-Random -Maximum 3500) / 100, 1)
    if ((Get-Random -Maximum 10) -eq 0) { $db = [math]::Round(80 + (Get-Random -Maximum 1500) / 100, 1) }
    $body = @{ sensorId = $id; dbLevel = $db } | ConvertTo-Json -Compress
    try {
      Invoke-RestMethod -Method Post -Uri "$Api/measurements" -ContentType "application/json" -Body $body | Out-Null
      Write-Host "czujnik $id -> $db dB (OK)"
    } catch {
      Write-Host "czujnik $id -> błąd: $($_.Exception.Message)" -ForegroundColor Red
    }
  }
  Start-Sleep -Seconds $Interval
}
