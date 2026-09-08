param(
  [string]$Frame  = "C:\Users\nickz\Documents\NZ\Code\marketing-website\assets\img\hp-proof-phone.png",
  [string]$Shot   = "C:\Users\nickz\My Drive\Thermal Dawn\Marketing +\Design\Photos\App\IMG_4355.PNG",
  [string]$OutPng,
  [double]$Scale  = 3
)

Add-Type -AssemblyName System.Drawing

# Re-skins the marketing phone render with a new app screenshot.
#
# The frame PNG is a flat render: the old screenshot is baked into it, so there
# is no transparent screen to drop into. Instead the new shot is drawn over the
# measured screen rectangle, clipped to the screen's rounded corners, and the
# frame's own notch is blended back on top afterwards.
#
# ---------------------------------------------------------------------------
# WHY -Scale EXISTS
#
# The frame is 640 x 1009, so the screen inside it is 359 x 770. A phone
# screenshot is 1170 x 2532. Composite at 1:1 and the screenshot is resampled
# down to 30% of itself, which is why the app text goes soft no matter how sharp
# the source was: the detail is thrown away by the canvas size, not by the
# resampling.
#
# Scale renders the whole composite larger, so the screen area is big enough to
# keep that detail:
#   Scale 1     screen  359 x  770   screenshot at  31%   (source detail lost)
#   Scale 2     screen  718 x 1540   screenshot at  61%
#   Scale 3     screen 1077 x 2310   screenshot at  92%   (near native)
#   Scale 3.26  screen 1170 x 2510   screenshot at 100%
#
# The trade is the other way for the phone body: 640px is all the frame art
# there is, so above 1x its 1px rim highlights are being invented by the
# resampler and go soft. 2 is the safe choice for the website (the image renders
# at ~560 CSS px, so 1280 is already retina). 3 is for when the screen content
# itself has to hold up close, and accepts a softer bezel to get it.
# ---------------------------------------------------------------------------
#
# The screen rectangle was measured off the frame, and measured WRONG the first
# time. Brightness alone cannot find the top edge, because the bezel's inner
# border and the old screenshot's status bar are both near-black, so an early
# guess of y=111 reached seven pixels up into the bezel: it squared off the top
# corners and painted over the light rim around the glass.
#
# What separates them is HUE, not brightness. The bezel and body are blue
# (B - R >= 6); the screen content is neutral (R == G == B). Mapping the corners
# that way gives a clean boundary, and it says:
#   screen  x 135..493, y 118..887   (359 x 770)
#   notch   x 248..383, y 118..147
# Sanity check on that: the bezel is ~15px from body edge to screen on the left
# at mid-height, and ~15px at the top. It agrees.
#
# The corner is a circle, not a squircle: fitting r=40 against the traced
# boundary at both the top-left and bottom-left corners lands within a pixel at
# every sample.
#
# The source screenshot is 1170 x 2532 (aspect 0.4621) against the screen's
# 0.4662, so it is scaled to COVER and centre-cropped by ~11 source pixels top
# and bottom (0.4%) rather than stretched.

$SX = 135; $SY = 118; $SW = 359; $SH = 770      # screen rectangle (x 135..493, y 118..887)
$RAD = 40                                        # screen corner radius
$NBX1 = 240; $NBX2 = 392; $NBY2 = 152            # notch blend band (1x coordinates)
$REFX = 235                                      # status bar background, left of the notch

# NB: not $frame / $shot. PowerShell variable names are case-insensitive, so
# those collide with the [string] parameters above and the type constraint
# silently coerces the Bitmap to the string "System.Drawing.Bitmap".
$fBmp = [System.Drawing.Bitmap]::FromFile($Frame)
$sBmp = [System.Drawing.Bitmap]::FromFile($Shot)

$W = [int][Math]::Round($fBmp.Width  * $Scale)
$H = [int][Math]::Round($fBmp.Height * $Scale)

