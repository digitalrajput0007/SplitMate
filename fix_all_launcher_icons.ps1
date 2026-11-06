Add-Type -AssemblyName System.Drawing

$resDir = 'C:\SplitMate\android\app\src\main\res'
$fgPath = 'C:\SplitMate\assets\foreground_layer.png'

$densities = @(
    @{ dir = 'mipmap-mdpi';    size = 48 },
    @{ dir = 'mipmap-hdpi';    size = 72 },
    @{ dir = 'mipmap-xhdpi';   size = 96 },
    @{ dir = 'mipmap-xxhdpi';  size = 144 },
    @{ dir = 'mipmap-xxxhdpi'; size = 192 }
)

$fg = [System.Drawing.Bitmap]::FromFile($fgPath)

foreach ($d in $densities) {
    $folderPath = Join-Path $resDir $d.dir
    $size = $d.size

    Write-Host "Processing $($d.dir) (${size}x${size})..."

    # Create solid white 32bppArgb bitmap
    $bmp = New-Object System.Drawing.Bitmap($size, $size, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
    $g = [System.Drawing.Graphics]::FromImage($bmp)
    $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
    $g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality

    # Fill solid white background (NO TRANSPARENCY)
    $g.Clear([System.Drawing.Color]::FromArgb(255, 255, 255, 255))

    # Draw foreground logo centered with 12% padding
    $padding = [int]($size * 0.12)
    $targetSize = $size - ($padding * 2)
    $destRect = New-Object System.Drawing.Rectangle($padding, $padding, $targetSize, $targetSize)
    $srcRect = New-Object System.Drawing.Rectangle(0, 0, $fg.Width, $fg.Height)
    $g.DrawImage($fg, $destRect, $srcRect, [System.Drawing.GraphicsUnit]::Pixel)
    $g.Dispose()

    # Flatten any remaining transparent pixels to solid white
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

    # Save as PNG over ic_launcher.png and ic_launcher_round.png in mipmap folder
    # Note: Android supports PNG in mipmap folders natively alongside/replacing WEBP
    $pngLauncher = Join-Path $folderPath 'ic_launcher.png'
    $pngRound    = Join-Path $folderPath 'ic_launcher_round.png'
    $webpLauncher = Join-Path $folderPath 'ic_launcher.webp'
    $webpRound    = Join-Path $folderPath 'ic_launcher_round.webp'

    # Remove old webp files to ensure PNG replaces them
    if (Test-Path $webpLauncher) { Remove-Item $webpLauncher -Force }
    if (Test-Path $webpRound)    { Remove-Item $webpRound -Force }

    $bmp.Save($pngLauncher, [System.Drawing.Imaging.ImageFormat]::Png)
    $bmp.Save($pngRound, [System.Drawing.Imaging.ImageFormat]::Png)
    $bmp.Dispose()

    Write-Host "  -> Saved solid PNG ic_launcher & ic_launcher_round for $($d.dir)."
}

$fg.Dispose()
Write-Host ""
Write-Host "Successfully converted all launcher icons across all mipmap folders to solid white full-color PNGs!"
