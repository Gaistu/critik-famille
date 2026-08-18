/* =========================================================================
   LE GRAND CATALOGUE — application (app.js)
   Utilise les variables de config.js (SUPABASE_URL, SUPABASE_ANON_KEY)
   et l'objet global "supabase" chargé par le CDN dans index.html.
   ========================================================================= */
"use strict";

/* ============================ Données de base ============================ */
var TYPES = [
  { id:"film",  label:"Film",   plural:"Films",   icon:"🎬", color:"#C0392B", verb:"vu" },
  { id:"serie", label:"Série",  plural:"Séries",  icon:"📺", color:"#147E73", verb:"vue" },
  { id:"anime", label:"Anime",  plural:"Animes",  icon:"🍥", color:"#9B4D96", verb:"vu" },
  { id:"livre", label:"Livre",  plural:"Livres",  icon:"📖", color:"#3F7A3A", verb:"lu" },
  { id:"manga", label:"Manga",  plural:"Mangas",  icon:"📚", color:"#D98016", verb:"lu" },
  { id:"album", label:"Album",  plural:"Albums",  icon:"💿", color:"#345D9D", verb:"écouté" },
  { id:"titre", label:"Titre",  plural:"Titres",  icon:"🎵", color:"#2E7DA1", verb:"écouté" },
];
var STATUSES = [
  { id:"todo",  label:"À voir",   icon:"🔖", color:"#345D9D" },
  { id:"doing", label:"En cours", icon:"⏳", color:"#D98016" },
  { id:"done",  label:"Terminé",  icon:"✓",  color:"#3F7A3A" },
];
var MEMBER_COLORS = ["#C0392B","#147E73","#9B4D96","#3F7A3A","#D98016","#345D9D","#B03060","#0F766E","#8A5A2B"];
function typeMeta(id){ return TYPES.find(function(t){return t.id===id;}) || TYPES[0]; }
function statusMeta(id){ return STATUSES.find(function(s){return s.id===id;}) || STATUSES[2]; }

/* ============================== Utilitaires ============================= */
function uid(){ return Math.random().toString(36).slice(2,10)+Date.now().toString(36).slice(-4); }
function nfr(n){ return Number.isInteger(n) ? String(n) : String(n).replace(".",","); }
function avg1(n){ return (Math.round(n*10)/10).toString().replace(".",","); }
function noteOptionsHTML(selected){ var s='<option value="">—</option>'; for(var v=0.5; v<=10.0001; v+=0.5){ var vv=Math.round(v*10)/10; s+='<option value="'+vv+'"'+((selected&&Number(selected)===vv)?" selected":"")+'>'+nfr(vv)+'/10</option>'; } return s; }
function seasonKind(s){ if(s&&s.kind) return s.kind; var n=String((s&&s.n)||""); if(/^\d+$/.test(n)) return "season"; if(/oav/i.test(n)) return "oav"; if(/film/i.test(n)) return "film"; return "season"; }
function seasonsAverage(seasons){ var r=(seasons||[]).filter(function(s){ return seasonKind(s)==="season" && s.rating>0; }); return r.length? Math.round((r.reduce(function(a,s){return a+s.rating;},0)/r.length)*10)/10 : 0; }
function ratingsAverage(rs){ var r=(rs||[]).filter(function(x){ return x && x.r>0; }); return r.length? Math.round((r.reduce(function(a,x){return a+x.r;},0)/r.length)*10)/10 : 0; }
function myRating(e, mid){ var rs=(e&&e.ratings)||[]; for(var i=0;i<rs.length;i++){ if(rs[i].m===mid) return rs[i]; } return null; }

/* ---- Recherche automatique (affiche + infos) ---- */
function tmdbKey(){ return (typeof TMDB_API_KEY==="string" && TMDB_API_KEY && !/TA_CLE/.test(TMDB_API_KEY)) ? TMDB_API_KEY.trim() : ""; }
function jsonp(url){ return new Promise(function(resolve,reject){
  var cb="jcb"+Date.now()+Math.floor(Math.random()*10000); var s=document.createElement("script"); var done=false;
  function cleanup(){ try{ delete window[cb]; }catch(e){ window[cb]=undefined; } if(s.parentNode) s.parentNode.removeChild(s); }
  window[cb]=function(data){ done=true; resolve(data); cleanup(); };
  s.onerror=function(){ if(!done){ cleanup(); reject(new Error("réseau")); } };
  s.src=url+(url.indexOf("?")>=0?"&":"?")+"callback="+cb; document.body.appendChild(s);
  setTimeout(function(){ if(!done){ cleanup(); reject(new Error("délai")); } },8000);
}); }
var TMDB_GENRES={28:"Action",12:"Aventure",16:"Animation",35:"Comédie",80:"Crime",99:"Documentaire",18:"Drame",10751:"Familial",14:"Fantastique",36:"Histoire",27:"Horreur",10402:"Musique",9648:"Mystère",10749:"Romance",878:"Science-fiction",10770:"Téléfilm",53:"Thriller",10752:"Guerre",37:"Western",10759:"Action & Aventure",10762:"Enfants",10763:"Actualités",10764:"Téléréalité",10765:"Sci-Fi & Fantastique",10766:"Feuilleton",10767:"Talk",10768:"Guerre & Politique"};
function mapGenres(ids){ return (ids||[]).map(function(id){return TMDB_GENRES[id];}).filter(Boolean); }
function srcTMDB(kind,q){
  if(!tmdbKey()) return Promise.reject(new Error("no-key"));
  var url="https://api.themoviedb.org/3/search/"+kind+"?api_key="+encodeURIComponent(tmdbKey())+"&language=fr-FR&include_adult=false&query="+encodeURIComponent(q);
  return fetch(url).then(function(r){ if(!r.ok) throw new Error("TMDB "+r.status); return r.json(); }).then(function(d){
    return (d.results||[]).slice(0,6).map(function(x){ var date=x.release_date||x.first_air_date||"";
      return { title:x.title||x.name||"", year:date?date.slice(0,4):"", cover:x.poster_path?("https://image.tmdb.org/t/p/w500"+x.poster_path):"", synopsis:x.overview||"", sub:"", genres:mapGenres(x.genre_ids) }; });
  });
}
function srcOpenLib(q){
  var url="https://openlibrary.org/search.json?limit=6&q="+encodeURIComponent(q);
  return fetch(url).then(function(r){ if(!r.ok) throw new Error("OpenLibrary "+r.status); return r.json(); }).then(function(d){
    return (d.docs||[]).slice(0,6).map(function(x){ return { title:x.title||"", year:x.first_publish_year?String(x.first_publish_year):"", cover:x.cover_i?("https://covers.openlibrary.org/b/id/"+x.cover_i+"-L.jpg"):"", synopsis:"", sub:(x.author_name&&x.author_name[0])||"", key:x.key||"" }; });
  });
}
function fetchOLDesc(key){
  return fetch("https://openlibrary.org"+key+".json").then(function(r){ return r.json(); }).then(function(d){
    var desc=d && d.description; if(desc && typeof desc==="object") desc=desc.value; return (typeof desc==="string")?desc:"";
  });
}
function srcITunes(entity,q){
  var url="https://itunes.apple.com/search?country=FR&limit=6&entity="+entity+"&term="+encodeURIComponent(q);
  return jsonp(url).then(function(d){
    return (d.results||[]).slice(0,6).map(function(x){ var date=x.releaseDate||""; var art=(x.artworkUrl100||"").replace("100x100","600x600");
      return { title:(entity==="album"?x.collectionName:x.trackName)||"", year:date?date.slice(0,4):"", cover:art, synopsis:"", sub:x.artistName||"" }; });
  });
}
function searchTitle(type,q){
  q=(q||"").trim(); if(!q) return Promise.resolve([]);
  if(type==="film") return srcTMDB("movie",q);
  if(type==="serie"||type==="anime") return srcTMDB("tv",q);
  if(type==="livre"||type==="manga") return srcOpenLib(q);
  if(type==="album") return srcITunes("album",q);
  if(type==="titre") return srcITunes("song",q);
  return Promise.resolve([]);
}
function esc(s){ return String(s==null?"":s).replace(/[&<>"']/g,function(c){ return {"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]; }); }
function $(sel){ return document.querySelector(sel); }

var LSraw = {
  get:function(k,d){ try{ var v=localStorage.getItem(k); return v==null?d:JSON.parse(v); }catch(e){ return d; } },
  set:function(k,v){ try{ localStorage.setItem(k, JSON.stringify(v)); }catch(e){} },
  del:function(k){ try{ localStorage.removeItem(k); }catch(e){} },
};

/* =============================== État ================================== */
var state = {
  title:"Critik Famille", members:[], entries:[], covers:{}, activity:[],
  active:null, view:"catalogue", theme:"light",
  fType:"all", fStatus:"all", fMember:"all", fGenre:"all", fMinNote:0, query:"", sort:"recent", who:"all", group:"none", favOnly:false, watchOnly:false,
};
var db = null;

/* ============================ Config Supabase ========================== */
function configReady(){
  return typeof SUPABASE_URL==="string" && typeof SUPABASE_ANON_KEY==="string" &&
    SUPABASE_URL && SUPABASE_ANON_KEY && !/TON-PROJET|TA_CLE/.test(SUPABASE_URL+SUPABASE_ANON_KEY);
}
var SETUP_SQL =
"-- À exécuter une fois dans Supabase (SQL Editor)\n"+
"create table if not exists members (\n"+
"  id text primary key,\n"+
"  name text not null,\n"+
"  color text not null,\n"+
"  created_at timestamptz default now()\n"+
");\n"+
"create table if not exists entries (\n"+
"  id text primary key,\n"+
"  type text not null,\n"+
"  title text not null,\n"+
"  year text,\n"+
"  season text,\n"+
"  seasons jsonb,\n"+
"  favorites jsonb,\n"+
"  watchers jsonb,\n"+
"  synopsis text,\n"+
"  genres jsonb,\n"+
"  member_id text,\n"+
"  rating numeric default 0,\n"+
"  rating_manual numeric,\n"+
"  ratings jsonb,\n"+
"  review text,\n"+
"  status text default 'done',\n"+
"  cover text,\n"+
"  created_at timestamptz default now()\n"+
");\n"+
"create table if not exists settings ( key text primary key, value text );\n"+
"create table if not exists activity ( id text primary key, ts timestamptz default now(), member_id text, action text, entry_id text, entry_type text, entry_title text, rating numeric );\n\n"+
"alter table members  enable row level security;\n"+
"alter table entries  enable row level security;\n"+
"alter table settings enable row level security;\n"+
"alter table activity enable row level security;\n\n"+
"-- Appli familiale : accès via la clé anon\n"+
"create policy \"anon members\" on members  for all to anon using (true) with check (true);\n"+
"create policy \"anon entries\" on entries  for all to anon using (true) with check (true);\n"+
"create policy \"anon settings\" on settings for all to anon using (true) with check (true);\n"+
"create policy \"anon activity\" on activity for all to anon using (true) with check (true);\n\n"+
"-- Synchronisation en temps réel\n"+
"alter publication supabase_realtime add table members, entries, settings, activity;";

