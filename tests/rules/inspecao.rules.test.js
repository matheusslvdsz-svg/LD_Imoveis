import {beforeAll,beforeEach,afterAll,describe,it} from 'vitest';
import {initializeTestEnvironment,assertSucceeds,assertFails} from '@firebase/rules-unit-testing';
import {readFileSync} from 'node:fs';
import {doc,getDoc,setDoc,deleteDoc,updateDoc} from 'firebase/firestore';
let env; const projeto='demo-ld-imoveis-tests';
const perfis=['admin','financeiro','corretor','manutencao','consulta'];
beforeAll(async()=>{env=await initializeTestEnvironment({projectId:projeto,firestore:{rules:readFileSync('firestore.rules','utf8')}})});
beforeEach(async()=>{await env.clearFirestore();await env.withSecurityRulesDisabled(async c=>{for(const perfil of perfis)await setDoc(doc(c.firestore(),'usuariosSistema',`${perfil}@teste.local`),{perfil,ativo:true});})});
afterAll(async()=>env.cleanup());
const dbComo=perfil=>env.authenticatedContext(`uid-${perfil}`,{email:`${perfil}@teste.local`}).firestore();
for(const colecao of ['inspecoes','inspecaoImoveis']) describe(`regras de ${colecao}`,()=>{
 for(const perfil of perfis) it(`${perfil} pode ler`,()=>assertSucceeds(getDoc(doc(dbComo(perfil),colecao,'TESTE-001'))));
 for(const perfil of ['admin','financeiro','corretor','manutencao']) it(`${perfil} pode gravar`,()=>assertSucceeds(setDoc(doc(dbComo(perfil),colecao,'TESTE-001'),{codigo:'TESTE-001'})));
 it('consulta não pode gravar',()=>assertFails(setDoc(doc(dbComo('consulta'),colecao,'TESTE-001'),{codigo:'TESTE-001'})));
 it('admin pode excluir',async()=>{await env.withSecurityRulesDisabled(c=>setDoc(doc(c.firestore(),colecao,'TESTE-001'),{codigo:'TESTE-001'}));return assertSucceeds(deleteDoc(doc(dbComo('admin'),colecao,'TESTE-001')))});
 for(const perfil of ['financeiro','corretor','manutencao','consulta']) it(`${perfil} não pode excluir`,async()=>{await env.withSecurityRulesDisabled(c=>setDoc(doc(c.firestore(),colecao,'TESTE-001'),{codigo:'TESTE-001'}));return assertFails(deleteDoc(doc(dbComo(perfil),colecao,'TESTE-001')))});
 it('não autenticado não pode ler',()=>assertFails(getDoc(doc(env.unauthenticatedContext().firestore(),colecao,'TESTE-001'))));
 it('usuário sem perfil não pode ler',()=>assertFails(getDoc(doc(env.authenticatedContext('sem',{email:'sem@teste.local'}).firestore(),colecao,'TESTE-001'))));
});

describe('núcleo documental v2',()=>{
 it('admin reserva primeiro contador anual',()=>assertSucceeds(setDoc(doc(dbComo('admin'),'documentosContadores','LAI-2026'),{tipo:'LAI',ano:2026,ultimo:1,atualizadoEm:'2026-11-09T00:00:00.000Z',atualizadoPor:'admin@teste.local'})));
 it('consulta não reserva contador',()=>assertFails(setDoc(doc(dbComo('consulta'),'documentosContadores','LAI-2026'),{tipo:'LAI',ano:2026,ultimo:1,atualizadoEm:'2026-11-09T00:00:00.000Z',atualizadoPor:'consulta@teste.local'})));
 it('contador só avança uma unidade',async()=>{await env.withSecurityRulesDisabled(c=>setDoc(doc(c.firestore(),'documentosContadores','LAI-2026'),{tipo:'LAI',ano:2026,ultimo:3,atualizadoPor:'admin@teste.local'}));return assertFails(updateDoc(doc(dbComo('admin'),'documentosContadores','LAI-2026'),{ultimo:5,atualizadoPor:'admin@teste.local'}))});
 it('corretor cria documento próprio em rascunho',()=>assertSucceeds(setDoc(doc(dbComo('corretor'),'documentosOficiais','LD-LAI-2026-000001'),{codigo:'LD-LAI-2026-000001',tipo:'LAI',ano:2026,sequencial:1,status:'rascunho',revisao:'01',criadoEm:'2026-11-09T00:00:00.000Z',criadoPor:'corretor@teste.local'})));
 it('não permite apagar documento oficial',async()=>{await env.withSecurityRulesDisabled(c=>setDoc(doc(c.firestore(),'documentosOficiais','LD-LAI-2026-000001'),{codigo:'LD-LAI-2026-000001'}));return assertFails(deleteDoc(doc(dbComo('admin'),'documentosOficiais','LD-LAI-2026-000001')))});
 it('usuário registra auditoria apenas em seu nome',()=>assertSucceeds(setDoc(doc(dbComo('corretor'),'auditoriaSistema','AUD-1'),{usuario:'corretor@teste.local',criadoEm:'2026-11-09T00:00:00.000Z',acao:'RESERVA_DE_CODIGO'})));
 it('nega auditoria forjada em nome de outro usuário',()=>assertFails(setDoc(doc(dbComo('corretor'),'auditoriaSistema','AUD-2'),{usuario:'admin@teste.local',criadoEm:'2026-11-09T00:00:00.000Z',acao:'RESERVA_DE_CODIGO'})));
});


it('principal sem perfil pode reservar código documental',()=>{
 const db=env.authenticatedContext('uid-principal',{email:'matheusslvdsz@gmail.com'}).firestore();
 return assertSucceeds(setDoc(doc(db,'documentosContadores','LAI-2026'),{
  tipo:'LAI',ano:2026,ultimo:1,
  atualizadoEm:'2026-11-09T00:00:00.000Z',
  atualizadoPor:'matheusslvdsz@gmail.com'
 }));
});
