import {mkdir} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createStore} from '../backend/store.mjs';
const directory=path.resolve(process.env.DATA_DIR||fileURLToPath(new URL('../data/',import.meta.url)));
async function hidden(prompt){
 if(!process.stdin.isTTY)throw Error('Use an interactive terminal to set the owner password, or configure ADMIN_PASSWORD securely on the hosting service for first startup.');
 process.stdout.write(prompt);process.stdin.setRawMode(true);process.stdin.resume();process.stdin.setEncoding('utf8');
 return new Promise((resolve,reject)=>{let value='';function onData(chunk){for(const char of chunk){if(char==='\u0003'){done();reject(Error('Cancelled.'));return;}if(char==='\r'||char==='\n'){done();resolve(value);return;}if(char==='\u007f')value=value.slice(0,-1);else if(char>=' ')value+=char;}}function done(){process.stdin.off('data',onData);process.stdin.setRawMode(false);process.stdin.pause();process.stdout.write('\n');}process.stdin.on('data',onData);});
}
try{
 const password=await hidden('New owner password (12+ characters, hidden): ');
 const confirmation=await hidden('Confirm password (hidden): ');if(password!==confirmation)throw Error('Passwords did not match.');
 await mkdir(directory,{recursive:true,mode:0o700});const store=createStore(path.join(directory,'legado.sqlite'));try{await store.setPassword(password);}finally{store.close();}
 console.log('Owner password saved. Existing sessions have been signed out.');
}catch(error){console.error(error.message);process.exitCode=1;}
