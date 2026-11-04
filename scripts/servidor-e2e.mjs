import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, resolve, sep } from 'node:path';
const raiz=resolve('.'), tipos={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8'};
createServer(async(req,res)=>{try{const alvo=resolve(raiz,'.'+decodeURIComponent(new URL(req.url,'http://local').pathname));if(alvo!==raiz&&!alvo.startsWith(raiz+sep))throw new Error('caminho inválido');if(!(await stat(alvo)).isFile())throw new Error('não encontrado');res.writeHead(200,{'Content-Type':tipos[extname(alvo)]||'application/octet-stream','Cache-Control':'no-store'});res.end(await readFile(alvo))}catch{res.writeHead(404);res.end('Não encontrado')}}).listen(4173,'127.0.0.1',()=>console.log('Servidor E2E em http://127.0.0.1:4173'));
