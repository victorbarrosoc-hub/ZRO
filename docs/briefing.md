# Briefing: site e plataforma da ZRO

> Registrado em 24/09/2026 a partir do pedido do Victor. Base da marca: `docs/marca/documento-mestre.md`.
> **Status:** aguardando as referências de UI/UX pra começar o design.

## Visão geral

São dois produtos no mesmo sistema:

1. **Site público**: a vitrine. O cliente vê o portfólio, o conceito e a equipe, e pede orçamento por um funil que termina no WhatsApp.
2. **Área interna**: só Victor e Edu. CRM, agenda de produções, etapas dos projetos, orçamentos com timbrado, banco de freelas, financeiro e modelos de processo. Um pouco do que o Carro do Freela já faz, feito sob medida pra ZRO.

**Como os dois se ligam:** todo pedido que entra pelo funil do site vira um lead no CRM automaticamente, com as respostas do cliente.

---

## Parte 1: Site público

### Sensação

- **Estilo Apple:** muito respiro, tipografia grande, rolagem que conta uma história, vídeo em destaque e poucos elementos por tela
- **Dentro da IDV:** escuro, preto e branco, grão, círculo e ponto de luz (ver `docs/marca/identidade-visual.md`)
- **Primeira impressão desejada** (documento-mestre §25):
  1. "Eles sabem o que estão fazendo."
  2. "Eles têm uma linguagem própria."
  3. "Quero fazer meu próximo projeto com eles."
- **Não pode parecer** genérico, "videomaker de evento" ou publicitário demais (§15)

### Páginas e seções (proposta)

1. **Início:** filme manifesto, assinatura, 3 a 5 filmes em destaque e chamadas pra portfólio e orçamento
2. **Portfólio:** vídeos embedados com filtro por categoria. Cada case tem uma página própria: cliente, intenção, vídeo, frames e ficha técnica.
3. **Conceito:** o zero, o manifesto, o processo criativo (01 Origem → 07 Entrega) e os valores
4. **O que fazemos:** as frentes de trabalho e a **Absolute ZRO** (finalização e color)
5. **Equipe:** foto, nome, função e uma frase de cada pessoa
6. **Quem confia na ZRO:** logos dos clientes
7. **Orçamento:** o funil até o WhatsApp
8. **Rodapé:** Instagram @zrofilmes, WhatsApp, e-mail, CNPJ e a assinatura "Onde tudo começa e o comum termina."

### Categorias do portfólio

- **Pedido do Victor:** Evento, Publicidade, Vídeo de Conteúdo, Mini Doc, entre outras
- **Frentes do documento-mestre (§17):** Filmes de marca, Campanhas, Conteúdo, Documental e Direção criativa
- **Ponto de atenção:** o documento diz que a ZRO não deve parecer "videomaker de evento". Sugestão: usar os nomes das frentes e dar outro nome à categoria de eventos:
  - **Experiências**
  - **Aftermovies**
  - **Ao vivo**
- **Proposta de lista final:** Filmes de marca · Campanhas · Conteúdo · Documental · Experiências (a decidir)

### Vídeos embedados

- **Hospedagem sugerida: Vimeo.** O player é limpo, sem vídeos relacionados nem marca de terceiros. O YouTube funciona, mas polui a experiência.
- **Capa com prévia:** um trecho curto e mudo toca ao passar o mouse; o vídeo completo abre em tela cheia
- **Dados de cada vídeo:** título, cliente, categoria, ano, duração, formato (16:9 ou 9:16), destaque (sim/não) e ordem
- **Gestão pela área interna:** adicionar, trocar e reordenar vídeos sem mexer no código

### Funil de orçamento até o WhatsApp

**Fluxo:** uma pergunta por tela, com barra de progresso. No fim aparece o resumo e o botão **"Enviar pelo WhatsApp"**, que abre a conversa com a mensagem pronta. Ao mesmo tempo, o lead é salvo no CRM.

**Perguntas (proposta):**

