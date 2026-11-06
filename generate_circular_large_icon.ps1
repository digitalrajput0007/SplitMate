Add-Type -AssemblyName System.Drawing

$fgPath = 'C:\SplitMate\assets\foreground_layer.png'
$targetAssetPath = 'C:\SplitMate\assets\notification_large_icon.png'
$drawablePath = 'C:\SplitMate\android\app\src\main\res\drawable\notification_large_icon.png'

$size = 256
$radius = $size / 2.0

# Create 256x256 ARGB bitmap
$bmp = New-Object System.Drawing.Bitmap($size, $size, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
$g = [System.Drawing.Graphics]::FromImage($bmp)
$g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
$g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
$g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality

# Clear all transparent (A=0)
$g.Clear([System.Drawing.Color]::FromArgb(0, 0, 0, 0))

# Create circular clip path
$path = New-Object System.Drawing.Drawing2D.GraphicsPath
$path.AddEllipse(4, 4, $size - 8, $size - 8)

# Fill circle with solid white (#FFFFFF)
$whiteBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(255, 255, 255, 255))
$g.FillPath($whiteBrush, $path)

# Set clip to circle so logo doesn't overflow
$g.SetClip($path)

# Draw SplitMate logo inside the circle
if (Test-Path $fgPath) {
    $fg = [System.Drawing.Bitmap]::FromFile($fgPath)
    $padding = [int]($size * 0.18)
    $targetSize = $size - ($padding * 2)
    $destRect = New-Object System.Drawing.Rectangle($padding, $padding, $targetSize, $targetSize)
    $srcRect = New-Object System.Drawing.Rectangle(0, 0, $fg.Width, $fg.Height)
    $g.DrawImage($fg, $destRect, $srcRect, [System.Drawing.GraphicsUnit]::Pixel)
    $fg.Dispose()
}

$whiteBrush.Dispose()
$path.Dispose()
$g.Dispose()

# Save image to assets and drawable
$bmp.Save($targetAssetPath, [System.Drawing.Imaging.ImageFormat]::Png)
$bmp.Save($drawablePath, [System.Drawing.Imaging.ImageFormat]::Png)

Write-Host "Circular avatar large icon generated!"
Write-Host "Corner(0,0): RGBA($($bmp.GetPixel(0,0).R), $($bmp.GetPixel(0,0).G), $($bmp.GetPixel(0,0).B), $($bmp.GetPixel(0,0).A)) [MUST BE A=0]"
Write-Host "Center(128,128): RGBA($($bmp.GetPixel(128,128).R), $($bmp.GetPixel(128,128).G), $($bmp.GetPixel(128,128).B), $($bmp.GetPixel(128,128).A)) [MUST BE A=255]"
$bmp.Dispose()

# Also copy into mipmap directories as ic_launcher_round.png
$resDir = 'C:\SplitMate\android\app\src\main\res'
$densities = @(
    @{ dir = 'mipmap-mdpi';    size = 48 },
    @{ dir = 'mipmap-hdpi';    size = 72 },
    @{ dir = 'mipmap-xhdpi';   size = 96 },
    @{ dir = 'mipmap-xxhdpi';  size = 144 },
    @{ dir = 'mipmap-xxxhdpi'; size = 192 }
)

foreach ($d in $densities) {
    $s = $d.size
    $outBmp = New-Object System.Drawing.Bitmap($s, $s, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
    $g2 = [System.Drawing.Graphics]::FromImage($outBmp)
    $g2.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $g2.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
    $g2.Clear([System.Drawing.Color]::FromArgb(0, 0, 0, 0))

    $path2 = New-Object System.Drawing.Drawing2D.GraphicsPath
    $path2.AddEllipse(1, 1, $s - 2, $s - 2)
    $wb2 = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(255, 255, 255, 255))
    $g2.FillPath($wb2, $path2)
    $g2.SetClip($path2)

    if (Test-Path $fgPath) {
        $fg = [System.Drawing.Bitmap]::FromFile($fgPath)
        $p2 = [int]($s * 0.18)
        $t2 = $s - ($p2 * 2)
        $dRect2 = New-Object System.Drawing.Rectangle($p2, $p2, $t2, $t2)
        $sRect2 = New-Object System.Drawing.Rectangle(0, 0, $fg.Width, $fg.Height)
        $g2.DrawImage($fg, $dRect2, $sRect2, [System.Drawing.GraphicsUnit]::Pixel)
        $fg.Dispose()
    }

    $wb2.Dispose()
    $path2.Dispose()
    $g2.Dispose()

    $roundPath = Join-Path $resDir "$($d.dir)\ic_launcher_round.png"
    $outBmp.Save($roundPath, [System.Drawing.Imaging.ImageFormat]::Png)
    $outBmp.Dispose()
    Write-Host "Saved circular ic_launcher_round.png for $($d.dir)"
}