/* =============================== Feedback =============================== */
var bannerTimer=null;
function flash(msg){
  var b=$("#banner");
  if(!b){ b=document.createElement("div"); b.id="banner"; b.className="banner"; document.body.appendChild(b); }
  b.textContent=msg; clearTimeout(bannerTimer); bannerTimer=setTimeout(function(){ b.remove(); },3200);
}
var THEMES={
  clair:  {label:"Clair",       dark:false, vars:{paper:"#F4EEE3",paper2:"#EFE7D8",card:"#FFFCF6",ink:"#221C2B",soft:"#6E6676",line:"#E3D9C7",gold:"#E0A82E",field:"#FFFFFF",glow:"#FBF6EC"}},
  sombre: {label:"Sombre",      dark:true,  vars:{paper:"#17141F",paper2:"#231E30",card:"#211C2B",ink:"#ECE6DA",soft:"#A79FB0",line:"#342E44",gold:"#E7B23C",field:"#2A2438",glow:"#241F33"}},
  nuit:   {label:"Nuit bleue",  dark:true,  vars:{paper:"#0F1420",paper2:"#182234",card:"#152033",ink:"#E6ECF5",soft:"#93A0B8",line:"#26344B",gold:"#4FA3E3",field:"#1B2740",glow:"#1C2C46"}},
  foret:  {label:"Forêt",       dark:true,  vars:{paper:"#111A15",paper2:"#1A2820",card:"#16231C",ink:"#E7F0E8",soft:"#96AC9C",line:"#263A2E",gold:"#6FBF73",field:"#1B2C22",glow:"#1C3226"}},
  prune:  {label:"Prune",       dark:true,  vars:{paper:"#1A121C",paper2:"#291A2C",card:"#221527",ink:"#F0E6F0",soft:"#B097B4",line:"#3C2A40",gold:"#C77DBB",field:"#2A1A2E",glow:"#301F36"}},
  sable:  {label:"Sable",       dark:false, vars:{paper:"#F3EAD8",paper2:"#EADFC6",card:"#FFFBF0",ink:"#2A2416",soft:"#7A6F55",line:"#DDCDA8",gold:"#C99A2E",field:"#FFFFFF",glow:"#FBF3DE"}}
};
function themeMigrate(v){ if(v==="dark") return "sombre"; if(v==="light"||!v) return "clair"; return THEMES[v]?v:"clair"; }
function applyTheme(id){
  id=themeMigrate(id); var th=THEMES[id]||THEMES.clair; state.theme=id;
  var css=":root{"+Object.keys(th.vars).map(function(k){return "--"+k+":"+th.vars[k]+" !important";}).join(";")+"}";
  var el=document.getElementById("theme-vars");
  if(!el){ el=document.createElement("style"); el.id="theme-vars"; document.head.appendChild(el); }
  el.textContent=css;
  document.body.classList.toggle("dark", !!th.dark);
  document.body.style.background=th.vars.paper;
  document.body.style.color=th.vars.ink;
  LSraw.set("cat_theme",id);
  var b=$("#btnTheme"); if(b) b.textContent="🎨";
}
function openThemeMenu(){
  var overlay=document.createElement("div"); overlay.className="overlay";
  overlay.innerHTML='<div class="modal" style="max-width:420px">'+
    '<div class="modal__head"><h2>Thème</h2><button class="x" data-x>✕</button></div>'+
    '<div class="theme-grid">'+Object.keys(THEMES).map(function(id){ var th=THEMES[id]; var v=th.vars;
      return '<button class="theme-opt'+(state.theme===id?" is-on":"")+'" data-theme="'+id+'"><span class="theme-swatch" style="background:'+v.paper+'"><span style="background:'+v.card+';border-color:'+v.line+'"></span><span style="background:'+v.gold+'"></span></span><span class="theme-name">'+th.label+'</span></button>';
    }).join("")+'</div>'+
    '<div class="modal__foot"><button class="ghost" data-x>Fermer</button></div></div>';
  document.body.appendChild(overlay);
  function close(){ overlay.remove(); }
  overlay.addEventListener("mousedown",function(ev){ if(ev.target===overlay) close(); });
  [].forEach.call(overlay.querySelectorAll("[data-x]"),function(b){ b.onclick=close; });
  [].forEach.call(overlay.querySelectorAll("[data-theme]"),function(b){ b.onclick=function(){ applyTheme(b.getAttribute("data-theme")); close(); }; });
}
function currentView(){ return { fType:state.fType, fStatus:state.fStatus, fMember:state.fMember, fGenre:state.fGenre, fMinNote:state.fMinNote, sort:state.sort, group:state.group, favOnly:state.favOnly, query:state.query }; }
function applyView(v){ ["fType","fStatus","fMember","fGenre","fMinNote","sort","group","favOnly","query"].forEach(function(k){ if(v[k]!==undefined) state[k]=v[k]; }); renderContent(); }
function openViewsMenu(){
  var views=LSraw.get("cat_views",[]); if(!Array.isArray(views)) views=[];
  var overlay=document.createElement("div"); overlay.className="overlay";
  overlay.innerHTML='<div class="modal" style="max-width:420px">'+
    '<div class="modal__head"><h2>Vues enregistrées</h2><button class="x" data-x>✕</button></div>'+
    '<p class="hint">Enregistre la combinaison de filtres actuelle (type, genre, note minimale, tri…) pour la retrouver en un clic.</p>'+
    '<button class="add-btn" id="saveView" style="width:100%;margin-bottom:14px">+ Enregistrer la vue actuelle</button>'+
    '<div class="bk-list" id="viewsList"></div>'+
    '<div class="modal__foot"><button class="ghost" data-x>Fermer</button></div></div>';
  document.body.appendChild(overlay);
  function close(){ overlay.remove(); }
  overlay.addEventListener("mousedown",function(ev){ if(ev.target===overlay) close(); });
  [].forEach.call(overlay.querySelectorAll("[data-x]"),function(b){ b.onclick=close; });
  var listEl=overlay.querySelector("#viewsList");
  function draw(){
    listEl.innerHTML = views.length? "" : '<p class="muted">Aucune vue enregistrée.</p>';
    views.forEach(function(v,i){ var row=document.createElement("div"); row.className="bk-row";
      row.innerHTML='<button class="linklike" data-apply="'+i+'">'+esc(v.name)+'</button><button class="dnote__del" data-delview="'+i+'" title="Supprimer">✕</button>';
      row.querySelector("[data-apply]").onclick=function(){ applyView(v.v); close(); };
      row.querySelector("[data-delview]").onclick=function(){ views.splice(i,1); LSraw.set("cat_views",views); draw(); };
      listEl.appendChild(row); });
  }
  draw();
  overlay.querySelector("#saveView").onclick=function(){ var name=prompt("Nom de la vue :",""); if(!name) return; views.unshift({name:name.slice(0,40), v:currentView()}); views=views.slice(0,20); LSraw.set("cat_views",views); draw(); };
}

/* ============================ Compression image ========================= */
function fileToThumb(file, maxDim, quality){
  maxDim=maxDim||420; quality=quality||0.72;
  return new Promise(function(resolve,reject){
    var reader=new FileReader();
    reader.onload=function(){ var img=new Image();
      img.onload=function(){ var w=img.width,h=img.height; var s=Math.min(1,maxDim/Math.max(w,h));
        w=Math.round(w*s); h=Math.round(h*s); var c=document.createElement("canvas"); c.width=w; c.height=h;
        c.getContext("2d").drawImage(img,0,0,w,h);
        try{ resolve(c.toDataURL("image/jpeg",quality)); }catch(e){ reject(e); } };
      img.onerror=reject; img.src=reader.result; };
    reader.onerror=reject; reader.readAsDataURL(file);
  });
}

/* ============================== Étoiles ================================= */
function starsHTML(value,size){ size=size||16; var s='<span class="stars" style="font-size:'+size+'px">';
  for(var i=1;i<=5;i++){ var full=value>=i, half=!full&&value>=i-0.5;
    s+='<span class="star"><span class="star__bg">★</span><span class="star__fg" style="width:'+(full?100:half?50:0)+'%">★</span></span>'; }
  return s+"</span>"; }
function editableStars(value,size,onChange){
  var wrap=document.createElement("span"); wrap.className="stars"; wrap.style.fontSize=(size||28)+"px"; var hover=null;
  function paint(v){ [].forEach.call(wrap.children,function(star,idx){ var i=idx+1,full=v>=i,half=!full&&v>=i-0.5;
    star.querySelector(".star__fg").style.width=(full?100:half?50:0)+"%"; }); }
  for(var i=1;i<=5;i++){ (function(i){ var star=document.createElement("span"); star.className="star star--edit";
    star.innerHTML='<span class="star__bg">★</span><span class="star__fg" style="width:0%">★</span>';
    star.addEventListener("mousemove",function(e){ var r=star.getBoundingClientRect(); hover=(e.clientX-r.left<r.width/2)?i-0.5:i; paint(hover); });
    star.addEventListener("mouseleave",function(){ hover=null; paint(value); });
    star.addEventListener("click",function(){ value=hover!=null?hover:i; onChange(value); paint(value); });
    wrap.appendChild(star); })(i); }
  paint(value); return wrap;
}

/* ============================== Data layer ============================= */
function rowToEntry(r){
  var ratings = Array.isArray(r.ratings) ? r.ratings.filter(function(x){return x&&x.m;}).map(function(x){return {m:x.m, r:Number(x.r)||0, rev:x.rev||""};}) : [];
  if(!ratings.length && r.member_id && (Number(r.rating)>0 || (r.review&&(""+r.review).trim()))){
    ratings=[{m:r.member_id, r:Number(r.rating)||0, rev:r.review||""}];
  }
  var avg = ratings.length ? ratingsAverage(ratings) : (Number(r.rating)||0);
  return { id:r.id, type:r.type, title:r.title, year:r.year||"", synopsis:r.synopsis||"", genres:(Array.isArray(r.genres)?r.genres:[]), season:r.season||"", seasons:(Array.isArray(r.seasons)?r.seasons:[]), memberId:r.member_id,
    rating:avg, ratings:ratings, review:r.review||"", status:r.status||"done",
    hasCover:!!r.cover, createdAt:r.created_at?new Date(r.created_at).getTime():0, favorites:(Array.isArray(r.favorites)?r.favorites:[]), watchers:(Array.isArray(r.watchers)?r.watchers:[]) };
}
function applyMembers(rows){ state.members=(rows||[]).map(function(m){ return {id:m.id,name:m.name,color:m.color}; }); }
function applyEntries(rows){ state.entries=(rows||[]).map(rowToEntry); state.covers={};
  (rows||[]).forEach(function(r){ if(r.cover) state.covers[r.id]=r.cover; }); }
function applySettings(rows){ var t=(rows||[]).find(function(s){return s.key==="title";}); state.title=t?t.value:"Critik Famille"; }

function loadAll(){
  return Promise.all([ db.from("members").select("*"), db.from("entries").select("*"), db.from("settings").select("*") ])
    .then(function(res){ var m=res[0],e=res[1],s=res[2];
      if(m.error) throw m.error; if(e.error) throw e.error; if(s.error) throw s.error;
      applyMembers(m.data); applyEntries(e.data); applySettings(s.data); });
}
function loadMembers(){ return db.from("members").select("*").then(function(r){ if(!r.error) applyMembers(r.data); }); }
function loadSettings(){ return db.from("settings").select("*").then(function(r){ if(!r.error) applySettings(r.data); }); }
function loadActivity(){ if(!db) return Promise.resolve(); return db.from("activity").select("*").order("ts",{ascending:false}).limit(30).then(function(r){ if(!r.error) state.activity=r.data||[]; }).catch(function(){}); }
function logActivity(action, e, rating){
  try{
    if(!db || !state.active) return;
    var row={ id:uid(), member_id:state.active, action:action, entry_id:e.id, entry_type:e.type, entry_title:e.title, rating:(rating!=null?rating:null) };
    var local={}; for(var k in row) local[k]=row[k]; local.ts=new Date().toISOString();
    state.activity.unshift(local); state.activity=state.activity.slice(0,30); updateRecent();
    db.from("activity").insert(row).then(function(){}, function(){});
  }catch(err){ /* ne doit jamais bloquer l'enregistrement */ }
}

/* ================================ Init ================================= */
init();
function init(){
  applyTheme(LSraw.get("cat_theme","clair"));
  if(!window.supabase || !window.supabase.createClient){
    renderConfigNeeded("La librairie Supabase n'a pas pu être chargée. Une connexion internet est nécessaire pour ouvrir le catalogue.");
    return;
  }
  if(!configReady()){ renderConfigNeeded(); return; }
  db=window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  loadAll().then(function(){
    state.active=LSraw.get("cat_active",null) || (state.members[0]&&state.members[0].id) || null;
    if(state.members.length===0) renderOnboarding(); else renderApp();
    subscribeRealtime(); backupNow(); loadActivity().then(function(){ updateRecent(); });
  }).catch(function(err){
    renderConfigNeeded("Connexion impossible : "+(err.message||err)+"  — vérifie l'URL, la clé (config.js) et que le SQL a bien été exécuté dans Supabase.");
  });
}

/* ============================= Écran config ============================ */
function renderConfigNeeded(errMsg){
  $("#app").innerHTML='<div class="app-root"><div class="onboard">'+
    '<div class="onboard__mark">◈</div>'+
    '<h1 class="onboard__title">Presque prêt</h1>'+
    '<p class="onboard__lead">Ce catalogue enregistre tout dans <b>ta base Supabase</b>, en temps réel et en commun pour toute la famille. Deux petites choses à faire une seule fois.</p>'+
    (errMsg?'<div class="err">'+esc(errMsg)+'</div>':'')+
    '<ol class="steps"><li><b>1.</b> Dans Supabase → <i>SQL Editor</i>, colle et exécute ce script :</li></ol>'+
    '<div class="code" id="sqlBox"><button class="copybtn" id="copySql">Copier</button></div>'+
    '<ol class="steps" start="2"><li><b>2.</b> Ouvre le fichier <b>config.js</b> et renseigne ton <b>URL de projet</b> et ta clé <b>anon public</b> (Supabase → Project Settings → API), puis recharge cette page.</li></ol>'+
    '<div class="onboard__actions"><button class="add-btn" id="reloadBtn">Recharger la page</button></div>'+
    '</div></div>';
  var box=$("#sqlBox"); box.appendChild(document.createTextNode(SETUP_SQL));
  $("#copySql").onclick=function(){ navigator.clipboard.writeText(SETUP_SQL).then(function(){ flash("SQL copié."); }); };
  $("#reloadBtn").onclick=function(){ location.reload(); };
}

/* ============================= Onboarding =============================== */
function renderOnboarding(){
  $("#app").innerHTML='<div class="app-root"><div class="onboard">'+
    '<div class="onboard__mark">◈</div>'+
    '<h1 class="onboard__title">Critik Famille</h1>'+
    '<p class="onboard__lead">Base connectée ✓ Pour commencer, ajoute les membres de la famille.</p>'+
    '<div class="onboard__fields" id="obFields">'+
      '<input class="input" placeholder="Membre 1"><input class="input" placeholder="Membre 2"><input class="input" placeholder="Membre 3">'+
    '</div>'+
    '<div class="onboard__actions">'+
      '<button class="ghost" id="obMore">+ Un membre de plus</button>'+
      '<button class="add-btn" id="obCreate">Créer le catalogue</button>'+
    '</div></div></div>';
  $("#obMore").onclick=function(){ var i=document.createElement("input"); i.className="input";
    i.placeholder="Membre "+($("#obFields").children.length+1); $("#obFields").appendChild(i); };
  $("#obCreate").onclick=function(){
    var names=[].map.call($("#obFields").querySelectorAll("input"),function(i){return i.value.trim();}).filter(Boolean);
    if(!names.length) return;
    var rows=names.map(function(n,i){ return {id:uid(),name:n,color:MEMBER_COLORS[i%MEMBER_COLORS.length]}; });
    db.from("members").insert(rows).then(function(r){
      if(r.error){ flash("Erreur : "+r.error.message); return; }
      loadMembers().then(function(){ state.active=state.members[0].id; LSraw.set("cat_active",state.active); renderApp(); });
    });
  };
}

