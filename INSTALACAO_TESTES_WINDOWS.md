# Preparação no Windows

## Requisitos
- Node.js 20 ou superior.
- Java JDK 21 ou superior para o Firestore Emulator.
- Firebase CLI autenticado apenas para comandos locais; os testes usam projeto fictício `demo-ld-imoveis-tests`.

## Conferência
```powershell
node --version
npm --version
java -version
```

Se o Java for inferior a 21, instalar o JDK 21 antes de `npm run test:rules`. Não usar `--force` em `npm audit fix`.

## Instalação e validação
```powershell
npm ci
npm run validate:fast
npm run test:rules
npm run validate
```

O Firestore Emulator pode imprimir mensagens `PERMISSION_DENIED` durante testes negativos; isso é esperado quando o teste confirma que um perfil não pode gravar ou excluir.
