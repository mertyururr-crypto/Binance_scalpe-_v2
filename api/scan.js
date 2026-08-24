
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

  if(Number.isFinite(adxV)&&adxV<17){
    if(cfg.name==="fast")warnings.push("ADX düşük • Hızlı modda yalnızca uyarı");
    else blockers.push("Yatay piyasa / ADX düşük");
  }
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

export default async function handler(req,res){
  try{
    const base="https://fapi.binance.com",profile=getProfile(req.query.profile).name,cfg=getProfile(profile);
    const [exchange,tickers]=await Promise.all([
      getJson(`${base}/fapi/v1/exchangeInfo`),
      getJson(`${base}/fapi/v1/ticker/24hr`)
    ]);
    const active=new Set(exchange.symbols.filter(s=>s.contractType==="PERPETUAL"&&s.quoteAsset==="USDT"&&s.status==="TRADING").map(s=>s.symbol));
    const top=tickers.filter(t=>active.has(t.symbol)).sort((a,b)=>(+b.quoteVolume)-(+a.quoteVolume)).slice(0,24);
    const baseRows=[];
    for(let i=0;i<top.length;i+=6){
      const chunk=top.slice(i,i+6);
      const rows=await Promise.all(chunk.map(async t=>{
        try{
          const k=await getJson(`${base}/fapi/v1/klines?symbol=${encodeURIComponent(t.symbol)}&interval=5m&limit=240`);
          const u=unpack(k,true),d=calcAll(u.o,u.h,u.l,u.c,u.v),n=u.c.length-1;
          const rough=optimizedAt(d,u.o,u.h,u.l,u.c,u.v,n,{m15:0,h1:0},profile);
          return {symbol:t.symbol,k,u,d,n,rough,quoteVolume:+t.quoteVolume};
        }catch(e){return null}
      }));
      baseRows.push(...rows.filter(Boolean));
    }
    const candidates=baseRows.filter(x=>x.rough.score>=68||x.rough.score<=32).slice(0,12);
    const final=[];
    for(let i=0;i<candidates.length;i+=4){
      const chunk=candidates.slice(i,i+4);
      const rows=await Promise.all(chunk.map(async x=>{
        try{
          const [k15,k1h]=await Promise.all([
            getJson(`${base}/fapi/v1/klines?symbol=${x.symbol}&interval=15m&limit=220`),
            getJson(`${base}/fapi/v1/klines?symbol=${x.symbol}&interval=1h&limit=220`)
          ]);
          const mtf={m15:tfBiasFromKlines(k15),h1:tfBiasFromKlines(k1h)};
          const z=optimizedAt(x.d,x.u.o,x.u.h,x.u.l,x.u.c,x.u.v,x.n,mtf,profile);
          if(z.signal==="BEKLE")return null;
          const direction=z.signal,shock=z.metrics.atrPct>3.2||z.metrics.bodyAtr>2.1;
          const qualityPass=!shock&&!z.blockers.length&&z.confirmations>=cfg.minConf&&((direction==="LONG"&&z.score>=cfg.candidateLong)||(direction==="SHORT"&&z.score<=cfg.candidateShort));
          return {symbol:x.symbol,direction,score:z.score,price:x.u.c[x.n],reason:z.breakdown.slice(0,3).map(a=>a.text).join(" • "),adx:z.metrics.adx,rvol:z.metrics.rvol,atrPct:z.metrics.atrPct,shock,qualityPass,confirmations:z.confirmations};
        }catch(e){return null}
      }));
      final.push(...rows.filter(Boolean));
    }
    const btc=baseRows.find(x=>x.symbol==="BTCUSDT"),eth=baseRows.find(x=>x.symbol==="ETHUSDT");
    const dir=s=>s>=65?"LONG":s<=35?"SHORT":"NEUTRAL";
    const btcScore=btc?.rough.score??50,ethScore=eth?.rough.score??50;
    const strongLong=final.filter(x=>x.direction==="LONG"&&x.score>=cfg.strongLong).sort((a,b)=>b.score-a.score).slice(0,8);
    const strongShort=final.filter(x=>x.direction==="SHORT"&&x.score<=cfg.strongShort).sort((a,b)=>a.score-b.score).slice(0,8);
    res.setHeader("Cache-Control","no-store, no-cache, must-revalidate, proxy-revalidate");
    return res.status(200).json({
      scanned:baseRows.length,btcScore,btcDirection:dir(btcScore),ethScore,ethDirection:dir(ethScore),
      strongLong,strongShort,timestamp:new Date().toISOString(),engine:"V11.3 Fast Scalp",profile
    });
  }catch(e){return res.status(500).json({error:e?.message||"Tarama hatası."})}
}
