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

**Falta:** logo em vetor (SVG/AI), versão preta pra fundo claro e arquivos das fontes. A identidade da Absolute ZRO tem uma proposta **provisória** (seção no fim deste arquivo), aguardando o Victor.

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
| Azul | `#8AB0FF` (provisório, paleta Kelvin) | cor conceitual da **Absolute ZRO** (zero absoluto, frio, precisão). Ver a seção Absolute ZRO |

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

## Absolute ZRO: logo e cor (proposta provisória, aguardando o Victor)

Feito em 25/09/2026 a partir das seções 29 a 32 do documento-mestre: zero absoluto (−273,15 °C / 0 K), estado final da imagem, precisão, frio, silêncio, azul como cor conceitual. Regras seguidas: usar **sempre o logo real da ZRO** (os paths de `src/components/brand/logo.tsx`, sem redesenhar letra), poucas formas e nada de clichê de tecnologia, degradê ou neon.

Pranchas de apresentação (fora do repositório, no scratchpad da sessão): `prancha-logos.png` (as 3 propostas sobre preto e sobre branco, grande e em 32 px) e `prancha-cores.png` (as 3 paletas num frame de filme, num cartão e no avatar).

### As 3 propostas de logo

Cada uma tem versão horizontal, empilhada e símbolo.

| # | Nome | Ideia | Símbolo |
| --- | --- | --- | --- |
| 01 | **Ponto** | O ponto de luz do manifesto parado no centro do zero ("o símbolo O com a luz no centro"). No zero absoluto tudo repousa. "ABSOLUTE" em Inter 400, espaçado, sobre ou ao lado do ZRO. | O "O" da ZRO com um ponto azul no centro |
| 02 | **Módulo** | As barras do valor absoluto da matemática: \|0\| = 0. O logo da ZRO fica intacto entre dois traços azuis exatos, a moldura que define o estado final. "ABSOLUTE" em Geist Mono 500 (a fonte técnica dos rótulos do site). | \|O\|: o "O" da ZRO entre as barras |
| 03 | **Corte** | O wipe do antes e depois do color: metade do zero em preto e branco (a origem), metade no azul (a finalização), separadas por uma fresta fina. "Do bruto ao absoluto" num só corte. | O "O" da ZRO dividido ao meio, metade azul |

Descartadas no caminho: anel fino com ponto (lê como botão de rádio), vetorscópio com ponteiros (lê como relógio), linha de flare atravessando o zero (em 32 px vira placa de "proibido").

### As 3 paletas

Cada paleta: azul principal, tom profundo e tom de brilho, sempre sobre o preto `#050505` e o branco `#F2F2F0` da ZRO. Contraste WCAG 2.x do principal.

| Paleta | Principal | Profundo | Brilho | Principal sobre `#000` / `#050505` | Leitura |
| --- | --- | --- | --- | --- | --- |
| **Kelvin** (luz fria de temperatura de cor muito alta) | `#8AB0FF` | `#17336E` | `#DCE8FF` | 9,73:1 / 9,45:1 → **texto pequeno OK (AA)** | parece luz, não tinta; no claro o logo usa o profundo (10,80:1) |
| **Noite** (noite americana) | `#3561E8` | `#0A1640` | `#9DB4FF` | 4,03:1 / 3,91:1 → **só texto grande (≥ 24 px) e formas** | densa e cinematográfica; é a única cujo principal funciona como texto no claro (4,65:1) |
| **Scope** (ciano do traço do scope) | `#38C4EE` | `#07364A` | `#C6F3FF` | 10,30:1 / 10,00:1 → **texto pequeno OK (AA)** | a mais técnica, a que mais encosta no clichê de tecnologia |

### O que foi aplicado como provisório

- **Logo 02 Módulo + paleta Kelvin.** O Módulo mantém o logo da ZRO inteiro, lê bem em 32 px, o avatar se distingue do da ZRO sem sair da família e as barras podem virar sistema (emoldurar frames, títulos, antes e depois). A Kelvin é a que mais conversa com o ponto de luz e o grão da ZRO, e o mesmo azul serve para logo e texto no fundo escuro.
- Componente: `src/components/brand/absolute-logo.tsx` (`AbsoluteLogo` com `variant="horizontal" | "stacked"` e `AbsoluteSymbol`). Base em `currentColor`; barras em `text-abs-blue`. No claro, passar `accentClassName="text-abs-deep"`.
- Tokens: `--color-abs-blue`, `--color-abs-deep` e `--color-abs-ice` em `src/app/globals.css` e `tokens.md` (os nomes já existiam; só os valores mudaram).
- Onde aparece: herói, cabeçalho da tabela ZRO × Absolute e assinatura final de `/absolute`; cartão da Absolute na home (`src/components/site/home/sections.tsx`). No rodapé, "Absolute ZRO" continua como texto porque é um item de lista de navegação.
- **Para trocar de proposta:** as outras duas estão desenhadas nas pranchas com a mesma geometria (ZRO em 914 × 327). Trocar a paleta é só mudar os três valores de token.

