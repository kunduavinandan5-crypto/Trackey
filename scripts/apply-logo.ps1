Add-Type -AssemblyName System.Drawing

$src = "C:\Users\kundu\.gemini\antigravity-ide\brain\f6825fdd-9bb0-4915-887f-8bb7ac1a5ffe\.user_uploaded\media_1789879310912.jpg"
$pub = "d:\Expense\artifacts\expense-manager\public"

function Resize-Img($inPath, $outPath, [int]$w, [int]$h) {
    $img = [System.Drawing.Image]::FromFile($inPath)
    $bmp = New-Object System.Drawing.Bitmap($w, $h)
    $g = [System.Drawing.Graphics]::FromImage($bmp)
    $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
    $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
    $g.DrawImage($img, 0, 0, $w, $h)
    $bmp.Save($outPath, [System.Drawing.Imaging.ImageFormat]::Png)
    $g.Dispose()
    $bmp.Dispose()
    $img.Dispose()
}

Resize-Img $src "$pub\logo.png" 512 512
Resize-Img $src "$pub\pwa-512x512.png" 512 512
Resize-Img $src "$pub\pwa-192x192.png" 192 192
Resize-Img $src "$pub\apple-touch-icon.png" 180 180
Resize-Img $src "$pub\maskable-icon-512x512.png" 512 512
Resize-Img $src "$pub\favicon.png" 64 64
Resize-Img $src "$pub\favicon-32x32.png" 32 32
Resize-Img $src "$pub\favicon-16x16.png" 16 16

# Convert to icon format
$pngBmp = [System.Drawing.Bitmap]::FromFile("$pub\favicon-32x32.png")
$iconHandle = $pngBmp.GetHicon()
$icon = [System.Drawing.Icon]::FromHandle($iconHandle)
$stream = New-Object System.IO.FileStream("$pub\favicon.ico", [System.IO.FileMode]::Create)
$icon.Save($stream)
$stream.Close()
$pngBmp.Dispose()

# Create SVG favicon with embedded base64 image
$bytes = [System.IO.File]::ReadAllBytes("$pub\logo.png")
$b64 = [Convert]::ToBase64String($bytes)
$svgContent = '<svg width="512" height="512" viewBox="0 0 512 512" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink"><image width="512" height="512" xlink:href="data:image/png;base64,' + $b64 + '"/></svg>'

[System.IO.File]::WriteAllText("$pub\favicon.svg", $svgContent)
[System.IO.File]::WriteAllText("$pub\icon.svg", $svgContent)

Write-Output "ALL_FAVICONS_AND_LOGOS_SAVED_SUCCESS"
