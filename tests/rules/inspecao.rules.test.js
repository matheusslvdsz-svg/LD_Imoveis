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

describe('ciclo documental administrativo v2',()=>{
 const codigo='LD-LAI-2026-000099';
 const base={codigo,tipo:'LAI',ano:2026,sequencial:99,status:'emitido',revisao:'01',criadoEm:'2026-11-09T00:00:00.000Z',criadoPor:'corretor@teste.local',emitidoEm:'2026-11-09T01:00:00.000Z',emitidoPor:'corretor@teste.local'};
 const semRegras=dados=>env.withSecurityRulesDisabled(c=>setDoc(doc(c.firestore(),'documentosOficiais',codigo),dados));
 it('administrador cancela emitido com motivo',async()=>{await semRegras(base);return assertSucceeds(updateDoc(doc(dbComo('admin'),'documentosOficiais',codigo),{status:'cancelado',canceladoPor:'admin@teste.local',canceladoEm:'2026-11-09T02:00:00.000Z',motivoCancelamento:'Documento emitido com informação incorreta'}))});
 it('não administrador não cancela documento',async()=>{await semRegras(base);return assertFails(updateDoc(doc(dbComo('corretor'),'documentosOficiais',codigo),{status:'cancelado',canceladoPor:'corretor@teste.local',canceladoEm:'2026-11-09T02:00:00.000Z',motivoCancelamento:'Documento emitido com informação incorreta'}))});
 it('cancelamento sem motivo é negado',async()=>{await semRegras(base);return assertFails(updateDoc(doc(dbComo('admin'),'documentosOficiais',codigo),{status:'cancelado',canceladoPor:'admin@teste.local',canceladoEm:'2026-11-09T02:00:00.000Z',motivoCancelamento:''}))});
 it('administrador marca documento como substituído',async()=>{await semRegras(base);return assertSucceeds(updateDoc(doc(dbComo('admin'),'documentosOficiais',codigo),{status:'substituido',substituidoPorCodigo:'LD-LAI-2026-000100',substituidoPor:'admin@teste.local',substituidoEm:'2026-11-09T02:00:00.000Z',motivoSubstituicao:'Correção formal do documento emitido'}))});
 it('documento cancelado não volta a emitido',async()=>{await semRegras({...base,status:'cancelado',canceladoPor:'admin@teste.local',canceladoEm:'2026-11-09T02:00:00.000Z',motivoCancelamento:'Cancelamento administrativo'});return assertFails(updateDoc(doc(dbComo('admin'),'documentosOficiais',codigo),{status:'emitido',emitidoPor:'admin@teste.local',emitidoEm:'2026-11-09T03:00:00.000Z'}))});
 it('laudo com código oficial não pode ser apagado',async()=>{await env.withSecurityRulesDisabled(c=>setDoc(doc(c.firestore(),'inspecoes','L-OFICIAL'),{id:'L-OFICIAL',documentoCodigo:codigo}));return assertFails(deleteDoc(doc(dbComo('admin'),'inspecoes','L-OFICIAL')))});
 it('administrador ainda remove rascunho sem código oficial',async()=>{await env.withSecurityRulesDisabled(c=>setDoc(doc(c.firestore(),'inspecoes','L-RASCUNHO'),{id:'L-RASCUNHO',documentoCodigo:''}));return assertSucceeds(deleteDoc(doc(dbComo('admin'),'inspecoes','L-RASCUNHO')))});
});


