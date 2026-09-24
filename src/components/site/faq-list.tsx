"use client";

import { Plus } from "lucide-react";
import { Accordion as A } from "radix-ui";

export function FaqList({ items }: { items: { id: string; question: string; answer: string }[] }) {
  return (
    <A.Root type="single" collapsible className="border-t border-line">
      {items.map((item) => (
        <A.Item key={item.id} value={item.id} className="border-b border-line">
          <A.Header>
            <A.Trigger className="group flex w-full items-center justify-between gap-6 py-6 text-left text-[17px] text-light transition-colors hover:text-white sm:text-[19px]">
              {item.question}
              <span className="grid size-9 shrink-0 place-items-center rounded-full border border-line-strong transition-all duration-500 ease-out-expo group-hover:border-white/40 group-data-[state=open]:rotate-45 group-data-[state=open]:bg-white group-data-[state=open]:text-void">
                <Plus className="size-4" aria-hidden />
              </span>
            </A.Trigger>
          </A.Header>
          <A.Content className="overflow-hidden data-[state=closed]:animate-[accordion-up_300ms_cubic-bezier(0.16,1,0.3,1)] data-[state=open]:animate-[accordion-down_400ms_cubic-bezier(0.16,1,0.3,1)]">
            <p className="max-w-2xl pb-7 text-[16px] leading-relaxed text-ash">{item.answer}</p>
          </A.Content>
        </A.Item>
      ))}
    </A.Root>
  );
}
