
function ema(values, period){
  const k=2/(period+1),out=[values[0]];
  for(let i=1;i<values.length;i++) out.push(values[i]*k+out[i-1]*(1-k));
  return out;
}
function sma(values,period){
  const out=Array(values.length).fill(null); let sum=0;
  for(let i=0;i<values.length;i++){sum+=values[i]; if(i>=period)sum-=values[i-period]; if(i>=period-1)out[i]=sum/period}
  return out;
}
function std(values,period){
  const out=Array(values.length).fill(null);
  for(let i=period-1;i<values.length;i++){const a=values.slice(i-period+1,i+1),m=a.reduce((x,y)=>x+y,0)/period; out[i]=Math.sqrt(a.reduce((x,y)=>x+(y-m)**2,0)/period)}
  return out;
}
function rsi(values,period=14){
  const gains=[],losses=[];
  for(let i=1;i<values.length;i++){const d=values[i]-values[i-1];gains.push(Math.max(d,0));losses.push(Math.max(-d,0))}
  let ag=gains.slice(0,period).reduce((a,b)=>a+b,0)/period,al=losses.slice(0,period).reduce((a,b)=>a+b,0)/period;
  const out=Array(values.length).fill(null);out[period]=al===0?100:100-100/(1+ag/al);
  for(let i=period+1;i<values.length;i++){ag=(ag*(period-1)+gains[i-1])/period;al=(al*(period-1)+losses[i-1])/period;out[i]=al===0?100:100-100/(1+ag/al)}
  return out;
}
function atr(high,low,close,period=14){
  const tr=[high[0]-low[0]];
  for(let i=1;i<close.length;i++)tr.push(Math.max(high[i]-low[i],Math.abs(high[i]-close[i-1]),Math.abs(low[i]-close[i-1])));
  const out=Array(close.length).fill(null);let a=tr.slice(0,period).reduce((x,y)=>x+y,0)/period;out[period-1]=a;
  for(let i=period;i<tr.length;i++){a=(a*(period-1)+tr[i])/period;out[i]=a}
  return out;
}
function adx(high,low,close,period=14){
  const tr=[],plusDM=[],minusDM=[];
  for(let i=0;i<close.length;i++){
    if(i===0){tr.push(high[i]-low[i]);plusDM.push(0);minusDM.push(0);continue}
    const up=high[i]-high[i-1],dn=low[i-1]-low[i];
    plusDM.push(up>dn&&up>0?up:0);minusDM.push(dn>up&&dn>0?dn:0);
    tr.push(Math.max(high[i]-low[i],Math.abs(high[i]-close[i-1]),Math.abs(low[i]-close[i-1])));
  }
  let atrR=tr.slice(1,period+1).reduce((a,b)=>a+b,0),pdm=plusDM.slice(1,period+1).reduce((a,b)=>a+b,0),mdm=minusDM.slice(1,period+1).reduce((a,b)=>a+b,0);
  const plusDI=Array(close.length).fill(null),minusDI=Array(close.length).fill(null),dx=Array(close.length).fill(null),adxOut=Array(close.length).fill(null);
  for(let i=period;i<close.length;i++){
    if(i>period){atrR=atrR-atrR/period+tr[i];pdm=pdm-pdm/period+plusDM[i];mdm=mdm-mdm/period+minusDM[i]}
    plusDI[i]=100*(pdm/atrR);minusDI[i]=100*(mdm/atrR);
    const den=plusDI[i]+minusDI[i];dx[i]=den===0?0:100*Math.abs(plusDI[i]-minusDI[i])/den;
  }
  const first=dx.slice(period,period*2).filter(Number.isFinite);
  if(first.length===period){
    let a=first.reduce((x,y)=>x+y,0)/period;adxOut[period*2-1]=a;
    for(let i=period*2;i<close.length;i++){a=(a*(period-1)+dx[i])/period;adxOut[i]=a}
  }
  return {adx:adxOut,plusDI,minusDI};
}
function clamp(x,min,max){return Math.max(min,Math.min(max,x))}
function calcAll(open,high,low,close,vol){
  const e7=ema(close,7),e25=ema(close,25),e99=ema(close,99),e20=ema(close,20),e50=ema(close,50),e200=ema(close,200);
  const r=rsi(close,14),ef=ema(close,12),es=ema(close,26),macd=close.map((_,i)=>ef[i]-es[i]),sig=ema(macd,9),hist=macd.map((v,i)=>v-sig[i]);
  const basis=sma(close,20),sd=std(close,20),upper=basis.map((v,i)=>v==null?null:v+2*sd[i]),lower=basis.map((v,i)=>v==null?null:v-2*sd[i]);
  const atrV=atr(high,low,close,14),vma=sma(vol,20),adxD=adx(high,low,close,14);
  return {e7,e25,e99,e20,e50,e200,r,macd,sig,hist,upper,lower,atrV,vma,adxD};
}
function legacyAt(d,open,high,low,close,vol,n,withReasons=true){
  let L=0,S=0; const reasons=[];
  const emaBull=d.e7[n]>d.e25[n]&&d.e25[n]>d.e99[n],emaBear=d.e7[n]<d.e25[n]&&d.e25[n]<d.e99[n];
  if(emaBull)L++;if(emaBear)S++;if(withReasons)reasons.push({label:"EMA 7/25/99",bias:emaBull?1:emaBear?-1:0,text:emaBull?"Yukarı trend":emaBear?"Aşağı trend":"Karışık"});
  if(close[n]>d.e25[n])L++;else if(close[n]<d.e25[n])S++;if(withReasons)reasons.push({label:"Fiyat / EMA25",bias:close[n]>d.e25[n]?1:-1,text:close[n]>d.e25[n]?"EMA25 üstü":"EMA25 altı"});
  if(d.macd[n]>d.sig[n]&&d.hist[n]>0)L++;if(d.macd[n]<d.sig[n]&&d.hist[n]<0)S++;if(withReasons)reasons.push({label:"MACD",bias:d.macd[n]>d.sig[n]?1:d.macd[n]<d.sig[n]?-1:0,text:d.macd[n]>d.sig[n]?"Pozitif":"Negatif"});
  if(d.r[n]>52&&d.r[n]<72)L++;else if(d.r[n]<48&&d.r[n]>28)S++;if(withReasons)reasons.push({label:"RSI",bias:d.r[n]>52&&d.r[n]<72?1:d.r[n]<48&&d.r[n]>28?-1:0,text:d.r[n].toFixed(1)});
  const strongVol=vol[n]>d.vma[n];if(strongVol&&close[n]>open[n])L++;if(strongVol&&close[n]<open[n])S++;if(withReasons)reasons.push({label:"Hacim",bias:strongVol?(close[n]>open[n]?1:-1):0,text:strongVol?"Ortalama üstü":"Zayıf"});
  const bUp=close[n]>Math.max(...high.slice(n-20,n)),bDn=close[n]<Math.min(...low.slice(n-20,n));if(bUp)L++;if(bDn)S++;if(withReasons)reasons.push({label:"20 Mum Kırılım",bias:bUp?1:bDn?-1:0,text:bUp?"Yukarı kırılım":bDn?"Aşağı kırılım":"Kırılım yok"});
  const mUp=close[n]>close[n-3],mDn=close[n]<close[n-3];if(mUp)L++;if(mDn)S++;if(withReasons)reasons.push({label:"3 Mum Momentum",bias:mUp?1:mDn?-1:0,text:mUp?"Yukarı":mDn?"Aşağı":"Yatay"});
  let penaltyL=0,penaltyS=0;if(d.upper[n]&&close[n]>=d.upper[n]&&d.r[n]>70)penaltyL=1;if(d.lower[n]&&close[n]<=d.lower[n]&&d.r[n]<30)penaltyS=1;
  const longScore=Math.max(0,L-penaltyL),shortScore=Math.max(0,S-penaltyS);
  let signal="BEKLE";if(longScore>=5&&longScore>=shortScore+2)signal="LONG";else if(shortScore>=5&&shortScore>=longScore+2)signal="SHORT";
  const confidence=Math.min(92,Math.round(50+Math.abs(longScore-shortScore)*7+Math.max(longScore,shortScore)*2));
  return {signal,confidence,longScore,shortScore,reasons};
}
function advancedAt(d,open,high,low,close,vol,n){
  let total=50;const breakdown=[];
  let trendPts=12.5,trendText="Karışık";
  if(d.e20[n]>d.e50[n]&&d.e50[n]>d.e200[n]){trendPts=25;trendText="EMA20>50>200"}
  else if(d.e20[n]<d.e50[n]&&d.e50[n]<d.e200[n]){trendPts=0;trendText="EMA20<50<200"}
  else if(close[n]>d.e50[n]){trendPts=17;trendText="Kısmi yukarı"}else if(close[n]<d.e50[n]){trendPts=8;trendText="Kısmi aşağı"}
  total+=trendPts-12.5;breakdown.push({label:"Trend",score:Math.round(trendPts),max:25,text:trendText});

  let adxPts=10,adxText="Trend zayıf";const a=d.adxD.adx[n],p=d.adxD.plusDI[n],m=d.adxD.minusDI[n];
  if(Number.isFinite(a)){const strength=clamp((a-15)/20,0,1);if(p>m){adxPts=10+10*strength;adxText=`ADX ${a.toFixed(1)} • DI+ üstün`}else if(m>p){adxPts=10-10*strength;adxText=`ADX ${a.toFixed(1)} • DI- üstün`}}
  total+=adxPts-10;breakdown.push({label:"ADX / DI",score:Math.round(adxPts),max:20,text:adxText});

  let rvolPts=10,rvolText="Normal";const rv=d.vma[n]?vol[n]/d.vma[n]:1,dir=close[n]>open[n]&&close[n]>close[n-2]?1:close[n]<open[n]&&close[n]<close[n-2]?-1:0,vs=clamp((rv-1)/1,0,1);
  if(dir>0){rvolPts=10+10*vs;rvolText=`RVOL ${rv.toFixed(2)}x • alım`}else if(dir<0){rvolPts=10-10*vs;rvolText=`RVOL ${rv.toFixed(2)}x • satış`}else rvolText=`RVOL ${rv.toFixed(2)}x`;
  total+=rvolPts-10;breakdown.push({label:"RVOL / Hacim",score:Math.round(rvolPts),max:20,text:rvolText});

  const hh20=Math.max(...high.slice(n-20,n)),ll20=Math.min(...low.slice(n-20,n));let structurePts=10,structureText="Range";
  if(close[n]>hh20){structurePts=20;structureText="20 mum yukarı kırılım"}else if(close[n]<ll20){structurePts=0;structureText="20 mum aşağı kırılım"}
  else if(close[n]>close[n-5]){structurePts=15;structureText="Yükselen yapı"}else if(close[n]<close[n-5]){structurePts=5;structureText="Düşen yapı"}
  total+=structurePts-10;breakdown.push({label:"Market Structure",score:Math.round(structurePts),max:20,text:structureText});

  let momPts=5;if(d.r[n]>=55&&d.r[n]<=70)momPts=10;else if(d.r[n]>70)momPts=7;else if(d.r[n]<=45&&d.r[n]>=30)momPts=0;else if(d.r[n]<30)momPts=3;
  total+=momPts-5;breakdown.push({label:"Momentum",score:Math.round(momPts),max:10,text:`RSI ${d.r[n].toFixed(1)}`});

  const atrPct=d.atrV[n]/close[n]*100;let vp=2.5;if(atrPct>=0.25&&atrPct<=1.8)vp=5;else if(atrPct>3.5)vp=1;
  total+=(vp-2.5)*(total>=50?1:-1);breakdown.push({label:"Volatilite",score:Math.round(vp),max:5,text:`ATR ${atrPct.toFixed(2)}%`});

  total=Math.round(clamp(total,0,100));let label="BEKLE",signal="BEKLE";
  if(total>=80){label="GÜÇLÜ LONG";signal="LONG"}else if(total>=65){label="LONG ADAYI";signal="LONG"}else if(total<=20){label="GÜÇLÜ SHORT";signal="SHORT"}else if(total<=35){label="SHORT ADAYI";signal="SHORT"}
  return {score:total,label,signal,breakdown};
}
function commonDecision(legacy,advanced){
  let decision="BEKLE",note="Sistemler ortak yön üretmedi.";
  if(legacy.signal==="LONG"&&advanced.signal==="LONG"){decision=advanced.score>=80?"GÜÇLÜ LONG":"LONG";note="İki sistem LONG yönünde uyumlu."}
  else if(legacy.signal==="SHORT"&&advanced.signal==="SHORT"){decision=advanced.score<=20?"GÜÇLÜ SHORT":"SHORT";note="İki sistem SHORT yönünde uyumlu."}
  else if(legacy.signal!=="BEKLE"&&advanced.signal!=="BEKLE"&&legacy.signal!==advanced.signal){note="Sistemler ters yönde; işlem onayı yok."}
  else if(legacy.signal==="BEKLE"&&advanced.signal!=="BEKLE"){note="Gelişmiş sistem yön verdi, 7'li sistem henüz onaylamadı."}
  const confidence=Math.round(clamp((legacy.confidence+Math.abs(advanced.score-50)*2)/2,50,95));
  return {decision,confidence,note};
}
function smartLevels(d,high,low,close,n,decision){
  const price=close[n],a=d.atrV[n]||price*.005,e20=d.e20[n];
  const resistance=Math.max(...high.slice(n-20,n)),support=Math.min(...low.slice(n-20,n));
  let side=decision.includes("LONG")?"LONG":decision.includes("SHORT")?"SHORT":"NONE";
  let entry=null,lowZone=null,highZone=null,reason="";
  if(side==="LONG"){
    const breakout=price>resistance;
    const target=breakout?resistance+0.05*a:e20;
    entry=Math.min(price,target);
    lowZone=entry-0.12*a;highZone=entry+0.12*a;
    reason=breakout?"Kırılan direncin retesti":"EMA20 geri çekilme bölgesi";
  }else if(side==="SHORT"){
    const breakdown=price<support;
    const target=breakdown?support-0.05*a:e20;
    entry=Math.max(price,target);
    lowZone=entry-0.12*a;highZone=entry+0.12*a;
    reason=breakdown?"Kırılan desteğin retesti":"EMA20 tepki bölgesi";
  }
  if(side==="NONE")return {entry:null,entryLow:null,entryHigh:null,stop:null,tp1:null,tp2:null,reason:"Ortak işlem onayı yok"};
  const stop=side==="LONG"?entry-1.25*a:entry+1.25*a;
  const tp1=side==="LONG"?entry+1.5*a:entry-1.5*a;
  const tp2=side==="LONG"?entry+2.4*a:entry-2.4*a;
  return {entry,entryLow:lowZone,entryHigh:highZone,stop,tp1,tp2,reason};
}

