# Identidade visual — leitura dos arquivos

Leitura técnica dos materiais que o Victor mandou (logo, story e vídeo manifesto).
O conceito e as regras da marca estão em `documento-mestre.md`, que tem prioridade sobre este arquivo.

## Arquivos

| Arquivo | O que é |
| --- | --- |
| `brand/logo/zro-logo-cinza-transparente.webp` | Logo oficial, cinza claro `#D2D2D2` sobre fundo transparente (2000×1200, logo ocupa ~916×328 no centro). Feito pra fundo escuro. |
| `brand/referencias/manifesto-zro.mp4` | Filme manifesto da marca (34s, 1280×720, com áudio). |
| `brand/referencias/story-contando-historias.webp` | Story 9:16 "Contando histórias que não aceitam ser comuns" com a assinatura "Made by ZRO". |
| `brand/referencias/frames/` | Quadros-chave do manifesto (ponto de luz, rastro de estrelas, símbolo O, logo surgindo, logo final). |

**Falta:** logo em vetor (SVG/AI), versão preta pra fundo claro e arquivos das fontes. A identidade da Absolute ZRO foi **escolhida pelo Victor** a partir de um board de referência (seção no fim deste arquivo).

## Logo

- **"ZR"** em sans geométrica pesada, com cantos retos
- **"O"** é um símbolo: quadrado de cantos arredondados com um círculo vazado no centro. É o zero, o ponto de origem e também lembra uma lente ou um sensor.
- O símbolo funciona sozinho: avatar, favicon, loader, marca d'água e transições.
- No manifesto, o logo nasce de um clarão de luz com partículas e depois assenta limpo, sem efeito.

## Cores (medidas nos arquivos)

| Papel | Valor | Onde aparece |
| --- | --- | --- |
| Preto de fundo | `#050505` a `#0D0D0D` | fundo do story e do vídeo (nunca `#000` chapado, sempre com grão e vinheta) |
| Cinza do logo | `#D2D2D2` | logo oficial |
| Branco luz | `#E6E6E6` a `#FFFFFF` | legendas, clarões, logo no vídeo |
| Azul | `#2D7BFF` (azul Absolute) | cor conceitual da **Absolute ZRO** (zero absoluto, frio, precisão). Ver a seção Absolute ZRO |

Regra do documento-mestre: preto e branco é a base. Cor só entra com intenção narrativa.

## Tipografia observada

- **Legendas do manifesto:** sans-serif em negrito, pequena, centralizada no terço inferior. Limpa e discreta.
- **Assinatura do story ("Onde tudo começa e o comum termina.")**: sans geométrica em caixa alta, negrito, em duas linhas ao lado do logo.
- **Frase do story:** cada palavra num estilo diferente (serifada vazada, pixel/bitmap, grotesca larga, letras distorcidas em onda, letras metade cheias e metade vazadas). É a ideia do "comum" sendo transformado. **Uso pontual e expressivo**, não é a fonte do dia a dia.
- **Selo "MADE BY"**: texto fino dentro de uma cápsula com contorno, acompanhado de dois ícones em linha (globo e estrela/bússola).
- **Nomes das fontes:** a confirmar com quem fez a IDV (pedir os arquivos).

## Textura e luz

- **Grão** em tudo, fino e uniforme, como se fosse parte da fotografia
- **Vinheta** leve e um degradê sutil a partir do centro
- A luz sempre **revela** alguma coisa: ponto, halo, clarão, feixe, partículas

## Linguagem de movimento (manifesto)

Sequência do filme, que resume o conceito "escuridão → luz → contraste → forma → direção → expressão":

1. Tela preta com um **ponto de luz** mínimo ("Tudo começa do zero.")
2. **Explosão** radial em preto e branco ("Até que a luz atravessa a escuridão.")
3. Forma orgânica, **halo** e partículas ("Sem forma. Sem cor. Sem direção.")
4. **Rastro de estrelas** circular ("E do contraste nasce a forma.")
5. Luz atravessando uma superfície e o **olho** em close ("No ponto exato onde intenção vira direção.")
6. Planeta/lente e o **símbolo O** com a luz no centro ("E deixa de existir… o comum.")
7. **Logo** surge com flare e assenta ("ZRO / Onde tudo começa e o comum termina.")

Ritmo lento e contemplativo, com cortes marcados pelo texto.

## O que isso sugere pro site (proposta, a validar com as referências de UI)

- **Escuro por padrão**, com muito espaço negativo e grão sutil por cima de tudo
- **Hero com o filme manifesto** (ou um trecho em loop) e o texto entrando frase por frase
- **Círculo e ponto de luz** como elementos de interface: cursor, loader, indicadores, transições entre páginas
- **"A luz revela"** como regra de animação: o conteúdo aparece iluminado conforme a rolagem, em vez de deslizar
- **Tipografia limpa** no site inteiro e a tipografia expressiva do story só em momentos de manifesto
- Os cases com cor aparecem sobre a base preto e branco: "preto e branco é origem, cor é expressão"

## Absolute ZRO: identidade (escolhida pelo Victor)

Referência: `brand/absolute-zro/referencia-board.png` (o Victor pediu "igual, é essa logo e essas cores"). A página `/absolute` é a réplica do board, adaptada para o site.

- **Logo:** o arquivo original do Victor é a referência: `brand/absolute-zro/logo-original.png`. "Λ B S O L U T E" fino e bem espaçado (o A sem travessão), o **ZR próprio da Absolute** (grosso, o R sem haste) e o **anel** fino azul-claro, aceso à direita com o ponto de luz. O site usa essa imagem tal qual no topo da `/absolute` e no cartão da home (`public/media/absolute/logo.png`); o vetor em `absolute-logo.tsx` reproduz as mesmas medidas para os tamanhos pequenos.
- **Assinatura de apoio:** COLOR GRADING & FINISHING (Montserrat, caixa alta, espaçada). Frase: "Do bruto ao absoluto."
- **Símbolos:** Eclipse (mistério, origem), Lente (precisão, controle) e Absolute Ring (estado final).
- **Avatar do Instagram:** `brand/absolute-zro/avatar-instagram.png` (1080×1080). É o Absolute Ring do board, redesenhado com as medidas do original: núcleo branco-gelo, azul em volta, brilho forte para dentro, mais azul do lado direito. O anel ocupa 57% do quadro e o brilho some antes da borda, então o recorte redondo do Instagram não corta nada.
- **Paleta:** preto `#000000`, azul profundo `#0B1F2D`, azul Absolute `#2D7BFF` (5,4:1 sobre o preto, serve para texto), branco frio `#F5F7FA`.
- **Tipografia:** Montserrat Light + Medium (token `font-absolute`). O resto do site segue com Inter.
- **Código:** `src/components/brand/absolute-logo.tsx` (`AbsoluteLogo` horizontal/empilhado, `AbsoluteSymbol`, `AbsoluteEclipse`, `AbsoluteLens`). O anel sempre usa `--color-abs-blue`; o resto usa `currentColor`. Em tamanhos pequenos ou impressão, `glow={false}`.
- **Imagens:** só a arte da marca, recortada do board: eclipse e paisagem (`public/media/absolute/`). **Sem mockups** (estúdio, porta, moletom, caderno, cartão, perfil de Instagram): o Victor não quer mostrar o que a ZRO não tem de verdade.

Histórico: antes do board houve duas rodadas de propostas (|ZRO| com azul Kelvin e ABSOLUTE by ZRO), descartadas pelo Victor.
