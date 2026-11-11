#!/usr/bin/env node
/**
 * LD Imóveis — v2.0.0 — Fase 3A
 * Central de Pendências, com as decisões aprovadas:
 *  1. Contrato vencendo: 30 dias
 *  2. Rascunho de laudo abandonado: mais de 7 dias
 *  3. Fechamento em aberto: aparece a partir do dia 6 do mês seguinte
 *  4. Corretor vê pendências de laudo
 *  5. Nome da aba: "Pendências"
 *
 * Cria:
 *  - public/js/pendencias-core.js  (regras puras, testáveis)
 *  - aba Pendências no Painel (somente leitura, sem coleção nova)
 *  - tests/unit/pendencias-core.test.js
 *  - tests/e2e/pendencias.spec.js
 *
 * Execute na raiz do repositório:  node .\APLICAR_PENDENCIAS_3A.mjs
 */
import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync } from 'node:fs';

const falhas = [];
const aplicadas = [];

function ler(caminho) {
  if (!existsSync(caminho)) { falhas.push('Arquivo não encontrado: ' + caminho); return null; }
  return readFileSync(caminho, 'utf8');
}

function trocar(html, antes, depois, rotulo) {
  const total = html.split(antes).length - 1;
  if (total !== 1) {
    falhas.push('Trecho "' + rotulo + '" encontrado ' + total + ' vez(es); esperado 1.');
    return html;
  }
  aplicadas.push(rotulo);
  return html.replace(antes, depois);
}

/* ============================================================
   1. Núcleo de regras (arquivo novo, testável isoladamente)
   ============================================================ */
