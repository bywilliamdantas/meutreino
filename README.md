# Meus Treinos

App para organizar seus treinos A/B/C, saber qual treino fazer hoje (ciclo
automático), marcar como feito e acompanhar o histórico. Funciona como PWA:
depois de publicado, instala no iPhone e se comporta como um app nativo.
Tem tela de login e navegação por abas, no estilo de app nativo.

## Estrutura

```
meus-treinos/
├── index.html            → esqueleto HTML (o app inteiro é montado via JS)
├── package.json           → dependências e scripts (dev / build / test)
├── vite.config.js         → configuração do build
├── .github/workflows/
│   └── deploy.yml          → build + publicação automática no GitHub Pages
├── src/
│   ├── main.js             → ponto de entrada (importa o CSS e o boot.js)
│   ├── store.js            → estado global do app (um único objeto)
│   ├── config.js           → chaves de storage e constantes de configuração
│   ├── boot.js             → sequência de inicialização do app
│   ├── router.js           → navegação por abas (hash routing)
│   ├── theme.js            → tema claro/escuro
│   ├── counters.js         → contadores internos de id
│   ├── persistence.js      → salvar/carregar do localStorage
│   ├── data-migrations.js  → migração de dados de versões antigas
│   ├── reminders.js        → lembrete diário
│   ├── body-tracking.js    → peso corporal e medidas
│   ├── icons-svg.js        → ilustrações SVG (logo, boneco)
│   ├── styles/             → CSS, um arquivo por seção (login, home, treinos...)
│   ├── data/                → dados estáticos (biblioteca de +300 exercícios,
│   │                          ícones, grupos musculares, medidas do corpo)
│   ├── auth/                → login, sessão, hash de senha
│   ├── utils/                → formatação, datas, números, DOM, imagens
│   ├── ui/                   → toast, avatar e outros pedacinhos de interface
│   ├── workouts/              → treinos, sessões, sessão ativa (cronômetro)
│   ├── exercises/              → biblioteca de exercícios e histórico
│   ├── stats/                   → recordes pessoais e estatísticas
│   ├── backup/                   → backup automático, exportar/importar
│   ├── update/                    → checagem de nova versão do app
│   ├── event-handlers.js          → todos os cliques/toques do app
│   └── views/                      → cada tela e cada folha (overlay)
│       └── overlays/                → dia de treino, timer de descanso, gráfico...
├── public/                 → arquivos copiados como estão para o site final
│   ├── manifest.json         → configuração do PWA
│   ├── sw.js                  → service worker (uso offline + atualização)
│   ├── users.json              → lista de usuários e senhas (você edita à mão)
│   ├── gerar-hash.html           → ferramenta offline para gerar linhas do users.json
│   └── icons/                     → ícones do app (veja "Ícones" abaixo)
├── tests/                  → dois testes automáticos de fumaça (ver "Testes")
└── README.md
```

