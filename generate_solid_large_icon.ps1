Add-Type -AssemblyName System.Drawing

$resDir = 'C:\SplitMate\android\app\src\main\res'
$fgPath = 'C:\SplitMate\assets\foreground_layer.png'

if (-not (Test-Path $fgPath)) {
    Write-Error "foreground_layer.png not found at $fgPath!"
    exit 1
}

$fg = [System.Drawing.Bitmap]::FromFile($fgPath)
$size = 256

Write-Host "Creating solid 256x256 notification_large_icon.png with NO transparent corners..."

# Create solid white 32bppArgb bitmap (100% opaque)
$bmp = New-Object System.Drawing.Bitmap($size, $size, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
$g = [System.Drawing.Graphics]::FromImage($bmp)
$g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
$g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
$g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality

# Clear with solid white background
$g.Clear([System.Drawing.Color]::FromArgb(255, 255, 255, 255))

# Draw foreground logo centered with 10% padding
$padding = [int]($size * 0.10)
$innerSize = $size - ($padding * 2)
$destRect = New-Object System.Drawing.Rectangle($padding, $padding, $innerSize, $innerSize)
$srcRect  = New-Object System.Drawing.Rectangle(0, 0, $fg.Width, $fg.Height)
$g.DrawImage($fg, $destRect, $srcRect, [System.Drawing.GraphicsUnit]::Pixel)
$g.Dispose()
$fg.Dispose()

# Ensure 100% opacity for every single pixel
for ($y = 0; $y -lt $size; $y++) {
    for ($x = 0; $x -lt $size; $x++) {
        $p = $bmp.GetPixel($x, $y)
        if ($p.A -lt 255) {
            $alphaRatio = $p.A / 255.0
            $r = [int]($p.R * $alphaRatio + 255 * (1.0 - $alphaRatio))
            $gCol = [int]($p.G * $alphaRatio + 255 * (1.0 - $alphaRatio))
            $b = [int]($p.B * $alphaRatio + 255 * (1.0 - $alphaRatio))
            $bmp.SetPixel($x, $y, [System.Drawing.Color]::FromArgb(255, $r, $gCol, $b))
        }
    }
}

# Save to assets and res/drawable
$assetTarget = 'C:\SplitMate\assets\notification_large_icon.png'
$drawableTarget = Join-Path $resDir 'drawable\notification_large_icon.png'

$bmp.Save($assetTarget, [System.Drawing.Imaging.ImageFormat]::Png)
$bmp.Save($drawableTarget, [System.Drawing.Imaging.ImageFormat]::Png)
$bmp.Dispose()

Write-Host "Saved solid 100% opaque notification_large_icon.png to assets and drawable."
