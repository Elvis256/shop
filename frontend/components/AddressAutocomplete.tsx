"use client";

import { InputHTMLAttributes } from "react";

type AddressFieldType =
  | "name"
  | "street"
  | "address-line1"
  | "address-line2"
  | "city"
  | "state"
  | "county"
  | "postal-code"
  | "country"
  | "phone"
  | "email";

const autocompleteMap: Record<AddressFieldType, string> = {
  name: "name",
  street: "street-address",
  "address-line1": "address-line1",
  "address-line2": "address-line2",
  city: "address-level2",
  state: "address-level1",
  county: "address-level1",
  "postal-code": "postal-code",
  country: "country-name",
  phone: "tel",
  email: "email",
};

interface AddressAutocompleteProps
  extends Omit<InputHTMLAttributes<HTMLInputElement>, "autoComplete"> {
  fieldType: AddressFieldType;
}

export default function AddressAutocomplete({
  fieldType,
  className = "input",
  ...props
}: AddressAutocompleteProps) {
  return (
    <input
      className={className}
      autoComplete={autocompleteMap[fieldType] || "on"}
      {...props}
    />
  );
}

export { autocompleteMap };
export type { AddressFieldType };
