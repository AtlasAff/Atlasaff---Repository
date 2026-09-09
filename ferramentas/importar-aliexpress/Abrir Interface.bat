@echo off
title Pavan e Co. - Importar do AliExpress
cd /d "%~dp0"

if not exist node_modules (
  echo Primeira vez rodando essa ferramenta - instalando o que falta...
  echo Isso demora um minuto ou dois, só acontece essa vez.
  echo.
  call npm install
  echo.
)

echo Abrindo a interface...
echo (deixa essa janela aberta enquanto usa - fecha ela quando terminar)
echo.
call npm run interface

echo.
echo A interface foi fechada. Aperta uma tecla pra fechar essa janela.
pause >nul
