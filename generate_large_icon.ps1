Add-Type -AssemblyName System.Drawing

$srcPath = 'C:\SplitMate\assets\icon.png'
$fgPath  = 'C:\SplitMate\assets\foreground_layer.png'

# Output paths
$targetAssetPath = 'C:\SplitMate\assets\notification_large_icon.png'
$drawablePath = 'C:\SplitMate\android\app\src\main\res\drawable\notification_large_icon.png'

$size = 512

# Create a 512x512 bitmap with 32bppArgb
$bmp = New-Object System.Drawing.Bitmap($size, $size, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
$g = [System.Drawing.Graphics]::FromImage($bmp)
$g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
$g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
$g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality

# 1. Fill solid background (White #FFFFFF with 100% Alpha=255)
$g.Clear([System.Drawing.Color]::FromArgb(255, 255, 255, 255))

# 2. Draw foreground layer in center with 15% padding
if (Test-Path $fgPath) {
    $fg = [System.Drawing.Bitmap]::FromFile($fgPath)
    $padding = [int]($size * 0.15)
    $targetSize = $size - ($padding * 2)
    $destRect = New-Object System.Drawing.Rectangle($padding, $padding, $targetSize, $targetSize)
    $srcRect = New-Object System.Drawing.Rectangle(0, 0, $fg.Width, $fg.Height)
    $g.DrawImage($fg, $destRect, $srcRect, [System.Drawing.GraphicsUnit]::Pixel)
    $fg.Dispose()
    Write-Host "Drew foreground_layer.png onto solid white background."
} elseif (Test-Path $srcPath) {
    $src = [System.Drawing.Bitmap]::FromFile($srcPath)
    $destRect = New-Object System.Drawing.Rectangle(0, 0, $size, $size)
    $srcRect = New-Object System.Drawing.Rectangle(0, 0, $src.Width, $src.Height)
    $g.DrawImage($src, $destRect, $srcRect, [System.Drawing.GraphicsUnit]::Pixel)
    $src.Dispose()
    Write-Host "Drew icon.png onto solid white background."
}

$g.Dispose()

# Ensure 100% solid opacity across the entire image (no alpha gaps)
# Force any semi-transparent edge pixels to solid white or solid color
for ($y = 0; $y -lt $size; $y++) {
    for ($x = 0; $x -lt $size; $x++) {
        $p = $bmp.GetPixel($x, $y)
        if ($p.A -lt 255) {
            # Blend transparent alpha over white background
            $alphaRatio = $p.A / 255.0
            $r = [int]($p.R * $alphaRatio + 255 * (1.0 - $alphaRatio))
            $gCol = [int]($p.G * $alphaRatio + 255 * (1.0 - $alphaRatio))
            $b = [int]($p.B * $alphaRatio + 255 * (1.0 - $alphaRatio))
            $bmp.SetPixel($x, $y, [System.Drawing.Color]::FromArgb(255, $r, $gCol, $b))
        }
    }
}

# Ensure destination directories exist
$drawableDir = [System.IO.Path]::GetDirectoryName($drawablePath)
if (-not (Test-Path $drawableDir)) {
    New-Item -ItemType Directory -Path $drawableDir -Force | Out-Null
}

# Save image
$bmp.Save($targetAssetPath, [System.Drawing.Imaging.ImageFormat]::Png)
$bmp.Save($drawablePath, [System.Drawing.Imaging.ImageFormat]::Png)
$bmp.Dispose()

Write-Host "Saved 512x512 solid white notification_large_icon.png to assets and drawable!"
