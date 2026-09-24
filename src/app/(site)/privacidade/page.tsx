import type { Metadata } from "next";
import { getSetting } from "@/lib/settings";

export const metadata: Metadata = {
  title: "Privacidade",
  description: "Como a ZRO trata os dados enviados pelo site.",
};

export const revalidate = 3600;

export default async function PrivacidadePage() {
  const company = await getSetting("company");

  return (
    <div className="container-zro pt-36 pb-32 sm:pt-44">
      <div className="mx-auto max-w-2xl">
        <p className="label mb-6 text-mute">Privacidade</p>
        <h1 className="text-h2 text-white">Como cuidamos dos seus dados</h1>
        <div className="mt-12 grid gap-10 text-base leading-relaxed text-ash [&_h2]:mb-3 [&_h2]:text-body-lg [&_h2]:font-medium [&_h2]:text-light">
          <section>
            <h2>Quem somos</h2>
            <p>
              {company.legalName}
              {company.cnpj ? `, CNPJ ${company.cnpj}` : ""}, com sede em Natal/RN, é a responsável (controladora) pelos
              dados enviados por este site, nos termos da Lei Geral de Proteção de Dados (Lei 13.709/2018).
            </p>
          </section>
          <section>
            <h2>Quais dados coletamos</h2>
            <p>
              Quando você pede um orçamento, guardamos o que você preencher: nome, forma de contato, empresa e os
              detalhes do projeto (tipo, datas, diárias, vídeos, faixa de investimento e a ideia).
            </p>
          </section>
          <section>
            <h2>Para que usamos</h2>
            <p>
              Só para responder ao seu pedido, preparar a proposta e conversar sobre o projeto. A base legal é o seu
              consentimento e os procedimentos preliminares a um contrato que você pediu.
            </p>
          </section>
          <section>
            <h2>Com quem compartilhamos</h2>
            <p>
              Com ninguém para fins comerciais. Ao final do formulário, a conversa continua no WhatsApp, e a mensagem
              passa pelo serviço da Meta, sujeita à política de privacidade dela.
            </p>
          </section>
          <section>
            <h2>Por quanto tempo guardamos</h2>
            <p>
              Enquanto for necessário para atender ao pedido e cumprir obrigações legais. Depois disso, os dados são
              apagados ou anonimizados.
            </p>
          </section>
          <section>
            <h2>Seus direitos</h2>
            <p>
              Você pode pedir acesso, correção, portabilidade ou exclusão dos seus dados, e revogar o consentimento a
              qualquer momento, pelo e-mail{" "}
              <a className="text-light underline decoration-white/30 underline-offset-4" href={`mailto:${company.email}`}>
                {company.email}
              </a>
              .
            </p>
          </section>
          <section>
            <h2>Cookies</h2>
            <p>
              O site não usa cookies de rastreamento nem de publicidade. Existe apenas um cookie técnico de sessão na
              área interna, usada pelos sócios da ZRO.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