1. **Tipo de projeto:** Filme de marca · Campanha · Conteúdo pra redes · Documental · Evento · Ainda não sei
2. **A ideia ou o objetivo:** texto livre, opcional
3. **Empresa ou marca e segmento**
4. **Quando e onde:** data ou mês previsto e cidade
5. **Diárias de gravação:** 1 · 2 · 3 a 4 · 5 ou mais · Não sei
6. **Vídeos finais e formato:** 1 · 2 a 4 · 5 a 10 · mais de 10 / horizontal · vertical · os dois
7. **Extras** (pode marcar vários): fotos · drone · cobertura em tempo real · legendas · color
8. **Faixa de investimento:** até R$ 5 mil · R$ 5 a 10 mil · R$ 10 a 20 mil · R$ 20 a 50 mil · acima de R$ 50 mil · prefiro conversar
9. **Nome e contato**, com a caixa de consentimento da LGPD

**Exemplo da mensagem que chega no WhatsApp:**

```
Olá, ZRO! Vim pelo site e quero um orçamento.

• Projeto: Campanha
• Empresa: Hotel Exemplo (hotelaria)
• Quando/onde: novembro/2026, Natal
• Diárias: 2
• Vídeos: 4, vertical
• Extras: fotos, drone
• Investimento: R$ 10 a 20 mil
• Ideia: lançamento da temporada de verão

Meu nome é Ana.
```

---

## Parte 2: Área interna (só Victor e Edu)

### Acesso

- Login só para as duas contas. Nada da área interna aparece no site público.
- Os dados de clientes e freelas seguem a adequação à LGPD que a ZRO fez com o Sebrae/FUNCERN

### Módulos

**1. Painel**
- Próximas diárias, projetos por etapa, leads novos
- A receber e a pagar do mês, impostos do mês

**2. CRM**
- **Clientes:** empresa, contatos, segmento, cidade, histórico de projetos e valores
- **Leads do site** entram sozinhos, com as respostas do funil
- **Funil comercial:** Novo lead → Em conversa → Orçamento enviado → Negociação → Fechado ou Perdido (com motivo)
- **Lembretes de follow-up**

**3. Projetos e etapas**
- Depois de fechado, o projeto segue o **processo criativo do documento-mestre (§18):**
  01 Origem → 02 Conceito → 03 Direção → 04 Produção → 05 Narrativa → 06 Finalização → 07 Entrega
- **Regra criativa como trava:** na etapa Conceito, as 6 perguntas do §34 viram um checklist. Sem resposta, o projeto não avança. ("Se não houver resposta clara, o projeto ainda não está pronto.")
- **Cada projeto guarda:** cliente, orçamento aprovado, equipe, diárias, entregas (vídeos, formatos, prazos), links de arquivos (Drive) e rodadas de revisão do cliente

**4. Agenda de produções**
- Calendário de diárias, entregas e reuniões, com visão por mês e por semana
- Filtro por projeto e por freela
- Aviso de conflito quando um freela é escalado em dois lugares no mesmo dia
- Integração com o Google Agenda (depois)

**5. Orçamentos**
- **Montagem rápida** com itens já cadastrados: pacotes, diária, diária extra, foto, drone, deslocamento, cobertura em tempo real, edição, color (Absolute ZRO)
- **Conta interna**, que o cliente não vê: custo de freelas + equipamento + deslocamento + impostos, e a margem que sobra
- **PDF com timbrado da ZRO:** preto e branco, logo, assinatura, número do orçamento e validade
- **Condições que a ZRO já usa**, prontas pra inserir:
  - todos os serviços com nota fiscal
  - diária de 8 horas
  - pedido fora do escopo exige novo orçamento
  - validade condicionada ao pagamento da entrada
- **Versões e status:** v1, v2… (rascunho, enviado, aprovado, recusado)
- **Aprovou, virou projeto:** o projeto é criado e os lançamentos financeiros previstos também

**6. Banco de freelas**
- **Cadastro:** nome, funções, cidade, contato, PIX, equipamento próprio, observações
- **Funções:** captação com câmera, captação sem câmera, edição, sameday, foto, drone, som, assistente…
- **Valor padrão** por função e por tipo de job, que já entra preenchido no orçamento e no projeto
- **Histórico** de jobs e pagamentos de cada freela
- **Montar a equipe do projeto** a partir do banco, com o custo somando na hora

**7. Financeiro**
- **Entradas:** a receber e recebido, com entrada e saldo em parcelas, por cliente e por projeto
- **Saídas:** a pagar e pago (freelas, com **pagamento parcial**, equipamento, deslocamento e custos fixos)
- **Impostos:** Simples Nacional (DAS) a pagar e pago por mês, e imposto estimado por projeto com alíquota configurável
- **Visões:**
  - fluxo de caixa mês a mês (realizado x previsto)
  - resultado por projeto (receita − custos − impostos = margem)
  - freelas a pagar, agrupados
