import crypto from "crypto";

function clamp(x,a,b){return Math.max(a,Math.min(b,x))}

const PROFILES={
  fast:{name:"fast",label:"HIZLI",candidateLong:68,candidateShort:32,strongLong:80,strongShort:20,minConf:2},
  balanced:{name:"balanced",label:"DENGELİ",candidateLong:72,candidateShort:28,strongLong:84,strongShort:16,minConf:3},
  safe:{name:"safe",label:"GÜVENLİ",candidateLong:76,candidateShort:24,strongLong:88,strongShort:12,minConf:4},
  strict:{name:"strict",label:"STRICT",candidateLong:74,candidateShort:26,strongLong:86,strongShort:14,minConf:3},
  selective:{name:"selective",label:"SELECTIVE",candidateLong:74,candidateShort:26,strongLong:84,strongShort:16,minConf:4},
  ultra:{name:"ultra",label:"ULTRA",candidateLong:76,candidateShort:24,strongLong:88,strongShort:12,minConf:4}
};
function getProfile(name){return PROFILES[String(name||"balanced").toLowerCase()]||PROFILES.balanced}

function ema(v,p){const k=2/(p+1),o=[v[0]];for(let i=1;i<v.length;i++)o.push(v[i]*k+o[i-1]*(1-k));return o}
function sma(v,p){const o=Array(v.length).fill(null);let s=0;for(let i=0;i<v.length;i++){s+=v[i];if(i>=p)s-=v[i-p];if(i>=p-1)o[i]=s/p}return o}
function std(v,p){const o=Array(v.length).fill(null);for(let i=p-1;i<v.length;i++){const a=v.slice(i-p+1,i+1),m=a.reduce((x,y)=>x+y,0)/p;o[i]=Math.sqrt(a.reduce((x,y)=>x+(y-m)**2,0)/p)}return o}
function rsi(v,p=14){
  const g=[],l=[];for(let i=1;i<v.length;i++){const d=v[i]-v[i-1];g.push(Math.max(d,0));l.push(Math.max(-d,0))}
  let ag=g.slice(0,p).reduce((a,b)=>a+b,0)/p,al=l.slice(0,p).reduce((a,b)=>a+b,0)/p;
  const o=Array(v.length).fill(null);o[p]=al===0?100:100-100/(1+ag/al);
  for(let i=p+1;i<v.length;i++){ag=(ag*(p-1)+g[i-1])/p;al=(al*(p-1)+l[i-1])/p;o[i]=al===0?100:100-100/(1+ag/al)}
  return o
}
function atr(h,l,c,p=14){
  const tr=[h[0]-l[0]];for(let i=1;i<c.length;i++)tr.push(Math.max(h[i]-l[i],Math.abs(h[i]-c[i-1]),Math.abs(l[i]-c[i-1])));
  const o=Array(c.length).fill(null);let a=tr.slice(0,p).reduce((x,y)=>x+y,0)/p;o[p-1]=a;
  for(let i=p;i<tr.length;i++){a=(a*(p-1)+tr[i])/p;o[i]=a}return o
}
function adx(h,l,c,p=14){
  const tr=[],pd=[],md=[];
  for(let i=0;i<c.length;i++){
    if(!i){tr.push(h[i]-l[i]);pd.push(0);md.push(0);continue}
    const up=h[i]-h[i-1],dn=l[i-1]-l[i];
    pd.push(up>dn&&up>0?up:0);md.push(dn>up&&dn>0?dn:0);
    tr.push(Math.max(h[i]-l[i],Math.abs(h[i]-c[i-1]),Math.abs(l[i]-c[i-1])))
  }
  let ar=tr.slice(1,p+1).reduce((a,b)=>a+b,0),pr=pd.slice(1,p+1).reduce((a,b)=>a+b,0),mr=md.slice(1,p+1).reduce((a,b)=>a+b,0);
  const plus=Array(c.length).fill(null),minus=Array(c.length).fill(null),dx=Array(c.length).fill(null),ao=Array(c.length).fill(null);
  for(let i=p;i<c.length;i++){
    if(i>p){ar=ar-ar/p+tr[i];pr=pr-pr/p+pd[i];mr=mr-mr/p+md[i]}
    plus[i]=100*pr/ar;minus[i]=100*mr/ar;const den=plus[i]+minus[i];dx[i]=den?100*Math.abs(plus[i]-minus[i])/den:0
  }
  const first=dx.slice(p,p*2).filter(Number.isFinite);
  if(first.length===p){let a=first.reduce((x,y)=>x+y,0)/p;ao[p*2-1]=a;for(let i=p*2;i<c.length;i++){a=(a*(p-1)+dx[i])/p;ao[i]=a}}
  return {adx:ao,plusDI:plus,minusDI:minus}
}
function calcAll(o,h,l,c,v){
  const e7=ema(c,7),e20=ema(c,20),e25=ema(c,25),e50=ema(c,50),e99=ema(c,99),e200=ema(c,200);
  const r=rsi(c),ef=ema(c,12),es=ema(c,26),macd=c.map((_,i)=>ef[i]-es[i]),sig=ema(macd,9),hist=macd.map((x,i)=>x-sig[i]);
  const basis=sma(c,20),sd=std(c,20),upper=basis.map((x,i)=>x==null?null:x+2*sd[i]),lower=basis.map((x,i)=>x==null?null:x-2*sd[i]);
  return {e7,e20,e25,e50,e99,e200,r,macd,sig,hist,basis,upper,lower,atrV:atr(h,l,c),vma:sma(v,20),adxD:adx(h,l,c)}
}
function unpack(k,dropOpen=true){
  const x=dropOpen?k.slice(0,-1):k;
  return {k:x,o:x.map(z=>+z[1]),h:x.map(z=>+z[2]),l:x.map(z=>+z[3]),c:x.map(z=>+z[4]),v:x.map(z=>+z[5]),t:x.map(z=>+z[0])}
}
function trendBias(d,c,n){
  const slope20=d.e20[n]-d.e20[Math.max(0,n-3)],slope50=d.e50[n]-d.e50[Math.max(0,n-5)];
  if(d.e20[n]>d.e50[n]&&d.e50[n]>d.e200[n]&&slope20>0&&slope50>0)return 1;
  if(d.e20[n]<d.e50[n]&&d.e50[n]<d.e200[n]&&slope20<0&&slope50<0)return -1;
  if(c[n]>d.e50[n]&&slope20>0)return .5;
  if(c[n]<d.e50[n]&&slope20<0)return -.5;
  return 0
}
function tfBiasFromKlines(k,atMs=null){
  const u=unpack(k,false),d=calcAll(u.o,u.h,u.l,u.c,u.v);
  let n=u.c.length-1;
  if(atMs!=null){while(n>205&&u.t[n]>atMs)n--}
  if(n<205)return 0;
  return trendBias(d,u.c,n)
}
function legacyAt(d,o,h,l,c,v,n,withReasons=true){
  let L=0,S=0;const reasons=[];
  const emaBull=d.e7[n]>d.e25[n]&&d.e25[n]>d.e99[n],emaBear=d.e7[n]<d.e25[n]&&d.e25[n]<d.e99[n];
  if(emaBull)L++;if(emaBear)S++;if(withReasons)reasons.push({label:"EMA 7/25/99",bias:emaBull?1:emaBear?-1:0,text:emaBull?"Yukarı trend":emaBear?"Aşağı trend":"Karışık"});
  if(c[n]>d.e25[n])L++;else if(c[n]<d.e25[n])S++;if(withReasons)reasons.push({label:"Fiyat / EMA25",bias:c[n]>d.e25[n]?1:-1,text:c[n]>d.e25[n]?"EMA25 üstü":"EMA25 altı"});
  if(d.macd[n]>d.sig[n]&&d.hist[n]>0)L++;if(d.macd[n]<d.sig[n]&&d.hist[n]<0)S++;if(withReasons)reasons.push({label:"MACD",bias:d.macd[n]>d.sig[n]?1:d.macd[n]<d.sig[n]?-1:0,text:d.macd[n]>d.sig[n]?"Pozitif":"Negatif"});
  if(d.r[n]>54&&d.r[n]<70)L++;else if(d.r[n]<46&&d.r[n]>30)S++;if(withReasons)reasons.push({label:"RSI",bias:d.r[n]>54&&d.r[n]<70?1:d.r[n]<46&&d.r[n]>30?-1:0,text:d.r[n].toFixed(1)});
  const rv=d.vma[n]?v[n]/d.vma[n]:1,strongVol=rv>=1.05;
  if(strongVol&&c[n]>o[n])L++;if(strongVol&&c[n]<o[n])S++;if(withReasons)reasons.push({label:"Hacim",bias:strongVol?(c[n]>o[n]?1:-1):0,text:`RVOL ${rv.toFixed(2)}x`});
  const bUp=c[n]>Math.max(...h.slice(n-20,n)),bDn=c[n]<Math.min(...l.slice(n-20,n));if(bUp)L++;if(bDn)S++;if(withReasons)reasons.push({label:"20 Mum Kırılım",bias:bUp?1:bDn?-1:0,text:bUp?"Yukarı kırılım":bDn?"Aşağı kırılım":"Kırılım yok"});
  const mUp=c[n]>c[n-3]&&d.hist[n]>=d.hist[n-1],mDn=c[n]<c[n-3]&&d.hist[n]<=d.hist[n-1];if(mUp)L++;if(mDn)S++;if(withReasons)reasons.push({label:"3 Mum Momentum",bias:mUp?1:mDn?-1:0,text:mUp?"Yukarı":mDn?"Aşağı":"Yatay"});
  const a=d.atrV[n]||0,dist=a?Math.abs(c[n]-d.e20[n])/a:0;
  if((d.upper[n]&&c[n]>=d.upper[n]&&d.r[n]>72)||dist>1.8)L=Math.max(0,L-1);
  if((d.lower[n]&&c[n]<=d.lower[n]&&d.r[n]<28)||dist>1.8)S=Math.max(0,S-1);
  let signal="BEKLE";if(L>=5&&L>=S+3)signal="LONG";else if(S>=5&&S>=L+3)signal="SHORT";
  const confidence=Math.min(90,Math.round(48+Math.abs(L-S)*7+Math.max(L,S)*2));
  return {signal,confidence,longScore:L,shortScore:S,reasons}
}
function optimizedAt(d,o,h,l,c,v,n,mtf={m15:0,h1:0},profileName="balanced"){
  const cfg=getProfile(profileName);
  const a=d.atrV[n],atrPct=a/c[n]*100,rv=d.vma[n]?v[n]/d.vma[n]:1,adxV=d.adxD.adx[n],p=d.adxD.plusDI[n],m=d.adxD.minusDI[n];
  const hh20=Math.max(...h.slice(n-20,n)),ll20=Math.min(...l.slice(n-20,n));
  const breakoutUp=c[n]>hh20,breakoutDn=c[n]<ll20;
  const body=Math.abs(c[n]-o[n]),bodyAtr=a?body/a:0,dist20=a?Math.abs(c[n]-d.e20[n])/a:0;
  const tb=trendBias(d,c,n);
  let score=50;const breakdown=[];let confirmations=0;

  const trendPts=tb===1?18:tb===.5?10:tb===-.5?-10:tb===-1?-18:0;
  score+=trendPts;if(Math.abs(tb)>=.5)confirmations++;
  breakdown.push({label:"Trend",score:Math.round(12.5+trendPts*.69),max:25,text:tb>0?"EMA eğimi yukarı":tb<0?"EMA eğimi aşağı":"Trend karışık"});

  let adxPts=0;
  if(Number.isFinite(adxV)){
    const str=clamp((adxV-18)/18,0,1);
    if(p>m)adxPts=12*str;else if(m>p)adxPts=-12*str;
    if(adxV>=20)confirmations++;
  }
  score+=adxPts;breakdown.push({label:"ADX / DI",score:Math.round(10+adxPts*.83),max:20,text:Number.isFinite(adxV)?`ADX ${adxV.toFixed(1)} • ${p>m?"DI+":"DI-"} üstün`:"ADX hazır değil"});

  let structPts=0;
  if(breakoutUp){structPts=15;confirmations++}
  else if(breakoutDn){structPts=-15;confirmations++}
  else {
    const higher=c[n]>c[n-5]&&l[n]>Math.min(...l.slice(n-5,n)),lower=c[n]<c[n-5]&&h[n]<Math.max(...h.slice(n-5,n));
    if(higher)structPts=7;else if(lower)structPts=-7;
  }
  score+=structPts;breakdown.push({label:"Market Structure",score:Math.round(10+structPts*.67),max:20,text:breakoutUp?"20 mum yukarı kırılım":breakoutDn?"20 mum aşağı kırılım":structPts>0?"Yükselen yapı":structPts<0?"Düşen yapı":"Range"});

  let momPts=0;
  const histSlope=d.hist[n]-d.hist[n-2];
  if(d.r[n]>=54&&d.r[n]<=68&&histSlope>0)momPts=8;
  else if(d.r[n]<=46&&d.r[n]>=32&&histSlope<0)momPts=-8;
  else if(d.r[n]>72)momPts=-3;
  else if(d.r[n]<28)momPts=3;
  if(Math.abs(momPts)>=6)confirmations++;
  score+=momPts;breakdown.push({label:"Momentum",score:Math.round(5+momPts*.625),max:10,text:`RSI ${d.r[n].toFixed(1)} • MACD ivme ${histSlope>0?"↑":histSlope<0?"↓":"→"}`});

  let volPts=0;
  const candleDir=c[n]>o[n]?1:c[n]<o[n]?-1:0;
  if(rv>=1.15){volPts=clamp((rv-1)*8,0,7)*candleDir;if(candleDir)confirmations++}
  else if(rv<.75)volPts=0;
  score+=volPts;breakdown.push({label:"RVOL / Hacim",score:Math.round(10+volPts),max:20,text:`RVOL ${rv.toFixed(2)}x`});

  const mtfSum=(mtf.m15||0)+(mtf.h1||0);
  let mtfPts=0;
  if(mtf.m15>0&&mtf.h1>0){mtfPts=10;confirmations++}
  else if(mtf.m15<0&&mtf.h1<0){mtfPts=-10;confirmations++}
  else if(mtfSum>0)mtfPts=4;else if(mtfSum<0)mtfPts=-4;
  score+=mtfPts;breakdown.push({label:"15m / 1h",score:Math.round(7.5+mtfPts*.75),max:15,text:`15m ${mtf.m15>0?"↑":mtf.m15<0?"↓":"→"} • 1h ${mtf.h1>0?"↑":mtf.h1<0?"↓":"→"}`});

  let volRegime="Uygun";
  if(atrPct<.18)volRegime="Çok düşük volatilite";
  else if(atrPct>3.0)volRegime="Aşırı volatilite";
  breakdown.push({label:"Volatilite",score:atrPct>=.18&&atrPct<=2.4?5:2,max:5,text:`ATR ${atrPct.toFixed(2)}% • ${volRegime}`});

  const blockers=[];
  if(Number.isFinite(adxV)&&adxV<17&&!breakoutUp&&!breakoutDn)blockers.push("ADX düşük / yatay piyasa");
  if(atrPct<.15)blockers.push("Volatilite çok düşük");
  if(atrPct>3.2)blockers.push("Volatilite aşırı yüksek");
  if(rv<.70&&!breakoutUp&&!breakoutDn)blockers.push("Hacim zayıf");
  if(bodyAtr>2.1)blockers.push("Anormal büyük mum");
  if(dist20>1.65&&!(rv>=1.4&&(breakoutUp||breakoutDn)))blockers.push("EMA20'den aşırı uzak");
  if(d.r[n]>76&&score>50)blockers.push("LONG için aşırı alım");
  if(d.r[n]<24&&score<50)blockers.push("SHORT için aşırı satım");
  if(score>=68&&mtf.m15<0&&mtf.h1<0)blockers.push("15m ve 1h LONG'a ters");
  if(score<=32&&mtf.m15>0&&mtf.h1>0)blockers.push("15m ve 1h SHORT'a ters");

  score=Math.round(clamp(score,0,100));
  let signal="BEKLE",label="BEKLE";
  const longCandidate=score>=cfg.candidateLong,shortCandidate=score<=cfg.candidateShort;
  const longStrong=score>=cfg.strongLong,shortStrong=score<=cfg.strongShort;
  if(!blockers.length&&confirmations>=cfg.minConf){
    if(longStrong){signal="LONG";label="GÜÇLÜ LONG"}
    else if(shortStrong){signal="SHORT";label="GÜÇLÜ SHORT"}
    else if(longCandidate){signal="LONG";label="LONG ADAYI"}
    else if(shortCandidate){signal="SHORT";label="SHORT ADAYI"}
  }
  return {score,label,signal,breakdown,blockers,confirmations,profile:cfg.name,thresholds:cfg,metrics:{adx:adxV,rvol:rv,atrPct,bodyAtr,dist20,mtf15:mtf.m15,mtf1h:mtf.h1}}
}
function commonDecision(legacy,advanced){
  let decision="BEKLE",note="V7 filtreleri işlem teyidi vermedi.";
  const opp=legacy.signal!=="BEKLE"&&advanced.signal!=="BEKLE"&&legacy.signal!==advanced.signal;
  if(opp){note="7'li sistem ile V7 ters yönde; işlem iptal."}
  else if(advanced.signal==="LONG"&&legacy.signal!=="SHORT"){
    decision=advanced.score>=advanced.thresholds.strongLong?"GÜÇLÜ LONG":"LONG";
    note=legacy.signal==="LONG"?"V7 + 7'li sistem LONG uyumlu.":"V7 LONG; 7'li sistem karşı değil.";
  }else if(advanced.signal==="SHORT"&&legacy.signal!=="LONG"){
    decision=advanced.score<=advanced.thresholds.strongShort?"GÜÇLÜ SHORT":"SHORT";
    note=legacy.signal==="SHORT"?"V7 + 7'li sistem SHORT uyumlu.":"V7 SHORT; 7'li sistem karşı değil.";
  }else if(advanced.blockers?.length){note="BEKLE • "+advanced.blockers.slice(0,2).join(" • ")}
  const confidence=decision==="BEKLE"?Math.round(clamp(50+Math.abs(advanced.score-50)*.45,50,70)):Math.round(clamp(60+Math.abs(advanced.score-50)*.8+advanced.confirmations*2,65,94));
  return {decision,confidence,note}
}
function smartLevels(d,h,l,c,n,decision){
  const price=c[n],a=d.atrV[n]||price*.005,e20=d.e20[n],res=Math.max(...h.slice(n-20,n)),sup=Math.min(...l.slice(n-20,n));
  const side=decision.includes("LONG")?"LONG":decision.includes("SHORT")?"SHORT":"NONE";
  if(side==="NONE")return {entry:null,entryLow:null,entryHigh:null,stop:null,tp1:null,tp2:null,reason:"V7 işlem teyidi yok"};
  let entry,reason;
  if(side==="LONG"){const br=price>res;entry=Math.min(price,br?res+.05*a:e20);reason=br?"Kırılan direncin retesti":"EMA20 geri çekilme bölgesi"}
  else {const br=price<sup;entry=Math.max(price,br?sup-.05*a:e20);reason=br?"Kırılan desteğin retesti":"EMA20 tepki bölgesi"}
  const stop=side==="LONG"?entry-1.15*a:entry+1.15*a,tp1=side==="LONG"?entry+1.55*a:entry-1.55*a,tp2=side==="LONG"?entry+2.45*a:entry-2.45*a;
  return {entry,entryLow:entry-.10*a,entryHigh:entry+.10*a,stop,tp1,tp2,reason}
}
async function getJson(url){
  const r=await fetch(url);if(!r.ok)throw new Error("Binance veri hatası");return r.json()
}

