export interface ShippingAddress {
  name?: string;
  address?: string;
  street?: string;
  city?: string;
  county?: string;
  postalCode?: string;
  country?: string;
  phone?: string;
  latitude?: number;
  longitude?: number;
  [key: string]: unknown;
}
