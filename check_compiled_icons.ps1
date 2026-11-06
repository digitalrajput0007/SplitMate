Add-Type -AssemblyName System.Drawing

$files = @(
    'C:\SplitMate\android\app\src\main\res\drawable-hdpi\notification_icon.png',
    'C:\SplitMate\android\app\src\main\res\drawable-xxhdpi\notification_icon.png',
    'C:\SplitMate\android\app\src\main\res\drawable-xxxhdpi\notification_icon.png'
)

foreach ($f in $files) {
    $bmp = [System.Drawing.Bitmap]::FromFile($f)
    $corner = $bmp.GetPixel(0, 0)
    $center = $bmp.GetPixel([int]($bmp.Width / 2), [int]($bmp.Height / 2))
    Write-Host "File: $([System.IO.Path]::GetFileName([System.IO.Path]::GetDirectoryName($f)))\$([System.IO.Path]::GetFileName($f))"
    Write-Host "  Size: $($bmp.Width)x$($bmp.Height)"
    Write-Host "  Corner: R=$($corner.R) G=$($corner.G) B=$($corner.B) A=$($corner.A)"
    Write-Host "  Center: R=$($center.R) G=$($center.G) B=$($center.B) A=$($center.A)"
    $bmp.Dispose()
}
