Add-Type -AssemblyName System.Drawing

$src = [System.Drawing.Bitmap]::FromFile('C:\SplitMate\assets\notification-icon.png')
Write-Host "Source Size: $($src.Width)x$($src.Height)"

$minX = $src.Width; $maxX = 0; $minY = $src.Height; $maxY = 0
for ($y = 0; $y -lt $src.Height; $y++) {
    for ($x = 0; $x -lt $src.Width; $x++) {
        $p = $src.GetPixel($x, $y)
        if ($p.A -gt 10) {
            if ($x -lt $minX) { $minX = $x }
            if ($x -gt $maxX) { $maxX = $x }
            if ($y -lt $minY) { $minY = $y }
            if ($y -gt $maxY) { $maxY = $y }
        }
    }
}
Write-Host "Bounding box of non-transparent content: X=[$minX, $maxX], Y=[$minY, $maxY]"
$src.Dispose()
