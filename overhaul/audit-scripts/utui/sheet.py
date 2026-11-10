import sys, os
from PIL import Image, ImageDraw
# usage: sheet.py out.png width_per_tile img1 img2 ...
out=sys.argv[1]; tw=int(sys.argv[2]); files=sys.argv[3:]
ims=[Image.open(f).convert('RGB') for f in files]
th=max(int(im.height*tw/im.width) for im in ims)
sheet=Image.new('RGB',(tw*len(ims)+8*(len(ims)-1),th+22),(40,40,40))
d=ImageDraw.Draw(sheet)
for i,(f,im) in enumerate(zip(files,ims)):
    t=im.resize((tw,int(im.height*tw/im.width)))
    x=i*(tw+8); sheet.paste(t,(x,22)); d.text((x+4,4),os.path.basename(f)[:40],fill=(255,255,0))
sheet.save(out)
print(out, sheet.size)
