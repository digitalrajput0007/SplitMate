Add-Type -AssemblyName System.Drawing

$resDir = 'C:\SplitMate\android\app\src\main\res'
$mipmaps = Get-ChildItem $resDir -Directory | Where-Object { $_.Name -like 'mipmap*' }

foreach ($m in $mipmaps) {
    Write-Host "=== $($m.Name) ==="
    $files = Get-ChildItem $m.FullName -File
    foreach ($f in $files) {
        if ($f.Extension -eq '.xml') {
            Write-Host "  $($f.Name) (XML file)"
            continue
        }
        try {
            $img = [System.Drawing.Image]::FromFile($f.FullName)
            $bmp = New-Object System.Drawing.Bitmap($img)
            $corner = $bmp.GetPixel(0, 0)
            $center = $bmp.GetPixel([int]($bmp.Width/2), [int]($bmp.Height/2))
            Write-Host "  $($f.Name) ($($bmp.Width)x$($bmp.Height)): Corner(0,0)=RGBA($($corner.R),$($corner.G),$($corner.B),$($corner.A)), Center=RGBA($($center.R),$($center.G),$($center.B),$($center.A))"
            $bmp.Dispose()
            $img.Dispose()
        } catch {
            Write-Host "  $($f.Name): Error reading image - $($_.Exception.Message)"
        }
    }
}
