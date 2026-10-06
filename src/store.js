import fs from 'node:fs';
import path from 'node:path';

const file = path.resolve('data/settings.json');
const defaults = {
  prefix: '.',
  language: 'ar',
  antilink: true,
  antibadword: false,
  welcome: true,
  statusAutoView: true,
  statusAutoReact: true,
  statusReaction: '💚',
  aiEnabled: false,
  aiProvider: process.env.AI_PROVIDER || 'gemini',
  aiGroupMode: 'mention',
  aiPrivate: true,
  aiModel: process.env.AI_MODEL || 'gemini-3.8-flash',
  aiSystemPrompt: 'أنت FlowTech، مساعد واتساب مفيد ومختصر. أجب بلغة المستخدم وبأسلوب طبيعي ومحترم.',
  warnings: {},
  badwords: [],
  seenStatuses: [],
  groups: {},
  muted: {},
  aiSessions: {},
  aiUsers: {},
  aiTyping: true,
  aiRecording: false
};
function ensure(){fs.mkdirSync(path.dirname(file),{recursive:true});if(!fs.existsSync(file)){fs.writeFileSync(file,JSON.stringify(defaults,null,2),{mode:0o600});}try{fs.chmodSync(file,0o600)}catch{}}
export function getSettings(){ensure();try{return {...defaults,...JSON.parse(fs.readFileSync(file,'utf8')),prefix:'.',language:'ar'};}catch{return {...structuredClone(defaults),prefix:'.',language:'ar'};}}
export function saveSettings(data){ensure();const tmp=`${file}.tmp`;fs.writeFileSync(tmp,JSON.stringify(data,null,2),{mode:0o600});try{fs.chmodSync(tmp,0o600)}catch{};fs.renameSync(tmp,file);return data;}
export function updateSettings(patch){const next={...getSettings(),...patch,prefix:'.',language:'ar'};return saveSettings(next);}
