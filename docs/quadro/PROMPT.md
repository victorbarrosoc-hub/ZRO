# Implantar a aba Quadro (o kanban da Maestro) nesta plataforma

Quero nesta plataforma o mesmo sistema de Quadro (kanban) que uso na Maestro,
outra plataforma minha. **O método é o da Maestro e não muda. A cara é a desta
plataforma.**

Junto com esta mensagem vão dois arquivos. Eles estão anexados ou colados no
fim, conforme o caso:

1. **`quadro-kanban.html`** é o esqueleto funcionando: um arquivo só, sem
   dependências. Abra no navegador e ele roda, com dados de exemplo guardados no
   próprio navegador. Na Maestro ele foi testado em 58 provas num navegador de
   verdade: computador, celular, duas abas ao mesmo tempo, banco lento e banco
   que recusa.
2. **`quadro-banco.sql`** é o banco, para Supabase/Postgres. Grava por campo,
   apaga com lápide, guarda histórico e separa os dados por organização. Foi
   provado em 23 testes num Postgres de verdade.

Use o esqueleto como **especificação executável**. Quando houver dúvida sobre
como algo deve se comportar, abra o arquivo e veja o que ele faz.

---

## Como fazer, em ordem

1. **Leia o esqueleto inteiro antes de escrever qualquer coisa.** Abra no
   navegador e use: crie um card, mova pelo botão do próximo passo, arraste,
   abra a ficha, filtre, troque para "Por prazo". Teste também com a largura de
   um celular.
2. **Entenda como esta plataforma é feita.** Descubra a tecnologia (React,
   Next, HTML puro...), onde ficam as telas e o menu, qual é o login, qual é o
   banco e onde moram as cores, a fonte e os componentes da identidade visual
   (IDV). Não escreva antes de saber isso.
3. **Crie a aba "Quadro" no jeito da plataforma.**
   - Se ela for em componentes (React etc.), quebre o esqueleto em componentes:
     barra, coluna, card, ficha, faixa "Soltar em" e aviso "não salvos".
   - Se for HTML, encaixe como uma página.
   - Em qualquer caso, **mantenha o comportamento igual**.
4. **Aplique a IDV só pelos tokens.** No esqueleto, toda cor, fonte, raio e
   sombra sai de variáveis no `:root`:
   - `--q-*`: fundo, superfícies, texto, cor de ação, perigo, raios, sombra;
   - `--col-*`: a cor de cada coluna.

   Ligue esses tokens aos tokens da plataforma. Se ela tiver tema claro e
   escuro, os dois precisam funcionar (o esqueleto traz um claro de exemplo em
   `data-tema="claro"`). As oito colunas podem seguir a paleta da marca, mas
   **cada coluna precisa de uma cor própria**: é por ela que a equipe se orienta.
5. **Troque a CONFIG pelos dados reais:**
   - `eu`: quem está logado;
   - `pessoas`: a equipe, com `revisor: true` em quem revisa;
   - `clientes`: os clientes, com `interno: true` para o trabalho da casa;
   - `formatos`.
6. **Ligue o banco.** Toda gravação passa por um objeto só, o `Armazem`, que tem
   cinco funções (contrato abaixo). Troque a implementação, que hoje usa o
   navegador, pela do banco da plataforma. Se for Supabase: rode o
   `quadro-banco.sql` no SQL Editor, ponha as pessoas em `quadro_membros` e use
   o `Armazem` pronto mais abaixo.
7. **Tire os dados de exemplo** (a função `exemplo()` e a semente na primeira
   abertura) quando o banco real estiver ligado.
8. **Prove antes de me entregar** (lista no fim). Prova num navegador de
   verdade, no computador e com largura de celular, não só leitura de código.

Se esta plataforma não for de agência e não tiver "cliente", **ajuste os nomes,
não o método**. Por exemplo: "Com o cliente" pode virar "Em aprovação". As oito
etapas, a ordem e o próximo passo de cada uma ficam. **Pergunte antes de tirar
qualquer coluna.**

---

## O método: não negociável

### As oito colunas, nesta ordem

