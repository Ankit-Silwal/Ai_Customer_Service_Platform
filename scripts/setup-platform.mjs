import { existsSync,readFileSync,writeFileSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
const path=new URL('../.env.platform',import.meta.url);
if(existsSync(path)&&/INTERNAL_SECRET=.{32,}/.test(readFileSync(path,'utf8'))) {console.log('Existing .env.platform preserved.');process.exit(0);}
const password=randomBytes(24).toString('hex');
const text=readFileSync(new URL('../.env.platform.example',import.meta.url),'utf8').replaceAll('replace-with-a-random-local-password',password).replaceAll('replace-with-a-random-storage-password',randomBytes(24).toString('hex')).replaceAll('replace-with-a-random-secret-of-at-least-32-characters',randomBytes(32).toString('hex'));
writeFileSync(path,text,{mode:0o600});console.log('Created .env.platform with random local credentials. Add AI_API_KEY to enable generated answers.');
