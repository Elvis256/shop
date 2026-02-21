"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Section from "@/components/Section";
import { useAuth } from "@/lib/hooks/useAuth";
import { api } from "@/lib/api";
import { MapPin, Plus, Check, Trash2, ChevronLeft, Edit } from "lucide-react";

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
}

export default function AddressesPage() {
  const router = useRouter();
  const { user, isLoading } = useAuth();
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [loading, setLoading] = useState(true);
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
      } else {
        await api.createAddress(formData as any);
      }
      setShowForm(false);
      setEditingId(null);
      setFormData({ name: "", phone: "", street: "", city: "", county: "", postalCode: "", country: "Uganda" });
      loadAddresses();
    } catch (error) {
      console.error("Failed to save address:", error);
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
    });
    setEditingId(address.id);
    setShowForm(true);
  };

  const handleDelete = async (id: string) => {
    if (confirm("Delete this address?")) {
      await api.deleteAddress(id);
      loadAddresses();
    }
  };

  const handleSetDefault = async (id: string) => {
    await api.setDefaultAddress(id);
    loadAddresses();
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
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    required
                  />
                </div>
                <div>
                  <label className="block text-small font-medium mb-2">Phone</label>
                  <input
                    className="input"
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
                  value={formData.street}
                  onChange={(e) => setFormData({ ...formData, street: e.target.value })}
                  required
                />
              </div>
              <div className="grid sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-small font-medium mb-2">City</label>
                  <input
                    className="input"
                    value={formData.city}
                    onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                    required
                  />
                </div>
                <div>
                  <label className="block text-small font-medium mb-2">County</label>
                  <input
                    className="input"
                    value={formData.county}
                    onChange={(e) => setFormData({ ...formData, county: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-small font-medium mb-2">Postal Code</label>
                  <input
                    className="input"
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
                    setFormData({ name: "", phone: "", street: "", city: "", county: "", postalCode: "", country: "Uganda" });
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
          <div className="text-center py-16 text-text-muted">Loading...</div>
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
                    <div className="flex items-center gap-2 mb-2">
                      <span className="font-medium">{address.name}</span>
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
                      onClick={() => handleDelete(address.id)}
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
      </div>
    </Section>
  );
}