| Coluna | O que diz (uma linha embaixo do nome) | Próximo passo (botão no card) |
|---|---|---|
| Pauta | Ideias sem responsável. Escolha quem faz. | **Atribuir**: escolher a pessoa dá dono ao card e o leva para A fazer |
| A fazer | Tem dono e prazo. Ainda não começou. | **Começar** → Fazendo |
| Fazendo | Em produção agora. | **Mandar para revisão** → Revisão |
| Revisão | Alguém da casa confere antes do cliente. | **Enviar ao cliente** → Com o cliente · **Devolver** → Fazendo. No trabalho interno: **Concluir** → Publicado |
| Com o cliente | Esperando a decisão do cliente. | Mostra "Aguardando o cliente · há N dias" · **Aprovou** → Aprovado · **Pediu ajuste** → Fazendo |
| Aprovado | O cliente aprovou. Falta agendar. | **Agendar** → Agendado. **Sem data de publicação, abre a ficha no campo da data** em vez de agendar às cegas |
| Agendado | Programado para ir ao ar. | **Publiquei** → Publicado |
| Publicado | No ar. | (nada) |

- **O próximo passo é atalho, não trava.** Arrastar para qualquer coluna
  continua valendo.
- Quando o card sai do trabalho (Pauta, A fazer, Fazendo) para Revisão ou
  Publicado, ele guarda **quem fez e quando** (`feitoPor`, `feitoEm`). Se voltar
  para o trabalho, isso é limpo.
- Na Revisão, o card mostra **quem revisa** (as pessoas com `revisor: true`).

### O card por fora

- Cliente e formato no topo.
- O tema em destaque. O nome completo segue o padrão
  **"Cliente · Formato · Tema"**; no trabalho interno, só o tema.
- Cada data diz o que é:
  - **"Entrega"** é quando a equipe entrega: fica vermelha se atrasou, amarela
    se é hoje, e só conta enquanto o card ainda é trabalho da equipe;
  - **"No ar"** é quando o post vai ao ar.
- Contagem da checklist e da conversa, avatar de quem faz (tracejado "+" se
  ninguém) e a cor da coluna num filete à esquerda.

### A coluna

