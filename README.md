# Meus Treinos

App para organizar seus treinos A/B/C, saber qual treino fazer hoje (ciclo
automático), marcar como feito e acompanhar o histórico. Funciona como PWA:
depois de publicado, instala no iPhone e se comporta como um app nativo.
Tem tela de login e navegação por abas, no estilo de app nativo.

## Estrutura

```
meus-treinos/
├── index.html            → esqueleto HTML (o app inteiro é montado via JS)
├── package.json           → dependências, scripts e a versão do app (única fonte)
├── vite.config.js         → configuração do build (gera APP_VERSION e CACHE_NAME)
├── eslint.config.js       → regras do ESLint (config flat)
├── .prettierrc.json       → estilo do Prettier (aspas duplas, ponto e vírgula)
├── .prettierignore        → o que o Prettier não mexe (dist, public, data, *.md...)
├── .editorconfig          → indentação, fim de linha e codificação do editor
├── .github/workflows/
│   └── deploy.yml          → testes → build → publicação no GitHub Pages
├── src/
│   ├── main.js             → ponto de entrada (importa o CSS e o boot.js)
│   ├── store.js            → estado global do app (um único objeto)
│   ├── config.js           → chaves de storage e constantes de configuração
│   ├── boot.js             → sequência de inicialização do app
│   ├── router.js           → navegação por abas (hash routing)
│   ├── theme.js            → tema claro/escuro
│   ├── counters.js         → contadores internos de id
│   ├── persistence.js      → salvar/carregar do localStorage
│   ├── storage/            → IndexedDB (foto e backups), migração única, medidor de espaço
│   ├── audio/              → beep do fim do descanso (Web Audio)
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
│   ├── workouts/              → treinos, sessões, sessão ativa (cronômetro), meta semanal (weekly-goal.js)
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
│   ├── users.json              → lista de usuários (apelido + hash da senha; você edita à mão)
│   └── icons/                     → ícones do app (veja "Ícones" abaixo)
├── tests/                  → 22 arquivos de teste, rodados por `npm test` (ver "Testes")
├── tools/
│   ├── gerar-hash.html      → ferramenta offline para gerar o hash das senhas (uso local; NÃO vai para o site publicado)
│   └── build-font.py        → script que gera a fonte de números (src/fonts/treino-score.woff2)
└── README.md
```

