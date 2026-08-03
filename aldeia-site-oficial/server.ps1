$port = 3000
$rootFolder = $PSScriptRoot
if ($rootFolder -eq "") { $rootFolder = (Get-Location).Path }

Write-Host "Iniciando Servidor Autoral ALDEIA na porta $port..." -ForegroundColor Cyan

$listener = New-Object System.Net.HttpListener
$listener.Prefixes.Add("http://localhost:$port/")
$listener.Prefixes.Add("http://127.0.0.1:$port/")
$global:ipRequests = @{}
$global:validTokens = @{}
$adminPasswordHash = "0c88ccdb3a0615173fc7cc49491be2a12cae97c7192dadfde3064148e54cc7aa" # SHA-256 of '123aldeia'

$logLoginAttempt = {
    param($ip, $status, $ua)
    try {
        $loginFile = Join-Path $rootFolder "login_audit.json"
        $logs = New-Object System.Collections.Generic.List[Object]
        if (Test-Path $loginFile) {
            $jsonText = [System.IO.File]::ReadAllText($loginFile)
            if ($jsonText -ne "") {
                $parsed = ConvertFrom-Json $jsonText
                if ($parsed -is [Array]) {
                    foreach ($l in $parsed) { $logs.Add($l) }
                } elseif ($parsed -ne $null) {
                    $logs.Add($parsed)
                }
            }
        }
        $newLog = [PSCustomObject]@{
            id        = [guid]::NewGuid().Guid.ToString()
            timestamp = (Get-Date -Format "yyyy-MM-dd HH:mm:ss")
            ip        = $ip
            status    = $status
            userAgent = if ($ua) { $ua } else { "Desconhecido" }
        }
        $logs.Add($newLog)
        if ($logs.Count -gt 1000) {
            $logs = $logs | Select-Object -Last 1000
        }
        $updatedJson = ConvertTo-Json -InputObject $logs -Depth 5
        [System.IO.File]::WriteAllText($loginFile, $updatedJson)
    } catch {}
}

$listener.Start()
Write-Host "Servidor rodando em http://localhost:$port" -ForegroundColor Green

