import { test, expect } from '@playwright/test';
test.beforeEach(async({page})=>{await page.goto('/tests/e2e/fixtures/inspecao-harness.html');await page.waitForFunction(()=>window.__INTEGRACAO_PRONTA===true)});
test('abre isolado sem Firebase e sem erros',async({page})=>{const erros=[];page.on('pageerror',e=>erros.push(e.message));await expect(page.getByRole('heading',{name:'Inspeção fictícia'})).toBeVisible();await expect(page.locator('.faixa')).toHaveText('SEM NOTAS');expect(erros).toEqual([])});
test('calcula nota e classificação com fixture fictícia',async({page})=>{await page.evaluate(()=>window.avaliar({'1.1':'3','1.2':'2','1.3':'1'}));await expect(page.locator('.nota')).toHaveText('67');await expect(page.locator('.faixa')).toHaveText('REGULAR');await expect(page.locator('#resultado .estado')).toHaveText('LIBERADO')});
test('bloqueia quando item crítico recebe zero',async({page})=>{await page.evaluate(()=>window.avaliar({'1.1':'3','1.2':'0','1.3':'3'}));await expect(page.locator('#resultado .estado')).toHaveText('BLOQUEADO');await expect(page.locator('#resultado .estado')).toHaveClass(/bloqueado/)});
test('integra serviço e repositório ao sincronizar fixture',async({page})=>{await page.getByRole('button',{name:'Sincronizar fixture'}).click();await expect(page.locator('#estado')).toHaveText('sincronizado');await expect(page.locator('#operacoes')).toHaveText('1');const op=await page.evaluate(()=>window.__OPERACOES[0]);expect(op).toMatchObject({tipo:'set',ref:'inspecoes/LAUDO-E2E-001',config:{merge:true}});expect(op.dados).toMatchObject({atualizadoPor:'e2e@exemplo.invalid'})});
test('integra exclusão explícita sem Firebase real',async({page})=>{await page.getByRole('button',{name:'Excluir fixture'}).click();await expect(page.locator('#estado')).toHaveText('sincronizado');const op=await page.evaluate(()=>window.__OPERACOES[0]);expect(op).toEqual({tipo:'delete',ref:'inspecoes/LAUDO-E2E-001'})});

import {readFileSync} from 'node:fs';
test('reserva código documental e prepara rodapé oficial',()=>{const fonte=readFileSync('public/Modulo-Inspecao.html','utf8');expect(fonte).toContain("documentosContadores");expect(fonte).toContain("LD-'+tipo+'-'+ano");expect(fonte).toContain('documentoCodigo');expect(fonte).toContain('Gerado pelo Sistema LD Imóveis');expect(fonte).toContain("status:'emitido'")});

import {readFileSync as lerFonteInspecao} from 'node:fs';
test('checklist completo exige avaliação de todos os itens',()=>{const fonte=lerFonteInspecao('public/Modulo-Inspecao.html','utf8');expect(fonte).toContain('4.14');expect(fonte).toContain('10.8');expect(fonte).toContain('itensNaoAvaliados');expect(fonte).toContain('btProximoPendente');expect(fonte).toContain("if (!irParaPrimeiroNaoAvaliado()) return")});

import {readFileSync as lerPdfOficial} from 'node:fs';
test('PDF oficial pagina checklist e confere total',()=>{const f=lerPdfOficial('public/Modulo-Inspecao.html','utf8');expect(f).toContain('btPdfOficial');expect(f).toContain('rowPageBreak');expect(f).toContain('corpo.length!==itens.length');expect(f).toContain('Página '+"'"+'+n+'+"'"+' de '+"'"+'+total');expect(f).toContain("_Laudo_de_Inspecao.pdf")});

test('carrega bibliotecas PDF locais', async ({ page }) => {
  await page.goto('/public/Modulo-Inspecao.html?teste-isolado=1');

  await expect.poll(() =>
    page.evaluate(() => {
      if (!window.jspdf?.jsPDF) return false;
      const documento = new window.jspdf.jsPDF();
      return typeof documento.autoTable === 'function';
    })
  ).toBe(true);
});
