param(
  [string]$Shot   = "C:\Users\nickz\My Drive\Thermal Dawn\Marketing +\Design\Photos\App\IMG_4355.PNG",
  [string]$Donor  = "C:\Users\nickz\My Drive\Thermal Dawn\Marketing +\Design\Photos\App\IMG_3171.PNG",
  [string]$OutPng
)

Add-Type -AssemblyName System.Drawing

# Two digit edits to the app screenshot used in the marketing phone render:
#   status bar clock   8:29  ->  5:29
#   schedule card      room 15.8 degrees  ->  16.8
#
# Nothing here is DRAWN. Every replacement digit is LIFTED from a real rendering
# of the same font at the same size. SF Pro is not installed on this machine, and
# a Segoe UI digit sitting next to real SF Pro digits reads as a forgery the
# moment anyone looks closely. Copying a real glyph is exact by construction, and
# it cannot drift if the app's type ever changes.
#
# Both edits are a straight rectangle copy, background to background. The status
# bar is 13,13,13 in both files and the schedule card is 28,28,28 in both places,
# so there is nothing to blend and no seam to hide. Every rectangle below was
# measured off the pixels, and each copy is checked to clear its neighbours.
#
# ---------------------------------------------------------------------------
# EDIT 1: the clock, 8 -> 5.   Donor: IMG_3171, same app, same device, same
# 1170 x 2532, taken at 10:54, so it carries a real 5 in the status bar font.
#
#   IMG_4355  "8:29"    8 ink x 138..165  rows 59..96
#   IMG_3171  "10:54"   5 ink x 199..224  rows 60..96
#
# Vertical: no offset. Both bottoms land on row 96, and the 5's flat top sitting
# one row below the 8's is the round-digit overshoot, which is correct.
#
# Horizontal: 5 and 8 share the same 32 advance, so the colon and the minutes do
# not move. The 8's ink is 28 wide and the 5's is 26, so the 5 is centred on the
# 8's ink centre of 151.5: shifting by -60 puts it at 139..164, centre 151.5.
#
# The band stops at x=227 in the donor, clear of the 4 at 230, and lands at
# x=167, clear of the colon at 172.
# ---------------------------------------------------------------------------
# EDIT 2: the room temperature, 15.8 -> 16.8.   Donor: the SAME file. The line
# above reads "stored heat (tank 60.4 degrees) lifting", so the 6 is already
# there, in the same font at the same size, one line up.
#
#   line 2  "...60.4..."   6 ink x 579..597  rows 1821..1846
#   line 3  "...15.8..."   5 ink x 363..380  rows 1864..1888
#
# Vertical: dy = 42, which is exactly the line spacing. That equality is the
# check that these are the two glyphs I think they are, not a coincidence of
# thresholds. Bottoms align; the 6's round top overshooting the 5's flat top by
# one row is again correct.
#
# Horizontal: centred, 5 ink centre 371.5, 6 ink 19 wide, so dx = -217 puts the
# 6 at 362..380. The copied band lands clear of the 1 (ends 356) and the decimal
# point (starts 386) on both sides.
# ---------------------------------------------------------------------------

$shotB  = [System.Drawing.Bitmap]::FromFile($Shot)
$donorB = [System.Drawing.Bitmap]::FromFile($Donor)

if ($shotB.Width -ne $donorB.Width -or $shotB.Height -ne $donorB.Height) {
  throw "donor and shot are different sizes ($($donorB.Width)x$($donorB.Height) vs $($shotB.Width)x$($shotB.Height)); the lifted glyph would not match"
}

$out = New-Object System.Drawing.Bitmap($shotB.Width, $shotB.Height, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
$gr  = [System.Drawing.Graphics]::FromImage($out)
$gr.DrawImage($shotB, 0, 0, $shotB.Width, $shotB.Height)
$gr.Dispose()

function Copy-Band($src, $dst, $x1, $x2, $y1, $y2, $dx, $dy) {
  for ($x = $x1; $x -le $x2; $x++) {
    for ($y = $y1; $y -le $y2; $y++) {
      $dst.SetPixel(($x + $dx), ($y + $dy), $src.GetPixel($x, $y))
    }
  }
}

# 1. clock: 5 from the donor's 10:54
Copy-Band $donorB $out 193 227 45 110 -60 0

# 2. room temperature: 6 from this file's own line above
Copy-Band $out $out 577 599 1817 1850 -217 42

$out.Save($OutPng, [System.Drawing.Imaging.ImageFormat]::Png)
"wrote $OutPng  ($($out.Width) x $($out.Height))  clock 5:29, room 16.8"
$out.Dispose(); $shotB.Dispose(); $donorB.Dispose()
