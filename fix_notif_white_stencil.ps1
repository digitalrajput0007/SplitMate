Add-Type -AssemblyName System.Drawing

# Read source notification-icon.png
$srcPath = 'C:\SplitMate\assets\notification-icon.png'
$src = [System.Drawing.Bitmap]::FromFile($srcPath)

Write-Host "Source size: $($src.Width)x$($src.Height)"

# Target: 192x192 square
$size = 192

# Create output bitmap
$out = New-Object System.Drawing.Bitmap($size, $size, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)

# Fill all pixels: transparent background, white icon
# First draw the source scaled to fit with padding
$g = [System.Drawing.Graphics]::FromImage($out)
$g.Clear([System.Drawing.Color]::Transparent)
$g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
$g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality

$padding = 20
$inner = $size - ($padding * 2)
$destRect = New-Object System.Drawing.Rectangle($padding, $padding, $inner, $inner)
$srcRect = New-Object System.Drawing.Rectangle(0, 0, $src.Width, $src.Height)
$g.DrawImage($src, $destRect, $srcRect, [System.Drawing.GraphicsUnit]::Pixel)
$g.Dispose()
$src.Dispose()

# Now post-process: enforce strict white/transparent
# Any pixel with A > 30 -> pure white (255,255,255,255)
# Any pixel with A <= 30 -> fully transparent (0,0,0,0)
Write-Host "Post-processing pixels to pure white stencil..."
for ($y = 0; $y -lt $size; $y++) {
    for ($x = 0; $x -lt $size; $x++) {
        $p = $out.GetPixel($x, $y)
        if ($p.A -gt 30) {
            $out.SetPixel($x, $y, [System.Drawing.Color]::FromArgb(255, 255, 255, 255))
        } else {
            $out.SetPixel($x, $y, [System.Drawing.Color]::FromArgb(0, 0, 0, 0))
        }
    }
}

# Verify
$corner = $out.GetPixel(0, 0)
$center = $out.GetPixel(96, 96)
Write-Host "Result corner: R=$($corner.R) G=$($corner.G) B=$($corner.B) A=$($corner.A)"
Write-Host "Result center: R=$($center.R) G=$($center.G) B=$($center.B) A=$($center.A)"

$out.Save($srcPath, [System.Drawing.Imaging.ImageFormat]::Png)
$out.Dispose()

Write-Host "Saved clean 192x192 white stencil notification-icon.png"
