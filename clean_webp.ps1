$files = Get-ChildItem -Recurse 'C:\SplitMate\android\app\src\main\res' | Where-Object { $_.Name -like 'ic_launcher*.webp' }
foreach ($f in $files) {
    Remove-Item $f.FullName -Force
    Write-Host "Deleted $($f.FullName)"
}
Write-Host "All WebP duplicate launcher files removed."
