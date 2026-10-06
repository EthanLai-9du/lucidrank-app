"""Draws the LucidRank app icon (crosshair + dawn dot) -> tools/icon-1024.png.
Then: npx tauri icon tools/icon-1024.png"""
from PIL import Image, ImageDraw
S = 1024
img = Image.new("RGBA", (S, S), (0, 0, 0, 0))
d = ImageDraw.Draw(img)
d.rounded_rectangle([40, 40, S - 40, S - 40], radius=220, fill=(12, 12, 15, 255))
c = S // 2
# ring
d.ellipse([c - 300, c - 300, c + 300, c + 300], outline=(245, 245, 247, 70), width=18)
# crosshair arms
w = 44
for (x0, y0, x1, y1) in [(c - w // 2, c - 330, c + w // 2, c - 130), (c - w // 2, c + 130, c + w // 2, c + 330),
                         (c - 330, c - w // 2, c - 130, c + w // 2), (c + 130, c - w // 2, c + 330, c + w // 2)]:
    d.rounded_rectangle([x0, y0, x1, y1], radius=w // 2, fill=(245, 245, 247, 255))
# dawn gradient dot
dot = Image.new("RGBA", (S, S), (0, 0, 0, 0))
g = ImageDraw.Draw(dot)
r = 92
stops = [(255, 196, 107), (255, 106, 61), (255, 46, 99)]
for i in range(r, 0, -1):
    t = 1 - i / r
    a, b = (stops[0], stops[1]) if t < .5 else (stops[1], stops[2])
    k = t * 2 if t < .5 else (t - .5) * 2
    col = tuple(int(a[j] + (b[j] - a[j]) * k) for j in range(3)) + (255,)
    g.ellipse([c - i, c - i, c + i, c + i], fill=col)
img.alpha_composite(dot)
img.save("tools/icon-1024.png")
print("ok")
