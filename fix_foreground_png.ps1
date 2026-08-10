Add-Type -AssemblyName System.Drawing

$resDir = 'C:\SplitMate\android\app\src\main\res'
$fgPath = 'C:\SplitMate\assets\foreground_layer.png'

$densities = @(
    @{ dir = 'mipmap-mdpi';    size = 108 },
    @{ dir = 'mipmap-hdpi';    size = 162 },
    @{ dir = 'mipmap-xhdpi';   size = 216 },
    @{ dir = 'mipmap-xxhdpi';  size = 324 },
    @{ dir = 'mipmap-xxxhdpi'; size = 432 }
)

$fg = [System.Drawing.Bitmap]::FromFile($fgPath)

foreach ($d in $densities) {
    $folderPath = Join-Path $resDir $d.dir
    $size = $d.size

    Write-Host "Creating $($d.dir)\ic_launcher_foreground.png (${size}x${size})..."

    $bmp = New-Object System.Drawing.Bitmap($size, $size, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
    $g = [System.Drawing.Graphics]::FromImage($bmp)
    $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
    $g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality

    $g.Clear([System.Drawing.Color]::FromArgb(0, 0, 0, 0))

    $destRect = New-Object System.Drawing.Rectangle(0, 0, $size, $size)
    $srcRect = New-Object System.Drawing.Rectangle(0, 0, $fg.Width, $fg.Height)
    $g.DrawImage($fg, $destRect, $srcRect, [System.Drawing.GraphicsUnit]::Pixel)
    $g.Dispose()

    $targetFile = Join-Path $folderPath 'ic_launcher_foreground.png'
    $bmp.Save($targetFile, [System.Drawing.Imaging.ImageFormat]::Png)
    $bmp.Dispose()
}

$fg.Dispose()
Write-Host "ic_launcher_foreground.png generated for all densities!"
