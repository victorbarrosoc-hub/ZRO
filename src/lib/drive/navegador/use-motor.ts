"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { criarMotor, FOTO_VAZIA, type Foto, type Motor, type OpcoesMotor } from "./motor";

/**
 * O motor de envio numa tela (painel, freela, cliente). Um motor por componente; a foto redesenha no
 * máximo 5 vezes por segundo. Desmontar a tela pausa os envios e guarda o registro de retomada.
 *
 *   const { motor, foto } = useMotor({ transporte: transporteDaRota("/painel/arquivos/api"), escopo: "painel", voz: "painel" });
 */
export function useMotor(opcoes: OpcoesMotor): { motor: Motor; foto: Foto } {
  // As opções valem na criação (trocar de link = outra tela, outro motor).
  const [motor] = useState(() => criarMotor(opcoes));
  useEffect(() => () => motor.destruir(), [motor]);
  const foto = useSyncExternalStore(motor.assinar, motor.foto, () => FOTO_VAZIA);
  return { motor, foto };
}
