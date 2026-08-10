Add-Type -AssemblyName System.Drawing

$files = Get-ChildItem -Recurse 'C:\SplitMate\android\app\src\main\res' | Where-Object { $_.Name -eq 'notification_icon.png' }
foreach ($f in $files) {
    $bmp = [System.Drawing.Bitmap]::FromFile($f.FullName)
    $corner = $bmp.GetPixel(0, 0)
    $center = $bmp.GetPixel([int]($bmp.Width/2), [int]($bmp.Height/2))
    Write-Host "$($f.FullName) ($($bmp.Width)x$($bmp.Height)):"
    Write-Host "  Corner(0,0): RGBA($($corner.R),$($corner.G),$($corner.B),$($corner.A))"
    Write-Host "  Center:      RGBA($($center.R),$($center.G),$($center.B),$($center.A))"
    $bmp.Dispose()
}
