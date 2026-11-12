#!/usr/bin/env node
/**
 * LD Imóveis — correção do rodapé de versão
 * -----------------------------------------
 * Problema: três elementos usavam a classe .ld-versao, e essa classe tinha
 * position:fixed no canto inferior direito — as três frases se sobrepunham.
 *
 * Correção:
 *  - a classe .ld-versao fica só para o rodapé fixo do canto
 *  - os dois textos do menu lateral passam a usar .ld-versao-item (sem position)
 *  - texto do canto padronizado para "LD Sistemas · v2.0.0"
 *  - impressão esconde os dois
 *
 * Execute na raiz do repositório:  node .\LD_CORRIGIR_RODAPE_V2.mjs
 */
import { readFileSync, writeFileSync, existsSync, copyFileSync } from 'node:fs';

const ARQ = 'public/LD_Imoveis_Sistema_Gerencial.html';

if (!existsSync(ARQ)) {
  console.error('Arquivo não encontrado: ' + ARQ);
  console.error('Execute na raiz do repositório.');
  process.exit(1);
}

copyFileSync(ARQ, ARQ + '.bak');
let html = readFileSync(ARQ, 'utf8');
const original = html;
const feitos = [];
const falhas = [];

function trocar(antes, depois, rotulo, obrigatorio = true) {
  const n = html.split(antes).length - 1;
  if (n === 0) {
    if (obrigatorio) falhas.push(rotulo + ' — trecho não encontrado');
    return;
  }
  html = html.split(antes).join(depois);
  feitos.push(rotulo + (n > 1 ? ' (x' + n + ')' : ''));
}

/* 1. CSS: cria a classe dos textos do menu, sem position */
trocar(
  '.ld-versao{position:fixed;right:8px;bottom:6px;z-index:2;font-size:8px;letter-spacing:.7px;color:#666;pointer-events:none;text-transform:uppercase}',
  '.ld-versao{position:fixed;right:8px;bottom:6px;z-index:2;font-size:8px;letter-spacing:.7px;color:#666;pointer-events:none;text-transform:uppercase}' +
  '\n.ld-versao-item{font-size:8px;letter-spacing:.7px;color:#666;pointer-events:none;text-transform:uppercase}',
  'CSS: classe .ld-versao-item criada'
);

/* 2. Texto do menu lateral — sai da classe fixa */
trocar(
  '<div class="ld-versao" style="margin-top:10px; font-size:0.7rem; letter-spacing:0.08em; color:var(--text-muted); opacity:0.75;">SISTEMA LD IMÓVEIS · v2.0.0</div>',
  '<div class="ld-versao-item" style="margin-top:10px; font-size:0.7rem; letter-spacing:0.08em; color:var(--text-muted); opacity:0.75;">SISTEMA LD IMÓVEIS · v2.0.0</div>',
  'Menu lateral: texto 1 fora do rodapé fixo'
);

/* 3. Segundo texto — idem */
trocar(
  '<div class="ld-versao" style="font-size:0.65rem; letter-spacing:0.06em; color:var(--text-muted); opacity:0.6; margin-top:4px;">v2.0.0</div>',
  '<div class="ld-versao-item" style="font-size:0.65rem; letter-spacing:0.06em; color:var(--text-muted); opacity:0.6; margin-top:4px;">v2.0.0</div>',
  'Menu lateral: texto 2 fora do rodapé fixo'
);

/* 4. Rodapé do canto — texto padronizado */
trocar(
  '<div class="ld-versao">LD Sistemas · versão 2026</div>',
  '<div class="ld-versao">LD Sistemas · v2.0.0</div>',
  'Rodapé do canto: texto padronizado'
);

/* 5. Impressão esconde os dois */
trocar(
  '@media print{.ld-versao{display:none!important}',
  '@media print{.ld-versao,.ld-versao-item{display:none!important}',
  'Impressão: esconde rodapé e textos do menu',
  false
);

if (falhas.length) {
  console.error('\nNADA FOI GRAVADO. Itens não encontrados:');
  falhas.forEach(f => console.error(' - ' + f));
  console.error('\nO arquivo está intacto (backup em ' + ARQ + '.bak)');
  process.exit(1);
}

if (html === original) {
  console.log('Nada a alterar — o rodapé já estava corrigido.');
  process.exit(0);
}

writeFileSync(ARQ, html, 'utf8');

console.log('OK: rodapé corrigido.\n');
feitos.forEach(f => console.log(' - ' + f));
console.log('\nConferência:');
console.log('  elementos com class="ld-versao"      : ' + (html.match(/class="ld-versao"/g) || []).length + '  (deve ser 1)');
console.log('  elementos com class="ld-versao-item" : ' + (html.match(/class="ld-versao-item"/g) || []).length + '  (deve ser 2)');
console.log('\nBackup do arquivo anterior: ' + ARQ + '.bak');
