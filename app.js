const state={brief:null,area:"all",court:"all",query:"",view:"current",archivePath:null};
const $=id=>document.getElementById(id);
const esc=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const FAVORITES_KEY="juranews-favorites-v2";
const LEGACY_KEY="juranews-bookmarks";
let deferredPrompt=null;

function readFavorites(){
  try{
    const raw=JSON.parse(localStorage.getItem(FAVORITES_KEY)||"{}");
    return new Map(Object.entries(raw&&typeof raw==="object"?raw:{}));
  }catch{return new Map()}
}
const favorites=readFavorites();
let legacyBookmarks=new Set();
try{legacyBookmarks=new Set(JSON.parse(localStorage.getItem(LEGACY_KEY)||"[]"))}catch{}

function persistFavorites(){
  localStorage.setItem(FAVORITES_KEY,JSON.stringify(Object.fromEntries(favorites)));
}
function persistLegacy(){
  localStorage.setItem(LEGACY_KEY,JSON.stringify([...legacyBookmarks]));
}
function formatDate(value){
  if(!value||value==="—")return "—";
  const d=new Date(value+"T12:00:00");
  return new Intl.DateTimeFormat("de-DE",{day:"2-digit",month:"2-digit",year:"numeric"}).format(d);
}
function formatSaved(value){
  if(!value)return "";
  const d=new Date(value);
  return new Intl.DateTimeFormat("de-DE",{day:"2-digit",month:"2-digit",year:"numeric"}).format(d);
}
function weekText(b){
  if(b.week?.label)return b.week.label;
  if(b.week?.from&&b.week?.to)return formatDate(b.week.from)+" – "+formatDate(b.week.to);
  return "Aktuelle Woche";
}
function allText(d){
  return [d.court,d.senate,d.docket,d.area,d.title,d.holding,d.summary,d.facts,d.exam_relevance,d.significance,...(d.reasons||[])].join(" ").toLowerCase();
}
function currentDecisions(){
  if(!state.brief)return[];
  const b=state.brief;
  return (b.decisions||[]).length?b.decisions:(b.preview_decisions||[]);
}
function migrateLegacy(pool){
  let changed=false;
  for(const d of pool||[]){
    if(!d?.id||!legacyBookmarks.has(d.id)||favorites.has(d.id))continue;
    favorites.set(d.id,{
      savedAt:new Date().toISOString(),
      issue:state.brief?.issue_label||"",
      decision:JSON.parse(JSON.stringify(d))
    });
    legacyBookmarks.delete(d.id);
    changed=true;
  }
  if(changed){persistFavorites();persistLegacy()}
}
function updateFavoriteCounts(){
  const n=favorites.size;
  $("favoriteCountTab").textContent=n;
}
function renderHeader(){
  const b=state.brief;if(!b)return;
  const decisions=b.decisions||[];
  const shown=decisions.length?decisions:(b.preview_decisions||[]);
  $("issueEyebrow").textContent=b.status==="preview"?"Formatvorschau · erste Ausgabe folgt":(b.issue_label||"Wöchentlicher Rechtsprechungsbrief");
  $("intro").textContent=b.intro||"Die wichtigsten Entscheidungen der Woche.";
  $("decisionCount").textContent=decisions.length||"40";
  $("courtCount").textContent=new Set(shown.map(d=>d.court).filter(Boolean)).size||6;
  $("weekLabel").textContent=b.week?.short||b.issue_label||"wöchentlich";
  $("weekTitle").textContent=b.week?.title||weekText(b);
  $("weekSummary").textContent=b.week_summary||"Die wichtigsten Entscheidungen werden nach Veröffentlichung juristisch eingeordnet und hier gebündelt.";
}
function renderViewChrome(){
  const fav=state.view==="favorites";
  document.querySelectorAll("[data-view]").forEach(b=>b.classList.toggle("active",b.dataset.view===state.view));
  $("favoritesIntro").hidden=!fav;
  $("archivePanel").hidden=fav;
  $("listKicker").textContent=fav?"Persönliches Archiv":(state.brief?.status==="preview"?"Vorschau des Formats":(state.brief?.issue_label||"Aktuelle Ausgabe"));
  $("listTitle").textContent=fav?"Favoriten":"Entscheidungen";
  updateFavoriteCounts();
}
function decisionHTML(d){
  const id=esc(d.id||crypto.randomUUID());
  const marked=favorites.has(d.id);
  const entry=favorites.get(d.id);
  const preview=d.is_preview?'<span class="preview-tag">Vorschau</span>':"";
  const saved=state.view==="favorites"&&entry?.savedAt?'<span class="favorite-saved">★ gespeichert '+esc(formatSaved(entry.savedAt))+'</span>':"";
  const source=d.source?.url?'<a class="source-link" href="'+esc(d.source.url)+'" target="_blank" rel="noopener noreferrer">'+esc(d.source.name||"Quelle")+' ↗</a>':'<span class="muted">Fundstelle wird mit der Ausgabe hinterlegt.</span>';
  const full=d.fulltext||{};
  const fulltextAction=full.url
    ?'<a class="fulltext-btn" href="'+esc(full.url)+'" target="_blank" rel="noopener noreferrer">'+esc(full.available?"Volltext öffnen":"Quelle / Gerichtsmitteilung öffnen")+' ↗</a>'
    :'<span class="fulltext-pending">Volltext noch nicht veröffentlicht</span>';
  const reasons=(d.reasons||[]).map(x=>'<li>'+esc(x)+'</li>').join("");
  const detailed=(d.detailed_analysis||"").split(/\n{2,}/).filter(Boolean).map(p=>'<p>'+esc(p)+'</p>').join("");
  return '<details class="decision-card'+(d.is_preview?' preview':'')+'" data-id="'+id+'" data-court="'+esc(d.court||"")+'">'+
    '<summary class="decision-summary">'+
      '<span class="court-badge">'+esc(d.court||"Gericht")+'</span>'+
      '<div class="decision-main"><div class="meta-line">'+
        '<span class="area-tag">'+esc(d.area||"Rechtsgebiet")+'</span>'+preview+saved+
        '<span>'+esc(formatDate(d.date))+'</span><span>·</span><span>'+esc(d.docket||"Az. —")+'</span>'+
      '</div><h3>'+esc(d.title||"Entscheidung")+'</h3><p class="holding">'+esc(d.holding||"Kernaussage folgt.")+'</p></div>'+
      '<div class="summary-actions"><button class="bookmark'+(marked?' active':'')+'" type="button" data-bookmark="'+id+'" aria-label="'+(marked?'Aus Favoriten entfernen':'Zu Favoriten hinzufügen')+'" title="'+(marked?'Aus Favoriten entfernen':'Zu Favoriten hinzufügen')+'">'+(marked?'★':'☆')+'</button><span class="chev" aria-hidden="true">⌄</span></div>'+
    '</summary>'+
    '<div class="decision-body"><div class="decision-grid">'+
      '<div>'+
        '<section class="prose-block"><h4>Kurzüberblick</h4><p>'+esc(d.summary||"Die Zusammenfassung wird mit der Wochenausgabe ergänzt.")+'</p></section>'+
        (detailed?'<section class="prose-block detailed-analysis"><h4>Ausführliche Besprechung</h4>'+detailed+'</section>':'')+
        (d.facts?'<section class="prose-block"><h4>Sachverhalt kompakt</h4><p>'+esc(d.facts)+'</p></section>':'')+
        (reasons?'<section class="prose-block"><h4>Tragende Erwägungen</h4><ol class="reason-list">'+reasons+'</ol></section>':'')+
        (d.significance?'<section class="prose-block"><h4>Bedeutung der Entscheidung</h4><p>'+esc(d.significance)+'</p></section>':'')+
      '</div>'+
      '<aside class="side-stack">'+
        '<div class="side-box"><h4>Examensrelevanz</h4><p>'+esc(d.exam_relevance||"Einordnung folgt.")+'</p></div>'+
        '<div class="side-box"><h4>Gericht / Spruchkörper</h4><p>'+esc(d.court||"")+(d.senate?'<br>'+esc(d.senate):'')+'</p></div>'+
        '<div class="side-box fulltext-box"><h4>Volltext / Quelle</h4>'+fulltextAction+'<p class="fulltext-note">'+esc(full.available?"Die vollständige veröffentlichte Entscheidung ist extern abrufbar.":"Sobald die vollständigen Gründe veröffentlicht sind, wird der Volltext-Link ergänzt.")+'</p></div>'+
        '<div class="side-box"><h4>Fundstelle</h4><p class="citation">'+esc(d.citation||d.docket||"—")+'</p>'+source+'</div>'+
      '</aside>'+
    '</div></div>'+
  '</details>';
}
function favoritePool(){
  return [...favorites.values()]
    .filter(x=>x?.decision)
    .sort((a,b)=>String(b.savedAt||"").localeCompare(String(a.savedAt||"")))
    .map(x=>x.decision);
}
function getVisible(){
  let arr=state.view==="favorites"?favoritePool():currentDecisions();
  const q=state.query.trim().toLowerCase();
  return arr.filter(d=>
    (state.area==="all"||d.area===state.area)&&
    (state.court==="all"||d.court===state.court)&&
    (!q||allText(d).includes(q))
  );
}
function renderList(){
  const visible=getVisible();
  $("resultCount").textContent=visible.length+" "+(visible.length===1?"Entscheidung":"Entscheidungen");
  if(!visible.length){
    $("decisionList").innerHTML=state.view==="favorites"
      ?'<div class="empty-state"><strong>Noch keine Favoriten</strong>Ein Stern bei einer Entscheidung speichert sie dauerhaft in diesem Bereich.</div>'
      :'<div class="empty-state"><strong>Keine passende Entscheidung</strong>Filter oder Suchbegriff ergeben in dieser Ausgabe keinen Treffer.</div>';
    return;
  }
  $("decisionList").innerHTML=visible.map(decisionHTML).join("");
}
function renderAll(){renderHeader();renderViewChrome();renderList()}
function showToast(text){
  const t=$("toast");t.textContent=text;t.classList.add("show");
  clearTimeout(showToast.t);showToast.t=setTimeout(()=>t.classList.remove("show"),1800);
}
function findDecision(id){
  const live=currentDecisions().find(d=>d.id===id);
  if(live)return live;
  return favorites.get(id)?.decision||null;
}
function toggleFavorite(id){
  if(favorites.has(id)){
    favorites.delete(id);
    persistFavorites();
    updateFavoriteCounts();
    renderList();
    showToast("Aus Favoriten entfernt");
    return;
  }
  const d=findDecision(id);
  if(!d)return;
  favorites.set(id,{
    savedAt:new Date().toISOString(),
    issue:state.brief?.issue_label||"",
    decision:JSON.parse(JSON.stringify(d))
  });
  legacyBookmarks.delete(id);
  persistFavorites();persistLegacy();
  updateFavoriteCounts();
  renderList();
  showToast("Zu Favoriten hinzugefügt");
}
function switchView(view,scroll=false){
  state.view=view==="favorites"?"favorites":"current";
  renderViewChrome();
  renderList();
  if(scroll)$("listTitle").scrollIntoView({behavior:"smooth",block:"start"});
}
async function loadBrief(path="./data/latest.json"){
  const r=await fetch(path+(path.includes("?")?"&":"?")+"v="+Date.now(),{cache:"no-store"});
  if(!r.ok)throw new Error("HTTP "+r.status);
  state.brief=await r.json();
  state.archivePath=path;
  migrateLegacy(currentDecisions());
  renderAll();
}
async function loadArchive(){
  try{
    const r=await fetch("./data/archive/index.json?v="+Date.now(),{cache:"no-store"});
    if(!r.ok)throw new Error();
    const d=await r.json();
    const issues=d.issues||[];
    $("archiveList").innerHTML=issues.length
      ?issues.map(i=>'<button class="archive-btn" type="button" data-archive="'+esc(i.path)+'">'+esc(i.label||i.week||i.date)+'</button>').join("")
      :'<span class="muted">Noch keine früheren Ausgaben.</span>';
  }catch{$("archiveList").innerHTML='<span class="muted">Noch keine früheren Ausgaben.</span>'}
}