const NUCLEO = `/**
 * LD Imóveis — Central de Pendências (regras puras)
 * Sem Firestore, sem DOM, sem data atual implícita: recebe os dados e a data.
 */

const DIA = 24 * 60 * 60 * 1000;

export const NIVEIS = ['critica', 'alta', 'media'];
export const PESO_NIVEL = { critica: 0, alta: 1, media: 2 };

export const AREAS = {
  contratos: { nome: 'Contratos', aba: 'contratos' },
  laudos: { nome: 'Laudos e documentos', aba: 'inspecoes' },
  fechamento: { nome: 'Fechamento', aba: 'fechamento' },
  manutencoes: { nome: 'Manutenções', aba: 'manutencao' }
};

/** Áreas visíveis por perfil (decisão 4: corretor vê pendências de laudo). */
export const AREAS_POR_PERFIL = {
  admin: ['contratos', 'laudos', 'fechamento', 'manutencoes'],
  financeiro: ['contratos', 'laudos', 'fechamento'],
  corretor: ['laudos', 'manutencoes'],
  manutencao: ['manutencoes'],
  consulta: ['contratos', 'laudos', 'fechamento', 'manutencoes']
};

const LIMIARES = {
  diasContratoVencendo: 30,
  diasRascunhoAbandonado: 7,
  diasChamadoParado: 15,
  diaCarenciaFechamento: 5
};

const soData = (valor) => String(valor || '').slice(0, 10);

export function diasEntre(de, ate) {
  const a = Date.parse(soData(de) + 'T00:00:00Z');
  const b = Date.parse(soData(ate) + 'T00:00:00Z');
  if (Number.isNaN(a) || Number.isNaN(b)) return null;
  return Math.round((b - a) / DIA);
}

function somarDias(dataISO, dias) {
  const base = Date.parse(soData(dataISO) + 'T00:00:00Z');
  return new Date(base + dias * DIA).toISOString().slice(0, 10);
}

function mesAnterior(hoje) {
  const d = new Date(soData(hoje) + 'T00:00:00Z');
  d.setUTCDate(1);
  d.setUTCMonth(d.getUTCMonth() - 1);
  return d.toISOString().slice(0, 7);
}

function primeiroDiaDoMes(ym) { return ym + '-01'; }

function ultimoDiaDoMes(ym) {
  const d = new Date(ym + '-01T00:00:00Z');
  d.setUTCMonth(d.getUTCMonth() + 1);
  d.setUTCDate(0);
  return d.toISOString().slice(0, 10);
}

const numeroDoMes = (ym) => Number(String(ym).slice(5, 7));
const nomeDoMes = (ym) => ['jan', 'fev', 'mar', 'abr', 'mai', 'jun',
  'jul', 'ago', 'set', 'out', 'nov', 'dez'][numeroDoMes(ym) - 1] + '/' + String(ym).slice(0, 4);

function contratoVigenteNoMes(contrato, ym) {
  const inicio = soData(contrato.inicio || contrato.dataInicio);
  const fim = soData(contrato.fim || contrato.dataFim);
  if (!inicio && !fim) return false;
  if (inicio && inicio > ultimoDiaDoMes(ym)) return false;
  if (fim && fim < primeiroDiaDoMes(ym)) return false;
  return true;
}

function imovelAlugado(imoveis, contrato) {
  const codigo = String(contrato.imovelCodigo || contrato.codigoImovel || contrato.codigo || '');
  const alvo = imoveis.find((i) => String(i.codigo || '') === codigo || (contrato.imovelId && i.id === contrato.imovelId));
  return !!alvo && alvo.status === 'alugado';
}

function identificacaoContrato(contrato) {
  const codigo = contrato.imovelCodigo || contrato.codigoImovel || contrato.codigo || contrato.numero || 'sem código';
  const inquilino = contrato.inquilino || contrato.inquilinoNome || contrato.locatario || '';
  return inquilino ? codigo + ' · ' + inquilino : String(codigo);
}

/**
 * @param {{contratos?:Array, imoveis?:Array, inspecoes?:Array, documentosOficiais?:Array,
 *          fechamentos?:Array, manutencoes?:Array}} dados
 * @param {{perfil?:string, hoje?:string}} opcoes
 * @returns {Array<{id:string, area:string, nivel:string, titulo:string, detalhe:string,
 *                  desde:string, diasAtraso:number, acao:string, aba:string}>}
 */
export function calcularPendencias(dados = {}, opcoes = {}) {
  const hoje = soData(opcoes.hoje) || new Date().toISOString().slice(0, 10);
  const perfil = opcoes.perfil || 'admin';
  const areasPermitidas = AREAS_POR_PERFIL[perfil] || AREAS_POR_PERFIL.admin;

  const contratos = Array.isArray(dados.contratos) ? dados.contratos : [];
  const imoveis = Array.isArray(dados.imoveis) ? dados.imoveis : [];
  const inspecoes = Array.isArray(dados.inspecoes) ? dados.inspecoes : [];
  const documentos = Array.isArray(dados.documentosOficiais) ? dados.documentosOficiais : [];
  const fechamentos = Array.isArray(dados.fechamentos) ? dados.fechamentos : [];
  const manutencoes = Array.isArray(dados.manutencoes) ? dados.manutencoes : [];

  const lista = [];
  const push = (item) => {
    if (!areasPermitidas.includes(item.area)) return;
    const area = AREAS[item.area];
    lista.push(Object.assign({ aba: area.aba, acao: 'Abrir ' + area.nome }, item));
  };

  /* 1. Contrato vencido e imóvel ainda marcado como alugado */
  contratos.forEach((c) => {
    const fim = soData(c.fim || c.dataFim);
    if (!fim || fim >= hoje) return;
    if (!imovelAlugado(imoveis, c)) return;
    push({
      id: 'contrato-vencido:' + (c.id || fim),
      area: 'contratos',
      nivel: 'critica',
      titulo: 'Contrato vencido',
      detalhe: identificacaoContrato(c) + ' · venceu em ' + fim.split('-').reverse().join('/') + ' e o imóvel segue alugado',
      desde: fim,
      diasAtraso: diasEntre(fim, hoje) || 0
    });
  });

  /* 2. Contrato vencendo nos próximos 30 dias */
  const limite = somarDias(hoje, LIMIARES.diasContratoVencendo);
  contratos.forEach((c) => {
    const fim = soData(c.fim || c.dataFim);
    if (!fim || fim < hoje || fim > limite) return;
    const inicio = soData(c.inicio || c.dataInicio);
    const jaComecou = !inicio || inicio <= hoje;
    if (!jaComecou) return;
    push({
      id: 'contrato-vencendo:' + (c.id || fim),
      area: 'contratos',
      nivel: 'alta',
      titulo: 'Contrato vencendo',
      detalhe: identificacaoContrato(c) + ' · vence em ' + fim.split('-').reverse().join('/') +
        ' (' + (diasEntre(hoje, fim) || 0) + ' dias)',
      desde: fim,
      diasAtraso: 0,
      prazoDias: diasEntre(hoje, fim) || 0
    });
  });

  /* 3. Documento oficial emitido sem snapshot histórico */
  documentos.forEach((d) => {
    const status = String(d.status || '');
    if (status !== 'emitido') return;
    const snapshot = d.dadosEmitidos;
    const temSnapshot = snapshot && typeof snapshot === 'object' && Object.keys(snapshot).length > 0;
    if (temSnapshot) return;
    const referencia = soData(d.emitidoEm || d.atualizadoEm || d.criadoEm);
    const base = referencia || hoje;
    push({
      id: 'documento-sem-snapshot:' + (d.codigo || d.id || ''),
      area: 'laudos',
      nivel: 'critica',
      titulo: 'Documento emitido sem snapshot',
      detalhe: String(d.codigo || d.id || 'sem código') + ' · emitido sem o conteúdo histórico gravado',
      desde: base,
      diasAtraso: diasEntre(base, hoje) || 0
    });
  });

  /* 4. Rascunho de laudo abandonado há mais de 7 dias */
  inspecoes.forEach((l) => {
    const codigoDocumento = String(l.documentoCodigo || '');
    const status = String(l.documentoStatus || '');
    if (!codigoDocumento || status !== 'rascunho') return;
    const criado = soData(l.criadoEm);
    if (!criado) return;
    const dias = diasEntre(criado, hoje);
    if (dias === null || dias <= LIMIARES.diasRascunhoAbandonado) return;
    const imovel = l.codigo || l.imovelCodigo || 'imóvel sem código';
    push({
      id: 'rascunho:' + (l.id || codigoDocumento),
      area: 'laudos',
      nivel: 'alta',
      titulo: 'Rascunho de laudo abandonado',
      detalhe: codigoDocumento + ' · nunca foi emitido · ' + imovel,
      desde: criado,
      diasAtraso: dias
    });
  });

  /* 5. Fechamento do mês anterior em aberto (carência até o dia 5) */
  const hojeNumero = Number(hoje.slice(8, 10));
  if (hojeNumero > LIMIARES.diaCarenciaFechamento) {
    const ym = mesAnterior(hoje);
    const contratosDoMes = contratos.filter((c) => contratoVigenteNoMes(c, ym));
    const fechado = fechamentos.some((f) => String(f.periodo || f.data || '').slice(0, 7) === ym);
    if (contratosDoMes.length && !fechado) {
      const desde = primeiroDiaDoMes(ym);
      push({
        id: 'fechamento:' + ym,
        area: 'fechamento',
        nivel: 'alta',
        titulo: 'Fechamento em aberto',
        detalhe: nomeDoMes(ym) + ' · ' + contratosDoMes.length +
          (contratosDoMes.length === 1 ? ' contrato vigente no mês' : ' contratos vigentes no mês'),
        desde,
        diasAtraso: diasEntre(desde, hoje) || 0
      });
    }
  }

  /* 6. Chamado de manutenção parado */
  manutencoes.forEach((m) => {
    const status = String(m.status || 'Aberto');
    if (['Concluído', 'Concluido', 'Cancelado'].includes(status)) return;
    const prazo = soData(m.prazo);
    const criado = soData(m.criadoEm || m.data);
    const atrasadoPrazo = prazo && prazo < hoje;
    const diasCriado = criado ? diasEntre(criado, hoje) : null;
    const parado = diasCriado !== null && diasCriado > LIMIARES.diasChamadoParado;
    if (!atrasadoPrazo && !parado) return;
    const referencia = atrasadoPrazo ? prazo : criado;
    const codigo = m.imovelCodigo || m.codigo || m.imovel || 'imóvel sem código';
    push({
      id: 'manutencao:' + (m.id || codigo),
      area: 'manutencoes',
      nivel: 'media',
      titulo: 'Chamado parado',
      detalhe: String(m.descricao || m.problema || 'Manutenção') + ' · ' + codigo +
        (m.prioridade ? ' · prioridade ' + String(m.prioridade).toLowerCase() : ''),
      desde: referencia,
      diasAtraso: diasEntre(referencia, hoje) || 0
    });
  });

  return lista.sort((a, b) => {
    const nivel = PESO_NIVEL[a.nivel] - PESO_NIVEL[b.nivel];
    if (nivel !== 0) return nivel;
    return (b.diasAtraso || 0) - (a.diasAtraso || 0);
  });
}

export function resumirPendencias(lista = []) {
  return {
    critica: lista.filter((p) => p.nivel === 'critica').length,
    alta: lista.filter((p) => p.nivel === 'alta').length,
    media: lista.filter((p) => p.nivel === 'media').length,
    total: lista.length
  };
}

export const LIMIARES_PENDENCIAS = Object.freeze(LIMIARES);
`;

