Add-Type -AssemblyName System.Drawing

function Generate-Icon {
    param (
        [int]$size,
        [string]$outputPath,
        [bool]$isMaskable
    )
    $bmp = New-Object System.Drawing.Bitmap($size, $size)
    $g = [System.Drawing.Graphics]::FromImage($bmp)
    $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
    $g.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::AntiAliasGridFit
    $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic

    # Background
    $bgBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(255, 9, 9, 11))
    $g.FillRectangle($bgBrush, 0, 0, $size, $size)

    # Margins
    $margin = if ($isMaskable) { [int]($size * 0.18) } else { [int]($size * 0.08) }
    $diam = $size - ($margin * 2)

    # Outer Coin Rim
    $goldPen = New-Object System.Drawing.Pen([System.Drawing.Color]::FromArgb(255, 245, 158, 11), [float]($size * 0.04))
    $g.DrawEllipse($goldPen, $margin, $margin, $diam, $diam)

    # Inner Coin Rim
    $innerMargin = $margin + [int]($size * 0.04)
    $innerDiam = $diam - [int]($size * 0.08)
    $emeraldPen = New-Object System.Drawing.Pen([System.Drawing.Color]::FromArgb(255, 16, 185, 129), [float]($size * 0.015))
    $emeraldPen.DashStyle = [System.Drawing.Drawing2D.DashStyle]::Dash
    $g.DrawEllipse($emeraldPen, $innerMargin, $innerMargin, $innerDiam, $innerDiam)

    # Draw Monogram 'D'
    $fontFamily = [System.Drawing.FontFamily]::GenericSansSerif
    $fontSize = [float]($size * 0.38)
    $font = New-Object System.Drawing.Font($fontFamily, $fontSize, [System.Drawing.FontStyle]::Bold)
    $goldBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(255, 245, 158, 11))
    
    $sf = New-Object System.Drawing.StringFormat
    $sf.Alignment = [System.Drawing.StringAlignment]::Center
    $sf.LineAlignment = [System.Drawing.StringAlignment]::Center
    
    $rect = New-Object System.Drawing.RectangleF(0, -[float]($size * 0.03), $size, $size)
    $g.DrawString('D', $font, $goldBrush, $rect, $sf)

    # Accent bar at bottom (emerald)
    $barW = [int]($size * 0.22)
    $barH = [int]($size * 0.03)
    $barX = [int](($size - $barW) / 2)
    $barY = [int]($size * 0.72)
    $emeraldBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(255, 16, 185, 129))
    $g.FillRectangle($emeraldBrush, $barX, $barY, $barW, $barH)

    # Small gold accent dots
    $dotBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(255, 217, 119, 6))
    $dotSize = [int]($size * 0.02)
    $g.FillEllipse($dotBrush, [int]($barX - $dotSize * 2), $barY, $dotSize, $dotSize)
    $g.FillEllipse($dotBrush, [int]($barX + $barW + $dotSize), $barY, $dotSize, $dotSize)

    $bmp.Save($outputPath, [System.Drawing.Imaging.ImageFormat]::Png)
    $g.Dispose()
    $bmp.Dispose()
    Write-Output "Successfully created $outputPath"
}

Generate-Icon -size 512 -outputPath "public\icon-512.png" -isMaskable $false
Generate-Icon -size 192 -outputPath "public\icon-192.png" -isMaskable $false
Generate-Icon -size 512 -outputPath "public\icon-maskable-512.png" -isMaskable $true
Generate-Icon -size 192 -outputPath "public\icon-maskable-192.png" -isMaskable $true