/* =============================== Squelette ============================== */
function renderApp(){
  $("#app").innerHTML='<div class="app-root">'+
    '<header class="topbar">'+
      '<div class="brand"><div class="brand__mark">'+
        '<svg viewBox="0 0 512 512" width="38" height="38" aria-hidden="true">'+
          '<rect width="512" height="512" rx="112" fill="var(--gold)"/>'+
          '<path d="M256 101 L293.6 204.2 L403.4 208.1 L316.9 275.8 L347.1 381.4 L256 320 L164.9 381.4 L195.1 275.8 L108.6 208.1 L218.4 204.2 Z" fill="#fff"/>'+
        '</svg></div>'+
        '<div><input class="brand__title" id="titleInput" spellcheck="false" title="Clique pour renommer">'+
          '<div class="brand__sub" id="subLine"></div></div></div>'+
      '<div class="topbar__right">'+
        '<div class="whoami"><span class="whoami__label">C\'est toi&nbsp;:</span><div class="who-chips" id="whoChips"></div></div>'+
        '<button class="icon-btn" id="btnTheme" title="Thème / couleurs">🎨</button>'+
        '<button class="icon-btn" id="btnMembers" title="Membres de la famille">👥</button>'+
      '</div>'+
    '</header>'+
    '<div class="viewtabs" id="viewtabs">'+
      '<button data-view="catalogue">Cartes</button>'+
      '<button data-view="compact">Liste</button>'+
      '<button data-view="stats">Statistiques</button>'+
    '</div>'+
    '<div id="content"></div>'+
    '<footer class="foot">Données partagées en temps réel via Supabase.<span class="livedot" id="liveDot"></span>&nbsp;·&nbsp;<button class="reconf" id="backupLink">Sauvegardes</button></footer>'+
  '</div>';
  var ti=$("#titleInput"); ti.value=state.title;
  ti.addEventListener("input",function(e){ state.title=e.target.value; updateSub(); });
  ti.addEventListener("blur",function(){ db.from("settings").upsert({key:"title",value:state.title}); });
  $("#btnMembers").onclick=openMembersModal;
  var tb=$("#btnTheme"); if(tb){ tb.textContent="🎨"; tb.onclick=openThemeMenu; }
  var bkl=$("#backupLink"); if(bkl) bkl.onclick=openBackupModal;
  [].forEach.call($("#viewtabs").querySelectorAll("button"),function(b){ b.onclick=function(){ state.view=b.dataset.view; renderContent(); }; });
  updateSub(); renderWhoami(); renderContent();
}
function setLive(on){ var d=$("#liveDot"); if(d) d.classList.toggle("on",!!on); }
function updateSub(){ var n=state.entries.length; var s=$("#subLine"); if(s) s.textContent="Journal partagé — "+n+" fiche"+(n>1?"s":""); }

function renderWhoami(){
  var c=$("#whoChips"); if(!c) return; c.innerHTML="";
  state.members.forEach(function(m){ var b=document.createElement("button"); b.className="who-chip"+(m.id===state.active?" is-on":""); b.textContent=m.name;
    if(m.id===state.active){ b.style.background=m.color; b.style.borderColor=m.color; b.style.color="#fff"; } else { b.style.color=m.color; b.style.borderColor=m.color; }
    b.onclick=function(){ state.active=m.id; LSraw.set("cat_active",m.id); renderWhoami(); if($("#listArea")) renderList(); }; c.appendChild(b); });
}

/* =============================== Contenu =============================== */
function renderContent(){
  var tabs=$("#viewtabs"); if(tabs) [].forEach.call(tabs.querySelectorAll("button"),function(b){ b.classList.toggle("is-on",b.dataset.view===state.view); });
  var content=$("#content"); if(!content) return;
  if(state.view==="stats"){ content.innerHTML=""; content.appendChild(renderStats()); return; }
  content.innerHTML=
    '<section class="stats" id="statsStrip"></section>'+
    '<div class="toolbar">'+
      '<div class="search"><span>🔎</span><input id="searchInput" placeholder="Rechercher un titre, un mot de la critique…"></div>'+
      '<select class="select" id="fStatus"></select>'+
      '<select class="select" id="fMember"></select>'+
      '<select class="select" id="fGenre"></select>'+
      '<select class="select" id="fMinNote"></select>'+
      '<select class="select" id="sortSel"></select>'+
      '<select class="select" id="groupSel"></select>'+
      '<button class="fav-toggle" id="favToggle" title="N\'afficher que mes coups de cœur">♡ Coups de cœur</button>'+
      '<button class="fav-toggle" id="watchToggle" title="N\'afficher que mes envies à voir">👁 À voir</button>'+
      '<button class="fav-toggle" id="viewsBtn" title="Vues enregistrées">★ Vues</button>'+
      '<button class="add-btn" id="addBtn">+ Ajouter</button>'+
    '</div>'+
    '<div id="listArea"></div>';
  var si=$("#searchInput"); si.value=state.query; si.addEventListener("input",function(e){ state.query=e.target.value; renderList(); });
  fillSelect($("#fStatus"), [["all","Tous les statuts"]].concat(STATUSES.map(function(s){return [s.id,s.label];})), state.fStatus, function(v){ state.fStatus=v; renderList(); });
  fillSelect($("#fMember"), [["all","Tout le monde"]].concat(state.members.map(function(m){return [m.id,m.name];})), state.fMember, function(v){ state.fMember=v; renderList(); });
  var gset={}; state.entries.forEach(function(e){ (e.genres||[]).forEach(function(g){ gset[g]=true; }); });
  var glist=Object.keys(gset).sort(function(a,b){return a.localeCompare(b,"fr");});
  if(state.fGenre!=="all" && glist.indexOf(state.fGenre)<0) state.fGenre="all";
  fillSelect($("#fGenre"), [["all","Tous les genres"]].concat(glist.map(function(g){return [g,g];})), state.fGenre, function(v){ state.fGenre=v; renderList(); });
  fillSelect($("#sortSel"), [["recent","Plus récents"],["rating","Mieux notés"],["az","A → Z"],["year","Année (récent)"],["author","Par auteur"]], state.sort, function(v){ state.sort=v; renderList(); });
  fillSelect($("#groupSel"), [["none","Sans regroupement"],["type","Grouper par type"],["member","Grouper par personne"]], state.group, function(v){ state.group=v; renderList(); });
  fillSelect($("#fMinNote"), [["0","Toutes les notes"],["5","≥ 5/10"],["6","≥ 6/10"],["7","≥ 7/10"],["8","≥ 8/10"],["9","≥ 9/10"]], String(state.fMinNote), function(v){ state.fMinNote=parseFloat(v)||0; renderList(); });
  var vb=$("#viewsBtn"); if(vb) vb.onclick=openViewsMenu;
  var wt=$("#watchToggle"); if(wt){ wt.className="fav-toggle"+(state.watchOnly?" is-on-watch":""); wt.onclick=function(){ state.watchOnly=!state.watchOnly; wt.className="fav-toggle"+(state.watchOnly?" is-on-watch":""); renderList(); }; }
  $("#addBtn").onclick=function(){ openEntryModal(null); };
  var ft=$("#favToggle"); if(ft){ ft.className="fav-toggle"+(state.favOnly?" is-on":""); ft.textContent=(state.favOnly?"❤":"♡")+" Coups de cœur"; ft.onclick=function(){ state.favOnly=!state.favOnly; ft.className="fav-toggle"+(state.favOnly?" is-on":""); ft.textContent=(state.favOnly?"❤":"♡")+" Coups de cœur"; renderList(); }; }
  renderStatsStrip(); renderList(); updateRecent();
}
function renderList(){ if(state.view==="compact") renderCompact(); else renderGrid(); }
function fillSelect(sel,options,value,onChange){ sel.innerHTML="";
  options.forEach(function(pair){ var o=document.createElement("option"); o.value=pair[0]; o.textContent=pair[1]; sel.appendChild(o); });
  sel.value=value; sel.onchange=function(){ onChange(sel.value); }; }

function renderStatsStrip(){
  var strip=$("#statsStrip"); if(!strip) return;
  var counts={}; TYPES.forEach(function(t){ counts[t.id]=0; }); state.entries.forEach(function(e){ if(counts[e.type]!=null) counts[e.type]++; });
  strip.innerHTML="";
  var _tv=(THEMES[state.theme]||THEMES.clair).vars;
  var total=document.createElement("button"); total.className="stat stat--total"+(state.fType==="all"?" is-on":"");
  total.innerHTML='<span class="stat__num">'+state.entries.length+'</span><span class="stat__lbl">Tout</span>';
  if(state.fType==="all"){ total.style.background=_tv.gold; total.style.borderColor=_tv.gold; total.querySelector(".stat__num").style.color="#241a05"; total.querySelector(".stat__lbl").style.color="rgba(36,26,5,.8)"; }
  else { total.querySelector(".stat__num").style.color=_tv.ink; }
  total.onclick=function(){ state.fType="all"; renderStatsStrip(); renderList(); }; strip.appendChild(total);
  TYPES.forEach(function(t){ var b=document.createElement("button"); b.className="stat"+(state.fType===t.id?" is-on":"");
    if(state.fType===t.id){ b.style.borderColor=t.color; b.style.background=t.color; } else { b.style.setProperty("--c",t.color); }
    b.innerHTML='<span class="stat__num">'+counts[t.id]+'</span><span class="stat__lbl">'+t.icon+' '+t.plural+'</span>';
    b.querySelector(".stat__num").style.color=(state.fType===t.id)?"#fff":_tv.ink;
    b.onclick=function(){ state.fType=state.fType===t.id?"all":t.id; renderStatsStrip(); renderList(); }; strip.appendChild(b); });
}
function relTime(ts){ if(!ts) return ""; var s=(Date.now()-ts)/1000; if(s<60) return "à l'instant"; var m=s/60; if(m<60) return "il y a "+Math.floor(m)+" min"; var h=m/60; if(h<24) return "il y a "+Math.floor(h)+" h"; var d=h/24; if(d<7) return "il y a "+Math.floor(d)+" j"; return new Date(ts).toLocaleDateString("fr-FR"); }
function actLine(a){
  var actor=memberById(a.member_id); var t=typeMeta(a.entry_type||"film");
  var verb = a.action==="add"?"a ajouté" : a.action==="rate"?"a noté" : a.action==="delete"?"a supprimé" : "a modifié";
  var note=(a.rating && (a.action==="rate"||a.action==="add"))? " · "+nfr(Number(a.rating))+"/10":"";
  var when=a.ts? relTime(new Date(a.ts).getTime()):"";
  return { entryId:a.entry_id, action:a.action,
    html:'<span class="rfeed__av" style="background:'+(actor?actor.color:'#888')+'">'+(actor?esc(actor.name.slice(0,1).toUpperCase()):'?')+'</span>'+
      '<span class="rfeed__txt"><b>'+(actor?esc(actor.name):'?')+'</b> '+verb+' '+t.icon+' '+esc(a.entry_title||"")+note+'</span>'+
      '<span class="rfeed__time">'+when+'</span>' };
}
function renderRecent(){
  var rows;
  if(state.activity && state.activity.length){ rows=state.activity.slice(0,2).map(actLine); }
  else {
    var items=state.entries.slice().filter(function(e){return e.createdAt;}).sort(function(a,b){return (b.createdAt||0)-(a.createdAt||0);}).slice(0,2);
    rows=items.map(function(e){ var m=memberById(e.memberId); var t=typeMeta(e.type); var note=e.rating?" · "+nfr(e.rating)+"/10":"";
      return { entryId:e.id, action:"add", html:'<span class="rfeed__av" style="background:'+(m?m.color:'#888')+'">'+(m?esc(m.name.slice(0,1).toUpperCase()):'?')+'</span><span class="rfeed__txt"><b>'+(m?esc(m.name):'?')+'</b> a ajouté '+t.icon+' '+esc(e.title)+note+'</span><span class="rfeed__time">'+relTime(e.createdAt)+'</span>' }; });
  }
  if(!rows.length) return null;
  var box=document.createElement("div"); box.className="recent"; box.id="recentBox";
  box.innerHTML='<p class="recent__h">Activité récente <button class="reconf" id="journalLink">voir tout</button></p><div class="recent__list"></div>';
  var jl=box.querySelector("#journalLink"); if(jl) jl.onclick=openJournalModal;
  var listEl=box.querySelector(".recent__list");
  rows.forEach(function(r){ var el=document.createElement("div"); el.className="rfeed"; el.innerHTML=r.html;
    if(r.action!=="delete"){ el.onclick=function(){ var e=state.entries.find(function(x){return x.id===r.entryId;}); if(e) openDetailModal(e); }; } else { el.style.cursor="default"; }
    listEl.appendChild(el); });
  return box;
}
function updateRecent(){
  var content=$("#content"); if(!content) return;
  if(state.view!=="catalogue" && state.view!=="compact"){ var o0=$("#recentBox"); if(o0) o0.remove(); return; }
  var nf=renderRecent(); var old=$("#recentBox");
  if(nf){ if(old) old.replaceWith(nf); else content.insertBefore(nf, content.firstChild); }
  else if(old){ old.remove(); }
}
function memberById(id){ return state.members.find(function(m){return m.id===id;}); }
function isFav(e){ return Array.isArray(e.favorites) && state.active && e.favorites.indexOf(state.active)>=0; }
function toggleFav(e){
  if(!state.active){ flash("Choisis d'abord qui tu es (en haut)."); return; }
  var favs=Array.isArray(e.favorites)?e.favorites.slice():[];
  var i=favs.indexOf(state.active); if(i>=0) favs.splice(i,1); else favs.push(state.active);
  e.favorites=favs;
  var idx=state.entries.findIndex(function(x){return x.id===e.id;}); if(idx>=0) state.entries[idx].favorites=favs;
  refreshAfterData();
  db.from("entries").update({favorites:favs}).eq("id",e.id).then(function(r){ if(r.error) flash("Erreur : "+r.error.message); });
}
function isWatch(e){ return Array.isArray(e.watchers) && state.active && e.watchers.indexOf(state.active)>=0; }
function watchCount(e){ return Array.isArray(e.watchers)?e.watchers.length:0; }
function toggleWatch(e){
  if(!state.active){ flash("Choisis d'abord qui tu es (en haut)."); return; }
  var ws=Array.isArray(e.watchers)?e.watchers.slice():[];
  var i=ws.indexOf(state.active); if(i>=0) ws.splice(i,1); else ws.push(state.active);
  e.watchers=ws;
  var idx=state.entries.findIndex(function(x){return x.id===e.id;}); if(idx>=0) state.entries[idx].watchers=ws;
  refreshAfterData();
  db.from("entries").update({watchers:ws}).eq("id",e.id).then(function(r){ if(r.error) flash("Erreur : "+r.error.message); });
}

