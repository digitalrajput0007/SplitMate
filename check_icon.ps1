Add-Type -AssemblyName System.Drawing
$bmp = [System.Drawing.Bitmap]::FromFile('C:\SplitMate\assets\notification-icon.png')
$corner = $bmp.GetPixel(0, 0)
$center = $bmp.GetPixel([int]($bmp.Width / 2), [int]($bmp.Height / 2))
Write-Host "Size: $($bmp.Width)x$($bmp.Height)"
Write-Host "Corner pixel - R:$($corner.R) G:$($corner.G) B:$($corner.B) A:$($corner.A)"
Write-Host "Center pixel - R:$($center.R) G:$($center.G) B:$($center.B) A:$($center.A)"
$bmp.Dispose()