function tfBiasAtSeries(k,atMs){
  return tfBiasFromKlines(k,atMs)
}
function sideOfDecision(x){return x.includes("LONG")?"LONG":x.includes("SHORT")?"SHORT":null}
function evalTrade(side,entry,a,fh,fl){
  const sl=side==="LONG"?entry-1.15*a:entry+1.15*a,tp=side==="LONG"?entry+1.55*a:entry-1.55*a;
  for(let i=0;i<fh.length;i++){
    const h=fh[i],l=fl[i];
    if(side==="LONG"){const s=l<=sl,t=h>=tp;if(s&&t)return"LOSS";if(s)return"LOSS";if(t)return"WIN"}
    else {const s=h>=sl,t=l<=tp;if(s&&t)return"LOSS";if(s)return"LOSS";if(t)return"WIN"}
  }
  return "OPEN"
}
function summarize(trades){
  const r=trades.filter(x=>x!=="OPEN"),w=r.filter(x=>x==="WIN").length,l=r.filter(x=>x==="LOSS").length;
  const wr=r.length?w/r.length*100:0,gp=w*1.55,gl=l*1.15,pf=gl?gp/gl:(gp?99:0);
  const expectancy=r.length?(w*1.55-l*1.15)/r.length:0;
  return {signals:trades.length,resolved:r.length,wins:w,losses:l,open:trades.length-r.length,winRate:+wr.toFixed(1),profitFactor:+pf.toFixed(2),expectancyR:+expectancy.toFixed(2)}
}