$("viewTabs").addEventListener("click",e=>{
  const b=e.target.closest("[data-view]");if(!b)return;
  switchView(b.dataset.view);
});
$("areaNav").addEventListener("click",e=>{
  const b=e.target.closest("[data-area]");if(!b)return;
  state.area=b.dataset.area;
  document.querySelectorAll(".area-chip").forEach(x=>x.classList.toggle("active",x===b));
  renderList();
});
$("courtSelect").addEventListener("change",e=>{state.court=e.target.value;renderList()});
$("search").addEventListener("input",e=>{state.query=e.target.value;renderList()});
$("decisionList").addEventListener("click",e=>{
  const b=e.target.closest("[data-bookmark]");if(!b)return;
  e.preventDefault();e.stopPropagation();toggleFavorite(b.dataset.bookmark);
});
$("archiveList").addEventListener("click",e=>{
  const b=e.target.closest("[data-archive]");if(!b)return;
  switchView("current");
  loadBrief(b.dataset.archive).then(()=>{
    document.querySelectorAll(".archive-btn").forEach(x=>x.classList.toggle("active",x===b));
    scrollTo({top:0,behavior:"smooth"});
  }).catch(()=>showToast("Ausgabe konnte nicht geladen werden"));
});
window.addEventListener("beforeinstallprompt",e=>{e.preventDefault();deferredPrompt=e;$("installBtn").hidden=false});
$("installBtn").addEventListener("click",async()=>{
  if(deferredPrompt){deferredPrompt.prompt();await deferredPrompt.userChoice;deferredPrompt=null;$("installBtn").hidden=true}
  else showToast("Im Browser-Menü „Zum Startbildschirm hinzufügen“ wählen.");
});
window.addEventListener("appinstalled",()=>{$("installBtn").hidden=true;showToast("JuraNews wurde installiert.")});

updateFavoriteCounts();
loadBrief().catch(()=>{
  $("decisionList").innerHTML='<div class="empty-state"><strong>Ausgabe nicht verfügbar</strong>Die Daten konnten gerade nicht geladen werden.</div>';
});
loadArchive();
if("serviceWorker" in navigator)window.addEventListener("load",()=>navigator.serviceWorker.register("./service-worker.js"));
