Add-Type -AssemblyName System.Drawing

Write-Host "=== Checking icon.png (used for ic_launcher legacy) ==="
$icon = [System.Drawing.Bitmap]::FromFile('C:\SplitMate\assets\icon.png')
Write-Host "Size: $($icon.Width)x$($icon.Height)"
$c1 = $icon.GetPixel(0, 0)
$c2 = $icon.GetPixel([int]($icon.Width/2), [int]($icon.Height/2))
$c3 = $icon.GetPixel(10, 10)
Write-Host "Corner(0,0):     R=$($c1.R) G=$($c1.G) B=$($c1.B) A=$($c1.A)"
Write-Host "Near-corner(10,10): R=$($c3.R) G=$($c3.G) B=$($c3.B) A=$($c3.A)"
Write-Host "Center:          R=$($c2.R) G=$($c2.G) B=$($c2.B) A=$($c2.A)"
$icon.Dispose()

Write-Host ""
Write-Host "=== Checking assets in directory ==="
Get-ChildItem 'C:\SplitMate\assets' | Select-Object Name, Length | Sort-Object Name
