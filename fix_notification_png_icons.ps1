Add-Type -AssemblyName System.Drawing

$srcPath = 'C:\SplitMate\assets\notification-icon.png'
$resDir  = 'C:\SplitMate\android\app\src\main\res'

if (-not (Test-Path $srcPath)) {
    Write-Error "Source notification-icon.png not found at $srcPath!"
    exit 1
}

$src = [System.Drawing.Bitmap]::FromFile($srcPath)
Write-Host "Source notification-icon.png loaded ($($src.Width)x$($src.Height))."

$densities = @(
    @{ dir = 'drawable-mdpi';    size = 24 },
    @{ dir = 'drawable-hdpi';    size = 36 },
    @{ dir = 'drawable-xhdpi';   size = 48 },
    @{ dir = 'drawable-xxhdpi';  size = 72 },
    @{ dir = 'drawable-xxxhdpi'; size = 96 },
    @{ dir = 'drawable';         size = 96 }
)

foreach ($d in $densities) {
    $folder = Join-Path $resDir $d.dir
    if (-not (Test-Path $folder)) {
        New-Item -ItemType Directory -Path $folder -Force | Out-Null
    }

    $size = $d.size
    $bmp = New-Object System.Drawing.Bitmap($size, $size, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
    $g = [System.Drawing.Graphics]::FromImage($bmp)
    $g.Clear([System.Drawing.Color]::Transparent)
    $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
    $g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality

    $destRect = New-Object System.Drawing.Rectangle(0, 0, $size, $size)
    $srcRect  = New-Object System.Drawing.Rectangle(0, 0, $src.Width, $src.Height)
    $g.DrawImage($src, $destRect, $srcRect, [System.Drawing.GraphicsUnit]::Pixel)
    $g.Dispose()

    # Enforce pure white stencil with alpha transparency
    for ($y = 0; $y -lt $size; $y++) {
        for ($x = 0; $x -lt $size; $x++) {
            $p = $bmp.GetPixel($x, $y)
            if ($p.A -gt 30) {
                $bmp.SetPixel($x, $y, [System.Drawing.Color]::FromArgb($p.A, 255, 255, 255))
            } else {
                $bmp.SetPixel($x, $y, [System.Drawing.Color]::FromArgb(0, 0, 0, 0))
            }
        }
    }

    $outPath = Join-Path $folder 'notification_icon.png'
    $bmp.Save($outPath, [System.Drawing.Imaging.ImageFormat]::Png)
    $bmp.Dispose()

    Write-Host "Created $outPath ($size x $size)."
}

$src.Dispose()

# Delete problematic notification_icon.xml if present
$xmlPath = Join-Path $resDir 'drawable\notification_icon.xml'
if (Test-Path $xmlPath) {
    Remove-Item $xmlPath -Force
    Write-Host "Removed vector $xmlPath to prevent RemoteViews black rectangle issue."
}

Write-Host "Notification icon PNG generation complete."
