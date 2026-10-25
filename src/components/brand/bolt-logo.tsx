import Image from "next/image";
import logo from "@/assets/bolt-logo.png";
import { cn } from "@/lib/utils";

export function BoltLogo({ className, light }: { className?: string; light?: boolean }) {
  return (
    <div className={cn("flex items-center gap-2", className)}>
      <Image src={logo} alt="" priority className={cn("h-9 w-auto", light && "brightness-0 invert")} />
      <span className={cn("font-display text-2xl tracking-tight", light ? "text-on-brand" : "text-navy")}>BOLT</span>
    </div>
  );
}
