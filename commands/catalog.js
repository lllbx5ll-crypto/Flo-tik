import { labels } from '../src/i18n.js';

const aliases={};
for(const [lang,map] of Object.entries(labels))for(const [key,word] of Object.entries(map))aliases[word.toLowerCase()]=key;
Object.assign(aliases,{
  'مساعدة':'help','اوامر':'allcommands','أوامر':'allcommands','أوامر_البوت':'allcommands','اوامر_البوت':'allcommands','commands':'allcommands','مساعده':'help','قائمة':'menu','القائمة':'menu','بينغ':'ping','حالة':'status','المطور':'owner','مطور':'owner','معلومات':'info','معرف':'id','ايدي':'id',
  'معلومات_المجموعة':'groupinfo','معلومات-المجموعة':'groupinfo','المجموعة':'groupinfo','مشرفين':'admins','المشرفين':'admins','اعضاء':'members','الأعضاء':'members','الاعضاء':'members','منشن':'tagall','تاج':'tagall',
  'طرد':'kick','ترقية':'promote','تنزيل':'demote','اضافة':'add','إضافة':'add','ازالة':'remove','إزالة':'remove','حذف_عضو':'remove',
  'تحذير':'warn','تحذيرات':'warnings','مسح_تحذير':'clearwarn','مسح-تحذير':'clearwarn','كتم':'mute','فك_كتم':'unmute','فك-كتم':'unmute',
  'قفل':'lock','فتح':'unlock','اسم':'setname','وصف':'setdesc','رابط':'linkgroup','الرابط':'linkgroup','تغيير_الرابط':'revoke','تغيير-الرابط':'revoke',
  'حماية':'protect','الغاء_الحماية':'unprotect','إلغاء_الحماية':'unprotect','منع_الروابط':'antilink','منع-الروابط':'antilink','منع_الكلمات':'antibadword','منع-الكلمات':'antibadword','ترحيب':'welcome',
  'حالات':'statusview','مشاهدة_الحالات':'statusview','تفاعل':'statusreact','تفاعل_الحالات':'statusreact','ذكاء':'ai','ذكاء_اصطناعي':'ai','الذكاء':'ai',
  'رد':'react','رد_تلقائي':'ai','حذف_رسالة':'delete','حذف-رسالة':'delete','ايقاف':'stop','إيقاف':'stop',
  'مساعدة':'help','بوت':'menu','حي':'alive','متصل':'alive','وقت_التشغيل':'runtime','تشغيل':'start','اعادة_تشغيل':'restart','إعادة_تشغيل':'restart','ban':'kick','everyone':'tagall','grouplink':'linkgroup','groupinfo':'groupinfo','members':'members','admins':'admins','warn':'warn','warnings':'warnings','clearwarn':'clearwarn','unmute':'unmute','mute':'mute',
  'قفل_المجموعة':'lock','فتح_المجموعة':'unlock','فتح':'unlock','قفل':'lock','رابط_المجموعة':'linkgroup','تغيير_الرابط':'revoke','جروب':'groupinfo','مجموعتي':'groupinfo','معرف_المجموعة':'groupid','ايدي_المجموعة':'groupid','عنوان_المجموعة':'groupinfo','اسم_المجموعة':'setname','وصف_المجموعة':'setdesc','اضف':'add','احذف':'remove','طرد_عضو':'kick','رفع':'promote','خفض':'demote',
  'المشرفين':'admins','الادمن':'admins','الاعضاء':'members','الأعضاء':'members','منشن_الكل':'tagall','الكل':'tagall',
  'باند':'kick','حظر':'kick','طرد_عضو':'remove','ترقية_عضو':'promote','تنزيل_عضو':'demote',
  'تحذير_عضو':'warn','كتم_عضو':'mute','فك_الكتم':'unmute','الغاء_الكتم':'unmute',
  'مضاد_الروابط':'antilink','مضاد_الكلمات':'antibadword','الترحيب':'welcome','حماية_المجموعة':'protect',
  'مضاد_التكرار':'antiflood','منع_التكرار':'antiflood','مضاد_السبام':'antispam','منع_السبام':'antispam','مضاد_المنشن':'antitag','منع_المنشن':'antitag','كلمات_ممنوعة':'badwords','اضافة_كلمة':'setbadword','إضافة_كلمة':'setbadword','حذف_كلمة':'delbadword','مسح_كلمة':'delbadword','حد_التحذير':'setwarnlimit','تصفير_التحذيرات':'clearwarn','فتح_المجموعة':'unlock','قفل_المجموعة':'lock',
  'تفاعل_تلقائي':'statusreact','مشاهدة_تلقائية':'statusview','ايدي':'id','معرف_المجموعة':'groupid','كل_الأوامر':'allcommands','اوامر_المجموعة':'groupcommands','أوامر_المجموعة':'groupcommands','أوامر_الحماية':'protectioncommands',
  'نكتة':'joke','نكته':'joke','حكمة':'quote','اقتباس':'quote','حظ':'luck','نرد':'dice','عملة':'coin','اختيار':'choose','عشوائي':'random','حجر_ورق_مقص':'rps','حجر_ورق_مقص':'rps','حجر':'rps','ورق':'rps','مقص':'rps','نسبة_الحب':'love','حب':'love','8ball':'eightball','سؤال_نعم_لا':'eightball','تحدي':'challenge','هل_تعلم':'fact','معلومة':'fact','معلومات_عامة':'fact','مزاج':'mood','رقم_عشوائي':'random','قصة':'story','مدح':'compliment','ذم':'roast','اسم_عشوائي':'randomname','اسم_عشوائي':'randomname','نعم_لا':'yesno','تخمين':'guess','ترفيه':'fun','العاب':'fun','ألعاب':'fun','العاب_البوت':'fun',
  'الوقت':'time','وقت':'time','التاريخ':'date','تاريخ':'date',
  'حساب':'calc','حاسبة':'calc','احسب':'calc','قل':'say','كرر':'say',
  'عكس':'reverse','عدد_الحروف':'count','عدد_الاحرف':'count',
  'القناة':'channel','قناتي':'channel','حالة_القناة':'channelstatus',
  'رقم_البوت':'botid','معرف_البوت':'botid','ذاكرة':'memory',
  'حالة_الذاكرة':'memory','تشغيل_منذ':'uptime','ايدي_انا':'idme'
});

