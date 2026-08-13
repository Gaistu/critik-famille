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
function esc(s){ return String(s==null?"":s).replace(/[&<>"']/g,function(c){ return {"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]; }); }
function $(sel){ return document.querySelector(sel); }

var LSraw = {
  get:function(k,d){ try{ var v=localStorage.getItem(k); return v==null?d:JSON.parse(v); }catch(e){ return d; } },
  set:function(k,v){ try{ localStorage.setItem(k, JSON.stringify(v)); }catch(e){} },
  del:function(k){ try{ localStorage.removeItem(k); }catch(e){} },
};

/* =============================== État ================================== */
var state = {
  title:"Critik Famille", members:[], entries:[], covers:{},
  active:null, view:"catalogue",
  fType:"all", fStatus:"all", fMember:"all", query:"", sort:"recent", who:"all",
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
"  member_id text,\n"+
"  rating numeric default 0,\n"+
"  review text,\n"+
"  status text default 'done',\n"+
"  cover text,\n"+
"  created_at timestamptz default now()\n"+
");\n"+
"create table if not exists settings ( key text primary key, value text );\n\n"+
"alter table members  enable row level security;\n"+
"alter table entries  enable row level security;\n"+
"alter table settings enable row level security;\n\n"+
"-- Appli familiale : accès via la clé anon\n"+
"create policy \"anon members\" on members  for all to anon using (true) with check (true);\n"+
"create policy \"anon entries\" on entries  for all to anon using (true) with check (true);\n"+
"create policy \"anon settings\" on settings for all to anon using (true) with check (true);\n\n"+
"-- Synchronisation en temps réel\n"+
"alter publication supabase_realtime add table members, entries, settings;";

/* =============================== Feedback =============================== */
var bannerTimer=null;
function flash(msg){
  var b=$("#banner");
  if(!b){ b=document.createElement("div"); b.id="banner"; b.className="banner"; document.body.appendChild(b); }
  b.textContent=msg; clearTimeout(bannerTimer); bannerTimer=setTimeout(function(){ b.remove(); },3200);
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
  return { id:r.id, type:r.type, title:r.title, year:r.year||"", season:r.season||"", seasons:(Array.isArray(r.seasons)?r.seasons:[]), memberId:r.member_id,
    rating:Number(r.rating)||0, review:r.review||"", status:r.status||"done",
    hasCover:!!r.cover, createdAt:r.created_at?new Date(r.created_at).getTime():0 };
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

/* ================================ Init ================================= */
init();
function init(){
  if(!window.supabase || !window.supabase.createClient){
    renderConfigNeeded("La librairie Supabase n'a pas pu être chargée. Une connexion internet est nécessaire pour ouvrir le catalogue.");
    return;
  }
  if(!configReady()){ renderConfigNeeded(); return; }
  db=window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  loadAll().then(function(){
    state.active=LSraw.get("cat_active",null) || (state.members[0]&&state.members[0].id) || null;
    if(state.members.length===0) renderOnboarding(); else renderApp();
    subscribeRealtime();
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
      '<div class="brand"><div class="brand__mark">◈</div>'+
        '<div><input class="brand__title" id="titleInput" spellcheck="false" title="Clique pour renommer">'+
          '<div class="brand__sub" id="subLine"></div></div></div>'+
      '<div class="topbar__right">'+
        '<div class="whoami"><span class="whoami__label">C\'est toi&nbsp;:</span><div class="who-chips" id="whoChips"></div></div>'+
        '<button class="icon-btn" id="btnMembers" title="Membres de la famille">👥</button>'+
      '</div>'+
    '</header>'+
    '<div class="viewtabs" id="viewtabs">'+
      '<button data-view="catalogue">Cartes</button>'+
      '<button data-view="compact">Liste</button>'+
      '<button data-view="stats">Statistiques</button>'+
    '</div>'+
    '<div id="content"></div>'+
    '<footer class="foot">Données partagées en temps réel via Supabase.<span class="livedot" id="liveDot"></span></footer>'+
  '</div>';
  var ti=$("#titleInput"); ti.value=state.title;
  ti.addEventListener("input",function(e){ state.title=e.target.value; updateSub(); });
  ti.addEventListener("blur",function(){ db.from("settings").upsert({key:"title",value:state.title}); });
  $("#btnMembers").onclick=openMembersModal;
  [].forEach.call($("#viewtabs").querySelectorAll("button"),function(b){ b.onclick=function(){ state.view=b.dataset.view; renderContent(); }; });
  updateSub(); renderWhoami(); renderContent();
}
function setLive(on){ var d=$("#liveDot"); if(d) d.classList.toggle("on",!!on); }
function updateSub(){ var n=state.entries.length; var s=$("#subLine"); if(s) s.textContent="Journal partagé — "+n+" fiche"+(n>1?"s":""); }

function renderWhoami(){
  var c=$("#whoChips"); if(!c) return; c.innerHTML="";
  state.members.forEach(function(m){ var b=document.createElement("button"); b.className="who-chip"+(m.id===state.active?" is-on":""); b.textContent=m.name;
    if(m.id===state.active){ b.style.background=m.color; b.style.borderColor=m.color; b.style.color="#fff"; } else { b.style.color=m.color; b.style.borderColor=m.color; }
    b.onclick=function(){ state.active=m.id; LSraw.set("cat_active",m.id); renderWhoami(); }; c.appendChild(b); });
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
      '<select class="select" id="sortSel"></select>'+
      '<button class="add-btn" id="addBtn">+ Ajouter</button>'+
    '</div>'+
    '<div id="listArea"></div>';
  var si=$("#searchInput"); si.value=state.query; si.addEventListener("input",function(e){ state.query=e.target.value; renderList(); });
  fillSelect($("#fStatus"), [["all","Tous les statuts"]].concat(STATUSES.map(function(s){return [s.id,s.label];})), state.fStatus, function(v){ state.fStatus=v; renderList(); });
  fillSelect($("#fMember"), [["all","Tout le monde"]].concat(state.members.map(function(m){return [m.id,m.name];})), state.fMember, function(v){ state.fMember=v; renderList(); });
  fillSelect($("#sortSel"), [["recent","Plus récents"],["rating","Mieux notés"],["az","A → Z"]], state.sort, function(v){ state.sort=v; renderList(); });
  $("#addBtn").onclick=function(){ openEntryModal(null); };
  renderStatsStrip(); renderList();
}
function renderList(){ if(state.view==="compact") renderCompact(); else renderGrid(); }
function fillSelect(sel,options,value,onChange){ sel.innerHTML="";
  options.forEach(function(pair){ var o=document.createElement("option"); o.value=pair[0]; o.textContent=pair[1]; sel.appendChild(o); });
  sel.value=value; sel.onchange=function(){ onChange(sel.value); }; }

function renderStatsStrip(){
  var strip=$("#statsStrip"); if(!strip) return;
  var counts={}; TYPES.forEach(function(t){ counts[t.id]=0; }); state.entries.forEach(function(e){ if(counts[e.type]!=null) counts[e.type]++; });
  strip.innerHTML="";
  var total=document.createElement("button"); total.className="stat stat--total"+(state.fType==="all"?" is-on":"");
  total.innerHTML='<span class="stat__num">'+state.entries.length+'</span><span class="stat__lbl">Tout</span>';
  total.onclick=function(){ state.fType="all"; renderStatsStrip(); renderGrid(); }; strip.appendChild(total);
  TYPES.forEach(function(t){ var b=document.createElement("button"); b.className="stat"+(state.fType===t.id?" is-on":"");
    if(state.fType===t.id){ b.style.borderColor=t.color; b.style.background=t.color; } else { b.style.setProperty("--c",t.color); }
    b.innerHTML='<span class="stat__num">'+counts[t.id]+'</span><span class="stat__lbl">'+t.icon+' '+t.plural+'</span>';
    b.onclick=function(){ state.fType=state.fType===t.id?"all":t.id; renderStatsStrip(); renderGrid(); }; strip.appendChild(b); });
}
function memberById(id){ return state.members.find(function(m){return m.id===id;}); }

function visibleEntries(){
  var list=state.entries.slice();
  if(state.fType!=="all") list=list.filter(function(e){return e.type===state.fType;});
  if(state.fMember!=="all") list=list.filter(function(e){return e.memberId===state.fMember;});
  if(state.fStatus!=="all") list=list.filter(function(e){return (e.status||"done")===state.fStatus;});
  var q=state.query.trim().toLowerCase();
  if(q) list=list.filter(function(e){ return (e.title||"").toLowerCase().indexOf(q)>=0 || (e.review||"").toLowerCase().indexOf(q)>=0 || ((memberById(e.memberId)||{}).name||"").toLowerCase().indexOf(q)>=0; });
  if(state.sort==="recent") list.sort(function(a,b){ return (b.createdAt||0)-(a.createdAt||0); });
  if(state.sort==="rating") list.sort(function(a,b){ return (b.rating||0)-(a.rating||0)||(b.createdAt||0)-(a.createdAt||0); });
  if(state.sort==="az") list.sort(function(a,b){ return (a.title||"").localeCompare(b.title||"","fr"); });
  return list;
}
function renderGrid(){
  var area=$("#listArea"); if(!area) return;
  var list=visibleEntries();
  if(list.length===0){ area.innerHTML='<div class="empty"><div class="empty__ico">🗂️</div><p>Rien ici pour l\'instant.</p></div>';
    var btn=document.createElement("button"); btn.className="add-btn"; btn.textContent="Ajouter la première fiche"; btn.onclick=function(){ openEntryModal(null); };
    area.querySelector(".empty").appendChild(btn); return; }
  var grid=document.createElement("div"); grid.className="grid";
  list.forEach(function(e){
    var t=typeMeta(e.type), m=memberById(e.memberId), st=statusMeta(e.status||"done");
    var foot=e.status==="doing"?(m?esc(m.name):"?")+" · en cours":e.status==="todo"?(m?esc(m.name):"?")+" · à voir":(m?esc(m.name):"?")+" l'a "+t.verb;
    var cover=e.hasCover&&state.covers[e.id]?'<div class="cover" style="background:'+t.color+'18"><img src="'+state.covers[e.id]+'" alt=""></div>':"";
    var badge=(e.status&&e.status!=="done")?'<span class="status-chip" style="color:'+st.color+';border-color:'+st.color+'">'+st.icon+' '+st.label+'</span>':"";
    var avatar=m?'<span class="avatar" style="background:'+m.color+'" title="'+esc(m.name)+'">'+esc(m.name.slice(0,1).toUpperCase())+'</span>':"";
    var score=e.rating?'<span class="note-badge">'+nfr(e.rating)+'<span class="note-badge__out">/10</span></span>':'<span class="card__score card__score--none">non noté</span>';
    var year=e.year?'<span class="card__year"> · '+esc(e.year)+'</span>':"";
    var isSer=(e.type==="serie"||e.type==="anime"); var seasons=Array.isArray(e.seasons)?e.seasons:[];
    var doneChip=(isSer&&e.status==="done")?'<span class="status-chip" style="color:#3F7A3A;border-color:#3F7A3A">✓ Terminée</span>':"";
    var seasonStrip=(isSer&&seasons.length)?'<div class="season-strip">'+seasons.map(function(s){ return '<span class="season-chip">S'+esc(s.n)+(s.rating?'&nbsp;·&nbsp;'+nfr(s.rating):'')+'</span>'; }).join("")+'</div>':"";
    var card=document.createElement("article"); card.className="card"; card.style.setProperty("--c",t.color);
    card.innerHTML='<div class="card__spine"></div><div class="card__body">'+cover+
      '<div class="card__top"><span class="pill" style="color:'+t.color+';border-color:'+t.color+'">'+t.icon+' '+t.label+'</span>'+
        '<div class="card__badges">'+badge+doneChip+avatar+'</div></div>'+
      '<h3 class="card__title">'+esc(e.title)+year+'</h3>'+
      '<div class="card__rating">'+score+'</div>'+seasonStrip+
      '<div class="card__foot"><span>'+foot+'</span>'+
        '<span class="card__actions"><button data-act="edit" title="Modifier">✎</button><button data-act="del" title="Supprimer">🗑</button></span></div></div>';
    card.querySelector('[data-act="edit"]').onclick=function(){ openEntryModal(e); };
    card.querySelector('[data-act="del"]').onclick=function(){ deleteEntry(e); };
    grid.appendChild(card);
  });
  area.innerHTML=""; area.appendChild(grid);
}
function renderCompact(){
  var area=$("#listArea"); if(!area) return;
  var list=visibleEntries();
  if(list.length===0){ area.innerHTML='<div class="empty"><div class="empty__ico">🗂️</div><p>Rien ici pour l\'instant.</p></div>';
    var btn=document.createElement("button"); btn.className="add-btn"; btn.textContent="Ajouter la première fiche"; btn.onclick=function(){ openEntryModal(null); };
    area.querySelector(".empty").appendChild(btn); return; }
  var wrap=document.createElement("div"); wrap.className="clist";
  list.forEach(function(e){
    var t=typeMeta(e.type), m=memberById(e.memberId), st=statusMeta(e.status||"done");
    var thumb=e.hasCover&&state.covers[e.id]
      ? '<span class="crow__thumb"><img src="'+state.covers[e.id]+'" alt=""></span>'
      : '<span class="crow__thumb crow__thumb--ph" style="background:'+t.color+'22;color:'+t.color+'">'+t.icon+'</span>';
    var badge=(e.status&&e.status!=="done")?'<span class="status-chip" style="color:'+st.color+';border-color:'+st.color+'">'+st.icon+' '+st.label+'</span>':"";
    var avatar=m?'<span class="avatar avatar--sm" style="background:'+m.color+'" title="'+esc(m.name)+'">'+esc(m.name.slice(0,1).toUpperCase())+'</span>':"";
    var year=e.year?'<span class="crow__year"> · '+esc(e.year)+'</span>':"";
    var season=((e.type==="serie"||e.type==="anime")&&Array.isArray(e.seasons)&&e.seasons.length)?'<span class="crow__year"> · '+e.seasons.length+' saison'+(e.seasons.length>1?'s':'')+'</span>':"";
    var score=e.rating?'<span class="crow__score"><b>'+nfr(e.rating)+'</b>/10</span>':'<span class="crow__score crow__score--none">non noté</span>';
    var row=document.createElement("div"); row.className="crow"; row.style.setProperty("--c",t.color);
    row.innerHTML=
      thumb+
      '<span class="crow__main">'+
        '<span class="crow__title">'+esc(e.title)+season+year+'</span>'+
        '<span class="crow__meta"><span class="crow__type" style="color:'+t.color+'">'+t.icon+' '+t.label+'</span>'+badge+score+'</span>'+
      '</span>'+
      '<span class="crow__right">'+avatar+
        '<span class="crow__actions"><button data-act="edit" title="Modifier">✎</button><button data-act="del" title="Supprimer">🗑</button></span>'+
      '</span>';
    row.querySelector('[data-act="edit"]').onclick=function(ev){ ev.stopPropagation(); openEntryModal(e); };
    row.querySelector('[data-act="del"]').onclick=function(ev){ ev.stopPropagation(); deleteEntry(e); };
    row.addEventListener("click",function(){ openEntryModal(e); });
    wrap.appendChild(row);
  });
  area.innerHTML=""; area.appendChild(wrap);
}
function deleteEntry(entry){
  if(!confirm("Supprimer cette fiche ?")) return;
  state.entries=state.entries.filter(function(e){return e.id!==entry.id;}); delete state.covers[entry.id];
  refreshAfterData();
  db.from("entries").delete().eq("id",entry.id).then(function(r){ if(r.error) flash("Erreur de suppression : "+r.error.message); });
}
function refreshAfterData(){
  updateSub();
  if(state.view==="stats"){ var c=$("#content"); if(c){ c.innerHTML=""; c.appendChild(renderStats()); } }
  else { renderStatsStrip(); renderList(); }
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
  var perMember=state.members.map(function(m){ var es=state.entries.filter(function(e){return e.memberId===m.id;}); var r=es.filter(function(e){return e.rating>0;});
    return {id:m.id,name:m.name,color:m.color,count:es.length,avg:r.length?r.reduce(function(s,e){return s+e.rating;},0)/r.length:0}; }).sort(function(a,b){return b.count-a.count;});
  var maxMember=Math.max.apply(null,[1].concat(perMember.map(function(p){return p.count;})));
  var perType=TYPES.map(function(t){ var es=state.entries.filter(function(e){return e.type===t.id;}); var r=es.filter(function(e){return e.rating>0;});
    return {icon:t.icon,plural:t.plural,color:t.color,count:es.length,avg:r.length?r.reduce(function(s,e){return s+e.rating;},0)/r.length:0}; }).filter(function(t){return t.count>0;}).sort(function(a,b){return b.count-a.count;});
  var maxType=Math.max.apply(null,[1].concat(perType.map(function(t){return t.count;})));
  function inWho(e){ return state.who==="all"||e.memberId===state.who; }
  function podium(items){ return items.length===0?'<p class="muted">Aucune note pour l\'instant.</p>'
    :'<ol class="podium">'+items.map(function(e){ var t=typeMeta(e.type);
      return '<li><span class="podium__dot" style="background:'+t.color+'">'+t.icon+'</span><span class="podium__title">'+esc(e.title)+'</span><span class="podium__by">'+esc(memberName(e.memberId))+'</span><span class="podium__rate"><b>'+nfr(e.rating)+'</b>/10</span></li>'; }).join("")+'</ol>'; }
  var topAll=rated.filter(inWho).sort(function(a,b){return b.rating-a.rating||(b.createdAt||0)-(a.createdAt||0);}).slice(0,5);
  var topYear=thisYear.filter(function(e){return e.rating>0&&inWho(e);}).sort(function(a,b){return b.rating-a.rating||(b.createdAt||0)-(a.createdAt||0);}).slice(0,5);
  var whoLabel=state.who!=="all"?" · "+esc(memberName(state.who)):"";
  wrap.innerHTML=
    '<div class="bignums">'+
      '<div class="bignum"><span class="bignum__n">'+state.entries.length+'</span><span class="bignum__l">fiches au total</span></div>'+
      '<div class="bignum"><span class="bignum__n">'+thisYear.length+'</span><span class="bignum__l">ajoutées en '+year+'</span></div>'+
      '<div class="bignum"><span class="bignum__n">'+(overallAvg?avg1(overallAvg):"—")+'</span><span class="bignum__l">note moyenne /10</span></div>'+
      '<div class="bignum"><span class="bignum__n">'+state.members.length+'</span><span class="bignum__l">membres</span></div>'+
    '</div>'+
    '<div class="stats-filter"><span>Palmarès par personne&nbsp;:</span><select class="select" id="whoSel"></select></div>'+
    '<div class="panels">'+
      '<section class="panel"><h3 class="panel__h">Classement des membres</h3>'+perMember.map(function(p){ return '<div class="brow"><span class="brow__name"><span class="dot" style="background:'+p.color+'"></span>'+esc(p.name)+'</span><div class="bar"><span style="width:'+(p.count/maxMember*100)+'%;background:'+p.color+'"></span></div><span class="brow__val">'+p.count+'</span><span class="brow__avg">'+(p.avg?avg1(p.avg)+"/10":"—")+'</span></div>'; }).join("")+'</section>'+
      '<section class="panel"><h3 class="panel__h">Répartition par type</h3>'+perType.map(function(t){ return '<div class="brow"><span class="brow__name">'+t.icon+' '+t.plural+'</span><div class="bar"><span style="width:'+(t.count/maxType*100)+'%;background:'+t.color+'"></span></div><span class="brow__val">'+t.count+'</span><span class="brow__avg">'+(t.avg?avg1(t.avg)+"/10":"—")+'</span></div>'; }).join("")+'</section>'+
      '<section class="panel"><h3 class="panel__h">🏆 Mieux notées'+(state.who!=="all"?whoLabel:" — depuis toujours")+'</h3>'+podium(topAll)+'</section>'+
      '<section class="panel"><h3 class="panel__h">✨ Top de '+year+whoLabel+'</h3>'+podium(topYear)+'</section>'+
    '</div>';
  fillSelect(wrap.querySelector("#whoSel"), [["all","Tout le monde"]].concat(state.members.map(function(m){return [m.id,m.name];})), state.who, function(v){ state.who=v; renderContent(); });
  return wrap;
}

/* ============================ Modale fiche ============================= */
function openEntryModal(entry){
  var isEdit=!!entry;
  var form={ id:entry?entry.id:null, type:entry?entry.type:(state.fType==="all"?"film":state.fType),
    title:entry?entry.title||"":"", year:entry?entry.year||"":"", memberId:entry?entry.memberId:state.active,
    rating:entry?entry.rating||0:0, review:entry?entry.review||"":"", status:entry?entry.status||"done":"done", hasCover:entry?!!entry.hasCover:false,
    seasons:(entry&&Array.isArray(entry.seasons))?entry.seasons.map(function(s){return {n:s.n,rating:s.rating,review:s.review};}):[] };
  var coverValue=(entry&&entry.hasCover)?(state.covers[entry.id]||null):null; var coverChanged=false;

  var overlay=document.createElement("div"); overlay.className="overlay";
  overlay.innerHTML='<div class="modal">'+
    '<div class="modal__head"><h2>'+(isEdit?"Modifier la fiche":"Nouvelle fiche")+'</h2><button class="x" data-x>✕</button></div>'+
    '<label class="field__label">Type</label><div class="type-picker" id="typePick"></div>'+
    '<div class="row"><div class="field" style="flex:3"><label class="field__label">Titre</label><input class="input" id="fTitle" placeholder="Titre de l\'œuvre"></div>'+
      '<div class="field" style="flex:1"><label class="field__label">Année</label><input class="input" id="fYear" placeholder="2024" inputmode="numeric"></div></div>'+
    '<div class="field" id="statusField"><label class="field__label">Statut</label><div class="type-picker" id="statusPick"></div></div>'+
    '<div class="field" id="finishedField"><label class="field__label">Diffusion</label><button type="button" class="toggle-btn" id="finishedBtn"></button></div>'+
    '<div class="field"><label class="field__label">Par qui</label><select class="input" id="fMemberSel"></select></div>'+
    '<div class="field" id="noteField"><label class="field__label">Note sur 10 <span class="opt">(facultatif)</span></label><select class="input" id="noteSel"></select></div>'+
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

  // Série terminée (séries/animes) : pilote le statut done/doing
  var finishedField=overlay.querySelector("#finishedField");
  var finishedBtn=overlay.querySelector("#finishedBtn");
  function drawFinished(){ var on=form.status==="done"; finishedBtn.className="toggle-btn"+(on?" is-on":""); finishedBtn.textContent=on?"✓ Série terminée":"Série en cours de diffusion"; }
  finishedBtn.onclick=function(){ form.status=(form.status==="done")?"doing":"done"; drawFinished(); };
  drawFinished();

  var tEl=overlay.querySelector("#fTitle"); tEl.value=form.title; tEl.oninput=function(e){ form.title=e.target.value; saveBtn.disabled=!form.title.trim(); };
  var yEl=overlay.querySelector("#fYear"); yEl.value=form.year; yEl.oninput=function(e){ form.year=e.target.value.replace(/[^0-9]/g,"").slice(0,4); yEl.value=form.year; };
  var mSel=overlay.querySelector("#fMemberSel"); state.members.forEach(function(m){ var o=document.createElement("option"); o.value=m.id; o.textContent=m.name; mSel.appendChild(o); });
  mSel.value=form.memberId||(state.members[0]&&state.members[0].id); form.memberId=mSel.value; mSel.onchange=function(){ form.memberId=mSel.value; };
  var rev=overlay.querySelector("#fReview"); rev.value=form.review; rev.oninput=function(e){ form.review=e.target.value; };
  var reviewLabel=overlay.querySelector("#reviewLabel");

  // Note simple (menu déroulant)
  var noteField=overlay.querySelector("#noteField");
  var noteSel=overlay.querySelector("#noteSel");
  noteSel.innerHTML=noteOptionsHTML(form.rating);
  noteSel.onchange=function(){ form.rating=noteSel.value?parseFloat(noteSel.value):0; };

  // Gestionnaire de saisons (séries/animes)
  var seasonsWrap=overlay.querySelector("#seasonsWrap");
  function seasonAvg(){ var r=form.seasons.filter(function(s){return s.rating>0;}); return r.length? Math.round((r.reduce(function(a,s){return a+s.rating;},0)/r.length)*10)/10 : 0; }
  function buildSeasons(){
    seasonsWrap.innerHTML='<label class="field__label">Saisons <span class="opt">(note et critique par saison)</span></label>';
    var list=document.createElement("div"); list.className="seasons-list";
    form.seasons.forEach(function(s,idx){
      var row=document.createElement("div"); row.className="season-row";
      row.innerHTML=
        '<div class="season-row__head"><span class="season-tag">Saison</span>'+
          '<input class="input season-n" value="'+esc(s.n)+'" inputmode="numeric">'+
          '<select class="input season-note">'+noteOptionsHTML(s.rating)+'</select>'+
          '<button type="button" class="x small season-del" title="Retirer">✕</button></div>'+
        '<textarea class="input textarea season-rev" rows="2" placeholder="Critique de cette saison…">'+esc(s.review||"")+'</textarea>';
      var nEl=row.querySelector(".season-n"); nEl.oninput=function(e){ s.n=e.target.value.replace(/[^0-9]/g,"").slice(0,3); nEl.value=s.n; };
      row.querySelector(".season-note").onchange=function(e){ s.rating=e.target.value?parseFloat(e.target.value):0; updateAvg(); };
      row.querySelector(".season-rev").oninput=function(e){ s.review=e.target.value; };
      row.querySelector(".season-del").onclick=function(){ form.seasons.splice(idx,1); buildSeasons(); };
      list.appendChild(row);
    });
    seasonsWrap.appendChild(list);
    var add=document.createElement("button"); add.type="button"; add.className="ghost season-add"; add.textContent="+ Ajouter une saison";
    add.onclick=function(){ form.seasons.push({n:String(form.seasons.length+1),rating:0,review:""}); buildSeasons(); };
    seasonsWrap.appendChild(add);
    var avgLine=document.createElement("div"); avgLine.className="season-avg"; avgLine.id="seasonAvg"; seasonsWrap.appendChild(avgLine);
    updateAvg();
  }
  function updateAvg(){ var el=overlay.querySelector("#seasonAvg"); if(!el) return; var a=seasonAvg(); el.textContent=a?("Note de la série (moyenne des saisons) : "+avg1(a)+"/10"):"Ajoute des notes de saison pour obtenir la moyenne."; }

  function updateTypeUI(){
    var series=isSeries();
    statusField.style.display=series?"none":"";
    finishedField.style.display=series?"":"none";
    noteField.style.display=series?"none":"";
    seasonsWrap.style.display=series?"":"none";
    reviewLabel.textContent=series?"Critique globale (facultatif)":"Critique";
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
    var seasonsClean = series ? form.seasons.map(function(s){ return {n:(s.n||"").toString(), rating:s.rating||0, review:(s.review||"")}; }).filter(function(s){ return s.n || s.rating || s.review; }) : [];
    var ratingVal;
    if(series){ var rr=seasonsClean.filter(function(s){return s.rating>0;}); ratingVal = rr.length? Math.round((rr.reduce(function(a,s){return a+s.rating;},0)/rr.length)*10)/10 : 0; }
    else ratingVal = form.rating||0;
    var row={ id:id, type:form.type, title:title, year:form.year||null, member_id:form.memberId||null, rating:ratingVal, review:form.review||null, status:form.status, seasons: series?seasonsClean:null };
    if(coverChanged) row.cover=coverValue||null;
    if(isNew) row.created_at=new Date().toISOString();
    saveBtn.disabled=true; saveBtn.textContent="Enregistrement…";
    db.from("entries").upsert(row).then(function(r){
      if(r.error){ flash("Erreur : "+r.error.message); saveBtn.disabled=false; saveBtn.textContent=isEdit?"Enregistrer":"Ajouter au catalogue"; return; }
      var localEntry={ id:id, type:form.type, title:title, year:form.year||"", seasons:series?seasonsClean:[], memberId:form.memberId, rating:ratingVal, review:form.review||"", status:form.status,
        hasCover: coverChanged?!!coverValue:form.hasCover, createdAt: isNew?Date.now():(entry.createdAt||Date.now()) };
      var i=state.entries.findIndex(function(e){return e.id===id;}); if(i>=0) state.entries[i]=localEntry; else state.entries.unshift(localEntry);
      if(coverChanged){ if(coverValue) state.covers[id]=coverValue; else delete state.covers[id]; }
      close(); refreshAfterData();
    });
  };
  setTimeout(function(){ tEl.focus(); },30);
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

/* ============================ Export / Import ========================== */
function doExport(){
  var data={ app:"catalogue-famille", version:2, exportedAt:new Date().toISOString(), title:state.title, members:state.members,
    entries:state.entries.map(function(e){ return {id:e.id,type:e.type,title:e.title,year:e.year,memberId:e.memberId,rating:e.rating,review:e.review,status:e.status,createdAt:e.createdAt}; }), covers:state.covers };
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
