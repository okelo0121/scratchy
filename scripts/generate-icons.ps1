Add-Type -AssemblyName System.Drawing

function Resize-Img($srcPath, $dstPath, $w, $h) {
    $src = [System.Drawing.Image]::FromFile($srcPath)
    $dest = New-Object System.Drawing.Bitmap($w, $h)
    $g = [System.Drawing.Graphics]::FromImage($dest)
    $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
    $g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
    $g.CompositingQuality = [System.Drawing.Drawing2D.CompositingQuality]::HighQuality
    $g.DrawImage($src, 0, 0, $w, $h)
    $dest.Save($dstPath, [System.Drawing.Imaging.ImageFormat]::Png)
    $g.Dispose()
    $dest.Dispose()
    $src.Dispose()
    Write-Host "Resized to $dstPath ($w x $h)"
}

$src = 'C:\Users\ADMIN\Desktop\projects\scratchy\public\social-icon.png'
Resize-Img $src 'C:\Users\ADMIN\Desktop\projects\scratchy\public\apple-touch-icon.png' 180 180
Resize-Img $src 'C:\Users\ADMIN\Desktop\projects\scratchy\public\icon-192.png' 192 192
Resize-Img $src 'C:\Users\ADMIN\Desktop\projects\scratchy\public\favicon-32x32.png' 32 32
Resize-Img $src 'C:\Users\ADMIN\Desktop\projects\scratchy\public\favicon-16x16.png' 16 16

# Create favicon.ico containing 32x32 PNG (PNG-in-ICO standard)
$pngBytes = [System.IO.File]::ReadAllBytes('C:\Users\ADMIN\Desktop\projects\scratchy\public\favicon-32x32.png')
$icoStream = New-Object System.IO.MemoryStream
$writer = New-Object System.IO.BinaryWriter($icoStream)

# ICONDIR header: Reserved (0), Type (1 = ICO), ImageCount (1)
$writer.Write([uint16]0)
$writer.Write([uint16]1)
$writer.Write([uint16]1)

# ICONDIRENTRY: Width (32), Height (32), Colors (0 = no palette), Reserved (0), Planes (1), BitCount (32), BytesInRes, ImageOffset (22)
$writer.Write([byte]32)
$writer.Write([byte]32)
$writer.Write([byte]0)
$writer.Write([byte]0)
$writer.Write([uint16]1)
$writer.Write([uint16]32)
$writer.Write([uint32]$pngBytes.Length)
$writer.Write([uint32]22)

# Write PNG bytes
$writer.Write($pngBytes)
$writer.Flush()

[System.IO.File]::WriteAllBytes('C:\Users\ADMIN\Desktop\projects\scratchy\public\favicon.ico', $icoStream.ToArray())
$writer.Dispose()
$icoStream.Dispose()
Write-Host "Created C:\Users\ADMIN\Desktop\projects\scratchy\public\favicon.ico"