async function doAnalyze(body){
  const symbol=String(body.symbol||"BTCTRY").toUpperCase().replace(/[^A-Z0-9]/g,"");
  const interval=String(body.interval||"5m");
  const profile=getProfile(body.profile).name;
  const k=body.k,k15=body.k15,k1h=body.k1h;
  if(!Array.isArray(k)||!Array.isArray(k15)||!Array.isArray(k1h))throw new Error("Binance TR mum verisi eksik.");
  const u=unpack(k,true);
  if(u.c.length<220)throw new Error("Yeterli Binance TR mum verisi yok.");
  const d=calcAll(u.o,u.h,u.l,u.c,u.v),n=u.c.length-1;
  const mtf={m15:tfBiasFromKlines(k15),h1:tfBiasFromKlines(k1h)};
  const legacy=legacyAt(d,u.o,u.h,u.l,u.c,u.v,n,true);
  const advanced=optimizedAt(d,u.o,u.h,u.l,u.c,u.v,n,mtf,profile);
  const common=commonDecision(legacy,advanced);
  let levelDecision=common.decision,source="SPOT TEYİDİ";
  if(common.decision==="BEKLE"&&!advanced.blockers.length&&advanced.confirmations>=Math.max(4,advanced.thresholds.minConf)){
    if(advanced.score>=Math.min(92,advanced.thresholds.strongLong+4)){levelDecision="GÜÇLÜ LONG";source="V7 ÇOK GÜÇLÜ ADAY"}
    else if(advanced.score<=Math.max(8,advanced.thresholds.strongShort-4)){levelDecision="GÜÇLÜ SHORT";source="V7 ÇOK GÜÇLÜ ADAY"}
  }
  const livePrice=Number(k[k.length-1]?.[4])||u.c[n];
  const levels=smartLevels(d,u.h,u.l,u.c,n,levelDecision,livePrice);
  levels.source=levels.entry==null?"SEVİYE YOK":source;
  const h1u=unpack(k1h,false);
  const prev24=h1u.c.length>24?h1u.c[h1u.c.length-25]:null;
  const change24=prev24?((livePrice/prev24)-1)*100:0;
  return {
    symbol,displaySymbol:symbol,exchange:"binancetr",marketType:"SPOT",quoteAsset:"TRY",
    interval,price:livePrice,signalClose:u.c[n],change24,legacy,advanced,common,levels,
    v7:{version:"7.6-TR",profile,thresholds:advanced.thresholds,mtf,blockers:advanced.blockers,confirmations:advanced.confirmations,metrics:advanced.metrics},
    dataSource:"Binance TR resmi API • proxy üzerinden",
    timestamp:new Date().toISOString()
  };
}

