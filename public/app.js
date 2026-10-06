let token='public-dashboard',socket=null,current={};
const commands=[
 ['🤖','الأساسيات','.قائمة • .مساعدة • .بينغ • .حي • .حالة • .وقت_التشغيل • .المطور • .معلومات • .معرف • .بادئة'],
 ['👑','المجموعة','.معلومات_المجموعة • .معرف_المجموعة • .المشرفين • .الاعضاء • .منشن_الكل • .رابط • .تغيير_الرابط'],
 ['👥','الأعضاء','.طرد @عضو • .ترقية @عضو • .تنزيل @عضو • .اضافة رقم • .ازالة @عضو • .تاج_الكل'],
 ['🔒','إدارة المجموعة','.قفل • .فتح • .اسم الاسم_الجديد • .وصف الوصف_الجديد • .رابط • .تغيير_الرابط'],
 ['⚠️','التحذيرات والكتم','.تحذير @عضو • .تحذيرات • .مسح_تحذير @عضو • .حد_التحذير 3 • .كتم @عضو • .فك_كتم @عضو'],
 ['🛡️','الحماية','.حماية • .الغاء_الحماية • .منع_الروابط تشغيل|إيقاف • .منع_الكلمات تشغيل|إيقاف • .منع_التكرار تشغيل|إيقاف • .منع_السبام تشغيل|إيقاف • .منع_المنشن تشغيل|إيقاف • .ترحيب تشغيل|إيقاف'],
 ['❤️','الحالات والتفاعل','.مشاهدة_الحالات تشغيل|إيقاف • .تفاعل_الحالات تشغيل|إيقاف • .تفاعل_الحالات 💚 • .رد ❤️ بالرد'],
 ['🧠','الذكاء الاصطناعي','.ذكاء تشغيل|إيقاف • .ذكاء سؤالك • .ذكاء_حسابي • المفتاح والنموذج يُحفظان لكل مستخدم من لوحة التحكم'],
 ['⚙️','الاتصال','.تشغيل • .اعادة_تشغيل • .حالة • .وقت_التشغيل • .معرف • .معرف_المجموعة'],
 ['🧹','قائمة الكلمات','.اضافة_كلمة كلمة1,كلمة2 • .حذف_كلمة كلمة • .كلمات_ممنوعة'],
 ['✨','المساعدة','.قائمة • .مساعدة • أرسل رقمًا من 1 إلى 6 لاختيار قسم']
];
function $(id){return document.getElementById(id)}
async function api(path,opts={}){opts.headers={...(opts.headers||{}),'Authorization':'Bearer '+token,'Content-Type':'application/json'};const r=await fetch(path,opts);const j=await r.json().catch(()=>({}));if(!r.ok)throw Error(j.error||'Request failed');return j}
async function init(){
  socket=io();socket.on('connect_error',e=>toast('تعذر الاتصال بلوحة التحكم، جارٍ إعادة المحاولة…'));socket.on('bot:event',e=>{if(e.type==='qr')setQR(e.qrData);if(e.type==='pairing')$('pairCode').textContent=e.pairingCode||'────────';if(e.type==='state')renderState(e);if(e.type==='version'){$('diagVersion').textContent=e.version||'—';$('waVersionBadge').textContent='WA Web '+(e.latest?'LIVE':'FALLBACK')}if(e.type==='version_error'){$('diagError').textContent=e.message||'—';}if(e.type==='connection_error'){$('diagError').textContent=e.message||'—';}if(e.type==='pairing_error'||e.type==='pairing_failed'){$('diagError').textContent=e.message||'—';toast(e.message||'تعذر الربط');}if(e.type==='status_seen')statusLog(`👁️ تمت مشاهدة حالة${e.reaction?` + ${e.reaction}`:''}`);if(e.type==='status_reaction')statusLog(`❤️ تمت إضافة ${e.reaction} إلى حالة`);if(e.type==='status_error')statusLog(`⚠️ ${e.message}`);if(e.type==='status_reaction_unavailable')statusLog(`⚠️ تعذر إرسال ${e.reaction} للحالة: ${e.message}`);if(e.type==='ai_error')statusLog(`🧠 ${e.message}`);});
  renderCommands();
  try{const j=await api('/api/state');current=j;applySettings(j.settings);renderMeta(j.meta);renderState(j.bot);$('publicBadge').textContent=j.meta.auth?'AUTH ON':'PUBLIC';refreshAIUsers()}catch(e){toast(e.message)}
}
function renderMeta(m){$('contactLink').href='https://wa.me/'+m.contact;$('dev2Link').href='https://wa.me/'+(m.dev2Phone||'967739020737')}
function renderState(b){const on=b.connected;$('heroState').textContent=on?'متصل':'غير متصل';$('statState').textContent=on?'ONLINE':'OFFLINE';$('connBadge').textContent=on?'ONLINE':'OFFLINE';$('connBadge').style.color=on?'#43e38a':'#ff7c98';$('sideStatus').textContent=on?'متصل':'غير متصل';$('sideDot').classList.toggle('on',on);$('diagState').textContent=b.state||'disconnected';$('diagError').textContent=b.lastDisconnect?(b.lastDisconnect.message||String(b.lastDisconnect.code||'—')):'—';$('statStatus').textContent=current.settings?.statusAutoReact?'ON':'OFF';$('statAI').textContent=current.settings?.aiEnabled?'ON':'OFF';if(b.qrData)setQR(b.qrData);else setQR(null);if(b.pairingCode)$('pairCode').textContent=b.pairingCode}
function setQR(src){const img=$('qr'),empty=$('qrEmpty');if(!img||!empty)return;if(src){img.src=src;img.style.display='block';empty.style.display='none'}else{img.removeAttribute('src');img.style.display='none';empty.style.display='block'}}
function renderCommands(){$('commandGrid').innerHTML=commands.map(c=>`<div class="cmd"><b>${c[0]} ${c[1]}</b><code>${c[2]}</code></div>`).join('')}
function applySettings(s){
  if($('setPrefix'))$('setPrefix').value='.';
  if($('setAnti'))$('setAnti').checked=!!s.antilink;
  if($('setBad'))$('setBad').checked=!!s.antibadword;
  if($('setWelcome'))$('setWelcome').checked=!!s.welcome;
  if($('setStatusView'))$('setStatusView').checked=!!s.statusAutoView;
  if($('setStatusReact'))$('setStatusReact').checked=!!s.statusAutoReact;
  if($('setReaction'))$('setReaction').value=s.statusReaction||'💚';
  if($('setAI'))$('setAI').checked=!!s.aiEnabled;
  if($('setProvider'))$('setProvider').value=s.aiProvider||'gemini';
  if($('setGroupAI'))$('setGroupAI').value=s.aiGroupMode||'mention';
  if($('setPrivateAI'))$('setPrivateAI').checked=s.aiPrivate!==false;
  if($('setModel'))$('setModel').value=s.aiModel||'';
  if($('setSystem'))$('setSystem').value=s.aiSystemPrompt||'';
  current.settings=s;
  $('statStatus').textContent=s.statusAutoReact?'ON':'OFF';$('statAI').textContent=s.aiUsers&&Object.values(s.aiUsers).some(x=>x?.enabled)?'ON':'OFF';
}
async function saveSettings(){try{const body={prefix:'.',antilink:$('setAnti').checked,antibadword:$('setBad').checked,welcome:$('setWelcome').checked,statusAutoView:$('setStatusView').checked,statusAutoReact:$('setStatusReact').checked,statusReaction:$('setReaction').value};const j=await api('/api/settings',{method:'POST',body:JSON.stringify(body)});applySettings(j);toast('تم حفظ الإعدادات')}catch(e){toast(e.message)}}
async function loadAIUser(){
  const phone=$('aiUserPhone').value.trim();if(!phone){toast('أدخل رقم واتساب أولًا');return}
  try{const u=await api('/api/ai-user?phone='+encodeURIComponent(phone));$('aiUserProvider').value=u.provider||'gemini';$('aiUserModel').value=u.model||'gemini-3.8-flash';$('aiUserEnabled').checked=!!u.enabled;$('aiUserGroupMode').value=u.groupMode||'mention';$('aiUserPrivate').checked=u.privateEnabled!==false;$('aiUserSystem').value=u.systemPrompt||$('aiUserSystem').value;$('aiUserKey').value=u.apiKey||u.apiKeyMask||'';$('aiUserTyping').checked=u.typingPresence!==false;$('aiUserRecording').checked=!!u.recordingPresence;$('aiUserState').textContent=u.configured?`تم تحميل إعداد ${u.phone} • المفتاح محفوظ في اللوحة.`:'لا يوجد إعداد محفوظ لهذا الرقم.';toast('تم تحميل إعداد المستخدم')}catch(e){toast(e.message)}}
