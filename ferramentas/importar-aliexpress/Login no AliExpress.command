#!/bin/bash
cd "$(dirname "$0")"

if [ ! -d "node_modules" ]; then
  echo "Primeira vez rodando essa ferramenta - instalando o que falta..."
  echo "Isso demora um minuto ou dois, só acontece essa vez."
  echo
  npm install
  echo
fi

echo "Abrindo o navegador - loga na sua conta AliExpress normalmente."
echo "Quando terminar, volta aqui nessa janela e aperta Enter."
echo
npm run login

echo
read -p "Aperta Enter pra fechar essa janela." x
