"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { Search, Mail, Package, Star } from "lucide-react";

interface Customer {
  id: string;
  email: string;
  name: string;
  phone: string;
  orderCount: number;
  totalSpent: number;
  createdAt: string;
}

export default function AdminCustomersPage() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [pagination, setPagination] = useState({ total: 0, page: 1, totalPages: 1 });

  const loadCustomers = (params: Record<string, string> = {}) => {
    setLoading(true);
    api.admin.getCustomers({ search, ...params })
      .then((data) => {
        setCustomers(data.customers);
        setPagination(data.pagination);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadCustomers();
  }, [search]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Customers</h1>
        <p className="text-text-muted">{pagination.total} total customers</p>
      </div>

      {/* Search */}
      <div className="bg-white rounded-lg border border-border p-4">
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-text-muted" />
          <input
            type="text"
            className="input pl-10"
            placeholder="Search customers..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
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
              <th className="p-4 text-left text-sm font-medium">Joined</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {loading ? (
              <tr>
                <td colSpan={5} className="p-8 text-center text-text-muted">
                  Loading...
                </td>
              </tr>
            ) : customers.length === 0 ? (
              <tr>
                <td colSpan={5} className="p-8 text-center text-text-muted">
                  No customers found
                </td>
              </tr>
            ) : (
              customers.map((customer) => (
                <tr key={customer.id} className="hover:bg-gray-50">
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
                  <td className="p-4 font-medium">
                    KES {customer.totalSpent.toLocaleString()}
                  </td>
                  <td className="p-4 text-sm text-text-muted">
                    {new Date(customer.createdAt).toLocaleDateString()}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>

        {/* Pagination */}
        {pagination.totalPages > 1 && (
          <div className="flex items-center justify-between p-4 border-t border-border">
            <p className="text-sm text-text-muted">
              Page {pagination.page} of {pagination.totalPages}
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => loadCustomers({ page: String(pagination.page - 1) })}
                disabled={pagination.page === 1}
                className="btn-secondary text-sm"
              >
                Previous
              </button>
              <button
                onClick={() => loadCustomers({ page: String(pagination.page + 1) })}
                disabled={pagination.page === pagination.totalPages}
                className="btn-secondary text-sm"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
