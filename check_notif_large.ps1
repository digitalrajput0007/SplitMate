Add-Type -AssemblyName System.Drawing

Write-Host "=== Inspecting notification_large.png ==="
$path = 'C:\SplitMate\assets\notification_large.png'
if (Test-Path $path) {
    $bmp = [System.Drawing.Bitmap]::FromFile($path)
    Write-Host "Size: $($bmp.Width)x$($bmp.Height)"
    Write-Host "PixelFormat: $($bmp.PixelFormat)"
    $c0 = $bmp.GetPixel(0, 0)
    $c1 = $bmp.GetPixel(10, 10)
    $center = $bmp.GetPixel([int]($bmp.Width/2), [int]($bmp.Height/2))
    Write-Host "Corner(0,0): RGBA($($c0.R), $($c0.G), $($c0.B), $($c0.A))"
    Write-Host "Corner(10,10): RGBA($($c1.R), $($c1.G), $($c1.B), $($c1.A))"
    Write-Host "Center: RGBA($($center.R), $($center.G), $($center.B), $($center.A))"
    $bmp.Dispose()
} else {
    Write-Host "File not found: $path"
}
