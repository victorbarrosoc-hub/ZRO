import Link from "next/link";
import { Logo } from "@/components/brand/logo";
import { getSetting } from "@/lib/settings";
import { whatsappDigits } from "@/lib/format";

export async function SiteFooter() {
  const [company, whatsapp] = await Promise.all([getSetting("company"), getSetting("whatsapp")]);
  const wa = whatsappDigits(whatsapp.number);
  const year = new Date().getFullYear();

  return (
    <footer className="relative overflow-hidden border-t border-line pt-20" id="contato">
      <div className="container-zro relative">
        <div className="grid gap-12 md:grid-cols-12">
          <div className="md:col-span-5">
            <p className="label mb-5 text-mute">Contato</p>
            <p className="max-w-md text-title text-white">
              Toda história começa do zero.
            </p>
            <Link
              href="/orcamento"
              className="mt-8 inline-flex h-12 items-center rounded-full bg-white px-6 text-ui font-medium text-void transition-colors hover:bg-light"
            >
              Começar um projeto
            </Link>
          </div>

          <div className="grid gap-10 sm:grid-cols-3 md:col-span-7">
            <div>
              <p className="label mb-4 text-mute">Fale com a gente</p>
              <ul className="grid gap-2.5 text-ui text-ash">
                {wa ? (
                  <li>
                    <a className="transition-colors hover:text-white" href={`https://wa.me/${wa}`} target="_blank" rel="noreferrer">
                      WhatsApp
                    </a>
                  </li>
                ) : null}
                {company.email ? (
                  <li>
                    <a className="break-all transition-colors hover:text-white" href={`mailto:${company.email}`}>
                      {company.email}
                    </a>
                  </li>
                ) : null}
                {company.instagram ? (
                  <li>
                    <a
                      className="transition-colors hover:text-white"
                      href={`https://instagram.com/${company.instagram.replace(/^@/, "")}`}
                      target="_blank"
                      rel="noreferrer"
                    >
                      @{company.instagram.replace(/^@/, "")}
                    </a>
                  </li>
                ) : null}
                {company.youtube ? (
                  <li>
                    <a className="transition-colors hover:text-white" href={company.youtube} target="_blank" rel="noreferrer">
                      YouTube
                    </a>
                  </li>
                ) : null}
              </ul>
            </div>
            <div>
              <p className="label mb-4 text-mute">Navegue</p>
              <ul className="grid gap-2.5 text-ui text-ash">
                <li><Link className="transition-colors hover:text-white" href="/filmes">Filmes</Link></li>
                <li><Link className="transition-colors hover:text-white" href="/sobre">Sobre</Link></li>
                <li><Link className="transition-colors hover:text-white" href="/absolute">Absolute ZRO</Link></li>
                <li><Link className="transition-colors hover:text-white" href="/orcamento">Orçamento</Link></li>
              </ul>
            </div>
            <div>
              <p className="label mb-4 text-mute">Onde estamos</p>
              <p className="text-ui leading-relaxed text-ash">Natal · Rio Grande do Norte · Brasil</p>
            </div>
          </div>
        </div>

        <div className="mt-20 flex flex-wrap items-center justify-between gap-4 border-t border-line pt-6 text-caption text-mute">
          <p>
            © {year} {company.legalName}
            {company.cnpj ? ` · CNPJ ${company.cnpj}` : ""}
          </p>
          <div className="flex items-center gap-5">
            <Link href="/privacidade" className="transition-colors hover:text-light">
              Privacidade
            </Link>
            <Link href="/entrar" className="transition-colors hover:text-light">
              Área interna
            </Link>
          </div>
        </div>
      </div>

      <div className="relative mt-10 select-none" aria-hidden>
        <div className="container-zro">
          <Logo className="h-auto w-full translate-y-[18%] text-white/[0.06]" />
        </div>
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-void to-transparent" />
      </div>
    </footer>
  );
}
