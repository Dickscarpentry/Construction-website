# Sync only NAMED photos into the website (ignore generic camera filenames).
# Generic = 20230813_143321.jpg, IMG-...-WA....jpg, received_....jpeg
# Named  = kitchen.jpg, fire door 2.jpg, etc.
#
# Usage:
#   powershell -ExecutionPolicy Bypass -File ".\sync-portfolio.ps1"

$ErrorActionPreference = "Stop"
Add-Type -AssemblyName System.Drawing

$srcRoot = "C:\Users\ricar\Documents\dicks carpentry photos"
$destRoot = "C:\Users\ricar\Documents\dicks-carpentry-website\assets\portfolio"

$folderToSection = @{
  "painting & decorating"                    = "painting"
  "2nd fix"                                  = "carpentry"
  "feature walls,media walls, stair rail"    = "carpentry"
  "fire doors"                               = "carpentry"
  "internal door"                            = "carpentry"
  "kitchens"                                 = "carpentry"
  "refurb (multiskill jobs)"                 = "carpentry"
  "windows and doors"                        = "carpentry"
  "flooring"                                 = "flooring"
  "decking and pergola (external carpentry)" = "outdoor"
  "gates & fencing"                          = "outdoor"
}

$sectionLabels = @{
  painting  = "Painting & decorating"
  carpentry = "Carpentry"
  flooring  = "Flooring"
  outdoor   = "Outdoor"
}

function Test-IsGenericName {
  param([string]$BaseName)
  if ($BaseName -match '^\d{8}_\d{6}') { return $true }
  if ($BaseName -match '^(?i)IMG-\d{8}-WA\d+') { return $true }
  if ($BaseName -match '^(?i)received_\d+') { return $true }
  return $false
}

function Get-NiceLabel {
  param([string]$BaseName, [string]$SectionLabel)
  $label = $BaseName -replace '\s*\(\d+\)\s*$', ''
  $label = $label.Trim()
  if ([string]::IsNullOrWhiteSpace($label)) { return $SectionLabel }
  return $label.Substring(0, 1).ToUpper() + $label.Substring(1)
}

function Apply-ExifOrientation {
  param([System.Drawing.Image]$Image)
  $o = 1
  try { $o = [int]$Image.GetPropertyItem(0x0112).Value[0] } catch { $o = 1 }
  switch ($o) {
    2 { $Image.RotateFlip([System.Drawing.RotateFlipType]::RotateNoneFlipX) }
    3 { $Image.RotateFlip([System.Drawing.RotateFlipType]::Rotate180FlipNone) }
    4 { $Image.RotateFlip([System.Drawing.RotateFlipType]::RotateNoneFlipY) }
    5 { $Image.RotateFlip([System.Drawing.RotateFlipType]::Rotate90FlipX) }
    6 { $Image.RotateFlip([System.Drawing.RotateFlipType]::Rotate90FlipNone) }
    7 { $Image.RotateFlip([System.Drawing.RotateFlipType]::Rotate270FlipX) }
    8 { $Image.RotateFlip([System.Drawing.RotateFlipType]::Rotate270FlipNone) }
  }
  try {
    foreach ($pid in @($Image.PropertyIdList)) {
      if ($pid -eq 0x0112) { $Image.RemovePropertyItem(0x0112); break }
    }
  } catch {}
}

function Resize-ToWebJpeg {
  param([string]$Source, [string]$Dest, [int]$MaxEdge = 1400, [int]$Quality = 82)
  $img = [System.Drawing.Image]::FromFile($Source)
  try {
    # Phone photos often store rotation in EXIF — apply it before resize
    Apply-ExifOrientation $img
    $w = $img.Width; $h = $img.Height
    $scale = [Math]::Min(1.0, $MaxEdge / [Math]::Max($w, $h))
    $nw = [Math]::Max(1, [int][Math]::Round($w * $scale))
    $nh = [Math]::Max(1, [int][Math]::Round($h * $scale))
    $bmp = New-Object System.Drawing.Bitmap $nw, $nh
    $g = [System.Drawing.Graphics]::FromImage($bmp)
    $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
    $g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
    $g.CompositingQuality = [System.Drawing.Drawing2D.CompositingQuality]::HighQuality
    $g.DrawImage($img, 0, 0, $nw, $nh)
    $g.Dispose()
    $jpgCodec = [System.Drawing.Imaging.ImageCodecInfo]::GetImageEncoders() |
      Where-Object { $_.MimeType -eq "image/jpeg" }
    $ep = New-Object System.Drawing.Imaging.EncoderParameters 1
    $ep.Param[0] = New-Object System.Drawing.Imaging.EncoderParameter (
      [System.Drawing.Imaging.Encoder]::Quality, [long]$Quality
    )
    $dir = Split-Path $Dest -Parent
    if (-not (Test-Path $dir)) { New-Item -ItemType Directory -Force -Path $dir | Out-Null }
    $bmp.Save($Dest, $jpgCodec, $ep)
    $bmp.Dispose()
    $ep.Dispose()
  }
  finally { $img.Dispose() }
}

