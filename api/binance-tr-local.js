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
  const a=d.atrV[n]||Math.max(c[n]*.004,1e-12);
  const atrPct=a/c[n]*100;
  const rv=d.vma[n]?v[n]/d.vma[n]:1;
  const adxV=d.adxD.adx[n],p=d.adxD.plusDI[n],m=d.adxD.minusDI[n];
  const tb=trendBias(d,c,n);

  const range=Math.max(h[n]-l[n],1e-12);
  const body=Math.abs(c[n]-o[n]);
  const bodyAtr=body/a;
  const upperWick=Math.max(0,h[n]-Math.max(o[n],c[n]));
  const lowerWick=Math.max(0,Math.min(o[n],c[n])-l[n]);
  const upperWickPct=upperWick/range;
  const lowerWickPct=lowerWick/range;
  const closePos=(c[n]-l[n])/range;

  const dist20Signed=(c[n]-d.e20[n])/a;
  const dist20=Math.abs(dist20Signed);
  const move3=(c[n]-c[Math.max(0,n-3)])/a;
  const move5=(c[n]-c[Math.max(0,n-5)])/a;

  const prevRes=Math.max(...h.slice(Math.max(0,n-24),n-1));
  const prevSup=Math.min(...l.slice(Math.max(0,n-24),n-1));
  const brokeUpRecently=Math.max(...c.slice(Math.max(0,n-3),n+1))>prevRes;
  const brokeDnRecently=Math.min(...c.slice(Math.max(0,n-3),n+1))<prevSup;

  const emaRetestLong=l[n]<=d.e20[n]+.18*a && c[n]>=d.e20[n] && closePos>=.58;
  const emaRetestShort=h[n]>=d.e20[n]-.18*a && c[n]<=d.e20[n] && closePos<=.42;
  const levelRetestLong=brokeUpRecently && l[n]<=prevRes+.18*a && c[n]>=prevRes-.04*a;
  const levelRetestShort=brokeDnRecently && h[n]>=prevSup-.18*a && c[n]<=prevSup+.04*a;

  const wickLong=lowerWickPct>=.25 && closePos>=.58 && c[n]>=o[n];
  const wickShort=upperWickPct>=.25 && closePos<=.42 && c[n]<=o[n];

  const retestLong=emaRetestLong||levelRetestLong;
  const retestShort=emaRetestShort||levelRetestShort;
  const rejectionLong=wickLong||(retestLong&&c[n]>o[n]);
  const rejectionShort=wickShort||(retestShort&&c[n]<o[n]);

  const histSlope=d.hist[n]-d.hist[Math.max(0,n-2)];
  const trendLong=(tb>0&&mtf.m15>=0&&mtf.h1>=0)||(tb>=.5&&mtf.m15>0);
  const trendShort=(tb<0&&mtf.m15<=0&&mtf.h1<=0)||(tb<=-.5&&mtf.m15<0);

  let score=50;
  const breakdown=[];
  let confirmations=0;

  let trendPts=0;
  if(tb===1)trendPts=15;else if(tb===.5)trendPts=8;else if(tb===-1)trendPts=-15;else if(tb===-.5)trendPts=-8;
  if(mtf.m15>0&&mtf.h1>0)trendPts+=8;
  else if(mtf.m15<0&&mtf.h1<0)trendPts-=8;
  else if((mtf.m15||0)+(mtf.h1||0)>0)trendPts+=3;
  else if((mtf.m15||0)+(mtf.h1||0)<0)trendPts-=3;
  score+=trendPts;
  if(Math.abs(trendPts)>=12)confirmations++;
  breakdown.push({label:"Trend",score:Math.round(clamp(12.5+trendPts*.55,0,25)),max:25,text:`5m ${tb>0?"↑":tb<0?"↓":"→"} • 15m ${mtf.m15>0?"↑":mtf.m15<0?"↓":"→"} • 1h ${mtf.h1>0?"↑":mtf.h1<0?"↓":"→"}`});

  let structurePts=0;
  if(retestLong){structurePts+=12;confirmations++}
  if(retestShort){structurePts-=12;confirmations++}
  if(!retestLong&&!retestShort){
    if(c[n]>c[n-4]&&l[n]>=Math.min(...l.slice(n-4,n)))structurePts=4;
    else if(c[n]<c[n-4]&&h[n]<=Math.max(...h.slice(n-4,n)))structurePts=-4;
  }
  score+=structurePts;
  breakdown.push({label:"Retest / Yapı",score:Math.round(clamp(10+structurePts*.65,0,20)),max:20,text:retestLong?"LONG retest oluştu":retestShort?"SHORT retest oluştu":"Retest bekleniyor"});

  let rejectPts=0;
  if(rejectionLong){rejectPts=9;confirmations++}
  else if(rejectionShort){rejectPts=-9;confirmations++}
  score+=rejectPts;
  breakdown.push({label:"Fitil / Tepki",score:Math.round(clamp(7.5+rejectPts*.7,0,15)),max:15,text:rejectionLong?"Aşağı fitil + güçlü kapanış":rejectionShort?"Yukarı fitil + satış kapanışı":"Net rejection yok"});

  let momentumPts=0;
  if(d.r[n]>=48&&d.r[n]<=64&&histSlope>0)momentumPts=7;
  else if(d.r[n]<=52&&d.r[n]>=36&&histSlope<0)momentumPts=-7;
  else if(d.r[n]>69)momentumPts=-2;
  else if(d.r[n]<31)momentumPts=2;
  score+=momentumPts;
  if(Math.abs(momentumPts)>=6)confirmations++;
  breakdown.push({label:"Momentum",score:Math.round(clamp(7.5+momentumPts*.7,0,15)),max:15,text:`RSI ${Number(d.r[n]||0).toFixed(1)} • MACD ivme ${histSlope>0?"↑":histSlope<0?"↓":"→"}`});

  let flowPts=0;
  if(rv>=.9&&rv<=2.2){
    if(c[n]>o[n])flowPts=5;
    else if(c[n]<o[n])flowPts=-5;
    if(rv>=1.05)confirmations++;
  }
  score+=flowPts;
  breakdown.push({label:"Hacim",score:Math.round(clamp(7.5+flowPts,0,15)),max:15,text:`RVOL ${rv.toFixed(2)}x • ${rv<.8?"zayıf":rv>2.4?"aşırı":"uygun"}`});

  let adxPts=0;
  if(Number.isFinite(adxV)){
    const strength=clamp((adxV-17)/18,0,1);
    adxPts=(p>m?1:-1)*5*strength;
    if(adxV>=18)confirmations++;
  }
  score+=adxPts;
  breakdown.push({label:"Trend Gücü",score:Math.round(clamp(5+adxPts,0,10)),max:10,text:Number.isFinite(adxV)?`ADX ${adxV.toFixed(1)}`:"ADX hazır değil"});

  score=Math.round(clamp(score,0,100));

  const blockers=[];
  const warnings=[];
  const likelyLong=score>=50;
  const likelyShort=score<50;

  if(Number.isFinite(adxV)&&adxV<17)blockers.push("Yatay piyasa / ADX düşük");
  if(atrPct<.15)blockers.push("Volatilite çok düşük");
  if(atrPct>3.2)blockers.push("Volatilite aşırı yüksek");
  if(rv<.72)blockers.push("Hacim zayıf");
  if(bodyAtr>1.75)blockers.push("Anormal büyük mum");

  if(likelyLong&&dist20Signed>.72)blockers.push("GEÇ KALINDI • fiyat EMA20'den fazla uzak");
  if(likelyShort&&dist20Signed<-.72)blockers.push("GEÇ KALINDI • fiyat EMA20'den fazla uzak");
  if(likelyLong&&move3>1.35&&!retestLong)blockers.push("PUMP KOVALAMA • son 3 mum fazla yükseldi");
  if(likelyShort&&move3<-1.35&&!retestShort)blockers.push("DUMP KOVALAMA • son 3 mum fazla düştü");
  if(likelyLong&&d.r[n]>69)blockers.push("RSI yüksek • LONG kovalanmıyor");
  if(likelyShort&&d.r[n]<31)blockers.push("RSI düşük • SHORT kovalanmıyor");
  if(likelyLong&&mtf.m15<0&&mtf.h1<0)blockers.push("15m + 1h LONG'a ters");
  if(likelyShort&&mtf.m15>0&&mtf.h1>0)blockers.push("15m + 1h SHORT'a ters");

  if(upperWickPct>.48&&likelyLong)warnings.push("Üst fitil güçlü • satış baskısı var");
  if(lowerWickPct>.48&&likelyShort)warnings.push("Alt fitil güçlü • alım tepkisi var");
  if(Math.abs(move5)>2.1)warnings.push("Son 5 mum hareketi aşırı geniş");

  const trend=score>=64?"LONG":score<=36?"SHORT":"NÖTR";
  let stage="İZLE";
  let signal="BEKLE";
  let label="BEKLE";

  const longQuality=trend==="LONG"&&trendLong&&retestLong&&rejectionLong&&d.r[n]<=69&&rv>=.8&&confirmations>=Math.max(4,cfg.minConf);
  const shortQuality=trend==="SHORT"&&trendShort&&retestShort&&rejectionShort&&d.r[n]>=31&&rv>=.8&&confirmations>=Math.max(4,cfg.minConf);

  if(trend==="LONG"){
    if(retestLong)stage="HAZIR";
    if(longQuality&&!blockers.length&&score>=Math.max(76,cfg.candidateLong)){stage="AL";signal="LONG";label=score>=Math.max(84,cfg.strongLong)?"GÜÇLÜ LONG":"LONG"}
  }else if(trend==="SHORT"){
    if(retestShort)stage="HAZIR";
    if(shortQuality&&!blockers.length&&score<=Math.min(24,cfg.candidateShort)){stage="SAT";signal="SHORT";label=score<=Math.min(16,cfg.strongShort)?"GÜÇLÜ SHORT":"SHORT"}
  }

  return {
    score,label,signal,trend,stage,breakdown,blockers,warnings,confirmations,profile:cfg.name,thresholds:cfg,
    setup:{retestLong,retestShort,rejectionLong,rejectionShort,emaRetestLong,emaRetestShort,levelRetestLong,levelRetestShort},
    metrics:{adx:adxV,rvol:rv,atrPct,bodyAtr,dist20,dist20Signed,move3,move5,upperWickPct,lowerWickPct,mtf15:mtf.m15,mtf1h:mtf.h1}
  }
}
function commonDecision(legacy,advanced){
  let decision="BEKLE";
  let note=`V10 • ${advanced.trend} trend • ${advanced.stage}`;
  if(advanced.signal==="LONG"&&legacy.signal!=="SHORT"){
    decision=advanced.label.includes("GÜÇLÜ")?"GÜÇLÜ LONG":"LONG";
    note="V10 retest + rejection LONG teyidi.";
  }else if(advanced.signal==="SHORT"&&legacy.signal!=="LONG"){
    decision=advanced.label.includes("GÜÇLÜ")?"GÜÇLÜ SHORT":"SHORT";
    note="V10 retest + rejection SHORT teyidi.";
  }else if(advanced.blockers?.length){
    note=`${advanced.stage} • ${advanced.blockers.slice(0,2).join(" • ")}`;
  }else if(advanced.stage==="HAZIR"){
    note=`HAZIR • ${advanced.trend} yönlü retest var, son giriş teyidi bekleniyor.`;
  }else if(advanced.trend!=="NÖTR"){
    note=`İZLE • trend ${advanced.trend}, uygun retest bekleniyor.`;
  }else{
    note="İZLE • trend yeterince net değil.";
  }
  const base=decision==="BEKLE"?55:72;
  const confidence=Math.round(clamp(base+Math.abs(advanced.score-50)*.45+(advanced.confirmations||0)*1.2-(advanced.blockers?.length||0)*5,50,94));
  return {decision,confidence,note,trend:advanced.trend,stage:advanced.stage}
}

