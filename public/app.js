let token='public-dashboard',socket=null,current={};
const commands=[
 ['🤖','الأساسيات','!menu • !ping • !status • !owner • !info • !id'],
 ['👥','إدارة المجموعة','!groupinfo • !admins • !members • !tagall • !kick • !promote • !demote • !add • !remove'],
 ['🔒','إدارة المجموعة','!lock • !unlock • !setname • !setdesc • !linkgroup • !revoke'],
 ['⚠️','التحذيرات والكتم','!warn • !warnings • !clearwarn • !mute • !unmute'],
 ['🛡️','الحماية','!protect • !unprotect • !antilink • !antibadword • !welcome'],
 ['👁️','الحالات','!statusview • !statusreact • مشاهدة وتفاعل تلقائي'],
 ['🧠','الذكاء الاصطناعي','!ai on|off • !ai provider • !ai ask'],
 ['💬','الرسائل','!react ❤️ • !delete بالرد على رسالة'],
 ['⚙️','الإعدادات','!language ar|en|fr • !prefix !'],
 ['🌐','اللغات','العربية • English • Français']
];
function $(id){return document.getElementById(id)}
async function api(path,opts={}){opts.headers={...(opts.headers||{}),'Authorization':'Bearer '+token,'Content-Type':'application/json'};const r=await fetch(path,opts);const j=await r.json().catch(()=>({}));if(!r.ok)throw Error(j.error||'Request failed');return j}
async function init(){
  socket=io();socket.on('bot:event',e=>{if(e.type==='qr')setQR(e.qrData);if(e.type==='pairing')$('pairCode').textContent=e.pairingCode||'────────';if(e.type==='state')renderState(e);if(e.type==='status_seen')statusLog(`👁️ تمت مشاهدة حالة${e.reaction?` + ${e.reaction}`:''}`);if(e.type==='status_reaction')statusLog(`❤️ تمت إضافة ${e.reaction} إلى حالة`);if(e.type==='status_error')statusLog(`⚠️ ${e.message}`);if(e.type==='ai_error')statusLog(`🧠 ${e.message}`);});
  renderCommands();
  try{const j=await api('/api/state');current=j;applySettings(j.settings);renderMeta(j.meta);renderState(j.bot);$('publicBadge').textContent=j.meta.auth?'AUTH ON':'PUBLIC'}catch(e){toast(e.message)}
}
function renderMeta(m){$('devName').textContent=m.developer;$('contactLink').href='https://wa.me/'+m.contact}
function renderState(b){const on=b.connected;$('heroState').textContent=on?'متصل':'غير متصل';$('statState').textContent=on?'ONLINE':'OFFLINE';$('connBadge').textContent=on?'ONLINE':'OFFLINE';$('connBadge').style.color=on?'#43e38a':'#ff7c98';$('sideStatus').textContent=on?'متصل':'غير متصل';$('sideDot').classList.toggle('on',on);$('statLang').textContent=(current.settings?.language||'ar').toUpperCase();$('statAnti').textContent=current.settings?.antilink?'ON':'OFF';$('statStatus').textContent=current.settings?.statusAutoReact?'ON':'OFF';$('statAI').textContent=current.settings?.aiEnabled?'ON':'OFF';if(b.qrData)setQR(b.qrData);if(b.pairingCode)$('pairCode').textContent=b.pairingCode}
function setQR(src){$('qr').src=src;$('qr').style.display='block';$('qrEmpty').style.display='none'}
function renderCommands(){$('commandGrid').innerHTML=commands.map(c=>`<div class="cmd"><b>${c[0]} ${c[1]}</b><code>${c[2]}</code></div>`).join('')}
function applySettings(s){
  $('setLang').value=s.language||'ar';$('setPrefix').value=s.prefix||'!';$('setAnti').checked=!!s.antilink;$('setBad').checked=!!s.antibadword;$('setWelcome').checked=!!s.welcome;$('setStatusView').checked=!!s.statusAutoView;$('setStatusReact').checked=!!s.statusAutoReact;$('setReaction').value=s.statusReaction||'❤️';$('setAI').checked=!!s.aiEnabled;$('setProvider').value=s.aiProvider||'gemini';$('setGroupAI').value=s.aiGroupMode||'mention';$('setPrivateAI').checked=s.aiPrivate!==false;$('setModel').value=s.aiModel||'';$('setSystem').value=s.aiSystemPrompt||'';$('lang').value=s.language||'ar';current.settings=s;
  $('statStatus').textContent=s.statusAutoReact?'ON':'OFF';$('statAI').textContent=s.aiEnabled?'ON':'OFF';
}
async function saveSettings(){try{const j=await api('/api/settings',{method:'POST',body:JSON.stringify({language:$('setLang').value,prefix:$('setPrefix').value,antilink:$('setAnti').checked,antibadword:$('setBad').checked,welcome:$('setWelcome').checked,statusAutoView:$('setStatusView').checked,statusAutoReact:$('setStatusReact').checked,statusReaction:$('setReaction').value,aiEnabled:$('setAI').checked,aiProvider:$('setProvider').value,aiGroupMode:$('setGroupAI').value,aiPrivate:$('setPrivateAI').checked,aiModel:$('setModel').value,aiSystemPrompt:$('setSystem').value})});applySettings(j);toast('تم حفظ الإعدادات الحقيقية')}catch(e){toast(e.message)}}
async function pair(){try{const j=await api('/api/pair',{method:'POST',body:JSON.stringify({phone:$('phone').value})});$('pairCode').textContent=j.code;toast('تم إنشاء كود الربط الحقيقي')}catch(e){toast(e.message)}}
async function startBot(){try{await api('/api/start',{method:'POST'});toast('تم تشغيل اتصال واتساب')}catch(e){toast(e.message)}}
async function logoutWhatsApp(){if(!confirm('فصل جلسة واتساب وحذف جلسة الربط؟'))return;try{await api('/api/logout-whatsapp',{method:'POST'});toast('تم فصل الجلسة')}catch(e){toast(e.message)}}
function showPage(id){document.querySelectorAll('.page').forEach(x=>x.classList.add('hidden'));$(id).classList.remove('hidden');document.querySelectorAll('nav button').forEach(x=>x.classList.toggle('active',x.dataset.page===id));const titles={home:'الرئيسية',connect:'الربط الحقيقي',commands:'الأوامر',settings:'الإعدادات',status:'الحالات والرد الذكي',about:'حول'};$('pageTitle').textContent=titles[id]||id;document.querySelector('aside').classList.remove('open')}
document.querySelectorAll('nav button').forEach(b=>b.onclick=()=>showPage(b.dataset.page));
function toggleMenu(){document.querySelector('aside').classList.toggle('open')}
function changeLang(v){$('setLang').value=v;saveSettings()}
function toast(s){$('toast').textContent=s;$('toast').classList.add('toast-show');setTimeout(()=>$('toast').classList.remove('toast-show'),3000)}
function statusLog(s){const box=$('statusLog');if(!box)return;const d=document.createElement('div');d.textContent=`${new Date().toLocaleTimeString()} — ${s}`;box.prepend(d);while(box.children.length>20)box.lastElementChild.remove()}
init();
