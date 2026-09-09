Add-Type -AssemblyName System.Drawing

function Render-PaisaIcon([int]$size, [string]$outputPath, [bool]$isMaskable) {
    $bmp = New-Object System.Drawing.Bitmap($size, $size)
    $g = [System.Drawing.Graphics]::FromImage($bmp)
    $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
    $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality

    $rect = New-Object System.Drawing.Rectangle(0, 0, $size, $size)
    $c1 = [System.Drawing.ColorTranslator]::FromHtml("#1b5a53")
    $c2 = [System.Drawing.ColorTranslator]::FromHtml("#2c9489")
    $bgBrush = New-Object System.Drawing.Drawing2D.LinearGradientBrush($rect, $c1, $c2, [float]45.0)

    if ($isMaskable) {
        $g.FillRectangle($bgBrush, $rect)
    } else {
        $corner = [int]($size * 0.22)
        $path = New-Object System.Drawing.Drawing2D.GraphicsPath
        $path.AddArc(0, 0, [int]($corner * 2), [int]($corner * 2), 180, 90)
        $path.AddArc([int]($size - $corner * 2), 0, [int]($corner * 2), [int]($corner * 2), 270, 90)
        $path.AddArc([int]($size - $corner * 2), [int]($size - $corner * 2), [int]($corner * 2), [int]($corner * 2), 0, 90)
        $path.AddArc(0, [int]($size - $corner * 2), [int]($corner * 2), [int]($corner * 2), 90, 90)
        $path.CloseFigure()
        $g.FillPath($bgBrush, $path)
        $path.Dispose()
    }

    $scale = [float]$size / 512.0
    $badgeRadius = [int](140.0 * $scale)
    $badgeDiameter = [int]($badgeRadius * 2)
    $badgeX = [int](($size - $badgeDiameter) / 2)
    $badgeY = [int](($size - $badgeDiameter) / 2)
    $badgeRect = New-Object System.Drawing.Rectangle($badgeX, $badgeY, $badgeDiameter, $badgeDiameter)

    $coin1 = [System.Drawing.ColorTranslator]::FromHtml("#f89e7a")
    $coin2 = [System.Drawing.ColorTranslator]::FromHtml("#e17551")
    $coinBrush = New-Object System.Drawing.Drawing2D.LinearGradientBrush($badgeRect, $coin1, $coin2, [float]90.0)
    $g.FillEllipse($coinBrush, $badgeRect)

    $penWidth = [float][Math]::Max(1.5, 3.0 * $scale)
    $whitePen = New-Object System.Drawing.Pen([System.Drawing.Color]::FromArgb(60, 255, 255, 255), $penWidth)
    $g.DrawEllipse($whitePen, $badgeRect)

    $fontSize = [float](170.0 * $scale)
    $font = New-Object System.Drawing.Font("Segoe UI", $fontSize, [System.Drawing.FontStyle]::Bold, [System.Drawing.GraphicsUnit]::Pixel)
    $stringFormat = New-Object System.Drawing.StringFormat
    $stringFormat.Alignment = [System.Drawing.StringAlignment]::Center
    $stringFormat.LineAlignment = [System.Drawing.StringAlignment]::Center

    $textBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::White)
    $textRect = New-Object System.Drawing.RectangleF([float]0.0, [float]($size * 0.01), [float]$size, [float]$size)
    $rupeeChar = [char]0x20B9
    $g.DrawString($rupeeChar.ToString(), $font, $textBrush, $textRect, $stringFormat)

    $bmp.Save($outputPath, [System.Drawing.Imaging.ImageFormat]::Png)

    $font.Dispose()
    $stringFormat.Dispose()
    $textBrush.Dispose()
    $whitePen.Dispose()
    $coinBrush.Dispose()
    $bgBrush.Dispose()
    $g.Dispose()
    $bmp.Dispose()
}

$pub = "d:\Expense\Expense-Manager-main\artifacts\expense-manager\public"
Render-PaisaIcon 192 "$pub\pwa-192x192.png" $false
Render-PaisaIcon 512 "$pub\pwa-512x512.png" $false
Render-PaisaIcon 512 "$pub\maskable-icon-512x512.png" $true
Render-PaisaIcon 180 "$pub\apple-touch-icon.png" $false
Write-Output "ALL_ICONS_SUCCESS"
