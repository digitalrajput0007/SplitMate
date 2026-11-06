Add-Type -AssemblyName System.Drawing

Write-Host "=== NOTIFICATION ICON DIAGNOSTICS ==="
Write-Host ""

# 1. Check source notification-icon.png
Write-Host "--- Source notification-icon.png ---"
$src = [System.Drawing.Bitmap]::FromFile('C:\SplitMate\assets\notification-icon.png')
Write-Host "Size: $($src.Width)x$($src.Height)"
Write-Host "PixelFormat: $($src.PixelFormat)"
$c1 = $src.GetPixel(0,0); Write-Host "Corner(0,0): R=$($c1.R) G=$($c1.G) B=$($c1.B) A=$($c1.A)"
$c2 = $src.GetPixel([int]($src.Width/2),[int]($src.Height/2)); Write-Host "Center: R=$($c2.R) G=$($c2.G) B=$($c2.B) A=$($c2.A)"
$src.Dispose()

Write-Host ""

# 2. Check foreground_layer.png (adaptive icon foreground)
Write-Host "--- foreground_layer.png (Adaptive Icon Foreground) ---"
$fg = [System.Drawing.Bitmap]::FromFile('C:\SplitMate\assets\foreground_layer.png')
Write-Host "Size: $($fg.Width)x$($fg.Height)"
Write-Host "PixelFormat: $($fg.PixelFormat)"
$f1 = $fg.GetPixel(0,0); Write-Host "Corner(0,0): R=$($f1.R) G=$($f1.G) B=$($f1.B) A=$($f1.A)"
$f2 = $fg.GetPixel([int]($fg.Width/2),[int]($fg.Height/2)); Write-Host "Center: R=$($f2.R) G=$($f2.G) B=$($f2.B) A=$($f2.A)"
# Sample a few corners
$f3 = $fg.GetPixel(10,10); Write-Host "Near corner(10,10): R=$($f3.R) G=$($f3.G) B=$($f3.B) A=$($f3.A)"
$f4 = $fg.GetPixel($fg.Width-10,10); Write-Host "Near corner(W-10,10): R=$($f4.R) G=$($f4.G) B=$($f4.B) A=$($f4.A)"
$fg.Dispose()

Write-Host ""

# 3. Check compiled notification icons
Write-Host "--- Compiled Notification Icons in Android Res ---"
$densities = @('drawable-mdpi','drawable-hdpi','drawable-xhdpi','drawable-xxhdpi','drawable-xxxhdpi')
foreach ($d in $densities) {
    $path = "C:\SplitMate\android\app\src\main\res\$d\notification_icon.png"
    if (Test-Path $path) {
        $b = [System.Drawing.Bitmap]::FromFile($path)
        $corner = $b.GetPixel(0,0)
        $center = $b.GetPixel([int]($b.Width/2),[int]($b.Height/2))
        Write-Host "$d ($($b.Width)x$($b.Height)): corner A=$($corner.A), center R=$($center.R) G=$($center.G) B=$($center.B) A=$($center.A)"
        $b.Dispose()
    }
}

Write-Host ""

# 4. Check compiled launcher icons (what shows as app icon in notifications)
Write-Host "--- Compiled Launcher Icons (what shows in notification card) ---"
$icFiles = Get-ChildItem -Recurse 'C:\SplitMate\android\app\src\main\res' | Where-Object { $_.Name -like 'ic_launcher.png' -or $_.Name -like 'ic_launcher_round.png' -or $_.Name -like 'ic_launcher_foreground.png' }
foreach ($f in $icFiles) {
    $b = [System.Drawing.Bitmap]::FromFile($f.FullName)
    $corner = $b.GetPixel(0,0)
    $center = $b.GetPixel([int]($b.Width/2),[int]($b.Height/2))
    $rel = $f.FullName.Replace('C:\SplitMate\android\app\src\main\res\','')
    Write-Host "$rel ($($b.Width)x$($b.Height)): corner R=$($corner.R) G=$($corner.G) B=$($corner.B) A=$($corner.A), center R=$($center.R) G=$($center.G) B=$($center.B) A=$($center.A)"
    $b.Dispose()
}
