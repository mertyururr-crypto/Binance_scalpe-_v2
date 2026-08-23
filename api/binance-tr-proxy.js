
const HOSTS=[
  "https://api.binance.me",
  "https://www.binance.tr"
];

function cleanSymbol(v){return String(v||"").toUpperCase().replace(/[^A-Z0-9]/g,"")}
function validInterval(v){return ["1m","3m","5m","15m","1h"].includes(String(v))}

async function fetchText(url){
  const r=await fetch(url,{
    method:"GET",
    headers:{
      "accept":"application/json,text/plain,*/*",
      "user-agent":"Mozilla/5.0",
      "referer":"https://www.binance.tr/"
    },
    redirect:"follow"
  });
  const text=await r.text();
  return {ok:r.ok,status:r.status,text,url:r.url||url};
}

export default async function handler(req,res){
  try{
    const symbol=cleanSymbol(req.query.symbol);
    const interval=String(req.query.interval||"5m");
    const limit=Math.min(1000,Math.max(1,Number(req.query.limit)||320));
    if(!symbol)return res.status(400).json({error:"Sembol gerekli"});
    if(!validInterval(interval))return res.status(400).json({error:"Geçersiz interval"});

    const attempts=[];
    const paths=[
      `/api/v1/klines?symbol=${encodeURIComponent(symbol)}&interval=${encodeURIComponent(interval)}&limit=${limit}`,
      `/api/v3/klines?symbol=${encodeURIComponent(symbol)}&interval=${encodeURIComponent(interval)}&limit=${limit}`
    ];

    for(const host of HOSTS){
      for(const path of paths){
        const url=host+path;
        try{
          const x=await fetchText(url);
          attempts.push({url,status:x.status,finalUrl:x.url,sample:x.text.slice(0,80)});
          if(!x.ok)continue;
          let j;
          try{j=JSON.parse(x.text)}catch{continue}
          const data=j&&typeof j==="object"&&"data" in j?j.data:j;
          if(Array.isArray(data)&&data.length){
            res.setHeader("Cache-Control","no-store");
            return res.status(200).json({
              ok:true,
              source:x.url,
              symbol,interval,limit,
              data
            });
          }
        }catch(e){
          attempts.push({url,error:e?.message||"fetch failed"});
        }
      }
    }

    return res.status(502).json({
      error:"Binance TR mum verisi alınamadı",
      symbol,interval,
      attempts
    });
  }catch(e){
    return res.status(500).json({error:e?.message||"Proxy hatası"});
  }
}
