# Genera todos los iconos de Android desde resources\icon.png
# Sin dependencias: usa System.Drawing (incluido en Windows).
# Uso:  powershell -ExecutionPolicy Bypass -File tools\gen-android-icons.ps1

Add-Type -AssemblyName System.Drawing

$root = Split-Path -Parent $PSScriptRoot
$src  = Join-Path $root 'resources\icon.png'
$res  = Join-Path $root 'android\app\src\main\res'

if (-not (Test-Path $src)) {
    Write-Error "No encuentro $src. Copia tu icono ahi (1024x1024 PNG)."
    exit 1
}

$source = [System.Drawing.Image]::FromFile($src)

function Resize-Png {
    param([int]$Size, [string]$OutPath, [bool]$Round = $false)

    $bmp = New-Object System.Drawing.Bitmap $Size, $Size
    $g   = [System.Drawing.Graphics]::FromImage($bmp)
    $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $g.SmoothingMode     = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
    $g.PixelOffsetMode   = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
    $g.Clear([System.Drawing.Color]::Transparent)

    if ($Round) {
        $path = New-Object System.Drawing.Drawing2D.GraphicsPath
        $path.AddEllipse(0, 0, $Size, $Size)
        $g.SetClip($path)
    }

    $g.DrawImage($source, 0, 0, $Size, $Size)
    $g.Dispose()

    $dir = Split-Path -Parent $OutPath
    if (-not (Test-Path $dir)) { New-Item -ItemType Directory -Force -Path $dir | Out-Null }
    $bmp.Save($OutPath, [System.Drawing.Imaging.ImageFormat]::Png)
    $bmp.Dispose()
    Write-Host "  $OutPath ($Size px)"
}

# Densidades: [carpeta] = tamano-legacy (dp base: launcher 48dp, foreground 108dp)
$densities = @{
    'mipmap-mdpi'    = @{ legacy = 48;  fg = 108 }
    'mipmap-hdpi'    = @{ legacy = 72;  fg = 162 }
    'mipmap-xhdpi'   = @{ legacy = 96;  fg = 216 }
    'mipmap-xxhdpi'  = @{ legacy = 144; fg = 324 }
    'mipmap-xxxhdpi' = @{ legacy = 192; fg = 432 }
}

Write-Host "Generando iconos desde: $src"
foreach ($d in $densities.Keys) {
    $folder = Join-Path $res $d
    $sz = $densities[$d]
    Resize-Png -Size $sz.legacy -OutPath (Join-Path $folder 'ic_launcher.png')
    Resize-Png -Size $sz.legacy -OutPath (Join-Path $folder 'ic_launcher_round.png') -Round $true
    Resize-Png -Size $sz.fg     -OutPath (Join-Path $folder 'ic_launcher_foreground.png')
}

$source.Dispose()
Write-Host "Listo. Reconstruye el APK para ver el icono nuevo."