if (-not (Test-Path $srcRoot)) { Write-Error "Photo folder not found: $srcRoot" }
if (Test-Path $destRoot) { Remove-Item $destRoot -Recurse -Force }
New-Item -ItemType Directory -Force -Path $destRoot | Out-Null

$sections = @{
  painting  = [System.Collections.Generic.List[object]]::new()
  carpentry = [System.Collections.Generic.List[object]]::new()
  flooring  = [System.Collections.Generic.List[object]]::new()
  outdoor   = [System.Collections.Generic.List[object]]::new()
}
$counts = @{ painting = 0; carpentry = 0; flooring = 0; outdoor = 0 }
$skipped = 0
$total = 0

foreach ($folderName in ($folderToSection.Keys | Sort-Object)) {
  $section = $folderToSection[$folderName]
  $srcDir = Join-Path $srcRoot $folderName
  if (-not (Test-Path $srcDir)) { continue }

  $files = Get-ChildItem $srcDir -File |
    Where-Object { $_.Extension -match '^\.(jpe?g|png)$' } |
    Sort-Object Name

  foreach ($f in $files) {
    if (Test-IsGenericName $f.BaseName) { $skipped++; continue }

    $counts[$section]++
    $n = $counts[$section]
    $safe = ($f.BaseName -replace '[^\w\-]+', '-').Trim('-').ToLower()
    if ([string]::IsNullOrWhiteSpace($safe)) { $safe = "photo" }
    $name = ("{0:D2}-{1}.jpg" -f $n, $safe)
    if ($name.Length -gt 80) { $name = ("{0:D2}.jpg" -f $n) }
    $dest = Join-Path $destRoot (Join-Path $section $name)
    $label = Get-NiceLabel -BaseName $f.BaseName -SectionLabel $sectionLabels[$section]

    try {
      Resize-ToWebJpeg -Source $f.FullName -Dest $dest
      $sections[$section].Add([ordered]@{
        src   = "assets/portfolio/$section/$name"
        label = $label
        alt   = $label
      }) | Out-Null
      $total++
      Write-Host "OK  [$section] $($f.Name)"
    }
    catch { Write-Warning "Failed $($f.Name): $_" }
  }
}

$manifest = [ordered]@{
  sections = [ordered]@{
    painting  = @($sections.painting)
    carpentry = @($sections.carpentry)
    flooring  = @($sections.flooring)
    outdoor   = @($sections.outdoor)
  }
}

$json = $manifest | ConvertTo-Json -Depth 6
[System.IO.File]::WriteAllText(
  (Join-Path $destRoot "manifest.json"),
  $json,
  (New-Object System.Text.UTF8Encoding $false)
)
# Embedded data so the site works when opened as a file (no fetch needed)
[System.IO.File]::WriteAllText(
  (Join-Path $destRoot "portfolio-data.js"),
  "window.DICKS_PORTFOLIO = $json;`n",
  (New-Object System.Text.UTF8Encoding $false)
)

Write-Host ""
Write-Host "Done. $total named photo(s) synced (skipped $skipped generic)."
Write-Host "  Painting:  $($sections.painting.Count)"
Write-Host "  Carpentry: $($sections.carpentry.Count)"
Write-Host "  Flooring:  $($sections.flooring.Count)"
Write-Host "  Outdoor:   $($sections.outdoor.Count)"