async function doBacktest(body){
  const symbol=String(body.symbol||"BTCTRY").toUpperCase().replace(/[^A-Z0-9]/g,"");
  const interval=String(body.interval||"5m");
  const profile=getProfile(body.profile).name;
  const k=body.k,k15=body.k15,k1h=body.k1h;
  if(!Array.isArray(k)||!Array.isArray(k15)||!Array.isArray(k1h))throw new Error("Backtest mum verisi eksik.");
  const u=unpack(k,false),d=calcAll(u.o,u.h,u.l,u.c,u.v);
  const legacyTrades=[],advancedTrades=[],commonTrades=[];
  const horizon=12,start=220;
  for(let i=start;i<u.c.length-horizon-1;i++){
    const at=u.t[i],mtf={m15:tfBiasAtSeries(k15,at),h1:tfBiasAtSeries(k1h,at)};
    const legacy=legacyAt(d,u.o,u.h,u.l,u.c,u.v,i,false);
    const advanced=optimizedAt(d,u.o,u.h,u.l,u.c,u.v,i,mtf,profile);
    const common=commonDecision(legacy,advanced);
    const entry=u.o[i+1],atrNow=d.atrV[i];if(!atrNow)continue;
    if(legacy.signal!=="BEKLE")legacyTrades.push(evalTrade(legacy.signal,entry,atrNow,u.h.slice(i+1,i+13),u.l.slice(i+1,i+13)));
    if(advanced.signal!=="BEKLE")advancedTrades.push(evalTrade(advanced.signal,entry,atrNow,u.h.slice(i+1,i+13),u.l.slice(i+1,i+13)));
    const side=sideOfDecision(common.decision);
    if(side)commonTrades.push(evalTrade(side,entry,atrNow,u.h.slice(i+1,i+13),u.l.slice(i+1,i+13)));
  }
  return {
    symbol,interval,candles:k.length,horizon,profile,exchange:"binancetr",marketType:"SPOT",
    methodology:`Binance TR Spot • V7.6 ${profile} • TP 1.55 ATR / SL 1.15 ATR.`,
    legacy:summarize(legacyTrades),advanced:summarize(advancedTrades),common:summarize(commonTrades),
    timestamp:new Date().toISOString()
  };
}

