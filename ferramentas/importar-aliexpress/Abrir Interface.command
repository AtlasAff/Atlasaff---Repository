#!/bin/bash
cd "$(dirname "$0")"

if [ ! -d "node_modules" ]; then
  echo "Primeira vez rodando essa ferramenta - instalando o que falta..."
  echo "Isso demora um minuto ou dois, só acontece essa vez."
  echo
  npm install
  echo
fi

echo "Abrindo a interface..."
echo "(deixa essa janela aberta enquanto usa - fecha ela quando terminar)"
echo
npm run interface

echo
read -p "A interface foi fechada. Aperta Enter pra fechar essa janela." x