if (!existsSync('public/js')) {
  if (existsSync('public')) mkdirSync('public/js', { recursive: true });
  else falhas.push('Pasta public/ não encontrada.');
}
if (!falhas.length) {
  writeFileSync('public/js/pendencias-core.js', NUCLEO, 'utf8');
  aplicadas.push('núcleo de regras em public/js/pendencias-core.js');
}

/* ============================================================
   2. Painel: menu, aba, estilos, escutas e renderização
   ============================================================ */
const alvos = ['public/LD_Imoveis_Sistema_Gerencial.html', 'public/Sistema_Gerencial.html'];
let painel = alvos.find((p) => existsSync(p));
if (!painel) {
  const achados = existsSync('public')
    ? readdirSync('public').filter((n) => /gerencial/i.test(n) && n.endsWith('.html')).sort()
    : [];
  if (achados.length === 1) painel = 'public/' + achados[0];
}
if (!painel) falhas.push('Painel Gerencial não localizado em public/.');

let html = painel ? ler(painel) : null;

if (html) {
  /* 2.1 Importa o núcleo no módulo do Painel */
  html = trocar(
    html,
    `import { getFirestore, collection, addDoc, updateDoc, deleteDoc, doc, onSnapshot, getDocs, query, orderBy, setDoc, getDoc, getDocFromServer } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";`,
    `import { getFirestore, collection, addDoc, updateDoc, deleteDoc, doc, onSnapshot, getDocs, query, orderBy, setDoc, getDoc, getDocFromServer } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";\nimport { calcularPendencias, resumirPendencias } from './js/pendencias-core.js';`,
    'import do núcleo de pendências'
  );

  /* 2.2 Item de menu depois do Dashboard */
  html = trocar(
    html,
    `<a class="nav-link active" data-aba="dashboard" onclick="navegar('dashboard', this)"><i class="fas fa-chart-pie"></i> Dashboard</a>`,
    `<a class="nav-link active" data-aba="dashboard" onclick="navegar('dashboard', this)"><i class="fas fa-chart-pie"></i> Dashboard</a>\n            <a class="nav-link" data-aba="pendencias" onclick="navegar('pendencias', this)"><i class="fas fa-triangle-exclamation"></i> Pendências</a>`,
    'item de menu Pendências'
  );

  /* 2.3 Aba liberada para todos os perfis */
  html = html.replace(/abas:\[([^\]]*)\]/g, (m, lista) => {
    if (lista.includes("'pendencias'")) return m;
    return "abas:['dashboard','pendencias'," + lista.replace(/^'dashboard',/, '') + ']';
  });
  if (html.includes("'pendencias',")) aplicadas.push('aba liberada nos perfis');

  /* 2.4 Estado das coleções novas */
  html = trocar(
    html,
    `fechamentos: [], historicoContratos: [], auditoriaSistema: []`,
    `fechamentos: [], historicoContratos: [], auditoriaSistema: [], inspecoes: [], documentosOficiais: []`,
    'estado das coleções de laudo'
  );

  /* 2.5 Escutas das coleções usadas pelas pendências */
  html = trocar(
    html,
    `        ['auditoriaSistema', (docs) => { state.auditoriaSistema = docs; renderizarAuditoria(); }],`,
    `        ['auditoriaSistema', (docs) => { state.auditoriaSistema = docs; renderizarAuditoria(); }],\n        ['inspecoes', (docs) => { state.inspecoes = docs; }],\n        ['documentosOficiais', (docs) => { state.documentosOficiais = docs; }],`,
    'escutas de inspecoes e documentosOficiais'
  );

  /* 2.6 Perfis que já podem ler essas coleções pelas Rules */
  const perfis = {
    financeiro: "financeiro: ['imoveis','inquilinos','proprietarios','contratos','historicoContratos','financeiro','fechamentos','manutencoes','eventos'],",
    corretor: "corretor: ['imoveis','inquilinos','proprietarios','contratos','leadsCorretores','eventos'],",
    manutencao: "manutencao: ['imoveis','inquilinos','proprietarios','contratos','manutencoes'],",
    consulta: "consulta: ['imoveis','inquilinos','proprietarios','contratos','historicoContratos','manutencoes']"
  };
  Object.entries(perfis).forEach(([nome, linha]) => {
    const novo = linha.replace("],", ",'inspecoes','documentosOficiais'],");
    html = trocar(html, linha, novo, 'escutas do perfil ' + nome);
  });

  /* 2.7 Recalcular quando qualquer coleção mudar */
  html = trocar(
    html,
    `                aplicar(snap.docs.map(d => ({ id: d.id, ...d.data() })));
                atualizarDashboard();   // qualquer dado novo reflete no painel`,
    `                aplicar(snap.docs.map(d => ({ id: d.id, ...d.data() })));
                atualizarDashboard();   // qualquer dado novo reflete no painel
                if (window.renderizarPendencias) window.renderizarPendencias();`,
    'recálculo ao receber dados'
  );

  /* 2.8 Abrir a aba */
  html = trocar(
    html,
    `    if (aba === 'financeiro') popularSelectsFin();`,
    `    if (aba === 'financeiro') popularSelectsFin();\n    if (aba === 'pendencias' && window.renderizarPendencias) window.renderizarPendencias();`,
    'renderização ao abrir a aba'
  );

  /* 2.9 Seção da aba, antes da Auditoria */
  const secao = `            <!-- TAB: PENDÊNCIAS -->
            <section class="tab" id="tab-pendencias">
                <div class="header">
                    <div>
                        <h1>Central de <span>Pendências</span></h1>
                        <p style="color:var(--text-muted)">O que está atrasado agora, com quem resolve. Calculado a partir do que já está cadastrado — nada é marcado à mão.</p>
                    </div>
                    <button class="btn btn-outline btn-sm" onclick="renderizarPendencias()"><i class="fas fa-rotate"></i> Atualizar</button>
                </div>
                <div class="pend-kpis">
                    <div class="pend-kpi critica"><span>Críticas</span><b id="pendKpiCritica">0</b></div>
                    <div class="pend-kpi alta"><span>Altas</span><b id="pendKpiAlta">0</b></div>
                    <div class="pend-kpi media"><span>Médias</span><b id="pendKpiMedia">0</b></div>
                    <div class="pend-kpi"><span>Total</span><b id="pendKpiTotal">0</b></div>
                </div>
                <div class="consulta-toolbar">
                    <label><i class="fas fa-search"></i><input id="pendBusca" placeholder="Pesquisar imóvel, contrato, documento ou chamado" oninput="renderizarPendencias()"></label>
                    <select id="pendArea" onchange="renderizarPendencias()">
                        <option value="">Todas as áreas</option>
                        <option value="contratos">Contratos</option>
                        <option value="laudos">Laudos e documentos</option>
                        <option value="fechamento">Fechamento</option>
                        <option value="manutencoes">Manutenções</option>
                    </select>
                    <select id="pendNivel" onchange="renderizarPendencias()">
                        <option value="">Todos os níveis</option>
                        <option value="critica">Críticas</option>
                        <option value="alta">Altas</option>
                        <option value="media">Médias</option>
                    </select>
                    <span id="pendResumo">0 pendências</span>
                </div>
                <div id="listaPendencias" class="pend-lista"></div>
                <p class="pend-nota">Esta tela não grava nada. A pendência desaparece quando o registro é corrigido de verdade — contrato encerrado, laudo emitido, fechamento gerado ou chamado concluído.</p>
            </section>

`;
  if (!html.includes('id="tab-pendencias"')) {
    const marca = '            <section class="tab" id="tab-auditoria">';
    if (html.includes(marca)) {
      html = html.replace(marca, secao + marca);
      aplicadas.push('seção da aba Pendências');
    } else {
      falhas.push('Seção #tab-auditoria não encontrada para inserir a aba Pendências.');
    }
  }

  /* 2.10 Estilos */
  const css = `
        /* Central de Pendências — v2.0.0 */
        .pend-kpis{display:grid;grid-template-columns:repeat(auto-fit,minmax(130px,1fr));gap:10px;margin:14px 0}
        .pend-kpi{background:var(--bg-card,#141821);border:1px solid rgba(255,255,255,.08);border-radius:12px;padding:12px 14px}
        .pend-kpi span{display:block;font-size:11px;letter-spacing:.08em;text-transform:uppercase;color:var(--text-muted,#9aa3b2)}
        .pend-kpi b{font-size:22px;line-height:1.3}
        .pend-kpi.critica b{color:#ff8b8b}
        .pend-kpi.alta b{color:#e8c07c}
        .pend-kpi.media b{color:#8fc0ff}
        .pend-lista{display:flex;flex-direction:column;gap:8px;margin-top:6px}
        .pend-item{display:flex;gap:12px;align-items:center;background:var(--bg-card,#141821);border:1px solid rgba(255,255,255,.08);border-left-width:3px;border-radius:10px;padding:12px 14px}
        .pend-item.critica{border-left-color:#d63031}
        .pend-item.alta{border-left-color:#e6aa3c}
        .pend-item.media{border-left-color:#5aa0ff}
        .pend-corpo{flex:1;min-width:0}
        .pend-titulo{font-weight:700;font-size:14px;display:flex;gap:8px;align-items:center;flex-wrap:wrap}
        .pend-detalhe{font-size:12.5px;color:var(--text-muted,#9aa3b2);margin-top:2px;word-break:break-word}
        .pend-tempo{font-size:11.5px;color:var(--text-muted,#9aa3b2);white-space:nowrap;text-align:right}
        .pend-selo{display:inline-block;padding:2px 8px;border-radius:999px;font-size:9.5px;font-weight:700;letter-spacing:.05em;border:1px solid transparent}
        .pend-selo.critica{background:rgba(214,48,49,.16);border-color:rgba(214,48,49,.5);color:#ff9aa0}
        .pend-selo.alta{background:rgba(230,170,60,.14);border-color:rgba(230,170,60,.45);color:#e8c07c}
        .pend-selo.media{background:rgba(90,160,255,.14);border-color:rgba(90,160,255,.4);color:#8fc0ff}
        .pend-vazio{background:var(--bg-card,#141821);border:1px dashed rgba(255,255,255,.14);border-radius:10px;padding:26px 18px;text-align:center;color:var(--text-muted,#9aa3b2);font-size:13px}
        .pend-nota{margin:12px 0 0;font-size:12px;color:var(--text-muted,#9aa3b2)}
        @media(max-width:640px){
          .pend-kpis{grid-template-columns:repeat(2,1fr)}
          .pend-item{flex-direction:column;align-items:flex-start;gap:6px}
          .pend-tempo{text-align:left}
        }
`;
  const fechamento = html.indexOf('</style></head>');
  if (fechamento < 0) {
    falhas.push('Bloco de estilos do Painel não encontrado.');
  } else {
    html = html.replace('</style></head>', css + '\n    </style></head>');
    aplicadas.push('estilos da central de pendências');
  }

  /* 2.11 Lógica de renderização, antes da auditoria */
  const js = `
/* ========================= CENTRAL DE PENDÊNCIAS (somente leitura) ========================= */
const PEND_NIVEL_TEXTO = { critica: 'CRÍTICA', alta: 'ALTA', media: 'MÉDIA' };

function pendenciasVisiveis() {
  const q = normalizarVinculo($('pendBusca')?.value || '');
  const area = $('pendArea')?.value || '';
  const nivel = $('pendNivel')?.value || '';
  return devolverPendencias()
    .filter(p => !area || p.area === area)
    .filter(p => !nivel || p.nivel === nivel)
    .filter(p => !q || normalizarVinculo([p.titulo, p.detalhe, p.area].join(' ')).includes(q));
}

function devolverPendencias() {
  try {
    return calcularPendencias({
      contratos: state.contratos,
      imoveis: state.imoveis,
      inspecoes: state.inspecoes,
      documentosOficiais: state.documentosOficiais,
      fechamentos: state.fechamentos,
      manutencoes: state.manutencoes
    }, { perfil: perfilLogado?.perfil || 'admin', hoje: hojeISO() });
  } catch (erro) {
    console.error('[Pendências]', erro);
    return [];
  }
}

window.renderizarPendencias = () => {
  const lista = pendenciasVisiveis();
  const resumo = resumirPendencias(lista);
  if ($('pendKpiCritica')) $('pendKpiCritica').textContent = resumo.critica;
  if ($('pendKpiAlta')) $('pendKpiAlta').textContent = resumo.alta;
  if ($('pendKpiMedia')) $('pendKpiMedia').textContent = resumo.media;
  if ($('pendKpiTotal')) $('pendKpiTotal').textContent = resumo.total;
  if ($('pendResumo')) $('pendResumo').textContent = resumo.total + (resumo.total === 1 ? ' pendência' : ' pendências');
  const box = $('listaPendencias');
  if (!box) return;
  if (!lista.length) {
    box.innerHTML = '<div class="pend-vazio"><b>Nada atrasado com os filtros atuais.</b><br>Quando um contrato vencer, um laudo ficar em rascunho ou um fechamento ficar em aberto, o item aparece aqui.</div>';
    return;
  }
  box.innerHTML = lista.map(p => '<div class="pend-item ' + p.nivel + '">'
    + '<div class="pend-corpo">'
    + '<div class="pend-titulo"><span class="pend-selo ' + p.nivel + '">' + PEND_NIVEL_TEXTO[p.nivel] + '</span>' + esc(p.titulo) + '</div>'
    + '<div class="pend-detalhe">' + esc(p.detalhe) + '</div>'
    + '</div>'
    + '<div class="pend-tempo">' + (p.prazoDias !== undefined ? 'em ' + p.prazoDias + ' dias' : (p.diasAtraso || 0) + ' dias') + '<br>'
    + '<button class="btn btn-outline btn-sm" onclick="navegar(\\'' + p.aba + '\\')">' + esc(p.acao) + '</button></div>'
    + '</div>').join('');
};

window.__calcularPendencias = calcularPendencias;
`;
  const ancoraJS = 'window.renderizarAuditoria=';
  const posJS = html.indexOf(ancoraJS);
  if (posJS < 0) {
    falhas.push('Ponto de inserção da lógica de pendências não encontrado.');
  } else {
    html = html.slice(0, posJS) + js.trim() + '\n\n' + html.slice(posJS);
    aplicadas.push('lógica de renderização das pendências');
  }

  if (!falhas.length) writeFileSync(painel, html, 'utf8');
}