function visibleEntries(){
  var list=state.entries.slice();
  if(state.fType!=="all") list=list.filter(function(e){return e.type===state.fType;});
  if(state.fMember!=="all") list=list.filter(function(e){return e.memberId===state.fMember;});
  if(state.fStatus!=="all") list=list.filter(function(e){return (e.status||"done")===state.fStatus;});
  if(state.fGenre!=="all") list=list.filter(function(e){return Array.isArray(e.genres)&&e.genres.indexOf(state.fGenre)>=0;});
  if(state.fMinNote>0) list=list.filter(function(e){return (e.rating||0)>=state.fMinNote;});
  if(state.favOnly) list=list.filter(function(e){return isFav(e);});
  if(state.watchOnly) list=list.filter(function(e){return isWatch(e);});
  var q=state.query.trim().toLowerCase();
  if(q) list=list.filter(function(e){ return (e.title||"").toLowerCase().indexOf(q)>=0 || (e.review||"").toLowerCase().indexOf(q)>=0 || ((memberById(e.memberId)||{}).name||"").toLowerCase().indexOf(q)>=0; });
  if(state.sort==="recent") list.sort(function(a,b){ return (b.createdAt||0)-(a.createdAt||0); });
  if(state.sort==="rating") list.sort(function(a,b){ return (b.rating||0)-(a.rating||0)||(b.createdAt||0)-(a.createdAt||0); });
  if(state.sort==="az") list.sort(function(a,b){ return (a.title||"").localeCompare(b.title||"","fr"); });
  if(state.sort==="year") list.sort(function(a,b){ return ((parseInt(b.year,10)||0)-(parseInt(a.year,10)||0))||(b.createdAt||0)-(a.createdAt||0); });
  if(state.sort==="author") list.sort(function(a,b){ return (((memberById(a.memberId)||{}).name||"").localeCompare(((memberById(b.memberId)||{}).name||""),"fr"))||(a.title||"").localeCompare(b.title||"","fr"); });
  return list;
}
function entryCardEl(e){
  var t=typeMeta(e.type), m=memberById(e.memberId), st=statusMeta(e.status||"done");
  var foot=e.status==="doing"?"En cours":e.status==="todo"?"À voir":"";
  var cover=e.hasCover&&state.covers[e.id]?'<div class="cover" style="background:'+t.color+'18"><img src="'+state.covers[e.id]+'" alt=""></div>':"";
  var badge=(e.status&&e.status!=="done")?'<span class="status-chip" style="color:'+st.color+';border-color:'+st.color+'">'+st.icon+' '+st.label+'</span>':"";
  var avatar="";
  var raters=(Array.isArray(e.ratings)?e.ratings.filter(function(x){return x.r>0;}).length:0);
  var score=e.rating?'<span class="note-badge">'+nfr(e.rating)+'<span class="note-badge__out">/10</span></span>'+(raters>1?'<span class="raters-chip">'+raters+' notes</span>':''):'<span class="card__score card__score--none">non noté</span>';
  var year=e.year?'<span class="card__year"> · '+esc(e.year)+'</span>':"";
  var isSer=(e.type==="serie"||e.type==="anime"); var seasons=Array.isArray(e.seasons)?e.seasons:[];
  var doneChip=(isSer&&e.status==="done")?'<span class="status-chip" style="color:#3F7A3A;border-color:#3F7A3A">✓ Terminée</span>':"";
  var seasonStrip=(isSer&&seasons.length)?'<div class="season-strip">'+seasons.map(function(s){ var k=seasonKind(s); var lab = k==="oav" ? ("OAV"+(s.name?" "+esc(s.name):"")) : k==="film" ? ("Film"+(s.name?" "+esc(s.name):"")) : /^\d+$/.test(String(s.n))?("S"+esc(s.n)):esc(s.n); return '<span class="season-chip">'+lab+(s.rating?'&nbsp;·&nbsp;'+nfr(s.rating):'')+'</span>'; }).join("")+'</div>':"";
  var fav=isFav(e);
  var card=document.createElement("article"); card.className="card card--click"; card.style.setProperty("--c",t.color);
  card.innerHTML='<div class="card__spine"></div><div class="card__body">'+cover+
    '<div class="card__top"><span class="pill" style="color:'+t.color+';border-color:'+t.color+'">'+t.icon+' '+t.label+'</span>'+
      '<div class="card__badges">'+badge+doneChip+'<button class="fav-btn watch-btn'+(isWatch(e)?' is-on':'')+'" data-act="watch" title="À voir / envie">👁</button><button class="fav-btn'+(fav?' is-on':'')+'" data-act="fav" title="Coup de cœur">'+(fav?'❤':'♡')+'</button>'+avatar+'</div></div>'+
    '<h3 class="card__title">'+esc(e.title)+year+'</h3>'+
    '<div class="card__rating">'+score+'</div>'+seasonStrip+
    '<div class="card__foot"><span>'+foot+'</span>'+
      '<span class="card__actions"><button data-act="edit" title="Modifier">✎</button><button data-act="del" title="Supprimer">🗑</button></span></div></div>';
  card.querySelector('[data-act="fav"]').onclick=function(ev){ ev.stopPropagation(); toggleFav(e); };
  var wb=card.querySelector('[data-act="watch"]'); if(wb) wb.onclick=function(ev){ ev.stopPropagation(); toggleWatch(e); };
  card.querySelector('[data-act="edit"]').onclick=function(ev){ ev.stopPropagation(); openEntryModal(e); };
  card.querySelector('[data-act="del"]').onclick=function(ev){ ev.stopPropagation(); deleteEntry(e); };
  var av=card.querySelector('[data-act="member"]'); if(av) av.onclick=function(ev){ ev.stopPropagation(); openMemberModal(e.memberId); };
  card.addEventListener("click",function(){ openDetailModal(e); });
  return card;
}
function groupsOf(list){
  if(state.group==="type") return TYPES.map(function(t){ return {label:t.icon+" "+t.plural,color:t.color,items:list.filter(function(e){return e.type===t.id;})}; }).filter(function(g){return g.items.length;});
  if(state.group==="member"){ var gs=state.members.map(function(m){ return {label:m.name,color:m.color,items:list.filter(function(e){return e.memberId===m.id;})}; }).filter(function(g){return g.items.length;});
    var orphan=list.filter(function(e){return !memberById(e.memberId);}); if(orphan.length) gs.push({label:"Sans membre",color:"#6E6676",items:orphan}); return gs; }
  return [{label:null,items:list}];
}
function groupHeadEl(g){ var h=document.createElement("div"); h.className="group-head"; h.innerHTML=(g.color?'<span class="group-dot" style="background:'+g.color+'"></span>':"")+esc(g.label)+' <span class="group-count">'+g.items.length+'</span>'; return h; }
function emptyArea(area){ area.innerHTML='<div class="empty"><div class="empty__ico">🗂️</div><p>Rien ici pour l\'instant.</p></div>';
  var btn=document.createElement("button"); btn.className="add-btn"; btn.textContent="Ajouter la première fiche"; btn.onclick=function(){ openEntryModal(null); }; area.querySelector(".empty").appendChild(btn); }
function renderGrid(){
  var area=$("#listArea"); if(!area) return;
  var list=visibleEntries();
  if(list.length===0){ emptyArea(area); return; }
  area.innerHTML="";
  groupsOf(list).forEach(function(g){
    if(g.label) area.appendChild(groupHeadEl(g));
    var grid=document.createElement("div"); grid.className="grid";
    g.items.forEach(function(e){ grid.appendChild(entryCardEl(e)); });
    area.appendChild(grid);
  });
}
function entryRowEl(e){
  var t=typeMeta(e.type), m=memberById(e.memberId), st=statusMeta(e.status||"done");
  var thumb=e.hasCover&&state.covers[e.id]
    ? '<span class="crow__thumb"><img src="'+state.covers[e.id]+'" alt=""></span>'
    : '<span class="crow__thumb crow__thumb--ph" style="background:'+t.color+'22;color:'+t.color+'">'+t.icon+'</span>';
  var badge=(e.status&&e.status!=="done")?'<span class="status-chip" style="color:'+st.color+';border-color:'+st.color+'">'+st.icon+' '+st.label+'</span>':"";
  var avatar="";
  var year=e.year?'<span class="crow__year"> · '+esc(e.year)+'</span>':"";
  var season=((e.type==="serie"||e.type==="anime")&&Array.isArray(e.seasons)&&e.seasons.length)?'<span class="crow__year"> · '+e.seasons.length+' saison'+(e.seasons.length>1?'s':'')+'</span>':"";
  var score=e.rating?'<span class="crow__score"><b>'+nfr(e.rating)+'</b>/10</span>':'<span class="crow__score crow__score--none">non noté</span>';
  var row=document.createElement("div"); row.className="crow"; row.style.setProperty("--c",t.color);
  row.innerHTML=thumb+
    '<span class="crow__main"><span class="crow__title">'+esc(e.title)+season+year+'</span>'+
      '<span class="crow__meta"><span class="crow__type" style="color:'+t.color+'">'+t.icon+' '+t.label+'</span>'+badge+score+'</span></span>'+
    '<span class="crow__right"><button class="fav-btn watch-btn'+(isWatch(e)?' is-on':'')+'" data-act="watch" title="À voir / envie">👁</button><button class="fav-btn'+(isFav(e)?' is-on':'')+'" data-act="fav" title="Coup de cœur">'+(isFav(e)?'❤':'♡')+'</button>'+avatar+
      '<span class="crow__actions"><button data-act="edit" title="Modifier">✎</button><button data-act="del" title="Supprimer">🗑</button></span></span>';
  row.querySelector('[data-act="fav"]').onclick=function(ev){ ev.stopPropagation(); toggleFav(e); };
  var rwb=row.querySelector('[data-act="watch"]'); if(rwb) rwb.onclick=function(ev){ ev.stopPropagation(); toggleWatch(e); };
  row.querySelector('[data-act="edit"]').onclick=function(ev){ ev.stopPropagation(); openEntryModal(e); };
  row.querySelector('[data-act="del"]').onclick=function(ev){ ev.stopPropagation(); deleteEntry(e); };
  var rav=row.querySelector('[data-act="member"]'); if(rav) rav.onclick=function(ev){ ev.stopPropagation(); openMemberModal(e.memberId); };
  row.addEventListener("click",function(){ openDetailModal(e); });
  return row;
}
function renderCompact(){
  var area=$("#listArea"); if(!area) return;
  var list=visibleEntries();
  if(list.length===0){ emptyArea(area); return; }
  area.innerHTML="";
  groupsOf(list).forEach(function(g){
    if(g.label) area.appendChild(groupHeadEl(g));
    var wrap=document.createElement("div"); wrap.className="clist";
    g.items.forEach(function(e){ wrap.appendChild(entryRowEl(e)); });
    area.appendChild(wrap);
  });
}
function deleteEntry(entry){
  if(!confirm("Supprimer cette fiche ?")) return;
  state.entries=state.entries.filter(function(e){return e.id!==entry.id;}); delete state.covers[entry.id];
  logActivity("delete", {id:entry.id, type:entry.type, title:entry.title}, null);
  refreshAfterData();
  db.from("entries").delete().eq("id",entry.id).then(function(r){ if(r.error) flash("Erreur de suppression : "+r.error.message); });
}
function refreshAfterData(){
  updateSub();
  if(state.view==="stats"){ var c=$("#content"); if(c){ c.innerHTML=""; c.appendChild(renderStats()); } }
  else { renderStatsStrip(); renderList(); updateRecent(); }
  backupNow();
}

