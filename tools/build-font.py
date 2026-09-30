"""Gera a fonte 'Treino Score': numerais em segmentos chanfrados e inclinados (placar de academia)."""
from fontTools.fontBuilder import FontBuilder
from fontTools.pens.ttGlyphPen import TTGlyphPen
T,S,SL=120,68,0.16  # espessura, recuo, inclinação
XL,XR,YB,YM,YT=110,490,60,480,900
def _oct(x0,x1,y0,y1): c=T/3.2; return [(x0,y0+c),(x0+c,y0),(x1-c,y0),(x1,y0+c),(x1,y1-c),(x1-c,y1),(x0+c,y1),(x0,y1-c)]
def hexh(x0,x1,y): h=T/2; return _oct(x0,x1,y-h,y+h)
def hexv(x,y0,y1): h=T/2; return _oct(x-h,x+h,y0,y1)
SEG={'a':hexh(XL+S,XR-S,YT),'g':hexh(XL+S,XR-S,YM),'d':hexh(XL+S,XR-S,YB),
     'f':hexv(XL,YM+S,YT-S),'b':hexv(XR,YM+S,YT-S),'e':hexv(XL,YB+S,YM-S),'c':hexv(XR,YB+S,YM-S)}
DIG={'0':'abcdef','1':'bc','2':'abged','3':'abgcd','4':'fgbc','5':'afgcd','6':'afgedc','7':'abc','8':'abcdefg','9':'abcdfg'}
def area(p): return sum(p[i][0]*p[(i+1)%len(p)][1]-p[(i+1)%len(p)][0]*p[i][1] for i in range(len(p)))/2
def glyph(polys):
    pen=TTGlyphPen(None)
    for p in polys:
        p=[(round(x+y*SL),round(y)) for x,y in p]
        if area(p)>0: p=p[::-1]          # TrueType: externo em sentido horário
        pen.moveTo(p[0]); [pen.lineTo(q) for q in p[1:]]; pen.closePath()
    return pen.glyph()
def sq(cx,cy,s=46): return [(cx-s,cy-s),(cx-s,cy+s),(cx+s,cy+s),(cx+s,cy-s)]
G={'.notdef':(glyph([]),600),'space':(glyph([]),260)}; cmap={32:'space'}
for d,s in DIG.items(): G['d'+d]=(glyph([SEG[k] for k in s]),640); cmap[ord(d)]='d'+d
G['colon']=(glyph([sq(150,640),sq(150,300)]),300); cmap[58]='colon'
G['period']=(glyph([sq(100,100)]),260); cmap[46]='period'
G['comma']=(glyph([sq(100,100),[(60,-40),(140,10),(140,-60)]]),260); cmap[44]='comma'
G['hyphen']=(glyph([hexh(XL+20,XR-20,YM)]),640); cmap[45]='hyphen'
order=list(G); fb=FontBuilder(1000,isTTF=True); fb.setupGlyphOrder(order); fb.setupCharacterMap(cmap)
fb.setupGlyf({n:G[n][0] for n in order}); fb.setupHorizontalMetrics({n:(G[n][1],0) for n in order})
fb.setupHorizontalHeader(ascent=960,descent=-40)
fb.setupNameTable({'familyName':'Treino Score','styleName':'Bold'})
fb.setupOS2(sTypoAscender=960,sTypoDescender=-40,usWinAscent=960,usWinDescent=40,fsType=0)
fb.setupPost(); fb.font.flavor='woff2'; fb.save('src/fonts/treino-score.woff2'); print('ok')
