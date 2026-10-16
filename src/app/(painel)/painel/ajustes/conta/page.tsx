import type { Metadata } from "next";
import { InfoList } from "@/components/painel/bits";
import { Card, CardHeader, PageHeader } from "@/components/ui/surface";
import { requireUser } from "@/lib/auth/dal";
import { dateTimeBR } from "@/lib/format";
import { getAccount } from "@/lib/queries/admin-content";
import { ChangeEmailForm, ChangePasswordForm, ProfileForm } from "../account-form";
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
        <div className="grid gap-4 xl:col-span-7">
          <Card>
            <CardHeader title="Perfil" />
            <ProfileForm name={user.name} photoId={user.photoId} />
          </Card>
          <Card>
            <CardHeader title="E-mail de acesso" />
            <ChangeEmailForm email={user.email} />
          </Card>
          <Card>
            <CardHeader title="Trocar senha" />
            <ChangePasswordForm email={user.email} />
          </Card>
        </div>
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
