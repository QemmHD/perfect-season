# FUT-shaped gold curve (FC27 Large Gold Pack tracker, futmind) extended to 91
curve = {75:4.5553,76:5.0234,77:6.7131,78:13.4604,79:15.2871,80:17.6733,81:16.2233,82:15.2757,
         83:3.4022,84:1.3814,85:0.4338,86:0.2169,87:0.1598,88:0.1484,89:0.0343,90:0.0114,91:0.005}
tot=sum(curve.values())
G={k:v/tot for k,v in curve.items()}
def floor(d,f):
    t=sum(v for k,v in d.items() if k>=f); return {k:v/t for k,v in d.items() if k>=f}
def p_at_least(d,x): return sum(v for k,v in d.items() if k>=x)
slots={'G75':G,'G78':floor(G,78),'G80':floor(G,80),'G82':floor(G,82),'G84':floor(G,84),'G86':floor(G,86)}
print('per-slot P(>=x)')
for n,d in slots.items():
    print(n, {x: round(100*p_at_least(d,x),2) for x in (78,80,82,83,84,85,86,87,88,90)})
def pack(slotlist, special=None):
    # slotlist: list of slot names; returns P(at least one >=x)
    res={}
    for x in (80,82,83,84,85,86,87,88,90):
        q=1.0
        for s in slotlist: q*= (1-p_at_least(slots[s],x))
        res[x]=round(100*(1-q),1)
    exp={x: round(sum(p_at_least(slots[s],x) for s in slotlist),2) for x in (83,85)}
    return res,exp
packs={
 'Gold nba':['G75','G75','G78'], 'Gold soccer':['G75','G75','G75','G78'], 'Gold nfl':['G75']*8+['G78']*2,
 'Premium nba':['G75']*3+['G78']*3, 'Premium soccer':['G75']*4+['G78']*4, 'Premium nfl':['G75']*8+['G78']*6,
 'Jumbo nba':['G75']*4+['G78']*7, 'Jumbo soccer':['G75']*6+['G78']*9,'Jumbo nfl':['G75']*9+['G78']*14,
 'Prime nba':['G80']*6+['G82']*2, 'Prime soccer':['G80']*8+['G82']*3, 'Prime nfl':['G80']*12+['G82']*4,
 'Elite nba':['G82']*5+['G84'], 'Elite soccer':['G82']*7+['G84'],'Elite nfl':['G82']*10+['G84']*2,
 'Franchise nba':['G82']*10+['G84']*2,'Franchise soccer':['G82']*14+['G84']*3,'Franchise nfl':['G82']*20+['G84']*4,
 '84+ x1':['G84'], '82+ x1':['G82'], '5x 82+':['G82']*5, '3x 84+':['G84']*3,
}
for k,v in packs.items():
    r,e=pack(v); print(k, len(v),'gold slots', r, 'E[83+,85+]=',e)
# pick 1 of n: best of n draws
def pick_best(d,n):
    return {x: round(100*(1-(1-p_at_least(d,x))**n),1) for x in (84,85,86,87,88,90)}
print('pick 1of3 82+', pick_best(slots['G82'],3)); print('pick 1of3 84+', pick_best(slots['G84'],3)); print('pick 1of5 80+', pick_best(slots['G80'],5))
# bag model: 4 items, chances 25/33/50/100 => expected draws until target
import itertools
# lucky upgrade: 3 taps with chances c1,c2,c3 per step from tier0
def lucky(chances, taps):
    dist={0:1.0}
    for _ in range(taps):
        nd={}
        for t,p in dist.items():
            if t<len(chances):
                c=chances[t]; nd[t+1]=nd.get(t+1,0)+p*c; nd[t]=nd.get(t,0)+p*(1-c)
            else: nd[t]=nd.get(t,0)+p
        dist=nd
    return {k:round(100*v,2) for k,v in sorted(dist.items())}
print('CR lucky drop orig 3 taps', lucky([0.20,0.25,0.30],3))
print('proposal scout reveal 3 taps', lucky([0.30,0.20,0.10],3))
print('proposal scout reveal 4 taps', lucky([0.35,0.22,0.12,0.06],4))
# pity: P(no special in n packs) with p special per pack
for p in (0.022,0.06,0.3):
    import math
    print('p',p, 'P(none in 10)',round(100*(1-p)**10,1),'in 20',round(100*(1-p)**20,1),'packs for 50%',math.ceil(math.log(0.5)/math.log(1-p)),'90%',math.ceil(math.log(0.1)/math.log(1-p)))