/* ============================ Statistiques ============================== */
function renderStats(){
  var wrap=document.createElement("div"); wrap.className="statsview";
  if(state.entries.length===0){ wrap.innerHTML='<div class="empty"><div class="empty__ico">📊</div><p>Ajoute des fiches pour voir apparaître les statistiques.</p></div>'; return wrap; }
  var year=new Date().getFullYear();
  var rated=state.entries.filter(function(e){return e.rating>0;});
  var overallAvg=rated.length?rated.reduce(function(s,e){return s+e.rating;},0)/rated.length:0;
  var thisYear=state.entries.filter(function(e){return new Date(e.createdAt||0).getFullYear()===year;});
  function memberName(id){ return (state.members.find(function(m){return m.id===id;})||{}).name||"?"; }
  var perMember=state.members.map(function(m){ var given=[]; state.entries.forEach(function(e){ var mr=myRating(e,m.id); if(mr&&mr.r>0) given.push(mr.r); });
    return {id:m.id,name:m.name,color:m.color,count:given.length,avg:given.length?given.reduce(function(s,r){return s+r;},0)/given.length:0}; }).sort(function(a,b){return b.count-a.count;});
  var maxMember=Math.max.apply(null,[1].concat(perMember.map(function(p){return p.count;})));
  var perType=TYPES.map(function(t){ var es=state.entries.filter(function(e){return e.type===t.id;}); var r=es.filter(function(e){return e.rating>0;});
    return {icon:t.icon,plural:t.plural,color:t.color,count:es.length,avg:r.length?r.reduce(function(s,e){return s+e.rating;},0)/r.length:0}; }).filter(function(t){return t.count>0;}).sort(function(a,b){return b.count-a.count;});
  var maxType=Math.max.apply(null,[1].concat(perType.map(function(t){return t.count;})));
  function inWho(e){ return state.who==="all"||e.memberId===state.who; }
  var rateCount=function(e){ return Array.isArray(e.ratings)?e.ratings.filter(function(x){return x.r>0;}).length:0; };
  function podium(items){ return items.length===0?'<p class="muted">Aucune note pour l\'instant.</p>'
    :'<ol class="podium">'+items.map(function(e){ var t=typeMeta(e.type); var c=rateCount(e);
      return '<li class="podium__click" data-id="'+e.id+'"><span class="podium__dot" style="background:'+t.color+'">'+t.icon+'</span><span class="podium__title">'+esc(e.title)+'</span><span class="podium__by">'+(c>1?(c+' notes'):(c===1?'1 note':''))+'</span><span class="podium__rate"><b>'+nfr(e.rating)+'</b>/10</span></li>'; }).join("")+'</ol>'; }
  var topAll=rated.filter(inWho).sort(function(a,b){return b.rating-a.rating||(b.createdAt||0)-(a.createdAt||0);}).slice(0,5);
  var topYear=thisYear.filter(function(e){return e.rating>0&&inWho(e);}).sort(function(a,b){return b.rating-a.rating||(b.createdAt||0)-(a.createdAt||0);}).slice(0,5);
  var whoLabel=state.who!=="all"?" · "+esc(memberName(state.who)):"";
  var collective=rated.filter(function(e){ return rateCount(e)>=1; }).sort(function(a,b){return b.rating-a.rating||rateCount(b)-rateCount(a)||(b.createdAt||0)-(a.createdAt||0);}).slice(0,10);
  var disagree=state.entries.map(function(e){ var ns=(e.ratings||[]).filter(function(x){return x.r>0;}).map(function(x){return x.r;}); if(ns.length<2) return null; var mn=Math.min.apply(null,ns), mx=Math.max.apply(null,ns); return {e:e, mn:mn, mx:mx, spread:mx-mn}; }).filter(function(o){return o&&o.spread>0;}).sort(function(a,b){return b.spread-a.spread;}).slice(0,8);
  var bestNote=state.entries.reduce(function(a,e){return e.rating>a?e.rating:a;},0);
  var now=new Date(); var months=[];
  for(var mi=11;mi>=0;mi--){ var dd=new Date(now.getFullYear(),now.getMonth()-mi,1); months.push({y:dd.getFullYear(),mo:dd.getMonth(),label:dd.toLocaleDateString("fr-FR",{month:"short"}).replace(".",""),count:0,sum:0,rc:0}); }
  state.entries.forEach(function(e){ if(!e.createdAt) return; var d=new Date(e.createdAt); for(var k=0;k<months.length;k++){ if(d.getFullYear()===months[k].y && d.getMonth()===months[k].mo){ months[k].count++; if(e.rating>0){ months[k].sum+=e.rating; months[k].rc++; } break; } } });
  var maxMonth=Math.max.apply(null,[1].concat(months.map(function(x){return x.count;})));
  var favType=state.members.map(function(m){ var mine=state.entries.filter(function(e){return e.memberId===m.id;}); if(!mine.length) return null; var cnt={}; mine.forEach(function(e){ cnt[e.type]=(cnt[e.type]||0)+1; }); var best=null,bc=0; TYPES.forEach(function(t){ if((cnt[t.id]||0)>bc){ bc=cnt[t.id]; best=t; } }); return best?{m:m,best:best,bc:bc}:null; }).filter(Boolean);
  var ratedAll=state.entries.filter(function(e){return e.rating>0;});
  var bestE=null,worstE=null; ratedAll.forEach(function(e){ if(!bestE||e.rating>bestE.rating) bestE=e; if(!worstE||e.rating<worstE.rating) worstE=e; });
  var cmp=state.members.map(function(m){ var given=[]; state.entries.forEach(function(e){ var mr=myRating(e,m.id); if(mr&&mr.r>0) given.push(mr.r); }); var mx=given.reduce(function(a,r){return r>a?r:a;},0); var av=given.length?given.reduce(function(a,r){return a+r;},0)/given.length:0; var fv=state.entries.filter(function(e){return Array.isArray(e.favorites)&&e.favorites.indexOf(m.id)>=0;}).length; return {m:m,count:given.length,avg:av,max:mx,fav:fv}; });
  var genreStats={}; state.entries.forEach(function(e){ (e.genres||[]).forEach(function(g){ if(!genreStats[g]) genreStats[g]={n:0,sum:0,rc:0}; genreStats[g].n++; if(e.rating>0){ genreStats[g].sum+=e.rating; genreStats[g].rc++; } }); });
  var genreArr=Object.keys(genreStats).map(function(g){ var s=genreStats[g]; return {g:g,n:s.n,avg:s.rc?s.sum/s.rc:0}; }).sort(function(a,b){return b.n-a.n||b.avg-a.avg;}).slice(0,12);
  var maxGenre=Math.max.apply(null,[1].concat(genreArr.map(function(x){return x.n;})));
  wrap.innerHTML=
    '<div class="bignums">'+
      '<div class="bignum"><span class="bignum__n">'+state.entries.length+'</span><span class="bignum__l">fiches au total</span></div>'+
      '<div class="bignum"><span class="bignum__n">'+thisYear.length+'</span><span class="bignum__l">ajoutées en '+year+'</span></div>'+
      '<div class="bignum"><span class="bignum__n">'+(overallAvg?avg1(overallAvg):"—")+'</span><span class="bignum__l">note moyenne /10</span></div>'+
      '<div class="bignum"><span class="bignum__n">'+(bestNote?nfr(bestNote):"—")+'</span><span class="bignum__l">meilleure note /10</span></div>'+
      '<div class="bignum"><span class="bignum__n">'+state.members.length+'</span><span class="bignum__l">membres</span></div>'+
    '</div>'+
    '<div class="stats-filter"><span>Palmarès par personne&nbsp;:</span><select class="select" id="whoSel"></select></div>'+
    '<div class="panels">'+
      '<section class="panel panel--wide"><h3 class="panel__h">🏆 Palmarès de la famille <span class="opt">(classées par la note moyenne)</span></h3>'+(collective.length?'<ol class="podium">'+collective.map(function(e){ var t=typeMeta(e.type); var c=rateCount(e); return '<li class="podium__click" data-id="'+e.id+'"><span class="podium__dot" style="background:'+t.color+'">'+t.icon+'</span><span class="podium__title">'+esc(e.title)+'</span><span class="podium__by">'+c+(c>1?' notes':' note')+'</span><span class="podium__rate"><b>'+nfr(e.rating)+'</b>/10</span></li>'; }).join("")+'</ol>':'<p class="muted">Aucune note pour l\'instant.</p>')+'</section>'+
      '<section class="panel panel--wide"><h3 class="panel__h">💥 Désaccords de la famille <span class="opt">(avis les plus divergents)</span></h3>'+(disagree.length?disagree.map(function(o){ var t=typeMeta(o.e.type); return '<div class="dis-row podium__click" data-id="'+o.e.id+'"><span class="podium__dot" style="background:'+t.color+'">'+t.icon+'</span><span class="dis-title">'+esc(o.e.title)+'</span><span class="dis-range">de '+nfr(o.mn)+' à '+nfr(o.mx)+'</span><span class="dis-spread">écart '+nfr(o.spread)+'</span></div>'; }).join(""):'<p class="muted">Aucun désaccord pour l\'instant — il faut au moins deux notes différentes sur une même œuvre.</p>')+'</section>'+
      '<section class="panel"><h3 class="panel__h">Classement des membres</h3>'+perMember.map(function(p){ return '<div class="brow brow--click" data-mid="'+p.id+'"><span class="brow__name"><span class="dot" style="background:'+p.color+'"></span>'+esc(p.name)+'</span><div class="bar"><span style="width:'+(p.count/maxMember*100)+'%;background:'+p.color+'"></span></div><span class="brow__val">'+p.count+'</span><span class="brow__avg">'+(p.avg?avg1(p.avg)+"/10":"—")+'</span></div>'; }).join("")+'</section>'+
      '<section class="panel"><h3 class="panel__h">Répartition par type</h3>'+perType.map(function(t){ return '<div class="brow"><span class="brow__name">'+t.icon+' '+t.plural+'</span><div class="bar"><span style="width:'+(t.count/maxType*100)+'%;background:'+t.color+'"></span></div><span class="brow__val">'+t.count+'</span><span class="brow__avg">'+(t.avg?avg1(t.avg)+"/10":"—")+'</span></div>'; }).join("")+'</section>'+
      '<section class="panel"><h3 class="panel__h">🏆 Mieux notées'+(state.who!=="all"?whoLabel:" — depuis toujours")+'</h3>'+podium(topAll)+'</section>'+
      '<section class="panel"><h3 class="panel__h">✨ Top de '+year+whoLabel+'</h3>'+podium(topYear)+'</section>'+
      '<section class="panel"><h3 class="panel__h">Ajouts par mois</h3><div class="months">'+months.map(function(x){ return '<div class="mcol"><div class="mcol__wrap"><div class="mcol__bar" style="height:'+(x.count/maxMonth*100)+'%"></div></div><div class="mcol__n">'+x.count+'</div><div class="mcol__l">'+esc(x.label)+'</div></div>'; }).join("")+'</div></section>'+
      '<section class="panel"><h3 class="panel__h">Type préféré par personne</h3>'+(favType.length?favType.map(function(o){ return '<div class="brow2"><span class="brow__name"><span class="dot" style="background:'+o.m.color+'"></span>'+esc(o.m.name)+'</span><span class="fav-type" style="color:'+o.best.color+'">'+o.best.icon+' '+o.best.plural+'</span><span class="brow__val">'+o.bc+'</span></div>'; }).join(""):'<p class="muted">—</p>')+'</section>'+
      '<section class="panel"><h3 class="panel__h">Note moyenne par mois</h3><div class="months">'+months.map(function(x){ var a=x.rc?x.sum/x.rc:0; return '<div class="mcol"><div class="mcol__wrap"><div class="mcol__bar mcol__bar--gold" style="height:'+(a/10*100)+'%"></div></div><div class="mcol__n">'+(a?avg1(a):"–")+'</div><div class="mcol__l">'+esc(x.label)+'</div></div>'; }).join("")+'</div></section>'+
      '<section class="panel"><h3 class="panel__h">Records</h3>'+(bestE?'<div class="rec-row"><span class="rec-medal">🥇</span><span class="rec-txt">'+typeMeta(bestE.type).icon+' '+esc(bestE.title)+'</span><b>'+nfr(bestE.rating)+'/10</b></div>':'<p class="muted">Aucune note pour l\'instant.</p>')+((worstE&&worstE!==bestE)?'<div class="rec-row"><span class="rec-medal">🥉</span><span class="rec-txt">'+typeMeta(worstE.type).icon+' '+esc(worstE.title)+'</span><b>'+nfr(worstE.rating)+'/10</b></div>':'')+'</section>'+
      '<section class="panel"><h3 class="panel__h">Comparaison des membres</h3><div class="cmp"><div class="cmp__head"><span>Membre</span><span>Notes</span><span>Moy.</span><span>Max</span><span>❤</span></div>'+cmp.map(function(o){ return '<div class="cmp__row"><span class="brow__name"><span class="dot" style="background:'+o.m.color+'"></span>'+esc(o.m.name)+'</span><span>'+o.count+'</span><span>'+(o.avg?avg1(o.avg):"—")+'</span><span>'+(o.max?nfr(o.max):"—")+'</span><span>'+o.fav+'</span></div>'; }).join("")+'</div></section>'+
      '<section class="panel panel--wide"><h3 class="panel__h">Genres de la famille <span class="opt">(nombre de fiches · note moyenne)</span></h3>'+(genreArr.length?genreArr.map(function(o){ return '<div class="brow"><span class="brow__name">'+esc(o.g)+'</span><div class="bar"><span style="width:'+(o.n/maxGenre*100)+'%;background:var(--gold)"></span></div><span class="brow__val">'+o.n+'</span><span class="brow__avg">'+(o.avg?avg1(o.avg)+"/10":"—")+'</span></div>'; }).join(""):'<p class="muted">Ajoute des genres à tes fiches (recherche automatique ou champ « Genres ») pour voir ces statistiques.</p>')+'</section>'+
    '</div>';
  fillSelect(wrap.querySelector("#whoSel"), [["all","Tout le monde"]].concat(state.members.map(function(m){return [m.id,m.name];})), state.who, function(v){ state.who=v; renderContent(); });
  [].forEach.call(wrap.querySelectorAll(".brow--click[data-mid]"),function(el){ el.onclick=function(){ openMemberModal(el.getAttribute("data-mid")); }; });
  [].forEach.call(wrap.querySelectorAll(".podium__click[data-id]"),function(el){ el.onclick=function(){ var e=state.entries.find(function(x){return x.id===el.getAttribute("data-id");}); if(e) openDetailModal(e); }; });
  return wrap;
}

