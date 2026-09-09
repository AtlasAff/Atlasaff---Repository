# Importar produto do AliExpress

Ferramenta que roda no **seu computador** (não no site) pra puxar as
informações de um produto do AliExpress e já criar um rascunho dele na
loja, pronto pra você revisar e ativar. Usa a sua própria sessão logada
no AliExpress, então funciona sem levar bloqueio (é a mesma ideia por
trás de ferramentas como o DSers).

## Atalho fácil (sem digitar comando nenhum)

Depois de baixar a pasta (Passo 1) e instalar o Node.js (Passo 2, só na
primeira vez), tem dois arquivos que fazem tudo sozinhos — só clicar duas
vezes, sem abrir terminal nem digitar nada:

- **`Login no AliExpress`** (`.bat` no Windows, `.command` no Mac) — usa
  na primeira vez e de vez em quando depois (quando a sessão expirar).
- **`Abrir Interface`** (`.bat` no Windows, `.command` no Mac) — abre a
  interface visual pra importar produtos. É esse que você vai usar mais.

Na primeira vez que clicar em qualquer um dos dois, ele já instala
sozinho o que falta (pode demorar um minuto) — não precisa rodar
`npm install` na mão. Se aparecer um aviso do Windows/Mac tipo "não
reconhecemos o autor desse arquivo", pode confirmar que quer abrir mesmo
assim (é normal pra qualquer arquivo baixado da internet, não é vírus).

Se preferir entender o que cada comando faz (ou o clique duplo não
funcionar por algum motivo), os passos abaixo explicam o mesmo processo
digitando no terminal.

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

## Passo 6 — Usar (recomendado: a interface visual)

```
npm run interface
```

Abre sozinho uma página no seu navegador (`http://localhost:3737`) —
tudo roda no seu computador, só ganha uma tela em vez de responder
perguntas no terminal. É lá que você:

1. Cola o link do produto e clica em **Buscar produto** (pode demorar um
   pouco, principalmente se tiver quilate/cor).
2. Vê **tudo já preenchido, mas editável**: nome, descrição (com negrito/
   itálico/lista), fotos (clica no × pra tirar alguma), custo, imposto,
   frete, margem de lucro (o preço de venda recalcula sozinho conforme
   você digita), tamanhos, quilates e banhos/cores.
3. Ajusta o que quiser, marca se já quer deixar **ativo** (visível pro
   cliente) ou deixar como rascunho, e clica em **Publicar produto**.

Deixa o terminal aberto enquanto usa (é ele que tá rodando o servidor
local) — fecha com `Ctrl+C` quando terminar. Pra usar de novo depois, é
só rodar `npm run interface` outra vez.

A chave do Groq e o login do admin, se já estiverem salvos
(`.credenciais.json`), são usados automaticamente — a interface mostra um
resumo do que já está salvo lá em cima.

### Alternativa: modo terminal

Se preferir sem interface (ou pra rodar em lote, script, etc.), o jeito
antigo continua funcionando igual:

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

Também pergunta quantos % de lucro você quer aplicar (opcional) — se
responder, já mostra o preço de venda final e salva ele direto no
produto; se pular (Enter), o preço de venda entra zerado e você calcula
depois no admin.

No fim, vai pedir seu e-mail e senha de admin do site pra salvar o
produto. Na primeira vez que você preencher a chave do Groq e o login do
admin, eles ficam salvos num arquivo local (`.credenciais.json`, dentro
dessa mesma pasta) pra não perguntar de novo nas próximas importações.

Se o produto tem quilate/cor, a importação demora mais (o script clica em
cada opção de verdade na página pra saber o preço de cada uma) — um
produto com bastante variação pode levar um minuto ou mais, é normal.

⚠️ Esse arquivo fica **só no seu computador** (nunca vai pro GitHub) mas
guarda sua senha em texto puro, sem criptografia — não compartilha essa
pasta com ninguém, não anexa em e-mail, não sobe em nenhum lugar. Se
quiser trocar o que tá salvo (ex: mudou a senha do admin), é só apagar
o arquivo `.credenciais.json` que ele pergunta de novo na próxima vez.

## Passo 7 — Terminar no site

Abre o admin do site normalmente, acha o produto na lista (ele entra
**inativo**, ou seja, não aparece pro cliente ainda — e com um ícone 🔗 de
link do fornecedor). Revisa:

- Categoria
- Quilate / banho — quando o produto tem esse tipo de variação, o script tenta separar sozinho (clicando em cada opção de verdade na página pra saber o preço de cada uma) e já salva **quilates_disponiveis/custos** e **banhos_disponiveis/custos** direto no produto, com foto por banho quando consegue achar uma. Ainda assim, sempre confere: essa parte é a mais nova e a mais "adivinhada" do script (não dá pra eu testar contra o AliExpress de verdade daqui) — se algo vier errado ou faltando foto, corrige na mão. Tamanho de anel sempre vem convertido pra numeração BR à parte, isso já é bem confiável
- **Preço de venda** — se você respondeu a pergunta de % de lucro no terminal, o preço já vem calculado (produto base e cada quilate/banho, se tiver). Se pulou, entra **zerado** de propósito. De qualquer jeito, confere na calculadora de margem do admin antes de ativar
- Fotos (confere se vieram certas)

Quando estiver tudo certo, marca como **ativo** e salva — aí sim aparece no site.

## Se algo der errado

- **"Ainda não tem sessão salva"** → roda `npm run login` de novo.
- **Nome/fotos/preço vieram vazios** → o AliExpress mudou alguma coisa no formato da página. Preenche na mão dessa vez — e o próprio script cria uma pastinha `debug/` (dentro de `importar-aliexpress`) com 2 arquivos daquela tentativa (`...-dados-embutidos.json` e `...-pagina.html`). Manda esses 2 arquivos pro Claude que ele ajusta certinho, sem precisar advinhar.
- **Trava ou dá erro estranho** → o AliExpress pode ter bloqueado momentaneamente. Espera um pouco e tenta de novo, ou usa o link de outro produto pra testar.
- **"arraste pra verificar" dá erro / não deixa passar** → o AliExpress detectou que é um navegador automatizado. Fecha tudo, espera uns minutos e roda `npm run login` de novo — às vezes é só tentar de novo que passa. Se continuar sempre dando erro, avisa o Claude.
- **Erro dizendo que não achou o "chrome"** → você precisa ter o Google Chrome instalado (não Edge, não Firefox) — [google.com/chrome](https://www.google.com/chrome/).
- **A interface não abriu sozinha no navegador** → copia `http://localhost:3737` (aparece no terminal) e cola na barra de endereço do navegador na mão.
- **"porta já em uso" ao rodar `npm run interface`** → já tem uma janela dessa ferramenta aberta em algum lugar (ou outro programa usando a mesma porta) — fecha a outra janela/terminal e tenta de novo.
- **(Mac) Clicar duas vezes no `.command` não faz nada, ou dá erro de permissão** → abre o Terminal, digita `chmod +x ` (com espaço) e arrasta os dois arquivos `.command` pra dentro da janela, aperta Enter — só precisa fazer isso uma vez.