function sideOfDecision(decision){return decision.includes("LONG")?"LONG":decision.includes("SHORT")?"SHORT":null}
function evalTrade(side,entry,atrNow,forwardHigh,forwardLow){
  const sl=side==="LONG"?entry-1.25*atrNow:entry+1.25*atrNow;
  const tp=side==="LONG"?entry+1.5*atrNow:entry-1.5*atrNow;
  let outcome="OPEN";
  for(let j=0;j<forwardHigh.length;j++){
    const h=forwardHigh[j],l=forwardLow[j];
    if(side==="LONG"){
      const hitSL=l<=sl,hitTP=h>=tp;
      if(hitSL&&hitTP){outcome="LOSS";break} // conservative same-candle assumption
      if(hitSL){outcome="LOSS";break}
      if(hitTP){outcome="WIN";break}
    }else{
      const hitSL=h>=sl,hitTP=l<=tp;
      if(hitSL&&hitTP){outcome="LOSS";break}
      if(hitSL){outcome="LOSS";break}
      if(hitTP){outcome="WIN";break}
    }
  }
  return outcome;
}
function summarize(trades){
  const resolved=trades.filter(x=>x!=="OPEN"),wins=resolved.filter(x=>x==="WIN").length,losses=resolved.filter(x=>x==="LOSS").length;
  const total=resolved.length,winRate=total?wins/total*100:0;
  const grossProfit=wins*1.5,grossLoss=losses*1.25,profitFactor=grossLoss?grossProfit/grossLoss:(grossProfit>0?99:0);
  return {signals:trades.length,resolved,wins,losses,open:trades.length-total,winRate:+winRate.toFixed(1),profitFactor:+profitFactor.toFixed(2)};
}
export default async function handler(req,res){
 try{
  const symbol=String(req.query.symbol||"1000PEPEUSDT").toUpperCase(),interval=String(req.query.interval||"5m");
  const limit=clamp(parseInt(req.query.limit||"1000",10),500,1500);
  if(!/^[A-Z0-9]{5,20}$/.test(symbol))return res.status(400).json({error:"Geçersiz sembol."});
  if(!["1m","3m","5m","15m","1h"].includes(interval))return res.status(400).json({error:"Geçersiz zaman dilimi."});
  const r=await fetch(`https://fapi.binance.com/fapi/v1/klines?symbol=${encodeURIComponent(symbol)}&interval=${encodeURIComponent(interval)}&limit=${limit}`);
  if(!r.ok)return res.status(502).json({error:"Backtest için Binance mum verisi alınamadı."});
  const k=await r.json(),open=k.map(x=>+x[1]),high=k.map(x=>+x[2]),low=k.map(x=>+x[3]),close=k.map(x=>+x[4]),vol=k.map(x=>+x[5]);
  const d=calcAll(open,high,low,close,vol);
  const legacyTrades=[],advancedTrades=[],commonTrades=[];
  const start=220,horizon=12; // 12 candles forward
  for(let i=start;i<close.length-horizon-1;i++){
    const legacy=legacyAt(d,open,high,low,close,vol,i,false);
    const advanced=advancedAt(d,open,high,low,close,vol,i);
    const common=commonDecision(legacy,advanced);
    const nextOpen=open[i+1],a=d.atrV[i];
    if(!a)continue;
    if(legacy.signal!=="BEKLE")legacyTrades.push(evalTrade(legacy.signal,nextOpen,a,high.slice(i+1,i+1+horizon),low.slice(i+1,i+1+horizon)));
    if(advanced.signal!=="BEKLE")advancedTrades.push(evalTrade(advanced.signal,nextOpen,a,high.slice(i+1,i+1+horizon),low.slice(i+1,i+1+horizon)));
    const cs=sideOfDecision(common.decision);if(cs)commonTrades.push(evalTrade(cs,nextOpen,a,high.slice(i+1,i+1+horizon),low.slice(i+1,i+1+horizon)));
  }
  res.setHeader("Cache-Control","no-store");
  return res.status(200).json({
   symbol,interval,candles:k.length,horizon,
   methodology:"Sinyal kapanmış mumda hesaplandı; giriş sonraki mum açılışı; TP=1.5 ATR, SL=1.25 ATR; aynı mumda TP ve SL görülürse zarar sayıldı.",
   legacy:summarize(legacyTrades),
   advanced:summarize(advancedTrades),
   common:summarize(commonTrades),
   timestamp:new Date().toISOString()
  });
 }catch(e){return res.status(500).json({error:e?.message||"Backtest hatası."})}
}