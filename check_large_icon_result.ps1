Add-Type -AssemblyName System.Drawing

$path = 'C:\SplitMate\android\app\src\main\res\drawable\notification_large_icon.png'
$bmp = [System.Drawing.Bitmap]::FromFile($path)

Write-Host "Size: $($bmp.Width)x$($bmp.Height)"
$c0 = $bmp.GetPixel(0, 0)
$c1 = $bmp.GetPixel(10, 10)
$center = $bmp.GetPixel([int]($bmp.Width/2), [int]($bmp.Height/2))

Write-Host "Corner(0,0):   RGBA($($c0.R), $($c0.G), $($c0.B), $($c0.A))"
Write-Host "Corner(10,10): RGBA($($c1.R), $($c1.G), $($c1.B), $($c1.A))"
Write-Host "Center:        RGBA($($center.R), $($center.G), $($center.B), $($center.A))"

$transparentCount = 0
for ($y = 0; $y -lt $bmp.Height; $y++) {
    for ($x = 0; $x -lt $bmp.Width; $x++) {
        if ($bmp.GetPixel($x, $y).A -ne 255) {
            $transparentCount++
        }
    }
}
Write-Host "Transparent pixels count: $transparentCount / $($bmp.Width * $bmp.Height)"

$bmp.Dispose()
