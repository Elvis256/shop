"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { Search, Mail, Package, Ban, CheckCircle } from "lucide-react";

interface Customer {
  id: string;
  email: string;
  name: string | null;
  phone: string | null;
  isBlocked: boolean;
  orderCount: number;
  totalSpent: number;
  createdAt: string;
}

export default function AdminCustomersPage() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"all" | "active" | "blocked">("all");
  const [pagination, setPagination] = useState({ total: 0, page: 1, totalPages: 1 });

  const loadCustomers = (params: Record<string, string> = {}) => {
    setLoading(true);
    api.admin.getCustomers({ search, ...params })
      .then((data) => {
        setCustomers(data.customers as any);
        setPagination(data.pagination);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  useEffect(() => { loadCustomers(); }, [search]);

  const handleToggleBlock = async (customer: Customer) => {
    const action = customer.isBlocked ? "unblock" : "block";
    if (!confirm(`${action.charAt(0).toUpperCase() + action.slice(1)} this customer?`)) return;
    await api.admin.updateCustomer(customer.id, { isBlocked: !customer.isBlocked } as any);
    loadCustomers();
  };

  const filtered = customers.filter((c) => {
    if (filter === "active") return !c.isBlocked;
    if (filter === "blocked") return c.isBlocked;
    return true;
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Customers</h1>
        <p className="text-text-muted">{pagination.total} total customers</p>
      </div>

      {/* Search & Filter */}
      <div className="bg-white rounded-lg border border-border p-4">
        <div className="flex flex-wrap gap-4">
          <div className="relative flex-1 min-w-48">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-text-muted" />
            <input
              type="text"
              className="input pl-10"
              placeholder="Search customers..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <select className="input w-36" value={filter} onChange={(e) => setFilter(e.target.value as any)}>
            <option value="all">All</option>
            <option value="active">Active</option>
            <option value="blocked">Blocked</option>
          </select>
        </div>
      </div>

      {/* Customers Table */}
      <div className="bg-white rounded-lg border border-border overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50 border-b border-border">
            <tr>
              <th className="p-4 text-left text-sm font-medium">Customer</th>
              <th className="p-4 text-left text-sm font-medium">Phone</th>
              <th className="p-4 text-left text-sm font-medium">Orders</th>
              <th className="p-4 text-left text-sm font-medium">Total Spent</th>
              <th className="p-4 text-left text-sm font-medium">Status</th>
              <th className="p-4 text-left text-sm font-medium">Joined</th>
              <th className="p-4 text-right text-sm font-medium">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {loading ? (
              <tr><td colSpan={7} className="p-8 text-center text-text-muted">Loading...</td></tr>
            ) : filtered.length === 0 ? (
              <tr><td colSpan={7} className="p-8 text-center text-text-muted">No customers found</td></tr>
            ) : (
              filtered.map((customer) => (
                <tr key={customer.id} className={`hover:bg-gray-50 ${customer.isBlocked ? "opacity-60" : ""}`}>
                  <td className="p-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-accent text-white rounded-full flex items-center justify-center font-bold">
                        {customer.name?.[0] || customer.email[0].toUpperCase()}
                      </div>
                      <div>
                        <p className="font-medium">{customer.name || "No name"}</p>
                        <p className="text-sm text-text-muted">{customer.email}</p>
                      </div>
                    </div>
                  </td>
                  <td className="p-4 text-sm">{customer.phone || "-"}</td>
                  <td className="p-4">
                    <div className="flex items-center gap-2">
                      <Package className="w-4 h-4 text-text-muted" />
                      {customer.orderCount}
                    </div>
                  </td>
                  <td className="p-4 font-medium">USh {customer.totalSpent.toLocaleString()}</td>
                  <td className="p-4">
                    <span className={`text-xs px-2 py-1 rounded-full font-medium ${customer.isBlocked ? "bg-red-100 text-red-700" : "bg-green-100 text-green-700"}`}>
                      {customer.isBlocked ? "Blocked" : "Active"}
                    </span>
                  </td>
                  <td className="p-4 text-sm text-text-muted">
                    {new Date(customer.createdAt).toLocaleDateString()}
                  </td>
                  <td className="p-4 text-right">
                    <button
                      onClick={() => handleToggleBlock(customer)}
                      className={`inline-flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-lg transition-colors ${customer.isBlocked ? "bg-green-100 text-green-700 hover:bg-green-200" : "bg-red-100 text-red-700 hover:bg-red-200"}`}
                      title={customer.isBlocked ? "Unblock customer" : "Block customer"}
                    >
                      {customer.isBlocked ? <CheckCircle className="w-4 h-4" /> : <Ban className="w-4 h-4" />}
                      {customer.isBlocked ? "Unblock" : "Block"}
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>

        {pagination.totalPages > 1 && (
          <div className="flex items-center justify-between p-4 border-t border-border">
            <p className="text-sm text-text-muted">Page {pagination.page} of {pagination.totalPages}</p>
            <div className="flex gap-2">
              <button onClick={() => loadCustomers({ page: String(pagination.page - 1) })} disabled={pagination.page === 1} className="btn-secondary text-sm">
                Previous
              </button>
              <button onClick={() => loadCustomers({ page: String(pagination.page + 1) })} disabled={pagination.page === pagination.totalPages} className="btn-secondary text-sm">
                Next
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

