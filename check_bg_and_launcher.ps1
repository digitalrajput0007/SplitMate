Add-Type -AssemblyName System.Drawing

Write-Host "=== background_layer.png ==="
$b = [System.Drawing.Bitmap]::FromFile('C:\SplitMate\assets\background_layer.png')
$c1 = $b.GetPixel(0, 0)
$c2 = $b.GetPixel([int]($b.Width/2), [int]($b.Height/2))
Write-Host "Size: $($b.Width)x$($b.Height)"
Write-Host "Corner:  R=$($c1.R) G=$($c1.G) B=$($c1.B) A=$($c1.A)"
Write-Host "Center:  R=$($c2.R) G=$($c2.G) B=$($c2.B) A=$($c2.A)"
$b.Dispose()

Write-Host ""
Write-Host "=== ic_launcher mipmap WebP files ==="
# Try to read mipmap-hdpi/ic_launcher.webp using WIC
$files = @(
    'C:\SplitMate\android\app\src\main\res\mipmap-hdpi\ic_launcher.webp',
    'C:\SplitMate\android\app\src\main\res\mipmap-xxxhdpi\ic_launcher.webp',
    'C:\SplitMate\android\app\src\main\res\mipmap-xxxhdpi\ic_launcher_foreground.webp'
)

foreach ($f in $files) {
    if (Test-Path $f) {
        try {
            $img = [System.Drawing.Image]::FromFile($f)
            $bmp = New-Object System.Drawing.Bitmap($img)
            $corner = $bmp.GetPixel(0, 0)
            $center = $bmp.GetPixel([int]($bmp.Width/2), [int]($bmp.Height/2))
            Write-Host "$([System.IO.Path]::GetFileName($f)) ($($bmp.Width)x$($bmp.Height)): corner R=$($corner.R) G=$($corner.G) B=$($corner.B) A=$($corner.A), center R=$($center.R) G=$($center.G) B=$($center.B) A=$($center.A)"
            $bmp.Dispose()
            $img.Dispose()
        } catch {
            Write-Host "$([System.IO.Path]::GetFileName($f)): Cannot read (WebP not supported by GDI+) - $($_.Exception.Message)"
        }
    }
}
