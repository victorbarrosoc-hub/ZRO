"use client";

import { useState } from "react";
import { Input } from "@/components/ui/field";
import { maskPhone } from "@/lib/format";

/** WhatsApp no formato de celular, arrumado enquanto digita: (84) 99919-7374. */
export function PhoneInput({
  defaultValue,
  ...props
}: Omit<React.ComponentProps<typeof Input>, "value" | "onChange" | "defaultValue"> & { defaultValue?: string | null }) {
  const [value, setValue] = useState(maskPhone(defaultValue ?? ""));
  return (
    <Input
      type="tel"
      inputMode="tel"
      autoComplete="off"
      placeholder="(84) 90000-0000"
      {...props}
      value={value}
      onChange={(e) => setValue(maskPhone(e.target.value))}
    />
  );
}
