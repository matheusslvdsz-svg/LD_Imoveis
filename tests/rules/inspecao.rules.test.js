import {beforeAll,beforeEach,afterAll,describe,it} from 'vitest';
import {initializeTestEnvironment,assertSucceeds,assertFails} from '@firebase/rules-unit-testing';
import {readFileSync} from 'node:fs';
import {doc,getDoc,setDoc,deleteDoc} from 'firebase/firestore';
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