async function doScan(body){
  const profile=getProfile(body.profile).name,cfg=getProfile(profile);
  const rows=Array.isArray(body.rows)?body.rows:[];
  const final=[],skipped=[];
  for(const row of rows){
    try{
      const symbol=String(row.symbol||"").toUpperCase().replace(/[^A-Z0-9]/g,"");
      const k=row.k,k15=row.k15,k1h=row.k1h;
      if(!symbol||!Array.isArray(k)||k.length<220){skipped.push({symbol,error:"5m veri eksik"});continue}
      const u=unpack(k,true);if(u.c.length<210)continue;
      const d=calcAll(u.o,u.h,u.l,u.c,u.v),n=u.c.length-1;
      let mtf={m15:0,h1:0};
      if(Array.isArray(k15)&&k15.length>210&&Array.isArray(k1h)&&k1h.length>210){
        mtf={m15:tfBiasFromKlines(k15),h1:tfBiasFromKlines(k1h)};
      }
      const z=optimizedAt(d,u.o,u.h,u.l,u.c,u.v,n,mtf,profile);
      if(z.signal==="BEKLE")continue;
      const direction=z.signal,shock=z.metrics.atrPct>3.2||z.metrics.bodyAtr>2.1;
      const qualityPass=!shock&&!z.blockers.length&&z.confirmations>=cfg.minConf;
      final.push({
        symbol,direction,score:z.score,price:u.c[n],
        reason:z.breakdown.slice(0,3).map(x=>x.text).join(" • "),
        adx:z.metrics.adx,rvol:z.metrics.rvol,atrPct:z.metrics.atrPct,
        shock,qualityPass,confirmations:z.confirmations
      });
    }catch(e){skipped.push({symbol:row?.symbol||"?",error:e?.message||"analiz hatası"})}
  }
  const strongLong=final.filter(x=>x.direction==="LONG"&&x.score>=cfg.strongLong).sort((a,b)=>b.score-a.score).slice(0,8);
  const strongShort=final.filter(x=>x.direction==="SHORT"&&x.score<=cfg.strongShort).sort((a,b)=>a.score-b.score).slice(0,8);
  return {
    exchange:"binancetr",marketType:"SPOT",profile,scanned:rows.length,skipped,
    btcDirection:"NEUTRAL",btcScore:50,strongLong,strongShort,
    timestamp:new Date().toISOString()
  };
}


