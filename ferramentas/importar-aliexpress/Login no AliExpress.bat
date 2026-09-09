@echo off
title Pavan e Co. - Login no AliExpress
cd /d "%~dp0"

if not exist node_modules (
  echo Primeira vez rodando essa ferramenta - instalando o que falta...
  echo Isso demora um minuto ou dois, só acontece essa vez.
  echo.
  call npm install
  echo.
)

echo Abrindo o navegador - loga na sua conta AliExpress normalmente.
echo Quando terminar, volta aqui nessa janela e aperta Enter.
echo.
call npm run login

echo.
echo Aperta uma tecla pra fechar essa janela.
pause >nul
