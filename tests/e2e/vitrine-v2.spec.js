import {test,expect} from '@playwright/test';
const url='/public/LD_Imoveis_Vitrine_Publica.html';
test('Portal apresenta identidade e busca',async({page})=>{await page.goto(url);await expect(page.getByRole('heading',{name:/próxima história/i})).toBeVisible();await expect(page.locator('.searchbox')).toBeVisible()});
test('Portal cabe no celular',async({page})=>{await page.setViewportSize({width:390,height:844});await page.goto(url);await expect(page.locator('body')).toHaveJSProperty('scrollWidth',390);await expect(page.locator('#buscar')).toBeVisible()});
test('Página pública não contém autenticação administrativa',async({page})=>{await page.goto(url);const h=await page.content();expect(h).not.toContain('signInWithEmailAndPassword');expect(h).toContain('vitrinePublica')});
test('Modal fecha sem faixa lateral',async({page})=>{await page.goto(url);expect(await page.locator('.close').evaluate(e=>getComputedStyle(e).position)).toBe('absolute')});
test('Portal completo inclui bairros, serviços e captação',async({page})=>{await page.goto(url);await expect(page.getByRole('heading',{name:'Explore possibilidades'})).toBeVisible();await expect(page.getByText('Bairros mais pesquisados')).toBeVisible();await expect(page.locator('#formProprietario')).toBeAttached();await expect(page.locator('#formEncomenda')).toBeAttached()});
test('Administração separada mantém contatos',async({page})=>{await page.goto('/public/LD_Imoveis_Vitrine_Admin.html',{waitUntil:'domcontentloaded'});await expect(page.getByText(/Contatos recebidos/)).toBeAttached()});
