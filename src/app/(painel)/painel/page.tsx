import { requireUser } from "@/lib/auth/dal";

export default async function PainelPage() {
  const user = await requireUser();
  return <main className="p-10 text-light">Olá, {user.name}.</main>;
}
