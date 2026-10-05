import fs from 'node:fs';
import path from 'node:path';

const file = path.resolve('data/settings.json');
const defaults = {
  prefix: process.env.PREFIX || '!',
  language: process.env.DEFAULT_LANGUAGE || 'ar',
  antilink: true,
  antibadword: false,
  welcome: true,
  statusAutoView: true,
  statusAutoReact: true,
  statusReaction: '❤️',
  aiEnabled: false,
  aiProvider: process.env.AI_PROVIDER || 'gemini',
  aiGroupMode: 'mention',
  aiPrivate: true,
  aiModel: process.env.AI_MODEL || 'gemini-3.8-flash',
  aiSystemPrompt: 'أنت FlowTech، مساعد واتساب مفيد ومختصر. أجب بلغة المستخدم وبأسلوب طبيعي ومحترم.',
  warnings: {},
  badwords: [],
  seenStatuses: [],
  groups: {}
};
function ensure(){fs.mkdirSync(path.dirname(file),{recursive:true});if(!fs.existsSync(file))fs.writeFileSync(file,JSON.stringify(defaults,null,2));}
export function getSettings(){ensure();try{return {...defaults,...JSON.parse(fs.readFileSync(file,'utf8'))};}catch{return structuredClone(defaults);}}
export function saveSettings(data){ensure();fs.writeFileSync(file,JSON.stringify(data,null,2));return data;}
export function updateSettings(patch){return saveSettings({...getSettings(),...patch});}