$bmp = New-Object System.Drawing.Bitmap($W, $H, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
$g   = [System.Drawing.Graphics]::FromImage($bmp)
$g.InterpolationMode  = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
$g.SmoothingMode      = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
$g.PixelOffsetMode    = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
$g.CompositingQuality = [System.Drawing.Drawing2D.CompositingQuality]::HighQuality

# 1. the frame (bezel, body, shadow, and the old screen we cover over)
$g.DrawImage($fBmp, 0, 0, $W, $H)

# 2. clip to the screen's rounded rectangle, at output scale
# $dx/$dy/$dw/$dh, NOT $sx/$sy/$sw/$sh: PowerShell variable names are case
# insensitive, so those would BE $SX/$SY/$SW/$SH and silently overwrite the
# source rectangle with its own scaled values. Same trap as $frame/$Frame above.
$dx = $SX * $Scale; $dy = $SY * $Scale; $dw = $SW * $Scale; $dh = $SH * $Scale
$d  = $RAD * 2 * $Scale
$path = New-Object System.Drawing.Drawing2D.GraphicsPath
$path.AddArc($dx, $dy, $d, $d, 180, 90)
$path.AddArc(($dx + $dw - $d), $dy, $d, $d, 270, 90)
$path.AddArc(($dx + $dw - $d), ($dy + $dh - $d), $d, $d, 0, 90)
$path.AddArc($dx, ($dy + $dh - $d), $d, $d, 90, 90)
$path.CloseFigure()
$g.SetClip($path)

# 3. cover-fit the screenshot: scale by whichever axis is tighter and crop the
#    other, so nothing is stretched
$cover = [Math]::Max($dw / $sBmp.Width, $dh / $sBmp.Height)
$srcW  = $dw / $cover
$srcH  = $dh / $cover
$srcX  = ($sBmp.Width  - $srcW) / 2
$srcY  = ($sBmp.Height - $srcH) / 2
$g.DrawImage($sBmp,
  (New-Object System.Drawing.RectangleF($dx, $dy, $dw, $dh)),
  (New-Object System.Drawing.RectangleF($srcX, $srcY, $srcW, $srcH)),
  [System.Drawing.GraphicsUnit]::Pixel)
$g.ResetClip()

# 4. Put the notch back.
#
#    Two wrong turns before this one. Stamping the frame's notch rectangle
#    wholesale left a lighter block, because the old screenshot's status bar was
#    27,27,27 and the new one is 13,13,13. A darken blend killed that, but
#    darken can only ever take brightness away, so it also erased the light rim
#    that traces the bottom of the pill.
#
#    What is wanted is the notch's DEVIATION from its background, not its
#    absolute pixels. So: read the old status bar background per row from just
#    left of the notch, and build a small overlay whose ALPHA is how far each
#    pixel departs from it. The pill (black, far below) comes through solid, the
#    rim and the camera lens (bright, far above) come through solid, and the
#    background itself (deviation ~0) is fully transparent, which is why there
#    is no seam at the band's edges.
#
#    Building the overlay at 1x and letting DrawImage scale it keeps this cheap
#    at high -Scale, and resamples the notch on exactly the same terms as the
#    frame it belongs to.
#
#    The band stops well clear of the new screenshot's clock (left of x=213) and
#    its status icons (right of x=398), so neither is touched.
$nbW = $NBX2 - $NBX1 + 1
$nbH = $NBY2 - $SY + 1
$ov  = New-Object System.Drawing.Bitmap($nbW, $nbH, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
for ($j = 0; $j -lt $nbH; $j++) {
  $r   = $fBmp.GetPixel($REFX, ($SY + $j))
  $ref = ($r.R + $r.G + $r.B) / 3
  for ($i = 0; $i -lt $nbW; $i++) {
    $c   = $fBmp.GetPixel(($NBX1 + $i), ($SY + $j))
    $dev = [Math]::Abs((($c.R + $c.G + $c.B) / 3) - $ref)
    $a   = [int][Math]::Min(255, ($dev / 12.0) * 255)
    $ov.SetPixel($i, $j, [System.Drawing.Color]::FromArgb($a, $c.R, $c.G, $c.B))
  }
}
$g.DrawImage($ov,
  (New-Object System.Drawing.RectangleF(($NBX1 * $Scale), ($SY * $Scale), ($nbW * $Scale), ($nbH * $Scale))),
  (New-Object System.Drawing.RectangleF(-0.5, -0.5, $nbW, $nbH)),
  [System.Drawing.GraphicsUnit]::Pixel)
$ov.Dispose()

$g.Dispose()
$bmp.Save($OutPng, [System.Drawing.Imaging.ImageFormat]::Png)
$pct = [Math]::Round(($dw / $sBmp.Width) * 100, 1)
"wrote $OutPng  ($W x $H)  scale=$Scale  screen=$([int]$dw)x$([int]$dh)  screenshot rendered at $pct% of native"
$bmp.Dispose(); $fBmp.Dispose(); $sBmp.Dispose()
