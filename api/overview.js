function ema(values,period){const k=2/(period+1),o=[values[0]];for(let i=1;i<values.length;i++)o.push(values[i]*k+o[i-1]*(1-k));return o}
function sma(v,p){const o=Array(v.length).fill(null);let s=0;for(let i=0;i<v.length;i++){s+=v[i];if(i>=p)s-=v[i-p];if(i>=p-1)o[i]=s/p}return o}
function rsi(v,p=14){const g=[],l=[];for(let i=1;i<v.length;i++){const d=v[i]-v[i-1];g.push(Math.max(d,0));l.push(Math.max(-d,0))}let ag=g.slice(0,p).reduce((a,b)=>a+b,0)/p,al=l.slice(0,p).reduce((a,b)=>a+b,0)/p;const o=Array(v.length).fill(null);o[p]=al===0?100:100-100/(1+ag/al);for(let i=p+1;i<v.length;i++){ag=(ag*(p-1)+g[i-1])/p;al=(al*(p-1)+l[i-1])/p;o[i]=al===0?100:100-100/(1+ag/al)}return o}
function clamp(x,a,b){return Math.max(a,Math.min(b,x))}
function spark(values){const a=values.slice(-30);const min=Math.min(...a),max=Math.max(...a),range=max-min||1;return a.map((v,i)=>`${(i/(a.length-1)*108+1).toFixed(1)},${(34-(v-min)/range*32).toFixed(1)}`).join(" ")}
function score(k){
  const c=k.slice(0,-1),open=c.map(x=>+x[1]),high=c.map(x=>+x[2]),low=c.map(x=>+x[3]),close=c.map(x=>+x[4]),vol=c.map(x=>+x[5]),n=close.length-1;
  const e20=ema(close,20),e50=ema(close,50),e200=ema(close,200),r=rsi(close),vma=sma(vol,20);
  let total=50;
  let trend=12.5;if(e20[n]>e50[n]&&e50[n]>e200[n])trend=25;else if(e20[n]<e50[n]&&e50[n]<e200[n])trend=0;else if(close[n]>e50[n])trend=17;else if(close[n]<e50[n])trend=8;total+=trend-12.5;
  const rv=vma[n]?vol[n]/vma[n]:1,dir=close[n]>open[n]&&close[n]>close[n-2]?1:close[n]<open[n]&&close[n]<close[n-2]?-1:0;total+=(dir>0?10*Math.min(1,Math.max(0,rv-1)):dir<0?-10*Math.min(1,Math.max(0,rv-1)):0);
  const hh=Math.max(...high.slice(n-20,n)),ll=Math.min(...low.slice(n-20,n));if(close[n]>hh)total+=10;else if(close[n]<ll)total-=10;else if(close[n]>close[n-5])total+=5;else if(close[n]<close[n-5])total-=5;
  if(r[n]>=55&&r[n]<=70)total+=5;else if(r[n]<=45&&r[n]>=30)total-=5;
  total=Math.round(clamp(total,0,100));
  const label=total>=80?"GÜÇLÜ LONG":total>=65?"LONG ADAYI":total<=20?"GÜÇLÜ SHORT":total<=35?"SHORT ADAYI":"BEKLE";
  return {score:total,label,price:close[n],spark:spark(close)};
}
async function get(url){const r=await fetch(url);if(!r.ok)throw Error("Binance veri hatası");return r.json()}
export default async function handler(req,res){
  try{
    const symbols=String(req.query.symbols||"").split(",").map(x=>x.trim().toUpperCase()).filter(x=>/^[A-Z0-9]{5,20}$/.test(x)).slice(0,20);
    const interval=["1m","3m","5m","15m","1h"].includes(String(req.query.interval))?String(req.query.interval):"5m";
    if(!symbols.length)return res.status(400).json({error:"Parite yok."});
    const data=await Promise.all(symbols.map(async symbol=>{
      try{
        const [k,t]=await Promise.all([
          get(`https://fapi.binance.com/fapi/v1/klines?symbol=${symbol}&interval=${interval}&limit=220`),
          get(`https://fapi.binance.com/fapi/v1/ticker/24hr?symbol=${symbol}`)
        ]);
        return {symbol,...score(k),changePct:+t.priceChangePercent};
      }catch(e){return null}
    }));
    res.setHeader("Cache-Control","s-maxage=20, stale-while-revalidate=20");
    return res.status(200).json({items:data.filter(Boolean),timestamp:new Date().toISOString()});
  }catch(e){return res.status(500).json({error:e?.message||"Overview hatası"})}
}