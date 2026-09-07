(() => {
'use strict';
const API='api/index.php';
let csrfToken='',currentUser=null,rides=[],trips=[],bookings=[],messages=[],users=[],ratings=[],myPassengers=[],currentProfile=null,currentChatUser=null,currentBookingChat=null,unreadDirect=0,unreadBooking=0,lastMessageId=0,notificationReady=false,previousRideStatus=new Map(),profileEditOpen=false,aiMapBusy=false;
let mapPassengers=[];let rideFinderMessages=[];let rideFinderResult=null;let rideFinderCollapsed=false;let mapDrivers=[];let myDriverCoords=null,driverApproachLine=null,rideSubmitting=false,ratingsPerRide=false,pickupFlowReady=true,pickupRadiusM=150,pickupForceAfterSec=180,pickupPromptShown=new Set();let map=null,tripMap=null,markers=new Map(),destinationMarkers=new Map(),routeLines=new Map(),pickupMarker=null,destinationMarker=null,driverMarker=null,selfMarker=null,passengerMapMarkers=new Map(),driverMapMarkers=new Map(),tripOriginMarker=null,tripDestinationMarker=null,tripRouteLine=null,selectedCoords=null,destinationCoords=null,futureOriginCoords=null,futureDestinationCoords=null,selectionMode='idle',tripSelectionMode='origin',syncTimer=null,driverWatchId=null,lastDriverSend=0,driverViewMode=localStorage.getItem('urfu4tour_driver_view')||'free';
const ROUTING_ENDPOINT='https://router.project-osrm.org/route/v1/driving';
const routeCache=new Map();

let userLocationWatchId=null,cropImage=null,cropScale=1,cropX=0,cropY=0,cropDragging=false,cropStartX=0,cropStartY=0,cropBaseScale=1;
const $=id=>document.getElementById(id);
const safe=v=>String(v??'').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
// BETA-2.7.3: базовый серый аватар в векторе — для меток на карте и рейтингов.
const DEFAULT_AVATAR_SVG='<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="100" height="100" role="img" aria-label="Нет аватара"><circle cx="50" cy="50" r="50" fill="#a8a8a8"/><circle cx="50" cy="39" r="17.5" fill="#eeeeee"/><path d="M50 60c15.2 0 27.6 11.4 29.6 26.2A49.8 49.8 0 0 1 50 100a49.8 49.8 0 0 1-29.6-13.8C22.4 71.4 34.8 60 50 60z" fill="#eeeeee"/></svg>';
const avatarDefault=(cls='avatar')=>`<span class="${cls} avatar-default">${DEFAULT_AVATAR_SVG}</span>`;
const avatarSoft=(u,cls='avatar')=>u?.avatar_url?`<img class="${cls}" src="${safe(u.avatar_url)}" alt="">`:avatarDefault(cls);
const avatar=(u,cls='avatar')=>u?.avatar_url?`<img class="${cls}" src="${safe(u.avatar_url)}" alt="">`:avatarDefault(cls);
const icons={pin:'<path d="M12 21s7-7.2 7-12a7 7 0 1 0-14 0c0 4.8 7 12 7 12Z"/><circle cx="12" cy="9" r="2.4"/>',flag:'<path d="M5 21V4"/><path d="M5 4h13l-3 4 3 4H5"/>',chat:'<path d="M20 11.5a7.5 7.5 0 0 1-8 7.5 8.5 8.5 0 0 1-4.2-1.1L4 19l1.1-3.2A7.5 7.5 0 1 1 20 11.5Z"/><path d="M8 11.5h.01M12 11.5h.01M16 11.5h.01"/>',globe:'<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18"/>',star:'<path d="m12 3 2.8 5.7 6.2.9-4.5 4.4 1.1 6.2-5.6-3-5.6 3 1.1-6.2L3 9.6l6.2-.9L12 3Z"/>',users:'<path d="M16 20v-1.2a4.8 4.8 0 0 0-4.8-4.8H7.8A4.8 4.8 0 0 0 3 18.8V20"/><circle cx="9.4" cy="7.4" r="3.4"/><path d="M15.4 10.5a3.3 3.3 0 1 0 0-6.2M16.2 14.2h.5a4.3 4.3 0 0 1 4.3 4.3V20"/>',user:'<circle cx="12" cy="8" r="3.5"/><path d="M5 21a7 7 0 0 1 14 0"/>',home:'<path d="m3 10 9-7 9 7"/><path d="M5 9v11h14V9"/><path d="M9 20v-6h6v6"/>',route:'<circle cx="6" cy="6" r="2.5"/><circle cx="18" cy="18" r="2.5"/><path d="M8.5 6H13a5 5 0 0 1 5 5v4.5"/>',moon:'<path d="M20 15.5A8.5 8.5 0 0 1 8.5 4 8.5 8.5 0 1 0 20 15.5Z"/>',sun:'<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>' ,crosshair:'<circle cx="12" cy="12" r="6"/><path d="M12 2v4M12 18v4M2 12h4M18 12h4"/>',car:'<path d="m5 16 1.5-6h11L19 16"/><path d="M4 16h16v4H4zM7 16v-2M17 16v-2"/><circle cx="7" cy="20" r="1.5"/><circle cx="17" cy="20" r="1.5"/>',chair:'<path d="M7 11V7a3 3 0 0 1 6 0v4"/><path d="M5 11h10a3 3 0 0 1 3 3v2H5v-5Z"/><path d="M7 16v4M16 16v4"/>',settings:'<path d="M12 8.5a3.5 3.5 0 1 0 0 7 3.5 3.5 0 0 0 0-7Z"/><path d="m19 13.5 1.4 1.1-1.8 3.1-1.7-.7a7.8 7.8 0 0 1-1.9 1.1L14.8 20h-3.6l-.2-1.9a7.8 7.8 0 0 1-1.9-1.1l-1.7.7-1.8-3.1L7 13.5a7.7 7.7 0 0 1 0-2.2L5.6 10.2l1.8-3.1 1.7.7A7.8 7.8 0 0 1 11 6.7L11.2 5h3.6l.2 1.7a7.8 7.8 0 0 1 1.9 1.1l1.7-.7 1.8 3.1-1.4 1.1a7.7 7.7 0 0 1 0 2.2Z"/>',sparkles:'<path d="m12 3 1.2 3.8L17 8l-3.8 1.2L12 13l-1.2-3.8L7 8l3.8-1.2L12 3ZM19 14l.7 2.3L22 17l-2.3.7L19 20l-.7-2.3L16 17l2.3-.7L19 14Z"/>',x:'<path d="m6 6 12 12M18 6 6 18"/>',plus:'<path d="M12 5v14M5 12h14"/>',clearMarkers:'<path d="M12 21s6.7-6.9 6.7-11.7a6.7 6.7 0 1 0-13.4 0C5.3 14.1 12 21 12 21Z"/><circle cx="12" cy="9.3" r="2.7"/><path d="m4.1 4.1 15.8 15.8"/>' ,help:'<circle cx="12" cy="12" r="9"/><path d="M9.8 9a2.3 2.3 0 1 1 3.8 1.8c-1.1.9-1.6 1.3-1.6 2.7M12 17h.01"/>',pencil:'<path d="m4 20 4.2-1 9.9-9.9a2.8 2.8 0 0 0-4-4L4.2 15 4 20Z"/><path d="m13 6 4 4"/>',phone:'<path d="M7 4h3l1.2 4-2 1.4a13 13 0 0 0 5.4 5.4l1.4-2L20 14v3a3 3 0 0 1-3 3C9.3 20 4 14.7 4 7a3 3 0 0 1 3-3Z"/>'};
const icon=(name,cls='ui-icon')=>`<svg class="${cls}" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">${icons[name]||icons.pin}</svg>`;
function mountStaticIcons(){document.querySelectorAll('[data-icon]').forEach(el=>{el.outerHTML=icon(el.dataset.icon,el.className||'ui-icon')});}

function uid(){return crypto.randomUUID?crypto.randomUUID():Date.now()+'-'+Math.random().toString(16).slice(2)}
async function json(r){try{return await r.json()}catch{return {}}}
async function getCSRF(){const r=await fetch(`${API}?action=get_csrf&_=${Date.now()}`,{credentials:'same-origin',cache:'no-store'});const d=await json(r);if(!r.ok||!d.csrf_token)throw Error(d.error||`CSRF ${r.status}`);csrfToken=d.csrf_token;return csrfToken}
async function post(action,body={},retry=true){if(!csrfToken&&action!=='register_login')await getCSRF();let r;try{r=await fetch(`${API}?action=${encodeURIComponent(action)}`,{method:'POST',credentials:'same-origin',cache:'no-store',headers:{'Content-Type':'application/json','X-CSRF-Token':csrfToken},body:JSON.stringify(body)})}catch(e){throw Error('Не удалось связаться с сервером. Проверьте адрес сайта, HTTPS и доступность API.')}const d=await json(r);if(r.status===403&&retry){if(d.csrf_token)csrfToken=d.csrf_token;else await getCSRF();return post(action,body,false)}if(!r.ok)throw Error(d.error||`Ошибка ${r.status}`);if(d.csrf_token)csrfToken=d.csrf_token;return d}
function toast(t){const e=$('toast');if(!e)return;e.textContent=t;e.classList.remove('hidden');clearTimeout(toast.timer);toast.timer=setTimeout(()=>e.classList.add('hidden'),3200)}
function setStatus(t,ok=true){const e=$('sync-status');if(e){e.title=t;e.classList.toggle('offline',!ok)}const g=$('geo-status');if(g&&t.includes('Гео'))g.textContent=t}
function updateUnreadBadge(){['unread-direct-badge','community-unread-badge'].forEach(id=>{const b=$(id);if(b){b.textContent=unreadDirect;b.classList.toggle('hidden',unreadDirect<1)}})}
function notifyNewMessages(prevUnread){const incoming=messages.filter(m=>m.sender_id&&currentUser&&String(m.sender_id)!==String(currentUser.id)&&(!m.read_at||m.read_at===null));const newest=incoming.reduce((a,m)=>Math.max(a,Number(m.id||0)),lastMessageId);if(newest>lastMessageId&&lastMessageId>0){const m=incoming.find(x=>Number(x.id)===newest);if(m){playNotificationSound();toast(`Новое сообщение от @${m.sender_name}`);if('Notification' in window&&Notification.permission==='granted')new Notification(`Новое сообщение от @${m.sender_name}`,{body:m.message.slice(0,120)})}}lastMessageId=Math.max(lastMessageId,newest);if(prevUnread!==unreadDirect&&unreadDirect>prevUnread&&notificationReady===false&&'Notification' in window&&Notification.permission==='default'){notificationReady=true}}
function playNotificationSound(){try{const Ctx=window.AudioContext||window.webkitAudioContext;if(!Ctx)return;const c=new Ctx(),o=c.createOscillator(),g=c.createGain();o.frequency.value=880;g.gain.value=.035;o.connect(g);g.connect(c.destination);o.start();o.stop(c.currentTime+.12);o.onended=()=>c.close()}catch{}}
function ensureNotifications(){if('Notification' in window&&Notification.permission==='default')Notification.requestPermission().then(()=>notificationReady=true).catch(()=>{})}
function merge(d){const nextRides=d.rides||[];const completedTargets=[];if(currentUser){nextRides.forEach(r=>{const old=previousRideStatus.get(r.client_uuid);const iAmPassenger=String(r.user_id)===String(currentUser.id),iAmDriver=r.driver_id&&String(r.driver_id)===String(currentUser.id);if((iAmPassenger||iAmDriver)&&old&&old!=='completed'&&r.status==='completed'&&!localStorage.getItem('urfu4tour_review_prompt_'+r.client_uuid)){const other=iAmPassenger?r.driver_id:r.user_id;if(other)completedTargets.push({ride:r,target:+other});}});nextRides.forEach(r=>previousRideStatus.set(r.client_uuid,r.status));}rides=nextRides;trips=d.future_trips||[];bookings=d.my_bookings||[];messages=d.chat_messages||[];users=d.users||[];ratings=d.ratings||[];myPassengers=d.my_passengers||[];mapPassengers=d.map_passengers||[];mapDrivers=d.map_drivers||[];if(d.ratings_per_ride!==undefined)ratingsPerRide=!!d.ratings_per_ride;if(d.pickup_flow_ready!==undefined)pickupFlowReady=!!d.pickup_flow_ready;if(d.pickup_radius_m)pickupRadiusM=+d.pickup_radius_m;if(d.pickup_force_after_sec)pickupForceAfterSec=+d.pickup_force_after_sec;const prevUnread=unreadDirect;unreadDirect=+(d.unread_direct||0);unreadBooking=+(d.unread_booking||0);updateUnreadBadge();notifyNewMessages(prevUnread);const me=currentUser&&users.find(u=>String(u.id)===String(currentUser.id));if(me)currentUser={...currentUser,...me};renderAll();manageDriverTracking();managePassengerLocation();maybePromptPickupConfirm();completedTargets.forEach(x=>setTimeout(()=>{localStorage.setItem('urfu4tour_review_prompt_'+x.ride.client_uuid,'1');openUserProfile(x.target,x.ride.client_uuid)},450))}
async function boot(){try{await getCSRF();const r=await fetch(`${API}?action=get_session&_=${Date.now()}`,{credentials:'same-origin',cache:'no-store'});const d=await json(r);if(d.csrf_token)csrfToken=d.csrf_token;if(!r.ok)throw Error(d.error||`Ошибка ${r.status}`);currentUser=d.user||null;updateUserUI();if(currentUser)await sync();else renderAll()}catch(e){console.error(e);toast(e.message||'Не удалось подключиться')}}
async function sync(){if(!currentUser)return;try{const d=await post('sync');merge(d.server_data||{});setStatus('Синхронизировано',true)}catch(e){console.error(e);setStatus(e.message||'Нет соединения',false)}}
function startPolling(){clearInterval(syncTimer);syncTimer=setInterval(()=>currentUser&&sync(),2500)}

/* v23 — Yandex Maps adapter. Existing map logic keeps its small Google-like
   interface, while all real map rendering/geocoding is performed by Yandex. */
const htmlIconLayoutCache=new Map();
function htmlIconLayout(html,size,off){
  const key=size.join('x')+'@'+off.join(',')+'|'+html;
  if(htmlIconLayoutCache.has(key))return htmlIconLayoutCache.get(key);
  const wrap='<div class="urfu-html-marker" style="position:absolute;left:'+off[0]+'px;top:'+off[1]+'px;width:'+size[0]+'px;height:'+size[1]+'px;pointer-events:auto;">'+html+'</div>';
  const layout=ymaps.templateLayoutFactory.createClass(wrap);
  htmlIconLayoutCache.set(key,layout);
  if(htmlIconLayoutCache.size>200)htmlIconLayoutCache.delete(htmlIconLayoutCache.keys().next().value);
  return layout;
}
function installYandexMapAdapter(){
  if(!window.ymaps || window.google?.maps?.__urfuYandexAdapter) return !!window.google?.maps;
  class LatLngAdapter{
    constructor(c){this._c=[Number(c[0]),Number(c[1])]}
    lat(){return this._c[0]}
    lng(){return this._c[1]}
    toArray(){return this._c.slice()}
  }
  class MapAdapter{
    constructor(el,opt={}){
      const center=opt.center?.lat!==undefined?[Number(opt.center.lat),Number(opt.center.lng)]:opt.center;
      this._map=new ymaps.Map(el,{center,zoom:Number(opt.zoom||12),controls:[]},{suppressMapOpenBlock:true});
      try{this._map.behaviors.enable(['drag','scrollZoom','dblClickZoom','multiTouch'])}catch{}
    }
    getCenter(){return new LatLngAdapter(this._map.getCenter())}
    setCenter(c,zoom){const center=c?.lat!==undefined?[Number(c.lat),Number(c.lng)]:c;return this._map.setCenter(center,zoom)}
    getZoom(){return this._map.getZoom()}
    setZoom(z){return this._map.setZoom(z)}
    setBounds(bounds,opt={}){try{return this._map.setBounds(bounds,{checkZoomRange:true,zoomMargin:opt.margin??56,duration:opt.duration??350})}catch(e){return null}}
    addListener(name,fn){
      this._map.events.add(name==='click'?'click':name,e=>{
        if(name==='click'){const c=e.get('coords');fn({latLng:new LatLngAdapter(c)})}
        else fn(e);
      });
      return {remove:()=>this._map.events.remove(name,fn)}
    }
    fitToViewport(){try{this._map.container.fitToViewport()}catch{}}
    _add(obj){this._map.geoObjects.add(obj)}
    _remove(obj){this._map.geoObjects.remove(obj)}
  }
  class MarkerAdapter{
    constructor(opt={}){
      this._map=opt.map||null;
      const pos=opt.position?.lat!==undefined?[Number(opt.position.lat),Number(opt.position.lng)]:opt.position;
      const icon=opt.icon||{};
      const size=icon.iconImageSize||[40,40];
      const off=icon.iconImageOffset||[-20,-20];
      const opts=icon.iconHtml
        ? {
            draggable:!!opt.draggable,
            zIndex:Number(opt.zIndex||0),
            iconLayout:htmlIconLayout(icon.iconHtml,size,off),
            iconShape:{type:'Rectangle',coordinates:[[off[0],off[1]],[off[0]+size[0],off[1]+size[1]]]}
          }
        : {
            draggable:!!opt.draggable,
            zIndex:Number(opt.zIndex||0),
            iconLayout:'default#image',
            iconImageHref:icon.iconImageHref||'',
            iconImageSize:size,
            iconImageOffset:off
          };
      const props={hintContent:opt.title||''};
      this._marker=new ymaps.Placemark(pos,props,opts);
      if(this._map?. _add)this._map._add(this._marker);
      else if(this._map?.geoObjects)this._map.geoObjects.add(this._marker);
    }
    setMap(map){
      if(this._map?._remove)this._map._remove(this._marker);
      else if(this._map?.geoObjects)this._map.geoObjects.remove(this._marker);
      this._map=map;
      if(map?._add)map._add(this._marker);
      else if(map?.geoObjects)map.geoObjects.add(this._marker);
    }
    setPosition(p){
      const c=p?.lat!==undefined?[Number(p.lat),Number(p.lng)]:p;
      this._marker.geometry.setCoordinates(c);
    }
    getPosition(){return new LatLngAdapter(this._marker.geometry.getCoordinates())}
    addListener(name,fn){
      const event=name==='dragend'?'dragend':name;
      const handler=e=>fn(e);
      this._marker.events.add(event,handler);
      return {remove:()=>this._marker.events.remove(event,handler)}
    }
    setTitle(title){this._marker.properties.set('hintContent',title)}
    get _ymObject(){return this._marker}
  }
  class PolylineAdapter{
    constructor(opt={}){
      this._map=opt.map||null;
      const path=(opt.path||[]).map(p=>p?.lat!==undefined?[Number(p.lat),Number(p.lng)]:p);
      this._line=new ymaps.Polyline(path,{},{
        strokeColor:opt.strokeColor||'#2563eb',
        strokeOpacity:opt.strokeOpacity??.65,
        strokeWidth:Number(opt.strokeWeight||4)
      });
      if(this._map?._add)this._map._add(this._line);
    }
    setMap(map){
      if(this._map?._remove)this._map._remove(this._line);
      this._map=map;
      if(map?._add)map._add(this._line);
    }
  }
  class InfoWindowAdapter{
    constructor(opt={}){this.content=opt.content||''}
    open({anchor}={}){if(anchor?._ymObject){anchor._ymObject.properties.set('balloonContent',this.content);anchor._ymObject.balloon.open()}}
  }
  class GeocoderAdapter{
    async geocode(req){
      let query=typeof req==='string'?req:req?.location||req?.address;
      if(query&&typeof query==='object'&&!Array.isArray(query)&&query.lat!==undefined)query=[Number(query.lat),Number(query.lng)];
      const res=await ymaps.geocode(query,{results:1});
      const geo=res.geoObjects.get(0);
      if(!geo)return {results:[]};
      const coords=geo.geometry.getCoordinates();
      const text=geo.properties.get('text')||geo.properties.get('name')||'';
      return {results:[{
        formatted_address:text,
        place_id:String(geo.properties.get('id')||''),
        geometry:{location:new LatLngAdapter(coords)}
      }]};
    }
  }
  window.google={maps:{
    __urfuYandexAdapter:true,
    Map:MapAdapter,Marker:MarkerAdapter,Polyline:PolylineAdapter,InfoWindow:InfoWindowAdapter,
    Geocoder:GeocoderAdapter,
    Size:class{constructor(w,h){this.width=w;this.height=h}},
    Point:class{constructor(x,y){this.x=x;this.y=y}},
    event:{trigger:(target,name)=>{if(name==='resize')target?.fitToViewport?.()}}
  }};
  return true;
}


async function getRoadRoute(from,to){
  const a=[Number(from[0]),Number(from[1])],b=[Number(to[0]),Number(to[1])];
  if(!a.every(Number.isFinite)||!b.every(Number.isFinite))throw Error('Некорректные координаты маршрута');
  const key=[a[0].toFixed(5),a[1].toFixed(5),b[0].toFixed(5),b[1].toFixed(5)].join(',');
  if(routeCache.has(key))return routeCache.get(key);
  const url=`${ROUTING_ENDPOINT}/${encodeURIComponent(`${a[1]},${a[0]};${b[1]},${b[0]}`)}?overview=full&geometries=geojson&steps=false`;
  const response=await fetch(url,{method:'GET',mode:'cors',cache:'force-cache',headers:{Accept:'application/json'}});
  if(!response.ok)throw Error(`Сервис маршрутизации: HTTP ${response.status}`);
  const data=await response.json();
  if(data.code!=='Ok'||!data.routes?.[0]?.geometry?.coordinates?.length)throw Error(data.message||'Маршрут не найден');
  const path=data.routes[0].geometry.coordinates
    .map(([lng,lat])=>({lat:Number(lat),lng:Number(lng)}))
    .filter(p=>Number.isFinite(p.lat)&&Number.isFinite(p.lng));
  if(path.length<2)throw Error('Маршрут слишком короткий');
  routeCache.set(key,path);
  if(routeCache.size>100)routeCache.delete(routeCache.keys().next().value);
  return path;
}
function makeRouteLine(targetMap,path,color){
  if(!targetMap||!path?.length)return null;
  return new google.maps.Polyline({map:targetMap,path,strokeColor:color||'#16a34a',strokeOpacity:.65,strokeWeight:4});
}
async function routeRideLine(clientUuid,from,to,color){
  try{
    const path=await getRoadRoute(from,to);
    if(!map||!routeLines.has(clientUuid))return;
    const old=routeLines.get(clientUuid);removeMapMarker(old);
    routeLines.set(clientUuid,makeRouteLine(map,path,color));
  }catch(err){
    console.warn('Road routing failed; keeping straight fallback route',err);
  }
}
function sameRoutePoints(a,b){
  return Array.isArray(a)&&Array.isArray(b)&&a.length===2&&b.length===2&&
    Math.abs(Number(a[0])-Number(b[0]))<0.000001&&Math.abs(Number(a[1])-Number(b[1]))<0.000001;
}
async function routeTripPreview(from,to){
  try{
    const path=await getRoadRoute(from,to);
    if(!tripMap||!sameRoutePoints(futureOriginCoords,from)||!sameRoutePoints(futureDestinationCoords,to))return;
    removeMapMarker(tripRouteLine);
    tripRouteLine=makeRouteLine(tripMap,path,'#2563eb');
  }catch(err){
    console.warn('Trip preview routing failed; keeping straight fallback route',err);
  }
}
// BETA-2.7.4: верхняя и нижняя панели сворачиваются, состояние запоминается.
const CHROME_KEYS={top:'urfu4tour_chrome_top',bottom:'urfu4tour_chrome_bottom'};
function applyChromeState(){
  document.body.classList.toggle('chrome-top-hidden',localStorage.getItem(CHROME_KEYS.top)==='hidden');
  document.body.classList.toggle('chrome-bottom-hidden',localStorage.getItem(CHROME_KEYS.bottom)==='hidden');
  const t=$('chrome-top-toggle'),b=$('chrome-bottom-toggle');
  if(t)t.title=t.ariaLabel=document.body.classList.contains('chrome-top-hidden')?'Показать верхнюю панель':'Свернуть верхнюю панель';
  if(b)b.title=b.ariaLabel=document.body.classList.contains('chrome-bottom-hidden')?'Показать нижнюю панель':'Свернуть нижнюю панель';
  setTimeout(()=>{try{map?.fitToViewport?.()}catch{}},80);
}
function toggleChrome(part){
  const cls=part==='top'?'chrome-top-hidden':'chrome-bottom-hidden';
  const hide=!document.body.classList.contains(cls);
  try{localStorage.setItem(CHROME_KEYS[part],hide?'hidden':'shown')}catch{}
  applyChromeState();
}
function switchTab(id){
  if(id==='community-tab')openCommunityView('');
  if(id==='profile-tab'){profileEditOpen=false;setTimeout(()=>renderProfilePage(),0)}
  document.querySelectorAll('.nav-btn[data-tab]').forEach(b=>b.classList.toggle('active',b.dataset.tab===id));
  document.querySelectorAll('.mobile-tab[data-mobile-tab]').forEach(b=>b.classList.toggle('active',b.dataset.mobileTab===id));
  document.querySelectorAll('.tab-content').forEach(s=>s.classList.toggle('active',s.id===id));
  setTimeout(()=>{try{map?.fitToViewport?.()}catch{}},50)
}
function initAddressSuggest(){
  // Address autocomplete is intentionally optional; selected map points use Yandex geocoding.
}
function initMap(){
  if(!$('map'))return;
  if(!window.ymaps){window.addEventListener('yandex-maps-ready',()=>initMap(),{once:true});return}
  installYandexMapAdapter();
  if(!window.google?.maps)return;
  if(map)return;
  const cfg=window.URFU_MAP_CONFIG||{};
  const center={lat:Number(cfg.defaultCenter?.[0]||56.84),lng:Number(cfg.defaultCenter?.[1]||60.61)};
  try{
    map=new google.maps.Map($('map'),{center,zoom:Number(cfg.defaultZoom||12),gestureHandling:'greedy'});
    renderMap(); initAddressSuggest(); showMyPositionOnMap(true);
  }catch(err){console.error('Yandex Maps initialization failed',err);const g=$('geo-status');if(g)g.textContent='Карта временно недоступна';toast('Не удалось загрузить Яндекс Карты. Проверьте API key.');}
}
window.__URFU_INIT_MAP=initMap;
// BETA-2.7: метки маршрута.
// start  — пин места посадки + контрастный человечек, машущий левой от зрителя рукой (анимация в app.css).
// finish — шахматный фон («финиш») + флажок, окрашенный в цвет статуса поездки.
const PICKUP_ICON_SIZE=[64,104], PICKUP_ICON_OFFSET=[-32,-104];
const FINISH_ICON_SIZE=[56,72],  FINISH_ICON_OFFSET=[-28,-72];
const PICKUP_WAVE_CSS='.pk-arm{transform-box:view-box;transform-origin:26.5px 20px;animation:pk-wave .62s ease-in-out infinite alternate}@keyframes pk-wave{from{transform:rotate(-18deg)}to{transform:rotate(12deg)}}@media (prefers-reduced-motion:reduce){.pk-arm{animation:none;transform:rotate(4deg)}}';
function pickupSvg(color,withStyle){
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 104" width="64" height="104">`
    +(withStyle?`<style>${PICKUP_WAVE_CSS}</style>`:'')
    +`<path d="M32 44c9.94 0 18 8.06 18 18 0 12.33-13.41 24.67-16.74 37.08a1.3 1.3 0 0 1-2.52 0C27.41 86.66 14 74.33 14 62c0-9.94 8.06-18 18-18z" fill="${color}" stroke="#fff" stroke-width="3"/>`
    +`<circle cx="32" cy="62" r="6" fill="#fff"/>`
    +`<g fill="#fff" stroke="#fff" stroke-width="9" stroke-linecap="round" stroke-linejoin="round"><circle cx="32" cy="10" r="5.5"/><rect x="26.5" y="16" width="11" height="16" rx="3.5"/><path d="M29 31v9M35 31v9M37.5 20l2.5 10" fill="none"/><path class="pk-arm" d="M26.5 20l-5 -7l-3.5 -8" fill="none"/></g>`
    +`<g fill="#141414" stroke="#141414" stroke-width="4.6" stroke-linecap="round" stroke-linejoin="round"><circle cx="32" cy="10" r="5.5"/><rect x="26.5" y="16" width="11" height="16" rx="3.5" stroke="none"/><path d="M29 31v9M35 31v9M37.5 20l2.5 10" fill="none"/><path class="pk-arm" d="M26.5 20l-5 -7l-3.5 -8" fill="none"/></g>`
    +`</svg>`;
}
function finishSvg(color){
  const pin='M28 4c11.05 0 20 8.95 20 20 0 13.7-14.9 27.4-18.6 41.2a1.45 1.45 0 0 1-2.8 0C22.9 51.4 8 37.7 8 24 8 12.95 16.95 4 28 4z';
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 56 72" width="56" height="72">`
    +`<defs><pattern id="fc" width="8" height="8" patternUnits="userSpaceOnUse"><rect width="8" height="8" fill="#fff"/><rect width="4" height="4" fill="#141414"/><rect x="4" y="4" width="4" height="4" fill="#141414"/></pattern><path id="fp" d="${pin}"/><clipPath id="fk"><use href="#fp"/></clipPath></defs>`
    +`<use href="#fp" fill="url(#fc)" clip-path="url(#fk)"/>`
    +`<use href="#fp" fill="none" stroke="#fff" stroke-width="4"/>`
    +`<use href="#fp" fill="none" stroke="${color}" stroke-width="2"/>`
    +`<g transform="translate(19 12)" stroke="#fff" stroke-width="3.2" stroke-linejoin="round" stroke-linecap="round" fill="none"><path d="M2.6 1.5v22"/><path d="M2.6 3.2h14.2l-3.4 5.6 3.4 5.6H2.6z"/></g>`
    +`<g transform="translate(19 12)"><path d="M2.6 1.5v22" fill="none" stroke="${color}" stroke-width="1.9" stroke-linecap="round"/><path d="M2.6 3.2h14.2l-3.4 5.6 3.4 5.6H2.6z" fill="${color}"/></g>`
    +`</svg>`;
}
function mydriverSvg(color){return `<svg xmlns="http://www.w3.org/2000/svg" width="36" height="36" viewBox="0 0 36 36"><circle cx="18" cy="18" r="15" fill="${color}" stroke="#fff" stroke-width="3"/><circle cx="18" cy="18" r="7" fill="#fff"/><circle cx="18" cy="18" r="3.2" fill="${color}"/></svg>`}
function letterSvg(color,letter){return `<svg xmlns="http://www.w3.org/2000/svg" width="40" height="40"><circle cx="20" cy="20" r="17" fill="${color}" stroke="white" stroke-width="3"/><text x="20" y="25" text-anchor="middle" font-family="Arial" font-size="15" font-weight="800" fill="white">${safe(letter)}</text></svg>`}
function dotSvg(color){return `<svg xmlns="http://www.w3.org/2000/svg" width="26" height="26"><circle cx="13" cy="13" r="9" fill="${color}" stroke="white" stroke-width="3"/></svg>`}
// Базовая графика метки: разметка, размер и то, где находится географическая точка —
// у пина это остриё внизу, у кружков — центр.
function markerArt(color,type){
  if(type==='start')return {svg:pickupSvg(color,false),styled:pickupSvg(color,true),size:PICKUP_ICON_SIZE.slice(),bottom:true};
  if(type==='finish')return {svg:finishSvg(color),size:FINISH_ICON_SIZE.slice(),bottom:true};
  if(type==='mydriver')return {svg:mydriverSvg(color),size:[36,36],bottom:false};
  if(type)return {svg:letterSvg(color,type),size:[40,40],bottom:false};
  return {svg:dotSvg(color),size:[26,26],bottom:false};
}
function markerIcon(color='#16a34a',type=''){
  const url=svg=>'data:image/svg+xml;charset=UTF-8,'+encodeURIComponent(svg);
  const art=markerArt(color,type),[w,h]=art.size;
  const offset=art.bottom?[-w/2,-h]:[-w/2,-h/2];
  const icon={iconImageHref:url(art.styled||art.svg),iconImageSize:[w,h],iconImageOffset:offset};
  if(type==='start')icon.iconHtml=art.svg; // анимация руки работает только в HTML-слое
  return icon;
}
// BETA-2.7.3: аватар пользователя над меткой, на 10 px выше её верхнего края.
const MARKER_AVATAR_SIZE=36, MARKER_AVATAR_GAP=10;
function avatarMarkerIcon(color,type,u){
  const art=markerArt(color,type),[w,h]=art.size;
  const av=MARKER_AVATAR_SIZE,gap=MARKER_AVATAR_GAP;
  const totalW=Math.max(w,av+4),totalH=av+gap+h;
  const inner=u?.avatar_url?`<img src="${safe(u.avatar_url)}" alt="">`:DEFAULT_AVATAR_SVG;
  const html=`<div class="urfu-marker-stack" style="width:${totalW}px;height:${totalH}px">`
    +`<span class="urfu-marker-avatar" style="width:${av}px;height:${av}px">${inner}</span>`
    +`<span class="urfu-marker-art" style="width:${w}px;height:${h}px">${art.svg}</span>`
    +`</div>`;
  const offsetY=art.bottom?-totalH:-(av+gap+h/2);
  return {iconHtml:html,iconImageHref:'',iconImageSize:[totalW,totalH],iconImageOffset:[-totalW/2,offsetY]};
}
function placeAvatarMarker(coords,u,options={}){
  if(!window.google?.maps||!map)return null;
  const pos={lat:Number(coords[0]),lng:Number(coords[1])};
  const color=options.color||'#16a34a';
  const type=options.type||options.letter||'';
  const m=new google.maps.Marker({map,position:pos,title:u?.username||'Участник',icon:avatarMarkerIcon(color,type,u)});
  if(options.balloon){const iw=new google.maps.InfoWindow({content:options.balloon});m.addListener('click',()=>iw.open({map,anchor:m}));}
  return m;
}
function removeMapMarker(m){try{m?.setMap(null)}catch{}}
function drawPickup(){
  removeMapMarker(pickupMarker);pickupMarker=null;
  if(!map||!selectedCoords||currentUser?.role!=='passenger'||rides.some(r=>String(r.user_id)===String(currentUser.id)&&['accepted','on_the_way'].includes(r.status)))return;
  const address=window.pickupAddress||'Место посадки';
  pickupMarker=new google.maps.Marker({map,position:{lat:+selectedCoords[0],lng:+selectedCoords[1]},title:address,draggable:true,icon:markerIcon('#ec4899','start'),zIndex:100});
  const iw=new google.maps.InfoWindow({content:`<b>Место посадки</b><br><span>${safe(address)}</span>`});pickupMarker.addListener('click',()=>iw.open({map,anchor:pickupMarker}));
  pickupMarker.addListener('dragend',async()=>{const p=pickupMarker.getPosition();await selectPickup(p.lat(),p.lng(),false)});
}
function drawDestination(){
  removeMapMarker(destinationMarker);destinationMarker=null;
  if(!map||!destinationCoords||currentUser?.role!=='passenger'||rides.some(r=>String(r.user_id)===String(currentUser.id)&&['accepted','on_the_way'].includes(r.status)))return;
  const address=window.destinationAddress||$('destination-text')?.value||'Точка назначения';
  destinationMarker=new google.maps.Marker({map,position:{lat:+destinationCoords[0],lng:+destinationCoords[1]},title:address,draggable:true,icon:markerIcon('#f59e0b','finish'),zIndex:99});
  const iw=new google.maps.InfoWindow({content:`<b>Точка назначения</b><br><span>${safe(address)}</span>`});destinationMarker.addListener('click',()=>iw.open({map,anchor:destinationMarker}));
  destinationMarker.addListener('dragend',async()=>{const p=destinationMarker.getPosition();await selectDestination(p.lat(),p.lng(),true)});
}
async function geocodeAddress(lat,lng){
  if(!window.google?.maps)return null;
  try{const geocoder=new google.maps.Geocoder();const {results}=await geocoder.geocode({location:{lat:Number(lat),lng:Number(lng)},language:'ru',region:'RU'});const r=results?.[0];if(!r)return null;return {text:r.formatted_address.replace(/^Россия,?\s*/i,'').trim(),full:r.formatted_address,id:r.place_id||''};}
  catch(err){console.warn('Google reverse geocoding failed',err);return null}
}
function updateRoutePickerButtons(){
  // Подсвечивает, какая из двух кнопок «Откуда забрать» / «Куда приехать» сейчас активна для выбора на карте,
  // и помечает кнопку как «заполненную», когда точка уже выбрана.
  const startBtn=$('set-pickup-btn'),finishBtn=$('choose-destination');
  if(startBtn){startBtn.classList.toggle('selected',!!selectedCoords);startBtn.setAttribute('aria-pressed',String(!!selectedCoords))}
  if(finishBtn){finishBtn.classList.toggle('selected',!!destinationCoords);finishBtn.setAttribute('aria-pressed',String(!!destinationCoords))}
}
function setPickupAddressField(address){
  const text=String(address||'Место на карте').trim(),pickupBox=$('pickup-address-display');
  if(pickupBox){pickupBox.textContent=text;pickupBox.title=text;pickupBox.dataset.address=text}
  const pickupInput=$('pickup-address');if(pickupInput)pickupInput.value=text;
  updateRoutePickerButtons();
}
function setDestinationAddressField(address){
  const text=String(address||'Точка назначения').trim(),input=$('destination-text'),hint=$('destination-address-hint');
  if(input){input.value=text;input.title=text;input.dispatchEvent(new Event('input',{bubbles:true}))}
  if(hint){hint.textContent=text;hint.title=text}
  updateRoutePickerButtons();
}
async function selectPickup(lat,lng,fromGeo=true){
  const c=[Number(lat),Number(lng)],g=$('geo-status');selectedCoords=c;selectionMode='idle';if(g)g.textContent='Определяем адрес…';
  const addr=await geocodeAddress(c[0],c[1]);window.pickupAddress=addr?.text||'Место на карте';setPickupAddressField(window.pickupAddress);drawPickup();
  if(map){map.setCenter({lat:c[0],lng:c[1]});}if(g)g.textContent=addr?.text?`Посадка: ${addr.text}`:'Посадка: адрес не определён';return true;
}
async function selectDestination(lat,lng,fromMap=true){
  const c=[Number(lat),Number(lng)],g=$('geo-status');destinationCoords=c;selectionMode='idle';if(g)g.textContent='Определяем адрес…';
  const addr=await geocodeAddress(c[0],c[1]);window.destinationAddress=addr?.text||'Точка назначения';setDestinationAddressField(window.destinationAddress);drawDestination();
  if(map){map.setCenter({lat:c[0],lng:c[1]});}if(g)g.textContent=addr?.text?`Назначение: ${addr.text}`:'Назначение: адрес не определён';return true;
}
async function setRoutePointAtCenter(type){
  if(currentUser?.role!=='passenger')return toast('Сначала войдите как пассажир');
  if(!map)return toast('Карта ещё загружается');
  const c=map.getCenter();
  if(!c)return;
  if(type==='destination')await selectDestination(c.lat(),c.lng(),true);
  else await selectPickup(c.lat(),c.lng(),true);
  selectionMode='idle';updateRoutePickerButtons();
}
function chooseDestinationMode(){return setRoutePointAtCenter('destination')}
function choosePickupMode(){return setRoutePointAtCenter('pickup')}
function updateSelfMarker(c,center=false){
  if(!map)return;const pos={lat:+c[0],lng:+c[1]};
  if(!selfMarker)selfMarker=new google.maps.Marker({map,position:pos,title:'Моё местоположение',icon:markerIcon('#2563eb','•'),zIndex:1000});else selfMarker.setPosition(pos);
  if(center){map.setCenter(pos);map.setZoom(Math.max(map.getZoom(),14));}$('remove-my-location')?.classList.remove('hidden');
}
function showMyPositionOnMap(center=false){if(!map||!navigator.geolocation)return;const g=$('geo-status');if(g)g.textContent='Получаем ваше местоположение…';navigator.geolocation.getCurrentPosition(pos=>{updateSelfMarker([pos.coords.latitude,pos.coords.longitude],center);if(g)g.textContent='Ваше местоположение показано на карте'},()=>{if(g)g.textContent='Не удалось определить местоположение';toast('Разрешите геолокацию в браузере, чтобы определить ваше положение.')},{enableHighAccuracy:true,timeout:15000,maximumAge:5000})}
function locate(){showMyPositionOnMap(true);const g=$('geo-status');if(g)g.textContent='Получаем ваше местоположение…'}
function removeMyLocation(){removeMapMarker(selfMarker);selfMarker=null;removeMapMarker(pickupMarker);pickupMarker=null;selectedCoords=null;window.pickupAddress='';setPickupAddressField('Нажмите и выберите место на карте');$('remove-my-location')?.classList.add('hidden');if($('geo-status'))$('geo-status').textContent='Метка убрана'}
function activeMapRides(){
  if(!currentUser)return[];
  const live=(rides||[]).filter(r=>!r.deleted_at&&['pending','accepted','on_the_way'].includes(r.status)&&Number.isFinite(+r.lat)&&Number.isFinite(+r.lng));
  if(currentUser.role==='passenger')return live.filter(r=>String(r.user_id)===String(currentUser.id));
  // Для водителя после очистки восстанавливаем все активные маршруты, а не только текущий режим фильтра.
  return live.filter(r=>String(r.user_id)!==String(currentUser.id));
}
function redrawActiveRideRoutes(){
  if(!map||!currentUser)return;
  activeMapRides().forEach(r=>{
    const from=[+r.lat,+r.lng];
    const destination=r.destination_lat!=null&&r.destination_lng!=null?[+r.destination_lat,+r.destination_lng]:null;
    if(!destination)return;
    const color=r.status==='pending'?'#16a34a':r.status==='accepted'?'#dc2626':'#2563eb';
    const u={id:r.user_id,username:r.passenger_name,avatar_url:r.passenger_avatar};
    const start=placeAvatarMarker(from,u,{balloon:`<b>${safe(r.passenger_name||'Пассажир')}</b><br><strong>Посадка:</strong> ${safe(r.pickup_address||'Адрес определяется…')}`,color,type:'start'});
    markers.set(r.client_uuid,start);
    const finish=new google.maps.Marker({map,position:{lat:destination[0],lng:destination[1]},title:r.destination_text||'Назначение',icon:markerIcon(color,'finish')});
    destinationMarkers.set(r.client_uuid,finish);
    const line=makeRouteLine(map,[{lat:from[0],lng:from[1]},{lat:destination[0],lng:destination[1]}],color);
    routeLines.set(r.client_uuid,line);
    routeRideLine(r.client_uuid,from,destination,color);
  });
  // Для водителя сохраняем специальный маршрут подъезда к принятому пассажиру.
  if(currentUser.role==='driver')drawDriverApproach();
}
function clearAllMapMarkers(){
  removeMapMarker(driverApproachLine);driverApproachLine=null;approachState={uuid:'',from:null,at:0};
  markers.forEach(removeMapMarker);markers.clear();destinationMarkers.forEach(removeMapMarker);destinationMarkers.clear();routeLines.forEach(removeMapMarker);routeLines.clear();
  removeMapMarker(futureFocusRouteLine);futureFocusRouteLine=null;futureFocusMarkers.forEach(removeMapMarker);futureFocusMarkers=[];
  removeMapMarker(tripRouteLine);tripRouteLine=null;
  removeMapMarker(pickupMarker);pickupMarker=null;removeMapMarker(destinationMarker);destinationMarker=null;removeMapMarker(selfMarker);selfMarker=null;
  selectedCoords=null;destinationCoords=null;window.pickupAddress='';window.destinationAddress='';setPickupAddressField('Нажмите и выберите место на карте');const d=$('destination-text');if(d)d.value='';const dh=$('destination-address-hint');if(dh)dh.textContent='Нажмите и укажите точку назначения';updateRoutePickerButtons();$('remove-my-location')?.classList.add('hidden');
  renderDriverLocation();renderAllDriverLocations();renderPassengerMapLocations();redrawActiveRideRoutes();
  if($('geo-status'))$('geo-status').textContent='Метки и маршруты очищены; активные маршруты восстановлены';toast('Метки удалены, активные маршруты восстановлены')
}
function startPassengerLocationSharing(){if(!currentUser||currentUser.role!=='passenger'||userLocationWatchId!==null||!navigator.geolocation)return;userLocationWatchId=navigator.geolocation.watchPosition(p=>post('update_user_location',{lat:p.coords.latitude,lng:p.coords.longitude,accuracy:p.coords.accuracy}).catch(()=>{}),()=>{},{enableHighAccuracy:true,timeout:15000,maximumAge:5000})}
function stopPassengerLocationSharing(){if(userLocationWatchId!==null){navigator.geolocation.clearWatch(userLocationWatchId);userLocationWatchId=null}if(currentUser?.role==='passenger')post('clear_user_location').catch(()=>{})}
// BETA-2.7: принятая поездка больше не исчезает с карты.
// Водитель-исполнитель видит свои accepted/on_the_way; чужие accepted показываются красным в режиме «Всех пассажиров».
function visibleRides(){
  if(!currentUser)return[];
  const me=String(currentUser.id);
  const live=rides.filter(r=>!r.deleted_at&&['pending','accepted','on_the_way'].includes(r.status));
  if(currentUser.role!=='driver')return live.filter(r=>String(r.user_id)===me);
  return live.filter(r=>{
    if(String(r.user_id)===me)return false;
    if(String(r.driver_id)===me)return true;
    if(r.status==='pending')return true;
    return driverViewMode==='all'&&r.status==='accepted';
  });
}
function myAcceptedRide(){if(currentUser?.role!=='driver')return null;return rides.find(r=>r.status==='accepted'&&String(r.driver_id)===String(currentUser.id))||null}
function rideAwaitingMyConfirm(){if(currentUser?.role!=='passenger')return null;return rides.find(r=>r.status==='accepted'&&String(r.user_id)===String(currentUser.id)&&r.pickup_requested_at)||null}
function renderMap(){
  if(!map)return;const clear=store=>{store.forEach(m=>removeMapMarker(m));store.clear()};clear(markers);clear(destinationMarkers);clear(routeLines);removeMapMarker(driverMarker);driverMarker=null
  visibleRides().forEach(r=>{
    const color=r.status==='pending'?'#16a34a':r.status==='accepted'?'#dc2626':'#2563eb',st={pending:'Свободный пассажир',accepted:'Пассажир занят',on_the_way:'Водитель в пути'}[r.status]||r.status;
    const u={id:r.user_id,username:r.passenger_name,avatar_url:r.passenger_avatar},destination=r.destination_lat!=null&&r.destination_lng!=null?[+r.destination_lat,+r.destination_lng]:null;
    // Кружок-маркер посадки — единственная точка входа для принятия поездки водителем (клик = приём поездки).
    // Иконка (булавка) сама по себе обозначает начало маршрута — без текстовых подписей поверх карты.
    const acceptable=currentUser?.role==='driver'&&r.status==='pending'&&String(r.user_id)!==String(currentUser.id);
    // BETA-2.7: свой принятый (красный) маршрут водителю не рисуем — вместо него строится подъезд к точке посадки.
    const hideRoute=currentUser?.role==='driver'&&r.status==='accepted'&&String(r.driver_id)===String(currentUser.id);
    const balloon=acceptable?null:`<b>${safe(r.passenger_name)}</b><br><strong>Статус:</strong> ${st}<br><strong>Посадка:</strong> ${safe(r.pickup_address||'Адрес определяется…')}<br>${destination?`<strong>Назначение:</strong> ${safe(r.destination_text||'Точка на карте')}<br>`:''}${r.driver_name?`Водитель: ${safe(r.driver_name)}<br>`:''}<button class="map-profile-btn" onclick="window.__urfuOpenProfile(${Number(r.user_id)})">Открыть профиль</button>`;
    const m=placeAvatarMarker([+r.lat,+r.lng],u,{balloon,color,type:'start'});markers.set(r.client_uuid,m);
    if(acceptable&&m){
      m.setTitle(`Нажмите, чтобы принять поездку — ${r.passenger_name}`);
      m.addListener('click',()=>{if(confirm(`Принять поездку у ${r.passenger_name}?\nПосадка: ${r.pickup_address||'адрес определяется на карте'}`))pickupPassenger(r.client_uuid)});
    }
    if(destination&&!hideRoute){const from=[+r.lat,+r.lng],to=destination;const dm=new google.maps.Marker({map,position:{lat:destination[0],lng:destination[1]},title:r.destination_text||'Назначение',icon:markerIcon(color,'finish')});destinationMarkers.set(r.client_uuid,dm);const line=makeRouteLine(map,[{lat:from[0],lng:from[1]},{lat:to[0],lng:to[1]}],color);routeLines.set(r.client_uuid,line);routeRideLine(r.client_uuid,from,to,color)}
  });
  drawPickup();drawDestination();renderDriverLocation();renderAllDriverLocations();renderPassengerMapLocations();drawDriverApproach();
}
// BETA-2.7: маршрут от текущей позиции водителя до метки подбора.
// Пересчёт троттлится: OSRM публичный, а sync идёт каждые 2.5 с.
let approachState={uuid:'',from:null,at:0};
function metersBetweenCoords(a,b){
  const R=6371000,p1=a[0]*Math.PI/180,p2=b[0]*Math.PI/180,dp=(b[0]-a[0])*Math.PI/180,dl=(b[1]-a[1])*Math.PI/180;
  const h=Math.sin(dp/2)**2+Math.cos(p1)*Math.cos(p2)*Math.sin(dl/2)**2;
  return R*2*Math.atan2(Math.sqrt(h),Math.sqrt(1-h));
}
function driverSelfCoords(ride){
  if(myDriverCoords)return myDriverCoords;
  if(ride?.driver_lat&&ride?.driver_lng)return [+ride.driver_lat,+ride.driver_lng];
  return null;
}
async function drawDriverApproach(){
  const r=myAcceptedRide();
  if(!map||!r){removeMapMarker(driverApproachLine);driverApproachLine=null;approachState={uuid:'',from:null,at:0};return}
  const from=driverSelfCoords(r);
  if(!from){removeMapMarker(driverApproachLine);driverApproachLine=null;return}
  const to=[+r.lat,+r.lng];
  const fresh=approachState.uuid===r.client_uuid&&approachState.from&&
    Date.now()-approachState.at<20000&&metersBetweenCoords(approachState.from,from)<75;
  if(fresh&&driverApproachLine)return;
  const token=Date.now();
  approachState={uuid:r.client_uuid,from,at:token};
  removeMapMarker(driverApproachLine);
  driverApproachLine=makeRouteLine(map,[{lat:from[0],lng:from[1]},{lat:to[0],lng:to[1]}],'#dc2626');
  try{
    const path=await getRoadRoute(from,to);
    if(!map||approachState.at!==token||myAcceptedRide()?.client_uuid!==r.client_uuid)return;
    removeMapMarker(driverApproachLine);
    driverApproachLine=makeRouteLine(map,path,'#dc2626');
  }catch(err){console.warn('Approach routing failed; keeping straight line',err)}
}
function activeDriverRide(){if(!currentUser)return null;return rides.find(r=>['accepted','on_the_way'].includes(r.status)&&((currentUser.role==='driver'&&String(r.driver_id)===String(currentUser.id))||(currentUser.role==='passenger'&&String(r.user_id)===String(currentUser.id))))||null}
// BETA-2.7.1: водитель, принявший поездку, рисуется фиолетовым и отдельной иконкой,
// чтобы пассажир не путал его с остальными водителями на карте.
const ASSIGNED_DRIVER_COLOR='#7c3aed';
function updateFocusDriverButton(r){
  const btn=$('focus-driver');if(!btn)return;
  const ok=currentUser?.role==='passenger'&&r&&r.driver_lat&&r.driver_lng;
  btn.classList.toggle('hidden',!ok);
}
function focusAssignedDriver(){
  const r=activeDriverRide();
  if(!map)return;
  if(!r||!r.driver_lat||!r.driver_lng)return toast('Позиция водителя пока не определена');
  map.setCenter({lat:+r.driver_lat,lng:+r.driver_lng});
  map.setZoom(Math.max(map.getZoom()||0,16));
  toast(`${r.driver_name||'Водитель'} — на карте`);
}
function renderDriverLocation(){if(!map)return;const r=activeDriverRide();updateFocusDriverButton(r);if(!r||!r.driver_lat||!r.driver_lng){removeMapMarker(driverMarker);driverMarker=null;return}const coords=[+r.driver_lat,+r.driver_lng],u={id:r.driver_id,username:r.driver_name,avatar_url:r.driver_avatar};const age=r.driver_location_updated_at?Math.max(0,Math.round((Date.now()-new Date(r.driver_location_updated_at.replace(' ','T')).getTime())/1000)):9999;const title=age<=20?'Водитель сейчас здесь':'Последняя позиция водителя';const mine=currentUser?.role==='passenger';const balloon=`<b>${icon('car','ui-icon ui-icon-inline')} ${safe(r.driver_name||'Водитель')}</b>${mine?'<br>Ваш водитель по этой поездке':''}<br>${title}${age<9999?`<br>Обновлено ${age} сек. назад`:''}<br><button class="map-profile-btn" onclick="window.__urfuOpenProfile(${Number(r.driver_id)})">Профиль</button> <button class="map-profile-btn" onclick="window.__urfuOpenDirectChat(${Number(r.driver_id)})">Написать</button>`;if(!driverMarker)driverMarker=placeAvatarMarker(coords,u,{balloon,color:ASSIGNED_DRIVER_COLOR,type:'mydriver'});else driverMarker.setPosition({lat:coords[0],lng:coords[1]})}
function managePassengerLocation(){const active=currentUser?.role==='passenger'&&rides.some(r=>String(r.user_id)===String(currentUser.id)&&['accepted','on_the_way'].includes(r.status));if(active)startPassengerLocationSharing();else stopPassengerLocationSharing()}
function renderAllDriverLocations(){if(!map)return;driverMapMarkers.forEach(m=>removeMapMarker(m));driverMapMarkers.clear();const active=activeDriverRide();const activeDriverId=active&&currentUser?.role==='passenger'?String(active.driver_id):'';(mapDrivers||[]).filter(d=>String(d.id)!==String(currentUser?.id||'')&&String(d.id)!==activeDriverId).forEach(d=>{const online=!!d.updated_at&&Date.now()-new Date(String(d.updated_at).replace(' ','T')).getTime()<75000;const balloon=`<b>${icon('car','ui-icon ui-icon-inline')} ${safe(d.username)}</b> · ${icon('star','ui-icon ui-icon-inline')} ${Number(d.rating||0).toFixed(2)}<br><span class="online-state ${online?'is-online':'is-offline'}">● ${online?'Онлайн':'Не в сети'}</span><br>Водитель на карте<br><button class="map-profile-btn" onclick="window.__urfuOpenProfile(${Number(d.id)})">Профиль</button> <button class="map-profile-btn" onclick="window.__urfuOpenDirectChat(${Number(d.id)})">Написать</button>`;driverMapMarkers.set(d.id,placeAvatarMarker([+d.lat,+d.lng],d,{balloon,color:online?'#16a34a':'#64748b'}))})}
function renderPassengerMapLocations(){if(!map)return;passengerMapMarkers.forEach(m=>removeMapMarker(m));passengerMapMarkers.clear();(mapPassengers||[]).forEach(p=>{const online=!!p.updated_at&&Date.now()-new Date(String(p.updated_at).replace(' ','T')).getTime()<75000;const balloon=`<b>${icon('user','ui-icon ui-icon-inline')} ${safe(p.username)}</b> · ${icon('star','ui-icon ui-icon-inline')} ${Number(p.rating||0).toFixed(2)}<br><span class="online-state ${online?'is-online':'is-offline'}">● ${online?'Онлайн':'Не в сети'}</span><br>Местоположение пассажира<br><button class="map-profile-btn" onclick="window.__urfuOpenProfile(${Number(p.id)})">Профиль</button> <button class="map-profile-btn" onclick="window.__urfuOpenDirectChat(${Number(p.id)})">Написать</button>`;passengerMapMarkers.set(p.id,placeAvatarMarker([+p.lat,+p.lng],p,{balloon,color:online?'#16a34a':'#94a3b8'}))});if($('passenger-map-count'))$('passenger-map-count').textContent=ridePassengers().length}
function manageDriverTracking(){if(!currentUser||currentUser.role!=='driver'){stopDriverTracking();return}startDriverTracking()}
function startDriverTracking(){if(driverWatchId!==null)return;if(!navigator.geolocation){toast('Ваш браузер не поддерживает геолокацию водителя');return}const g=$('geo-status');if(g)g.textContent='Геолокация водителя включена';ensureNotifications();const send=async p=>{const now=Date.now();if(now-lastDriverSend<3000)return;lastDriverSend=now;myDriverCoords=[p.coords.latitude,p.coords.longitude];try{await post('update_driver_location',{lat:p.coords.latitude,lng:p.coords.longitude,accuracy:p.coords.accuracy})}catch(e){console.warn('driver location',e.message)}};navigator.geolocation.getCurrentPosition(send,()=>{},{enableHighAccuracy:true,timeout:15000,maximumAge:3000});driverWatchId=navigator.geolocation.watchPosition(send,()=>{},{enableHighAccuracy:true,timeout:15000,maximumAge:3000})}
function stopDriverTracking(){if(driverWatchId!==null){navigator.geolocation.clearWatch(driverWatchId);driverWatchId=null}if(currentUser?.role==='driver')post('clear_driver_location').catch(()=>{})}
function geocodeMissingRideAddresses(){if(!window.google?.maps||!rides.length)return;rides.filter(r=>!String(r.pickup_address||'').trim()).slice(0,30).forEach(async r=>{const a=await geocodeAddress(+r.lat,+r.lng);if(a?.text){r.pickup_address=a.text;renderRideFeed();renderMap()}})}
let futureFocusRouteLine=null;
let futureFocusMarkers=[];
function clearFutureFocusRoute(){
  removeMapMarker(futureFocusRouteLine);futureFocusRouteLine=null;
  futureFocusMarkers.forEach(removeMapMarker);futureFocusMarkers=[];
}
async function focusFutureTrip(id){
  const t=(trips||[]).find(x=>String(x.id)===String(id));
  if(!t)return;
  if(!map)return toast('Карта ещё загружается');
  const from=t.origin_lat!=null&&t.origin_lng!=null?[+t.origin_lat,+t.origin_lng]:null;
  const to=t.destination_lat!=null&&t.destination_lng!=null?[+t.destination_lat,+t.destination_lng]:null;
  if(!from||!to)return toast('Для этой поездки координаты маршрута ещё не указаны');
  clearFutureFocusRoute();
  switchTab('map-tab');
  const color='#e11d48';
  futureFocusMarkers=[
    new google.maps.Marker({map,position:{lat:from[0],lng:from[1]},title:t.origin||'Откуда',icon:markerIcon('#ec4899','start'),zIndex:150}),
    new google.maps.Marker({map,position:{lat:to[0],lng:to[1]},title:t.destination||'Куда',icon:markerIcon('#f59e0b','finish'),zIndex:149})
  ];
  try{
    const path=await getRoadRoute(from,to);
    if(map)futureFocusRouteLine=makeRouteLine(map,path,color);
  }catch(err){
    console.warn('Future trip route failed; keeping straight fallback route',err);
    futureFocusRouteLine=makeRouteLine(map,[{lat:from[0],lng:from[1]},{lat:to[0],lng:to[1]}],color);
  }
  try{map.fitToViewport?.()}catch{}
  if(map.setBounds)map.setBounds([[Math.min(from[0],to[0]),Math.min(from[1],to[1])],[Math.max(from[0],to[0]),Math.max(from[1],to[1])]],{margin:80});
  else{map.setCenter({lat:from[0],lng:from[1]});map.setZoom(Math.max(map.getZoom()||0,15))}
  $('map')?.scrollIntoView({behavior:'smooth',block:'center'});
  toast(`${safe(t.origin||'Откуда')} → ${safe(t.destination||'Куда')}`);
}

// BETA-2.7.2: клик по заявке переносит карту к её маршруту.
function focusRide(uuid){
  const r=rides.find(x=>x.client_uuid===uuid);
  if(!r)return;
  if(!map)return toast('Карта ещё загружается');
  switchTab('map-tab');
  const a=[+r.lat,+r.lng];
  const b=(r.destination_lat!=null&&r.destination_lng!=null)?[+r.destination_lat,+r.destination_lng]:null;
  setTimeout(()=>{
    try{map.fitToViewport?.()}catch{}
    if(b&&map.setBounds)map.setBounds([[Math.min(a[0],b[0]),Math.min(a[1],b[1])],[Math.max(a[0],b[0]),Math.max(a[1],b[1])]]);
    else{map.setCenter({lat:a[0],lng:a[1]});map.setZoom(Math.max(map.getZoom()||0,16))}
    $('map')?.scrollIntoView({behavior:'smooth',block:'center'});
  },120);
  toast(`${safe(r.passenger_name||'Заявка')} — ${r.pickup_address||'точка посадки'}`);
}
function bindRideFocus(root){
  if(!root)return;
  root.querySelectorAll('[data-focus-ride]').forEach(b=>b.onclick=e=>{e.stopPropagation();focusRide(b.dataset.focusRide)});
  root.querySelectorAll('.ride-item[data-ride-uuid]').forEach(card=>card.addEventListener('click',e=>{
    if(e.target.closest('button,a,select,input,textarea,label'))return;
    focusRide(card.dataset.rideUuid);
  }));
}
function statusPill(r){return `<span class="pill ${r.status}">${({pending:'Свободен',accepted:'Занят',on_the_way:'В пути',completed:'Завершено'})[r.status]||r.status}</span>`}
function renderRideFeed(){const box=$('ride-feed');if(!box)return;if(!currentUser){box.innerHTML='<div class="empty-state">Войдите, чтобы создавать и принимать поездки.</div>';return}let list=visibleRides();const order={pending:0,accepted:1,on_the_way:2,completed:3};list.sort((a,b)=>{const am=String(a.user_id)===String(currentUser.id),bm=String(b.user_id)===String(currentUser.id);if(am!==bm)return am?-1:1;return (order[a.status]??9)-(order[b.status]??9)});box.innerHTML=list.length?list.map(r=>{let act='';const mine=String(r.user_id)===String(currentUser.id),assigned=String(r.driver_id)===String(currentUser.id);if(r.status==='completed'&& (mine||assigned)){const target=mine?r.driver_id:r.user_id;const already=ratings.some(x=>String(x.from_user_id)===String(currentUser.id)&&String(x.to_user_id)===String(target)&&x.deleted_at==null&&(!ratingsPerRide||String(x.ride_client_uuid||'')===String(r.client_uuid)));act=already?'<button class="btn btn-light btn-sm" disabled>✓ Отзыв оставлен</button>':`<button class="btn btn-primary btn-sm" data-review-user="${target}" data-review-ride="${safe(r.client_uuid)}">★ Оставить отзыв</button>`;}if(currentUser.role==='driver'&&r.status==='pending'&&!mine)act=`<div class="map-accept-hint">Нажмите на метку пассажира на карте, чтобы принять поездку</div>`;if(currentUser.role==='driver'&&r.status==='accepted'&&assigned)act=driverPickupActions(r);if(currentUser.role==='driver'&&r.status==='on_the_way'&&assigned)act=`<button class="btn btn-light btn-sm" data-ride-done="${safe(r.client_uuid)}">Завершить поездку</button><button class="btn btn-danger btn-sm" data-ride-cancel="${safe(r.client_uuid)}">Отменить поездку</button>`;if(currentUser.role==='passenger'&&mine&&['pending','accepted','on_the_way'].includes(r.status))act=`${r.status==='accepted'&&r.pickup_requested_at?passengerPickupPrompt(r):''}<button class="btn btn-danger btn-sm" data-ride-cancel="${safe(r.client_uuid)}">Отменить поездку</button>${r.status==='on_the_way'?'<div class="driver-alert">Водитель в пути — его аватар отмечен на карте.</div>':''}`;const u={id:r.user_id,username:r.passenger_name,avatar_url:r.passenger_avatar};return `<article class="ride-item ride-clickable ${r.status==='pending'?'ride-free':'ride-busy'}" data-ride-uuid="${safe(r.client_uuid)}" title="Показать маршрут на карте"><div class="ride-top"><button class="user-inline" data-user="${r.user_id}">${avatar(u,'mini-avatar')}<b>${safe(r.passenger_name)}</b></button>${statusPill(r)}</div><div class="route-mini"><span>Посадка</span><b>${safe(r.pickup_address||'Адрес определяется…')}</b></div>${r.destination_text||r.destination_lat?`<div class="route-mini"><span>${icon('flag','ui-icon ui-icon-inline')} Назначение</span><b>${safe(r.destination_text||'Точка на карте')}</b></div>`:''}<p>${safe(r.comment||'Без описания')}</p><small>${r.driver_name?`Водитель: ${safe(r.driver_name)}`:'Свободная заявка'}</small>${r.driver_lat&&r.driver_lng?'<small class="live-location">● Водитель определяется по геолокации — позиция отображается на карте</small>':''}<div class="ride-actions"><button class="btn btn-light btn-sm" data-focus-ride="${safe(r.client_uuid)}"><span class="ui-icon ui-icon-sm" data-icon="pin"></span> К маршруту</button>${act}${currentUser.role==='driver'&&r.status!=='pending'&&assigned?`<button class="btn btn-light btn-sm" data-chat-user="${r.user_id}"><span class="ui-icon ui-icon-sm" data-icon="chat"></span> Чат</button>`:''}</div></article>`}).join(''):'<div class="empty-state">Свободных пассажиров или ваших поездок пока нет.</div>';box.querySelectorAll('[data-ride-accept]').forEach(b=>b.onclick=()=>changeRide(b.dataset.rideAccept,'accepted'));bindPickupButtons(box);box.querySelectorAll('[data-ride-done]').forEach(b=>b.onclick=()=>changeRide(b.dataset.rideDone,'completed'));box.querySelectorAll('[data-ride-cancel]').forEach(b=>b.onclick=()=>cancelRide(b.dataset.rideCancel));box.querySelectorAll('[data-review-user]').forEach(b=>b.onclick=()=>openUserProfile(+b.dataset.reviewUser,b.dataset.reviewRide||''));box.querySelectorAll('[data-user]').forEach(b=>b.onclick=()=>openUserProfile(+b.dataset.user));box.querySelectorAll('[data-chat-user]').forEach(b=>b.onclick=()=>openDirectChat(+b.dataset.chatUser));bindRideFocus(box)}
function formatTripDate(v){const d=new Date(String(v).replace(' ','T'));return isNaN(d)?String(v):d.toLocaleString('ru-RU',{day:'2-digit',month:'long',hour:'2-digit',minute:'2-digit'});}
function tripCardHtml(t){
  const free=Math.max(0,+t.seats_total-+t.booked_seats),mine=bookings.find(b=>+b.trip_id===+t.id&&b.status==='booked');
  let button=+t.driver_id===+currentUser.id?`<button class="btn btn-danger btn-sm" data-cancel-future="${t.id}">Отменить поездку</button>`:mine?`<button class="btn btn-light btn-sm" data-cancel-book="${t.id}">Отменить бронь</button>`:free>0?`<button class="btn btn-primary btn-sm" data-book="${t.id}">Забронировать</button>`:'<span class="pill full">Мест нет</span>';
  const point=t.origin_lat!=null&&t.origin_lng!=null?`<span>${icon('pin','ui-icon ui-icon-inline')} Точки указаны на карте</span>`:'';
  const canShowRoute=t.origin_lat!=null&&t.origin_lng!=null&&t.destination_lat!=null&&t.destination_lng!=null;
  const routeBtn=canShowRoute?`<button class="btn btn-light btn-sm" data-focus-future="${safe(t.id)}"><span class="ui-icon ui-icon-sm" data-icon="route"></span> Отобразить маршрут</button>`:'';
  return `<article class="trip-card"><div class="trip-date">${safe(formatTripDate(t.departure_at))}</div><div class="route"><b>${safe(t.origin)}</b><span>→</span><b>${safe(t.destination)}</b></div><div class="trip-meta"><button class="user-inline" data-user="${t.driver_id}">${avatar({username:t.driver_name,avatar_url:t.driver_avatar},'mini-avatar')}<b>${safe(t.driver_name)}</b></button><span>★ ${Number(t.driver_rating||0).toFixed(2)}</span><span class="seats-left ${free===0?'seats-none':free===1?'seats-one':''}"><span class="ui-icon ui-icon-inline" data-icon="chair"></span> Осталось мест: <b>${free}</b> из ${t.seats_total}</span>${point}</div><div class="trip-action">${button}${routeBtn}<button class="btn btn-light btn-sm" data-chat-user="${t.driver_id}"><span class="ui-icon ui-icon-sm" data-icon="chat"></span> Написать</button></div></article>`;
}
const REPEAT_FOLDER_STORAGE_KEY='urfu4tour_repeat_folder_collapsed_v1';
function getCollapsedRepeatFolders(){
  try{
    const raw=localStorage.getItem(REPEAT_FOLDER_STORAGE_KEY);
    const arr=raw?JSON.parse(raw):[];
    return new Set(Array.isArray(arr)?arr.map(String):[]);
  }catch{return new Set()}
}
function saveCollapsedRepeatFolders(set){
  try{localStorage.setItem(REPEAT_FOLDER_STORAGE_KEY,JSON.stringify([...set]))}catch{}
}

const RIDE_FINDER_STORAGE='urfu4tour_ride_finder_chat';
function loadRideFinderChat(){try{const d=JSON.parse(localStorage.getItem(RIDE_FINDER_STORAGE)||'[]');rideFinderMessages=Array.isArray(d)?d.slice(-20):[]}catch{rideFinderMessages=[]}}
function saveRideFinderChat(){try{localStorage.setItem(RIDE_FINDER_STORAGE,JSON.stringify(rideFinderMessages.slice(-20)))}catch{}}
function finderBookingButton(c){
  if(c.my_booking_id)return `<button class="btn btn-light btn-sm" data-finder-cancelbook="${c.my_booking_id}">Отменить бронь</button>`;
  if((c.free_seats||0)>0)return `<button class="btn btn-primary btn-sm" data-finder-book="${c.id}">Забронировать</button>`;
  return `<span class="pill full">Мест нет</span>`;
}
function finderPickCard(c){
  const when=safe(new Date(String(c.departure_at).replace(' ','T')).toLocaleString('ru-RU',{day:'2-digit',month:'long',hour:'2-digit',minute:'2-digit'}));
  return `<div class="ride-finder-chat-pick"><div class="ride-finder-chat-pick-main">${avatar({username:c.driver_name,avatar_url:c.driver_avatar},'mini-avatar')}<div><b>${safe(c.driver_full_name||c.driver_name)}</b><small>@${safe(c.driver_name)} · ★ ${Number(c.driver_rating||0).toFixed(2)}</small></div></div>`
    +`<div class="ride-finder-route"><b>${safe(c.origin)}</b> → <b>${safe(c.destination)}</b><small>${when} · ${safe(c.reason||'Подходит по направлению и времени')}</small></div>`
    +`<div class="ride-finder-actions"><button class="btn btn-light btn-sm" data-finder-route="${c.id}"><span class="ui-icon ui-icon-sm" data-icon="route"></span> Маршрут</button><button class="btn btn-light btn-sm" data-finder-chat="${c.driver_id}"><span class="ui-icon ui-icon-sm" data-icon="chat"></span> Чат</button>${finderBookingButton(c)}</div></div>`;
}
function renderRideFinder(){
  const box=$('ride-finder-messages');
  if(box){
    const lastAssistant=rideFinderMessages.map((m,i)=>({m,i})).filter(x=>x.m.role==='assistant').at(-1)?.i;
    box.innerHTML=rideFinderMessages.map((m,i)=>{
      let html=`<div class="ride-finder-msg ${m.role==='user'?'mine':''}"><span>${safe(m.content)}</span></div>`;
      if(m.role==='assistant'&&i===lastAssistant&&Array.isArray(rideFinderResult)&&rideFinderResult.length){
        html+=rideFinderResult.map(finderPickCard).join('');
      }
      return html;
    }).join('');
    box.querySelectorAll('[data-finder-route]').forEach(b=>b.onclick=()=>{focusFutureTrip(+b.dataset.finderRoute);minimizeRideFinder()});
    box.querySelectorAll('[data-finder-chat]').forEach(b=>b.onclick=()=>openDirectChat(+b.dataset.finderChat));
    box.querySelectorAll('[data-finder-book]').forEach(b=>b.onclick=async()=>{await bookTrip(+b.dataset.finderBook);await refreshRideFinderResult()});
    box.querySelectorAll('[data-finder-cancelbook]').forEach(b=>b.onclick=async()=>{await cancelBooking(+b.dataset.finderCancelbook);await refreshRideFinderResult()});
  }
  mountStaticIcons();
  if(box)box.scrollTop=box.scrollHeight;
}
async function refreshRideFinderResult(){
  if(!Array.isArray(rideFinderResult)||!rideFinderResult.length)return;
  const current=trips||[], currentBookings=bookings||[];
  rideFinderResult=rideFinderResult.map(c=>{
    const myb=currentBookings.find(b=>+b.trip_id===+c.id&&b.status==='booked');
    const t=current.find(x=>+x.id===+c.id);
    return {...c,my_booking_id:myb?+myb.id:null,free_seats:t?Math.max(0,+t.seats_total-(+t.booked_seats||0)):c.free_seats};
  });
  renderRideFinder();
}
function openRideFinder(){if(!currentUser)return openLogin();const w=$('ride-finder-widget');if(!w)return;rideFinderCollapsed=false;w.classList.remove('hidden','collapsed');renderRideFinder();setTimeout(()=>$('ride-finder-input')?.focus(),50)}
let rideFinderDragState=null;
function initRideFinderDrag(){
  const w=$('ride-finder-widget');if(!w||w.dataset.dragBound)return;w.dataset.dragBound='1';
  let moved=false;
  const down=e=>{if(!w.classList.contains('collapsed'))return;const p=e.touches?e.touches[0]:e;const r=w.getBoundingClientRect();rideFinderDragState={dx:p.clientX-r.left,dy:p.clientY-r.top};moved=false;document.addEventListener('pointermove',move);document.addEventListener('pointerup',up)};
  const move=e=>{if(!rideFinderDragState)return;const p=e.touches?e.touches[0]:e;const size=w.offsetWidth||60;let left=p.clientX-rideFinderDragState.dx,top=p.clientY-rideFinderDragState.dy;left=Math.max(6,Math.min(window.innerWidth-size-6,left));top=Math.max(6,Math.min(window.innerHeight-size-6,top));w.style.left=left+'px';w.style.top=top+'px';w.style.right='auto';w.style.bottom='auto';moved=true};
  const up=()=>{rideFinderDragState=null;document.removeEventListener('pointermove',move);document.removeEventListener('pointerup',up);if(moved)w.dataset.justDragged='1';setTimeout(()=>{delete w.dataset.justDragged},60)};
  w.addEventListener('pointerdown',down);
}
function minimizeRideFinder(){const w=$('ride-finder-widget');if(!w)return;rideFinderCollapsed=true;w.classList.add('collapsed');w.classList.remove('hidden')}
function restoreRideFinder(){const w=$('ride-finder-widget');if(!w)return;rideFinderCollapsed=false;w.style.left='';w.style.top='';w.style.right='';w.style.bottom='';w.classList.remove('hidden','collapsed');renderRideFinder()}
async function sendRideFinder(){
  if(!currentUser)return openLogin();const input=$('ride-finder-input');const text=String(input?.value||'').trim();if(!text)return;
  rideFinderMessages.push({role:'user',content:text});saveRideFinderChat();if(input)input.value='';renderRideFinder();const btn=$('ride-finder-send');if(btn){btn.disabled=true;btn.textContent='Ищу…'}
  try{
    const d=await post('gigachat_ride_finder',{message:text,history:rideFinderMessages.slice(-9,-1)});
    rideFinderMessages.push({role:'assistant',content:d.assistant||'Вот подходящие варианты.'});
    rideFinderResult=Array.isArray(d.candidates)?d.candidates:[];
    saveRideFinderChat();renderRideFinder();
  }catch(e){rideFinderMessages.push({role:'assistant',content:e.message||'Не удалось выполнить поиск.'});saveRideFinderChat();renderRideFinder()}
  finally{if(btn){btn.disabled=false;btn.textContent='Найти'}}
}
function focusPassengerLocation(id){
  const pid=Number(id);const p=(mapPassengers||[]).find(x=>Number(x.id)===pid);
  if(!map)return toast('Откройте карту, чтобы показать местоположение попутчика');
  if(!p||!Number.isFinite(+p.lat)||!Number.isFinite(+p.lng))return toast('Местоположение попутчика пока недоступно');
  map.setCenter({lat:+p.lat,lng:+p.lng});map.setZoom(Math.max(map.getZoom()||0,16));
  const marker=passengerMapMarkers.get(pid);if(marker?.openBalloon)marker.openBalloon();
  switchTab('map-tab');toast(`${p.username||'Попутчик'} — местоположение показано на карте`);
}
window.__urfuFocusPassengerLocation=focusPassengerLocation;

function renderTrips(){
  const box=$('future-trips-feed');
  if(!box)return;
  if(!currentUser){box.innerHTML='<div class="empty-state">Войдите, чтобы бронировать места.</div>';return}
  const collapsedFolders=getCollapsedRepeatFolders();
  const groups=new Map(),singles=[];
  (trips||[]).forEach(t=>{
    const g=String(t.repeat_group||'').trim();
    if(g){if(!groups.has(g))groups.set(g,[]);groups.get(g).push(t)}
    else singles.push(t)
  });
  let html='';
  groups.forEach((arr,g)=>{
    arr.sort((a,b)=>String(a.departure_at).localeCompare(String(b.departure_at)));
    const first=arr[0],weeks=new Map();
    arr.forEach(t=>{
      const d=new Date(String(t.departure_at).replace(' ','T')),base=new Date(String(first.departure_at).replace(' ','T'));
      const diff=Math.max(0,Math.floor((new Date(d.getFullYear(),d.getMonth(),d.getDate())-new Date(base.getFullYear(),base.getMonth(),base.getDate()))/604800000));
      const wk=Math.floor(diff/1)+1;
      if(!weeks.has(wk))weeks.set(wk,[]);
      weeks.get(wk).push(t)
    });
    const isCollapsed=collapsedFolders.has(String(g));
    html+=`<section class="trip-folder" data-repeat-folder="${safe(g)}"><div class="trip-folder-head"><div><span class="eyebrow">Регулярный маршрут</span><h3>${safe(first.origin)} <span>→</span> ${safe(first.destination)}</h3><small>${arr.length} поездок · ${weeks.size} нед.</small></div><button type="button" class="btn btn-light btn-sm trip-folder-toggle" aria-expanded="${isCollapsed?'false':'true'}">${isCollapsed?'Развернуть':'Свернуть'}</button></div><div class="trip-folder-body ${isCollapsed?'hidden':''}">${[...weeks.entries()].map(([wk,items])=>`<div class="trip-week"><div class="trip-week-title">Неделя ${wk}</div>${items.map(tripCardHtml).join('')}</div>`).join('')}</div></section>`
  });
  html+=singles.sort((a,b)=>String(a.departure_at).localeCompare(String(b.departure_at))).map(tripCardHtml).join('');
  box.innerHTML=html||'<div class="empty-state">Будущих поездок пока нет.</div>';
  box.querySelectorAll('.trip-folder-toggle').forEach(b=>b.onclick=()=>{
    const folder=b.closest('.trip-folder'),body=folder?.querySelector('.trip-folder-body');
    if(!folder||!body)return;
    const key=String(folder.dataset.repeatFolder||'');
    const collapsed=body.classList.toggle('hidden');
    const set=getCollapsedRepeatFolders();
    if(collapsed)set.add(key);else set.delete(key);
    saveCollapsedRepeatFolders(set);
    b.textContent=collapsed?'Развернуть':'Свернуть';
    b.setAttribute('aria-expanded',String(!collapsed))
  });
  box.querySelectorAll('[data-focus-future]').forEach(b=>b.onclick=e=>{e.stopPropagation();focusFutureTrip(b.dataset.focusFuture)});
  box.querySelectorAll('[data-book]').forEach(b=>b.onclick=()=>bookTrip(+b.dataset.book));
  box.querySelectorAll('[data-cancel-book]').forEach(b=>b.onclick=()=>cancelBooking(+b.dataset.cancelBook));
  box.querySelectorAll('[data-cancel-future]').forEach(b=>b.onclick=()=>cancelFutureTrip(+b.dataset.cancelFuture));
  box.querySelectorAll('[data-booking-chat]').forEach(b=>b.onclick=()=>openBookingChat(+b.dataset.bookingChat));
  box.querySelectorAll('[data-user]').forEach(b=>b.onclick=()=>openUserProfile(+b.dataset.user));
  box.querySelectorAll('[data-chat-user]').forEach(b=>b.onclick=()=>openDirectChat(+b.dataset.chatUser));
}
function renderBookings(){const box=$('my-bookings-feed');if(!box)return;if(!currentUser){box.innerHTML='<div class="empty-state">Войдите в аккаунт.</div>';return}box.innerHTML=bookings.length?bookings.map(b=>{const active=b.status==='booked';return `<article class="trip-card booking-card ${active?'booking-active':'booking-cancelled'}"><div class="trip-date">${active?'Активная бронь':'Бронь отменена'}</div><div class="route"><b>${safe(b.origin)}</b><span>→</span><b>${safe(b.destination)}</b></div><div class="trip-meta"><button class="user-inline" data-user="${b.driver_id}">${avatar({username:b.driver_name,avatar_url:b.driver_avatar},'mini-avatar')}<b>${safe(b.driver_name)}</b></button><span>${safe(new Date(b.departure_at.replace(' ','T')).toLocaleString('ru-RU',{day:'2-digit',month:'long',hour:'2-digit',minute:'2-digit'}))}</span></div><div class="trip-action">${active?`<button class="btn btn-danger btn-sm" data-cancel-book="${b.id}">Удалить бронь</button><button class="btn btn-light btn-sm" data-booking-chat="${b.id}"><span class="ui-icon ui-icon-sm" data-icon="chat"></span> Чат брони</button>`:'<span class="pill full">Отменена</span>'}</div></article>`}).join(''):'<div class="empty-state">У вас пока нет бронирований.</div>';box.querySelectorAll('[data-cancel-book]').forEach(b=>b.onclick=()=>cancelBooking(+b.dataset.cancelBook));box.querySelectorAll('[data-cancel-future]').forEach(b=>b.onclick=()=>cancelFutureTrip(+b.dataset.cancelFuture));box.querySelectorAll('[data-booking-chat]').forEach(b=>b.onclick=()=>openBookingChat(+b.dataset.bookingChat));box.querySelectorAll('[data-user]').forEach(b=>b.onclick=()=>openUserProfile(+b.dataset.user))}
function renderUsers(){const box=$('users-grid');if(!box)return;const q=String($('users-search')?.value||'').trim().toLowerCase().replace(/^@/,'');const list=(users||[]).filter(u=>!q||String(u.username||'').toLowerCase().includes(q)||String(u.full_name||'').toLowerCase().includes(q));box.innerHTML=list.length?list.map(u=>`<article class="user-card"><button class="user-card-main" data-user="${u.id}">${avatar(u,'user-card-avatar')}<div><h3>${safe(u.full_name||u.username)}</h3><p>@${safe(u.username)} · <span class="online-state ${u.is_online?'is-online':'is-offline'}">● ${u.is_online?'Онлайн':'Не в сети'}</span> · ⭐ ${Number(u.rating||0).toFixed(2)}</p></div></button><div class="user-card-actions"><button class="btn btn-light btn-sm" data-user="${u.id}">Профиль</button>${currentUser&&String(u.id)!==String(currentUser.id)?`<button class="btn btn-primary btn-sm" data-chat-user="${u.id}"><span class="ui-icon ui-icon-sm" data-icon="chat"></span> Личный чат</button>`:''}</div></article>`).join(''):'<div class="empty-state">Ничего не найдено.</div>';box.querySelectorAll('[data-user]').forEach(b=>b.onclick=()=>openUserProfile(+b.dataset.user));box.querySelectorAll('[data-chat-user]').forEach(b=>b.onclick=()=>openDirectChat(+b.dataset.chatUser))} 
function renderDirectChatsList(){const box=$('direct-chats-list');if(!box)return;if(!currentUser){box.innerHTML='<div class="empty-state">Войдите в аккаунт, чтобы видеть личные чаты.</div>';return}const mapChats=new Map();messages.filter(m=>m.ride_client_uuid==='__direct__').forEach(m=>{const other=String(m.sender_id)===String(currentUser.id)?String(m.recipient_id):String(m.sender_id);if(!other||other==='null')return;const u=users.find(x=>String(x.id)===other);if(u){const unread=messages.filter(mm=>mm.ride_client_uuid==='__direct__'&&String(mm.sender_id)===other&&String(mm.recipient_id)===String(currentUser.id)&&mm.read_at===null).length;mapChats.set(other,{u,last:m,unread})}});const arr=[...mapChats.values()].sort((a,b)=>String(b.last.created_at).localeCompare(String(a.last.created_at)));box.innerHTML=arr.length?arr.map(x=>`<button class="chat-list-item" data-chat-user="${x.u.id}">${avatar(x.u,'user-card-avatar')}<span><b>${safe(x.u.full_name||x.u.username)}</b><small>${safe(x.last.message)}</small></span><time>${x.unread?`<span class="unread-mini">${x.unread}</span>`:''}${new Date(x.last.created_at.replace(' ','T')).toLocaleTimeString('ru-RU',{hour:'2-digit',minute:'2-digit'})}</time></button>`).join(''):'<div class="empty-state">Личных чатов пока нет. Откройте профиль пользователя и нажмите «Личный чат».</div>';box.querySelectorAll('[data-chat-user]').forEach(b=>b.onclick=()=>openDirectChat(+b.dataset.chatUser))} 
function renderChat(){const box=$('community-global-messages');if(!box)return;const arr=messages.filter(m=>m.ride_client_uuid==='__global__');box.innerHTML=arr.length?arr.map(m=>`<div class="gmsg"><button class="user-inline" data-user="${m.sender_id}">${avatar({username:m.sender_name,avatar_url:m.sender_avatar},'mini-avatar')}<b>${safe(m.sender_name)}</b></button><span>${safe(m.message)}</span><time>${new Date(m.created_at.replace(' ','T')).toLocaleTimeString('ru-RU',{hour:'2-digit',minute:'2-digit'})}</time></div>`).join(''):'<div class="empty-state">Начните разговор.</div>';box.querySelectorAll('[data-user]').forEach(b=>b.onclick=()=>openUserProfile(+b.dataset.user));box.scrollTop=box.scrollHeight}
function renderDirectChat(){const box=$('direct-chat-messages');if(!box||!currentChatUser)return;const arr=messages.filter(m=>m.ride_client_uuid==='__direct__'&&((String(m.sender_id)===String(currentUser.id)&&String(m.recipient_id)===String(currentChatUser.id))||(String(m.sender_id)===String(currentChatUser.id)&&String(m.recipient_id)===String(currentUser.id))));box.innerHTML=arr.length?arr.map(m=>{const bookingLoc=String(m.message||'').startsWith('[URFU_BOOKING_LOCATION]');const clean=bookingLoc?String(m.message).replace(/^\[URFU_BOOKING_LOCATION\]\s*/,''):String(m.message);const action=bookingLoc&&String(m.sender_id)!==String(currentUser.id)?`<button class="btn btn-light btn-sm booking-location-btn" data-booking-passenger="${Number(m.sender_id)}">⌖ Показать местоположение попутчика</button>`:'';return `<div class="gmsg ${String(m.sender_id)===String(currentUser.id)?'mine':''}">${avatar({username:m.sender_name,avatar_url:m.sender_avatar},'mini-avatar')}<span>${safe(clean)}${action}</span><time>${new Date(m.created_at.replace(' ','T')).toLocaleTimeString('ru-RU',{hour:'2-digit',minute:'2-digit'})}</time></div>`}).join(''):'<div class="empty-state">Напишите первое сообщение.</div>';box.querySelectorAll('[data-booking-passenger]').forEach(b=>b.onclick=()=>focusPassengerLocation(+b.dataset.bookingPassenger));box.scrollTop=box.scrollHeight}
function renderRatings(){const top=$('top-rating-list');if(top){const ranked=[...users].sort((a,b)=>Number(b.rating||0)-Number(a.rating||0)||String(a.username).localeCompare(String(b.username)));top.innerHTML=ranked.length?ranked.map((u,i)=>{const count=ratings.filter(r=>String(r.to_user_id)===String(u.id)).length;return `<button class="top-rating-item ${i<3?'top-'+(i+1):''}" data-user="${u.id}"><span class="top-rank">${i+1}</span>${avatarSoft(u,'top-rating-avatar')}<span class="top-rating-main"><b>${safe(u.full_name||u.username)}</b><small>@${safe(u.username)} · ${u.role==='driver'?'Водитель':'Пассажир'} · ${count} отзывов</small></span><strong>★ ${Number(u.rating||0).toFixed(2)}</strong></button>`}).join(''):'<div class="empty-state">Рейтинг пока пуст.</div>';top.querySelectorAll('[data-user]').forEach(b=>b.onclick=()=>openUserProfile(+b.dataset.user));}
}
function renderCommunity(){renderChat();renderDirectChatsList();renderRatings();renderUsers()}
function openCommunityView(view){document.querySelectorAll('.community-view').forEach(x=>x.classList.add('hidden'));const menu=$('community-menu');if(view){menu?.classList.add('hidden');$('community-view-'+view)?.classList.remove('hidden');}else{menu?.classList.remove('hidden');}}
function renderProfilePage(){
  const box=$('profile-page'); if(!box)return;
  if(!currentUser){box.innerHTML=`<div class="profile-page-guest card"><div class="profile-page-icon">${icon('user')}</div><h2>Профиль</h2><p>Войдите, чтобы управлять профилем, поездками и настройками.</p><div class="profile-guest-actions"><button class="btn btn-primary" id="profile-page-login">Войти</button><button class="btn btn-light" id="profile-page-register">Регистрация</button></div></div>`;$('profile-page-login')?.addEventListener('click',openLogin);$('profile-page-register')?.addEventListener('click',openRegister);return;}
  const mine=ratings.filter(r=>String(r.to_user_id)===String(currentUser.id));
  const completed=rides.filter(r=>String(r.user_id)===String(currentUser.id)||String(r.driver_id)===String(currentUser.id)).filter(r=>r.status==='completed').length;
  box.innerHTML=`<div class="profile-page-shell"><div class="profile-cover"><div class="profile-main-head">${avatar(currentUser,'profile-page-avatar')}<div class="profile-page-name"><h1>${safe(currentUser.full_name||currentUser.username)}</h1><p>@${safe(currentUser.username)} · ${currentUser.role==='driver'?'Водитель':'Студент УрФУ'}</p></div><button class="profile-edit-circle" id="profile-page-edit" aria-label="Редактировать профиль">${icon('pencil')}</button></div><div class="profile-stats"><div><strong>★ ${Number(currentUser.rating||0).toFixed(1)}</strong><span>Рейтинг</span></div><div><strong>${completed}</strong><span>Поездки</span></div><div><strong>${mine.length}</strong><span>Отзывы</span></div></div></div><div class="profile-section"><h3>Мои контакты</h3><div class="profile-social-grid">${socialContactLink('tg','Telegram',currentUser.telegram_contact,'https://t.me/')||'<span class="social-empty">Telegram</span>'}${socialContactLink('vk','VK',currentUser.vk_contact,'https://vk.com/')||'<span class="social-empty">VK</span>'}${socialContactLink('max','MAX',currentUser.max_contact,'https://max.ru/')||'<span class="social-empty">MAX</span>'}</div>${currentUser.phone?`<div class="profile-phone">${icon('phone','ui-icon ui-icon-inline')} ${safe(currentUser.phone)}</div>`:''}</div><div class="profile-menu-list"><button data-profile-action="trips"><span class="menu-icon">${icon('car')}</span><b>Мои поездки</b><i>›</i></button><button data-profile-action="rating"><span class="menu-icon">${icon('star')}</span><b>Мой рейтинг</b><i>›</i></button><button data-profile-action="settings"><span class="menu-icon">${icon('settings')}</span><b>Настройки</b><i>›</i></button><button data-profile-action="help"><span class="menu-icon">${icon('help')}</span><b>Помощь</b><i>›</i></button></div>${currentUser.bio?`<div class="profile-bio-card"><h3>О себе</h3><p>${safe(currentUser.bio)}</p></div>`:''}<div class="profile-page-actions"><button class="btn btn-light" id="profile-role-switch">Сейчас: ${currentUser.role==='driver'?'Водитель':'Пассажир'} · Сменить</button><button class="btn btn-danger" id="profile-page-logout">Выйти</button></div><form id="profile-page-form" class="profile-form ${profileEditOpen?'':'hidden'}"><div class="profile-form-head"><div><h3>Изменить профиль</h3><p>Обновите имя, фото, контакты и описание.</p></div><button type="button" class="btn btn-light btn-sm" id="profile-page-cancel">Отмена</button></div><label>Имя пользователя<input id="profile-username" value="${safe(currentUser.username)}" maxlength="32" required></label><label>Аватар<div class="avatar-edit-row">${avatar(currentUser,'account-avatar')}<label class="avatar-file-picker" for="profile-avatar-file"><span class="ui-icon ui-icon-sm" data-icon="plus"></span><span>Выбрать файл</span></label><input id="profile-avatar-file" class="avatar-file-input" type="file" accept="image/jpeg,image/png,image/webp,image/gif"></div></label><label>Имя / ФИО<input id="profile-full-name" value="${safe(currentUser.full_name)}" maxlength="150"></label><label>Телефон<input id="profile-phone" value="${safe(currentUser.phone)}" maxlength="50"></label><h3>Соцсети</h3><label>MAX<input id="profile-max" value="${safe(currentUser.max_contact)}" placeholder="@username или ссылка"></label><label>VK<input id="profile-vk" value="${safe(currentUser.vk_contact)}" placeholder="@username или ссылка"></label><label>Telegram<input id="profile-tg" value="${safe(currentUser.telegram_contact)}" placeholder="@username или ссылка"></label><label>О себе<textarea id="profile-bio" maxlength="500">${safe(currentUser.bio)}</textarea></label><button class="btn btn-primary full-width" type="submit">Сохранить изменения</button></form></div>`;
  $('profile-page-edit')?.addEventListener('click',()=>{profileEditOpen=true;const f=$('profile-page-form');f?.classList.remove('hidden');f?.scrollIntoView({behavior:'smooth',block:'start'});initAvatarCrop()});
  $('profile-page-cancel')?.addEventListener('click',()=>{profileEditOpen=false;$('profile-page-form')?.classList.add('hidden')});
  $('profile-page-form')?.addEventListener('submit',e=>{e.preventDefault();saveProfile()});
  $('profile-page-logout')?.addEventListener('click',logout);$('profile-role-switch')?.addEventListener('click',switchRole);
  document.querySelectorAll('[data-profile-action]').forEach(b=>b.onclick=()=>{const a=b.dataset.profileAction;if(a==='trips')switchTab('trips-tab');else if(a==='rating'){switchTab('community-tab');openCommunityView('rating')}else if(a==='settings'){profileEditOpen=true;$('profile-page-form')?.classList.remove('hidden');$('profile-page-form')?.scrollIntoView({behavior:'smooth',block:'start'})}else if(a==='help'){openModal('help-modal')}else toast('Раздел помощи: напишите в общий чат сообщества.')});
  initAvatarCrop();
}
function renderAll(){renderMap();renderRideFeed();renderTrips();renderBookings();renderCommunity();if(!profileEditOpen||!$('profile-page-form'))renderProfilePage();renderDirectChat();updateRoleUI();updateRideControls();renderTripMapMarkers();$('my-passengers-nav')?.classList.toggle('hidden',currentUser?.role!=='driver');mountStaticIcons();geocodeMissingRideAddresses()}
function updateRideControls(){const c=$('passenger-controls');if(!c)return;const pass=currentUser?.role==='passenger';c.classList.toggle('hidden',!pass);$('remove-my-location')?.classList.toggle('hidden',!pass||!selectedCoords);const b=$('add-marker-btn');if(!b)return;b.disabled=rideSubmitting||!selectedCoords||!destinationCoords;b.textContent=rideSubmitting?'Создаём…':'Создать заявку'}
function updateUserUI(){updateRoleUI()}
function updateRoleUI(){const badge=$('user-info-badge');if(badge)badge.innerHTML=currentUser?`${avatarSoft(currentUser,'topbar-avatar')}<span>${safe(currentUser.username)}</span>`:'Войти';document.querySelectorAll('#role-switch button').forEach(b=>b.classList.toggle('active',currentUser?.role===b.dataset.role));const title=$('side-title'),sub=$('side-subtitle');if(title)title.textContent=currentUser?.role==='driver'?(driverViewMode==='all'?'Все пассажиры':'Свободные пассажиры'):'Пассажиры и мои заявки';if(sub)sub.textContent=currentUser?.role==='driver'?'Выберите режим просмотра пассажиров. Зелёные — свободны, красные — заняты.':'В режиме пассажира можно видеть других пассажиров и открывать их профили.';const controls=$('driver-view-controls');if(controls)controls.classList.toggle('hidden',currentUser?.role!=='driver');$('legend-mydriver')?.classList.toggle('hidden',currentUser?.role!=='passenger');const sel=$('driver-view-mode');if(sel)sel.value=driverViewMode;}
function openModal(id){$(id)?.classList.remove('hidden')}function closeModal(id){$(id)?.classList.add('hidden')}function closeAuth(){closeModal('login-modal');closeModal('register-modal')}
function openLogin(){closeAuth();closeModal('lk-modal');openModal('login-modal');setTimeout(()=>$('login-username')?.focus(),50)}function openRegister(){closeAuth();closeModal('lk-modal');openModal('register-modal');setTimeout(()=>$('register-username')?.focus(),50)}
async function loginSubmit(e){e.preventDefault();const err=$('login-error');err?.classList.add('hidden');try{ensureNotifications();const d=await post('register_login',{mode:'login',username:$('login-username').value.trim().replace(/^@/, ''),password:$('login-password').value});currentUser=d.user;csrfToken=d.csrf_token||csrfToken;closeAuth();$('login-form').reset();renderAll();await sync();toast('Вы вошли в аккаунт')}catch(e){if(err){err.textContent=e.message;err.classList.remove('hidden')}}}
async function registerSubmit(e){e.preventDefault();const err=$('register-error');err?.classList.add('hidden');try{ensureNotifications();const d=await post('register_login',{mode:'register',username:$('register-username').value.trim().replace(/^@/, ''),password:$('register-password').value,accepted_terms:$('register-terms')?.checked===true});currentUser=d.user;csrfToken=d.csrf_token||csrfToken;closeAuth();$('register-form').reset();renderAll();await sync();toast('Аккаунт создан')}catch(e){if(err){err.textContent=e.message;err.classList.remove('hidden')}}}
function toggleTheme(){const dark=document.documentElement.classList.toggle('dark');localStorage.setItem('urfu4tour_theme',dark?'dark':'light');const b=$('theme-toggle');if(b)b.innerHTML=icon(dark?'sun':'moon');setTimeout(()=>{try{map?.fitToViewport?.();tripMap?.fitToViewport?.()}catch{}},60)}
function initTheme(){const dark=localStorage.getItem('urfu4tour_theme')==='dark';document.documentElement.classList.toggle('dark',dark);const b=$('theme-toggle');if(b)b.innerHTML=icon(dark?'sun':'moon')}
function openAIMap(){if(!currentUser)return openLogin();openModal('ai-map-modal');setTimeout(()=>$('ai-map-query')?.focus(),80)}
async function runAIMapCommand(){if(aiMapBusy)return;const input=$('ai-map-query'),result=$('ai-map-result'),q=input?.value.trim()||'';if(!q)return toast('Напишите, что нужно поставить на карте');aiMapBusy=true;if(result)result.innerHTML='<div class="ai-map-loading">ИИ определяет адрес…</div>';const btn=$('ai-map-run');if(btn)btn.disabled=true;try{const d=await post('ai_map_command',{query:q});const c=d.command||{};let done=[];if(c.pickup){const a=await geocodeTextAddress(c.pickup);if(a){await selectPickup(a.lat,a.lng,false);done.push(`Посадка: ${a.text}`)}else throw Error(`Не удалось найти место посадки: ${c.pickup}`)}if(c.destination){const a=await geocodeTextAddress(c.destination);if(a){await selectDestination(a.lat,a.lng,true);done.push(`Назначение: ${a.text}`)}else throw Error(`Не удалось найти место назначения: ${c.destination}`)}if(!done.length)throw Error('ИИ не нашёл адрес в запросе. Уточните место.');if(result)result.innerHTML=`<div class="ai-map-success">✓ ${done.map(s=>safe(s)).join('<br>')}</div>`;toast('Точки установлены на карте')}catch(e){if(result)result.innerHTML=`<div class="ai-map-error">${safe(e.message||'Не удалось обработать запрос')}</div>`;toast(e.message||'Не удалось обработать запрос')}finally{aiMapBusy=false;if(btn)btn.disabled=false}}
async function geocodeTextAddress(address){if(!window.google?.maps)return null;try{const geocoder=new google.maps.Geocoder();const {results}=await geocoder.geocode({address:String(address),region:'RU',language:'ru'});const r=results?.[0];if(!r)return null;const p=r.geometry.location;return {lat:p.lat(),lng:p.lng(),text:String(r.formatted_address||address).replace(/^Россия,?\s*/i,'').trim()}}catch(e){console.warn('AI geocoding failed',e);return null}}
function parseAIQuery(){return {from:'',to:''}}
function runAI(){return openAIMap()}
function quickRoute(v){const [from,to]=String(v).split('|');if(!currentUser)return openLogin();if(currentUser.role!=='passenger')return toast('Переключитесь в режим пассажира');const q=$('destination-text');if(q)q.value=to;window.destinationAddress=to;toast(`Маршрут: ${from} → ${to}. Укажите точки на карте для точного адреса.`);choosePickupMode()}

async function switchRole(){if(!currentUser)return;try{if(currentUser.role==='driver')stopDriverTracking();const d=await post('switch_role');currentUser=d.user;csrfToken=d.csrf_token||csrfToken;merge(d.server_data||{});toast(`Режим изменён: ${currentUser.role==='driver'?'водитель':'пассажир'}`)}catch(e){toast(e.message)}}
async function addRide(){if(!currentUser)return openLogin();if(currentUser.role!=='passenger')return toast('Переключитесь в режим пассажира');if(!selectedCoords)return toast('Сначала укажите место посадки');if(!destinationCoords)return toast('Укажите точку назначения на карте');if(rideSubmitting)return;if(rides.some(r=>String(r.user_id)===String(currentUser.id)&&!r.deleted_at&&['pending','accepted','on_the_way'].includes(r.status)))return toast('У вас уже есть активная заявка');rideSubmitting=true;const btn=$('add-marker-btn');if(btn){btn.disabled=true;btn.textContent='Создаём…'}try{const d=await post('create_ride',{client_uuid:uid(),lat:selectedCoords[0],lng:selectedCoords[1],destination_lat:destinationCoords[0],destination_lng:destinationCoords[1],pickup_address:window.pickupAddress||'',destination_text:$('destination-text')?.value.trim()||window.destinationAddress||'Точка назначения',comment:$('ride-comment').value.trim()||'Без дополнительного описания'});merge(d.server_data||{});toast('Заявка создана')}catch(e){toast(e.message)}finally{rideSubmitting=false;updateRideControls()}}
async function cancelRide(id){if(!confirm('Отменить эту поездку?'))return;try{const d=await post('ride_status',{client_uuid:id,status:'cancelled'});merge(d.server_data||{});toast('Поездка отменена')}catch(e){toast(e.message)}}
function pickupWaitSeconds(r){const t=r?.pickup_requested_at?Date.parse(String(r.pickup_requested_at).replace(' ','T')):0;return t?Math.max(0,Math.round((Date.now()-t)/1000)):0}
function driverPickupActions(r){
  const id=safe(r.client_uuid),cancel=`<button class="btn btn-danger btn-sm" data-ride-cancel="${id}">Отменить поездку</button>`;
  if(!pickupFlowReady)return `<div class="pickup-wait"><b>Подтверждение подбора недоступно</b><span>Не выполнена миграция migration_2026_09_beta_2_7.sql.</span></div>${cancel}`;
  if(!r.pickup_requested_at)return `<button class="btn btn-primary btn-sm" data-ride-pickup="${id}"><span class="ui-icon ui-icon-sm" data-icon="car"></span> Подобрал пассажира</button>${cancel}`;
  const waited=pickupWaitSeconds(r),left=Math.max(0,pickupForceAfterSec-waited);
  const force=left?`<span>Начать без подтверждения можно через ${Math.max(1,Math.ceil(left/60))} мин.</span>`:`<button class="btn btn-light btn-sm" data-pickup-force="${id}">Начать без подтверждения</button>`;
  return `<div class="pickup-wait"><b>Ждём подтверждения пассажира</b><span>Запрос отправлен ${waited} сек. назад.</span><div class="pickup-wait-actions"><button class="btn btn-light btn-sm" data-pickup-cancel="${id}">Отменить запрос</button>${force}</div></div>${cancel}`;
}
function passengerPickupPrompt(r){
  const id=safe(r.client_uuid);
  return `<div class="pickup-wait"><b>${safe(r.driver_name||'Водитель')} отметил, что подобрал вас</b><span>Подтвердите — поездка начнётся и станет синей на карте.</span><div class="pickup-wait-actions"><button class="btn btn-primary btn-sm" data-pickup-confirm="${id}">Да, я в машине</button><button class="btn btn-light btn-sm" data-pickup-decline="${id}">Нет, ещё не подобрал</button></div></div>`;
}
function bindPickupButtons(root){
  if(!root)return;
  root.querySelectorAll('[data-ride-pickup]').forEach(b=>b.onclick=()=>requestPickup(b.dataset.ridePickup));
  root.querySelectorAll('[data-pickup-cancel]').forEach(b=>b.onclick=()=>cancelPickupRequest(b.dataset.pickupCancel));
  root.querySelectorAll('[data-pickup-force]').forEach(b=>b.onclick=()=>forcePickup(b.dataset.pickupForce));
  root.querySelectorAll('[data-pickup-confirm]').forEach(b=>b.onclick=()=>confirmPickup(b.dataset.pickupConfirm));
  root.querySelectorAll('[data-pickup-decline]').forEach(b=>b.onclick=()=>declinePickup(b.dataset.pickupDecline));
}
function currentPositionOnce(){return new Promise(res=>{if(!navigator.geolocation)return res(null);navigator.geolocation.getCurrentPosition(p=>res(p),()=>res(null),{enableHighAccuracy:true,timeout:8000,maximumAge:5000})})}
async function requestPickup(id){
  if(currentUser?.role!=='driver')return toast('Доступно водителю');
  const pos=await currentPositionOnce();
  if(pos){myDriverCoords=[pos.coords.latitude,pos.coords.longitude];try{await post('update_driver_location',{lat:pos.coords.latitude,lng:pos.coords.longitude,accuracy:pos.coords.accuracy})}catch{}}
  try{const d=await post('request_pickup',{client_uuid:id,accuracy:pos?Math.min(120,pos.coords.accuracy||0):0});merge(d.server_data||{});toast('Запрос отправлен пассажиру')}catch(e){toast(e.message)}
}
async function cancelPickupRequest(id){try{const d=await post('cancel_pickup_request',{client_uuid:id});merge(d.server_data||{});toast('Запрос отменён')}catch(e){toast(e.message)}}
async function forcePickup(id){if(!confirm('Начать поездку без подтверждения пассажира?'))return;try{const d=await post('force_pickup',{client_uuid:id});merge(d.server_data||{});toast('Поездка начата')}catch(e){toast(e.message)}}
async function confirmPickup(id){try{const d=await post('confirm_pickup',{client_uuid:id});closeModal('pickup-confirm-modal');merge(d.server_data||{});toast('Поездка началась')}catch(e){toast(e.message)}}
async function declinePickup(id){try{const d=await post('cancel_pickup_request',{client_uuid:id});closeModal('pickup-confirm-modal');merge(d.server_data||{});toast('Вы отклонили подтверждение')}catch(e){toast(e.message)}}
function maybePromptPickupConfirm(){
  const r=rideAwaitingMyConfirm();
  const box=$('pickup-confirm-content');
  if(!r){if(pickupPromptShown.size)pickupPromptShown.clear();if(!$('pickup-confirm-modal')?.classList.contains('hidden'))closeModal('pickup-confirm-modal');return}
  if(!box||pickupPromptShown.has(r.client_uuid))return;
  pickupPromptShown.add(r.client_uuid);
  box.innerHTML=`<div class="section-title compact"><div><h2>Водитель вас подобрал?</h2></div></div><div class="pickup-confirm-body"><div class="pickup-confirm-route"><b>${safe(r.driver_name||'Водитель')}</b> отметил, что вы сели в машину.<br>Посадка: ${safe(r.pickup_address||'точка на карте')}</div><div class="pickup-confirm-actions"><button class="btn btn-primary" data-pickup-confirm="${safe(r.client_uuid)}">Да, я в машине</button><button class="btn btn-light" data-pickup-decline="${safe(r.client_uuid)}">Нет, ещё не подобрал</button></div></div>`;
  bindPickupButtons(box);
  openModal('pickup-confirm-modal');
}
function pickupPassenger(id){if(currentUser?.role!=='driver')return toast('Подбор пассажира доступен водителю');changeRide(id,'accepted')}
window.__urfuPickupPassenger=pickupPassenger;
async function changeRide(id,status){try{const d=await post('ride_status',{client_uuid:id,status});merge(d.server_data||{});toast(status==='accepted'?'Пассажир закреплён за вами':status==='on_the_way'?'Вы выехали':'Поездка завершена')}catch(e){toast(e.message)}}
function initTripMap(){
  if(!window.google?.maps||!$('trip-map'))return;
  const c=map?.getCenter?.();const center={lat:c?.lat?.()??56.84,lng:c?.lng?.()??60.61};
  if(!tripMap){
    tripMap=new google.maps.Map($('trip-map'),{center,zoom:12,mapTypeControl:false,streetViewControl:false,fullscreenControl:true,gestureHandling:'greedy'});
    tripMap.addListener('dragend',()=>{if(tripSelectionMode!=='idle')updateTripSelectionHint()});
    tripMap.addListener('zoom_changed',()=>{if(tripSelectionMode!=='idle')updateTripSelectionHint()});
  }else{
    try{tripMap.setCenter(center);tripMap.setZoom(12)}catch{}
  }
  // Yandex can initialize a modal map while its container is hidden and get a zero-size viewport.
  // Recalculate it after the modal is visible.
  setTimeout(()=>{try{tripMap.fitToViewport?.()}catch{}},0);
  setTimeout(()=>{try{tripMap.fitToViewport?.()}catch{}},180);
  setTimeout(()=>{try{tripMap.fitToViewport?.()}catch{}},420);
}
function updateTripSelectionHint(){const e=$('trip-selection-hint');if(e)e.textContent=tripSelectionMode==='destination'?'Передвиньте карту так, чтобы игла указывала на «Куда», затем нажмите кнопку ниже.':'Передвиньте карту так, чтобы игла указывала на «Откуда», затем нажмите кнопку ниже.'}
function updateTripPicked(){const a=$('trip-origin-picked'),b=$('trip-destination-picked');if(a)a.textContent=futureOriginCoords?`Откуда: ${$('trip-origin')?.value||'точка на карте'}`:'Откуда: не выбрано';if(b)b.textContent=futureDestinationCoords?`Куда: ${$('trip-destination')?.value||'точка на карте'}`:'Куда: не выбрано';}
function renderTripMapMarkers(){
  if(!tripMap)return;removeMapMarker(tripOriginMarker);removeMapMarker(tripDestinationMarker);removeMapMarker(tripRouteLine);tripOriginMarker=null;tripDestinationMarker=null;tripRouteLine=null;
  if(futureOriginCoords)tripOriginMarker=new google.maps.Marker({map:tripMap,position:{lat:+futureOriginCoords[0],lng:+futureOriginCoords[1]},title:$('trip-origin')?.value||'Откуда',icon:markerIcon('#ec4899','start')});
  if(futureDestinationCoords)tripDestinationMarker=new google.maps.Marker({map:tripMap,position:{lat:+futureDestinationCoords[0],lng:+futureDestinationCoords[1]},title:$('trip-destination')?.value||'Куда',icon:markerIcon('#f59e0b','finish')});
  if(futureOriginCoords&&futureDestinationCoords){const from=[+futureOriginCoords[0],+futureOriginCoords[1]],to=[+futureDestinationCoords[0],+futureDestinationCoords[1]];tripRouteLine=makeRouteLine(tripMap,[{lat:from[0],lng:from[1]},{lat:to[0],lng:to[1]}],'#2563eb');routeTripPreview(from,to)}
  updateTripPicked();
}
async function chooseFutureTripPoint(type){tripSelectionMode=type;updateTripSelectionHint();if(!tripMap)return;const c=tripMap.getCenter();const point=[c.lat(),c.lng()];const a=await geocodeAddress(point[0],point[1]);if(type==='origin'){futureOriginCoords=point;if(a)$('trip-origin').value=a.text}else{futureDestinationCoords=point;if(a)$('trip-destination').value=a.text}renderTripMapMarkers();toast(type==='destination'?'Точка «Куда» установлена по центру иглы':'Точка «Откуда» установлена по центру иглы');tripSelectionMode='idle';const hint=$('trip-selection-hint');if(hint)hint.textContent='Передвиньте карту и нажмите нужную кнопку, чтобы поставить точку под иглой.'}
function openCreateTrip(){if(!currentUser)return openLogin();if(currentUser.role!=='driver')return toast('Сначала переключитесь в режим водителя');futureOriginCoords=null;futureDestinationCoords=null;tripSelectionMode='idle';const w=$('trip-repeat-weeks');if(w)w.value='4';openModal('create-trip-modal');setTimeout(()=>{initTripMap();if(tripMap){try{tripMap.fitToViewport?.()}catch{}}renderTripMapMarkers();updateTripSelectionHint()},80)}
async function createTrip(e){e.preventDefault();const err=$('trip-error');err?.classList.add('hidden');if(!futureOriginCoords)return err&&(err.textContent='Укажите точку отправления: передвиньте карту под иглу и нажмите «Поставить Откуда».').classList.remove('hidden');if(!futureDestinationCoords)return err&&(err.textContent='Укажите точку назначения: передвиньте карту под иглу и нажмите «Поставить Куда».').classList.remove('hidden');try{const d=await post('create_future_trip',{origin:$('trip-origin').value.trim(),destination:$('trip-destination').value.trim(),origin_address:$('trip-origin').value.trim(),destination_address:$('trip-destination').value.trim(),departure_at:$('trip-departure').value,seats_total:+$('trip-seats').value,comment:$('trip-comment')?.value.trim()||'',origin_lat:futureOriginCoords[0],origin_lng:futureOriginCoords[1],destination_lat:futureDestinationCoords[0],destination_lng:futureDestinationCoords[1],repeat_weeks:+($('trip-repeat-weeks')?.value||1)});merge(d.server_data||{});closeModal('create-trip-modal');$('create-trip-form').reset();futureOriginCoords=null;futureDestinationCoords=null;const rw=$('trip-repeat-weeks');if(rw)rw.value='4';renderTripMapMarkers();toast(d.created_count>1?`Создано поездок: ${d.created_count}`:'Поездка опубликована')}catch(err2){if(err){err.textContent=err2.message;err.classList.remove('hidden')}}}
async function bookTrip(id){try{const d=await post('book_trip',{trip_id:id});merge(d.server_data||{});switchTab('bookings-tab');toast('Место забронировано')}catch(e){toast(e.message)}}
async function cancelBooking(id){try{const d=await post('cancel_booking',{booking_id:id});merge(d.server_data||{});toast('Бронь удалена')}catch(e){toast(e.message)}}
async function cancelFutureTrip(id){if(!confirm('Отменить будущую поездку? Все активные брони пассажиров тоже будут отменены.'))return;try{const d=await post('cancel_future_trip',{trip_id:id});merge(d.server_data||{});toast('Будущая поездка отменена')}catch(e){toast(e.message)}}
async function sendGlobal(){if(!currentUser)return openLogin();const input=$('community-global-input'),text=input.value.trim();if(!text)return;try{const d=await post('send_message',{client_uuid:uid(),ride_client_uuid:'__global__',message:text});input.value='';merge(d.server_data||{})}catch(e){toast(e.message)}}
async function sendDirect(){if(!currentUser||!currentChatUser)return;const input=$('direct-chat-input'),text=input.value.trim();if(!text)return;try{const d=await post('send_message',{client_uuid:uid(),ride_client_uuid:'__direct__',recipient_id:currentChatUser.id,message:text});input.value='';merge(d.server_data||{})}catch(e){toast(e.message)}}
async function markDirectRead(id){try{const d=await post('mark_chat_read',{kind:'direct',user_id:id});merge(d.server_data||{})}catch{}}
function openDirectChat(id){if(!currentUser)return openLogin();ensureNotifications();if(String(id)===String(currentUser.id))return;const u=users.find(x=>String(x.id)===String(id));if(!u)return toast('Пользователь не найден');currentChatUser=u;$('direct-chat-head').innerHTML=`<div class="chat-person-head">${avatar(u,'user-card-avatar')}<div><h2>Личный чат</h2><p>${safe(u.full_name||u.username)} · <span class="online-state ${u.is_online?'is-online':'is-offline'}">● ${u.is_online?'Онлайн':'Не в сети'}</span> · ⭐ ${Number(u.rating||0).toFixed(2)} · ${u.role==='driver'?'Водитель':'Пассажир'}</p></div></div>`;openModal('direct-chat-modal');renderDirectChat();markDirectRead(id)}
function bookingMessages(id){return messages.filter(m=>m.ride_client_uuid===`__booking_${id}`)}
function renderBookingChat(){const box=$('booking-chat-messages');if(!box||!currentBookingChat)return;const arr=bookingMessages(currentBookingChat.id);box.innerHTML=arr.length?arr.map(m=>`<div class="gmsg ${String(m.sender_id)===String(currentUser.id)?'mine':''}">${avatar({username:m.sender_name,avatar_url:m.sender_avatar},'mini-avatar')}<span>${safe(m.message)}</span><time>${new Date(m.created_at.replace(' ','T')).toLocaleTimeString('ru-RU',{hour:'2-digit',minute:'2-digit'})}</time></div>`).join(''):'<div class="empty-state">Чат брони пока пуст.</div>';box.scrollTop=box.scrollHeight}
async function openBookingChat(id){if(!currentUser)return openLogin();const b=bookings.find(x=>+x.id===id);if(!b)return toast('Бронь не найдена');currentBookingChat=b;const driver=users.find(u=>+u.id===+b.driver_id);$('booking-chat-head').innerHTML=`<div class="chat-person-head">${avatar(driver||{username:b.driver_name,avatar_url:b.driver_avatar},'user-card-avatar')}<div><h2>Чат по брони</h2><p>${safe(b.origin)} → ${safe(b.destination)} · ${safe(b.driver_name)}</p></div></div>`;openModal('booking-chat-modal');renderBookingChat();try{const d=await post('mark_chat_read',{kind:'booking',booking_id:id});merge(d.server_data||{});renderBookingChat()}catch{}}
async function sendBooking(){if(!currentBookingChat)return;const input=$('booking-chat-input'),text=input.value.trim();if(!text)return;try{const d=await post('send_message',{client_uuid:uid(),ride_client_uuid:`__booking_${currentBookingChat.id}`,message:text});input.value='';merge(d.server_data||{});renderBookingChat()}catch(e){toast(e.message)}}
function socialIcon(type){const p={max:'<path d="M7 3h10a4 4 0 0 1 4 4v10a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4V7a4 4 0 0 1 4-4Z"/><path d="M8 12h8M12 8v8"/>',vk:'<path d="M4 7h4c.2 3 1.7 5 3.1 5V7H15v5c1.5-.2 2.5-1.8 2.8-5H21c-.2 2.7-1.2 4.7-2.8 6.1C19.8 14.1 21 16 21 18h-3.7c-.5-1.5-1.6-2.6-3.3-3v3H12c-4.5 0-7.5-4-8-11Z"/>',tg:'<path d="M21 4 3 11l7 2 2 7 9-16Z"/><path d="m10 13 4-4"/>'};return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${p[type]||''}</svg>`}
function socialContactLink(type,label,value,base){if(!value)return '';const raw=String(value).trim();let href='';if(/^https?:\/\//i.test(raw))href=raw;else href=base+raw.replace(/^@/,'');return `<a class="social-link" href="${safe(href)}" target="_blank" rel="noopener">${socialIcon(type)}<span>${safe(label)}</span></a>`}
function contactLink(label,value,base){if(!value)return '';const raw=String(value).trim();let href='';if(/^https?:\/\//i.test(raw))href=raw;else if(base)href=base+raw.replace(/^@/,'');return `<div class="contact-row"><span>${label}</span>${href?`<a href="${safe(href)}" target="_blank" rel="noopener">${safe(raw)}</a>`:`<b>${safe(raw)}</b>`}</div>`}
function profileContacts(u){return `<div class="contacts"><h4>Контакты</h4><div class="social-links">${socialContactLink('max','MAX',u.max_contact,'https://max.ru/')} ${socialContactLink('vk','VK',u.vk_contact,'https://vk.com/')} ${socialContactLink('tg','Telegram',u.telegram_contact,'https://t.me/')}</div>${u.phone?`<div class="contact-row"><span>Телефон</span><a href="tel:${safe(u.phone)}">${safe(u.phone)}</a></div>`:''}${!u.max_contact&&!u.vk_contact&&!u.telegram_contact&&!u.phone?'<p class="muted">Контакты не указаны.</p>':''}</div>`}

async function openUserProfile(id,rideUuid=''){if(!currentUser)return openLogin();try{const d=await post('get_user_profile',{user_id:id,ride_client_uuid:rideUuid||''});currentProfile=d.profile;const rs=d.rides||[],fs=d.future_trips||[],reviews=d.reviews||[];const content=$('profile-content');const self=String(id)===String(currentUser.id);
    // BETA-2.7.6: раньше сервер отдавал одну поездку (rate_ride) и рисовался единственный редактор
    // отзыва на весь профиль, даже если совместных поездок с человеком было несколько. Теперь
    // rate_rides -- массив, и на каждую завершённую совместную поездку рисуется свой редактор.
    const rateRides=Array.isArray(d.rate_rides)&&d.rate_rides.length?d.rate_rides:(d.can_rate?[{client_uuid:d.rate_ride?.client_uuid||'',label:d.rate_ride?.label||'',my_rating:d.my_rating||null}]:[]);
    const ratingForm=rateRides.length?`<div class="profile-block-group">${rateRides.map(rr=>{const mine=rr.my_rating||null;const uuidAttr=safe(rr.client_uuid||'');return `<div class="profile-block rating-editor" data-rate-ride="${uuidAttr}"><h4>${mine?'Ваш отзыв о поездке':'Оставить отзыв'}</h4>${rr.label?`<p class="rating-ride-label">Поездка: ${safe(rr.label)}</p>`:''}<div class="rating-stars">${[1,2,3,4,5].map(n=>`<button type="button" data-score="${n}" class="star-btn ${mine&&+mine.score>=n?'selected':''}">★</button>`).join('')}</div><textarea class="profile-review-text" maxlength="1000" placeholder="Напишите отзыв о поездке...">${safe(mine?.review_text||'')}</textarea><div class="rating-actions"><button class="btn btn-primary btn-sm" data-save-rating="${uuidAttr}">${mine?'Сохранить изменения':'Сохранить оценку'}</button>${mine?`<button class="btn btn-danger btn-sm" data-delete-rating="${uuidAttr}">Удалить отзыв</button>`:''}</div></div>`}).join('')}</div>`:'';
    const reviewBlock=`<div class="profile-block"><div class="profile-block-head"><h4>Отзывы (${reviews.length})</h4><b>★ ${Number(currentProfile.rating||0).toFixed(2)}</b></div>${reviews.length?reviews.map(r=>`<div class="review-item"><div class="review-head">${avatarSoft({username:r.from_username,avatar_url:r.from_avatar},'mini-avatar')}<b>${safe(r.from_username)}</b><span>★ ${+r.score}</span></div>${r.review_text?`<p>${safe(r.review_text)}</p>`:'<p class="muted">Без текста.</p>'}</div>`).join(''):'<p class="muted">Отзывов пока нет.</p>'}</div>`;const ownAction=self?'<button class="btn btn-light" id="profile-edit-own"><span class="ui-icon ui-icon-sm" data-icon="pencil"></span> Изменить профиль</button>':'<button class="btn btn-primary" id="profile-chat-btn"><span class="ui-icon ui-icon-sm" data-icon="chat"></span> Личный чат</button>';content.innerHTML=`<div class="profile-hero">${avatar(currentProfile,'profile-avatar')}<div><h2>${safe(currentProfile.full_name||currentProfile.username)}</h2><p>@${safe(currentProfile.username)} · <span class="online-state ${currentProfile.is_online?'is-online':'is-offline'}">● ${currentProfile.is_online?'Онлайн':'Не в сети'}</span> · ⭐ ${Number(currentProfile.rating||0).toFixed(2)}</p><b>⭐ ${Number(currentProfile.rating||0).toFixed(2)}</b></div></div><div class="profile-actions">${ownAction}</div>${currentProfile.bio?`<div class="profile-block"><h4>О пользователе</h4><p>${safe(currentProfile.bio)}</p></div>`:''}${profileContacts(currentProfile)}${ratingForm}${reviewBlock}<div class="profile-block"><h4>Поездки пользователя</h4>${rs.length?rs.map(r=>`<div class="profile-trip"><b>${safe(r.destination_text||'Поездка')}</b><span>${safe(r.status)}</span><small>${icon('pin','ui-icon ui-icon-inline')} ${safe(r.pickup_address||'Адрес посадки определяется…')}</small></div>`).join(''):'<p class="muted">Поездок пока нет.</p>'}</div>${fs.length?`<div class="profile-block"><h4>Будущие поездки водителя</h4>${fs.map(t=>`<div class="profile-trip"><b>${safe(t.origin)} → ${safe(t.destination)}</b><span>${safe(t.departure_at)}</span><small>Мест: ${Math.max(0,+t.seats_total-+t.booked_seats)}/${t.seats_total}</small></div>`).join('')}</div>`:''}`;openModal('profile-modal');
    $('profile-chat-btn')?.addEventListener('click',()=>{closeModal('profile-modal');openDirectChat(id)});
    $('profile-edit-own')?.addEventListener('click',()=>{closeModal('profile-modal');profileEditOpen=true;switchTab('profile-tab');setTimeout(()=>renderProfilePage(),30)});
    const chosenByRide=new Map();rateRides.forEach(rr=>chosenByRide.set(rr.client_uuid||'',+(rr.my_rating?.score||0)));
    content.querySelectorAll('[data-rate-ride]').forEach(block=>{const rideKey=block.dataset.rateRide||'';block.querySelectorAll('.star-btn').forEach(b=>b.addEventListener('click',()=>{const score=+b.dataset.score;chosenByRide.set(rideKey,score);block.querySelectorAll('.star-btn').forEach(x=>x.classList.toggle('selected',+x.dataset.score<=score))}))});
    content.querySelectorAll('[data-save-rating]').forEach(b=>b.addEventListener('click',async()=>{const rideKey=b.dataset.saveRating||'';const chosen=chosenByRide.get(rideKey)||0;if(!chosen)return toast('Поставьте оценку от 1 до 5');const block=b.closest('[data-rate-ride]');const text=block?.querySelector('.profile-review-text')?.value.trim()||'';const wasEditing=!!block?.querySelector('[data-delete-rating]');try{const x=await post('save_rating',{to_user_id:id,ride_client_uuid:rideKey,score:chosen,review_text:text});merge(x.server_data||{});toast(wasEditing?'Отзыв обновлён':'Оценка и отзыв сохранены');openUserProfile(id)}catch(e){toast(e.message)}}));
    content.querySelectorAll('[data-delete-rating]').forEach(b=>b.addEventListener('click',async()=>{const rideKey=b.dataset.deleteRating||'';if(!confirm('Удалить ваш отзыв об этой поездке?'))return;try{const x=await post('delete_rating',{to_user_id:id,ride_client_uuid:rideKey});merge(x.server_data||{});toast('Отзыв удалён');openUserProfile(id)}catch(e){toast(e.message)}}));
    if(rideUuid){const target=content.querySelector(`[data-rate-ride="${CSS.escape(rideUuid)}"]`);if(target){target.classList.add('rating-editor-highlight');setTimeout(()=>target.scrollIntoView({block:'center',behavior:'smooth'}),30)}}
}catch(e){toast(e.message)}}
async function saveProfile(){if(!currentUser)return;profileEditOpen=true;try{const d=await post('save_profile',{username:$('profile-username').value.trim().replace(/^@/, ''),full_name:$('profile-full-name').value.trim(),phone:$('profile-phone').value.trim(),max_contact:$('profile-max').value.trim(),vk_contact:$('profile-vk').value.trim(),telegram_contact:$('profile-tg').value.trim(),bio:$('profile-bio').value.trim(),avatar_data:window.__croppedAvatarData||''});currentUser=d.user;window.__croppedAvatarData='';merge(d.server_data||{});profileEditOpen=true;toast('Профиль сохранён — форма редактирования остаётся открытой')}catch(e){toast(e.message)}}
function initAvatarCrop(){const file=$('profile-avatar-file'),canvas=$('avatar-crop-canvas'),zoom=$('avatar-crop-zoom');if(!file||!canvas||file.dataset.cropBound==='1')return;file.dataset.cropBound='1';file.addEventListener('change',()=>{const f=file.files?.[0];if(!f)return;if(f.size>8*1024*1024){file.value='';return toast('Исходное фото должно быть не больше 8 МБ')}const reader=new FileReader();reader.onload=()=>{cropImage=new Image();cropImage.onload=()=>{cropScale=1;cropX=0;cropY=0;cropBaseScale=Math.max(320/cropImage.width,320/cropImage.height);zoom.value=1;drawCrop();openModal('avatar-crop-modal')};cropImage.src=reader.result};reader.readAsDataURL(f)});zoom.addEventListener('input',()=>{cropScale=+zoom.value;drawCrop()});let down=false,sx=0,sy=0;canvas.addEventListener('pointerdown',e=>{down=true;canvas.setPointerCapture(e.pointerId);sx=e.clientX;sy=e.clientY});canvas.addEventListener('pointermove',e=>{if(!down)return;cropX+=e.clientX-sx;cropY+=e.clientY-sy;sx=e.clientX;sy=e.clientY;drawCrop()});canvas.addEventListener('pointerup',()=>down=false);canvas.addEventListener('pointercancel',()=>down=false);$('avatar-crop-apply')?.addEventListener('click',applyCrop);$('avatar-crop-cancel')?.addEventListener('click',()=>{file.value='';closeModal('avatar-crop-modal')})}
function drawCrop(){const c=$('avatar-crop-canvas'),ctx=c?.getContext('2d');if(!ctx||!cropImage)return;ctx.clearRect(0,0,320,320);const scale=cropBaseScale*cropScale,w=cropImage.width*scale,h=cropImage.height*scale;const maxX=Math.max(0,(w-320)/2),maxY=Math.max(0,(h-320)/2);cropX=Math.min(maxX,Math.max(-maxX,cropX));cropY=Math.min(maxY,Math.max(-maxY,cropY));const x=(320-w)/2+cropX,y=(320-h)/2+cropY;ctx.drawImage(cropImage,x,y,w,h)}
function applyCrop(){const c=$('avatar-crop-canvas'),out=document.createElement('canvas');out.width=640;out.height=640;const ctx=out.getContext('2d');ctx.imageSmoothingQuality='high';ctx.drawImage(c,0,0,640,640);window.__croppedAvatarData=out.toDataURL('image/jpeg',.88);const preview=$('#profile-avatar-preview');if(preview)preview.src=window.__croppedAvatarData;closeModal('avatar-crop-modal');toast('Область аватара выбрана. Нажмите «Сохранить профиль».')}
function renderSelfReviews(){const mine=ratings.filter(r=>String(r.to_user_id)===String(currentUser?.id));const avg=Number(currentUser?.rating||0).toFixed(2);if(!mine.length)return `<div class="account-reviews-empty"><b>★ ${avg}</b><span>Пока нет отзывов. После завершённых поездок пассажиры и водители смогут оценивать друг друга.</span></div>`;return `<div class="account-review-summary"><div><strong>★ ${avg}</strong><small>${mine.length} ${mine.length===1?'отзыв':mine.length<5?'отзыва':'отзывов'}</small></div>${mine.slice(0,5).map(r=>`<div class="account-review"><div class="review-head">${avatarSoft({username:r.from_username,avatar_url:r.from_avatar},'mini-avatar')}<b>@${safe(r.from_username)}</b><span>★ ${+r.score}</span></div>${r.review_text?`<p>${safe(r.review_text)}</p>`:'<p class="muted">Без текста.</p>'}</div>`).join('')}</div>`}
// BETA-2.7: в списке только пассажиры собственных принятых/начатых поездок.
// Брони будущих поездок — отдельным разделом, по кнопке; общий список пользователей сюда не попадает.
let passengersTab='ride';
function ridePassengers(){return (myPassengers||[]).filter(p=>p.kind==='ride'||p.source==='Текущая поездка')}
function bookingPassengers(){return (myPassengers||[]).filter(p=>p.kind==='booking'||p.source==='Будущая поездка')}
function passengerCardHtml(p){
  const st={accepted:'Принята, ждём подбора',on_the_way:'В пути',booked:'Бронь'}[p.status]||safe(p.status||'');
  return `<article class="passenger-card"><div class="passenger-card-head">${avatarSoft({username:p.username,avatar_url:p.avatar_url},'user-card-avatar')}<div><h3>${safe(p.full_name||p.username)}</h3><p>@${safe(p.username)} · <span class="online-state ${p.is_online?'is-online':'is-offline'}">● ${p.is_online?'Онлайн':'Не в сети'}</span> · ${icon('star','ui-icon ui-icon-inline')} ${Number(p.rating||0).toFixed(2)}</p></div></div><div class="passenger-route"><b>${safe(p.route||'Маршрут')}</b>${p.destination?`<span>→</span><b>${safe(p.destination)}</b>`:''}</div><small>${st}${p.departure_at?` · ${safe(new Date(String(p.departure_at).replace(' ','T')).toLocaleString('ru-RU',{day:'2-digit',month:'long',hour:'2-digit',minute:'2-digit'}))}`:''}</small><div class="passenger-actions">${p.ride_uuid?`<button class="btn btn-primary btn-sm" data-pass-route="${safe(p.ride_uuid)}"><span class="ui-icon ui-icon-sm" data-icon="pin"></span> Отобразить маршрут</button>`:''}<button class="btn btn-light btn-sm" data-pass-profile="${p.id}">Профиль</button><button class="btn btn-primary btn-sm" data-pass-chat="${p.id}"><span class="ui-icon ui-icon-sm" data-icon="chat"></span> Чат</button></div></article>`;
}
function renderMyPassengers(){
  const box=$('passengers-content');if(!box)return;
  const active=ridePassengers(),future=bookingPassengers();
  const list=passengersTab==='booking'?future:active;
  const empty=passengersTab==='booking'?'Броней на будущие поездки нет.':'Вы пока никого не подобрали.';
  box.innerHTML=`<div class="section-title compact"><div><h2>Мои пассажиры</h2><p>Пассажиры ваших принятых и начатых поездок.</p></div></div>`
    +`<div class="passengers-tabs"><button class="btn btn-sm ${passengersTab==='ride'?'btn-primary':'btn-light'}" data-pass-tab="ride">Подобранные · ${active.length}</button><button class="btn btn-sm ${passengersTab==='booking'?'btn-primary':'btn-light'}" data-pass-tab="booking">Брони поездок · ${future.length}</button></div>`
    +`<div class="passengers-grid">${list.length?list.map(passengerCardHtml).join(''):`<div class="empty-state">${empty}</div>`}</div>`;
  box.querySelectorAll('[data-pass-tab]').forEach(b=>b.onclick=()=>{passengersTab=b.dataset.passTab;renderMyPassengers()});
  box.querySelectorAll('[data-pass-route]').forEach(b=>b.onclick=()=>{closeModal('passengers-modal');focusRide(b.dataset.passRoute)});
  box.querySelectorAll('[data-pass-profile]').forEach(b=>b.onclick=()=>openUserProfile(+b.dataset.passProfile));
  box.querySelectorAll('[data-pass-chat]').forEach(b=>b.onclick=()=>openDirectChat(+b.dataset.passChat));
  mountStaticIcons();
}
function openMyPassengers(){if(!currentUser||currentUser.role!=='driver')return toast('Раздел «Мои пассажиры» доступен водителю');passengersTab='ride';renderMyPassengers();openModal('passengers-modal')}
function openProfileEditor(){const form=$('profile-form'),summary=$('account-summary'),btn=$('edit-profile-btn');if(!form)return;form.classList.remove('hidden');summary?.classList.add('hidden');btn?.classList.add('hidden');form.scrollIntoView({behavior:'smooth',block:'start'})}
function updateAccountModal(){const state=$('auth-state');if(!state)return;if(!currentUser){state.innerHTML='<div class="account-guest"><h2>Личный кабинет</h2><p>Войдите или зарегистрируйтесь.</p><button class="btn btn-primary full-width" id="lk-login">Войти</button><button class="btn btn-light full-width" id="lk-register">Регистрация</button></div>';$('lk-login')?.addEventListener('click',openLogin);$('lk-register')?.addEventListener('click',openRegister);return;}state.innerHTML='<div class="account-guest"><h2>Профиль</h2><p>Откройте вкладку «Профиль», чтобы управлять аккаунтом.</p><button class="btn btn-primary full-width" id="lk-profile-go">Открыть профиль</button></div>';$('lk-profile-go')?.addEventListener('click',()=>{closeModal('lk-modal');switchTab('profile-tab')});}
function updateUserUI(){updateAccountModal()}
async function logout(){stopDriverTracking();try{await post('logout')}catch{}currentUser=null;csrfToken='';bookings=[];currentChatUser=null;profileEditOpen=false;renderAll();toast('Вы вышли')}
window.__urfuOpenProfile=openUserProfile; window.__urfuOpenDirectChat=openDirectChat;
function openPolicy(type){openModal(type==='privacy'?'privacy-modal':'terms-modal')}
function initRequestsToggle(){
  const btn=$('toggle-requests'),body=$('requests-body');
  if(!btn||!body)return;
  const key='urfu4tour_requests_collapsed';
  const apply=collapsed=>{
    body.classList.toggle('requests-collapsed',collapsed);
    btn.setAttribute('aria-expanded',String(!collapsed));
    const state=btn.querySelector('.requests-toggle-state');
    if(state)state.textContent=collapsed?'Показать':'Свернуть';
    localStorage.setItem(key,collapsed?'1':'0');
  };
  const saved=localStorage.getItem(key)==='1';
  apply(saved);
  btn.addEventListener('click',()=>apply(!body.classList.contains('requests-collapsed')));
}
function init(){loadRideFinderChat();mountStaticIcons();initTheme();initRequestsToggle();initMap();$('brand-home')?.addEventListener('click',()=>switchTab('map-tab'));document.querySelectorAll('[data-mobile-tab]').forEach(b=>b.onclick=()=>switchTab(b.dataset.mobileTab));$('open-lk-desktop')?.addEventListener('click',()=>switchTab('profile-tab'));$('theme-toggle')?.addEventListener('click',toggleTheme);$('chrome-top-toggle')?.addEventListener('click',()=>toggleChrome('top'));$('chrome-bottom-toggle')?.addEventListener('click',()=>toggleChrome('bottom'));applyChromeState();$('open-create-trip-home')?.addEventListener('click',openCreateTrip);document.querySelectorAll('[data-quick-route]').forEach(b=>b.onclick=()=>quickRoute(b.dataset.quickRoute));document.querySelectorAll('.nav-btn[data-tab]').forEach(b=>b.onclick=()=>switchTab(b.dataset.tab));document.querySelectorAll('[data-community-view]').forEach(b=>b.onclick=()=>openCommunityView(b.dataset.communityView));document.querySelectorAll('[data-community-back]').forEach(b=>b.onclick=()=>openCommunityView(''));$('community-global-send')?.addEventListener('click',sendGlobal);$('community-global-input')?.addEventListener('keydown',e=>e.key==='Enter'&&sendGlobal());$('users-search')?.addEventListener('input',renderUsers);$('locate-me')?.addEventListener('click',locate);$('locate-map')?.addEventListener('click',locate);$('focus-driver')?.addEventListener('click',focusAssignedDriver);$('clear-all-markers')?.addEventListener('click',clearAllMapMarkers);$('mobile-clear-all-markers')?.addEventListener('click',clearAllMapMarkers);$('open-ai-map')?.addEventListener('click',openAIMap);$('ai-map-run')?.addEventListener('click',runAIMapCommand);$('ai-map-query')?.addEventListener('keydown',e=>{if((e.ctrlKey||e.metaKey)&&e.key==='Enter')runAIMapCommand()});$('set-pickup-btn')?.addEventListener('click',choosePickupMode);$('locate-pickup-btn')?.addEventListener('click',locate);$('remove-my-location')?.addEventListener('click',removeMyLocation);$('set-map-location')?.addEventListener('click',choosePickupMode);$('open-my-passengers-map')?.addEventListener('click',openMyPassengers);$('choose-destination')?.addEventListener('click',chooseDestinationMode);$('add-marker-btn')?.addEventListener('click',addRide);$('open-create-trip')?.addEventListener('click',openCreateTrip);$('open-ride-finder')?.addEventListener('click',openRideFinder);$('ride-finder-send')?.addEventListener('click',sendRideFinder);$('ride-finder-input')?.addEventListener('keydown',e=>{if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();sendRideFinder()}});$('ride-finder-minimize')?.addEventListener('click',()=>rideFinderCollapsed?restoreRideFinder():minimizeRideFinder());$('ride-finder-widget')?.addEventListener('click',e=>{const w=$('ride-finder-widget');if(w.classList.contains('collapsed')&&!w.dataset.justDragged&&!e.target.closest('#ride-finder-minimize'))restoreRideFinder()});initRideFinderDrag();$('trip-origin-map-btn')?.addEventListener('click',()=>chooseFutureTripPoint('origin'));$('trip-destination-map-btn')?.addEventListener('click',()=>chooseFutureTripPoint('destination'));$('open-privacy')?.addEventListener('click',e=>{e.preventDefault();openPolicy('privacy')});$('open-terms')?.addEventListener('click',e=>{e.preventDefault();openPolicy('terms')});$('driver-view-mode')?.addEventListener('change',e=>{driverViewMode=e.target.value;localStorage.setItem('urfu4tour_driver_view',driverViewMode);renderAll()});initAvatarCrop();$('create-trip-form')?.addEventListener('submit',createTrip);$('login-form')?.addEventListener('submit',loginSubmit);$('register-form')?.addEventListener('submit',registerSubmit);$('open-register')?.addEventListener('click',openRegister);$('open-login')?.addEventListener('click',openLogin);$('register-terms-link')?.addEventListener('click',()=>openPolicy('terms'));$('register-privacy-link')?.addEventListener('click',()=>openPolicy('privacy'));$('send-direct-msg')?.addEventListener('click',sendDirect);$('send-booking-msg')?.addEventListener('click',sendBooking);$('booking-chat-input')?.addEventListener('keydown',e=>e.key==='Enter'&&sendBooking());$('direct-chat-input')?.addEventListener('keydown',e=>e.key==='Enter'&&sendDirect());$('accept-cookies')?.addEventListener('click',()=>$('cookie-banner')?.classList.add('hidden'));document.querySelectorAll('[data-close]').forEach(b=>b.addEventListener('click',()=>closeModal(b.dataset.close)));document.querySelectorAll('.modal').forEach(m=>m.addEventListener('click',e=>{if(e.target===m)m.classList.add('hidden')}));document.addEventListener('keydown',e=>{if(e.key==='Escape')document.querySelectorAll('.modal:not(.hidden)').forEach(m=>m.classList.add('hidden'))});document.querySelectorAll('#role-switch button').forEach(b=>b.addEventListener('click',()=>{if(!currentUser)return openLogin();if(currentUser.role!==b.dataset.role)switchRole()}));startPolling()}
document.addEventListener('DOMContentLoaded',()=>{init();boot()});
})();
