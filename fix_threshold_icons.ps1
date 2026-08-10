Add-Type -AssemblyName System.Drawing

$densityDirs = @(
    'C:\SplitMate\android\app\src\main\res\drawable-mdpi',
    'C:\SplitMate\android\app\src\main\res\drawable-hdpi',
    'C:\SplitMate\android\app\src\main\res\drawable-xhdpi',
    'C:\SplitMate\android\app\src\main\res\drawable-xxhdpi',
    'C:\SplitMate\android\app\src\main\res\drawable-xxxhdpi'
)

foreach ($dir in $densityDirs) {
    $path = "$dir\notification_icon.png"
    if (-not (Test-Path $path)) { continue }

    $bmp = [System.Drawing.Bitmap]::FromFile($path)
    $w = $bmp.Width
    $h = $bmp.Height
    Write-Host "Processing $([System.IO.Path]::GetFileName($dir))\notification_icon.png ($w x $h)..."

    $out = New-Object System.Drawing.Bitmap($w, $h, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)

    $nonTransparent = 0
    for ($y = 0; $y -lt $h; $y++) {
        for ($x = 0; $x -lt $w; $x++) {
            $p = $bmp.GetPixel($x, $y)
            # Threshold: any alpha > 30 = fully opaque white, else fully transparent
            if ($p.A -gt 30) {
                $out.SetPixel($x, $y, [System.Drawing.Color]::FromArgb(255, 255, 255, 255))
                $nonTransparent++
            } else {
                $out.SetPixel($x, $y, [System.Drawing.Color]::FromArgb(0, 0, 0, 0))
            }
        }
    }

    $bmp.Dispose()
    $out.Save($path, [System.Drawing.Imaging.ImageFormat]::Png)
    $out.Dispose()

    $percentage = [Math]::Round($nonTransparent / ($w * $h) * 100, 1)
    Write-Host "  -> $nonTransparent/$($w*$h) pixels are icon (${percentage}% fill). Saved."
}

Write-Host ""
Write-Host "All notification icons thresholded to pure white stencil. Done."