async function refreshAIUsers(){
  const box=$('aiUsersList');if(!box)return;
  try{const j=await api('/api/ai-users');if(!j.users?.length){box.textContent='لا توجد إعدادات AI محفوظة لمستخدمين بعد.';return}box.innerHTML=j.users.map(u=>`<div class="ai-user-row"><span><b>${u.phone}</b> • ${u.provider} • ${u.model}</span><span class="${u.enabled?'ok':''}">${u.enabled?'مفعّل':'متوقف'} • ${u.apiKeySet?'🔐 محفوظ':'بدون مفتاح'} • ${u.recordingPresence?'🎙️ تسجيل':'⌨️ كتابة'}</span></div>`).join('')}catch(e){box.textContent='تعذر تحميل قائمة المستخدمين المحفوظين.'}
}
async function saveAIUser(){
  const phone=$('aiUserPhone').value.trim(), key=$('aiUserKey').value.trim();
  if(!phone){toast('أدخل رقمك');return}
  if(!key){toast('أدخل مفتاح API ثم اضغط حفظ إعداد AI');return}
  const maskedOnly=/^[•*]+[0-9A-Za-z_-]{0,8}$/.test(key);
  try{
    const u=await api('/api/ai-user',{method:'POST',body:JSON.stringify({phone,provider:$('aiUserProvider').value,model:$('aiUserModel').value,apiKey:maskedOnly?'':key,enabled:$('aiUserEnabled').checked,groupMode:$('aiUserGroupMode').value,privateEnabled:$('aiUserPrivate').checked,typingPresence:$('aiUserTyping').checked,recordingPresence:$('aiUserRecording').checked,systemPrompt:$('aiUserSystem').value})});
    $('aiUserKey').value=u.apiKey||u.apiKeyMask||key;
    $('aiUserState').textContent=`تم الحفظ للرقم ${u.phone} • ${u.enabled?'الرد الآلي مفعّل':'الرد الآلي متوقف'} • المفتاح محفوظ.`;
    await refreshAIUsers();toast('تم حفظ إعداد AI والمفتاح في اللوحة');
  }catch(e){toast(e.message)}
}
async function testAIUser(){const phone=$('aiUserPhone').value.trim();if(!phone){toast('أدخل رقمك');return}try{const j=await api('/api/ai-user/test',{method:'POST',body:JSON.stringify({phone})});$('aiUserState').textContent='اختبار ناجح: '+j.text;toast('مفتاح AI يعمل بنجاح')}catch(e){toast(e.message)}}
async function deleteAIUser(){const phone=$('aiUserPhone').value.trim();if(!phone)return;if(!confirm('حذف إعداد AI'))return;try{await api('/api/ai-user',{method:'DELETE',body:JSON.stringify({phone})});$('aiUserKey').value='';$('aiUserState').textContent='تم حذف إعداد المستخدم.';await refreshAIUsers();toast('تم الحذف')}catch(e){toast(e.message)}}
async function pair(){try{const j=await api('/api/pair',{method:'POST',body:JSON.stringify({phone:$('phone').value})});$('pairCode').textContent=j.code;toast('تم إنشاء كود الربط')}catch(e){toast(e.message)}}
async function startBot(){try{await api('/api/start',{method:'POST'});toast('تم تشغيل اتصال واتساب')}catch(e){toast(e.message)}}
async function logoutWhatsApp(){if(!confirm('فصل جلسة واتساب وحذف جلسة الربط؟'))return;try{await api('/api/logout-whatsapp',{method:'POST'});toast('تم فصل الجلسة')}catch(e){toast(e.message)}}
function showPage(id){document.querySelectorAll('.page').forEach(x=>x.classList.add('hidden'));$(id).classList.remove('hidden');document.querySelectorAll('nav button').forEach(x=>x.classList.toggle('active',x.dataset.page===id));const titles={home:'الرئيسية',connect:'ربط واتساب',commands:'الأوامر',settings:'الإعدادات',status:'الحالات والرد الذكي',about:'حول'};$('pageTitle').textContent=titles[id]||id;closeMenu()}
document.querySelectorAll('nav button').forEach(b=>b.onclick=()=>showPage(b.dataset.page));
function toggleMenu(){const a=document.querySelector('aside');const open=a.classList.toggle('open');$('menuBackdrop')?.classList.toggle('show',open)}
function closeMenu(){document.querySelector('aside')?.classList.remove('open');$('menuBackdrop')?.classList.remove('show')}

function toast(s){$('toast').textContent=s;$('toast').classList.add('toast-show');setTimeout(()=>$('toast').classList.remove('toast-show'),3000)}
function statusLog(s){const box=$('statusLog');if(!box)return;const d=document.createElement('div');d.textContent=`${new Date().toLocaleTimeString()} — ${s}`;box.prepend(d);while(box.children.length>20)box.lastElementChild.remove()}
init();
