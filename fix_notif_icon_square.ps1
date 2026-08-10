Add-Type -AssemblyName System.Drawing

$srcPath = 'C:\SplitMate\assets\notification-icon.png'
$src = [System.Drawing.Bitmap]::FromFile($srcPath)

# Target: 192x192 square
$size = 192

# Find the logo bounds (non-transparent pixels)
$minX = $src.Width; $maxX = 0; $minY = $src.Height; $maxY = 0
for ($y = 0; $y -lt $src.Height; $y++) {
    for ($x = 0; $x -lt $src.Width; $x++) {
        $p = $src.GetPixel($x, $y)
        if ($p.A -gt 10) {
            if ($x -lt $minX) { $minX = $x }
            if ($x -gt $maxX) { $maxX = $x }
            if ($y -lt $minY) { $minY = $y }
            if ($y -gt $maxY) { $maxY = $y }
        }
    }
}

Write-Host "Logo bounds: ($minX,$minY) to ($maxX,$maxY)"
$logoW = $maxX - $minX + 1
$logoH = $maxY - $minY + 1
Write-Host "Logo size: ${logoW}x${logoH}"

# Create square output
$out = New-Object System.Drawing.Bitmap($size, $size, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
$g = [System.Drawing.Graphics]::FromImage($out)
$g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
$g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
$g.Clear([System.Drawing.Color]::Transparent)

# Scale logo to fit in 192x192 with 20% padding
$padding = [int]($size * 0.10)
$targetSize = $size - ($padding * 2)

# Maintain aspect ratio
$scale = [Math]::Min($targetSize / $logoW, $targetSize / $logoH)
$scaledW = [int]($logoW * $scale)
$scaledH = [int]($logoH * $scale)
$destX = [int](($size - $scaledW) / 2)
$destY = [int](($size - $scaledH) / 2)

$srcRect = New-Object System.Drawing.Rectangle($minX, $minY, $logoW, $logoH)
$destRect = New-Object System.Drawing.Rectangle($destX, $destY, $scaledW, $scaledH)
$g.DrawImage($src, $destRect, $srcRect, [System.Drawing.GraphicsUnit]::Pixel)

$g.Dispose()
$src.Dispose()

$out.Save($srcPath, [System.Drawing.Imaging.ImageFormat]::Png)
$out.Dispose()

Write-Host "Saved 192x192 notification-icon.png successfully!"