/* ============================ Modale fiche ============================= */
function openEntryModal(entry){
  var isEdit=!!entry;
  var form={ id:entry?entry.id:null, type:entry?entry.type:(state.fType==="all"?"film":state.fType),
    title:entry?entry.title||"":"", year:entry?entry.year||"":"", synopsis:entry?entry.synopsis||"":"", genres:(entry&&Array.isArray(entry.genres))?entry.genres.slice():[], memberId:entry?entry.memberId:state.active,
    rating:0, review:"", status:entry?entry.status||"done":"done", hasCover:entry?!!entry.hasCover:false,
    ratings:(entry&&Array.isArray(entry.ratings))?entry.ratings.map(function(x){return {m:x.m,r:x.r,rev:x.rev};}):[],
    seasons:(entry&&Array.isArray(entry.seasons))?entry.seasons.map(function(s){return {n:s.n,rating:s.rating,review:s.review,kind:s.kind,name:s.name};}):[] };
  var _mine = entry ? myRating(entry, state.active) : null; form.rating = _mine?(_mine.r||0):0; form.review = _mine?(_mine.rev||""):"";
  var coverValue=(entry&&entry.hasCover)?(state.covers[entry.id]||null):null; var coverChanged=false;

  var overlay=document.createElement("div"); overlay.className="overlay";
  overlay.innerHTML='<div class="modal">'+
    '<div class="modal__head"><h2>'+(isEdit?"Modifier la fiche":"Nouvelle fiche")+'</h2><button class="x" data-x>✕</button></div>'+
    '<label class="field__label">Type</label><div class="type-picker" id="typePick"></div>'+
    '<div class="row"><div class="field" style="flex:3"><label class="field__label">Titre</label><input class="input" id="fTitle" placeholder="Titre de l\'œuvre"></div>'+
      '<div class="field" style="flex:1"><label class="field__label">Année</label><input class="input" id="fYear" placeholder="2024" inputmode="numeric"></div></div>'+
    '<div class="dup-warn" id="dupWarn"></div>'+
    '<div class="tmdb-search"><button type="button" class="ghost" id="searchBtn">🔍 Rechercher le titre</button><span class="tmdb-hint" id="searchHint"></span></div>'+
    '<div class="search-results" id="searchResults"></div>'+
    '<div class="field"><label class="field__label">Genres / étiquettes <span class="opt">(séparés par des virgules)</span></label><input class="input" id="fGenres" placeholder="Action, Comédie…"></div>'+
    '<div class="field" id="statusField"><label class="field__label">Statut</label><div class="type-picker" id="statusPick"></div></div>'+
    '<div class="field" id="finishedField"><label class="field__label">Diffusion</label><button type="button" class="toggle-btn" id="finishedBtn"></button></div>'+
    '<div class="field" id="famNotesField"><label class="field__label">Notes de la famille</label><div class="fam-notes" id="famNotes"></div></div>'+
    '<div class="field" id="noteField"><label class="field__label" id="noteLabel">Note sur 10 <span class="opt">(facultatif)</span></label><select class="input" id="noteSel"></select></div>'+
    '<div id="seasonsWrap" class="seasons-wrap"></div>'+
    '<label class="field__label">Affiche / pochette <span class="opt">(facultatif)</span></label>'+
    '<div class="coverbox"><div class="coverbox__preview" id="coverPrev"></div>'+
      '<div class="coverbox__ctrl"><label class="ghost file-btn"><span id="fileLbl">Choisir une image</span><input type="file" accept="image/*" id="coverInput" hidden></label>'+
        '<button class="clear-rating" id="coverClear" style="display:none">retirer l\'image</button>'+
        '<p class="tiny">L\'image est réduite automatiquement pour l\'enregistrement.</p></div></div>'+
    '<div class="field"><label class="field__label" id="reviewLabel">Critique</label><textarea class="input textarea" id="fReview" rows="4" placeholder="Ton avis, un mot, un ressenti…"></textarea></div>'+
    '<div class="modal__foot"><button class="ghost" data-x>Annuler</button><button class="add-btn" id="saveBtn">'+(isEdit?"Enregistrer":"Ajouter au catalogue")+'</button></div></div>';
  document.body.appendChild(overlay);
  var modal=overlay.querySelector(".modal"); function setAccent(c){ modal.style.setProperty("--c",c); }

  var typePick=overlay.querySelector("#typePick");
  function drawTypes(){ typePick.innerHTML=""; TYPES.forEach(function(ty){ var b=document.createElement("button"); b.type="button"; b.className="type-opt"+(form.type===ty.id?" is-on":""); b.textContent=ty.icon+" "+ty.label;
    if(form.type===ty.id){ b.style.background=ty.color; b.style.borderColor=ty.color; b.style.color="#fff"; } else { b.style.color=ty.color; b.style.borderColor=ty.color; }
    b.onclick=function(){ form.type=ty.id; setAccent(ty.color); drawTypes(); updateTypeUI(); if(!coverValue) drawCover(); }; typePick.appendChild(b); }); }
  drawTypes(); setAccent(typeMeta(form.type).color);

  function isSeries(){ return form.type==="serie"||form.type==="anime"; }

  // Statut (types simples)
  var statusField=overlay.querySelector("#statusField");
  var statusPick=overlay.querySelector("#statusPick");
  function drawStatus(){ statusPick.innerHTML=""; STATUSES.forEach(function(s){ var b=document.createElement("button"); b.type="button"; b.className="type-opt"+(form.status===s.id?" is-on":""); b.textContent=s.icon+" "+s.label;
    if(form.status===s.id){ b.style.background=s.color; b.style.borderColor=s.color; b.style.color="#fff"; } else { b.style.color=s.color; b.style.borderColor=s.color; }
    b.onclick=function(){ form.status=s.id; drawStatus(); }; statusPick.appendChild(b); }); }
  drawStatus();
  var genEl=overlay.querySelector("#fGenres");
  genEl.value=(form.genres||[]).join(", ");
  genEl.oninput=function(e){ form.genres=e.target.value.split(",").map(function(s){return s.trim();}).filter(Boolean); };
  var finishedField=overlay.querySelector("#finishedField");
  var finishedBtn=overlay.querySelector("#finishedBtn");
  function drawFinished(){ var on=form.status==="done"; finishedBtn.className="toggle-btn"+(on?" is-on":""); finishedBtn.textContent=on?"✓ Série terminée":"Série en cours de diffusion"; }
  finishedBtn.onclick=function(){ form.status=(form.status==="done")?"doing":"done"; drawFinished(); };
  drawFinished();

  var tEl=overlay.querySelector("#fTitle"); tEl.value=form.title; tEl.oninput=function(e){ form.title=e.target.value; saveBtn.disabled=!form.title.trim(); checkDup(); };
  var dupWarn=overlay.querySelector("#dupWarn");
  function normTitle(s){ return (s||"").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/\s+/g," ").trim(); }
  function checkDup(){
    dupWarn.innerHTML=""; var q=normTitle(form.title); if(!q) return;
    var matches=state.entries.filter(function(x){ return x.id!==form.id && normTitle(x.title)===q; });
    if(!matches.length) return;
    var x=matches[0], t=typeMeta(x.type), m=memberById(x.memberId);
    dupWarn.innerHTML='<span class="dup-warn__txt">⚠ Déjà dans le catalogue : '+t.icon+' '+esc(x.title)+(x.year?' ('+esc(x.year)+')':'')+(m?' · '+esc(m.name):'')+(matches.length>1?' <b>+'+(matches.length-1)+'</b>':'')+'</span><button type="button" class="dup-warn__see">Voir</button>';
    dupWarn.querySelector(".dup-warn__see").onclick=function(){ openDetailModal(x); };
  }
  checkDup();
  var yEl=overlay.querySelector("#fYear"); yEl.value=form.year; yEl.oninput=function(e){ form.year=e.target.value.replace(/[^0-9]/g,"").slice(0,4); yEl.value=form.year; };
  form.memberId = entry?entry.memberId:state.active;
  function buildFamNotes(){ var el=overlay.querySelector("#famNotes"); if(!el) return;
    var others=(form.ratings||[]).filter(function(x){ return x.m!==state.active && x.r>0; });
    if(!others.length){ el.innerHTML='<span class="muted">Personne d\'autre n\'a encore noté cette œuvre.</span>'; return; }
    el.innerHTML=others.map(function(x){ var m=memberById(x.m); return '<span class="fam-note"><span class="avatar avatar--sm" style="background:'+(m?m.color:'#888')+'">'+(m?esc(m.name.slice(0,1).toUpperCase()):'?')+'</span>'+(m?esc(m.name):'?')+' <b>'+nfr(x.r)+'</b>/10</span>'; }).join("");
  }
  buildFamNotes();
  var rev=overlay.querySelector("#fReview"); rev.value=form.review; rev.oninput=function(e){ form.review=e.target.value; };
  var reviewLabel=overlay.querySelector("#reviewLabel");

  // Note (menu déroulant) : note simple pour les types classiques,
  // note GLOBALE (prioritaire sur la moyenne des saisons) pour séries/animes
  var noteField=overlay.querySelector("#noteField");
  var noteLabel=overlay.querySelector("#noteLabel");
  var noteSel=overlay.querySelector("#noteSel");
  noteSel.innerHTML=noteOptionsHTML(0);
  noteSel.onchange=function(){ form.rating=noteSel.value?parseFloat(noteSel.value):0; };

  // Gestionnaire de saisons (séries/animes)
  var seasonsWrap=overlay.querySelector("#seasonsWrap");
  function seasonAvg(){ return seasonsAverage(form.seasons); }
  function buildSeasons(){
    seasonsWrap.innerHTML='<label class="field__label">Saisons <span class="opt">(note et critique par saison)</span></label>';
    var list=document.createElement("div"); list.className="seasons-list";
    form.seasons.forEach(function(s,idx){
      var kind=seasonKind(s); var special=(kind==="oav"||kind==="film");
      var row=document.createElement("div"); row.className="season-row";
      var head = special
        ? '<span class="season-tag season-tag--'+kind+'">'+(kind==="oav"?"OAV":"Film")+'</span>'
        : '<input class="input season-n" value="'+esc(s.n)+'" placeholder="1">';
      var nameLine = special
        ? '<input class="input season-name" value="'+esc(s.name||"")+'" placeholder="Nom de l\'OAV / du film (facultatif)">'
        : '';
      row.innerHTML=
        '<div class="season-row__head">'+head+
          '<select class="input season-note">'+noteOptionsHTML(s.rating)+'</select>'+
          '<button type="button" class="x small season-del" title="Retirer">✕</button></div>'+
        nameLine+
        '<textarea class="input textarea season-rev" rows="2" placeholder="Critique…">'+esc(s.review||"")+'</textarea>';
      var nEl=row.querySelector(".season-n"); if(nEl) nEl.oninput=function(e){ s.n=e.target.value.slice(0,12); };
      var nmEl=row.querySelector(".season-name"); if(nmEl) nmEl.oninput=function(e){ s.name=e.target.value.slice(0,80); };
      row.querySelector(".season-note").onchange=function(e){ s.rating=e.target.value?parseFloat(e.target.value):0; updateAvg(); };
      row.querySelector(".season-rev").oninput=function(e){ s.review=e.target.value; };
      row.querySelector(".season-del").onclick=function(){ form.seasons.splice(idx,1); buildSeasons(); };
      list.appendChild(row);
    });
    seasonsWrap.appendChild(list);
    function nextNum(){ var c=0; form.seasons.forEach(function(s){ if(seasonKind(s)==="season") c++; }); return String(c+1); }
    function mkAdd(label, make){ var b=document.createElement("button"); b.type="button"; b.className="ghost"; b.textContent=label; b.onclick=function(){ form.seasons.push(make()); buildSeasons(); }; return b; }
    var addRow=document.createElement("div"); addRow.className="season-addrow";
    addRow.appendChild(mkAdd("+ Saison", function(){ return {n:nextNum(),rating:0,review:"",kind:"season"}; }));
    if(form.type==="anime"){
      addRow.appendChild(mkAdd("+ OAV", function(){ return {n:"OAV",rating:0,review:"",kind:"oav"}; }));
      addRow.appendChild(mkAdd("+ Film", function(){ return {n:"Film",rating:0,review:"",kind:"film"}; }));
    }
    seasonsWrap.appendChild(addRow);
    var avgLine=document.createElement("div"); avgLine.className="season-avg"; avgLine.id="seasonAvg"; seasonsWrap.appendChild(avgLine);
    updateAvg();
  }
  function updateAvg(){ var el=overlay.querySelector("#seasonAvg"); if(!el) return; var a=seasonAvg(); el.textContent=a?("Moyenne des saisons : "+avg1(a)+"/10 — tu peux la reporter dans ta note ci-dessus."):"Notes par saison (facultatif)."; }

  function updateTypeUI(){
    var series=isSeries();
    statusField.style.display=series?"none":"";
    finishedField.style.display=series?"":"none";
    noteField.style.display="";
    seasonsWrap.style.display=series?"":"none";
    var meName=(memberById(state.active)||{}).name||"toi";
    reviewLabel.textContent="Ta critique ("+meName+")";
    noteLabel.innerHTML = 'Ta note ('+esc(meName)+') <span class="opt">sur 10 — facultatif</span>';
    noteSel.value = String(form.rating||"");
    if(series) buildSeasons();
  }
  updateTypeUI();

  var prev=overlay.querySelector("#coverPrev"); var coverClear=overlay.querySelector("#coverClear"); var fileLbl=overlay.querySelector("#fileLbl");
  function drawCover(){ var t=typeMeta(form.type);
    if(coverValue){ prev.style.background=""; prev.innerHTML='<img src="'+coverValue+'" alt="">'; coverClear.style.display=""; }
    else { prev.style.background=t.color+"14"; prev.innerHTML='<span class="coverbox__ph">'+t.icon+'</span>'; coverClear.style.display="none"; } }
  drawCover();
  overlay.querySelector("#coverInput").addEventListener("change",function(e){ var file=e.target.files&&e.target.files[0]; if(!file) return;
    fileLbl.textContent="Traitement…"; fileToThumb(file).then(function(data){ coverValue=data; coverChanged=true; drawCover(); fileLbl.textContent="Choisir une image"; }).catch(function(){ alert("Impossible de lire cette image."); fileLbl.textContent="Choisir une image"; }); });
  coverClear.onclick=function(){ coverValue=null; coverChanged=true; drawCover(); };

  function close(){ overlay.remove(); }
  overlay.addEventListener("mousedown",function(e){ if(e.target===overlay) close(); });
  [].forEach.call(overlay.querySelectorAll("[data-x]"),function(b){ b.onclick=close; });
  var saveBtn=overlay.querySelector("#saveBtn"); saveBtn.disabled=!form.title.trim();
  saveBtn.onclick=function(){
    var title=form.title.trim(); if(!title) return;
    var id=form.id; var isNew=!(id&&state.entries.find(function(e){return e.id===id;})); if(isNew) id=uid();
    var series=isSeries();
    var seasonsClean = series ? form.seasons.map(function(s){ return {n:(s.n||"").toString(), rating:s.rating||0, review:(s.review||""), kind:seasonKind(s), name:(s.name||"")}; }).filter(function(s){ return s.n || s.rating || s.review || s.name; }) : [];
    var meId=state.active;
    /* fusion-notes-collectives : on repart TOUJOURS des notes les plus à jour
       présentes dans l'appli, pour ne jamais écraser celles des autres membres */
    var _cur=state.entries.find(function(x){return x.id===id;});
    var _base=(_cur&&Array.isArray(_cur.ratings)&&_cur.ratings.length)?_cur.ratings.slice():(form.ratings||[]);
    var ratings=_base.filter(function(x){ return x && x.m && x.m!==meId; });
    if((form.rating||0)>0 || (form.review&&form.review.trim())) ratings.push({m:meId, r:form.rating||0, rev:form.review||""});
    var ratingVal = ratingsAverage(ratings);
    var row={ id:id, type:form.type, title:title, year:form.year||null, synopsis:form.synopsis||null, genres:(form.genres&&form.genres.length?form.genres:null), member_id:(isNew?meId:(entry?entry.memberId:meId))||null, rating:ratingVal, ratings:ratings, review:null, status:form.status, seasons: series?seasonsClean:null };
    if(coverChanged) row.cover=coverValue||null;
    if(isNew) row.created_at=new Date().toISOString();
    saveBtn.disabled=true; saveBtn.textContent="Enregistrement…";
    db.from("entries").upsert(row).then(function(r){
      if(r.error){ flash("Erreur : "+r.error.message); saveBtn.disabled=false; saveBtn.textContent=isEdit?"Enregistrer":"Ajouter au catalogue"; return; }
      var localEntry={ id:id, type:form.type, title:title, year:form.year||"", synopsis:form.synopsis||"", genres:(form.genres||[]).slice(), seasons:series?seasonsClean:[], memberId:row.member_id, rating:ratingVal, ratings:ratings, review:"", status:form.status,
        hasCover: coverChanged?!!coverValue:form.hasCover, createdAt: isNew?Date.now():(entry.createdAt||Date.now()), favorites:(entry&&Array.isArray(entry.favorites))?entry.favorites:[] };
      var i=state.entries.findIndex(function(e){return e.id===id;}); if(i>=0) state.entries[i]=localEntry; else state.entries.unshift(localEntry);
      if(coverChanged){ if(coverValue) state.covers[id]=coverValue; else delete state.covers[id]; }
      var act = isNew?"add":"rate";
      logActivity(act, {id:id, type:form.type, title:title}, (form.rating||0)>0?form.rating:null);
      close(); refreshAfterData();
    });
  };
  var searchBtn=overlay.querySelector("#searchBtn"); var searchHint=overlay.querySelector("#searchHint"); var searchResults=overlay.querySelector("#searchResults");
  function applyResult(res){
    if(res.title){ form.title=res.title; tEl.value=res.title; saveBtn.disabled=!form.title.trim(); }
    if(res.year){ form.year=res.year; yEl.value=res.year; }
    form.synopsis=res.synopsis||"";
    if(res.genres&&res.genres.length){ form.genres=res.genres.slice(); genEl.value=form.genres.join(", "); }
    if(res.cover){ coverValue=res.cover; coverChanged=true; drawCover(); }
    searchResults.innerHTML=""; searchHint.textContent="Rempli ✓"; checkDup();
    if((form.type==="livre"||form.type==="manga") && !form.synopsis && res.key){
      searchHint.textContent="Récupération du résumé…";
      fetchOLDesc(res.key).then(function(d){ if(d){ form.synopsis=d; searchHint.textContent="Rempli ✓ (résumé inclus)"; } else searchHint.textContent="Rempli ✓"; }).catch(function(){ searchHint.textContent="Rempli ✓"; });
    }
  }
  function runSearch(){
    var q=(form.title||"").trim(); if(!q){ searchHint.textContent="Écris d'abord un titre."; return; }
    searchResults.innerHTML=""; searchHint.textContent="Recherche…";
    searchTitle(form.type,q).then(function(list){
      if(!list.length){ searchHint.textContent="Aucun résultat."; return; }
      searchHint.textContent="";
      list.forEach(function(res){
        var it=document.createElement("button"); it.type="button"; it.className="sres";
        it.innerHTML='<span class="sres__thumb">'+(res.cover?'<img src="'+res.cover+'" alt="">':'<span class="sres__ph">—</span>')+'</span>'+
          '<span class="sres__info"><span class="sres__title">'+esc(res.title)+(res.year?' <span class="sres__year">('+esc(res.year)+')</span>':'')+'</span>'+(res.sub?'<span class="sres__sub">'+esc(res.sub)+'</span>':'')+'</span>';
        it.onclick=function(){ applyResult(res); };
        searchResults.appendChild(it);
      });
    }).catch(function(err){
      var msg=(err&&err.message)||"erreur";
      if(msg==="no-key") searchHint.textContent="Ajoute ta clé TMDB dans config.js pour les films, séries et animes.";
      else searchHint.textContent="Recherche indisponible ("+msg+").";
    });
  }
  searchBtn.onclick=runSearch;
  setTimeout(function(){ tEl.focus(); },30);
}