- Mostra **10 cards** e depois "Mostrar mais 10 · N escondidos" (e "Mostrar só
  10").
- No computador, toda coluna **recolhe** numa faixa estreita com nome e conta.
  **Publicado nasce recolhida.** A escolha fica guardada no aparelho.
- **Publicado mostra o mais recente primeiro.** As outras seguem a ordem que a
  equipe arrastou.
- "+ Adicionar" no pé de cada coluna. O card nasce naquela coluna, o campo fica
  aberto para o próximo e Esc fecha.

### A barra: COMO ver (à esquerda) e o que FILTRA (à direita)

- **Colunas · Por prazo.**
- **Pessoa:** Todas · Só os meus · Sem responsável · cada pessoa.
- **Cliente.**
- **Data**, em três grupos, cada opção com a conta de cards:
  - **Ver todos, em ordem de prazo:** por entrega · pela data em que vai ao ar.
    Não filtra, só ordena.
  - **Entrega da equipe:** atrasada · hoje · esta semana · próxima semana · sem
    data. Só conta o que ainda é trabalho (Pauta a Revisão).
  - **Postagem:** vai ao ar hoje · esta semana · próxima semana.
- **"Limpar filtros (N)"** quando houver filtro ligado.

### Por prazo

São os mesmos cards (com os mesmos filtros), em faixas:

> Atrasados → Hoje → Amanhã → Ainda esta semana → Próxima semana → Mais para a frente → Sem prazo

- **Entrega da equipe** (padrão) mostra só o que ainda é trabalho da equipe.
- **Vai ao ar** agrupa pela data de publicação o que ainda não foi ao ar.

O card mostra em que coluna está.

### A ficha do card (abre ao tocar no card)

- **Topo fixo:** cliente, coluna, "Tudo salvo / Salvando… / Não salvo — tentando
  de novo" e ×.
- **Trocar o cliente PERGUNTA antes** ("Mover este card para X? Ele sai de Y."),
  e depois o card diz "Veio de Y em …". Na Maestro a troca era de um toque só e
  dez cards mudaram de cliente sem ninguém perceber.
- O tema é editável, com o prefixo do padrão em cima, e logo abaixo vem o botão
  do próximo passo.
- **Produção:** quem faz, entregar até, hora.
- **Publicação:** vai ao ar em, às. Não aparece no trabalho interno.
- **Três abas, cada uma dizendo quanto já tem:**
  - Conteúdo: briefing, texto, legenda;
  - Peça: links;
  - Detalhes: formatos (mais de um; o primeiro dá o nome), "Importante" e
    checklist.
- **Conversa do card:** mensagens da equipe, com autor e hora.
- **Apagar** pede confirmação e manda para a Lixeira.
- **Cada campo grava sozinho**, 400 ms depois de a pessoa parar de digitar. Não
  existe botão "Salvar".
- **Enquanto a pessoa digita, a ficha não é redesenhada por baixo dela** (o
  cursor nunca pula).
- Esc fecha.
- No celular, a ficha ocupa a tela inteira e nada sobra para o lado.

### Celular

- **Uma coluna por vez**, com as abas das oito colunas em cima (com a conta) e a
  linha de descrição da coluna aberta.
- **Deslizar para o lado** troca de coluna.
- **Segurar o card** (cerca de 0,4 s) e arrastar faz aparecer embaixo a faixa
  **"Soltar em"**, com as oito colunas. Soltar ali move o card.
- Os três filtros ficam numa linha.

### Computador

- **Arrastar** de verdade, soltando entre dois cards. A ordem vira o meio entre
  os vizinhos, e a faixa "Soltar em" também aparece durante o arraste.
- Arrastar para uma coluna recolhida funciona.

---

## As regras de dados: lições que custaram caro na Maestro

Cada uma destas foi um defeito real, com dados perdidos ou cards sumindo. O
esqueleto e o SQL já seguem todas. **Não desfaça nenhuma ao adaptar.**

1. **Grave por CAMPO, nunca o card inteiro, nem a lista inteira.** Na Maestro, o
   documento inteiro mesclado no navegador apagava o texto que outra pessoa
   tinha acabado de escrever. O `Armazem.mudar(id, campos)` recebe **só** o que
   mudou; `null` quer dizer tirar o campo.
2. **Apagar é lápide** (`apagadoEm` com a hora), e o card vai para a Lixeira com
   "Restaurar". "Apagar de vez" só marca `varridoEm`. **Nenhum DELETE.** E
   **ausência não é exclusão:** um card que não veio numa leitura não deve ser
   apagado por isso.
3. **O número do card sai do relógio + acaso, nunca "o maior + 1".** Duas
   pessoas criando ao mesmo tempo chegavam ao mesmo número e os cards se fundiam.
4. **A base do que foi enviado é o que FOI enviado.** O que a pessoa escreve
   enquanto o banco ainda responde fica para a próxima volta. Na Maestro, o texto
   escrito enquanto o banco criava o card era dado como salvo e nunca subia.
5. **Um card recusado não segura os outros.** A fila tenta cada card por conta
   própria.
6. **O que não chegou ao banco nunca é silencioso.** Depois de 20 s aparece o
   aviso fixo **"N cards não salvos"**, com nome, motivo e "Tentar de novo
   agora", e a fila tenta de novo sozinha a cada 15 s e quando a rede volta. Na
   Maestro, cards de uma pessoa ficaram só no computador dela durante um dia
   inteiro, e a tela não dizia nada.
7. **O que chega de outro aparelho não atropela o que este ainda não enviou.**
   Os campos pendentes daqui ficam.
8. **Cada mensagem da conversa é um campo próprio do card** (`cm_<id>`), não um
   item de lista. Duas pessoas escrevendo ao mesmo tempo nunca apagam a mensagem
   uma da outra.
9. **Histórico de toda gravação**: quem, quando e cada campo de → para. É o que
   explica qualquer sumiço. O SQL já faz isso.
10. **A organização vem sempre explícita e é conferida.** Na Maestro, uma busca
    "a primeira que achar", sem ordem, mostrou dados de uma agência para outra.
    Leitura por RLS, escrita só pelas funções.
11. **Escape todo texto antes de pôr na tela**, e todo link passa por conferência
    (só `http`/`https`; `javascript:` não entra).
12. **Se um dia a peça aceitar ARQUIVO:**
    - nunca guarde no card um endereço `blob:` (ele morre ao recarregar);
    - confira o tamanho ANTES de subir. O Supabase grátis recusa acima de 50 MB;
      diga isso na tela e não fique reenviando um arquivo que nunca vai caber;
    - converta foto HEIC do iPhone para JPG.

### O contrato do `Armazem` (é só isso que muda para ligar o banco)

```
carregar()            → Promise da lista de cards (inclusive os apagados)
criar(card)           → grava um card novo inteiro (uma vez)
mudar(id, campos)     → grava SÓ os campos que mudaram (null = tirar o campo)
ouvir(aoReceber)      → aoReceber(listaDeCards) quando outro aparelho mudou algo,
                        com os cards INTEIROS como estão no banco agora
```

Se der erro, a função **lança** (rejeita a Promise): a fila trata e avisa.

### `Armazem` pronto para Supabase (com o `quadro-banco.sql` rodado)

```js
const Armazem = {
  org: 'ORG-DA-PESSOA-LOGADA',          // a organização de quem está logado (de quadro_membros)
  async carregar(){
    const todos = [];
    for(let de = 0; ; de += 1000){        // o Supabase devolve no máximo 1000 por vez
      const { data, error } = await supabase.from('quadro_cards').select('dados').eq('org', this.org).range(de, de + 999);
      if(error) throw error;
      todos.push(...data.map(r => r.dados));
      if(data.length < 1000) break;
    }
    return todos;
  },
  async criar(card){
    const { data, error } = await supabase.rpc('quadro_card_criar', { p_org: this.org, p_id: card.id, p_dados: card });
    if(error) throw error;
    if(!data.ok) throw new Error(data.erro);   // id_existe | sem_acesso | formato
  },
  async mudar(id, campos){
    const { data, error } = await supabase.rpc('quadro_card_mudar', { p_org: this.org, p_id: id, p_campos: campos });
    if(error) throw error;
    if(!data.ok) throw new Error(data.erro);   // nao_existe | sem_acesso | formato
  },
  ouvir(aoReceber){
    supabase.channel('quadro-' + this.org)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'quadro_cards', filter: 'org=eq.' + this.org },
        p => { if(p.new && p.new.dados) aoReceber([p.new.dados]); })
      .subscribe();
  },
};
```

O `quadro_card_mudar` aceita um quarto parâmetro, `p_base` (a versão em que o
card foi lido). Com ele, um campo que outra pessoa mudou depois volta em
`conflitos` em vez de ser sobrescrito. O esqueleto ainda não manda `p_base`
(vale o último, por campo). Avisar o conflito na tela é um passo seguinte.

---

## Como provar antes de me entregar

Num navegador de verdade, no computador e com largura de celular (390 px):

- [ ] As oito colunas aparecem, na ordem, cada uma com a linha que a explica; Publicado começa recolhida.
- [ ] Criar no "+ Adicionar": o card nasce na coluna, com o nome no padrão, e continua lá depois de recarregar a página.
- [ ] O próximo passo leva por todas as colunas, de Pauta (Atribuir) a Publicado. "Agendar" sem data abre a ficha na data.
- [ ] Arrastar no computador põe o card entre dois outros. No celular, segurar mostra "Soltar em" e soltar move.
- [ ] No celular, deslizar para o lado troca de coluna e nada da página sai para o lado.
- [ ] A ficha grava cada campo sozinha, e o cursor não pula enquanto se digita.
- [ ] Trocar o cliente pergunta antes.
- [ ] Apagar vai para a Lixeira e "Restaurar" traz o card de volta.
- [ ] Filtros: Só os meus, Cliente, Entrega atrasada, Limpar filtros. Por prazo: faixas na ordem, Entrega e Vai ao ar.
- [ ] **Duas abas abertas**: o que uma grava aparece na outra, e duas pessoas mudando campos diferentes do mesmo card ao mesmo tempo **não perdem nada**.
- [ ] **Banco que recusa um card**: os outros sobem, e aparece "1 card não salvo" com o motivo.
- [ ] **Banco lento**: o texto escrito enquanto o card está sendo criado chega ao banco.
- [ ] Um tema com `<img src=x onerror=alert(1)>` aparece como texto.
- [ ] A IDV está aplicada (cores, fonte, raios, claro/escuro) e o método está idêntico.

## Para falar comigo

- **Fale em português, simples.** Não sou programador: explique o que muda na
  tela e no uso, sem trecho de código na conversa.
- Pergunte antes de qualquer coisa que mude o método.
- Ao terminar, me diga o que testou e o que ficou de fora.

**Fora deste esqueleto, para depois** (na Maestro já existem):

- link de aprovação para o cliente decidir sem login;
- upload de arquivos da peça;
- "Minha lista", o dia de cada pessoa;
- calendário mensal e semanal;
- @menções com aviso.


---