/* ============================================================
   3. Testes
   ============================================================ */
const TESTE_UNIT = `import { describe, it, expect } from 'vitest';
import {
  calcularPendencias,
  resumirPendencias,
  diasEntre,
  AREAS_POR_PERFIL
} from '../../public/js/pendencias-core.js';

const hoje = '2026-10-15';

const imovel = (codigo, status = 'alugado') => ({ id: codigo, codigo, status });
const contrato = (extra = {}) => Object.assign(
  { id: 'c1', imovelCodigo: 'LD-0011', inquilino: 'Maria Souza', inicio: '2025-09-01', fim: '2027-09-01', valor: 1800 },
  extra
);

describe('Central de Pendências — contratos', () => {
  it('marca como crítica quando o contrato venceu e o imóvel segue alugado', () => {
    const lista = calcularPendencias(
      { contratos: [contrato({ fim: '2026-09-02' })], imoveis: [imovel('LD-0011')], fechamentos: [{ id: 'f', periodo: '2026-09' }] },
      { hoje, perfil: 'admin' }
    );
    expect(lista).toHaveLength(1);
    expect(lista[0]).toMatchObject({ area: 'contratos', nivel: 'critica', titulo: 'Contrato vencido' });
    expect(lista[0].diasAtraso).toBe(43);
  });

  it('não cria pendência quando o imóvel não está mais alugado', () => {
    const lista = calcularPendencias(
      { contratos: [contrato({ fim: '2026-09-02' })], imoveis: [imovel('LD-0011', 'disponivel')], fechamentos: [{ id: 'f', periodo: '2026-09' }] },
      { hoje, perfil: 'admin' }
    );
    expect(lista.filter(p => p.titulo === 'Contrato vencido')).toHaveLength(0);
  });

  it('avisa contrato vencendo dentro de 30 dias e ignora o 31º dia', () => {
    const dentro = calcularPendencias(
      { contratos: [contrato({ fim: '2026-11-14' })], imoveis: [imovel('LD-0011')], fechamentos: [{ id: 'f', periodo: '2026-09' }] },
      { hoje, perfil: 'admin' }
    );
    expect(dentro.some(p => p.titulo === 'Contrato vencendo')).toBe(true);

    const fora = calcularPendencias(
      { contratos: [contrato({ fim: '2026-11-15' })], imoveis: [imovel('LD-0011')], fechamentos: [{ id: 'f', periodo: '2026-09' }] },
      { hoje, perfil: 'admin' }
    );
    expect(fora.some(p => p.titulo === 'Contrato vencendo')).toBe(false);
  });

  it('não avisa contrato que ainda não começou', () => {
    const lista = calcularPendencias(
      { contratos: [contrato({ inicio: '2027-01-01', fim: '2027-11-01' })], imoveis: [imovel('LD-0011')], fechamentos: [{ id: 'f', periodo: '2026-09' }] },
      { hoje, perfil: 'admin' }
    );
    expect(lista).toHaveLength(0);
  });
});

describe('Central de Pendências — laudos e documentos', () => {
  it('aponta documento emitido sem snapshot como crítica', () => {
    const lista = calcularPendencias(
      { documentosOficiais: [{ codigo: 'LD-LAI-2026-000010', status: 'emitido', dadosEmitidos: null, emitidoEm: '2026-10-13' }] },
      { hoje, perfil: 'admin' }
    );
    expect(lista[0]).toMatchObject({ area: 'laudos', nivel: 'critica' });
    expect(lista[0].detalhe).toContain('LD-LAI-2026-000010');
  });

  it('ignora documento emitido que já tem snapshot', () => {
    const lista = calcularPendencias(
      { documentosOficiais: [{ codigo: 'LD-LAI-2026-000008', status: 'emitido', dadosEmitidos: { imovel: 'LD-0011' } }] },
      { hoje, perfil: 'admin' }
    );
    expect(lista).toHaveLength(0);
  });

  it('aponta rascunho com mais de 7 dias e ignora o de 7 dias', () => {
    const antigo = calcularPendencias(
      { inspecoes: [{ id: 'L1', documentoCodigo: 'LD-LAI-2026-000011', documentoStatus: 'rascunho', criadoEm: '2026-10-07T10:00:00.000Z', codigo: 'LD-0022' }] },
      { hoje, perfil: 'admin' }
    );
    expect(antigo).toHaveLength(1);
    expect(antigo[0]).toMatchObject({ area: 'laudos', nivel: 'alta', titulo: 'Rascunho de laudo abandonado' });

    const recente = calcularPendencias(
      { inspecoes: [{ id: 'L2', documentoCodigo: 'LD-LAI-2026-000012', documentoStatus: 'rascunho', criadoEm: '2026-10-08T10:00:00.000Z' }] },
      { hoje, perfil: 'admin' }
    );
    expect(recente).toHaveLength(0);
  });

  it('nunca trata laudo cancelado ou substituído como rascunho', () => {
    const lista = calcularPendencias(
      { inspecoes: [
        { id: 'L3', documentoCodigo: 'LD-LAI-2026-000007', documentoStatus: 'cancelado', criadoEm: '2026-09-01T10:00:00.000Z' },
        { id: 'L4', documentoCodigo: 'LD-LAI-2026-000006', documentoStatus: 'substituido', criadoEm: '2026-09-01T10:00:00.000Z' }
      ] },
      { hoje, perfil: 'admin' }
    );
    expect(lista).toHaveLength(0);
  });
});

describe('Central de Pendências — fechamento', () => {
  const base = { contratos: [contrato({ fim: '2027-09-01' })] };

  it('aponta o mês anterior em aberto a partir do dia 6', () => {
    const lista = calcularPendencias(Object.assign({ fechamentos: [] }, base), { hoje: '2026-10-06', perfil: 'admin' });
    expect(lista.map(p => p.titulo)).toContain('Fechamento em aberto');
    expect(lista[0].detalhe).toContain('set/2026');
  });

  it('respeita a carência até o dia 5', () => {
    const lista = calcularPendencias(Object.assign({ fechamentos: [] }, base), { hoje: '2026-10-05', perfil: 'admin' });
    expect(lista.map(p => p.titulo)).not.toContain('Fechamento em aberto');
  });

  it('não cobra fechamento já registrado', () => {
    const lista = calcularPendencias(Object.assign({ fechamentos: [{ id: 'f1', periodo: '2026-09' }] }, base), { hoje: '2026-10-15', perfil: 'admin' });
    expect(lista.map(p => p.titulo)).not.toContain('Fechamento em aberto');
  });

  it('não cobra fechamento em mês sem contrato vigente', () => {
    const semContrato = { contratos: [contrato({ inicio: '2026-10-01', fim: '2027-10-01' })], fechamentos: [] };
    const lista = calcularPendencias(semContrato, { hoje: '2026-10-15', perfil: 'admin' });
    expect(lista.map(p => p.titulo)).not.toContain('Fechamento em aberto');
  });
});

describe('Central de Pendências — manutenção e permissões', () => {
  it('aponta chamado com prazo vencido e ignora concluído', () => {
    const lista = calcularPendencias({
      manutencoes: [
        { id: 'm1', status: 'Aberto', prazo: '2026-10-10', descricao: 'Infiltração', imovelCodigo: 'LD-0031' },
        { id: 'm2', status: 'Concluído', prazo: '2026-10-01', descricao: 'Pintura' }
      ]
    }, { hoje, perfil: 'admin' });
    expect(lista).toHaveLength(1);
    expect(lista[0]).toMatchObject({ area: 'manutencoes', nivel: 'media' });
  });

  it('aponta chamado parado há mais de 15 dias sem prazo', () => {
    const lista = calcularPendencias({
      manutencoes: [{ id: 'm3', status: 'Em Andamento', criadoEm: '2026-09-20', descricao: 'Vazamento' }]
    }, { hoje, perfil: 'admin' });
    expect(lista).toHaveLength(1);
  });

  it('corretor vê laudo e manutenção, mas não contrato nem fechamento', () => {
    const dados = {
      contratos: [contrato({ fim: '2026-09-02' })],
      imoveis: [imovel('LD-0011')],
      inspecoes: [{ id: 'L1', documentoCodigo: 'LD-LAI-2026-000011', documentoStatus: 'rascunho', criadoEm: '2026-10-01T10:00:00.000Z' }],
      manutencoes: [{ id: 'm1', status: 'Aberto', prazo: '2026-10-10', descricao: 'X' }],
      fechamentos: []
    };
    const lista = calcularPendencias(dados, { hoje, perfil: 'corretor' });
    const areas = [...new Set(lista.map(p => p.area))].sort();
    expect(areas).toEqual(['laudos', 'manutencoes']);
    expect(AREAS_POR_PERFIL.corretor).toContain('laudos');
  });

  it('perfil de manutenção vê apenas chamados', () => {
    const lista = calcularPendencias({
      contratos: [contrato({ fim: '2026-09-02' })],
      imoveis: [imovel('LD-0011')],
      manutencoes: [{ id: 'm1', status: 'Aberto', prazo: '2026-10-10', descricao: 'X' }]
    }, { hoje, perfil: 'manutencao' });
    expect(lista.every(p => p.area === 'manutencoes')).toBe(true);
  });
});

describe('Central de Pendências — ordenação e resumo', () => {
  it('ordena por gravidade e depois pelo mais antigo', () => {
    const lista = calcularPendencias({
      contratos: [contrato({ fim: '2026-11-01' })],
      imoveis: [imovel('LD-0011')],
      manutencoes: [{ id: 'm1', status: 'Aberto', prazo: '2026-10-10', descricao: 'X' }],
      documentosOficiais: [{ codigo: 'LD-LAI-2026-000010', status: 'emitido', dadosEmitidos: null, emitidoEm: '2026-10-01' }],
      fechamentos: [{ id: 'f', periodo: '2026-09' }]
    }, { hoje, perfil: 'admin' });
    expect(lista[0].nivel).toBe('critica');
    expect(lista[lista.length - 1].nivel).toBe('media');
  });

  it('resume os quatro números dos indicadores', () => {
    const lista = [
      { nivel: 'critica' }, { nivel: 'critica' }, { nivel: 'alta' }, { nivel: 'media' }
    ];
    expect(resumirPendencias(lista)).toEqual({ critica: 2, alta: 1, media: 1, total: 4 });
  });

  it('calcula diferença de dias sem erro de fuso', () => {
    expect(diasEntre('2026-10-01', '2026-10-15')).toBe(14);
    expect(diasEntre('', '2026-10-15')).toBeNull();
  });

  it('lista vazia não quebra o resumo', () => {
    expect(resumirPendencias()).toEqual({ critica: 0, alta: 0, media: 0, total: 0 });
  });
});
`;