/* ============================ Vue détail =============================== */
function openDetailModal(e){
  var t=typeMeta(e.type), m=memberById(e.memberId);
  var isSer=(e.type==="serie"||e.type==="anime"); var seasons=Array.isArray(e.seasons)?e.seasons:[];
  var cover = e.hasCover&&state.covers[e.id]
    ? '<div class="detail-cover"><img src="'+state.covers[e.id]+'" alt=""></div>'
    : '<div class="detail-cover detail-cover--ph" style="background:'+t.color+'18;color:'+t.color+'">'+t.icon+'</div>';
  var meta=[]; if(e.year) meta.push(esc(e.year));
  meta.push(isSer ? (e.status==="done"?"Série terminée":"En cours de diffusion") : statusMeta(e.status||"done").label);
  var rlist=(e.ratings||[]).filter(function(x){ return x.r>0 || (x.rev&&(""+x.rev).trim()); });
  var raters=rlist.filter(function(x){return x.r>0;}).length;
  var score = e.rating? '<span class="note-badge">'+nfr(e.rating)+'<span class="note-badge__out">/10</span></span>'+(raters>1?'<span class="detail-raters">moyenne de '+raters+' notes</span>':'') : '<span class="card__score card__score--none">non noté</span>';
  var body="";
  if(isSer){
    var sHTML = seasons.length ? seasons.map(function(s){ var k=seasonKind(s);
      var lab = k==="oav"?("OAV"+(s.name?" — "+esc(s.name):"")) : k==="film"?("Film"+(s.name?" — "+esc(s.name):"")) : (/^\d+$/.test(String(s.n))?("Saison "+esc(s.n)):esc(s.n));
      var note = s.rating? '<span class="dseason__note">'+nfr(s.rating)+'/10</span>' : '<span class="dseason__note dseason__note--none">non noté</span>';
      return '<div class="dseason"><div class="dseason__head"><span class="dseason__name">'+lab+'</span>'+note+'</div>'+(s.review?'<p class="dseason__rev">'+esc(s.review)+'</p>':'')+'</div>';
    }).join("") : "";
    if(sHTML) body += '<div class="detail-block"><h4 class="detail-h">Saisons et contenus</h4>'+sHTML+'</div>';
  }
  var notesHTML = rlist.length ? rlist.map(function(x){ var mm=memberById(x.m);
      return '<div class="dnote"><div class="dnote__head"><span class="dnote__who"><span class="avatar avatar--sm" style="background:'+(mm?mm.color:'#888')+'">'+(mm?esc(mm.name.slice(0,1).toUpperCase()):'?')+'</span>'+(mm?esc(mm.name):'?')+'</span>'+(x.r?'<span class="dnote__note">'+nfr(x.r)+'/10</span>':'<span class="dnote__note dnote__note--none">—</span>')+'<button class="dnote__del" data-delnote="'+esc(x.m)+'" title="Supprimer cette note">✕</button></div>'+(x.rev?'<p class="dnote__rev">'+esc(x.rev)+'</p>':'')+'</div>';
    }).join("") : '<p class="muted">Personne n\'a encore noté. Sélectionne « C\'est toi » en haut, puis « Modifier » pour ajouter ta note.</p>';
  body += '<div class="detail-block"><h4 class="detail-h">Notes de la famille</h4>'+notesHTML+'</div>';
  if(e.synopsis) body = '<div class="detail-block"><h4 class="detail-h">Résumé</h4><p class="detail-review">'+esc(e.synopsis)+'</p></div>' + body;
  var overlay=document.createElement("div"); overlay.className="overlay";
  overlay.innerHTML='<div class="modal detail" style="--c:'+t.color+'">'+
    '<div class="modal__head"><h2>'+esc(e.title)+'</h2><button class="x" data-x>✕</button></div>'+
    '<div class="detail-top">'+cover+
      '<div class="detail-info"><span class="pill" style="color:'+t.color+';border-color:'+t.color+'">'+t.icon+' '+t.label+'</span>'+
        '<div class="detail-meta">'+meta.join(" · ")+'</div>'+
        ((Array.isArray(e.genres)&&e.genres.length)?'<div class="genre-tags">'+e.genres.map(function(g){return '<span class="genre-tag">'+esc(g)+'</span>';}).join("")+'</div>':'')+
        '<div class="detail-score">'+score+'</div></div></div>'+
    body+
    '<div class="modal__foot detail-foot"><button class="ghost danger" id="dDel">Supprimer</button><span class="spacer"></span><button class="ghost" data-x>Fermer</button><button class="add-btn" id="dEdit">Modifier</button></div>'+
  '</div>';
  document.body.appendChild(overlay);
  function close(){ overlay.remove(); }
  overlay.addEventListener("mousedown",function(ev){ if(ev.target===overlay) close(); });
  [].forEach.call(overlay.querySelectorAll("[data-x]"),function(b){ b.onclick=close; });
  overlay.querySelector("#dEdit").onclick=function(){ close(); openEntryModal(e); };
  overlay.querySelector("#dDel").onclick=function(){ close(); deleteEntry(e); };
  [].forEach.call(overlay.querySelectorAll("[data-delnote]"),function(b){ b.onclick=function(ev){ ev.stopPropagation(); if(!confirm("Supprimer cette note ?")) return; removeRating(e, b.getAttribute("data-delnote")); close(); var fresh=state.entries.find(function(x){return x.id===e.id;}); if(fresh) openDetailModal(fresh); }; });
}
function removeRating(entry, mid){
  var ratings=(entry.ratings||[]).filter(function(x){ return x.m!==mid; });
  var avg=ratingsAverage(ratings);
  entry.ratings=ratings; entry.rating=avg;
  var i=state.entries.findIndex(function(x){return x.id===entry.id;}); if(i>=0){ state.entries[i].ratings=ratings; state.entries[i].rating=avg; }
  refreshAfterData();
  if(db) db.from("entries").update({ratings:ratings, rating:avg}).eq("id",entry.id).then(function(r){ if(r.error) flash("Erreur : "+r.error.message); }, function(){});
}

/* =========================== Journal complet ========================= */
function openJournalModal(){
  var overlay=document.createElement("div"); overlay.className="overlay";
  overlay.innerHTML='<div class="modal">'+
    '<div class="modal__head"><h2>Journal complet</h2><button class="x" data-x>✕</button></div>'+
    '<div class="field"><label class="field__label">Filtrer par personne</label><select class="input" id="jFilter"></select></div>'+
    '<div class="j-list" id="jList"><p class="muted">Chargement…</p></div>'+
    '<div class="modal__foot"><button class="ghost" data-x>Fermer</button></div></div>';
  document.body.appendChild(overlay);
  function close(){ overlay.remove(); }
  overlay.addEventListener("mousedown",function(ev){ if(ev.target===overlay) close(); });
  [].forEach.call(overlay.querySelectorAll("[data-x]"),function(b){ b.onclick=close; });
  var jList=overlay.querySelector("#jList"); var all=[];
  var filter=overlay.querySelector("#jFilter");
  fillSelect(filter, [["all","Tout le monde"]].concat(state.members.map(function(m){return [m.id,m.name];})), "all", function(){ render(); });
  function render(){
    var who=filter.value; var rows=all.filter(function(a){ return who==="all"||a.member_id===who; });
    if(!rows.length){ jList.innerHTML='<p class="muted">Aucune action enregistrée.</p>'; return; }
    jList.innerHTML="";
    rows.slice(0,300).forEach(function(a){ var r=actLine(a); var el=document.createElement("div"); el.className="rfeed"; el.innerHTML=r.html;
      if(r.action!=="delete"){ el.onclick=function(){ var e=state.entries.find(function(x){return x.id===r.entryId;}); if(e){ close(); openDetailModal(e); } }; } else el.style.cursor="default";
      jList.appendChild(el); });
  }
  if(db){ db.from("activity").select("*").order("ts",{ascending:false}).limit(300).then(function(res){ all=(res&&res.data)||[]; render(); }, function(){ all=state.activity.slice(); render(); }); }
  else { all=state.activity.slice(); render(); }
}

/* =========================== Page membre ============================= */
function openMemberModal(id){
  var m=memberById(id); if(!m) return;
  var mine=state.entries.filter(function(e){ var mr=myRating(e,id); return mr&&(mr.r>0||(mr.rev&&(""+mr.rev).trim())); });
  var given=[]; mine.forEach(function(e){ var mr=myRating(e,id); if(mr&&mr.r>0) given.push(mr.r); });
  var avg=given.length? avg1(given.reduce(function(a,r){return a+r;},0)/given.length):"—";
  var favs=state.entries.filter(function(e){return Array.isArray(e.favorites)&&e.favorites.indexOf(id)>=0;});
  var perType=TYPES.map(function(t){return {t:t,c:mine.filter(function(e){return e.type===t.id;}).length};}).filter(function(o){return o.c;});
  var recent=mine.slice().sort(function(a,b){return (b.createdAt||0)-(a.createdAt||0);}).slice(0,6);
  function line(e){ var t=typeMeta(e.type); var mr=myRating(e,id); return '<div class="mp-item" data-id="'+e.id+'"><span>'+t.icon+' '+esc(e.title)+'</span>'+((mr&&mr.r)?'<b>'+nfr(mr.r)+'/10</b>':'')+'</div>'; }
  var overlay=document.createElement("div"); overlay.className="overlay";
  overlay.innerHTML='<div class="modal" style="--c:'+m.color+'">'+
    '<div class="modal__head"><h2 class="mp-title"><span class="avatar" style="background:'+m.color+'">'+esc(m.name.slice(0,1).toUpperCase())+'</span> '+esc(m.name)+'</h2><button class="x" data-x>✕</button></div>'+
    '<div class="mp-stats">'+
      '<div class="mp-stat"><span class="mp-num">'+mine.length+'</span><span class="mp-lbl">œuvres notées</span></div>'+
      '<div class="mp-stat"><span class="mp-num">'+avg+'</span><span class="mp-lbl">note moy. /10</span></div>'+
      '<div class="mp-stat"><span class="mp-num">'+favs.length+'</span><span class="mp-lbl">coups de cœur</span></div>'+
    '</div>'+
    '<label class="field__label">Par type</label><div class="mp-types">'+(perType.length?perType.map(function(o){return '<span class="mp-type" style="border-color:'+o.t.color+';color:'+o.t.color+'">'+o.t.icon+' '+o.t.plural+' '+o.c+'</span>';}).join(""):'<span class="muted">—</span>')+'</div>'+
    '<label class="field__label">Coups de cœur</label><div class="mp-list">'+(favs.length?favs.slice(0,8).map(line).join(""):'<span class="muted">Aucun pour l\'instant.</span>')+'</div>'+
    '<label class="field__label">Derniers ajouts</label><div class="mp-list">'+(recent.length?recent.map(line).join(""):'<span class="muted">Rien pour l\'instant.</span>')+'</div>'+
    '<div class="modal__foot"><button class="ghost" data-x>Fermer</button></div></div>';
  document.body.appendChild(overlay);
  function close(){ overlay.remove(); }
  overlay.addEventListener("mousedown",function(ev){ if(ev.target===overlay) close(); });
  [].forEach.call(overlay.querySelectorAll("[data-x]"),function(b){ b.onclick=close; });
  [].forEach.call(overlay.querySelectorAll(".mp-item[data-id]"),function(el){ el.onclick=function(){ var e=state.entries.find(function(x){return x.id===el.getAttribute("data-id");}); if(e){ close(); openDetailModal(e); } }; });
}

