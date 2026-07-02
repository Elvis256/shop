"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Section from "@/components/Section";
import { useAuth } from "@/lib/hooks/useAuth";
import { api } from "@/lib/api";
import { MapPin, Plus, Check, Trash2, ChevronLeft, Edit } from "lucide-react";
import { useToast } from "@/lib/hooks/useToast";
import ConfirmDialog from "@/components/ConfirmDialog";

interface Address {
  id: string;
  name: string;
  phone: string;
  street: string;
  city: string;
  county?: string;
  postalCode?: string;
  country?: string;
  isDefault: boolean;
  deliveryAlias?: string;
}

export default function AddressesPage() {
  const router = useRouter();
  const { user, isLoading } = useAuth();
  const { showToast } = useToast();
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    name: "",
    phone: "",
    street: "",
    city: "",
    county: "",
    postalCode: "",
    country: "Uganda",
    deliveryAlias: "",
  });

  useEffect(() => {
    if (!isLoading && !user) {
      router.push("/auth/login");
    }
  }, [user, isLoading, router]);

  const loadAddresses = () => {
    api.getAddresses()
      .then((data: any) => setAddresses(data.addresses || data))
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    if (user) {
      loadAddresses();
    }
  }, [user]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingId) {
        await api.updateAddress(editingId, formData);
        showToast("Address updated", "success");
      } else {
        await api.createAddress(formData as any);
        showToast("Address added", "success");
      }
      setShowForm(false);
      setEditingId(null);
      setFormData({ name: "", phone: "", street: "", city: "", county: "", postalCode: "", country: "Uganda", deliveryAlias: "" });
      loadAddresses();
    } catch (error) {
      showToast("Failed to save address", "error");
    }
  };

  const handleEdit = (address: Address) => {
    setFormData({
      name: address.name,
      phone: address.phone,
      street: address.street,
      city: address.city,
      county: address.county || "",
      postalCode: address.postalCode || "",
      country: address.country || "Uganda",
      deliveryAlias: address.deliveryAlias || "",
    });
    setEditingId(address.id);
    setShowForm(true);
  };

  const handleDelete = async (id: string) => {
    try {
      await api.deleteAddress(id);
      showToast("Address deleted", "success");
      loadAddresses();
    } catch {
      showToast("Failed to delete address", "error");
    }
    setDeleteTarget(null);
  };

  const handleSetDefault = async (id: string) => {
    try {
      await api.setDefaultAddress(id);
      showToast("Default address updated", "success");
      loadAddresses();
    } catch {
      showToast("Failed to set default address", "error");
    }
  };

  if (isLoading || !user) {
    return (
      <Section>
        <div className="text-center py-16">Loading...</div>
      </Section>
    );
  }

  return (
    <Section>
      <div className="max-w-2xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            <Link href="/account" className="btn-icon">
              <ChevronLeft className="w-5 h-5" />
            </Link>
            <h1>My Addresses</h1>
          </div>
          {!showForm && (
            <button onClick={() => setShowForm(true)} className="btn-primary gap-2">
              <Plus className="w-5 h-5" />
              Add Address
            </button>
          )}
        </div>

        {showForm && (
          <div className="card mb-8">
            <h3 className="mb-6">{editingId ? "Edit Address" : "Add New Address"}</h3>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-small font-medium mb-2">Full Name</label>
                  <input
                    className="input"
                    autoComplete="name"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    required
                  />
                </div>
                <div>
                  <label className="block text-small font-medium mb-2">Phone</label>
                  <input
                    className="input"
                    autoComplete="tel"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    required
                  />
                </div>
              </div>
              <div>
                <label className="block text-small font-medium mb-2">Street Address</label>
                <input
                  className="input"
                  autoComplete="street-address"
                  value={formData.street}
                  onChange={(e) => setFormData({ ...formData, street: e.target.value })}
                  required
                />
              </div>
              <div>
                <label className="block text-small font-medium mb-1">
                  Delivery Recipient Alias <span className="text-text-muted font-normal text-xs">(Discreet placeholder name printed on package label, e.g. "Security Gate 2")</span>
                </label>
                <input
                  className="input font-mono"
                  placeholder="e.g. Security Gate / Reception / Neutral Name"
                  value={formData.deliveryAlias}
                  onChange={(e) => setFormData({ ...formData, deliveryAlias: e.target.value })}
                />
              </div>
              <div className="grid sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-small font-medium mb-2">City</label>
                  <input
                    className="input"
                    autoComplete="address-level2"
                    value={formData.city}
                    onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                    required
                  />
                </div>
                <div>
                  <label className="block text-small font-medium mb-2">County</label>
                  <input
                    className="input"
                    autoComplete="address-level1"
                    value={formData.county}
                    onChange={(e) => setFormData({ ...formData, county: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-small font-medium mb-2">Postal Code</label>
                  <input
                    className="input"
                    autoComplete="postal-code"
                    value={formData.postalCode}
                    onChange={(e) => setFormData({ ...formData, postalCode: e.target.value })}
                  />
                </div>
              </div>
              <div className="flex gap-4">
                <button type="submit" className="btn-primary">
                  {editingId ? "Update" : "Add"} Address
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowForm(false);
                    setEditingId(null);
                    setFormData({ name: "", phone: "", street: "", city: "", county: "", postalCode: "", country: "Uganda", deliveryAlias: "" });
                  }}
                  className="btn-secondary"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        )}

        {loading ? (
          <div className="space-y-4">
            {[1, 2].map((i) => (
              <div key={i} className="card animate-pulse">
                <div className="flex justify-between">
                  <div className="space-y-2 flex-1">
                    <div className="h-5 bg-gray-200 rounded w-1/3" />
                    <div className="h-4 bg-gray-200 rounded w-2/3" />
                    <div className="h-3 bg-gray-200 rounded w-1/2" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : addresses.length === 0 && !showForm ? (
          <div className="card text-center py-16">
            <MapPin className="w-16 h-16 mx-auto mb-4 text-text-muted" />
            <h3 className="mb-2">No addresses saved</h3>
            <p className="text-text-muted mb-6">Add an address for faster checkout.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {addresses.map((address) => (
              <div
                key={address.id}
                className={`card ${address.isDefault ? "border-accent" : ""}`}
              >
                <div className="flex justify-between">
                  <div>
                    <div className="flex items-center gap-2 mb-2 flex-wrap">
                      <span className="font-medium">{address.name}</span>
                      {address.deliveryAlias && (
                        <span className="badge bg-purple-100 text-purple-800 dark:bg-purple-950/40 dark:text-purple-300">Label Alias: {address.deliveryAlias}</span>
                      )}
                      {address.isDefault && (
                        <span className="badge bg-accent text-white">Default</span>
                      )}
                    </div>
                    <p className="text-text-muted text-small">
                      {address.street}
                      <br />
                      {address.city}
                      {address.county && `, ${address.county}`}
                      {address.postalCode && ` ${address.postalCode}`}
                      <br />
                      {address.phone}
                    </p>
                  </div>
                  <div className="flex flex-col gap-2">
                    <button
                      onClick={() => handleEdit(address)}
                      className="btn-icon text-text-muted hover:text-accent"
                    >
                      <Edit className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => setDeleteTarget(address.id)}
                      className="btn-icon text-text-muted hover:text-red-500"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
                {!address.isDefault && (
                  <button
                    onClick={() => handleSetDefault(address.id)}
                    className="mt-4 text-small link flex items-center gap-1"
                  >
                    <Check className="w-4 h-4" />
                    Set as default
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
        <ConfirmDialog
          open={!!deleteTarget}
          title="Delete Address"
          message="Are you sure you want to delete this address?"
          variant="danger"
          confirmLabel="Delete"
          onConfirm={() => deleteTarget && handleDelete(deleteTarget)}
          onCancel={() => setDeleteTarget(null)}
        />
      </div>
    </Section>
  );
}
