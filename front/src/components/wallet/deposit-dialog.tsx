"use client";

import { useState, useTransition } from "react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { AlertCircle, ArrowDownToLine, Info } from "lucide-react";
import { toast } from "sonner";
import { depositAction } from "@/actions/wallet";
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
import { applyServerFieldErrors } from "@/hooks/use-server-field-errors";
import { brl, isNegative } from "@/lib/format";
import { maskCurrency } from "@/lib/money";
import { uuid } from "@/lib/uuid";
import { depositSchema, type DepositInput } from "@/validations/wallet";
import { ActionCard } from "./action-card";

export function DepositDialog({ balance }: { balance: string }) {
  const [open, setOpen] = useState(false);
  const [idempotencyKey, setIdempotencyKey] = useState("");
  const [message, setMessage] = useState<string>();
  const [isPending, startTransition] = useTransition();

  const form = useForm<DepositInput>({
    resolver: zodResolver(depositSchema),
    defaultValues: { amount: "", description: "" },
  });
  const { errors } = form.formState;

  const onOpenChange = (next: boolean) => {
    if (next) {
      // Nova chave a cada abertura: duplo clique/reenvio mandam a mesma e a API não duplica
      setIdempotencyKey(uuid());
      setMessage(undefined);
      form.reset();
    }
    setOpen(next);
  };

  const onSubmit = form.handleSubmit((values) => {
    const formData = new FormData();
    formData.set("amount", values.amount);
    formData.set("description", values.description ?? "");
    formData.set("idempotencyKey", idempotencyKey);

    startTransition(async () => {
      const result = await depositAction(undefined, formData);
      if (result?.ok) {
        toast.success(result.message);
        setOpen(false);
        return;
      }
      applyServerFieldErrors(form, result);
      setMessage(result?.message);
    });
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        <ActionCard icon={ArrowDownToLine} title="Depositar" description="Adicione saldo à carteira" />
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Depositar</DialogTitle>
          <DialogDescription>O valor entra na sua carteira na hora.</DialogDescription>
        </DialogHeader>

        <form onSubmit={onSubmit} noValidate className="space-y-4">
          {isNegative(balance) && (
            <Alert>
              <Info />
              <AlertDescription>
                Seu saldo está negativo ({brl(balance)}). O depósito será somado a ele.
              </AlertDescription>
            </Alert>
          )}
          {message && (
            <Alert variant="destructive">
              <AlertCircle />
              <AlertDescription>{message}</AlertDescription>
            </Alert>
          )}

          <Controller
            control={form.control}
            name="amount"
            render={({ field }) => (
              <Field
                id="deposit-amount"
                label="Valor (R$)"
                inputMode="numeric"
                placeholder="0,00"
                autoComplete="off"
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
            id="deposit-description"
            label="Descrição (opcional)"
            placeholder="Ex.: Salário"
            maxLength={140}
            error={errors.description?.message}
            {...form.register("description")}
          />

          <DialogFooter>
            <Button type="submit" disabled={isPending}>
              {isPending ? "Depositando..." : "Confirmar depósito"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
