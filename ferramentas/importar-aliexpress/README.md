# Importar produto do AliExpress

Ferramenta que roda no **seu computador** (não no site) pra puxar as
informações de um produto do AliExpress e já criar um rascunho dele na
loja, pronto pra você revisar e ativar. Usa a sua própria sessão logada
no AliExpress, então funciona sem levar bloqueio (é a mesma ideia por
trás de ferramentas como o DSers).

## Passo 1 — Baixar essa pasta

Se você ainda não tem o código do site no seu computador:

1. Entra no repositório do site no GitHub.
2. Clica no botão verde **"Code"** → **"Download ZIP"**.
3. Extrai o ZIP em algum lugar do seu computador.
4. Dentro dele, acha a pasta `ferramentas/importar-aliexpress` — é só essa que você vai usar.

## Passo 1.5 — Ter o Google Chrome instalado

A ferramenta usa o Chrome de verdade do seu computador (não um navegador
escondido) — se você não tiver o Google Chrome instalado, baixa em
**[google.com/chrome](https://www.google.com/chrome/)** (é grátis, instala
normal). Se você já usa Chrome no dia a dia, pode pular esse passo.

## Passo 2 — Instalar o Node.js (só na primeira vez)

1. Entra em **[nodejs.org](https://nodejs.org/)**.
2. Baixa a versão **"LTS"** (a recomendada) pro seu sistema (Windows ou Mac).
3. Instala normalmente, clicando "Avançar" em tudo (igual instalar qualquer programa).

## Passo 3 — Abrir o terminal na pasta certa

- **Windows**: abre a pasta `ferramentas/importar-aliexpress` no Explorador de Arquivos, clica na barra de endereço lá em cima, digita `cmd` e aperta Enter — abre um terminal já na pasta certa.
- **Mac**: abre o app **Terminal**, digita `cd ` (com espaço) e arrasta a pasta `ferramentas/importar-aliexpress` pra dentro da janela do terminal, aperta Enter.

## Passo 4 — Instalar as dependências (só na primeira vez)

No terminal que você abriu, digita e aperta Enter:

```
npm install
```

Vai demorar um minuto ou dois baixando umas coisinhas. Só precisa fazer isso uma vez (ou de novo se apagar a pasta `node_modules`).

## Passo 5 — Logar na sua conta AliExpress

```
npm run login
```

Vai abrir uma janela de navegador. Loga na sua conta AliExpress normalmente,
como você sempre faz. Depois de logado, volta pro terminal e aperta Enter
(ele vai estar esperando você lá).

Isso salva sua sessão numa pasta local — só precisa repetir esse passo de
vez em quando (quando a sessão expirar, alguns meses depois).

## Passo 6 — Importar um produto

Copia o link do produto no AliExpress e roda, **com o link entre aspas**
(o link do AliExpress costuma ter `&` no meio, que o terminal do Windows
entende errado se não tiver aspas):

```
npm run importar -- "https://www.aliexpress.com/item/COLA-O-LINK-AQUI.html"
```

(o `--` antes do link é importante, não esquece)

Vai aparecer no terminal o que foi encontrado (nome, quantas fotos, preço,
variações) e o que **não** foi encontrado (esses campos você preenche na
mão depois).

Antes de salvar, ele pergunta se você tem uma **chave da API do Groq**
(opcional) — se tiver, ele usa a IA pra reescrever o nome (seguindo o
padrão da loja: Tipo de peça + Material/Pedra + Detalhe) e arrumar a
descrição em parágrafos, em vez de deixar o texto cru do AliExpress. Pra
conseguir uma chave, grátis pra uso ocasional: entra em
[console.groq.com/keys](https://console.groq.com/keys), loga (dá pra usar
conta Google) e cria uma chave (Create API Key) — cola no terminal quando
pedir. Se não tiver ou não quiser usar, é só apertar Enter e pular —
o produto entra do mesmo jeito, só com o texto original.

No fim, vai pedir seu e-mail e senha de admin do site — é só pra salvar
o produto, não fica guardado em lugar nenhum (a chave do Groq também
não fica guardada, só é usada naquela hora).

## Passo 7 — Terminar no site

Abre o admin do site normalmente, acha o produto na lista (ele entra
**inativo**, ou seja, não aparece pro cliente ainda — e com um ícone 🔗 de
link do fornecedor). Revisa:

- Categoria
- Quilate / banho / tamanho (as variações que apareceram no terminal te dão uma pista de quais existem)
- Preço final (usa a calculadora de margem que já existe no admin)
- Fotos (confere se vieram certas)

Quando estiver tudo certo, marca como **ativo** e salva — aí sim aparece no site.

## Se algo der errado

- **"Ainda não tem sessão salva"** → roda `npm run login` de novo.
- **Nome/fotos/preço vieram vazios** → o AliExpress mudou alguma coisa no formato da página. Preenche na mão dessa vez — e o próprio script cria uma pastinha `debug/` (dentro de `importar-aliexpress`) com 2 arquivos daquela tentativa (`...-dados-embutidos.json` e `...-pagina.html`). Manda esses 2 arquivos pro Claude que ele ajusta certinho, sem precisar advinhar.
- **Trava ou dá erro estranho** → o AliExpress pode ter bloqueado momentaneamente. Espera um pouco e tenta de novo, ou usa o link de outro produto pra testar.
- **"arraste pra verificar" dá erro / não deixa passar** → o AliExpress detectou que é um navegador automatizado. Fecha tudo, espera uns minutos e roda `npm run login` de novo — às vezes é só tentar de novo que passa. Se continuar sempre dando erro, avisa o Claude.
- **Erro dizendo que não achou o "chrome"** → você precisa ter o Google Chrome instalado (não Edge, não Firefox) — [google.com/chrome](https://www.google.com/chrome/).
