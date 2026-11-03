import { readdir, readFile } from 'node:fs/promises';
const proibidos=[/cdn-cgi\/challenge-platform/i,/__CF\$cv\$params/];
const erros=[];
for(const nome of (await readdir('public')).filter(n=>n.endsWith('.html'))){
 const texto=await readFile(`public/${nome}`,'utf8');
 for(const padrao of proibidos) if(padrao.test(texto)) erros.push(`${nome}: ${padrao}`);
}
if(erros.length){console.error('Artefatos externos encontrados:\n'+erros.join('\n'));process.exit(1)}
console.log('OK: nenhum artefato /cdn-cgi ou Cloudflare injetado nos HTMLs.');
