import type { Metadata } from "next";
import { InfoList } from "@/components/painel/bits";
import { Card, CardHeader, PageHeader } from "@/components/ui/surface";
import { requireUser } from "@/lib/auth/dal";
import { dateTimeBR } from "@/lib/format";
import { getAccount } from "@/lib/queries/admin-content";
import { ChangePasswordForm } from "../account-form";
import { AjustesTabs } from "../ajustes-tabs";

export const metadata: Metadata = { title: "Minha conta" };

export default async function ContaPage() {
  const user = await requireUser();
  const account = await getAccount(user.id);

  return (
    <div className="grid gap-8">
      <PageHeader label="Ajustes" title="Minha conta" />
      <AjustesTabs active="conta" />

      <div className="grid gap-4 xl:grid-cols-12 xl:items-start">
        <Card className="xl:col-span-7">
          <CardHeader title="Trocar senha" />
          <ChangePasswordForm email={user.email} />
        </Card>
        <Card className="xl:col-span-5">
          <CardHeader title="Conta" />
          <div className="px-5 pb-2 sm:px-6">
            <InfoList
              items={[
                { label: "Nome", value: user.name },
                { label: "E-mail de acesso", value: user.email },
                { label: "Último login", value: account?.lastLoginAt ? dateTimeBR(account.lastLoginAt) : "—" },
              ]}
            />
          </div>
        </Card>
      </div>
    </div>
  );
}
