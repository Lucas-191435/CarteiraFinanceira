import { redirect } from "next/navigation";
import { PublicRoutes } from "@/constants/routes";

// Sem landing: o proxy.ts já manda "/" para /login (ou /carteira, se houver sessão).
// Este redirect é só o fallback caso o proxy não rode.
export default function Home() {
  redirect(PublicRoutes.login);
}
