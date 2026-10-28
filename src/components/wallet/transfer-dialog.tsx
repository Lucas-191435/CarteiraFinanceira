"use client";

import { useState, useTransition } from "react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { AlertCircle, Send } from "lucide-react";
import { toast } from "sonner";
import { searchRecipientsAction, transferAction } from "@/actions/wallet";
import { Field } from "@/components/forms/field";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { SIMULATE_STATUS_FIELD } from "@/constants/error-simulator";
import { applyServerFieldErrors } from "@/hooks/use-server-field-errors";
import { brl } from "@/lib/format";
import { maskCurrency, parseAmount } from "@/lib/money";
import { uuid } from "@/lib/uuid";
import type { IRecipient } from "@/types/IUser";
import { transferFormSchema, type TransferInput } from "@/validations/wallet";
import { ActionCard } from "./action-card";
import { type ErrorScenario, ErrorSimulator } from "./error-simulator";
import { RecipientCombobox } from "./recipient-combobox";

/**
 * Dois passos: dados → confirmação. O destinatário vem de um select pesquisável (nome ou e-mail),
 * o valor tem máscara de moeda e não pode passar do saldo. A API valida tudo de novo.
 */
export function TransferDialog({ balance, errorSimulator = false }: { balance: string; errorSimulator?: boolean }) {
  const [open, setOpen] = useState(false);
  const [recipient, setRecipient] = useState<IRecipient | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [idempotencyKey, setIdempotencyKey] = useState("");
  const [message, setMessage] = useState<string>();
  const [isPending, startTransition] = useTransition();

  const form = useForm<TransferInput>({
    resolver: zodResolver(transferFormSchema(balance)),
    // onChange: o aviso de saldo insuficiente aparece enquanto a pessoa digita
    mode: "onChange",
    defaultValues: { toEmail: "", amount: "", description: "" },
  });
  const { errors } = form.formState;

  const onOpenChange = (next: boolean) => {
    if (next) {
      // Nova chave a cada abertura: duplo clique/reenvio mandam a mesma e a API não duplica
      setIdempotencyKey(uuid());
      setRecipient(null);
      setConfirming(false);
      setMessage(undefined);
      form.reset();
    }
    setOpen(next);
  };

  const onContinue = form.handleSubmit(() => {
    setMessage(undefined);
    setConfirming(true);
  });

  const send = (values: TransferInput, simulateStatus?: number, resolveRecipient?: () => Promise<IRecipient | null>) => {
    startTransition(async () => {
      let toEmail = values.toEmail;
      if (resolveRecipient) {
        const resolved = await resolveRecipient();
        if (!resolved) {
          setMessage("Nenhum destinatário disponível para o cenário");
          return;
        }
        setRecipient(resolved);
        form.setValue("toEmail", resolved.email);
        toEmail = resolved.email;
      }

      const formData = new FormData();
      formData.set("toEmail", toEmail);
      formData.set("amount", values.amount);
      formData.set("description", values.description ?? "");
      formData.set("idempotencyKey", idempotencyKey);
      if (simulateStatus) formData.set(SIMULATE_STATUS_FIELD, String(simulateStatus));

      const result = await transferAction(undefined, formData);
      if (result?.ok) {
        toast.success(result.message);
        setOpen(false);
        return;
      }
      // Erro de campo (saldo mudou, destinatário) → volta para o passo 1 com o erro no campo
      setConfirming(false);
      applyServerFieldErrors(form, result);
      setMessage(result?.message);
    });
  };

  const onConfirm = () => send(form.getValues());

  /**
   * Simulador: preenche o formulário com os dados do cenário e envia direto para a action, sem a
   * validação do client (que bloquearia 400/422 antes da API). O resultado aparece como um erro real.
   */
  const runScenario = (scenario: ErrorScenario) => {
    setMessage(undefined);
    setConfirming(false);
    setRecipient(scenario.recipient ?? null);
    const values = { toEmail: scenario.recipient?.email ?? "", amount: scenario.amount, description: "" };
    form.reset(values);

    // Sem destinatário fixo: o primeiro da busca, que já exclui o próprio usuário (a API precisa achar
    // o destinatário para chegar ao 422)
    const resolveRecipient = scenario.recipient
      ? undefined
      : async () => {
          const result = await searchRecipientsAction("");
          return result?.ok ? (result.data?.[0] ?? null) : null;
        };

    send(values, scenario.simulateStatus, resolveRecipient);
  };

  const amount = parseAmount(form.getValues("amount") ?? "");
  const description = form.getValues("description");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        <ActionCard icon={Send} title="Transferir" description="Envie para outro usuário Bolt" />
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{confirming ? "Confirmar transferência" : "Transferir"}</DialogTitle>
          <DialogDescription>
            {confirming ? "Confira os dados antes de enviar." : "Escolha quem vai receber e o valor."}
          </DialogDescription>
        </DialogHeader>

        {message && (
          <Alert variant="destructive">
            <AlertCircle />
            <AlertDescription>{message}</AlertDescription>
          </Alert>
        )}

        {confirming && recipient ? (
          <div className="space-y-4">
            <div className="rounded-xl bg-secondary p-4 text-secondary-foreground">
              <p className="text-sm">Você vai enviar</p>
              <p className="font-display text-3xl text-navy">{amount !== null ? brl(amount) : "—"}</p>
              <p className="mt-2 text-sm">
                para <strong>{recipient.name}</strong>
                <span className="block text-muted-foreground">{recipient.email}</span>
              </p>
              {description && <p className="mt-2 text-sm text-muted-foreground">“{description}”</p>}
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setConfirming(false)} disabled={isPending}>
                Voltar
              </Button>
              <Button type="button" onClick={onConfirm} disabled={isPending}>
                {isPending ? "Enviando..." : "Confirmar envio"}
              </Button>
            </DialogFooter>
          </div>
        ) : (
          <form onSubmit={onContinue} noValidate className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="transfer-recipient">Destinatário</Label>
              <Controller
                control={form.control}
                name="toEmail"
                render={({ field }) => (
                  <RecipientCombobox
                    id="transfer-recipient"
                    value={recipient}
                    onChange={(selected) => {
                      setRecipient(selected);
                      field.onChange(selected.email);
                    }}
                    onBlur={field.onBlur}
                    invalid={Boolean(errors.toEmail)}
                    describedBy={errors.toEmail ? "transfer-recipient-error" : undefined}
                  />
                )}
              />
              {errors.toEmail && (
                <p id="transfer-recipient-error" className="text-sm text-destructive">
                  {/* Sem seleção, o e-mail fica vazio e o Zod acusa "E-mail inválido" */}
                  {recipient ? errors.toEmail.message : "Selecione o destinatário"}
                </p>
              )}
            </div>

            <Controller
              control={form.control}
              name="amount"
              render={({ field }) => (
                <Field
                  id="transfer-amount"
                  label="Valor (R$)"
                  inputMode="numeric"
                  placeholder="0,00"
                  autoComplete="off"
                  hint={`Disponível: ${brl(balance)}`}
                  error={errors.amount?.message}
                  name={field.name}
                  ref={field.ref}
                  value={field.value}
                  onBlur={field.onBlur}
                  onChange={(event) => field.onChange(maskCurrency(event.target.value))}
                />
              )}
            />

            <Field
              id="transfer-description"
              label="Descrição (opcional)"
              placeholder="Ex.: Aluguel"
              maxLength={140}
              error={errors.description?.message}
              {...form.register("description")}
            />

            <DialogFooter>
              {errorSimulator && <ErrorSimulator balance={balance} disabled={isPending} onRun={runScenario} />}
              <Button type="submit" disabled={isPending}>
                {isPending ? "Enviando..." : "Continuar"}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