- **Importar a planilha atual** "Gestão de freelancers (pagamento)"

**8. Processos e modelos**
- **Modelos por tipo de projeto** (evento, campanha, conteúdo, documental…) com etapas e tarefas padrão
- **Checklist de equipamentos:** kits por tipo de job, com controle de saída e retorno
- **Ordem do dia:** horários, locações, equipe, contatos e plano de filmagem, exportável em PDF ou link pra equipe
- **Roteiro, decupagem e shot list**
- **Briefing do cliente**

### O que dá pra reaproveitar do Carro do Freela

O protótipo do Carro do Freela já tem desenhados:

- orçamento e proposta timbrada
- ordem do dia e boletim de câmera
- lista de equipamento do job e kits
- montar equipe com o custo somando
- leitor de roteiro

Vale reaproveitar as ideias e as telas que fizerem sentido.

---

## Dados que já existem (pra semear a plataforma)

### Referências de preço

> Tirado das propostas de 2026 (SERHS e orçamento de evento). **Confirmar com o Edu antes de virar padrão.**

| Item | Valor |
| --- | --- |
| Pacote 2 diárias, só vídeo | R$ 3.500 |
| Pacote 2 diárias, foto + vídeo | R$ 5.000 |
| Pacote 4 diárias, só vídeo | R$ 6.000 |
| Pacote 4 diárias, foto + vídeo | R$ 8.000 |
| Diária extra | R$ 2.500 |
| Deslocamento Natal → Pipa | R$ 200 por ida |
| Evento de 3 dias e meio, completo (bruto, institucional, tempo real, drone e foto) | R$ 35.000 |
| Evento de 3 dias e meio, brutos + aftermovie | R$ 19.000 |

**Referência de entrega nos pacotes SERHS:** até 2 vídeos de até 60" por diária, que podem ser desmembrados em 15, 20, 30 e 45".

### Valores de freela praticados

> Da planilha "Gestão de freelancers (pagamento)", maio a julho de 2026.

| Trabalho | Faixa |
| --- | --- |
| Edição | R$ 600 a R$ 1.000 |
| Captação sem câmera | R$ 400 a R$ 1.000 |
| Captação com câmera | R$ 1.000 a R$ 1.500 |
| Edição + captação (pacote) | R$ 500 a R$ 1.000 |
| Ajuste de finalização | R$ 100 |

**Colunas da planilha:** data, freela, trabalho, tipo, projeto, início, prazo, entrega, valor, pago, a pagar, observação. O módulo de freelas precisa cobrir tudo isso.

### Clientes

SERHS (Grand Hotel, Beach e Pipa), SESI/FIEPB, SUDECO e Quartzo Soluções em Audiovisual.

---

## Pendências

- [ ] **Referências de UI/UX** (o Victor vai mandar)
- [ ] **Melhores vídeos:** lista, onde estão hospedados e a categoria de cada um
- [ ] **Nomes finais das categorias** do portfólio
- [ ] **Equipe:** nomes, funções, fotos e uma frase
- [ ] **Número de WhatsApp** que recebe os orçamentos
- [ ] **Domínio** do site
- [ ] **Logo em vetor e arquivos das fontes** da IDV
- [ ] **Absolute ZRO:** entra no site agora ou depois? Tem identidade própria?
- [ ] **Logos dos clientes** que podem aparecer no site
- [ ] **Escopo da área interna:** a planilha de freelas tem vários casamentos. Eles entram na plataforma da ZRO ou são de outra marca?
- [ ] **Impostos:** alíquota do Simples e como o Edu controla hoje

## Ordem sugerida

1. **Site público + funil do WhatsApp:** coloca a ZRO no ar e já começa a gerar leads
2. **Área interna, base:** CRM, orçamentos com timbrado, banco de freelas e financeiro
3. **Área interna, operação:** agenda, etapas dos projetos, ordem do dia, checklists e modelos

## Stack (proposta, a decidir depois das referências)

- **Next.js + TypeScript + Tailwind:** site rápido, bom pra SEO e pra animações de rolagem
- **Supabase:** banco de dados, login e arquivos, com acesso restrito aos dois sócios
- **Vimeo** pros vídeos
- **PDF dos orçamentos** gerado pelo próprio sistema
- **Hospedagem na Vercel**