// ===== Onda 1 da auditoria (12/11/2026) =====
// Escritos para o mesmo ambiente do restante do arquivo:
// env (rules-unit-testing), API modular v9 e usuariosSistema semeados no beforeEach.
describe('Onda 1 - imutabilidade e snapshot', () => {
  const dbComo = (perfil) => env.authenticatedContext('uid-' + perfil, { email: perfil + '@teste.local' }).firestore();
  const semear = (codigo, dados) => env.withSecurityRulesDisabled(
    (c) => setDoc(doc(c.firestore(), 'documentosOficiais', codigo), dados));
  const rascunho = (codigo) => ({
    codigo, tipo: 'LAI', ano: 2026, sequencial: 1, status: 'rascunho', revisao: '01',
    criadoEm: '2026-11-11T00:00:00.000Z', criadoPor: 'admin@teste.local'
  });
  const emitido = {
    status: 'emitido', emitidoEm: '2026-11-11T00:00:00.000Z', emitidoPor: 'admin@teste.local',
    origemColecao: 'inspecoes', origemId: 'ins-1',
    dadosEmitidos: { titulo: 'original', valor: 100 },
    atualizadoEm: '2026-11-11T00:00:00.000Z'
  };
  const cancelamento = {
    status: 'cancelado', canceladoPor: 'admin@teste.local',
    canceladoEm: '2026-11-11T00:00:00.000Z', motivoCancelamento: 'erro material'
  };
  const substituicao = {
    status: 'substituido', substituidoPor: 'admin@teste.local',
    substituidoPorCodigo: 'LD-LAI-2026-000099', substituidoEm: '2026-11-11T00:00:00.000Z',
    motivoSubstituicao: 'retificacao'
  };

  it('A-02: administrador nao edita registro de auditoria', async () => {
    await env.withSecurityRulesDisabled((c) => setDoc(doc(c.firestore(), 'auditoriaSistema', 'AUD-99'), {
      usuario: 'admin@teste.local', criadoEm: '2026-11-11T00:00:00.000Z', acao: 'ALTERACAO', reversivel: true
    }));
    await assertFails(updateDoc(doc(dbComo('admin'), 'auditoriaSistema', 'AUD-99'), { revertida: true }));
  });

  it('A-02: reversao entra como evento novo, apontando para o original', async () => {
    await assertSucceeds(setDoc(doc(dbComo('admin'), 'auditoriaSistema', 'AUD-100'), {
      usuario: 'admin@teste.local', criadoEm: '2026-11-11T00:00:00.000Z',
      acao: 'REVERSAO', revertidaDe: 'AUD-99', motivo: 'erro de lancamento', reversivel: false
    }));
  });

  it('A-03: cancelar nao pode reescrever o conteudo emitido', async () => {
    await semear('LD-LAI-2026-000101', { ...rascunho('LD-LAI-2026-000101'), ...emitido });
    await assertFails(updateDoc(doc(dbComo('admin'), 'documentosOficiais', 'LD-LAI-2026-000101'),
      { ...cancelamento, dadosEmitidos: { adulterado: true } }));
  });

  it('A-03: substituir nao pode reescrever o snapshot congelado', async () => {
    await semear('LD-LAI-2026-000102', { ...rascunho('LD-LAI-2026-000102'), ...emitido });
    await assertFails(updateDoc(doc(dbComo('admin'), 'documentosOficiais', 'LD-LAI-2026-000102'),
      { ...substituicao, dadosEmitidos: { adulterado: true } }));
  });

  it('A-03: cancelamento legitimo continua permitido', async () => {
    await semear('LD-LAI-2026-000103', { ...rascunho('LD-LAI-2026-000103'), ...emitido });
    await assertSucceeds(updateDoc(doc(dbComo('admin'), 'documentosOficiais', 'LD-LAI-2026-000103'), cancelamento));
  });

  it('A-03: substituicao legitima continua permitida', async () => {
    await semear('LD-LAI-2026-000104', { ...rascunho('LD-LAI-2026-000104'), ...emitido });
    await assertSucceeds(updateDoc(doc(dbComo('admin'), 'documentosOficiais', 'LD-LAI-2026-000104'), substituicao));
  });

  it('A-03: codigo e criador nunca mudam', async () => {
    await semear('LD-LAI-2026-000105', rascunho('LD-LAI-2026-000105'));
    await assertFails(updateDoc(doc(dbComo('admin'), 'documentosOficiais', 'LD-LAI-2026-000105'),
      { ...emitido, codigo: 'LD-LAI-2026-999999' }));
  });

  it('A-03: estado terminal nao volta a rascunho', async () => {
    await semear('LD-LAI-2026-000106', { ...rascunho('LD-LAI-2026-000106'), ...emitido, ...cancelamento });
    await assertFails(updateDoc(doc(dbComo('admin'), 'documentosOficiais', 'LD-LAI-2026-000106'),
      { status: 'rascunho' }));
  });

  it('A-03: perfil de consulta nao cancela documento', async () => {
    await semear('LD-LAI-2026-000107', { ...rascunho('LD-LAI-2026-000107'), ...emitido });
    await assertFails(updateDoc(doc(dbComo('consulta'), 'documentosOficiais', 'LD-LAI-2026-000107'),
      { ...cancelamento, canceladoPor: 'consulta@teste.local' }));
  });
});

