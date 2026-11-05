import {beforeAll,beforeEach,afterAll,describe,it,expect} from 'vitest';
import {initializeTestEnvironment,assertSucceeds,assertFails} from '@firebase/rules-unit-testing';
import {readFileSync} from 'node:fs';
import {doc,getDoc,setDoc,collection,addDoc} from 'firebase/firestore';
let env;
const projeto='demo-ld-imoveis-tests';
const publico={codigo:'LD-001',titulo:'Casa',tipo:'Casa',finalidade:'aluguel',bairro:'Centro',cidade:'Parauapebas',enderecoPublico:'Centro · Parauapebas',exibirEnderecoCompleto:false,publicado:true,atualizadoEm:new Date().toISOString()};
beforeAll(async()=>{env=await initializeTestEnvironment({projectId:projeto,firestore:{rules:readFileSync('firestore.rules','utf8')}})});
beforeEach(async()=>{await env.clearFirestore();await env.withSecurityRulesDisabled(async c=>setDoc(doc(c.firestore(),'usuariosSistema','admin@teste.local'),{perfil:'admin',ativo:true}))});afterAll(async()=>env.cleanup());
async function seed(path,data){await env.withSecurityRulesDisabled(async c=>setDoc(doc(c.firestore(),path),data))}
describe('vitrinePublica segura',()=>{
 it('permite leitura pública somente do publicado',async()=>{await seed('vitrinePublica/a',publico);await assertSucceeds(getDoc(doc(env.unauthenticatedContext().firestore(),'vitrinePublica/a')))});
 it('nega leitura pública do não publicado',async()=>{await seed('vitrinePublica/a',{...publico,publicado:false});await assertFails(getDoc(doc(env.unauthenticatedContext().firestore(),'vitrinePublica/a')))});
 it('nega escrita pública',async()=>assertFails(setDoc(doc(env.unauthenticatedContext().firestore(),'vitrinePublica/a'),publico)));
 it('permite administrador principal publicar projeção válida',async()=>assertSucceeds(setDoc(doc(env.authenticatedContext('uid-admin',{email:'admin@teste.local'}).firestore(),'vitrinePublica/a'),publico)));
 it('nega campo interno mesmo para publicação administrativa',async()=>assertFails(setDoc(doc(env.authenticatedContext('admin',{email:'matheusslvds@gmail.com'}).firestore(),'vitrinePublica/a'),{...publico,proprietario:'Não pode'})));
});
describe('vitrineContatos estrita',()=>{
 const lead={nome:'Cliente Teste',telefone:'94999999999',mensagem:'Tenho interesse.',imovelId:'a',imovelCodigo:'LD-001',imovelTipo:'Casa',criadoEm:new Date().toISOString(),lido:false};
 it('permite lead válido',async()=>assertSucceeds(addDoc(collection(env.unauthenticatedContext().firestore(),'vitrineContatos'),lead)));
 it('nega campo inesperado',async()=>assertFails(addDoc(collection(env.unauthenticatedContext().firestore(),'vitrineContatos'),{...lead,perfil:'admin'})));
 it('nega mensagem excessiva',async()=>assertFails(addDoc(collection(env.unauthenticatedContext().firestore(),'vitrineContatos'),{...lead,mensagem:'x'.repeat(1201)})));
 it('nega contato já marcado como lido',async()=>assertFails(addDoc(collection(env.unauthenticatedContext().firestore(),'vitrineContatos'),{...lead,lido:true})));
});