Object.assign(aliases,{
  'اليوم':'date','يوم':'weekday','الشهر':'month','السنة':'year','الساعة':'time','ساعة':'time',
  'نسبة':'percent','نسبة_مئوية':'percent','خصم':'discount','متوسط':'average','اكبر':'max','أكبر':'max','اصغر':'min','أصغر':'min','تقريب':'round','جذر':'sqrt','تربيع':'square','اس':'power',
  'حروف':'count','كلمات':'words','اسطر':'lines','أسطر':'lines','تنظيف':'trim','تكرار':'repeat','تقسيم':'split','حروف_عشوائية':'randomletters','رمز_عشوائي':'randomcode',
  'معلومات_البوت':'info','حالة_البوت':'status','تشغيل_البوت':'start','اعادة_الاتصال':'restart','إعادة_الاتصال':'restart',
  'غيّر_اسمي':'setprofile_name','غير_اسمي':'setprofile_name','تغيير_اسمي':'setprofile_name','اسمي':'setprofile_name',
  'غيّر_حالتي':'setprofile_status','غير_حالتي':'setprofile_status','تغيير_حالتي':'setprofile_status','حالتي':'setprofile_status',
  'غيّر_صورتي':'setprofile_pic','غير_صورتي':'setprofile_pic','تغيير_صورتي':'setprofile_pic','صورتي':'setprofile_pic','تحديث_صورتي':'setprofile_pic',
  'احذف_صورتي':'removeprofile_pic','حذف_صورتي':'removeprofile_pic','مسح_صورتي':'removeprofile_pic',
  'خصوصية_الصورة':'picprivacy','خصوصية_الحالة':'statusprivacy','خصوصية_الاخر':'lastseenprivacy','خصوصية_الأخير':'lastseenprivacy','خصوصية_الاخير':'lastseenprivacy','خصوصية_الاونلاين':'onlineprivacy','خصوصية_القراءة':'readprivacy',
  'حظر':'block','الغاء_حظر':'unblock','إلغاء_حظر':'unblock','بلوك':'block','فك_البلوك':'unblock',
  'قفل_المعلومات':'lockinfo','فتح_المعلومات':'unlockinfo','قفل_تعديل_المعلومات':'lockinfo','فتح_تعديل_المعلومات':'unlockinfo',
  'عدد_الاعضاء':'members','عدد_الأعضاء':'members','عدد_المشرفين':'admins_count','عدد_المشرفون':'admins_count','موضوع_المجموعة':'groupinfo','وصف_المجموعة':'groupinfo',
  'تثبيت':'pin','تثبيت_الرسالة':'pin','الغاء_التثبيت':'unpin','إلغاء_التثبيت':'unpin','نجمة':'star','ازالة_النجمة':'unstar','إزالة_النجمة':'unstar',
  'منشن':'tagall','منشن_المشرفين':'tagadmins','منشن_الادمن':'tagadmins',
  'رقم_عشوائي':'random','عشوائي':'random','اختيار_عشوائي':'choose','حظي':'luck','عملة':'coin','نرد':'dice','حجر_ورق_مقص':'rps','نسبة_الحب':'love','كرة_سحرية':'eightball','8ball':'eightball',
  'مزحة':'joke','نكتة':'joke','حكمة':'quote','اقتباس':'quote','معلومة':'fact','تحدي':'challenge','قصة':'story','مدح':'compliment','مزاج':'mood','اسم_عشوائي':'randomname','نعم_لا':'yesno',
  'كل_الأوامر_الكاملة':'fullcommands','كل_الاوامر_الكاملة':'fullcommands','fullcommands':'fullcommands','مفتاح_البوت':'botid','معرفي':'idme','الذاكرة':'memory','المدة':'uptime','كل_الأوامر':'allcommands','الأوامر':'help','الاوامر':'help',
  'خصوصية':'privacy','حالة_الاتصال':'status','فحص':'ping','اختبار':'ping',
  'يوتيوب':'youtube','موسيقى':'music','اغنية':'music','أغنية':'music','بحث_موسيقى':'music','فيديو':'youtube','بحث_يوتيوب':'youtube','بلاي':'playstore','متجر':'playstore','متجر_بلاي':'playstore','apk':'apk','تطبيق':'apk','تطبيق_مفتوح':'apk','بحث':'websearch','سوشيال':'social','تحميل':'download','تنزيل':'download','تحميل_فيديو':'download','تحميل_صوت':'download','روابط_السوشيال':'social'
});


