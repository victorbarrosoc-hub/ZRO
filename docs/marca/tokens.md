# Tokens: ZRO

Tokens de design do site e da área interna. A implementação fica em `src/app/globals.css` (variáveis CSS + tema do Tailwind).
Qualquer valor novo nasce aqui primeiro.

## Cor

### Base (preto e branco)

| Token | Valor | Uso |
| --- | --- | --- |
| `--void` | `#050505` | fundo da página (o vazio) |
| `--ink` | `#0B0B0B` | superfície 1 (seções, sidebar) |
| `--graphite` | `#121212` | superfície 2 (cartões) |
| `--smoke` | `#1A1A1A` | superfície 3 (hover, campos) |
| `--line` | `rgb(255 255 255 / 0.08)` | filetes e divisórias |
| `--line-strong` | `rgb(255 255 255 / 0.16)` | bordas de campo e cápsulas |
| `--dim` | `#1f1f1f` | texto do manifesto antes da luz (estado apagado) |
| `--mute` | `#858585` | texto terciário (contraste mínimo 4,5:1 até sobre `--smoke`) |
| `--ash` | `#A3A3A3` | texto secundário |
| `--light` | `#E6E6E6` | texto principal |
| `--white` | `#FFFFFF` | luz: destaques, halo, estado ativo |
| `--logo` | `#D2D2D2` | cor do logo oficial |

### Seção invertida ("a luz")

| Token | Valor |
| --- | --- |
| `--paper` | `#F2F2F0` |
| `--paper-ink` | `#0B0B0B` |
| `--paper-mute` | `#5C5C5C` |

### Absolute ZRO: paleta do board (escolhida pelo Victor)

| Token | Valor | Papel | Uso |
| --- | --- | --- | --- |
| `--abs-blue` | `#2D7BFF` | azul Absolute | o anel do logo, símbolos, destaques, títulos em azul |
| `--abs-deep` | `#0B1F2D` | azul profundo | fundos, faixas e superfícies |
| `--abs-ice` | `#F5F7FA` | branco frio | texto e botão claro nas telas da Absolute |
| `--font-absolute` | Montserrat | tipografia | logo, assinatura e rótulos espaçados (Light 300, Medium 500) |

Contraste (WCAG 2.x):

- `--abs-blue` sobre `#000`: **5,4:1** → serve para texto (AA)
- `--abs-ice` sobre `--abs-deep`: 16:1

Regra: o azul é da Absolute ZRO. Fora das telas da Absolute, a ZRO continua preto e branco.

### Status (só na área interna)

| Token | Valor | Significado |
| --- | --- | --- |
| `--ok` | `#5FBF8A` | recebido, pago, concluído |
| `--warn` | `#D9A441` | pendente, a vencer |
| `--danger` | `#E5484D` | atrasado, recusado, perdido |

Status sempre com texto junto. Cor nunca é o único sinal.

## Tipografia

| Família | Uso |
| --- | --- |
| **Inter** (variável, com eixo óptico) | títulos, texto e interface |
| **Instrument Serif** itálico | acento raro em uma palavra de título |
| **Geist Mono** | rótulos pequenos em caixa alta, números de etapa, códigos |

| Token | Tamanho | Entrelinha | Espaçamento |
| --- | --- | --- | --- |
| `display` | `clamp(56px, 10vw, 168px)` | 0.9 | -0.045em |
| `h1` | `clamp(40px, 6vw, 96px)` | 0.95 | -0.04em |
| `h2` | `clamp(30px, 3.6vw, 56px)` | 1.02 | -0.035em |
| `h3` | `clamp(20px, 1.8vw, 28px)` | 1.2 | -0.02em |
| `title` | `clamp(24px, 2.6vw, 40px)` | 1.05 | -0.035em |
| `manifesto` | `clamp(36px, 6.4vw, 104px)` | 1.0 | -0.04em |
| `body-lg` | `19px` | 1.55 | -0.005em |
| `body` | `16px` | 1.6 | 0 |
| `ui` | `15px` | 1.5 | 0 |
| `small` | `14px` | 1.5 | 0 |
| `caption` | `13px` | 1.45 | 0 |
| `label` | `11px`, mono, caixa alta | 1.4 | 0.16em |

Exceções documentadas: texto do selo circular (SVG, 12,5px) e iniciais decorativas da equipe (44px).

## Espaço e forma

- **Grade de 4px.** Espaços usados: 4, 8, 12, 16, 24, 32, 48, 64, 96, 128, 192
- **Seções:** `clamp(96px, 14vw, 192px)` de respiro vertical
- **Contêiner:** até 1440px, margem lateral de 20px no celular, 32px no tablet e 48px no desktop
- **Raios:** cápsula `999px` · moldura de filme `28px` (`media`) · cartão `24px` · miniatura `16px` · campo `14px`
- **Bordas:** sempre 1px, com `--line` ou `--line-strong`

## Luz, grão e movimento

- **Grão:** ruído SVG sobre a página inteira, opacidade 0,07, levemente animado (parado quando o sistema pede menos movimento)
- **Halo:** `radial-gradient` branco de 6% a 0% atrás do que está sendo revelado
- **Curva padrão:** `cubic-bezier(0.16, 1, 0.3, 1)`
- **Durações:** 200ms (interação), 500ms (entrada de elemento), 1200ms (revelação de seção)
- **Revelação ("a luz revela"):** o elemento entra saindo do desfoque (8px → 0) e do cinza para o branco, sem deslizar muito (máximo 24px)
- **Menos movimento:** com `prefers-reduced-motion`, tudo aparece sem animação e os vídeos não tocam sozinhos
