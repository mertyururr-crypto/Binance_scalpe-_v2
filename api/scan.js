function ema(values, period){
  const k=2/(period+1),out=[values[0]];
  for(let i=1;i<values.length;i++)out.push(values[i]*k+out[i-1]*(1-k));
  return out;
}
function sma(values,period){
  const out=Array(values.length).fill(null);let sum=0;
  for(let i=0;i<values.length;i++){sum+=values[i];if(i>=period)sum-=values[i-period];if(i>=period-1)out[i]=sum/period}
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
function scoreKlines(k){
  const closed=k.slice(0,-1),open=closed.map(x=>+x[1]),high=closed.map(x=>+x[2]),low=closed.map(x=>+x[3]),close=closed.map(x=>+x[4]),vol=closed.map(x=>+x[5]);
  const n=close.length-1;
  if(n<205)return null;
  const e20=ema(close,20),e50=ema(close,50),e200=ema(close,200),r=rsi(close,14),a=atr(high,low,close,14),vma=sma(vol,20),adxD=adx(high,low,close,14);

  let total=50,reason=[];
  let trend=12.5;
  if(e20[n]>e50[n]&&e50[n]>e200[n]){trend=25;reason.push("trend↑")}
  else if(e20[n]<e50[n]&&e50[n]<e200[n]){trend=0;reason.push("trend↓")}
  else if(close[n]>e50[n])trend=17; else if(close[n]<e50[n])trend=8;
  total+=trend-12.5;

  let ap=10;const av=adxD.adx[n],p=adxD.plusDI[n],m=adxD.minusDI[n];
  if(Number.isFinite(av)){
    const s=clamp((av-15)/20,0,1);
    if(p>m){ap=10+10*s;if(av>=25)reason.push("ADX+")}
    else if(m>p){ap=10-10*s;if(av>=25)reason.push("ADX-")}
  }
  total+=ap-10;

  const rv=vma[n]?vol[n]/vma[n]:1,dir=close[n]>open[n]&&close[n]>close[n-2]?1:close[n]<open[n]&&close[n]<close[n-2]?-1:0,vs=clamp((rv-1),0,1);
  let rp=10;if(dir>0){rp=10+10*vs;if(rv>=1.2)reason.push("RVOL↑")}else if(dir<0){rp=10-10*vs;if(rv>=1.2)reason.push("RVOL↓")}
  total+=rp-10;

  const hh=Math.max(...high.slice(n-20,n)),ll=Math.min(...low.slice(n-20,n));let sp=10;
  if(close[n]>hh){sp=20;reason.push("breakout↑")}else if(close[n]<ll){sp=0;reason.push("breakdown↓")}else if(close[n]>close[n-5])sp=15;else if(close[n]<close[n-5])sp=5;
  total+=sp-10;

  let mp=5;if(r[n]>=55&&r[n]<=70)mp=10;else if(r[n]>70)mp=7;else if(r[n]<=45&&r[n]>=30)mp=0;else if(r[n]<30)mp=3;
  total+=mp-5;

  const atrPct=a[n]/close[n]*100;let vp=2.5;if(atrPct>=0.25&&atrPct<=1.8)vp=5;else if(atrPct>3.5)vp=1;
  total+=(vp-2.5)*(total>=50?1:-1);

  const score=Math.round(clamp(total,0,100));
  const qualityPass=(score>=80||score<=20)&&Number.isFinite(av)&&av>=20&&rv>=1.0&&atrPct>=0.25&&atrPct<=3.5;
  return {score,price:close[n],reason:reason.slice(0,3).join(" • ")||`RSI ${r[n].toFixed(0)}`,adx:Number.isFinite(av)?av:null,rvol:rv,atrPct,qualityPass};
}
async function fetchJson(url){
  const r=await fetch(url);
  if(!r.ok)throw new Error("Binance yanıt vermedi");
  return r.json();
}
export default async function handler(req,res){
  try{
    const base="https://fapi.binance.com";
    const [exchange,tickers]=await Promise.all([
      fetchJson(`${base}/fapi/v1/exchangeInfo`),
      fetchJson(`${base}/fapi/v1/ticker/24hr`)
    ]);
    const active=new Set(exchange.symbols.filter(s=>s.contractType==="PERPETUAL"&&s.quoteAsset==="USDT"&&s.status==="TRADING").map(s=>s.symbol));
    const top=tickers.filter(t=>active.has(t.symbol)).sort((a,b)=>(+b.quoteVolume)-(+a.quoteVolume)).slice(0,24);

    const results=[];
    for(let i=0;i<top.length;i+=6){
      const chunk=top.slice(i,i+6);
      const data=await Promise.all(chunk.map(async t=>{
        try{
          const k=await fetchJson(`${base}/fapi/v1/klines?symbol=${encodeURIComponent(t.symbol)}&interval=5m&limit=220`);
          const s=scoreKlines(k);
          return s?{symbol:t.symbol,...s}:null;
        }catch(e){return null}
      }));
      results.push(...data.filter(Boolean));
    }

    const strongLong=results.filter(x=>x.score>=80).sort((a,b)=>b.score-a.score).slice(0,6).map(x=>({...x,direction:"LONG"}));
    const strongShort=results.filter(x=>x.score<=20).sort((a,b)=>a.score-b.score).slice(0,6).map(x=>({...x,direction:"SHORT"}));

    res.setHeader("Cache-Control","s-maxage=30, stale-while-revalidate=30");
    return res.status(200).json({
      scanned:results.length,
      strongLong,strongShort,
      timestamp:new Date().toISOString()
    });
  }catch(e){
    return res.status(500).json({error:e?.message||"Tarama hatası."});
  }
}