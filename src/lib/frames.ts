/**
 * Frames reais de trabalhos da ZRO (enviados pelo Victor), em public/media/frames.
 * Para um frame novo: salve o JPG (2400px de largura) na pasta e acrescente aqui.
 * Só entra trabalho de verdade: nada gerado por IA nem mockup.
 */
export type Frame = {
  src: string;
  width: number;
  height: number;
  alt: string;
  /** Destaque: ocupa mais espaço no mosaico. */
  wide?: boolean;
};

export const FRAMES: Frame[] = [
  { src: "/media/frames/vinho.jpg", width: 2400, height: 1350, alt: "Mulher bebe vinho tinto sob a luz âmbar de um bar", wide: true },
  { src: "/media/frames/coca-cola.jpg", width: 1687, height: 1284, alt: "Retrato com o neon da garrafa de Coca-Cola ao fundo" },
  { src: "/media/frames/maquiagem.jpg", width: 2400, height: 1021, alt: "Modelo com pincel de maquiagem no camarim, noivas ao fundo" },
  { src: "/media/frames/cavalo.jpg", width: 2400, height: 1350, alt: "Silhueta de mulher e cavalo contra o sol da tarde" },
  { src: "/media/frames/show.jpg", width: 2400, height: 1021, alt: "Cantora no palco, em preto e branco, apontando para o público", wide: true },
];