Antes o app inteiro (lógica + estilo) morava em dois arquivos únicos
(`app.js` com ~4400 linhas e `index.html` com ~1500 linhas de `<style>`
misturado). Nesta reorganização, tudo foi dividido por assunto em quase 50
arquivos pequenos, sem mudar o comportamento do app (veja "Como foi feita
essa reorganização" mais abaixo se quiser os detalhes).

Os dados (treinos, exercícios e histórico) ficam salvos no `localStorage` do
navegador do seu iPhone, **separados por usuário logado** — não há servidor.
Use **Ajustes → Dados e backup → Exportar** de vez em quando para não perder
o histórico caso troque de aparelho.

## Rodando localmente / publicando

Este projeto agora usa [Vite](https://vitejs.dev) para juntar os quase 50
arquivos de `src/` num único `app.js` e `app.css` otimizados — é esse
resultado (a pasta `dist/`) que vira o site publicado, não os arquivos de
`src/` diretamente.

**Pra mexer no código:**
```
npm install     # só na primeira vez (ou quando package.json mudar)
npm run dev     # abre um servidor local com recarregamento automático
```

**Pra gerar a versão final (o que o GitHub Actions faz sozinho a cada push):**
```
npm run build   # gera dist/index.html, dist/app.js, dist/app.css etc.
```

**Testes automáticos** (ver seção "Testes" abaixo):
```
npm test
```

Você não precisa rodar `npm run build` manualmente para publicar — isso é
feito automaticamente pelo GitHub Actions a cada `git push` na branch
`main` (veja "Ativar o GitHub Pages" abaixo). `npm run dev`/`npm run build`
são só para quando você quiser testar ou conferir localmente antes de subir.

## Login

O acesso ao app agora exige login. Isso **não é segurança de verdade** — é
só uma barreira simples contra alguém pegar seu iPhone destravado e abrir o
app sem querer, ou contra visitas casuais ao link público. Qualquer pessoa
com acesso ao código-fonte (por exemplo, olhando o repositório no GitHub)
consegue ver a lista de usuários e os hashes. Não reutilize uma senha que
você usa em outro lugar importante.

**Para adicionar ou trocar um usuário:**

1. Abra `public/gerar-hash.html` (pode ser direto do seu computador, sem
   precisar estar publicado — é uma página offline).
2. Preencha usuário, nome, senha (o salt já vem preenchido, pode deixar).
3. Toque em "Gerar e adicionar ao users.json" e depois em "Copiar" (ou
   "Baixar users.json").
4. Abra `public/users.json` no GitHub (ícone de lápis) e cole o conteúdo
   completo, ou suba o arquivo baixado no lugar dele.
5. Suba a alteração (commit). O GitHub Actions builda e publica sozinho em
   1–2 minutos; depois disso, na próxima vez que o app checar atualização
   (ou você tocar em Ajustes → Atualizar), o novo usuário passa a funcionar.

O `users.json` de exemplo já vem com os usuários **william**, **mariana** e
**yasmim** — troque ou remova antes de usar de verdade.

Marcar **"Lembrar credenciais"** na tela de login guarda a sessão no
aparelho (sobrevive a fechar o app); sem marcar, a sessão dura só enquanto a
aba/app está aberto. Em ambos os casos a sessão vale só até o fim do dia:
todo dia (depois da meia-noite) é preciso fazer login de novo, mesmo com
"Lembrar credenciais" marcado — inclusive se o app ficar aberto durante a
virada do dia, ele detecta e volta para a tela de login sozinho.

## Testes

A pasta `tests/` tem dois testes de fumaça (rodam o app de verdade, num
navegador simulado, e conferem que nada explodiu):

- `smoke-boot.test.mjs`: builda o app, carrega a tela inicial e confere que
  a tela de login aparece sem erro nenhum.
- `smoke-login.test.mjs`: além disso, cria um usuário fictício com senha
  conhecida, faz login de verdade pela interface (preenche os campos e
  clica) e confere que a tela de início (saudação, card do treino, barra de
  abas) aparece corretamente depois.

Rode `npm test` sempre que mexer em algo estrutural (não é obrigatório para
mudanças pequenas de texto/estilo, mas ajuda a pegar erro de referência
quebrada cedo). Esses testes não substituem testar de verdade no iPhone —
eles não sabem, por exemplo, se um botão ficou visualmente torto.

## Ícones

Os arquivos enviados para esta reorganização não incluíam a pasta
`icons/` com os PNGs (`icon-192.png`, `icon-512.png`,
`apple-touch-icon.png` e as imagens de splash). Copie os ícones que você já
tinha para dentro de `public/icons/` antes de publicar — sem eles o app
ainda funciona, só aparece sem ícone próprio na tela de início do iPhone.

## Novidades desta versão

**Rodada 10 (v8.1) — ajustes de treino, histórico e telas**
- **Treinos anteriores preservados**: sessões já registradas (finalizadas ou de
  dias anteriores) mostram exatamente as séries que foram salvas. Mudar séries,
  apagar ou adicionar exercícios no treino depois **não altera** o histórico.
  Cada sessão guarda uma "foto" do treino (`snapshot`: nome, tipo e metas), e
  sessões antigas ganham essa foto automaticamente ao carregar (o `log` das
  séries nunca é modificado). Trocar a letra de um treino já registrado fica
  bloqueado, para não misturar séries.
- **Cardio na lista de exercícios**: novo grupo *Cardio* (Esteira, Bicicleta,
  Escada, Elíptico, Remo ergômetro etc.). Ao escolher um deles o exercício já
  entra como tipo *Cardio* (registro em minutos).
- **Página inicial** sem *Último recorde*, *Registrar peso* e *Ver histórico*.
- **Botões Iniciar / Detalhes** com o mesmo tamanho.
- **Histórico › Sessões do mês** compacto: resumo do mês (dias · treinos ·
  tempo), linhas menores, mostra as 5 mais recentes com "Ver todas".
- **Ajustes**: *Sobre o app* virou seção independente (Conta › Treino ›
  Aparência › Dados e backup › Sobre o app).
- **Login**: copyright discreto no rodapé da tela.

**Rodada 9 (v8.0) — ajustes no login**
- **Logo da tela de login** agora usa o mesmo arquivo do ícone do app
  (`public/icons/logo.png`), em vez do desenho SVG antigo.
- **Sem barra laranja ao digitar**: os campos de texto não mostram mais o
  contorno laranja de foco (no login, a borda só clareia levemente).
- **Manter conectado / senha salva**: o login agora é um `<form>` de verdade
  (com `name`/`autocomplete` corretos), o que faz o navegador e o iCloud
  Keychain oferecerem salvar e preencher usuário e senha. O app também lembra
  o último usuário (só o nome — a senha nunca é gravada pelo app) e, no
  Chrome/Android, pede ao navegador para salvar a credencial.
- Corrigido "vv7.0" no texto do card *Dados e backup* (a versão aparecia com
  dois "v").

**Rodada 8 (v7.0) — repaginação visual**
- Nova paleta **vibrante e colorida**: saiu o laranja monocromático, entrou um
  sistema com coral-laranja, violeta, azul, verde, dourado e teal — os
  treinos A/B/C/D já usavam cor para se diferenciar, e agora essas cores são
  mais vivas e consistentes em todo o app (calendário, histórico, recordes).
- **Fundo com brilho duotone** (coral + violeta) em vez do glow laranja único
  de antes, tanto no login quanto no resto do app.
- **Números e títulos grandes** (saudação, nome do treino, títulos de aba,
  logo do login) agora usam a variante arredondada da fonte nativa do iOS
  (`ui-rounded`) — sem baixar nenhuma fonte externa, então não afeta o uso
  offline.
- **Ícones mais consistentes**: unificada a espessura de traço dos +50
  ícones do app (login, ajustes, ações). O desenho de cada ícone continua o
  mesmo, só ficou mais uniforme.
- **Barra de abas**: a aba ativa agora ganha uma "pill" preenchida atrás do
  ícone (padrão comum em apps nativos), em vez de só mudar a cor do texto.
- Tema continua **automático** (claro de dia, escuro à noite), sem mudança
  de comportamento — só de cor.

**Rodada 7 (v7.0) — reorganização do código, sem mudar o app**
- O `app.js` (~4400 linhas) e o `index.html` (~1500 linhas, quase tudo CSS
  misturado) foram divididos em quase 50 arquivos pequenos, cada um com uma
  responsabilidade (login, treinos, backup, telas, etc. — veja "Estrutura"
  acima).
- Passou a usar **Vite** para juntar tudo de novo num `app.js`/`app.css`
  únicos na hora de publicar, e o **GitHub Actions builda e publica
  sozinho** a cada `git push` (antes era preciso subir os arquivos prontos
  direto pela interface do GitHub).
- Adicionados **testes automáticos de fumaça** (`tests/`, rodam com
  `npm test`) que exercitam o carregamento do app e um login completo.
- Nenhuma tela, texto ou comportamento do app foi alterado nesta rodada —
  é só reorganização interna do código. Veja "Como foi feita essa
  reorganização" logo abaixo para como isso foi verificado.

**Rodada 6 (v4.0) — abas, login e dados por usuário**
- **Navegação por abas**: barra fixa embaixo (Início, Treinos, Histórico,
  Progresso, Ajustes), estilo app nativo, com roteamento por hash
  (`#/inicio`, `#/treinos`...) para o gesto de voltar do iOS funcionar. O
  timer de descanso e as folhas (overlays) continuam funcionando por cima
  de qualquer aba.
- **Início redesenhado**: saudação com seu nome e a data, card do treino de
  hoje, sequência/semana/mês, 7 bolinhas mostrando os dias da semana em que
  você treinou, atalho para o último recorde batido, e atalhos rápidos para
  registrar peso ou ver o histórico.
- **Abas refinadas**: Treinos e Histórico ganharam título próprio e
  perderam o botão "Ocultar" (não faz mais sentido, cada uma já tem tela
  própria); Histórico ganhou uma lista das sessões do mês, além do
  calendário; Ajustes foi reorganizado em blocos "Conta", "Treino",
  "Aparência" e "Dados e backup". O botão "Ocultar" continua existindo
  dentro de Progresso (Estatísticas, Recordes, Corpo), onde ainda faz
  sentido esconder um bloco por vez.
- **Login**: tela de usuário/senha antes do app, validada com
  `crypto.subtle` contra um `users.json` que você edita à mão (veja a seção
  "Login" acima), com opção "Manter conectado" e um botão "Sair" em
  Ajustes → Conta. Sem login, nenhuma tela do app é exibida.
- **Dados separados por usuário**: cada login tem seu próprio histórico,
  treinos e backups automáticos. Na primeira vez que qualquer usuário loga
  nesta versão, os dados antigos (de antes de existir login) são copiados
  automaticamente para ele, sem apagar a cópia antiga.
- **Transições suaves** entre abas (respeitando "reduzir movimento" do
  iOS) e estados vazios amigáveis (ex.: "nenhuma sessão nesse mês").

**Rodada 5 (v3.1)**
- **Timer de descanso sem piscar**: a barra é montada uma vez e só o número e o anel são atualizados no lugar (antes o HTML era recriado a cada segundo, o que reiniciava a animação). O anel agora avança de forma contínua.
- **Botão Atualizar mais robusto**: além de checar uma versão nova do `sw.js`, agora baixa `index.html`, `app.js`, `manifest.json` e ícones direto do servidor (ignorando cache), compara com o que está salvo e recarrega se algo mudou. Também funciona quando só o `app.js`/`index.html` foi alterado. O app verifica sozinho ao voltar para ele e mostra o aviso "Nova versão disponível". Em Preferências há também **"Recarregar do zero"** (limpa só o cache do app; treinos e histórico não são apagados).
- **Service worker "rede primeiro"**: a cada abertura os arquivos são revalidados no servidor; o cache só serve de reserva offline.
- **Ocultar em todas as seções**: Meus treinos, Histórico, Estatísticas, Recordes, Corpo, Lembretes, Preferências e Dados e backup têm o botão Ocultar/Mostrar. Ao ocultar, sobra só o título da seção. A escolha fica salva.
- **Recordes enxutos**: um exercício por treino (o que bateu recorde de carga mais recentemente), com a letra do treino ao lado.

**Rodada 4**
- **Timer de descanso** entre séries (60/90/120s configurável por exercício), com vibração no fim. Não dispara em exercícios marcados como superset.
- **Tela sempre ligada** durante o treino (Wake Lock), com opção para desativar em Preferências.
- **Sugestão de progressão**: ao abrir um exercício, mostra "Sugestão: 65 kg × 10" com base na última vez, e um botão para aplicar direto nas séries.
- **Recordes pessoais (PR)**: selo de troféu quando você bate a maior carga ou o maior 1RM estimado, com uma seção "Recordes" listando os principais.
- **Notas e RPE**: campo de observação por exercício e por treino, e RPE (1–10) opcional por exercício.
- **Tipos de série**: aquecimento, drop set e até a falha (toque no número da série para alternar). Aquecimento fica fora das estatísticas de volume e recordes.
- **Estatísticas**: volume total, séries por grupo muscular e volume por semana (7/30/90 dias).
- **Peso corporal e medidas** (cintura, peito, braço, coxa) com gráfico de evolução.
- **Backups automáticos** dentro do aparelho (últimas 5 cópias diárias), com tela para restaurar qualquer uma.
- **Exportar/importar mais seguros**: exportar agora tenta abrir a folha de compartilhamento do iPhone (salvar direto no iCloud); importar valida o arquivo antes de aplicar e recusa backups corrompidos ou de versão futura.
- **Desfazer** em exclusões de exercício, treino e sessão (toast com botão "Desfazer").
- **Duplicar treino**, **reordenar exercícios**, **superset** (agrupar dois exercícios) e **link** de vídeo/técnica por exercício.
- **Unidade kg/lb** configurável.
- Correção: marcar uma série com ✓ agora grava de fato o peso/reps que já apareciam pré-preenchidos na tela (antes podiam ficar em branco).
- Telas de abertura (splash screens) do iOS.

**Rodada 3.1**
- **Biblioteca de exercícios embutida**: a lista de exercícios do seletor
  agora já vem pré-carregada com mais de 300 exercícios organizados em 21
  grupos musculares (Quadríceps, Glúteos, Peitoral, Costas, Bíceps,
  Tríceps, etc.), então dá pra montar um treino sem digitar nada. Os
  grupos aparecem retráteis (toque para abrir/fechar); ao digitar na
  busca, o filtro passa a mostrar todos os exercícios que combinam, de
  qualquer grupo, numa lista só. Exercícios digitados manualmente que não
  estão na biblioteca continuam aparecendo no topo, em "Meus exercícios".

**Rodada 3**
- **Tela de iniciar treino**: não é mais possível adicionar ou remover séries
  durante o treino (a quantidade de séries é a configurada no exercício,
  em "Meus treinos"). As únicas coisas editáveis ali são peso e
  repetições — e agora as repetições também podem ser digitadas
  diretamente (igual ao peso), além dos botões de +/-.
- **Estatística "no mês"**: o card que antes mostrava a soma de todas as
  sessões já feitas (desde sempre) agora mostra apenas as sessões do mês
  atual, reiniciando a cada mês novo. "Dias seguidos" e "essa semana"
  continuam como antes.
- **Lista de exercícios em vez de digitar**: ao tocar em "Adicionar
  exercício" dentro de um treino, abre uma lista com todos os nomes de
  exercícios já usados em qualquer treino, com busca (filtra por qualquer
  parte do nome, não só pelo início) e a opção de digitar um nome novo caso
  não esteja na lista. Ao trocar o nome de um exercício já existente, toque
  no nome dele para abrir a mesma lista (aqui é só tocar em um item para
  escolher).

**Rodada 1**
- Registro de carga e reps ao marcar um treino (ou editar um dia do
  histórico), com o último valor usado como referência.
- Histórico em heatmap estilo GitHub.
- Reordenar treinos no ciclo com as setinhas.
- Ícones SVG no lugar dos caracteres de texto (✎ ✕ ✓).
- Indicador de salvamento renomeado ("salvo neste aparelho").
- Aviso de atualização do app quando uma nova versão for publicada.
- Importar backup mostra quantos treinos/sessões o arquivo tem.
- Corrigido bug do contador de ID de exercício reiniciando a cada carregamento.

**Rodada 2**
- **Gráfico de progresso por exercício**: toque no ícone de gráfico ao lado
  de um exercício para ver a evolução de carga ao longo do tempo.
- **Dias de descanso**: dá pra adicionar "Descanso" como parte do ciclo,
  junto com os treinos A/B/C.
- **Lembrete diário**: ative um horário para o app te avisar (por
  notificação, se permitida, e por um aviso dentro do app) que ainda não
  treinou hoje. **Importante:** isso só funciona enquanto o app está aberto
  ou quando você o reabre — o iPhone não permite alarmes em segundo plano
  para apps instalados via Safari sem um servidor de notificações próprio
  (Web Push exigiria backend). Se quiser lembrete garantido mesmo com o app
  fechado, o caminho realista é usar o app de Lembretes/Calendário nativo
  do iPhone em paralelo.
- **Aviso de backup**: se passar 14 dias sem exportar, aparece um banner
  sugerindo exportar (com atalho direto).
- **Importar com escolha**: agora pergunta se você quer **mesclar** o
  backup com os dados atuais (só adiciona sessões novas) ou **substituir**
  tudo.
- **Inputs de exercício redesenhados**: nome em linha própria, séries/reps
  em campos maiores e mais fáceis de tocar.
- **Animação de conclusão**: um pulso sutil no card ao salvar o treino do dia.
- Mais `aria-label`s nos chips e campos da folha de registro.
- Código dividido em `index.html` (estrutura) e `app.js` (lógica), para
  ficar mais fácil de editar cada parte separadamente.

## Como foi feita essa reorganização (Rodada 7)

Para não arriscar quebrar um app que já funcionava, a divisão do código não
foi feita reescrevendo à mão — foi feita com scripts de transformação
automática (codemods, usando a mesma ferramenta de análise de código que o
Babel usa por trás dos panos), que:

1. Juntaram as ~25 variáveis globais soltas do `app.js` (`state`,
   `currentUser`, `overlay`, etc.) num único objeto de estado.
2. Extraíram os dados fixos (biblioteca de exercícios, ícones, grupos
   musculares) para arquivos próprios.
3. Dividiram o restante em quase 50 arquivos por assunto, calculando
   automaticamente quais `import`/`export` cada arquivo precisa.

Depois de cada etapa, isso foi conferido de verdade, não só "por
inspeção":
- Comparação byte-a-byte confirmando que os dados extraídos (exercícios,
  ícones, etc.) ficaram idênticos ao original.
- Checagem automática (ESLint `no-undef`) de que nenhum arquivo ficou
  referenciando algo que não foi importado.
- Dois testes de ponta a ponta rodando o app de verdade (ver "Testes"
  acima), incluindo um login completo, exercitando login, carregamento de
  dados, a tela de início e a barra de abas sem nenhum erro.

Ainda assim, isso não substitui testar no seu iPhone de verdade antes de
confiar 100% — não há como simular todo o hardware (Wake Lock, notificação,
folha de compartilhamento do iOS) fora de um aparelho real.

## Teste do fluxo completo (Rodada 6)

Percorri o código do fluxo login → início → iniciar treino → descanso →
concluir → progresso → sair com atenção (não tenho como abrir um Safari de
iPhone de verdade a partir daqui, então isto é uma revisão cuidadosa do
código, não um teste automatizado rodando no aparelho). O que encontrei:

- **Login**: o formulário valida usuário/senha contra `users.json` via
  `crypto.subtle.digest`; sem conexão e sem o arquivo em cache, mostra uma
  mensagem clara em vez de travar. Depois do primeiro login online, o
  arquivo fica no cache do service worker (rede primeiro, com reserva
  offline), então logins seguintes funcionam sem internet.
- **Início → iniciar treino → descanso → concluir**: reaproveita as mesmas
  funções que já existiam (`startActiveSession`, `startRestTimer`,
  `endActiveSession`), só mudou onde a tela de resumo é montada — não
  toquei nessa lógica.
- **Progresso**: Estatísticas/Recordes/Corpo continuam com o próprio botão
  Ocultar, exatamente como antes.
- **Sair**: pede confirmação, limpa a sessão salva e volta para o login sem
  deixar nenhuma tela do app visível por trás.

**Pontos de atenção que valem seu teste real no iPhone:**
- Se você é o único usuário do aparelho, a separação de dados por usuário é
  transparente (seus dados de antes continuam lá, só que agora "dentro" do
  seu login). Se mais de uma pessoa usa o mesmo iPhone/Safari, cada uma
  deve logar com seu próprio usuário para não misturar treinos.
- O botão "voltar" do iOS entre abas depende do histórico de hashes do
  navegador; funciona bem para ir e voltar entre abas que você já visitou,
  mas se você voltar até *antes* da primeira aba visitada nesta sessão, o
  app reafirma a aba atual no lugar de sair do app — comportamento seguro,
  mas vale confirmar que não incomoda no uso real.
- Não implementei um limite de tentativas de senha nem expiração de sessão
  — de novo, é só uma barreira simples, não segurança de verdade.

### O que ficou de fora (e por quê)

- **Sincronizar entre aparelhos de verdade** (ex: editar no iPhone e ver no
  iPad na hora) não é possível só com HTML/JS estático — precisa de um
  servidor/backend guardando os dados de cada usuário. O app continua
  local por aparelho; a forma de levar dados de um pra outro é exportar e
  importar o arquivo de backup (dá pra guardar esse arquivo no iCloud Drive
  para facilitar).
- **Reescrever o motor de renderização** (hoje ele redesenha a tela inteira
  a cada ação, em vez de atualizar só o que mudou) não foi feito nesta
  rodada: com a quantidade de dados de um app pessoal de treino isso não
  chega a ser perceptível na prática, e mexer nisso tem risco real de
  introduzir bugs sutis para um ganho que você provavelmente nem notaria.
  Se um dia o app crescer muito (dezenas de exercícios por treino, anos de
  histórico), vale revisitar.

## 1. Subir para o GitHub

Como agora tem um passo de build (veja "Rodando localmente / publicando"),
o jeito mais simples de subir e manter o projeto é usando o Git de verdade
(pelo terminal ou por um app como o GitHub Desktop), em vez de arrastar
arquivos pela interface do site:

1. Entre em [github.com](https://github.com) (crie conta se ainda não tiver).
2. Clique em **New repository**. Nome sugerido: `meus-treinos`. Marque como
   **Public**. Não crie README automático (já tem um aqui).
3. Clique em **Create repository**.
4. No seu computador, dentro desta pasta `meus-treinos`, rode:
   ```
   git init
   git add .
   git commit -m "Reorganização do projeto"
   git branch -M main
   git remote add origin https://github.com/SEU-USUARIO/meus-treinos.git
   git push -u origin main
   ```
   (troque `SEU-USUARIO` pelo seu usuário do GitHub). Se preferir não usar
   o terminal, o app gratuito [GitHub Desktop](https://desktop.github.com)
   faz a mesma coisa clicando em botões.

Pequenos ajustes depois (editar um texto, trocar uma cor) ainda dá para
fazer direto pelo site do GitHub (ícone de lápis em cada arquivo dentro de
`src/`) — o Actions builda sozinho a cada commit, não precisa mexer no
terminal para isso.

## 2. Ativar o GitHub Pages

1. No repositório, vá em **Settings → Pages**.
2. Em **Source**, escolha **GitHub Actions** (não mais "Deploy from a
   branch" — quem builda e publica agora é o workflow em
   `.github/workflows/deploy.yml`).
3. Depois do primeiro `git push`, vá na aba **Actions** do repositório e
   acompanhe o workflow "Build e publicar no GitHub Pages" rodar (leva
   cerca de 1 minuto). Quando ficar verde, volte em Settings → Pages para
   ver o link: `https://SEU-USUARIO.github.io/meus-treinos/`

## 3. Instalar no iPhone

1. Abra o link no **Safari** do iPhone.
2. Toque no ícone de compartilhar (quadrado com seta para cima).
3. Toque em **"Adicionar à Tela de Início"** e confirme.

O ícone aparece na tela inicial e abre em tela cheia, como um app nativo.

## Atualizando depois

Edite os arquivos dentro de `src/` (direto pelo GitHub, com o ícone de
lápis, ou no seu computador) e suba a alteração (`git push`, ou "Commit
changes" se editou pelo site). O GitHub Actions builda e publica sozinho em
cerca de 1 minuto — não precisa mais rodar `npm run build` nem subir a
pasta `dist/` manualmente. Depois, abra o app no iPhone e toque em
**Preferências → Atualizar** (ou espere o aviso "Nova versão disponível").

A cada versão nova, troque o número em dois lugares (o mesmo nos dois):
`CACHE_NAME` no `public/sw.js` e `APP_VERSION` no `src/data/constants.js`.
Não é obrigatório para o botão Atualizar funcionar, mas deixa a versão
mostrada no app correta.

**Ícone da tela de início:** o iOS guarda o ícone no momento em que o atalho é
criado e não permite que o app o troque depois. Se você mudar os arquivos em
`public/icons/`, o novo ícone só aparece ao **remover o atalho e adicioná-lo
de novo** pelo Safari (seus dados ficam no aparelho; faça um backup antes
por garantia).