Object.assign(aliases,{
  'نسخة':'version','رقم_الحساب':'accountid','من_انا':'whoami','وقت_البوت':'uptime','حالة_الذكاء':'aistatus','حالة_الحماية':'protectionstatus','اعدادات_البوت':'botsettings','فحص_الاتصال':'connectioncheck','اعادة_تحميل':'reload','وقت_الخادم':'servertime',
  'كبير':'upper','صغير':'lower','بدون_مسافات':'nospace','ترقيم':'numberlines','طول':'strlen','كلمات_النص':'textwords','عكس_الكلمات':'reversewords','حروف_فريدة':'uniquechars','ازالة_الارقام':'remove_numbers','ازالة_الرموز':'remove_symbols','تشفير_نصي':'base64','فك_نصي':'unbase64',
  'جمع':'addnums','طرح':'subnums','ضرب':'mulnums','قسمة':'divnums','باقي':'modnums','مطلق':'absnum','مربع':'square','مكعب':'cube','محيط_الدائرة':'circlecirc','مساحة_الدائرة':'circlearea','محيط_المربع':'squarecirc','مساحة_المربع':'squarearea','تحويل_دقائق':'minutes','تحويل_ساعات':'hours',
  'كود':'randomcode','لون_عشوائي':'randomcolor','حرف_عشوائي':'randomchar','ايموجي_عشوائي':'randomemoji','نسبة_عشوائية':'randompercent','اختيار_رقم':'random','قائمة_عشوائية':'shuffle','رمز_قوي':'strongcode',
  'معلومات_الرسالة':'messageinfo','معرف_الرسالة':'messageid','وقت_الرسالة':'messagetime','نوع_الرسالة':'messagetype','طول_الرسالة':'messagelen',
  'اعدادات_المجموعة':'groupconfig','حالة_الحماية':'protectionstatus','عدد_التحذيرات':'warnings','رابط_المجموعة':'linkgroup',
  'اوامر_الترفيه':'fun','اوامر_الادوات':'toolcommands','الاوامر':'allcommands','أوامر':'allcommands','اوامر_البوت':'allcommands','أوامر_البوت':'allcommands',
  'لقب':'nickname','لقبي':'nickname','اسم_دلعي':'nickname','نكني':'nickname','حركة':'movefun','حركات':'movefun','رد_مضحك':'funnyreply','مقلب':'prankline','بايو':'bioidea','زخرفة':'decorate'
});
Object.assign(aliases,{
  'ذكاء_حسابي':'aiconfig','ai_account':'aiconfig','اعدادات_الذكاء':'aiconfig',
  'اللغة':'language','البادئة':'prefix',
  'كامل_الأوامر':'fullcommands','كامل_الاوامر':'fullcommands','كل_الأوامر_الكاملة':'fullcommands','كل_الاوامر_الكاملة':'fullcommands',
  'اوامر_كاملة':'fullcommands','أوامر_كاملة':'fullcommands'
});


