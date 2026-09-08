param(
  [string]$Shot   = "C:\Users\nickz\My Drive\Thermal Dawn\Marketing +\Design\Photos\App\IMG_4355.PNG",
  [string]$Donor  = "C:\Users\nickz\My Drive\Thermal Dawn\Marketing +\Design\Photos\App\IMG_3171.PNG",
  [string]$OutPng
)

Add-Type -AssemblyName System.Drawing

# Two digit edits to the app screenshot used in the marketing phone render:
#   status bar clock   8:29  ->  5:29
#   schedule card      room 15.8 degrees  ->  17.4
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
# EDIT 2: the room temperature, 15.8 -> 17.4. Two digits, two different donors,
# both real glyphs at the target size.
#
#   target line 3  "...15.8..."   1 x 347..356   5 x 363..381   . x 386..390
#                                 8 x 394..414   degree x 419..431   baseline 1888
#
# 2a. the 4, from THIS file's own line above: "(tank 60.4 degrees) lifting".
#     4 ink x 635..657 (w23) rows 1822..1846, baseline 1846, so dy = +42, which
#     is exactly the line spacing. That equality is the check that this is the
#     glyph I think it is and not a coincidence of thresholds.
#     The 8's ink centre is 404 and the 4's ink is 23 wide, so dx = -242 lands it
#     at 393..415, centre 404. The band clears the decimal point on the left
#     (ends 390, band starts 391) and the degree sign on the right (starts 419,
#     band ends 416).
#
# 2b. the 7, from the donor's "51.7 kg". IMG_4355 has no 7 anywhere at this
#     size: its only sevens are the large OUTDOOR 7.8 and the small INDOOR 17.4,
#     and rescaling either would land a wrong weight next to correct ones. The
#     donor's stat-card body text is the same face at the same weight, one pixel
#     taller. Compared side by side at 8x the glyph shapes match.
#     7 ink x 819..836 (w18) rows 2006..2031, baseline 2031, so dy = -143.
#     The 5's ink centre is 372 and the 7 is 18 wide, so dx = -456 lands it at
#     363..380, centre 371.5. The band clears the 1 on the left (ends 356, band
#     starts 359) and the decimal point on the right (starts 386, band ends 384).
#
# Every one of these bands is background-to-background: 28,28,28 at all three
# sites, measured, in both files. Nothing to blend, no seam to hide.
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

# 2a. room temperature, second digit: 4 from this file's own line above.
#     Read from $shotB, not $out, so it cannot pick up an earlier edit.
Copy-Band $shotB $out 633 658 1818 1852 -242 42

# 2b. room temperature, first digit: 7 from the donor's "51.7 kg"
Copy-Band $donorB $out 815 840 2000 2038 -456 -143

$out.Save($OutPng, [System.Drawing.Imaging.ImageFormat]::Png)
"wrote $OutPng  ($($out.Width) x $($out.Height))  clock 5:29, room 17.4"
$out.Dispose(); $shotB.Dispose(); $donorB.Dispose()
