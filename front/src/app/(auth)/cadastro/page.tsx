import type { Metadata } from "next";
import SignupForm from "./ui";

export const metadata: Metadata = { title: "Criar conta" };

export default function SignupPage() {
  return (
    <>
      <div>
        <h1 className="font-display text-3xl text-navy">Criar conta</h1>
        <p className="text-sm text-muted-foreground">Leva menos de um minuto.</p>
      </div>
      <SignupForm />
    </>
  );
}
