Add-Type -AssemblyName System.Drawing

$files = @(
    'C:\SplitMate\android\app\src\main\res\drawable\notification_icon.png',
    'C:\SplitMate\android\app\src\main\res\drawable-xxhdpi\notification_icon.png',
    'C:\SplitMate\android\app\src\main\res\drawable\notification_large_icon.png'
)

foreach ($f in $files) {
    if (Test-Path $f) {
        $b = [System.Drawing.Bitmap]::FromFile($f)
        $opaque = 0
        $trans = 0
        for ($y = 0; $y -lt $b.Height; $y++) {
            for ($x = 0; $x -lt $b.Width; $x++) {
                $p = $b.GetPixel($x, $y)
                if ($p.A -gt 10) { $opaque++ } else { $trans++ }
            }
        }
        Write-Host "$f ($($b.Width)x$($b.Height)):"
        Write-Host "  Opaque pixels (A>10): $opaque"
        Write-Host "  Transparent pixels (A<=10): $trans"
        Write-Host "  Corner (0,0): A=$($b.GetPixel(0,0).A)"
        $b.Dispose()
    } else {
        Write-Host "File not found: $f"
    }
}
