"""Placeholder panel studies. Replace these with photographs of the real panel."""
import os, math, sys
W,H = 1600,1000
GROUND="#0f1216"; STONE="#efe9dc"; STONE2="#c3bcac"; DEEP="#0b0d10"; EDGE="#8d8678"

def head(extra=""):
    return f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {W} {H}" width="{W}" height="{H}">
<defs>
<linearGradient id="lit" x1="0" y1="0" x2="1" y2="1">
  <stop offset="0" stop-color="{STONE}"/><stop offset="1" stop-color="{STONE2}"/>
</linearGradient>
<linearGradient id="fall" x1="0" y1="0" x2="0" y2="1">
  <stop offset="0" stop-color="#ffffff" stop-opacity=".16"/>
  <stop offset="1" stop-color="#000000" stop-opacity=".28"/>
</linearGradient>
<radialGradient id="vig" cx=".5" cy=".42" r=".78">
  <stop offset=".58" stop-color="#000" stop-opacity="0"/>
  <stop offset="1" stop-color="#000" stop-opacity=".34"/>
</radialGradient>
{extra}
</defs>
<rect width="{W}" height="{H}" fill="{GROUND}"/>'''

FOOT = f'<rect width="{W}" height="{H}" fill="url(#vig)"/></svg>'

def fins(x0,y0,w,h,n,depthfn,seedphase=0.0):
    s=[]; step=w/n
    for i in range(n):
        d=depthfn(i/n)
        bw=step*0.62
        x=x0+i*step
        s.append(f'<rect x="{x:.1f}" y="{y0:.1f}" width="{bw:.1f}" height="{h:.1f}" fill="url(#lit)"/>')
        s.append(f'<rect x="{x+bw:.1f}" y="{y0:.1f}" width="{step-bw:.1f}" height="{h:.1f}" fill="{DEEP}" opacity="{0.35+0.5*d:.2f}"/>')
        s.append(f'<rect x="{x:.1f}" y="{y0:.1f}" width="{bw:.1f}" height="{h:.1f}" fill="#000" opacity="{0.42*d:.2f}"/>')
    return "\n".join(s)

def perf(x0,y0,w,h,cols,rows,rfn):
    s=[]
    for r in range(rows):
        for c in range(cols):
            cx=x0+(c+.5)*w/cols; cy=y0+(r+.5)*h/rows
            rr=rfn(c/cols,r/rows)
            if rr<1: continue
            s.append(f'<circle cx="{cx:.1f}" cy="{cy:.1f}" r="{rr:.1f}" fill="{DEEP}"/>')
            s.append(f'<circle cx="{cx:.1f}" cy="{cy-rr*0.16:.1f}" r="{rr:.1f}" fill="none" stroke="{EDGE}" stroke-width="1.6" opacity=".55"/>')
    return "\n".join(s)

def label(txt):
    return ""  # titles come from the UI, not baked into the image

out=sys.argv[1]; os.makedirs(out,exist_ok=True)
imgs={}

# ---------- hero : the whole panel ----------
b=[head()]
b.append(f'<rect x="120" y="90" width="{W-240}" height="{H-230}" fill="#232830"/>')
b.append(fins(150,120,700,760,26,lambda u: 0.5+0.5*math.sin(u*math.pi*3.1)))
b.append(perf(880,120,560,380,14,10,lambda u,v: 3+14*abs(math.sin(u*4.2+v*2.0))))
b.append(f'<path d="M880,900 C1080,700 1220,660 1450,540 L1450,880 Z" fill="url(#lit)" opacity=".92"/>')
b.append(f'<path d="M880,900 C1080,700 1220,660 1450,540" fill="none" stroke="#fff" stroke-width="3" opacity=".35"/>')
b.append(f'<rect x="120" y="{H-150}" width="{W-240}" height="60" fill="url(#lit)" opacity=".85"/>')
b.append(f'<rect x="120" y="90" width="{W-240}" height="{H-230}" fill="url(#fall)"/>')
b.append(label("RESONANCE FIELD / FULL PANEL")); b.append(FOOT)
imgs["hero.svg"]="\n".join(b)

# ---------- 01 low register : deep fins, close ----------
b=[head()]
b.append(f'<rect x="0" y="60" width="{W}" height="{H-120}" fill="#232830"/>')
b.append(fins(-40,60,W+80,H-120,9,lambda u: 0.25+0.75*abs(math.sin(u*math.pi*1.6))))
b.append(f'<rect x="0" y="60" width="{W}" height="{H-120}" fill="url(#fall)"/>')
b.append(label("01 / THE LOW REGISTER")); b.append(FOOT)
imgs["part-01.svg"]="\n".join(b)

# ---------- 02 perforation grid ----------
b=[head()]
b.append(f'<rect x="0" y="0" width="{W}" height="{H}" fill="url(#lit)"/>')
b.append(perf(60,60,W-120,H-160,17,11,lambda u,v: 6+22*abs(math.sin(u*3.0+v*3.7))))
b.append(f'<rect width="{W}" height="{H}" fill="url(#fall)"/>')
b.append(label("02 / THE PERFORATION GRID")); b.append(FOOT)
imgs["part-02.svg"]="\n".join(b)

# ---------- 03 plinth mass ----------
b=[head()]
b.append(f'<rect x="0" y="520" width="{W}" height="{H-520}" fill="url(#lit)"/>')
b.append(f'<rect x="0" y="520" width="{W}" height="26" fill="#fff" opacity=".22"/>')
for i in range(7):
    y=560+i*62
    b.append(f'<rect x="0" y="{y}" width="{W}" height="4" fill="{DEEP}" opacity=".45"/>')
b.append(f'<rect x="0" y="300" width="{W}" height="220" fill="#232830"/>')
b.append(fins(0,300,W,220,22,lambda u: 0.35+0.4*math.cos(u*math.pi*2.4)))
b.append(f'<rect width="{W}" height="{H}" fill="url(#fall)"/>')
b.append(label("03 / THE PLINTH MASS")); b.append(FOOT)
imgs["part-03.svg"]="\n".join(b)

# ---------- 04 rising curve ----------
b=[head()]
b.append(f'<rect width="{W}" height="{H}" fill="#232830"/>')
for k in range(9):
    o=k*26
    b.append(f'<path d="M-40,{960-o} C420,{780-o} 900,{700-o} {W+40},{300-o}" fill="none" '
             f'stroke="{STONE if k%2==0 else STONE2}" stroke-width="{20-k*1.4:.1f}" opacity="{0.95-k*0.09:.2f}"/>')
b.append(f'<rect width="{W}" height="{H}" fill="url(#fall)"/>')
b.append(label("04 / THE RISING CURVE")); b.append(FOOT)
imgs["part-04.svg"]="\n".join(b)

# ---------- 05 surface wash ----------
b=[head('<linearGradient id="wash" x1="0" y1="1" x2="1" y2="0">'
        f'<stop offset="0" stop-color="{STONE2}"/><stop offset=".55" stop-color="{STONE}"/>'
        f'<stop offset="1" stop-color="#8e887d"/></linearGradient>')]
b.append(f'<rect width="{W}" height="{H}" fill="url(#wash)"/>')
for i in range(150):
    y=(i*6.7)%H
    b.append(f'<rect x="0" y="{y:.1f}" width="{W}" height="2" fill="#000" opacity="{0.02+0.05*abs(math.sin(i*0.7)):.3f}"/>')
b.append(f'<rect width="{W}" height="{H}" fill="url(#fall)"/>')
b.append(label("05 / THE SURFACE WASH")); b.append(FOOT)
imgs["part-05.svg"]="\n".join(b)

# ---------- 06 cross brace ----------
b=[head()]
b.append(f'<rect width="{W}" height="{H}" fill="#232830"/>')
b.append(perf(0,0,W,H,12,8,lambda u,v: 4+9*abs(math.cos(u*5+v*3))))
for (x1,y1,x2,y2) in ((120,880,1480,180),(120,180,1480,880)):
    b.append(f'<line x1="{x1}" y1="{y1}" x2="{x2}" y2="{y2}" stroke="url(#lit)" stroke-width="72" stroke-linecap="square"/>')
    b.append(f'<line x1="{x1}" y1="{y1+8}" x2="{x2}" y2="{y2+8}" stroke="#000" stroke-width="72" opacity=".22"/>')
b.append(f'<rect width="{W}" height="{H}" fill="url(#fall)"/>')
b.append(label("06 / THE CROSS BRACE")); b.append(FOOT)
imgs["part-06.svg"]="\n".join(b)

for k,v in imgs.items():
    open(os.path.join(out,k),"w").write(v)
    print(f"  {k:14s} {len(v)/1024:6.1f} KB")
