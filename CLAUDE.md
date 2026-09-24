# ZRO: contexto do projeto

Este repositório vai virar **o site da ZRO e a plataforma interna da produtora**.

Antes de propor ou construir qualquer coisa, leia:

1. `docs/marca/documento-mestre.md`: a fonte de verdade da marca (conceito, manifesto, tom de voz, regras)
2. `docs/briefing.md`: o que o site e a área interna precisam ter, dados que já existem e pendências
3. `docs/marca/identidade-visual.md`: leitura técnica do logo, das cores, da tipografia e do filme manifesto

## Quem é a ZRO

- **ZRO Produção Audiovisual LTDA**, nome de marca **ZRO Filmes**, em Natal/RN. Instagram: **@zrofilmes**
- Produtora audiovisual e criativa, **autoral e cinematográfica**: filmes de marca, campanhas, conteúdo, documental e direção criativa
- "ZRO" é o **zero**: origem, o ponto antes da forma
- **Assinatura oficial:** "Onde tudo começa e o comum termina."
- **Absolute ZRO:** o braço de finalização e color grading, com o azul como cor conceitual

## Sócios

- **Victor Barroso:** criativo. Está nas produções e cuida do nível de qualidade da entrega. É quem conversa com o Claude aqui.
- **Edu Cardoso** (Eduardo Rocha Cardoso): administrativo e financeiro. Cuida da parte burocrática: propostas, notas, certidões e contratos.
- A área interna da plataforma é **só para os dois**.

## Regras de marca que valem pra qualquer texto ou tela

- **Base preto e branco**, alto contraste, grandes áreas negativas, grão sutil, círculo e ponto de luz. Cor só com intenção narrativa.
- **Tom:** conceitual mas compreensível, sofisticado mas humano, poético sem ser abstrato demais, seguro sem arrogância. Frases curtas e fortes.
- **Não parecer:** genérico, infantil, corporativo demais, publicitário demais ou "videomaker de evento"
- **Manifesto e frases-chave:** usar exatamente como estão no documento-mestre
- "Histórias que não aceitam ser comuns" é frase **pra usar com moderação**

## Como trabalhar com o Victor

- Responder em **português do Brasil**, direto ao ponto, com tópicos e negrito pra leitura rápida
- Tom natural e humano, sem jargão corporativo
- Evitar clichês de IA ("revolucionário", "mergulhar profundamente", "crucial")
- Ao pedir títulos, textos ou ideias, oferecer **pelo menos 3 variações**
- Ele também criou o **Carro do Freela** (plataforma de freelas do audiovisual de Natal). A área interna da ZRO conversa com o que o Carro do Freela já tem desenhado.

## Clientes que já aparecem nos arquivos

- **SERHS** (Grand Hotel, Beach e Pipa): conteúdo para hotelaria, com negociação de contrato recorrente em 2027
- **SESI/FIEPB:** projeto Nordeste Criativo
- **SUDECO:** vídeo institucional e "Caravana"
- **Quartzo Soluções em Audiovisual**
- A ZRO fez **adequação à LGPD** (Sebrae/FUNCERN). Dados de clientes e freelas precisam respeitar isso.

## Status

- [x] Contexto, documento-mestre, identidade visual e briefing registrados
- [ ] Referências de UI/UX (o Victor vai mandar)
- [ ] Definir a stack e começar pelo site público + funil do WhatsApp
- [ ] Área interna (CRM, orçamentos, freelas, financeiro, agenda, processos)

**Não começar a construir telas antes de receber as referências visuais.**

## Estrutura

```
brand/
  logo/          logo oficial (cinza claro, fundo transparente)
  referencias/   filme manifesto, story da marca e quadros-chave do filme
docs/
  briefing.md    site + área interna: escopo, dados existentes, pendências
  marca/
    documento-mestre.md   texto oficial da marca
    identidade-visual.md  cores, tipografia, textura e movimento
```
