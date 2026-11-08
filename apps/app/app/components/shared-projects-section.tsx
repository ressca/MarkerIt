'use client';

import { Share2, ArrowUpRight, ShieldCheck, Mail } from 'lucide-react';

export function SharedProjectsSection() {
  return (
    <section
      id="shared"
      className="mt-8 rounded-xl border border-dashed border-border bg-card/40 p-6 transition-colors hover:bg-card/70"
    >
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-4">
          <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary ring-1 ring-primary/20">
            <Share2 className="size-5" />
          </div>
          <div>
            <h3 className="font-semibold text-sm text-foreground">
              Projekty udostępnione Tobie
            </h3>
            <p className="mt-1 text-xs text-muted-foreground leading-relaxed">
              Gdy ktoś zaprosi Cię do review lub doda do zewnętrznego zespołu, projekt pojawi się tutaj.
            </p>
            <div className="mt-2 flex items-center gap-3 text-[11px] text-muted-foreground">
              <span className="flex items-center gap-1">
                <ShieldCheck className="size-3.5 text-primary" /> Bezpieczny dostęp gościa
              </span>
              <span className="flex items-center gap-1">
                <Mail className="size-3.5 text-muted-foreground" /> Powiadomienia na e-mail
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3 self-end sm:self-center">
          <a
            href="#shared"
            className="inline-flex items-center gap-1 font-medium text-xs text-primary transition-colors hover:underline"
          >
            Dowiedz się więcej <ArrowUpRight className="size-3.5" />
          </a>
        </div>
      </div>
    </section>
  );
}