Antes o app inteiro (lógica + estilo) morava em dois arquivos únicos
(`app.js` com ~4400 linhas e `index.html` com ~1500 linhas de `<style>`
misturado). Nesta reorganização, tudo foi dividido por assunto em quase 50
arquivos pequenos, sem mudar o comportamento do app (veja "Como foi feita
essa reorganização" mais abaixo se quiser os detalhes).

Os dados (treinos, exercícios e histórico) ficam salvos no `localStorage` do
navegador do seu iPhone, **separados por usuário logado** — não há servidor.
A foto de perfil e os backups automáticos ficam no **IndexedDB** (v8.2), que tem
muito mais espaço que os ~5 MB do localStorage.
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

**Qualidade de código** (ESLint e Prettier):
```
npm run lint           # ESLint: deve terminar sem erros
npm run format:check   # só confere o estilo, sem alterar nada
npm run format         # Prettier reescreve os arquivos no estilo do projeto
```
O Prettier está configurado com o estilo que o código já tinha (aspas duplas, ponto e
vírgula, sem vírgula final, linhas até 160 colunas), então o diff costuma ser pequeno. Mesmo
assim, para não gerar um commit enorme misturado com outras mudanças, prefira formatar só o
que você mexeu: `npx prettier --write src/arquivo.js`. O `.editorconfig` faz o editor seguir
as mesmas regras (2 espaços, LF, UTF-8).

Você não precisa rodar `npm run build` manualmente para publicar — isso é
feito automaticamente pelo GitHub Actions a cada `git push` na branch
`main` (veja "Ativar o GitHub Pages" abaixo). **O workflow roda `npm test` antes
do build: se qualquer teste falhar, nada é publicado** (o job de publicação só
começa depois do job de build/testes terminar com sucesso). O CI usa Node 22. `npm run dev`/`npm run build`
são só para quando você quiser testar ou conferir localmente antes de subir.

## Login

O acesso ao app exige login, mas ele é uma **porta de cortesia, não segurança
real**. Serve para alguém não abrir o app sem querer no seu iPhone destravado
ou numa visita casual ao link. **Os dados (treinos, histórico, medidas, fotos)
ficam no aparelho**, no `localStorage`/IndexedDB do navegador, sem servidor:
quem tiver o aparelho destravado, ou souber abrir o DevTools, lê tudo sem passar
pelo login. E como o app é estático, o `users.json` é público: qualquer pessoa
com o link (ou com o repositório, se for público) baixa a lista de usuários e os
hashes e pode tentar adivinhar senhas fracas offline. O que o app faz para
dificultar isso, sem prometer mais do que entrega:

- **Hash forte:** a senha é guardada como PBKDF2-HMAC-SHA256 (600 mil iterações)
  com um salt aleatório de 16 bytes, único por usuário — o mesmo padrão do PIN
  (`src/auth/pin.js`). Formato do registro no `users.json`:
  `{ "username", "name", "alg": "PBKDF2-SHA256", "iter": 600000, "salt": "<base64>", "hash": "<base64>" }`.
- **Compatibilidade na transição:** registros no formato antigo
  (`{ "username", "name", "salt", "hash" }`, com SHA-256 simples) continuam
  entrando. Eles só passam a ter o hash novo quando você os gera de novo com
  `tools/gerar-hash.html` (não há como converter sem saber a senha). Depois de
  regenerar todos, o formato antigo pode ser tirado de `src/auth/crypto.js`.
- **Só apelido:** o campo `name` do `users.json` é o apelido que aparece no app
  (ex.: "William"), nunca o nome completo, porque o arquivo é público.
- **Ferramenta fora do site:** `gerar-hash.html` fica em `tools/` e não entra no
  build publicado. Abra o arquivo direto no seu computador.
- **Senha longa e exclusiva:** use uma frase longa que você não usa em outro lugar.
  Se o repositório já foi público com hashes do formato antigo, considere essas
  senhas expostas e troque-as (o histórico do Git guarda as versões antigas do
  `users.json`).

**Para adicionar ou trocar um usuário:**

1. Abra `tools/gerar-hash.html` (direto do seu computador, sem precisar estar
   publicado — é uma página offline).
2. Preencha usuário, apelido e senha (o salt aleatório é gerado sozinho).
3. Toque em "Gerar e adicionar ao users.json" e depois em "Copiar" (ou
   "Baixar users.json").
4. Abra `public/users.json` no GitHub (ícone de lápis) e cole o conteúdo
   completo, ou suba o arquivo baixado no lugar dele.
5. Suba a alteração (commit). O GitHub Actions builda e publica sozinho em
   1–2 minutos; depois disso, na próxima vez que o app checar atualização
   (ou você tocar em Ajustes → Atualizar), o novo usuário passa a funcionar.

O `users.json` de exemplo já vem com os usuários **william** e **mariana**
(ainda no formato antigo de hash) — gere de novo com a ferramenta, troque ou
remova antes de usar de verdade.

Marcar **"Lembrar credenciais"** na tela de login guarda a sessão no
aparelho (sobrevive a fechar o app); sem marcar, a sessão dura só enquanto a
aba/app está aberto. Em ambos os casos a sessão vale só até o fim do dia:
todo dia (depois da meia-noite) é preciso fazer login de novo, mesmo com
"Lembrar credenciais" marcado — inclusive se o app ficar aberto durante a
virada do dia, ele detecta e volta para a tela de login sozinho.

## Testes

`npm test` faz o build (`npm run build`) e roda todos os arquivos de `tests/`.
Se qualquer um falhar, o comando termina com erro — e o GitHub Actions não publica.

**Testes de navegador simulado** (jsdom, rodam o app de verdade a partir do `dist/`):

- `smoke-boot.test.mjs`: carrega a tela inicial e confere que a tela de login
  aparece sem nenhum erro de JavaScript.
- `smoke-login.test.mjs`: cria um usuário fictício, faz login pela interface
  (preenche e clica) e confere a tela de início (saudação, card do treino, abas).
- `a11y-overlays.test.mjs`: painéis acessíveis — o foco entra no painel ao abrir, Tab fica preso,
  Esc fecha e o foco volta ao botão de origem; fundo `inert`, `aria-labelledby` em todo
  `role="dialog"`, fim do descanso anunciado em `aria-live` sem mover o foco, e todo botão só-ícone
  com `aria-label` e alvo de toque de 44px (token `--tap`). O tamanho real é conferido por texto de
  CSS (o jsdom não tem layout).
- `behavior.test.mjs` (modos `login` e `app`): comportamentos da interface — copyright
  no login; home sem atalhos removidos; botões Iniciar/Detalhes; ordem das seções de
  Ajustes e "Sobre o app"; histórico do mês (5 linhas, Ver todas/Mostrar menos);
  sessões antigas preservando as séries e o snapshot; grupo Cardio; grupo muscular em
  exercício próprio.
- `storage.test.mjs` (modos `migrate`, `failure`, `usage`; usa `fake-indexeddb`): migração
  única localStorage → IndexedDB (foto e backups), falha do IndexedDB sem perder cópias,
  e o medidor de espaço em uso. O arquivo também tem um modo `restore`, que não entra no
  `npm test`.
- `auth.test.mjs` (8 cenários, cada um num processo próprio): sessão sem expirar na virada
  do dia, expiração após N dias sem abrir, treino ativo nunca derruba o login, e PIN
  (PBKDF2, bloqueio após 5 erros).

**Verificações de arquivos** (sem navegador, leem o código-fonte e o `dist/`):

- `tokens.test.mjs`: tokens de cor claro/escuro em sincronia, `theme-color` igual ao `--bg`
  de cada tema (código, `index.html` e `manifest.json`), CSS sem hack de especificidade,
  todo `var(--x)` definido e sem `style=""` estático nas views.
- `version.test.mjs`: a versão vem só do `package.json` e bate com `APP_VERSION`
  (`dist/app.js`), com o `CACHE_NAME` (`dist/sw.js`) e com o regex que o service worker
  usa para ler a versão publicada.
- `sw.test.mjs`: roda o `public/sw.js` num sandbox com Cache API e `fetch` falsos —
  responde do cache na hora e atualiza em segundo plano, primeira visita, offline,
  `users.json` rede primeiro, aviso de versão nova, mensagens `SKIP_WAITING` e `CHECK_UPDATE`.

**Testes unitários** (`node --test`, sem build e sem navegador; funções puras):

- `weekly-goal.test.mjs`: meta semanal e sequência de semanas (virada de semana e de ano,
  semana sem treino, descanso, início da semana).
- `streak.test.mjs`: `computeWeeklyStreak` ligada ao store (meta, início da semana, descanso).
- `progression.test.mjs`: `e1rm`, `suggestNext` (últimas 3 sessões, RPE, deload) e
  `muscleGroupOf` / grupo escolhido em exercício próprio.
- `migrations.test.mjs`: todas as migrações de `src/data-migrations.js`.
- `rest-rules.test.mjs`: descanso entre exercícios, não inicia na última série do treino, superset, "repetir anterior".
- `beep.test.mjs`: beep do timer com um `AudioContext` falso (destravar no toque, tocar,
  não fazer nada sem suporte).
- `login-hardening.test.mjs` (`node --test`): senha PBKDF2 nos dois formatos (novo e antigo),
  `users.json` só com apelido, `gerar-hash.html` fora do `dist/`, a ferramenta gerando um hash
  que o app aceita (salt único por usuário), e a notificação por `showNotification()` sem
  `new Notification()`.

Para rodar um arquivo só: `node tests/auth.test.mjs` (os de navegador simulado precisam do
`dist/` — rode `npm run build` antes) ou `node --test tests/streak.test.mjs` (unitários).

Esses testes não substituem testar de verdade no iPhone — eles não sabem, por exemplo,
se um botão ficou visualmente torto, nem simulam Wake Lock, notificações ou a folha de
compartilhamento do iOS.

## Ícones

Os arquivos enviados para esta reorganização não incluíam a pasta
`icons/` com os PNGs (`icon-192.png`, `icon-512.png`,
`apple-touch-icon.png` e as imagens de splash). Copie os ícones que você já
tinha para dentro de `public/icons/` antes de publicar — sem eles o app
ainda funciona, só aparece sem ícone próprio na tela de início do iPhone.

### Qualidade dos dados (etapa 13)

- **Grupo de exercício próprio:** na edição do treino, exercícios fora da biblioteca (e que não são cardio) têm um seletor de grupo muscular, o mesmo do picker; grava em `ex.group`.
- **Grupo principal:** exercícios que aparecem em mais de um grupo da biblioteca usam, nas estatísticas, o grupo definido em `src/data/exercise-primary-group.js`; os demais grupos só servem à navegação do picker.
- **CSV:** o nome, o tipo e o grupo vêm primeiro do snapshot da sessão; nova coluna `grupo_muscular` (no fim); células que começam com `= + - @` ganham apóstrofo na frente.
- **Importação:** `validateBackup` confere peso, reps e minutos (número finito ≥ 0; texto numérico é convertido, o resto vira vazio) e o tipo da série (desconhecido vira normal); descarta entradas que não são objetos e avisa quantas foram corrigidas.

### Ícones da interface (Lucide)

Os ícones da interface (`src/data/icons.js` e as abas em `src/data/constants.js`)
vêm do **[Lucide](https://lucide.dev)**, licença **ISC**
(Copyright (c) 2026 Lucide Icons and Contributors; copiados da versão
`lucide-static` 1.57.0). Os SVGs foram copiados para `src/data/lucide-paths.js`,
sem adicionar dependência. Padrão: viewBox 24x24, `fill="none"`,
`stroke="currentColor"`, `stroke-width="2.2"`, linecap/linejoin `round`.
A ilustração do logo (`src/icons-svg.js`) e os PNGs não são do Lucide.

> ISC License — Permission to use, copy, modify, and/or distribute this software
> for any purpose with or without fee is hereby granted, provided that the above
> copyright notice and this permission notice appear in all copies.
> THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES WITH
> REGARD TO THIS SOFTWARE INCLUDING ALL IMPLIED WARRANTIES OF MERCHANTABILITY AND
> FITNESS. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR ANY SPECIAL, DIRECT,
> INDIRECT, OR CONSEQUENTIAL DAMAGES OR ANY DAMAGES WHATSOEVER RESULTING FROM LOSS
> OF USE, DATA OR PROFITS, WHETHER IN AN ACTION OF CONTRACT, NEGLIGENCE OR OTHER
> TORTIOUS ACTION, ARISING OUT OF OR IN CONNECTION WITH THE USE OR PERFORMANCE OF
> THIS SOFTWARE.

## Novidades desta versão

### v10.2 — Offline, semana e detalhes
- Imagens dos exercícios baixadas automaticamente após o login e guardadas em cache próprio (`meus-treinos-exercise-images-v1`, não apagado nas atualizações): aparecem offline e não são baixadas de novo.
- "Esta semana": dia da semana em todos os dias, número do dia ao lado da letra (na cor do treino), visto duplo branco nos dias concluídos e lua + data nos dias de descanso.
- Tocar num dia concluído abre os detalhes do treino (somente leitura).
- Nome do usuário em laranja na saudação; troféu dourado; card "Treinos Este Ano" com chama laranja.

### v10.1 — Imagens dos exercícios
- Cache do app atualizado para `meus-treinos-v10.1.0`.
- No painel do treino, a foto do exercício substitui o ícone (caixa 56×40, `object-fit: contain`, sem cortar nem distorcer). Tocar na foto abre um modal por cima do treino com as duas posições (início e fim); fecha pelo ✕, tocando fora, ou com Esc — sem fechar nem alterar o treino em andamento.
- Na edição do treino a miniatura também mostra a foto, mas tocar nela continua abrindo o seletor de nome (sem zoom, para não mudar esse fluxo).
- Sem imagem (exercício próprio, cardio, sem mapeamento ou foto que não carregou) = ícone padrão da categoria, como antes.
- Fonte: yuhonas/free-exercise-db (domínio público). `src/exercises/exercise-images.js` liga o nome do exercício ao id da foto (`EXERCISE_IMAGE_MAP`). As fotos são procuradas em `./exercise-images/` (cópia local, offline) e, se não houver, na CDN do GitHub.
- `npm run imagens:verificar` confere os ids contra o banco real e lista exercícios sem imagem (`-- --lista` mostra os nomes); `npm run imagens:baixar` copia as fotos para `public/exercise-images/`. Ambos precisam de internet.
- Para ligar mais um exercício: adicione `"Nome na biblioteca": "Id_no_free-exercise-db"` em `EXERCISE_IMAGE_MAP`.

### v10.0 — Novo visual e gestos na lista de Treinos
- Cache do app atualizado para `meus-treinos-v10.0.0` (os caches antigos são apagados na ativação).
- Lista de Treinos: arrastar para a direita revela **Editar**; para a esquerda revela **Delete** (com "Desfazer"). Setas do teclado também abrem as ações.
- Novo visual (src/styles/v10.css): Início com chips de exercícios e cards de estatística, semana com letras dos treinos, filtro segmentado, botão de iniciar por treino, resumo do mês no Histórico e aba ativa em laranja.

### v9.9 — Visual e timer de descanso
- **Timer de descanso**: agora também inicia depois da última série de um exercício quando ainda
  há séries pendentes no treino (descanso antes do próximo exercício). Só não inicia na última
  série do treino inteiro e em supersets (`shouldStartRest` em `src/workouts/rest-rules.js`).
- **Séries em branco no editor viram 3** (`DEFAULT_SETS`), o mesmo número mostrado de exemplo.
  Antes o treino era criado com 1 série e toda série era a "última", então o timer nunca aparecia.
- **Tela do treino**: kg/reps e o contador de séries usam a fonte normal com números de largura
  fixa (a fonte digital fica só no cronômetro e nos números de destaque); botão de concluir série
  maior e com contorno; dica de A/D/F com botão *Entendi* (some depois de dispensada).
- **Home**: ícones de Pausar/Iniciar no mesmo tamanho, ícone em *Finalizar*, streak zerado em
  cinza, treino sem exercícios ganha o atalho *Montar este treino* (abre o editor).
- **Treinos**: setas de ordem só no modo *Reordenar*; no editor, Força/Cardio, grupo, ordem,
  Superset e Link ficam em *Mais opções*; rótulos sem caixa alta e exemplos mais claros.
- **Histórico**: título "Outubro de 2026" (sem "De"); dias sem treino ficam neutros.
- **Geral**: aba ativa legível no tema escuro (`--tab-active-bg/fg`), escala de fontes reduzida
  (sem tamanhos quebrados como 12,5/13,5/14,5px), fonte Inter embutida para Android/PC
  (`src/fonts/inter-latin.woff2`, licença OFL em `src/fonts/inter-OFL.txt`; no iPhone segue a SF
  Pro), estados vazios com ícone e moldura no desktop (≥ 700px).

### v9.9 — Correções de segurança e qualidade
- **Importação mais segura**: `validateBackup` (`src/backup/validate.js`) agora só aceita chaves de
  treino e ids com letras, números, `_` e `-`. Um arquivo com HTML nesses campos é recusado (ou o
  item é descartado), e os ids também passam por `escapeAttr` ao montar a tela.
- **Arquivo de importação acima de 25 MB é recusado** antes de ser lido.
- **Tocar na notificação do lembrete abre/foca o app** (`notificationclick` no `public/sw.js`).
- **CI**: o workflow agora roda `npm run lint` e `npm run format:check`; o build duplicado foi
  removido (o `npm test` já builda). Código todo formatado com Prettier; ESLint sem erros.
- Dependências: removidos `@babel/*` (não usados); `npm audit` sem alertas.
- `manifest.json` ganhou `id`; `withRetry` passa a aguardar funções assíncronas.
- **Pendente (manual)**: regenerar os usuários do `users.json` com `tools/gerar-hash.html` — os
  registros atuais ainda estão no formato antigo (SHA-256 simples).

### v8.5 — Timer de descanso
- **Beep ao fim do descanso** (Web Audio, 880 Hz, ~0,2 s). O áudio é liberado no primeiro
  toque do usuário (exigência do iOS; `src/audio/beep.js`) e a vibração continua. Liga/desliga
  em Ajustes → Treino → *Som ao fim do descanso* (`settings.beepEnabled`, padrão ligado; ao ligar
  toca uma prévia). Não apita se o descanso acabou há mais de 3 s (ex.: ao voltar ao app).
- **Última série não inicia descanso**: marcar a última série da lista do exercício não dispara
  o timer (`src/workouts/rest-rules.js`). *(Mudou na v9.9: só a última série do treino inteiro não inicia.)* **Superset continua como antes** (nunca inicia timer).
- **Repetir anterior**: chip sob cada série (a partir da 2ª, enquanto não marcada) que copia
  peso e reps da série acima. Cardio não tem o botão.
- **Timer acima da tab bar**: o timer (bottom 10px) cobria a tab bar (bottom 8px) por inteiro.
  Agora fica acima dela (altura medida em JS, variável `--rest-bottom`) e, com a folha do dia
  aberta, rente ao rodapé com folga extra no fim da folha. Em telas ≤ 380px o timer é mais
  compacto. A página ganha espaço no fim enquanto o timer está visível (classe `rest-on`).
- Testes novos: `tests/rest-rules.test.mjs` e `tests/beep.test.mjs` (`node --test`).
- No iOS o Web Audio respeita o botão de silencioso do aparelho.

### Progressão e testes
- **Sugestão de carga** (`suggestNext`, `src/stats/prs.js`) olha as últimas 3 sessões do
  exercício e o RPE anotado na sessão mais recente (`sess.meta[exId].rpe`):
  - bateu a meta de reps: +1 passo (2,5 kg / 5 lb); RPE 10 repete a carga; RPE ≤ 6 sobe 2 passos;
  - não bateu: mesma carga, +1 rep;
  - **estagnação** (as 2 sessões mais recentes não superaram a mais antiga das 3, com 0,5% de
    tolerância no 1RM estimado) e a última não bateu a meta: **deload de ~10%** (arredondado ao passo).
- **Grupo muscular em exercício próprio**: ao digitar um nome fora da biblioteca, o picker mostra
  "Grupo muscular". Fica em `ex.group` (e no snapshot da sessão); `muscleGroupOf(name, ex)` usa
  esse grupo antes da biblioteca. Sem escolha, continua em "Outros". Nome já usado em outro
  exercício próprio reaproveita o grupo. `SCHEMA_VERSION` não mudou (campo opcional).
- Testes unitários novos (ver "Testes").

### v8.4 — Sequência semanal
- **Meta semanal** em Ajustes → Treino (1 a 14 treinos por semana). Sem escolha, vale o
  padrão: quantidade de treinos que não são descanso no ciclo. *Usar padrão* volta a
  acompanhar o ciclo. Guardada em `settings.weeklyGoal` (`null` = padrão).
- **Início**: "dias seguidos" virou **semanas seguidas** (semanas em que a meta foi batida)
  e o card da semana mostra **x de y esta semana**. O mesmo vale para o Perfil.
- A semana atual em andamento não quebra a sequência; só conta quando bate a meta.
  Semana passada abaixo da meta (ou sem treino) encerra a contagem.
- Só contam sessões que não são de descanso (`isRestLetter`) e respeita
  *Semana começa na segunda*.
- Lógica em `src/workouts/weekly-goal.js` (funções puras); `computeStreak` foi removida.
- `SCHEMA_VERSION` não mudou (campo novo é opcional e migrado em `migrateSettings`).

### v8.3 — Login diário
- **A sessão não expira mais na virada do dia.** Só expira ao tocar em **Sair** ou
  depois de N dias sem abrir o app (padrão **30**; mude em Ajustes → Conta →
  *Manter conectado por*: 7, 14, 30, 60 ou 90 dias). O prazo é uma preferência do
  aparelho, por usuário (`gym-idle-days:<usuario>`).
- **Nunca derruba para o login com treino ativo** (`activeSession.state` diferente de
  `idle`), nem ao voltar ao app nem no boot (nesse caso olha o JSON salvo). Sair
  manualmente com treino ativo pede confirmação e o treino continua salvo.
- **PIN de 4 dígitos opcional** (Ajustes → Conta → *PIN de acesso*): guardado como
  PBKDF2-HMAC-SHA256 (600 mil iterações, salt aleatório de 16 bytes) via
  `crypto.subtle`, em `gym-pin:<usuario>` — fora dos dados do app, então não vai para
  exportação nem para backups. Criar/alterar exige a senha atual. A senha continua
  valendo e é a recuperação; 5 erros seguidos bloqueiam o PIN até entrar com a senha.
- Sessões antigas (v8.1, com `loginDay`) são aceitas e convertidas.
- `users.json`, a separação de dados por usuário e `SCHEMA_VERSION` não mudaram.
- Testes novos: `tests/auth.test.mjs` (8 cenários).

### v8.2 — Armazenamento e backups
- **Foto de perfil e backups automáticos migraram para o IndexedDB.** Os dados
  principais continuam no `localStorage` (leitura síncrona no boot e gravação no
  `beforeunload`, que o IndexedDB não garante).
- **Migração automática e única** (`src/storage/legacy-migration.js`): copia para o
  IndexedDB, lê de volta e compara; só então apaga a cópia antiga. Se algo falhar,
  a cópia antiga fica e a tentativa se repete na próxima abertura.
- **Ajustes → Dados e backup → Espaço em uso**: barra do localStorage (~5 MB), barra
  da cota do aparelho (`navigator.storage.estimate`) e aviso a partir de 70%
  (reforçado a partir de 90%).
- **Falhas de backup deixam de ser silenciosas**: o app avisa e mostra o motivo em
  Dados e backup. Nada é descartado para "caber".
- `SCHEMA_VERSION` 3 → 4. Histórico de sessões e snapshot **não mudaram**. O arquivo
  exportado continua com a foto em `settings.avatarUrl` (compatível), mas só abre
  em apps v8.2+.
- Restaurar um backup automático agora mantém a foto atual (as cópias novas não
  guardam a foto).
- Testes novos: `tests/storage.test.mjs` (usa `fake-indexeddb`).

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
  treinou hoje. A notificação do sistema é disparada por
  `registration.showNotification()` via service worker (`src/notify.js`), o único
  caminho suportado em PWA no iPhone; se não houver permissão ou service worker,
  o aviso dentro do app (toast) continua aparecendo. Em Ajustes o app diz
  explicitamente "o lembrete só aparece com o app aberto", e o mesmo vale para o
  aviso de fim de descanso. Não há Web Push. **Importante:** isso só funciona enquanto o app está aberto
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

**Como versionar:** a cada versão nova, troque só o `"version"` no `package.json`
(ex.: `8.5.0` → `8.6.0`) e, se quiser, descreva a mudança em "Novidades desta versão"
neste README. Não existe mais versão escrita à mão no código (o teste `version.test.mjs`
garante isso). O `package.json` alimenta sozinho:

- o `APP_VERSION` mostrado em Ajustes → Sobre o app (via `__APP_VERSION__` no build);
- o `CACHE_NAME` do `public/sw.js` (troca o placeholder no `dist/`);
- o comentário `/*! APP_VERSION="..." */` no topo do `dist/app.js`, que o service worker lê.

Depois é só commit e `git push` na `main`: o Actions roda `npm test`, builda e publica.

O app abre na hora com o que está no cache e baixa a versão
nova em segundo plano; o aviso "Nova versão disponível" aparece em seguida.
Mudar a versão não é obrigatório para o aviso funcionar (qualquer arquivo
diferente no servidor é detectado), mas deixa o número mostrado no app correto.

**Ícone da tela de início:** o iOS guarda o ícone no momento em que o atalho é
criado e não permite que o app o troque depois. Se você mudar os arquivos em
`public/icons/`, o novo ícone só aparece ao **remover o atalho e adicioná-lo
de novo** pelo Safari (seus dados ficam no aparelho; faça um backup antes
por garantia).
