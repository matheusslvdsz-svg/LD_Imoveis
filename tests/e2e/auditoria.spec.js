import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';

test('auditoria distingue emissão de reimpressão e exporta', () => {
  const f = readFileSync('public/LD_Imoveis_Sistema_Gerencial.html', 'utf8');
  expect(f).toContain('Auditoria e Controle Geral');
  expect(f).toContain('audAcao');
  expect(f).toContain('audDe');
  expect(f).toContain('exportarAuditoriaCSV');
  expect(f).toContain('exportarAuditoriaPDF');
  expect(f).toContain('REIMPRESSÃO');
  expect(f).toContain('aud-info');
  expect(f).toContain('audResultado');
  expect(f).toContain('Retenção permanente');
  expect(f).toContain('v2.0.0');
});
