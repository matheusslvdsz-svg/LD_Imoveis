import { test, expect } from '@playwright/test';
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
