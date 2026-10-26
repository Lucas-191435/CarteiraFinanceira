"use client";

import { useRef, useState, useTransition } from "react";
import { Check, ChevronsUpDown, Loader2 } from "lucide-react";
import { searchRecipientsAction } from "@/actions/wallet";
import { Button } from "@/components/ui/button";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import type { IRecipient } from "@/types/IUser";

const SEARCH_DEBOUNCE_MS = 300;

const normalize = (term: string) => term.trim().toLowerCase();

type RecipientComboboxProps = {
  id: string;
  value: IRecipient | null;
  onChange: (recipient: IRecipient) => void;
  onBlur?: () => void;
  invalid?: boolean;
  describedBy?: string;
};

/**
 * Select pesquisável de destinatários: digita nome ou e-mail e a lista vem da API
 * (GET /user/search, via Server Action), sem o próprio usuário.
 *
 * A busca é uma Server Action (POST), que o Client Cache não cobre: o cache é um Map no próprio
 * componente, por termo. Vale enquanto a tela estiver montada (abrir/fechar o modal reaproveita).
 */
export function RecipientCombobox({ id, value, onChange, onBlur, invalid, describedBy }: RecipientComboboxProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [results, setResults] = useState<IRecipient[]>([]);
  const [error, setError] = useState<string>();
  const [isSearching, startSearch] = useTransition();
  const debounce = useRef<ReturnType<typeof setTimeout>>(undefined);
  const cache = useRef(new Map<string, IRecipient[]>());
  const latestTerm = useRef("");

  const runSearch = (rawTerm: string) => {
    const term = normalize(rawTerm);
    latestTerm.current = term;

    const cached = cache.current.get(term);
    if (cached) {
      setResults(cached);
      setError(undefined);
      return;
    }

    startSearch(async () => {
      const result = await searchRecipientsAction(term);
      if (result?.ok) {
        cache.current.set(term, result.data ?? []);
      }
      // Resposta atrasada de um termo antigo ("bru" chegando depois de "brun") não sobrescreve a atual
      if (term !== latestTerm.current) return;

      if (result?.ok) {
        setResults(result.data ?? []);
        setError(undefined);
      } else {
        setResults([]);
        setError(result?.message ?? "Não foi possível buscar agora.");
      }
    });
  };

  const onSearchChange = (term: string) => {
    setSearch(term);
    clearTimeout(debounce.current);
    debounce.current = setTimeout(() => runSearch(term), SEARCH_DEBOUNCE_MS);
  };

  const onOpenChange = (next: boolean) => {
    setOpen(next);
    if (next) {
      // Ao abrir, já mostra os primeiros usuários (busca vazia)
      setSearch("");
      runSearch("");
    } else {
      onBlur?.();
    }
  };

  return (
    // modal: necessário para a lista rolar dentro do Dialog
    <Popover open={open} onOpenChange={onOpenChange} modal>
      <PopoverTrigger asChild>
        <Button
          id={id}
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          aria-invalid={invalid}
          aria-describedby={describedBy}
          className={cn(
            "h-auto min-h-9 w-full justify-between px-3 py-2 font-normal",
            !value && "text-muted-foreground",
            invalid && "border-destructive",
          )}
        >
          {value ? (
            <span className="min-w-0 text-left">
              <span className="block truncate font-medium text-foreground">{value.name}</span>
              <span className="block truncate text-xs text-muted-foreground">{value.email}</span>
            </span>
          ) : (
            "Selecione o destinatário"
          )}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-(--radix-popover-trigger-width) p-0" align="start">
        {/* shouldFilter=false: quem filtra é a API (nome ou e-mail) */}
        <Command shouldFilter={false}>
          <CommandInput placeholder="Buscar por nome ou e-mail..." value={search} onValueChange={onSearchChange} />
          <CommandList>
            {isSearching && (
              <div className="flex items-center justify-center gap-2 py-6 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" /> Buscando...
              </div>
            )}
            {!isSearching && (
              <CommandEmpty>{error ?? (search ? "Ninguém encontrado com esse nome ou e-mail." : "Nenhum usuário disponível.")}</CommandEmpty>
            )}
            {!isSearching && results.length > 0 && (
              <CommandGroup>
                {results.map((recipient) => (
                  <CommandItem
                    key={recipient.email}
                    value={recipient.email}
                    onSelect={() => {
                      onChange(recipient);
                      onOpenChange(false);
                    }}
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium">{recipient.name}</p>
                      <p className="truncate text-xs text-muted-foreground">{recipient.email}</p>
                    </div>
                    <Check className={cn("h-4 w-4", value?.email === recipient.email ? "opacity-100" : "opacity-0")} />
                  </CommandItem>
                ))}
              </CommandGroup>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
