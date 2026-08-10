Add-Type -AssemblyName System.Drawing

$srcPath = 'C:\SplitMate\assets\notification-icon.png'
$bmp = [System.Drawing.Bitmap]::FromFile($srcPath)
Write-Host "Size: $($bmp.Width)x$($bmp.Height)"
Write-Host "Corner(0,0): RGBA($($bmp.GetPixel(0,0).R),$($bmp.GetPixel(0,0).G),$($bmp.GetPixel(0,0).B),$($bmp.GetPixel(0,0).A))"
Write-Host "Center(96,96): RGBA($($bmp.GetPixel(96,96).R),$($bmp.GetPixel(96,96).G),$($bmp.GetPixel(96,96).B),$($bmp.GetPixel(96,96).A))"

$semiCount = 0
for ($y = 0; $y -lt $bmp.Height; $y++) {
    for ($x = 0; $x -lt $bmp.Width; $x++) {
        $a = $bmp.GetPixel($x, $y).A
        if ($a -gt 0 -and $a -lt 255) {
            $semiCount++
        }
    }
}
Write-Host "Semi-transparent pixels (0 < A < 255): $semiCount"
$bmp.Dispose()