const FUTURES_TESTNET_BASE="https://testnet.binancefuture.com";

function testnetEnv(){
  return {
    apiKey:String(process.env.BINANCE_TESTNET_API_KEY||""),
    secret:String(process.env.BINANCE_TESTNET_SECRET_KEY||""),
    appToken:String(process.env.BINANCE_TESTNET_APP_TOKEN||"")
  };
}
function requireTestnetAuth(req){
  const env=testnetEnv();
  if(!env.apiKey||!env.secret||!env.appToken){
    throw new Error("Testnet ayarları eksik. Vercel Environment Variables: BINANCE_TESTNET_API_KEY, BINANCE_TESTNET_SECRET_KEY, BINANCE_TESTNET_APP_TOKEN");
  }
  const token=String(req.headers["x-app-token"]||"");
  if(!token||token!==env.appToken)throw new Error("Testnet uygulama erişim kodu yanlış.");
  return env;
}
async function futPublic(path,params={}){
  const q=new URLSearchParams();
  Object.entries(params).forEach(([k,v])=>{if(v!==undefined&&v!==null&&v!=="")q.set(k,String(v))});
  const url=FUTURES_TESTNET_BASE+path+(q.toString()?`?${q.toString()}`:"");
  const r=await fetch(url,{headers:{accept:"application/json"}});
  const text=await r.text();
  let j;try{j=JSON.parse(text)}catch{throw new Error(`Binance Testnet JSON hatası • HTTP ${r.status}`)}
  if(!r.ok||Number(j?.code)<0)throw new Error(j?.msg||`Binance Testnet HTTP ${r.status}`);
  return j;
}
async function futSigned(method,path,params={},env){
  const q=new URLSearchParams();
  Object.entries(params).forEach(([k,v])=>{if(v!==undefined&&v!==null&&v!=="")q.set(k,String(v))});
  q.set("recvWindow","5000");
  q.set("timestamp",String(Date.now()));
  const payload=q.toString();
  const sig=crypto.createHmac("sha256",env.secret).update(payload).digest("hex");
  const url=`${FUTURES_TESTNET_BASE}${path}?${payload}&signature=${sig}`;
  const r=await fetch(url,{method,headers:{"X-MBX-APIKEY":env.apiKey,accept:"application/json"}});
  const text=await r.text();
  let j;try{j=JSON.parse(text)}catch{throw new Error(`Binance Testnet cevap hatası • HTTP ${r.status}`)}
  if(!r.ok||Number(j?.code)<0)throw new Error(j?.msg||`Binance Testnet HTTP ${r.status}`);
  return j;
}
function decimalsFromStep(step){
  const s=String(step).toLowerCase();
  if(s.includes("e-")){
    const exp=Number(s.split("e-")[1]||0);
    const mantissa=s.split("e-")[0];
    const mantissaDecimals=(mantissa.split(".")[1]||"").length;
    return Math.max(0,exp+mantissaDecimals);
  }
  if(!s.includes("."))return 0;
  return s.replace(/0+$/,"").split(".")[1]?.length||0;
}
function normalizeDecimal(value,decimals){
  const n=Number(value);
  if(!Number.isFinite(n))return n;
  return Number(n.toFixed(Math.min(16,Math.max(0,decimals))));
}
function floorStep(value,step){
  const st=Number(step);
  if(!Number.isFinite(st)||st<=0)return Number(value);
  const d=decimalsFromStep(step);
  const units=Math.floor((Number(value)/st)+1e-9);
  return normalizeDecimal(units*st,d);
}
function roundTick(value,tick){
  const t=Number(tick);
  if(!Number.isFinite(t)||t<=0)return Number(value);
  const d=decimalsFromStep(tick);
  const units=Math.round(Number(value)/t);
  return normalizeDecimal(units*t,d);
}
async function testnetSymbolRules(symbol){
  const ex=await futPublic("/fapi/v1/exchangeInfo");
  const s=ex.symbols?.find(x=>x.symbol===symbol);
  if(!s)throw new Error("Testnet sembolü bulunamadı.");
  const lot=s.filters?.find(x=>x.filterType==="MARKET_LOT_SIZE")||s.filters?.find(x=>x.filterType==="LOT_SIZE");
  const price=s.filters?.find(x=>x.filterType==="PRICE_FILTER");
  const minNot=s.filters?.find(x=>x.filterType==="MIN_NOTIONAL");
  return {
    minQty:Number(lot?.minQty||0),
    maxQty:Number(lot?.maxQty||1e30),
    stepSize:String(lot?.stepSize||"1"),
    tickSize:String(price?.tickSize||"0.01"),
    minNotional:Number(minNot?.notional||5)
  };
}
async function testnetAccount(req){
  const env=requireTestnetAuth(req);
  const [balances,positions,mode,orders,algoOrders]=await Promise.all([
    futSigned("GET","/fapi/v2/balance",{},env),
    futSigned("GET","/fapi/v2/positionRisk",{},env),
    futSigned("GET","/fapi/v1/positionSide/dual",{},env),
    futSigned("GET","/fapi/v1/openOrders",{},env),
    futSigned("GET","/fapi/v1/openAlgoOrders",{algoType:"CONDITIONAL"},env).catch(()=>[])
  ]);
  const usdt=balances.find(x=>x.asset==="USDT")||{};
  const openPositions=positions.filter(x=>Math.abs(Number(x.positionAmt||0))>0).map(x=>({
    symbol:x.symbol,
    positionAmt:Number(x.positionAmt),
    entryPrice:Number(x.entryPrice),
    markPrice:Number(x.markPrice),
    unrealizedProfit:Number(x.unRealizedProfit),
    leverage:Number(x.leverage),
    liquidationPrice:Number(x.liquidationPrice)
  }));
  return {
    testnet:true,
    oneWayMode:!Boolean(mode?.dualSidePosition),
    walletBalance:Number(usdt.balance||0),
    availableBalance:Number(usdt.availableBalance||0),
    openPositions,
    openOrders:(orders||[]).map(x=>({symbol:x.symbol,orderId:x.orderId,type:x.type,side:x.side,stopPrice:Number(x.stopPrice||0),origQty:Number(x.origQty||0),status:x.status})),
    algoOrders:(algoOrders||[]).map(x=>({
      symbol:x.symbol,
      algoId:x.algoId,
      clientAlgoId:x.clientAlgoId,
      type:x.type,
      side:x.side,
      triggerPrice:Number(x.triggerPrice||0),
      quantity:Number(x.quantity||0),
      closePosition:String(x.closePosition||"").toLowerCase()==="true",
      algoStatus:x.algoStatus||x.status||"NEW"
    }))
  };
}
async function emergencyCloseSymbol(symbol,positionAmt,env){
  try{await futSigned("DELETE","/fapi/v1/allOpenOrders",{symbol},env)}catch(e){}
  try{await futSigned("DELETE","/fapi/v1/algoOpenOrders",{symbol},env)}catch(e){}
  if(!positionAmt)return;
  const side=Number(positionAmt)>0?"SELL":"BUY";
  const rules=await testnetSymbolRules(symbol);
  const qty=floorStep(Math.abs(Number(positionAmt)),rules.stepSize);
  if(qty>0){
    try{await futSigned("POST","/fapi/v1/order",{symbol,side,type:"MARKET",quantity:qty,reduceOnly:"true",newOrderRespType:"RESULT"},env)}catch(e){}
  }
}
async function testnetOpen(req){
  const env=requireTestnetAuth(req);
  const body=req.body||{};
  const symbol=String(body.symbol||"").toUpperCase().replace(/[^A-Z0-9]/g,"");
  const direction=String(body.direction||"").toUpperCase();
  const riskPct=Math.max(.1,Math.min(2,Number(body.riskPercent)||.5));
  const leverage=Math.max(1,Math.min(20,Math.round(Number(body.leverage)||5)));
  const stop=Number(body.stop),tp1=Number(body.tp1),tp2=Number(body.tp2);
  if(!/^[A-Z0-9]{5,20}$/.test(symbol))throw new Error("Geçersiz sembol.");
  if(!["LONG","SHORT"].includes(direction))throw new Error("Yön LONG veya SHORT olmalı.");
  if(![stop,tp1,tp2].every(Number.isFinite))throw new Error("SL/TP seviyeleri eksik.");

  const mode=await futSigned("GET","/fapi/v1/positionSide/dual",{},env);
  if(Boolean(mode?.dualSidePosition))throw new Error("İlk sürüm yalnızca One-way Mode destekliyor. Binance Futures Testnet'te Position Mode'u One-way yap.");

  const existing=await futSigned("GET","/fapi/v2/positionRisk",{symbol},env);
  const current=Array.isArray(existing)?existing.find(x=>x.symbol===symbol):null;
  if(Math.abs(Number(current?.positionAmt||0))>0)throw new Error(`${symbol} için zaten açık pozisyon var.`);

  const [balances,markInfo,rules]=await Promise.all([
    futSigned("GET","/fapi/v2/balance",{},env),
    futPublic("/fapi/v1/premiumIndex",{symbol}),
    testnetSymbolRules(symbol)
  ]);
  const usdt=balances.find(x=>x.asset==="USDT")||{};
  const available=Number(usdt.availableBalance||0);
  const mark=Number(markInfo.markPrice);
  if(!Number.isFinite(mark)||mark<=0)throw new Error("Mark price alınamadı.");

  if(direction==="LONG" && !(stop<mark&&tp1>mark&&tp2>mark))throw new Error("LONG için SL fiyatın altında, hedefler fiyatın üstünde olmalı.");
  if(direction==="SHORT" && !(stop>mark&&tp1<mark&&tp2<mark))throw new Error("SHORT için SL fiyatın üstünde, hedefler fiyatın altında olmalı.");

  const riskUsd=available*(riskPct/100);
  const stopDistance=Math.abs(mark-stop);
  if(stopDistance<=0)throw new Error("Stop mesafesi geçersiz.");

  let qty=riskUsd/stopDistance;
  const maxNotional=Math.min(10000,available*leverage*.95);
  qty=Math.min(qty,maxNotional/mark);
  qty=floorStep(qty,rules.stepSize);
  if(qty<rules.minQty)throw new Error("Hesaplanan miktar minimum emir miktarının altında.");
  if(qty*mark<rules.minNotional)throw new Error(`Emir nominali minimum ${rules.minNotional} USDT altında.`);

  const roundedStop=roundTick(stop,rules.tickSize);
  const roundedTp1=roundTick(tp1,rules.tickSize);
  const roundedTp2=roundTick(tp2,rules.tickSize);

  if(![roundedStop,roundedTp1,roundedTp2].every(x=>Number.isFinite(x)&&x>0)){
    throw new Error(`Fiyat hassasiyeti hatası: SL/TP sıfır veya geçersiz oluştu. tickSize=${rules.tickSize}`);
  }

  await futSigned("POST","/fapi/v1/leverage",{symbol,leverage},env);

  const entrySide=direction==="LONG"?"BUY":"SELL";
  const exitSide=direction==="LONG"?"SELL":"BUY";
  let entryOrder=null;
  try{
    entryOrder=await futSigned("POST","/fapi/v1/order",{
      symbol,side:entrySide,type:"MARKET",quantity:qty,newOrderRespType:"RESULT"
    },env);

    const executedQty=floorStep(Number(entryOrder.executedQty||qty),rules.stepSize);
    const halfQty=floorStep(executedQty*.5,rules.stepSize);

    const protective=[];
    protective.push(await futSigned("POST","/fapi/v1/algoOrder",{
      algoType:"CONDITIONAL",
      symbol,
      side:exitSide,
      type:"STOP_MARKET",
      triggerPrice:roundedStop,
      closePosition:"true",
      workingType:"MARK_PRICE",
      newOrderRespType:"ACK"
    },env));

    if(halfQty>=rules.minQty && halfQty*mark>=rules.minNotional){
      protective.push(await futSigned("POST","/fapi/v1/algoOrder",{
        algoType:"CONDITIONAL",
        symbol,
        side:exitSide,
        type:"TAKE_PROFIT_MARKET",
        triggerPrice:roundedTp1,
        quantity:halfQty,
        reduceOnly:"true",
        workingType:"MARK_PRICE",
        newOrderRespType:"ACK"
      },env));
    }

    protective.push(await futSigned("POST","/fapi/v1/algoOrder",{
      algoType:"CONDITIONAL",
      symbol,
      side:exitSide,
      type:"TAKE_PROFIT_MARKET",
      triggerPrice:roundedTp2,
      closePosition:"true",
      workingType:"MARK_PRICE",
      newOrderRespType:"ACK"
    },env));

    return {
      testnet:true,symbol,direction,leverage,riskPercent:riskPct,riskUsd,
      markPrice:mark,quantity:executedQty,notional:executedQty*mark,
      stop:roundedStop,tp1:roundedTp1,tp2:roundedTp2,
      entryOrder,protectiveOrders:protective
    };
  }catch(e){
    if(entryOrder){
      try{
        const pos=await futSigned("GET","/fapi/v2/positionRisk",{symbol},env);
        const p=Array.isArray(pos)?pos.find(x=>x.symbol===symbol):null;
        await emergencyCloseSymbol(symbol,Number(p?.positionAmt||0),env);
      }catch(_){}
      throw new Error(`Koruyucu emir kurulamadı; pozisyon kapatılmaya çalışıldı. ${e.message}`);
    }
    throw e;
  }
}
async function testnetClose(req){
  const env=requireTestnetAuth(req);
  const symbol=String(req.body?.symbol||"").toUpperCase().replace(/[^A-Z0-9]/g,"");
  if(!symbol)throw new Error("Sembol gerekli.");
  const pos=await futSigned("GET","/fapi/v2/positionRisk",{symbol},env);
  const p=Array.isArray(pos)?pos.find(x=>x.symbol===symbol):null;
  const amt=Number(p?.positionAmt||0);
  await emergencyCloseSymbol(symbol,amt,env);
  return {testnet:true,symbol,closed:true,previousPositionAmt:amt};
}

export default async function handler(req,res){
  try{
    const action=String(req.query.action||req.body?.action||"");
    if(["analyze","backtest","scan","testnet-account","testnet-open","testnet-close"].includes(action) && req.method!=="POST"){
      return res.status(405).json({error:"POST gerekli."});
    }
    let result;
    if(action==="analyze")result=await doAnalyze(req.body||{});
    else if(action==="backtest")result=await doBacktest(req.body||{});
    else if(action==="scan")result=await doScan(req.body||{});
    else if(action==="testnet-account")result=await testnetAccount(req);
    else if(action==="testnet-open")result=await testnetOpen(req);
    else if(action==="testnet-close")result=await testnetClose(req);
    else return res.status(400).json({error:"Geçersiz action."});
    res.setHeader("Cache-Control","no-store");
    return res.status(200).json(result);
  }catch(e){
    return res.status(500).json({error:e?.message||"Binance TR işlem hatası."});
  }
}