function v11DirectionEligible(advanced,profileName="balanced"){
  const cfg=getProfile(profileName);
  const mode=cfg.name;
  const score=Number(advanced.score||50);

  // V11.2: Hızlı/Dengeli modda 5m retest zorunlu değil.
  // 5m yalnızca yön/rejim filtresi; esas giriş 1m tetikleyicide.
  let direction="NÖTR";
  if(score>=56)direction="LONG";
  else if(score<=44)direction="SHORT";

  const hard=(advanced.blockers||[]).filter(x=>
    /Volatilite aşırı|Anormal büyük mum|15m \+ 1h/.test(String(x))
  );
  if(hard.length)return {ok:false,direction,reason:hard[0]};

  if(mode==="safe"){
    const ok=advanced.signal==="LONG"||advanced.signal==="SHORT";
    return {
      ok,
      direction:ok?advanced.signal:direction,
      reason:ok?"5m Güvenli setup hazır":"5m güvenli setup/retest bekleniyor"
    };
  }

  const longMin=mode==="fast"?57:62;
  const shortMax=mode==="fast"?43:38;
  const minConf=mode==="fast"?1:2;

  if(score>=longMin&&(advanced.confirmations||0)>=minConf){
    return {ok:true,direction:"LONG",reason:`5m ${mode==="fast"?"Hızlı":"Dengeli"} LONG yön`};
  }
  if(score<=shortMax&&(advanced.confirmations||0)>=minConf){
    return {ok:true,direction:"SHORT",reason:`5m ${mode==="fast"?"Hızlı":"Dengeli"} SHORT yön`};
  }
  return {ok:false,direction,reason:"5m yön henüz yeterince belirgin değil"};
}
function microTriggerFromKlines(k1m,direction,profileName="balanced"){
  if(!Array.isArray(k1m)||k1m.length<60)return {ok:false,stage:"İZLE",reason:"1m veri yetersiz",criteria:{passed:0,total:4,needed:0}};
  const cfg=getProfile(profileName);
  const mode=cfg.name;
  const u=unpack(k1m,true);
  const d=calcAll(u.o,u.h,u.l,u.c,u.v);
  const n=u.c.length-1;
  if(n<30)return {ok:false,stage:"İZLE",reason:"1m veri yetersiz",criteria:{passed:0,total:4,needed:0}};

  const a=d.atrV[n]||Math.max(u.c[n]*.0025,1e-12);
  const range=Math.max(u.h[n]-u.l[n],1e-12);
  const lowerWick=Math.max(0,Math.min(u.o[n],u.c[n])-u.l[n]);
  const upperWick=Math.max(0,u.h[n]-Math.max(u.o[n],u.c[n]));
  const closePos=(u.c[n]-u.l[n])/range;
  const rsi=Number(d.r[n]||50);
  const rv=d.vma[n]?u.v[n]/d.vma[n]:1;
  const dist=(u.c[n]-d.e20[n])/a;
  const move2=(u.c[n]-u.c[Math.max(0,n-2)])/a;
  const histSlope=d.hist[n]-d.hist[Math.max(0,n-2)];

  const retestTol=mode==="fast"?.32:mode==="safe"?.10:.20;
  const closeNeed=mode==="fast"?.52:mode==="safe"?.64:.57;
  const volNeed=mode==="fast"?.45:mode==="safe"?.82:.62;
  const maxDist=mode==="fast"?1.00:mode==="safe"?.48:.72;

  const longRetest=u.l[n]<=d.e20[n]+retestTol*a && u.c[n]>=d.e20[n]-.08*a;
  const shortRetest=u.h[n]>=d.e20[n]-retestTol*a && u.c[n]<=d.e20[n]+.08*a;

  const longReject=((lowerWick/range)>=.14 || u.c[n]>u.o[n]) && closePos>=closeNeed;
  const shortReject=((upperWick/range)>=.14 || u.c[n]<u.o[n]) && closePos<=1-closeNeed;

  const longMomentum=histSlope>=-.02*a && rsi>=38 && rsi<=74;
  const shortMomentum=histSlope<=.02*a && rsi>=26 && rsi<=62;
  const volumeOk=rv>=volNeed;

  const criteria=direction==="LONG"
    ? {retest:longRetest,rejection:longReject,momentum:longMomentum,volume:volumeOk}
    : {retest:shortRetest,rejection:shortReject,momentum:shortMomentum,volume:volumeOk};

  const passed=Object.values(criteria).filter(Boolean).length;
  const needed=mode==="fast"?2:mode==="safe"?4:3;

  // Bunlar moddan bağımsız kesin engeller.
  const blockers=[];
  if(direction==="LONG"&&rsi>76)blockers.push("1m RSI aşırı yüksek");
  if(direction==="SHORT"&&rsi<24)blockers.push("1m RSI aşırı düşük");
  if(direction==="LONG"&&dist>maxDist)blockers.push("1m fiyat fazla kaçtı");
  if(direction==="SHORT"&&dist<-maxDist)blockers.push("1m fiyat fazla kaçtı");
  if(direction==="LONG"&&move2>1.45&&!longRetest)blockers.push("1m ani pump kovalanmıyor");
  if(direction==="SHORT"&&move2<-1.45&&!shortRetest)blockers.push("1m ani dump kovalanmıyor");

  const ok=passed>=needed&&!blockers.length;
  let stage="İZLE";
  let reason=`1m teyit ${passed}/4 • ${needed}/4 gerekli`;

  if(ok){
    stage=direction==="LONG"?"AL":"SAT";
    reason=`1m ${passed}/4 teyit • ${mode==="fast"?"Hızlı":mode==="safe"?"Güvenli":"Dengeli"} tetik`;
  }else if(passed>=Math.max(1,needed-1)&&!blockers.length){
    stage="HAZIR";
    reason=`1m ${passed}/4 teyit • tetik çok yakın`;
  }else if(blockers.length){
    reason=blockers[0];
  }

  return {
    ok,stage,reason,blockers,price:u.c[n],
    criteria:{...criteria,passed,total:4,needed},
    metrics:{rsi,rv,distEma20Atr:dist,move2Atr:move2,histSlope,closePos},
    setup:{longRetest,shortRetest,longReject,shortReject}
  };
}
function smartLevels(d,h,l,c,n,decision,currentPrice=null){
  const signalPrice=c[n];
  const market=Number.isFinite(+currentPrice)&&+currentPrice>0?+currentPrice:signalPrice;
  const a=d.atrV[n]||Math.max(market*.005,1e-12);
  const side=decision.includes("LONG")?"LONG":decision.includes("SHORT")?"SHORT":"NONE";
  if(side==="NONE")return {entry:null,entryLow:null,entryHigh:null,stop:null,tp1:null,tp2:null,rr1:null,rr2:null,reason:"V10: uygun retest + giriş teyidi yok"};

  const chaseAtr=side==="LONG"?(market-signalPrice)/a:(signalPrice-market)/a;
  if(chaseAtr>.45)return {entry:null,entryLow:null,entryHigh:null,stop:null,tp1:null,tp2:null,rr1:null,rr2:null,reason:"V10: fiyat sinyalden sonra kaçtı • yeni retest bekleniyor",expired:true,distanceAtr:+chaseAtr.toFixed(2)};

  const entry=market;
  const swingLow=Math.min(...l.slice(Math.max(0,n-5),n+1));
  const swingHigh=Math.max(...h.slice(Math.max(0,n-5),n+1));
  let stop,risk;
  if(side==="LONG"){
    stop=Math.min(entry-.82*a,swingLow-.12*a);
    risk=entry-stop;
  }else{
    stop=Math.max(entry+.82*a,swingHigh+.12*a);
    risk=stop-entry;
  }

  if(!Number.isFinite(risk)||risk<=0||risk>1.65*a){
    return {entry:null,entryLow:null,entryHigh:null,stop:null,tp1:null,tp2:null,rr1:null,rr2:null,reason:"V10: yapısal stop fazla geniş • işlem yok"};
  }

  const tp1=side==="LONG"?entry+1.50*risk:entry-1.50*risk;
  const tp2=side==="LONG"?entry+2.20*risk:entry-2.20*risk;
  const zoneHalf=.08*a;
  return {
    entry,entryLow:entry-zoneHalf,entryHigh:entry+zoneHalf,
    stop,tp1,tp2,rr1:1.5,rr2:2.2,
    reason:"V10 Anti-Trap • retest + rejection teyitli giriş",
    marketPrice:market,distanceAtr:+(Math.abs(market-signalPrice)/a).toFixed(2),maxWaitBars:2
  }
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
  const k=body.k,k1m=body.k1m,k15=body.k15,k1h=body.k1h;
  if(!Array.isArray(k)||!Array.isArray(k1m)||!Array.isArray(k15)||!Array.isArray(k1h))throw new Error("Binance TR 5m/1m mum verisi eksik.");
  const u=unpack(k,true);
  if(u.c.length<220)throw new Error("Yeterli Binance TR mum verisi yok.");
  const d=calcAll(u.o,u.h,u.l,u.c,u.v),n=u.c.length-1;
  const mtf={m15:tfBiasFromKlines(k15),h1:tfBiasFromKlines(k1h)};
  const legacy=legacyAt(d,u.o,u.h,u.l,u.c,u.v,n,true);
  const advanced=optimizedAt(d,u.o,u.h,u.l,u.c,u.v,n,mtf,profile);
  let common=commonDecision(legacy,advanced);
  const eligible=v11DirectionEligible(advanced,profile);
  const direction5m=eligible.direction;
  const micro=eligible.ok&&(direction5m==="LONG"||direction5m==="SHORT")
    ?microTriggerFromKlines(k1m,direction5m,profile)
    :{ok:false,stage:"İZLE",reason:eligible.reason,blockers:[],criteria:{passed:0,total:4,needed:profile==="safe"?4:3}};
  if(eligible.ok&&micro.ok){
    common={...common,decision:direction5m==="LONG"?"LONG":"SHORT",stage:direction5m==="LONG"?"AL":"SAT",note:`${eligible.reason} • ${micro.reason}`};
  }else{
    common={...common,decision:"BEKLE",stage:micro.stage,note:micro.reason};
  }
  let levelDecision=common.decision,source="V11.1 5m YÖN + 1m TETİK";
  const livePrice=Number(k[k.length-1]?.[4])||u.c[n];
  const levels=smartLevels(d,u.h,u.l,u.c,n,levelDecision,livePrice);
  levels.source=levels.entry==null?"SEVİYE YOK":source;
  const h1u=unpack(k1h,false);
  const prev24=h1u.c.length>24?h1u.c[h1u.c.length-25]:null;
  const change24=prev24?((livePrice/prev24)-1)*100:0;
  return {
    symbol,displaySymbol:symbol,interval:"5m+1m",exchange:"binancetr",marketType:"SPOT",quoteAsset:"TRY",
    interval,price:livePrice,signalClose:u.c[n],change24,legacy,advanced,common,levels,
    v7:{version:"10.0-TR",profile,thresholds:advanced.thresholds,mtf,blockers:advanced.blockers,confirmations:advanced.confirmations,metrics:advanced.metrics},
    v10:{version:"11.2 Fast Scalp",trend:advanced.trend,stage:common.stage||micro.stage||advanced.stage,warnings:advanced.warnings,setup:advanced.setup,antiChase:true,minRR:1.5},
    v11:{version:"11.2",directionTF:"5m",triggerTF:"1m",trend5m:direction5m,microTrigger:micro},
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
const FUTURES_MAINNET_BASE="https://fapi.binance.com";

function futuresEnv(req){
  const mode=String(req.headers["x-account-mode"]||req.body?.accountMode||"testnet").toLowerCase()==="mainnet"?"mainnet":"testnet";
  if(mode==="mainnet"){
    return {
      mode,
      base:FUTURES_MAINNET_BASE,
      apiKey:String(process.env.BINANCE_MAINNET_API_KEY||""),
      secret:String(process.env.BINANCE_MAINNET_SECRET_KEY||""),
      appToken:String(process.env.BINANCE_MAINNET_APP_TOKEN||"")
    };
  }
  return {
    mode,
    base:FUTURES_TESTNET_BASE,
    apiKey:String(process.env.BINANCE_TESTNET_API_KEY||""),
    secret:String(process.env.BINANCE_TESTNET_SECRET_KEY||""),
    appToken:String(process.env.BINANCE_TESTNET_APP_TOKEN||"")
  };
}
function requireTestnetAuth(req){
  const env=futuresEnv(req);
  if(!env.apiKey||!env.secret||!env.appToken){
    throw new Error(env.mode==="mainnet"?"Gerçek hesap Vercel API ayarları eksik.":"Testnet ayarları eksik.");
  }
  const token=String(req.headers["x-app-token"]||"");
  if(!token||token!==env.appToken)throw new Error(env.mode==="mainnet"?"Gerçek hesap uygulama erişim kodu yanlış.":"Testnet uygulama erişim kodu yanlış.");
  return env;
}
async function futPublic(path,params={},base=FUTURES_TESTNET_BASE){
  const q=new URLSearchParams();
  Object.entries(params).forEach(([k,v])=>{if(v!==undefined&&v!==null&&v!=="")q.set(k,String(v))});
  const url=base+path+(q.toString()?`?${q.toString()}`:"");
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
  const url=`${env.base||FUTURES_TESTNET_BASE}${path}?${payload}&signature=${sig}`;
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
async function testnetSymbolRules(symbol,base=FUTURES_TESTNET_BASE){
  const ex=await futPublic("/fapi/v1/exchangeInfo",{},base);
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
    openOrders:(orders||[]).map(x=>({
      symbol:x.symbol,orderId:x.orderId,clientOrderId:x.clientOrderId,type:x.type,side:x.side,
      price:Number(x.price||0),stopPrice:Number(x.stopPrice||0),
      origQty:Number(x.origQty||0),executedQty:Number(x.executedQty||0),status:x.status
    })),
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
  const rules=await testnetSymbolRules(symbol,env.base);
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
  const positionMode=String(body.positionMode||"risk").toLowerCase()==="fixed"?"fixed":"risk";
  const entryType=String(body.entryType||"market").toLowerCase()==="limit"?"limit":"market";
  const requestedEntry=Number(body.entryPrice);
  const riskPct=Math.max(.1,Math.min(env.mode==="mainnet"?1:2,Number(body.riskPercent)||.5));
  const fixedNotional=Math.max(5,Number(body.fixedNotional)||0);
  const requestedLeverage=Math.max(1,Math.round(Number(body.leverage)||5));
  const leverage=Math.min(env.mode==="mainnet"?10:20,requestedLeverage);
  const stop=Number(body.stop),tp1=Number(body.tp1),tp2=Number(body.tp2);
  if(!/^[A-Z0-9]{5,20}$/.test(symbol))throw new Error("Geçersiz sembol.");
  if(!["LONG","SHORT"].includes(direction))throw new Error("Yön LONG veya SHORT olmalı.");
  if(env.mode==="mainnet" && String(body.mainnetConfirm||"")!=="GERCEK_EMIR_ONAY")throw new Error("Gerçek hesap ikinci onayı eksik.");
  if(![stop,tp1,tp2].every(Number.isFinite))throw new Error("SL/TP seviyeleri eksik.");

  const mode=await futSigned("GET","/fapi/v1/positionSide/dual",{},env);
  if(Boolean(mode?.dualSidePosition))throw new Error("İlk sürüm yalnızca One-way Mode destekliyor. Binance Futures Testnet'te Position Mode'u One-way yap.");

  const existing=await futSigned("GET","/fapi/v2/positionRisk",{symbol},env);
  const current=Array.isArray(existing)?existing.find(x=>x.symbol===symbol):null;
  if(Math.abs(Number(current?.positionAmt||0))>0)throw new Error(`${symbol} için zaten açık pozisyon var.`);

  const [balances,markInfo,rules]=await Promise.all([
    futSigned("GET","/fapi/v2/balance",{},env),
    futPublic("/fapi/v1/premiumIndex",{symbol},env.base),
    testnetSymbolRules(symbol,env.base)
  ]);
  const usdt=balances.find(x=>x.asset==="USDT")||{};
  const available=Number(usdt.availableBalance||0);
  const mark=Number(markInfo.markPrice);
  if(!Number.isFinite(mark)||mark<=0)throw new Error("Mark price alınamadı.");

  const entryRef=entryType==="limit"?requestedEntry:mark;
  if(!Number.isFinite(entryRef)||entryRef<=0)throw new Error("Giriş fiyatı geçersiz.");
  if(direction==="LONG" && !(stop<entryRef&&tp1>entryRef&&tp2>entryRef))throw new Error("LONG için SL giriş fiyatının altında, hedefler giriş fiyatının üstünde olmalı.");
  if(direction==="SHORT" && !(stop>entryRef&&tp1<entryRef&&tp2<entryRef))throw new Error("SHORT için SL giriş fiyatının üstünde, hedefler giriş fiyatının altında olmalı.");

  const riskUsd=available*(riskPct/100);
  const stopDistance=Math.abs(entryRef-stop);
  if(stopDistance<=0)throw new Error("Stop mesafesi geçersiz.");

  const maxNotional=Math.min(env.mode==="mainnet"?500:10000,available*leverage*.95);
  let requestedNotional=null;
  let qty;

  if(positionMode==="fixed"){
    requestedNotional=fixedNotional;
    if(!Number.isFinite(requestedNotional)||requestedNotional<=0)throw new Error("Sabit USDT tutarı geçersiz.");
    if(requestedNotional>maxNotional){
      throw new Error(`Yetersiz teminat. ${leverage}x kaldıraçla maksimum yaklaşık ${maxNotional.toFixed(2)} USDT pozisyon açılabilir.`);
    }
    qty=requestedNotional/entryRef;
  }else{
    qty=riskUsd/stopDistance;
    qty=Math.min(qty,maxNotional/entryRef);
  }

  qty=floorStep(qty,rules.stepSize);
  if(qty<rules.minQty)throw new Error("Hesaplanan miktar minimum emir miktarının altında.");
  if(qty*entryRef<rules.minNotional)throw new Error(`Emir nominali minimum ${rules.minNotional} USDT altında.`);

  const roundedEntry=entryType==="limit"?roundTick(requestedEntry,rules.tickSize):mark;
  const roundedStop=roundTick(stop,rules.tickSize);
  const roundedTp1=roundTick(tp1,rules.tickSize);
  const roundedTp2=roundTick(tp2,rules.tickSize);

  if(![roundedEntry,roundedStop,roundedTp1,roundedTp2].every(x=>Number.isFinite(x)&&x>0)){
    throw new Error(`Fiyat hassasiyeti hatası: giriş/SL/TP sıfır veya geçersiz oluştu. tickSize=${rules.tickSize}`);
  }
  if(entryType==="limit"){
    if(direction==="LONG" && roundedEntry>=mark)throw new Error(`LONG limit giriş fiyatı mevcut Mark fiyatından (${mark}) düşük olmalı.`);
    if(direction==="SHORT" && roundedEntry<=mark)throw new Error(`SHORT limit giriş fiyatı mevcut Mark fiyatından (${mark}) yüksek olmalı.`);
  }

  await futSigned("POST","/fapi/v1/leverage",{symbol,leverage},env);

  const entrySide=direction==="LONG"?"BUY":"SELL";
  const exitSide=direction==="LONG"?"SELL":"BUY";
  let entryOrder=null;
  try{
    if(entryType==="limit"){
      entryOrder=await futSigned("POST","/fapi/v1/order",{
        symbol,side:entrySide,type:"LIMIT",timeInForce:"GTC",price:roundedEntry,quantity:qty,newOrderRespType:"RESULT"
      },env);
    }else{
      entryOrder=await futSigned("POST","/fapi/v1/order",{
        symbol,side:entrySide,type:"MARKET",quantity:qty,newOrderRespType:"RESULT"
      },env);
    }

    const executedQty=floorStep(Number(entryOrder.executedQty||0),rules.stepSize);
    if(entryType==="limit" && executedQty<=0){
      return {
        testnet:true,pending:true,symbol,direction,leverage,positionMode,entryType,
        requestedEntry:roundedEntry,riskPercent:riskPct,riskUsd,
        requestedNotional:positionMode==="fixed"?fixedNotional:null,
        markPrice:mark,quantity:qty,notional:qty*roundedEntry,
        estimatedMargin:(qty*roundedEntry)/leverage,
        stop:roundedStop,tp1:roundedTp1,tp2:roundedTp2,
        entryOrder,protectiveOrders:[]
      };
    }

    const protectedQty=floorStep(executedQty>0?executedQty:qty,rules.stepSize);
    const halfQty=floorStep(protectedQty*.5,rules.stepSize);

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
      testnet:true,symbol,direction,leverage,positionMode,entryType,
      riskPercent:riskPct,riskUsd,
      requestedNotional:positionMode==="fixed"?fixedNotional:null,
      requestedEntry:entryType==="limit"?roundedEntry:null,
      markPrice:mark,quantity:protectedQty,
      notional:protectedQty*(Number(entryOrder.avgPrice)||roundedEntry||mark),
      estimatedMargin:(protectedQty*(Number(entryOrder.avgPrice)||roundedEntry||mark))/leverage,
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


async function testnetProtect(req){
  const env=requireTestnetAuth(req);
  const body=req.body||{};
  const symbol=String(body.symbol||"").toUpperCase().replace(/[^A-Z0-9]/g,"");
  const direction=String(body.direction||"").toUpperCase();
  const stop=Number(body.stop),tp1=Number(body.tp1),tp2=Number(body.tp2);
  const positions=await futSigned("GET","/fapi/v2/positionRisk",{symbol},env);
  const p=Array.isArray(positions)?positions.find(x=>x.symbol===symbol):null;
  const amt=Number(p?.positionAmt||0);
  if(!amt)throw new Error("Pozisyon henüz gerçekleşmemiş.");
  const existing=await futSigned("GET","/fapi/v1/openAlgoOrders",{algoType:"CONDITIONAL"},env).catch(()=>[]);
  if((existing||[]).some(x=>x.symbol===symbol))return {alreadyProtected:true,symbol};
  const rules=await testnetSymbolRules(symbol,env.base);
  const qty=floorStep(Math.abs(amt),rules.stepSize);
  const halfQty=floorStep(qty*.5,rules.stepSize);
  const markInfo=await futPublic("/fapi/v1/premiumIndex",{symbol},env.base);
  const mark=Number(markInfo.markPrice);
  const rs=roundTick(stop,rules.tickSize),r1=roundTick(tp1,rules.tickSize),r2=roundTick(tp2,rules.tickSize);
  if(direction==="LONG" && !(amt>0&&rs<mark&&r1>mark&&r2>mark))throw new Error("LONG koruma seviyeleri geçersiz.");
  if(direction==="SHORT" && !(amt<0&&rs>mark&&r1<mark&&r2<mark))throw new Error("SHORT koruma seviyeleri geçersiz.");
  const exitSide=direction==="LONG"?"SELL":"BUY";
  const protective=[];
  protective.push(await futSigned("POST","/fapi/v1/algoOrder",{algoType:"CONDITIONAL",symbol,side:exitSide,type:"STOP_MARKET",triggerPrice:rs,closePosition:"true",workingType:"MARK_PRICE",newOrderRespType:"ACK"},env));
  if(halfQty>=rules.minQty && halfQty*mark>=rules.minNotional){
    protective.push(await futSigned("POST","/fapi/v1/algoOrder",{algoType:"CONDITIONAL",symbol,side:exitSide,type:"TAKE_PROFIT_MARKET",triggerPrice:r1,quantity:halfQty,reduceOnly:"true",workingType:"MARK_PRICE",newOrderRespType:"ACK"},env));
  }
  protective.push(await futSigned("POST","/fapi/v1/algoOrder",{algoType:"CONDITIONAL",symbol,side:exitSide,type:"TAKE_PROFIT_MARKET",triggerPrice:r2,closePosition:"true",workingType:"MARK_PRICE",newOrderRespType:"ACK"},env));
  return {protected:true,symbol,quantity:qty,protectiveOrders:protective};
}

export default async function handler(req,res){
  try{
    const action=String(req.query.action||req.body?.action||"");
    if(["analyze","backtest","scan","testnet-account","testnet-open","testnet-close","testnet-protect"].includes(action) && req.method!=="POST"){
      return res.status(405).json({error:"POST gerekli."});
    }
    let result;
    if(action==="analyze")result=await doAnalyze(req.body||{});
    else if(action==="backtest")result=await doBacktest(req.body||{});
    else if(action==="scan")result=await doScan(req.body||{});
    else if(action==="testnet-account")result=await testnetAccount(req);
    else if(action==="testnet-open")result=await testnetOpen(req);
    else if(action==="testnet-close")result=await testnetClose(req);
    else if(action==="testnet-protect")result=await testnetProtect(req);
    else return res.status(400).json({error:"Geçersiz action."});
    res.setHeader("Cache-Control","no-store");
    return res.status(200).json(result);
  }catch(e){
    return res.status(500).json({error:e?.message||"Binance TR işlem hatası."});
  }
}
