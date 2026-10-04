# Genera todos los iconos de Android desde resources\icon.png
# Sin dependencias: usa System.Drawing (incluido en Windows).
# Uso:  powershell -ExecutionPolicy Bypass -File tools\gen-android-icons.ps1
#
# El fondo del icono adaptativo es el color @color/valhalla_icon_background
# (values\icon_colors.xml); debe coincidir con el fondo liso del PNG.

Add-Type -AssemblyName System.Drawing

$root = Split-Path -Parent $PSScriptRoot
$src  = Join-Path $root 'resources\icon.png'
$res  = Join-Path $root 'android\app\src\main\res'
$bgHex = '#FEC902'   # amarillo del fondo de main.png

if (-not (Test-Path $src)) {
    Write-Error "No encuentro $src. Copia tu icono ahi (1024x1024 PNG)."
    exit 1
}

$source = [System.Drawing.Image]::FromFile($src)
$bg = [System.Drawing.ColorTranslator]::FromHtml($bgHex)

# Scale = fraccion del lienzo que ocupa el dibujo (centrado). Fill = pinta el fondo.
function Resize-Png {
    param([int]$Size, [string]$OutPath, [bool]$Round = $false, [double]$Scale = 1.0, [bool]$Fill = $false)

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
    if ($Fill) { $g.Clear($bg) ; if ($Round) { $g.ResetClip(); $g.Clear([System.Drawing.Color]::Transparent); $g.SetClip($path); $g.FillEllipse((New-Object System.Drawing.SolidBrush $bg), 0, 0, $Size, $Size) } }

    $d   = [int][Math]::Round($Size * $Scale)
    $off = [int][Math]::Floor(($Size - $d) / 2)
    $g.DrawImage($source, $off, $off, $d, $d)
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
    # El icono es un cuadro lleno (fondo amarillo incluido): legacy a sangre, sin margen.
    Resize-Png -Size $sz.legacy -OutPath (Join-Path $folder 'ic_launcher.png')       -Scale 1.0 -Fill $true
    Resize-Png -Size $sz.legacy -OutPath (Join-Path $folder 'ic_launcher_round.png') -Scale 1.0 -Fill $true -Round $true
    # Adaptativo: el launcher muestra como mucho el cuadro central de 72 de los 108dp.
    # Al 72% (78dp) el borde de la imagen cae fuera de cualquier mascara y el resto
    # lo rellena el fondo del mismo amarillo.
    Resize-Png -Size $sz.fg     -OutPath (Join-Path $folder 'ic_launcher_foreground.png') -Scale 0.72
}

$source.Dispose()

$colors = Join-Path $res 'values\icon_colors.xml'
@"
<?xml version="1.0" encoding="utf-8"?>
<resources>
    <color name="valhalla_icon_background">$bgHex</color>
</resources>
"@ | Set-Content -Encoding utf8 $colors
Write-Host "  $colors ($bgHex)"

Write-Host "Listo. Reconstruye el APK para ver el icono nuevo."