const TESTE_E2E = `import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';

const painel = () => readFileSync('public/LD_Imoveis_Sistema_Gerencial.html', 'utf8');

test('central de pendências existe como aba somente leitura', () => {
  const f = painel();
  expect(f).toContain('id="tab-pendencias"');
  expect(f).toContain('Central de');
  expect(f).toContain('data-aba="pendencias"');
  expect(f).toContain("import { calcularPendencias, resumirPendencias } from './js/pendencias-core.js';");
  expect(f).toContain('renderizarPendencias');
});

test('pendências usam as decisões aprovadas', () => {
  const f = painel();
  expect(f).toContain('pendKpiCritica');
  expect(f).toContain('pendArea');
  expect(f).toContain('pendNivel');
  expect(f).toContain('pend-lista');
  const nucleo = readFileSync('public/js/pendencias-core.js', 'utf8');
  expect(nucleo).toContain('diasContratoVencendo: 30');
  expect(nucleo).toContain('diasRascunhoAbandonado: 7');
  expect(nucleo).toContain('diaCarenciaFechamento: 5');
  expect(nucleo).toContain("corretor: ['laudos', 'manutencoes']");
});

test('pendências não gravam nada no Firestore', () => {
  const nucleo = readFileSync('public/js/pendencias-core.js', 'utf8');
  expect(nucleo).not.toMatch(/setDoc|updateDoc|addDoc|deleteDoc|writeBatch/);
  const f = painel();
  const trecho = f.slice(f.indexOf('CENTRAL DE PENDÊNCIAS'), f.indexOf('window.renderizarAuditoria='));
  expect(trecho).not.toMatch(/setDoc|updateDoc|addDoc|deleteDoc|registrarAuditoria/);
});
`;

if (existsSync('tests/unit')) {
  writeFileSync('tests/unit/pendencias-core.test.js', TESTE_UNIT, 'utf8');
  aplicadas.push('teste unitário das regras');
} else {
  aplicadas.push('tests/unit ausente — teste unitário não criado');
}

if (existsSync('tests/e2e')) {
  writeFileSync('tests/e2e/pendencias.spec.js', TESTE_E2E, 'utf8');
  aplicadas.push('teste E2E da aba');
} else {
  aplicadas.push('tests/e2e ausente — teste E2E não criado');
}

if (falhas.length) {
  console.error('FALHA: revisão necessária.');
  for (const f of falhas) console.error(' - ' + f);
  process.exit(1);
}

console.log('OK: Fase 3A aplicada — Central de Pendências, somente leitura.');
for (const a of aplicadas) console.log(' - ' + a);