const LUXURY_COMMANDS=[
 ['الأساسيات',['قائمة','مساعدة','بينغ','حي','حالة','وقت_التشغيل','تشغيل','اعادة_تشغيل','المطور','معلومات','معرف','معرفي','رقم_البوت','ذاكرة','الوقت','التاريخ','اليوم','الشهر','السنة']],
 ['الحساب والملف',['غيّر_اسمي','غيّر_حالتي','غيّر_صورتي','احذف_صورتي','خصوصية_الصورة','خصوصية_الحالة','خصوصية_الاخر','خصوصية_الاونلاين','خصوصية_القراءة','حظر','الغاء_حظر']],
 ['المجموعة',['معلومات_المجموعة','معرف_المجموعة','المشرفين','عدد_المشرفين','الاعضاء','عدد_الاعضاء','منشن_الكل','منشن_المشرفين','رابط','تغيير_الرابط','اسم','وصف','قفل','فتح','قفل_المعلومات','فتح_المعلومات','اضافة','ازالة','طرد','ترقية','تنزيل']],
 ['الحماية',['حماية','الغاء_الحماية','منع_الروابط','منع_الكلمات','منع_التكرار','منع_السبام','منع_المنشن','ترحيب','اضافة_كلمة','حذف_كلمة','كلمات_ممنوعة','حد_التحذير','تحذير','تحذيرات','مسح_تحذير','كتم','فك_كتم','حذف_رسالة']],
 ['الرسائل',['رد','حذف_رسالة','تثبيت','الغاء_التثبيت','نجمة','ازالة_النجمة','قل','عكس','عدد_الحروف','كلمات','اسطر','تنظيف','تكرار','تقسيم']],
 ['الأدوات',['حساب','نسبة','خصم','متوسط','اكبر','اصغر','تقريب','جذر','تربيع','اس','رقم_عشوائي','رمز_عشوائي','حروف_عشوائية']],
 ['الترفيه',['نكتة','حكمة','حظ','نرد','عملة','اختيار','حجر_ورق_مقص','نسبة_الحب','8ball','تحدي','هل_تعلم','معلومة','مزاج','قصة','مدح','ذم','اسم_عشوائي','نعم_لا','تخمين','لقب','حركة','رد_مضحك','مقلب','بايو','زخرفة']],
 ['الحالات',['مشاهدة_الحالات','تفاعل_الحالات','تفاعل','رد']],
 ['الذكاء الاصطناعي',['ذكاء','ذكاء_حسابي']],
 ['النظام والقناة',['القناة','حالة_القناة','اللغة','البادئة']],
 ['البحث والتنزيل',['موسيقى','تحميل','يوتيوب','فيديو','apk','بلاي','متجر','سوشيال']]
];

// FlowTech V31.2 expanded catalog: lightweight local commands that do not need external APIs.
LUXURY_COMMANDS.push(
 ['النظام المتقدم',['نسخة','رقم_الحساب','من_انا','وقت_البوت','حالة_الذكاء','حالة_الحماية','اعدادات_البوت','فحص_الاتصال','اعادة_تحميل','وقت_الخادم']],
 ['النصوص المتقدمة',['كبير','صغير','بدون_مسافات','ترقيم','طول','كلمات_النص','عكس_الكلمات','حروف_فريدة','ازالة_الارقام','ازالة_الرموز','تشفير_نصي','فك_نصي']],
 ['الحسابات المتقدمة',['جمع','طرح','ضرب','قسمة','باقي','مطلق','مربع','مكعب','محيط_الدائرة','مساحة_الدائرة','محيط_المربع','مساحة_المربع','تحويل_دقائق','تحويل_ساعات']],
 ['العشوائيات',['كود','لون_عشوائي','حرف_عشوائي','ايموجي_عشوائي','نسبة_عشوائية','اختيار_رقم','قائمة_عشوائية','رمز_قوي']],
 ['الرسائل المتقدمة',['معلومات_الرسالة','معرف_الرسالة','وقت_الرسالة','نوع_الرسالة','طول_الرسالة']],
 ['المجموعة المتقدمة',['اعدادات_المجموعة','حالة_الحماية','عدد_التحذيرات','منشن_المشرفين','رابط_المجموعة']],
 ['المساعدة السريعة',['الاوامر','اوامر','اوامر_البوت','أوامر_البوت','اوامر_المجموعة','اوامر_الحماية','اوامر_الترفيه','اوامر_الادوات']]
);

const luxuryCommandNames=new Set(LUXURY_COMMANDS.flatMap(([,items])=>items));

export { aliases, LUXURY_COMMANDS, luxuryCommandNames };