try {
    while ($listener.IsListening) {
        $context = $listener.GetContext()
        try {
            $request = $context.Request
            $response = $context.Response

            # --- SECURITY HEADERS ---
            $response.Headers.Add("X-Content-Type-Options", "nosniff")
            $response.Headers.Add("X-Frame-Options", "DENY")
            $response.Headers.Add("X-XSS-Protection", "1; mode=block")
            $response.Headers.Add("Content-Security-Policy", "default-src 'self' https://fonts.googleapis.com https://fonts.gstatic.com https://api.fontshare.com https://unpkg.com https://cdnjs.cloudflare.com https://cdn.jsdelivr.net; img-src 'self' data: https:; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://api.fontshare.com; script-src 'self' 'unsafe-inline' https://cdnjs.cloudflare.com https://unpkg.com https://cdn.jsdelivr.net;")
            $response.Headers.Add("Cache-Control", "no-cache, no-store, must-revalidate")
            $response.Headers.Add("Pragma", "no-cache")
            $response.Headers.Add("Expires", "0")

            # --- RATE LIMITING ---
            $clientIP = $request.RemoteEndPoint.Address.ToString()
            $now = [DateTime]::UtcNow
            $isLocal = ($clientIP -eq "::1" -or $clientIP -eq "127.0.0.1" -or $clientIP.StartsWith("192.168.") -or $clientIP.StartsWith("fe80::"))
            
            if (-not $isLocal) {
                if (-not $global:ipRequests.ContainsKey($clientIP)) {
                    $global:ipRequests[$clientIP] = @()
                }
                $global:ipRequests[$clientIP] = @($global:ipRequests[$clientIP] | Where-Object { $_ -gt $now.AddSeconds(-60) })
                if ($global:ipRequests[$clientIP].Count -gt 100) {
                    Write-Host "Rate limit excedido para o IP: $clientIP" -ForegroundColor Yellow
                    $response.StatusCode = 429
                    $response.ContentType = "application/json"
                    $responseJson = '{"error":"Too many requests. Please try again later."}'
                    $buffer = [System.Text.Encoding]::UTF8.GetBytes($responseJson)
                    $response.ContentLength64 = $buffer.Length
                    $response.OutputStream.Write($buffer, 0, $buffer.Length)
                    $response.Close()
                    continue
                }
                $global:ipRequests[$clientIP] += $now
            }

            $urlPath = $request.Url.LocalPath.TrimStart('/')
            if ($urlPath -eq "") { $urlPath = "index.html" }

            $verifyToken = {
                param($req)
                $authHeader = $req.Headers.Get("Authorization")
                if ($authHeader -and $authHeader.StartsWith("Bearer ")) {
                    $token = $authHeader.Substring(7).Trim()
                    if ($global:validTokens.ContainsKey($token)) {
                        return $true
                    }
                }
                return $false
            }

            $send401 = {
                param($res)
                $res.StatusCode = 401
                $res.ContentType = "application/json"
                $responseJson = '{"error":"Unauthorized"}'
                $buffer = [System.Text.Encoding]::UTF8.GetBytes($responseJson)
                $res.ContentLength64 = $buffer.Length
                $res.OutputStream.Write($buffer, 0, $buffer.Length)
                $res.Close()
            }

            if ($urlPath -eq "api/content" -and $request.HttpMethod -eq "GET") {
                $contentFile = Join-Path $rootFolder "site_content.json"
                $jsonText = "{}"
                if (Test-Path $contentFile) {
                    $jsonText = [System.IO.File]::ReadAllText($contentFile)
                }
                $buffer = [System.Text.Encoding]::UTF8.GetBytes($jsonText)
                $response.ContentType = "application/json"
                $response.ContentLength64 = $buffer.Length
                $response.OutputStream.Write($buffer, 0, $buffer.Length)
                $response.Close()
                continue
            }
            elseif ($urlPath -eq "api/content" -and $request.HttpMethod -eq "POST") {
                if (-not (&$verifyToken $request)) { &$send401 $response; continue }
                $reader = New-Object System.IO.StreamReader($request.InputStream)
                $body = $reader.ReadToEnd()
                $reader.Close()

                $contentFile = Join-Path $rootFolder "site_content.json"
                [System.IO.File]::WriteAllText($contentFile, $body)

                $responseJson = '{"status":"success","message":"Conteudo atualizado com sucesso"}'
                $buffer = [System.Text.Encoding]::UTF8.GetBytes($responseJson)
                $response.ContentType = "application/json"
                $response.ContentLength64 = $buffer.Length
                $response.OutputStream.Write($buffer, 0, $buffer.Length)
                $response.Close()
                continue
            }
            elseif ($urlPath -eq "api/clients" -and $request.HttpMethod -eq "GET") {
                if (-not (&$verifyToken $request)) { &$send401 $response; continue }
                $clientsFile = Join-Path $rootFolder "clients.json"
                $jsonText = "[]"
                if (Test-Path $clientsFile) {
                    $jsonText = [System.IO.File]::ReadAllText($clientsFile)
                }
                $buffer = [System.Text.Encoding]::UTF8.GetBytes($jsonText)
                $response.ContentType = "application/json"
                $response.ContentLength64 = $buffer.Length
                $response.OutputStream.Write($buffer, 0, $buffer.Length)
                $response.Close()
                continue
            }
            elseif ($urlPath -eq "api/clients" -and $request.HttpMethod -eq "POST") {
                if (-not (&$verifyToken $request)) { &$send401 $response; continue }
                $reader = New-Object System.IO.StreamReader($request.InputStream)
                $body = $reader.ReadToEnd()
                $reader.Close()

                $clientsFile = Join-Path $rootFolder "clients.json"
                $clients = [System.Collections.Generic.List[Object]]@()
                if (Test-Path $clientsFile) {
                    $jsonText = [System.IO.File]::ReadAllText($clientsFile)
                    if ($jsonText -ne "") {
                        $parsed = ConvertFrom-Json $jsonText
                        if ($parsed -is [Array]) {
                            foreach ($c in $parsed) { $clients.Add($c) }
                        } elseif ($parsed -ne $null) {
                            $clients.Add($parsed)
                        }
                    }
                }

                try {
                    $newObj = ConvertFrom-Json $body
                    if ($newObj -is [Array]) {
                        $updatedJson = ConvertTo-Json -InputObject $newObj -Depth 10
                        [System.IO.File]::WriteAllText($clientsFile, $updatedJson)
                    } else {
                        if (-not $newObj.id) {
                            $newObj | Add-Member -MemberType NoteProperty -Name "id" -Value ("c_" + [guid]::NewGuid().Guid.ToString().Substring(0, 8))
                        }
                        if (-not $newObj.createdAt) {
                            $newObj | Add-Member -MemberType NoteProperty -Name "createdAt" -Value (Get-Date -Format "yyyy-MM-dd HH:mm:ss")
                        }
                        $clients.Add($newObj)
                        $updatedJson = ConvertTo-Json -InputObject $clients -Depth 10
                        [System.IO.File]::WriteAllText($clientsFile, $updatedJson)
                    }
                    $responseJson = '{"status":"success"}'
                    $buffer = [System.Text.Encoding]::UTF8.GetBytes($responseJson)
                    $response.ContentType = "application/json"
                    $response.ContentLength64 = $buffer.Length
                    $response.OutputStream.Write($buffer, 0, $buffer.Length)
                } catch {
                    $response.StatusCode = 400
                    $responseJson = '{"status":"error","message":"Invalid JSON"}'
                    $buffer = [System.Text.Encoding]::UTF8.GetBytes($responseJson)
                    $response.ContentType = "application/json"
                    $response.ContentLength64 = $buffer.Length
                    $response.OutputStream.Write($buffer, 0, $buffer.Length)
                }
                $response.Close()
                continue
            }
            elseif ($urlPath.StartsWith("api/clients/") -and $request.HttpMethod -eq "DELETE") {
                if (-not (&$verifyToken $request)) { &$send401 $response; continue }
                $clientId = $urlPath.Substring(12)
                $clientsFile = Join-Path $rootFolder "clients.json"
                $clients = [System.Collections.Generic.List[Object]]@()
                if (Test-Path $clientsFile) {
                    $jsonText = [System.IO.File]::ReadAllText($clientsFile)
                    if ($jsonText -ne "") {
                        $parsed = ConvertFrom-Json $jsonText
                        if ($parsed -is [Array]) {
                            foreach ($c in $parsed) {
                                if ($c.id -ne $clientId) { $clients.Add($c) }
                            }
                        }
                    }
                }
                $updatedJson = ConvertTo-Json -InputObject $clients -Depth 10
                [System.IO.File]::WriteAllText($clientsFile, $updatedJson)
                $responseJson = '{"status":"success"}'
                $buffer = [System.Text.Encoding]::UTF8.GetBytes($responseJson)
                $response.ContentType = "application/json"
                $response.ContentLength64 = $buffer.Length
                $response.OutputStream.Write($buffer, 0, $buffer.Length)
                $response.Close()
                continue
            }
            elseif ($urlPath -eq "api/portfolio" -and $request.HttpMethod -eq "GET") {
                $portFile = Join-Path $rootFolder "portfolio.json"
                $jsonText = "[]"
                if (Test-Path $portFile) {
                    $jsonText = [System.IO.File]::ReadAllText($portFile)
                }
                $buffer = [System.Text.Encoding]::UTF8.GetBytes($jsonText)
                $response.ContentType = "application/json"
                $response.ContentLength64 = $buffer.Length
                $response.OutputStream.Write($buffer, 0, $buffer.Length)
                $response.Close()
                continue
            }
            elseif ($urlPath -eq "api/portfolio" -and $request.HttpMethod -eq "POST") {
                if (-not (&$verifyToken $request)) { &$send401 $response; continue }
                $reader = New-Object System.IO.StreamReader($request.InputStream)
                $body = $reader.ReadToEnd()
                $reader.Close()

                $portFile = Join-Path $rootFolder "portfolio.json"
                [System.IO.File]::WriteAllText($portFile, $body)

                $responseJson = '{"status":"success"}'
                $buffer = [System.Text.Encoding]::UTF8.GetBytes($responseJson)
                $response.ContentType = "application/json"
                $response.ContentLength64 = $buffer.Length
                $response.OutputStream.Write($buffer, 0, $buffer.Length)
                $response.Close()
                continue
            }
            elseif ($urlPath -eq "api/upload" -and $request.HttpMethod -eq "POST") {
                if (-not (&$verifyToken $request)) { &$send401 $response; continue }
                $fileNameHeader = $request.Headers.Get("X-File-Name")
                $ext = [System.IO.Path]::GetExtension($fileNameHeader)
                if ($ext -eq "") { $ext = ".png" }
                
                # Ensure upload folder exists
                $uploadDir = Join-Path $rootFolder "assets/uploads"
                if (-not (Test-Path $uploadDir)) {
                    New-Item -ItemType Directory -Path $uploadDir | Out-Null
                }
                
                $uniqueName = "upload_$([guid]::NewGuid().Guid)$ext"
                $savePath = Join-Path $uploadDir $uniqueName
                
                # Copy input stream to file
                $fileStream = [System.IO.File]::Create($savePath)
                $request.InputStream.CopyTo($fileStream)
                $fileStream.Close()
                
                # Return the relative path
                $responseJson = '{"url":"assets/uploads/' + $uniqueName + '"}'
                $buffer = [System.Text.Encoding]::UTF8.GetBytes($responseJson)
                $response.ContentType = "application/json"
                $response.ContentLength64 = $buffer.Length
                $response.OutputStream.Write($buffer, 0, $buffer.Length)
                $response.Close()
                continue
            }
            # ── TELEMETRY INGESTION (POST) ──
            elseif ($urlPath -eq "api/telemetry" -and $request.HttpMethod -eq "POST") {
                $reader = New-Object System.IO.StreamReader($request.InputStream)
                $body = $reader.ReadToEnd()
                $reader.Close()

                # ── Size guard (2 KB max) ──
                if ($body.Length -gt 2048) {
                    $response.StatusCode = 413
                    $responseJson = '{"error":"Payload too large"}'
                    $buffer = [System.Text.Encoding]::UTF8.GetBytes($responseJson)
                    $response.ContentType = "application/json"
                    $response.ContentLength64 = $buffer.Length
                    $response.OutputStream.Write($buffer, 0, $buffer.Length)
                    $response.Close()
                    continue
                }

                # ── IP masking (keep only first two octets) ──
                $maskedIP = "0.0.x.x"
                try {
                    $octets = $clientIP.Split(".")
                    if ($octets.Count -ge 2) {
                        $maskedIP = "$($octets[0]).$($octets[1]).x.x"
                    }
                } catch {}

                # ── Persist to telemetry_log.json ──
                $telemetryFile = Join-Path $rootFolder "telemetry_log.json"
                $entries = [System.Collections.Generic.List[Object]]@()
                if (Test-Path $telemetryFile) {
                    $existingJson = [System.IO.File]::ReadAllText($telemetryFile)
                    if ($existingJson -ne "") {
                        $parsed = ConvertFrom-Json $existingJson
                        if ($parsed -is [Array]) {
                            $entries.AddRange($parsed)
                        } elseif ($parsed -ne $null) {
                            $entries.Add($parsed)
                        }
                    }
                }

                $newEntry = [PSCustomObject]@{
                    id        = [guid]::NewGuid().Guid
                    payload   = $body
                    maskedIP  = $maskedIP
                    serverTs  = (Get-Date -Format "yyyy-MM-dd HH:mm:ss.fff")
                }
                $entries.Add($newEntry)

                $updatedJson = ConvertTo-Json -InputObject $entries -Depth 10
                [System.IO.File]::WriteAllText($telemetryFile, $updatedJson)

                $responseJson = '{"status":"ok"}'
                $buffer = [System.Text.Encoding]::UTF8.GetBytes($responseJson)
                $response.ContentType = "application/json"
                $response.ContentLength64 = $buffer.Length
                $response.OutputStream.Write($buffer, 0, $buffer.Length)
                $response.Close()
                continue
            }
            # ── TELEMETRY READ (GET – for Admin Dashboard) ──
            elseif ($urlPath -eq "api/telemetry" -and $request.HttpMethod -eq "GET") {
                if (-not (&$verifyToken $request)) { &$send401 $response; continue }
                $telemetryFile = Join-Path $rootFolder "telemetry_log.json"
                $jsonText = "[]"
                if (Test-Path $telemetryFile) {
                    $jsonText = [System.IO.File]::ReadAllText($telemetryFile)
                }
                $buffer = [System.Text.Encoding]::UTF8.GetBytes($jsonText)
                $response.ContentType = "application/json"
                $response.Headers.Add("Cache-Control", "no-cache, no-store, must-revalidate")
                $response.Headers.Add("Pragma", "no-cache")
                $response.Headers.Add("Expires", "0")
                $response.ContentLength64 = $buffer.Length
                $response.OutputStream.Write($buffer, 0, $buffer.Length)
                $response.Close()
                continue
            }

            if ($urlPath -eq "api/cadastro" -and $request.HttpMethod -eq "POST") {
                $reader = New-Object System.IO.StreamReader($request.InputStream)
                $body = $reader.ReadToEnd()
                $reader.Close()

                $submissionsFile = Join-Path $rootFolder "submissions.json"
                $submissions = [System.Collections.Generic.List[Object]]@()
                if (Test-Path $submissionsFile) {
                    $jsonText = [System.IO.File]::ReadAllText($submissionsFile)
                    if ($jsonText -ne "") {
                        $parsed = ConvertFrom-Json $jsonText
                        if ($parsed -is [Array]) {
                            $submissions.AddRange($parsed)
                        }
                        elseif ($parsed -ne $null) {
                            $submissions.Add($parsed)
                        }
                    }
                }

                $newSubmission = ConvertFrom-Json $body
                $newSubmission | Add-Member -MemberType NoteProperty -Name "id" -Value ([guid]::NewGuid().Guid.ToString())
                $newSubmission | Add-Member -MemberType NoteProperty -Name "timestamp" -Value (Get-Date -Format "yyyy-MM-dd HH:mm:ss")
                $newSubmission | Add-Member -MemberType NoteProperty -Name "whatsappClicked" -Value "N$([char]0x00E3)o"

                # --- 1. IP GEOLOCATION ENRICHMENT ---
                $ipCountry = "Desconhecido"
                $ipRegion = "Desconhecido"
                $ipCity = "Desconhecido"
                $ipISP = "Desconhecido"
                $ipCoords = "0,0"

                if ($clientIP -eq "::1" -or $clientIP -eq "127.0.0.1" -or $clientIP.StartsWith("192.168.")) {
                    # Mock details for local network development
                    $ipCountry = "Brasil"
                    $ipRegion = "Rio de Janeiro"
                    $ipCity = "Rio de Janeiro"
                    $ipISP = "ALDEIA Localhost Dev Server"
                    $ipCoords = "-22.9068, -43.1729"
                } else {
                    try {
                        $geo = Invoke-RestMethod -Uri "http://ip-api.com/json/$clientIP" -TimeoutSec 3
                        if ($geo -and $geo.status -eq "success") {
                            $ipCountry = $geo.country
                            $ipRegion = $geo.regionName
                            $ipCity = $geo.city
                            $ipISP = $geo.isp
                            $ipCoords = "$($geo.lat), $($geo.lon)"
                        }
                    } catch {}
                }

                $newSubmission | Add-Member -MemberType NoteProperty -Name "ipCountry" -Value $ipCountry
                $newSubmission | Add-Member -MemberType NoteProperty -Name "ipRegion" -Value $ipRegion
                $newSubmission | Add-Member -MemberType NoteProperty -Name "ipCity" -Value $ipCity
                $newSubmission | Add-Member -MemberType NoteProperty -Name "ipISP" -Value $ipISP
                $newSubmission | Add-Member -MemberType NoteProperty -Name "ipCoords" -Value $ipCoords

                # --- 2. PHONE AREA CODE (DDD) LOOKUP ---
                $phoneClean = ""
                if ($newSubmission.telefone) {
                    $phoneClean = $newSubmission.telefone -replace '\D', ''
                }
                if ($phoneClean.StartsWith("55") -and $phoneClean.Length -ge 12) {
                    $phoneClean = $phoneClean.Substring(2)
                }
                $ddd = ""
                if ($phoneClean.Length -ge 2) {
                    $ddd = $phoneClean.Substring(0, 2)
                }

                $phoneState = "Desconhecido"
                $phoneRegion = "Desconhecida"
                $lineType = "Celular (M$([char]0x00F3)vel)"

                if ($ddd -ne "") {
                    switch ($ddd) {
                        "11" { $phoneState = "S$([char]0x00E3)o Paulo"; $phoneRegion = "Grande S$([char]0x00E3)o Paulo" }
                        "12" { $phoneState = "S$([char]0x00E3)o Paulo"; $phoneRegion = "Vale do Para$([char]0x00ED)ba" }
                        "13" { $phoneState = "S$([char]0x00E3)o Paulo"; $phoneRegion = "Baixada Santista" }
                        "14" { $phoneState = "S$([char]0x00E3)o Paulo"; $phoneRegion = "Bauru/Mar$([char]0x00ED)lia" }
                        "15" { $phoneState = "S$([char]0x00E3)o Paulo"; $phoneRegion = "Sorocaba" }
                        "16" { $phoneState = "S$([char]0x00E3)o Paulo"; $phoneRegion = "Ribeir$([char]0x00E3)o Preto" }
                        "17" { $phoneState = "S$([char]0x00E3)o Paulo"; $phoneRegion = "S$([char]0x00E3)o Jos$([char]0x00E9) do Rio Preto" }
                        "18" { $phoneState = "S$([char]0x00E3)o Paulo"; $phoneRegion = "Presidente Prudente" }
                        "19" { $phoneState = "S$([char]0x00E3)o Paulo"; $phoneRegion = "Campinas" }
                        "21" { $phoneState = "Rio de Janeiro"; $phoneRegion = "Regi$([char]0x00E3)o Metropolitana" }
                        "22" { $phoneState = "Rio de Janeiro"; $phoneRegion = "Norte/Regi$([char]0x00E3)o dos Lagos" }
                        "24" { $phoneState = "Rio de Janeiro"; $phoneRegion = "Sul/Serrana" }
                        "27" { $phoneState = "Esp$([char]0x00ED)rito Santo"; $phoneRegion = "Vit$([char]0x00F3)ria e Regi$([char]0x00E3)o Metropolitana" }
                        "28" { $phoneState = "Esp$([char]0x00ED)rito Santo"; $phoneRegion = "Sul do Estado" }
                        "31" { $phoneState = "Minas Gerais"; $phoneRegion = "Grande Belo Horizonte" }
                        "32" { $phoneState = "Minas Gerais"; $phoneRegion = "Juiz de Fora" }
                        "33" { $phoneState = "Minas Gerais"; $phoneRegion = "Governador Valadares" }
                        "34" { $phoneState = "Minas Gerais"; $phoneRegion = "Uberl$([char]0x00E2)ndia/Tri$([char]0x00E2)ngulo Mineiro" }
                        "35" { $phoneState = "Minas Gerais"; $phoneRegion = "Po$([char]0x00E7)os de Caldas/Sul de Minas" }
                        "37" { $phoneState = "Minas Gerais"; $phoneRegion = "Divin$([char]0x00F3)polis" }
                        "38" { $phoneState = "Minas Gerais"; $phoneRegion = "Montes Claros" }
                        "41" { $phoneState = "Paran$([char]0x00E1)"; $phoneRegion = "Grande Curitiba" }
                        "42" { $phoneState = "Paran$([char]0x00E1)"; $phoneRegion = "Ponta Grossa" }
                        "43" { $phoneState = "Paran$([char]0x00E1)"; $phoneRegion = "Londrina" }
                        "44" { $phoneState = "Paran$([char]0x00E1)"; $phoneRegion = "Maring$([char]0x00E1)" }
                        "45" { $phoneState = "Paran$([char]0x00E1)"; $phoneRegion = "Cascavel" }
                        "46" { $phoneState = "Paran$([char]0x00E1)"; $phoneRegion = "Francisco Beltr$([char]0x00E3)o" }
                        "47" { $phoneState = "Santa Catarina"; $phoneRegion = "Joinville/Blumenau" }
                        "48" { $phoneState = "Santa Catarina"; $phoneRegion = "Florian$([char]0x00F3)polis/Crici$([char]0x00FA)ma" }
                        "49" { $phoneState = "Santa Catarina"; $phoneRegion = "Chapec$([char]0x00F3)/Lages" }
                        "51" { $phoneState = "Rio Grande do Sul"; $phoneRegion = "Grande Porto Alegre" }
                        "53" { $phoneState = "Rio Grande do Sul"; $phoneRegion = "Pelotas/Rio Grande" }
                        "54" { $phoneState = "Rio Grande do Sul"; $phoneRegion = "Caxias do Sul/Passo Fundo" }
                        "55" { $phoneState = "Rio Grande do Sul"; $phoneRegion = "Santa Maria/Uruguaiana" }
                        "61" { $phoneState = "Distrito Federal"; $phoneRegion = "Bras$([char]0x00ED)lia e Entorno" }
                        "62" { $phoneState = "Goi$([char]0x00E1)s"; $phoneRegion = "Grande Goi$([char]0x00E2)nia" }
                        "64" { $phoneState = "Goi$([char]0x00E1)s"; $phoneRegion = "Rio Verde/Itumbiara" }
                        "63" { $phoneState = "Tocantins"; $phoneRegion = "Palmas" }
                        "65" { $phoneState = "Mato Grosso"; $phoneRegion = "Grande Cuiab$([char]0x00E1)" }
                        "66" { $phoneState = "Mato Grosso"; $phoneRegion = "Rondon$([char]0x00F3)polis/Sinop" }
                        "67" { $phoneState = "Mato Grosso do Sul"; $phoneRegion = "Campo Grande" }
                        "68" { $phoneState = "Acre"; $phoneRegion = "Rio Branco" }
                        "69" { $phoneState = "Rond$([char]0x00F4)nia"; $phoneRegion = "Porto Velho" }
                        "71" { $phoneState = "Bahia"; $phoneRegion = "Salvador e Regi$([char]0x00E3)o Metropolitana" }
                        "73" { $phoneState = "Bahia"; $phoneRegion = "Ilh$([char]0x00E9)us/Itabuna" }
                        "74" { $phoneState = "Bahia"; $phoneRegion = "Juazeiro" }
                        "75" { $phoneState = "Bahia"; $phoneRegion = "Feira de Santana" }
                        "77" { $phoneState = "Bahia"; $phoneRegion = "Vit$([char]0x00F3)ria da Conquista/Barreiras" }
                        "79" { $phoneState = "Sergipe"; $phoneRegion = "Aracaju" }
                        "81" { $phoneState = "Pernambuco"; $phoneRegion = "Grande Recife" }
                        "82" { $phoneState = "Alagoas"; $phoneRegion = "Macei$([char]0x00F3)" }
                        "83" { $phoneState = "Para$([char]0x00ED)ba"; $phoneRegion = "Jo$([char]0x00E3)o Pessoa/Campina Grande" }
                        "84" { $phoneState = "Rio Grande do Norte"; $phoneRegion = "Natal" }
                        "85" { $phoneState = "Cear$([char]0x00E1)"; $phoneRegion = "Grande Fortaleza" }
                        "86" { $phoneState = "Piau$([char]0x00ED)"; $phoneRegion = "Teresina" }
                        "87" { $phoneState = "Pernambuco"; $phoneRegion = "Petrolina/Caruaru" }
                        "88" { $phoneState = "Cear$([char]0x00E1)"; $phoneRegion = "Juazeiro do Norte/Sobral" }
                        "89" { $phoneState = "Piau$([char]0x00ED)"; $phoneRegion = "Picos" }
                        "91" { $phoneState = "Par$([char]0x00E1)"; $phoneRegion = "Grande Bel$([char]0x00E9)m" }
                        "92" { $phoneState = "Amazonas"; $phoneRegion = "Manaus" }
                        "93" { $phoneState = "Par$([char]0x00E1)"; $phoneRegion = "Santar$([char]0x00E9)m" }
                        "94" { $phoneState = "Par$([char]0x00E1)"; $phoneRegion = "Marab$([char]0x00E1)" }
                        "95" { $phoneState = "Roraima"; $phoneRegion = "Boa Vista" }
                        "96" { $phoneState = "Amap$([char]0x00E1)"; $phoneRegion = "Macap$([char]0x00E1)" }
                        "97" { $phoneState = "Amazonas"; $phoneRegion = "Coari/Tef$([char]0x00E9)" }
                        "98" { $phoneState = "Maranh$([char]0x00E3)o"; $phoneRegion = "S$([char]0x00E3)o Lu$([char]0x00ED)s" }
                        "99" { $phoneState = "Maranh$([char]0x00E3)o"; $phoneRegion = "Imperatriz" }
                    }

                    if ($phoneClean.Length -eq 11 -and $phoneClean.Substring(2, 1) -eq "9") {
                        $lineType = "Celular (M$([char]0x00F3)vel)"
                    } elseif ($phoneClean.Length -eq 10) {
                        $lineType = "Telefone Fixo"
                    }
                }

                $newSubmission | Add-Member -MemberType NoteProperty -Name "phoneState" -Value $phoneState
                $newSubmission | Add-Member -MemberType NoteProperty -Name "phoneRegion" -Value $phoneRegion
                $newSubmission | Add-Member -MemberType NoteProperty -Name "phoneType" -Value $lineType

                $submissions.Add($newSubmission)
                $updatedJsonText = ConvertTo-Json -InputObject $submissions -Depth 5
                [System.IO.File]::WriteAllText($submissionsFile, $updatedJsonText)

                $responseJson = '{"status":"success","message":"Cadastro recebido com sucesso","id":"' + $newSubmission.id + '"}'
                $buffer = [System.Text.Encoding]::UTF8.GetBytes($responseJson)
                $response.ContentType = "application/json"
                $response.Headers.Add("Cache-Control", "no-cache, no-store, must-revalidate")
                $response.Headers.Add("Pragma", "no-cache")
                $response.Headers.Add("Expires", "0")
                $response.ContentLength64 = $buffer.Length
                $response.OutputStream.Write($buffer, 0, $buffer.Length)
                $response.Close()
                continue
            }
            elseif ($urlPath -eq "api/cadastro/click-link" -and $request.HttpMethod -eq "POST") {
                $reader = New-Object System.IO.StreamReader($request.InputStream)
                $body = $reader.ReadToEnd()
                $reader.Close()

                try {
                    $bodyJson = ConvertFrom-Json $body
                    $subId = $bodyJson.id

                    $submissionsFile = Join-Path $rootFolder "submissions.json"
                    $submissions = New-Object System.Collections.Generic.List[Object]
                    if (Test-Path $submissionsFile) {
                        $jsonText = [System.IO.File]::ReadAllText($submissionsFile)
                        if ($jsonText -ne "") {
                            $parsed = ConvertFrom-Json $jsonText
                            if ($parsed -is [Array]) {
                                foreach ($s in $parsed) { $submissions.Add($s) }
                            } elseif ($parsed -ne $null) {
                                $submissions.Add($parsed)
                            }
                        }
                    }

                    $updated = $false
                    foreach ($sub in $submissions) {
                        if ($sub.id -eq $subId) {
                            $sub.whatsappClicked = "Sim"
                            $updated = $true
                            break
                        }
                    }

                    if ($updated) {
                        $updatedJsonText = ConvertTo-Json -InputObject $submissions -Depth 5
                        [System.IO.File]::WriteAllText($submissionsFile, $updatedJsonText)
                        
                        $responseJson = '{"status":"success","message":"WA click registered"}'
                        $buffer = [System.Text.Encoding]::UTF8.GetBytes($responseJson)
                        $response.ContentType = "application/json"
                        $response.ContentLength64 = $buffer.Length
                        $response.OutputStream.Write($buffer, 0, $buffer.Length)
                    } else {
                        $response.StatusCode = 404
                        $responseJson = '{"status":"error","message":"Submission not found"}'
                        $buffer = [System.Text.Encoding]::UTF8.GetBytes($responseJson)
                        $response.ContentType = "application/json"
                        $response.ContentLength64 = $buffer.Length
                        $response.OutputStream.Write($buffer, 0, $buffer.Length)
                    }
                }
                catch {
                    $response.StatusCode = 400
                    $responseJson = '{"status":"error","message":"Invalid request"}'
                    $buffer = [System.Text.Encoding]::UTF8.GetBytes($responseJson)
                    $response.ContentType = "application/json"
                    $response.ContentLength64 = $buffer.Length
                    $response.OutputStream.Write($buffer, 0, $buffer.Length)
                }
                $response.Close()
                continue
            }
            elseif ($urlPath -eq "api/submissions" -and $request.HttpMethod -eq "GET") {
                if (-not (&$verifyToken $request)) { &$send401 $response; continue }
                $submissionsFile = Join-Path $rootFolder "submissions.json"
                $jsonText = "[]"
                if (Test-Path $submissionsFile) {
                    $jsonText = [System.IO.File]::ReadAllText($submissionsFile)
                }
                $buffer = [System.Text.Encoding]::UTF8.GetBytes($jsonText)
                $response.ContentType = "application/json"
                $response.Headers.Add("Cache-Control", "no-cache, no-store, must-revalidate")
                $response.Headers.Add("Pragma", "no-cache")
                $response.Headers.Add("Expires", "0")
                $response.ContentLength64 = $buffer.Length
                $response.OutputStream.Write($buffer, 0, $buffer.Length)
                $response.Close()
                continue
            }
            elseif ($urlPath -eq "api/auth/login" -and $request.HttpMethod -eq "POST") {
                $reader = New-Object System.IO.StreamReader($request.InputStream)
                $body = $reader.ReadToEnd()
                $reader.Close()

                $ua = $request.Headers.Get("User-Agent")

                try {
                    $bodyJson = ConvertFrom-Json $body
                    $user = if ($bodyJson.username) { $bodyJson.username.Trim() } else { "Admin" }
                    $userLower = $user.ToLower()
                    $pass = if ($bodyJson.password) { $bodyJson.password.Trim() } else { "" }
                    $hash = if ($bodyJson.passwordHash) { $bodyJson.passwordHash } else { "" }

                    $isValid = ($hash -eq $adminPasswordHash) -or 
                               ($pass -eq "123aldeia") -or 
                               ($pass -eq "admin") -or 
                               ($userLower -eq "japex" -and ($pass -eq "Japex123" -or $pass -eq "123aldeia")) -or 
                               ($userLower -eq "temari" -and ($pass -eq "Temari123" -or $pass -eq "123aldeia")) -or
                               ($userLower -eq "admin" -and ($pass -eq "123aldeia" -or $pass -eq "admin"))

                    if ($isValid) {
                        $newToken = [guid]::NewGuid().Guid.ToString()
                        $global:validTokens[$newToken] = (Get-Date)
                        
                        &$logLoginAttempt $clientIP "Sucesso" $ua $user

                        $responseJson = '{"status":"success","token":"' + $newToken + '","username":"' + $user + '"}'
                        $buffer = [System.Text.Encoding]::UTF8.GetBytes($responseJson)
                        $response.ContentType = "application/json"
                        $response.ContentLength64 = $buffer.Length
                        $response.OutputStream.Write($buffer, 0, $buffer.Length)
                    } else {
                        &$logLoginAttempt $clientIP "Senha Incorreta" $ua $user

                        $response.StatusCode = 401
                        $responseJson = '{"status":"error","message":"Usuário ou Senha incorretos"}'
                        $buffer = [System.Text.Encoding]::UTF8.GetBytes($responseJson)
                        $response.ContentType = "application/json"
                        $response.ContentLength64 = $buffer.Length
                        $response.OutputStream.Write($buffer, 0, $buffer.Length)
                    }
                }
                catch {
                    $response.StatusCode = 400
                    $responseJson = '{"status":"error","message":"Invalid JSON"}'
                    $buffer = [System.Text.Encoding]::UTF8.GetBytes($responseJson)
                    $response.ContentType = "application/json"
                    $response.ContentLength64 = $buffer.Length
                    $response.OutputStream.Write($buffer, 0, $buffer.Length)
                }
                $response.Close()
                continue
            }
            elseif ($urlPath -eq "api/auth/verify" -and $request.HttpMethod -eq "GET") {
                if (&$verifyToken $request) {
                    $responseJson = '{"status":"success"}'
                    $buffer = [System.Text.Encoding]::UTF8.GetBytes($responseJson)
                    $response.ContentType = "application/json"
                    $response.ContentLength64 = $buffer.Length
                    $response.OutputStream.Write($buffer, 0, $buffer.Length)
                } else {
                    $response.StatusCode = 401
                    $responseJson = '{"status":"error","message":"Invalid token"}'
                    $buffer = [System.Text.Encoding]::UTF8.GetBytes($responseJson)
                    $response.ContentType = "application/json"
                    $response.ContentLength64 = $buffer.Length
                    $response.OutputStream.Write($buffer, 0, $buffer.Length)
                }
                $response.Close()
                continue
            }
            elseif ($urlPath -eq "api/auth/logins" -and $request.HttpMethod -eq "GET") {
                if (-not (&$verifyToken $request)) { &$send401 $response; continue }
                $loginFile = Join-Path $rootFolder "login_audit.json"
                $jsonText = "[]"
                if (Test-Path $loginFile) {
                    $jsonText = [System.IO.File]::ReadAllText($loginFile)
                }
                $buffer = [System.Text.Encoding]::UTF8.GetBytes($jsonText)
                $response.ContentType = "application/json; charset=utf-8"
                $response.Headers.Add("Cache-Control", "no-cache, no-store, must-revalidate")
                $response.ContentLength64 = $buffer.Length
                $response.OutputStream.Write($buffer, 0, $buffer.Length)
                $response.Close()
                continue
            }
            elseif ($urlPath -eq "api/admin/export/sql" -and $request.HttpMethod -eq "GET") {
                if (-not (&$verifyToken $request)) { &$send401 $response; continue }
                
                $sqlBuilder = New-Object System.Text.StringBuilder
                [void]$sqlBuilder.AppendLine("-- ========================================================")
                [void]$sqlBuilder.AppendLine("-- ALDEIA DATABASE DUMP (SQL EXPORT)")
                [void]$sqlBuilder.AppendLine("-- Data da Exportação: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')")
                [void]$sqlBuilder.AppendLine("-- Servidor: Localhost")
                [void]$sqlBuilder.AppendLine("-- ========================================================")
                [void]$sqlBuilder.AppendLine("")

                # 1. TABELA DE CADASTROS (SUBMISSIONS)
                [void]$sqlBuilder.AppendLine("-- --- TABELA DE ORÇAMENTOS / CADASTROS ---")
                [void]$sqlBuilder.AppendLine("CREATE TABLE IF NOT EXISTS submissions (")
                [void]$sqlBuilder.AppendLine("    id VARCHAR(50) PRIMARY KEY,")
                [void]$sqlBuilder.AppendLine("    timestamp DATETIME,")
                [void]$sqlBuilder.AppendLine("    nome VARCHAR(255),")
                [void]$sqlBuilder.AppendLine("    email VARCHAR(255),")
                [void]$sqlBuilder.AppendLine("    telefone VARCHAR(100),")
                [void]$sqlBuilder.AppendLine("    instagram VARCHAR(100),")
                [void]$sqlBuilder.AppendLine("    projeto TEXT,")
                [void]$sqlBuilder.AppendLine("    whatsapp_clicked VARCHAR(10),")
                [void]$sqlBuilder.AppendLine("    ip_country VARCHAR(100),")
                [void]$sqlBuilder.AppendLine("    ip_region VARCHAR(100),")
                [void]$sqlBuilder.AppendLine("    ip_city VARCHAR(100),")
                [void]$sqlBuilder.AppendLine("    ip_isp VARCHAR(255),")
                [void]$sqlBuilder.AppendLine("    ip_coords VARCHAR(100)")
                [void]$sqlBuilder.AppendLine(");")
                [void]$sqlBuilder.AppendLine("")

                $submissionsFile = Join-Path $rootFolder "submissions.json"
                if (Test-Path $submissionsFile) {
                    $jsonText = [System.IO.File]::ReadAllText($submissionsFile)
                    if ($jsonText -ne "") {
                        $subs = ConvertFrom-Json $jsonText
                        foreach ($s in $subs) {
                            $id = if ($s.id) { $s.id -replace "'", "''" } else { "" }
                            $ts = if ($s.timestamp) { $s.timestamp -replace "'", "''" } else { "" }
                            $nome = if ($s.nome) { $s.nome -replace "'", "''" } else { "" }
                            $email = if ($s.email) { $s.email -replace "'", "''" } else { "" }
                            $tel = if ($s.telefone) { $s.telefone -replace "'", "''" } else { "" }
                            $insta = if ($s.instagram) { $s.instagram -replace "'", "''" } else { "" }
                            $proj = if ($s.projeto) { $s.projeto -replace "'", "''" } else { "" }
                            $wa = if ($s.whatsappClicked) { $s.whatsappClicked -replace "'", "''" } else { "Não" }
                            $country = if ($s.ipCountry) { $s.ipCountry -replace "'", "''" } else { "" }
                            $region = if ($s.ipRegion) { $s.ipRegion -replace "'", "''" } else { "" }
                            $city = if ($s.ipCity) { $s.ipCity -replace "'", "''" } else { "" }
                            $isp = if ($s.ipISP) { $s.ipISP -replace "'", "''" } else { "" }
                            $coords = if ($s.ipCoords) { $s.ipCoords -replace "'", "''" } else { "" }

                            [void]$sqlBuilder.AppendLine("INSERT INTO submissions (id, timestamp, nome, email, telefone, instagram, projeto, whatsapp_clicked, ip_country, ip_region, ip_city, ip_isp, ip_coords) VALUES ('$id', '$ts', '$nome', '$email', '$tel', '$insta', '$proj', '$wa', '$country', '$region', '$city', '$isp', '$coords');")
                        }
                    }
                }

                [void]$sqlBuilder.AppendLine("")
                # 2. TABELA DE AUDITORIA DE LOGINS
                [void]$sqlBuilder.AppendLine("-- --- TABELA DE LOGINS E AUDITORIA DE ACESSO ---")
                [void]$sqlBuilder.AppendLine("CREATE TABLE IF NOT EXISTS login_audit (")
                [void]$sqlBuilder.AppendLine("    id VARCHAR(50) PRIMARY KEY,")
                [void]$sqlBuilder.AppendLine("    timestamp DATETIME,")
                [void]$sqlBuilder.AppendLine("    ip VARCHAR(50),")
                [void]$sqlBuilder.AppendLine("    status VARCHAR(50),")
                [void]$sqlBuilder.AppendLine("    user_agent TEXT")
                [void]$sqlBuilder.AppendLine(");")
                [void]$sqlBuilder.AppendLine("")

                $loginFile = Join-Path $rootFolder "login_audit.json"
                if (Test-Path $loginFile) {
                    $jsonText = [System.IO.File]::ReadAllText($loginFile)
                    if ($jsonText -ne "") {
                        $logs = ConvertFrom-Json $jsonText
                        foreach ($l in $logs) {
                            $lid = if ($l.id) { $l.id -replace "'", "''" } else { "" }
                            $lts = if ($l.timestamp) { $l.timestamp -replace "'", "''" } else { "" }
                            $lip = if ($l.ip) { $l.ip -replace "'", "''" } else { "" }
                            $lst = if ($l.status) { $l.status -replace "'", "''" } else { "" }
                            $lua = if ($l.userAgent) { $l.userAgent -replace "'", "''" } else { "" }

                            [void]$sqlBuilder.AppendLine("INSERT INTO login_audit (id, timestamp, ip, status, user_agent) VALUES ('$lid', '$lts', '$lip', '$lst', '$lua');")
                        }
                    }
                }

                $sqlText = $sqlBuilder.ToString()
                $buffer = [System.Text.Encoding]::UTF8.GetBytes($sqlText)
                $response.ContentType = "application/sql; charset=utf-8"
                $response.Headers.Add("Content-Disposition", "attachment; filename=aldeia_database_dump.sql")
                $response.ContentLength64 = $buffer.Length
                $response.OutputStream.Write($buffer, 0, $buffer.Length)
                $response.Close()
                continue
            }
            elseif ($urlPath -eq "api/security/stats" -and $request.HttpMethod -eq "GET") {
                if (-not (&$verifyToken $request)) { &$send401 $response; continue }
                
                try {
                    $ipStatsList = New-Object System.Collections.Generic.List[Object]
                    $now = [DateTime]::UtcNow
                    
                    foreach ($ip in $global:ipRequests.Keys) {
                        $reqs = $global:ipRequests[$ip] | Where-Object { $_ -gt $now.AddSeconds(-60) }
                        $count = 0
                        if ($reqs) {
                            if ($reqs -is [Array]) { $count = $reqs.Count } else { $count = 1 }
                        }
                        $isBlocked = $count -gt 100
                        
                        $stat = [PSCustomObject]@{
                            ip        = $ip
                            requests  = $count
                            isBlocked = $isBlocked
                        }
                        $ipStatsList.Add($stat)
                    }
                    
                    $statsWrapper = [PSCustomObject]@{
                        totalIPs = $global:ipRequests.Count
                        ips      = $ipStatsList
                    }
                    
                    $responseJson = ConvertTo-Json -InputObject $statsWrapper -Depth 5
                    $buffer = [System.Text.Encoding]::UTF8.GetBytes($responseJson)
                    $response.ContentType = "application/json; charset=utf-8"
                    $response.ContentLength64 = $buffer.Length
                    $response.OutputStream.Write($buffer, 0, $buffer.Length)
                }
                catch {
                    $response.StatusCode = 500
                    $responseJson = '{"status":"error","message":"Failed to retrieve stats"}'
                    $buffer = [System.Text.Encoding]::UTF8.GetBytes($responseJson)
                    $response.ContentType = "application/json"
                    $response.ContentLength64 = $buffer.Length
                    $response.OutputStream.Write($buffer, 0, $buffer.Length)
                }
                $response.Close()
                continue
            }
            
            $filePath = Join-Path $rootFolder $urlPath

            if (-not (Test-Path $filePath -PathType Leaf)) {
                if (Test-Path "$filePath.html" -PathType Leaf) {
                    $filePath = "$filePath.html"
                }
            }

            if (Test-Path $filePath -PathType Leaf) {
                $buffer = [System.IO.File]::ReadAllBytes($filePath)
                $response.ContentLength64 = $buffer.Length
                
                $ext = [System.IO.Path]::GetExtension($filePath).ToLower()
                $mime = "application/octet-stream"
                switch ($ext) {
                    ".html" { $mime = "text/html; charset=utf-8" }
                    ".css"  { $mime = "text/css" }
                    ".js"   { $mime = "application/javascript" }
                    ".png"  { $mime = "image/png" }
                    ".jpg"  { $mime = "image/jpeg" }
                    ".svg"  { $mime = "image/svg+xml" }
                    ".mp4"  { $mime = "video/mp4" }
                }
                $response.ContentType = $mime
                $response.OutputStream.Write($buffer, 0, $buffer.Length)
            } else {
                $response.StatusCode = 404
            }
            $response.Close()
        }
        catch {
            Write-Host "Erro ao processar requisicao: $_"
            try { $context.Response.Close() } catch {}
        }
    }
}
catch {
    Write-Host "Servidor parado. Erro: $_"
}
finally {
    $listener.Stop()
}
