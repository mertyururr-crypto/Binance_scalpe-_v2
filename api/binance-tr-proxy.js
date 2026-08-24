
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
    const action=String(req.query.action||"klines").toLowerCase();

    if(action==="symbols"){
      const attempts=[];
      const urls=[
        "https://www.binance.tr/open/v1/common/symbols",
        "https://api.binance.me/open/v1/common/symbols"
      ];
      for(const url of urls){
        try{
          const x=await fetchText(url);
          attempts.push({url,status:x.status,finalUrl:x.url,sample:x.text.slice(0,80)});
          if(!x.ok)continue;
          let j;
          try{j=JSON.parse(x.text)}catch{continue}
          const raw=j&&typeof j==="object"&&"data" in j?j.data:j;
          const list=Array.isArray(raw?.list)?raw.list:Array.isArray(raw)?raw:[];
          const symbols=list
            .filter(v=>String(v?.quoteAsset||"").toUpperCase()==="TRY")
            .map(v=>({
              symbol:String(v?.symbol||"").toUpperCase().replace(/_/g,""),
              rawSymbol:String(v?.symbol||"").toUpperCase(),
              baseAsset:String(v?.baseAsset||"").toUpperCase(),
              quoteAsset:String(v?.quoteAsset||"TRY").toUpperCase(),
              type:Number(v?.type||1)
            }))
            .filter(v=>v.symbol&&v.baseAsset)
            .sort((a,b)=>a.baseAsset.localeCompare(b.baseAsset));
          if(symbols.length){
            res.setHeader("Cache-Control","s-maxage=300, stale-while-revalidate=600");
            return res.status(200).json({ok:true,count:symbols.length,symbols,source:x.url});
          }
        }catch(e){attempts.push({url,error:e?.message||"fetch failed"})}
      }
      return res.status(502).json({error:"Binance TR parite listesi alınamadı",attempts});
    }

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
