Add-Type -AssemblyName System.Drawing

$f = 'C:\SplitMate\android\app\src\main\res\drawable\notification_large_icon.png'
if (Test-Path $f) {
    $b = [System.Drawing.Bitmap]::FromFile($f)
    Write-Host "File: $f ($($b.Width)x$($b.Height))"
    $center = $b.GetPixel([int]($b.Width/2), [int]($b.Height/2))
    $edge = $b.GetPixel(10, [int]($b.Height/2))
    $corner = $b.GetPixel(5, 5)
    Write-Host "  Corner(5,5): RGBA($($corner.R),$($corner.G),$($corner.B),$($corner.A))"
    Write-Host "  Edge(10,mid): RGBA($($edge.R),$($edge.G),$($edge.B),$($edge.A))"
    Write-Host "  Center:       RGBA($($center.R),$($center.G),$($center.B),$($center.A))"
    $b.Dispose()
}