/* =========================== Modale membres =========================== */
function openMembersModal(){
  var list=state.members.map(function(m){ return {id:m.id,name:m.name,color:m.color}; });
  var overlay=document.createElement("div"); overlay.className="overlay";
  overlay.innerHTML='<div class="modal">'+
    '<div class="modal__head"><h2>La famille</h2><button class="x" data-x>✕</button></div>'+
    '<p class="hint">Ajoute ou renomme les membres. Chacun a sa couleur.</p>'+
    '<div class="mlist" id="mlist"></div>'+
    '<div class="row" style="margin-top:14px"><input class="input" id="newMember" placeholder="Prénom d\'un nouveau membre"><button class="ghost" id="addMember">+ Ajouter</button></div>'+
    '<div class="modal__foot"><button class="ghost" data-x>Annuler</button><button class="add-btn" id="saveMembers">Enregistrer</button></div></div>';
  document.body.appendChild(overlay);
  var mlist=overlay.querySelector("#mlist");
  function draw(){ mlist.innerHTML=""; list.forEach(function(m){ var row=document.createElement("div"); row.className="mrow";
    var sw=document.createElement("div"); sw.className="swatches"; MEMBER_COLORS.forEach(function(c){ var b=document.createElement("button"); b.className="sw"+(m.color===c?" is-on":""); b.style.background=c; b.onclick=function(){ m.color=c; draw(); }; sw.appendChild(b); });
    var inp=document.createElement("input"); inp.className="input"; inp.value=m.name; inp.oninput=function(e){ m.name=e.target.value; };
    var del=document.createElement("button"); del.className="x small"; del.textContent="✕"; del.title="Retirer";
    del.onclick=function(){ var count=state.entries.filter(function(e){return e.memberId===m.id;}).length;
      if(count&&!confirm(count+" fiche(s) sont attribuées à cette personne. Les fiches resteront mais sans membre. Continuer ?")) return;
      if(list.length<=1){ alert("Il faut au moins un membre."); return; } list=list.filter(function(x){return x.id!==m.id;}); draw(); };
    row.appendChild(sw); row.appendChild(inp); row.appendChild(del); mlist.appendChild(row); }); }
  draw();
  var newInput=overlay.querySelector("#newMember");
  function add(){ var n=newInput.value.trim(); if(!n) return; var used=list.map(function(m){return m.color;}); var col=MEMBER_COLORS.find(function(c){return used.indexOf(c)<0;})||MEMBER_COLORS[list.length%MEMBER_COLORS.length];
    list.push({id:uid(),name:n,color:col}); newInput.value=""; draw(); }
  overlay.querySelector("#addMember").onclick=add;
  newInput.addEventListener("keydown",function(e){ if(e.key==="Enter") add(); });
  function close(){ overlay.remove(); }
  overlay.addEventListener("mousedown",function(e){ if(e.target===overlay) close(); });
  [].forEach.call(overlay.querySelectorAll("[data-x]"),function(b){ b.onclick=close; });
  overlay.querySelector("#saveMembers").onclick=function(){
    var cleaned=list.filter(function(m){return m.name.trim();}).map(function(m){ return {id:m.id,name:m.name.trim(),color:m.color}; });
    if(!cleaned.length){ alert("Il faut au moins un membre."); return; }
    var keep=cleaned.map(function(m){return m.id;}); var removed=state.members.filter(function(m){return keep.indexOf(m.id)<0;}).map(function(m){return m.id;});
    db.from("members").upsert(cleaned).then(function(up){
      if(up.error){ flash("Erreur : "+up.error.message); return; }
      var afterDel=removed.length?db.from("members").delete().in("id",removed):Promise.resolve();
      afterDel.then(function(){
        state.members=cleaned; if(!state.members.find(function(m){return m.id===state.active;})) state.active=state.members[0].id; LSraw.set("cat_active",state.active);
        close(); renderWhoami(); renderContent();
      });
    });
  };
}

/* ============================ Sauvegardes ============================= */
function snapshotText(){
  return { title:state.title,
    members:state.members.map(function(m){ return {id:m.id,name:m.name,color:m.color}; }),
    entries:state.entries.map(function(e){ return {id:e.id,type:e.type,title:e.title,year:e.year,memberId:e.memberId,rating:e.rating,review:e.review,status:e.status,seasons:e.seasons||[],createdAt:e.createdAt}; }) };
}
var backupTimer=null;
function backupNow(){ clearTimeout(backupTimer); backupTimer=setTimeout(function(){
  try{ var arr=LSraw.get("cat_backups",[]); if(!Array.isArray(arr)) arr=[]; arr.unshift({t:Date.now(),data:snapshotText()}); arr=arr.slice(0,3); LSraw.set("cat_backups",arr); }catch(e){}
},1500); }
function restoreSnapshot(snap){
  if(!snap||!snap.data||!db) return;
  if(!confirm("Restaurer cette sauvegarde ? Elle remplacera le contenu actuel de la base. (Les affiches ne sont pas incluses dans les sauvegardes automatiques.)")) return;
  var d=snap.data;
  var members=(d.members||[]).map(function(m){ return {id:m.id,name:m.name,color:m.color}; });
  var entries=(d.entries||[]).map(function(x){ return {id:x.id,type:x.type,title:x.title,year:x.year||null,member_id:x.memberId||null,rating:x.rating||0,review:x.review||null,status:x.status||"done",seasons:x.seasons||null,created_at:x.createdAt?new Date(x.createdAt).toISOString():null}; });
  flash("Restauration en cours…");
  db.from("entries").delete().neq("id","").then(function(){ return db.from("members").delete().neq("id",""); })
    .then(function(){ return members.length?db.from("members").insert(members):Promise.resolve(); })
    .then(function(r){ if(r&&r.error) throw r.error; return entries.length?db.from("entries").insert(entries):Promise.resolve(); })
    .then(function(r){ if(r&&r.error) throw r.error; return db.from("settings").upsert({key:"title",value:d.title||"Critik Famille"}); })
    .then(function(){ return loadAll(); })
    .then(function(){ state.active=state.members[0]?state.members[0].id:null; LSraw.set("cat_active",state.active); renderApp(); flash("Sauvegarde restaurée."); })
    .catch(function(err){ flash("Erreur de restauration : "+(err.message||err)); });
}
function openBackupModal(){
  var arr=LSraw.get("cat_backups",[]); if(!Array.isArray(arr)) arr=[];
  var rows=arr.length? arr.map(function(s,i){ var d=new Date(s.t); var when=d.toLocaleDateString("fr-FR")+" "+d.toLocaleTimeString("fr-FR",{hour:"2-digit",minute:"2-digit"}); var cnt=(s.data&&s.data.entries)?s.data.entries.length:0;
      return '<div class="bk-row"><span>'+when+' — '+cnt+' fiche'+(cnt>1?'s':'')+'</span><button class="ghost" data-restore="'+i+'">Restaurer</button></div>'; }).join("")
    : '<p class="muted">Aucune sauvegarde automatique pour l\'instant.</p>';
  var overlay=document.createElement("div"); overlay.className="overlay";
  overlay.innerHTML='<div class="modal">'+
    '<div class="modal__head"><h2>Sauvegardes</h2><button class="x" data-x>✕</button></div>'+
    '<p class="hint">Télécharge une sauvegarde complète (avec les affiches) à garder de ton côté, ou restaure une sauvegarde automatique récente.</p>'+
    '<button class="add-btn" id="bkDownload" style="width:100%;margin-bottom:16px">⬇ Télécharger une sauvegarde complète (.json)</button>'+
    '<label class="field__label">Sauvegardes automatiques <span class="opt">(sur cet appareil, texte seul)</span></label>'+
    '<div class="bk-list">'+rows+'</div>'+
    '<div class="modal__foot"><button class="ghost" data-x>Fermer</button></div></div>';
  document.body.appendChild(overlay);
  function close(){ overlay.remove(); }
  overlay.addEventListener("mousedown",function(ev){ if(ev.target===overlay) close(); });
  [].forEach.call(overlay.querySelectorAll("[data-x]"),function(b){ b.onclick=close; });
  overlay.querySelector("#bkDownload").onclick=function(){ doExport(); };
  [].forEach.call(overlay.querySelectorAll("[data-restore]"),function(b){ b.onclick=function(){ var s=arr[parseInt(b.getAttribute("data-restore"),10)]; if(s){ close(); restoreSnapshot(s); } }; });
}

/* ============================ Export / Import ========================== */
function doExport(){
  var data={ app:"catalogue-famille", version:3, exportedAt:new Date().toISOString(), title:state.title, members:state.members,
    entries:state.entries.map(function(e){ return {id:e.id,type:e.type,title:e.title,year:e.year,memberId:e.memberId,rating:e.rating,review:e.review,status:e.status,seasons:e.seasons||[],createdAt:e.createdAt}; }), covers:state.covers };
  var blob=new Blob([JSON.stringify(data)],{type:"application/json"}); var url=URL.createObjectURL(blob);
  var d=new Date(); var stamp=d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0")+"-"+String(d.getDate()).padStart(2,"0");
  var a=document.createElement("a"); a.href=url; a.download="catalogue-famille-"+stamp+".json"; a.click(); URL.revokeObjectURL(url); flash("Sauvegarde téléchargée.");
}
function handleImportFile(e){
  var file=e.target.files&&e.target.files[0]; e.target.value=""; if(!file||!db) return;
  var reader=new FileReader();
  reader.onload=function(){
    var data; try{ data=JSON.parse(reader.result); }catch(err){ alert("Fichier invalide."); return; }
    if(!data||!Array.isArray(data.entries)||!Array.isArray(data.members)){ alert("Ce fichier ne ressemble pas à une sauvegarde du catalogue."); return; }
    if(!confirm("Remplacer TOUT le contenu de la base par cette sauvegarde ? (pense à exporter avant si besoin)")) return;
    var members=data.members.map(function(m){ return {id:m.id,name:m.name,color:m.color}; });
    var entries=data.entries.map(function(x){ return { id:x.id,type:x.type,title:x.title,year:x.year||null,member_id:x.memberId||null,rating:x.rating||0,review:x.review||null,status:x.status||"done",
      cover:(data.covers&&data.covers[x.id])||null, created_at:x.createdAt?new Date(x.createdAt).toISOString():null }; });
    flash("Import en cours…");
    db.from("entries").delete().neq("id","").then(function(){ return db.from("members").delete().neq("id",""); }).then(function(){
      return members.length?db.from("members").insert(members):Promise.resolve();
    }).then(function(r){ if(r&&r.error) throw r.error; return entries.length?db.from("entries").insert(entries):Promise.resolve();
    }).then(function(r){ if(r&&r.error) throw r.error; return db.from("settings").upsert({key:"title",value:data.title||"Critik Famille"});
    }).then(function(){ return loadAll(); }).then(function(){
      state.active=state.members[0]?state.members[0].id:null; LSraw.set("cat_active",state.active);
      if(state.members.length===0) renderOnboarding(); else renderApp(); flash("Sauvegarde importée.");
    }).catch(function(err){ flash("Erreur d'import : "+(err.message||err)); });
  };
  reader.readAsText(file);
}

/* ============================== Realtime =============================== */
function subscribeRealtime(){
  if(!db) return;
  db.channel("cat-realtime")
    .on("postgres_changes",{event:"*",schema:"public",table:"entries"}, function(p){ handleEntryRT(p); })
    .on("postgres_changes",{event:"*",schema:"public",table:"members"}, function(){ resyncMembers(); })
    .on("postgres_changes",{event:"*",schema:"public",table:"settings"}, function(){ resyncSettings(); })
    .on("postgres_changes",{event:"INSERT",schema:"public",table:"activity"}, function(p){ var a=p.new; if(a && !state.activity.find(function(x){return x.id===a.id;})){ state.activity.unshift(a); state.activity=state.activity.slice(0,30); updateRecent(); } })
    .subscribe(function(status){ setLive(status==="SUBSCRIBED"); });
}
function handleEntryRT(p){
  if(p.eventType==="DELETE"){ var id=p.old&&p.old.id; if(id){ state.entries=state.entries.filter(function(e){return e.id!==id;}); delete state.covers[id]; } }
  else { var r=p.new; var e=rowToEntry(r); var i=state.entries.findIndex(function(x){return x.id===e.id;});
    if(i>=0) state.entries[i]=e; else state.entries.unshift(e);
    if(r.cover) state.covers[e.id]=r.cover; else delete state.covers[e.id]; }
  refreshAfterData();
}
function resyncMembers(){ loadMembers().then(function(){ if(!state.members.find(function(m){return m.id===state.active;})) state.active=state.members[0]?state.members[0].id:null; renderWhoami(); renderContent(); }); }
function resyncSettings(){ loadSettings().then(function(){ var ti=$("#titleInput"); if(ti && document.activeElement!==ti) ti.value=state.title; updateSub(); }); }
