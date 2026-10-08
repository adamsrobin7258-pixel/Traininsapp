"""Labelled comparison sheet: rows of renders with a caption per row.
Usage: python compare_sheet.py out.png "Caption A" a1.png a2.png ... -- "Caption B" b1.png ..."""
import sys
from PIL import Image, ImageDraw, ImageFont
out=sys.argv[1]; rows=[]; cur=None
for a in sys.argv[2:]:
    if a=='--': cur=None; continue
    if cur is None: cur=[a,[]]; rows.append(cur)
    else: cur[1].append(a)
SCALE=0.5; CAP=56
ims=[[Image.open(p).convert('RGB') for p in r[1]] for r in rows]
w=max(sum(int(i.width*SCALE) for i in r) for r in ims); h=sum(int(max(i.height for i in r)*SCALE)+CAP for r in ims)
S=Image.new('RGB',(w,h),(245,244,241)); d=ImageDraw.Draw(S)
try: font=ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf',30)
except OSError: font=ImageFont.load_default()
y=0
for (cap,_),r in zip(rows,ims):
    d.text((16,y+12),cap,fill=(30,30,30),font=font); y+=CAP; x=0
    for i in r:
        t=i.resize((int(i.width*SCALE),int(i.height*SCALE)),Image.LANCZOS); S.paste(t,(x,y)); x+=t.width
    y+=int(max(i.height for i in r)*SCALE)
S.save(out,optimize=True)
