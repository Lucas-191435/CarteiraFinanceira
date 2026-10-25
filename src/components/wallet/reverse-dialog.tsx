"use client";

import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { AlertCircle, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { reverseAction } from "@/actions/wallet";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { applyServerFieldErrors } from "@/hooks/use-server-field-errors";
import { brl } from "@/lib/format";
import type { IStatementEntry } from "@/types/IWallet";
import { reverseSchema, type ReverseInput } from "@/validations/wallet";

/** Efeito do estorno por extenso, para a pessoa saber exatamente o que vai acontecer. */
function effectOf(entry: IStatementEntry) {
  const amount = brl(entry.amount);
  if (entry.transaction.type === "DEPOSIT") {
    return (
      <>
        <strong>{amount}</strong> saem da sua carteira. Seu saldo pode ficar negativo.
      </>
    );
  }
  const name = entry.transaction.counterpart?.name ?? "o destinatário";
  return (
    <>
      <strong>{amount}</strong> voltam para a sua carteira e saem da carteira de <strong>{name}</strong>. Se já tiver
      usado o valor, o saldo dessa pessoa pode ficar negativo.
    </>
  );
}

export function ReverseDialog({ entry, title }: { entry: IStatementEntry; title: string }) {
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState<string>();
  const [isPending, startTransition] = useTransition();

  const form = useForm<ReverseInput>({ resolver: zodResolver(reverseSchema), defaultValues: { reason: "" } });
  const { errors } = form.formState;

  const onOpenChange = (next: boolean) => {
    if (next) {
      setMessage(undefined);
      form.reset();
    }
    setOpen(next);
  };

  const onSubmit = form.handleSubmit((values) => {
    const formData = new FormData();
    formData.set("reason", values.reason ?? "");
    const action = reverseAction.bind(null, entry.transaction.id);

    startTransition(async () => {
      const result = await action(undefined, formData);
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
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogTrigger asChild>
        <Button variant="ghost" size="icon" aria-label={`Estornar: ${title}`} title="Estornar">
          <RotateCcw className="h-4 w-4" />
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <form onSubmit={onSubmit} noValidate className="space-y-4">
          <AlertDialogHeader>
            <AlertDialogTitle>Estornar operação</AlertDialogTitle>
            <AlertDialogDescription>
              {title}. {effectOf(entry)}
            </AlertDialogDescription>
          </AlertDialogHeader>

          {message && (
            <Alert variant="destructive">
              <AlertCircle />
              <AlertDescription>{message}</AlertDescription>
            </Alert>
          )}

          <div className="space-y-2">
            <Label htmlFor={`reason-${entry.transaction.id}`}>Motivo (opcional)</Label>
            <Textarea
              id={`reason-${entry.transaction.id}`}
              placeholder="Ex.: transferi para a pessoa errada"
              maxLength={140}
              aria-invalid={Boolean(errors.reason)}
              {...form.register("reason")}
            />
            {errors.reason && <p className="text-sm text-destructive">{errors.reason.message}</p>}
          </div>

          <p className="text-xs text-muted-foreground">Esta ação não pode ser desfeita.</p>

          <AlertDialogFooter>
            <AlertDialogCancel disabled={isPending}>Cancelar</AlertDialogCancel>
            {/* Button comum (não AlertDialogAction): o dialog só fecha depois da resposta da API */}
            <Button type="submit" variant="destructive" disabled={isPending}>
              {isPending ? "Estornando..." : "Estornar"}
            </Button>
          </AlertDialogFooter>
        </form>
      </AlertDialogContent>
    </AlertDialog>
  );
}
