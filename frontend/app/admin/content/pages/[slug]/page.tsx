"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Save, Plus, Trash2, Loader2, ChevronDown, ChevronUp } from "lucide-react";

interface FAQItem {
  question: string;
  answer: string;
}

interface FAQCategory {
  title: string;
  icon: string;
  items: FAQItem[];
}

const PAGE_CONFIG: Record<string, { title: string; type: "faq" | "contact" | "text"; settingKey: string; description: string }> = {
  faq: { title: "FAQ", type: "faq", settingKey: "faq_items", description: "Manage FAQ categories and questions" },
  contact: { title: "Contact Info", type: "contact", settingKey: "contact_info", description: "Update phone, email, WhatsApp, and hours" },
  about: { title: "About Us", type: "text", settingKey: "page_about", description: "Edit your store about page content" },
  shipping: { title: "Shipping Policy", type: "text", settingKey: "page_shipping", description: "Edit shipping policy content" },
  privacy: { title: "Privacy Policy", type: "text", settingKey: "page_privacy", description: "Edit privacy policy" },
  terms: { title: "Terms of Service", type: "text", settingKey: "page_terms", description: "Edit terms of service" },
};

async function getCsrfToken(): Promise<string> {
  try {
    const res = await fetch("/api/auth/csrf", { credentials: "include" });
    const data = await res.json();
    return data.token || "";
  } catch {
    return "";
  }
}

// ── FAQ Editor ─────────────────────────────────────────────────────────────────
function FAQEditor({ value, onChange }: { value: FAQCategory[]; onChange: (v: FAQCategory[]) => void }) {
  const [expanded, setExpanded] = useState<string | null>(null);

  function addCategory() {
    onChange([...value, { title: "New Category", icon: "📌", items: [] }]);
  }

  function removeCategory(idx: number) {
    if (!confirm("Remove this category and all its questions?")) return;
    onChange(value.filter((_, i) => i !== idx));
  }

  function updateCategory(idx: number, field: keyof FAQCategory, val: any) {
    onChange(value.map((c, i) => i === idx ? { ...c, [field]: val } : c));
  }

  function addQuestion(catIdx: number) {
    const updated = value.map((c, i) =>
      i === catIdx ? { ...c, items: [...c.items, { question: "", answer: "" }] } : c
    );
    onChange(updated);
  }

  function updateQuestion(catIdx: number, qIdx: number, field: keyof FAQItem, val: string) {
    const updated = value.map((c, i) =>
      i === catIdx
        ? { ...c, items: c.items.map((q, j) => j === qIdx ? { ...q, [field]: val } : q) }
        : c
    );
    onChange(updated);
  }

  function removeQuestion(catIdx: number, qIdx: number) {
    const updated = value.map((c, i) =>
      i === catIdx ? { ...c, items: c.items.filter((_, j) => j !== qIdx) } : c
    );
    onChange(updated);
  }

  return (
    <div className="space-y-4">
      {value.map((cat, catIdx) => (
        <div key={catIdx} className="border rounded-xl overflow-hidden">
          <div className="flex items-center gap-3 bg-gray-50 px-4 py-3">
            <input
              type="text"
              value={cat.icon}
              onChange={e => updateCategory(catIdx, "icon", e.target.value)}
              className="w-12 text-center border rounded px-1 py-0.5 text-sm"
              placeholder="📌"
            />
            <input
              type="text"
              value={cat.title}
              onChange={e => updateCategory(catIdx, "title", e.target.value)}
              className="flex-1 border rounded px-2 py-1 text-sm font-medium"
              placeholder="Category title"
            />
            <button
              onClick={() => setExpanded(expanded === String(catIdx) ? null : String(catIdx))}
              className="p-1 text-gray-500 hover:text-gray-700"
            >
              {expanded === String(catIdx) ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>
            <button onClick={() => removeCategory(catIdx)} className="p-1 text-red-400 hover:text-red-600">
              <Trash2 className="w-4 h-4" />
            </button>
          </div>

          {expanded === String(catIdx) && (
            <div className="p-4 space-y-4 bg-white">
              {cat.items.map((q, qIdx) => (
                <div key={qIdx} className="border rounded-lg p-3 space-y-2">
                  <div className="flex items-start gap-2">
                    <div className="flex-1">
                      <label className="block text-xs text-gray-500 mb-1">Question</label>
                      <input
                        type="text"
                        value={q.question}
                        onChange={e => updateQuestion(catIdx, qIdx, "question", e.target.value)}
                        className="input w-full text-sm"
                        placeholder="What is your question?"
                      />
                    </div>
                    <button onClick={() => removeQuestion(catIdx, qIdx)} className="mt-5 p-1 text-red-400 hover:text-red-600">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Answer</label>
                    <textarea
                      value={q.answer}
                      onChange={e => updateQuestion(catIdx, qIdx, "answer", e.target.value)}
                      rows={3}
                      className="input w-full text-sm resize-none"
                      placeholder="Provide a clear answer..."
                    />
                  </div>
                </div>
              ))}
              <button
                onClick={() => addQuestion(catIdx)}
                className="w-full py-2 border-2 border-dashed border-gray-200 rounded-lg text-sm text-gray-500 hover:border-accent hover:text-accent flex items-center justify-center gap-2"
              >
                <Plus className="w-4 h-4" /> Add Question
              </button>
            </div>
          )}
        </div>
      ))}

      <button
        onClick={addCategory}
        className="w-full py-3 border-2 border-dashed border-gray-300 rounded-xl text-gray-500 hover:border-accent hover:text-accent flex items-center justify-center gap-2 transition-colors"
      >
        <Plus className="w-4 h-4" /> Add FAQ Category
      </button>
    </div>
  );
}

// ── Contact Editor ─────────────────────────────────────────────────────────────
function ContactEditor({ value, onChange }: {
  value: { email: string; phone: string; whatsapp: string; hours: string };
  onChange: (v: any) => void;
}) {
  return (
    <div className="space-y-5">
      <div>
        <label className="block text-sm font-medium mb-1.5">Support Email</label>
        <input
          type="email"
          value={value.email}
          onChange={e => onChange({ ...value, email: e.target.value })}
          className="input w-full"
          placeholder="support@yourstore.com"
        />
      </div>
      <div>
        <label className="block text-sm font-medium mb-1.5">Phone Number</label>
        <input
          type="tel"
          value={value.phone}
          onChange={e => onChange({ ...value, phone: e.target.value })}
          className="input w-full"
          placeholder="+256 700 000 000"
        />
        <p className="text-xs text-gray-400 mt-1">Shown as a clickable link (tel:)</p>
      </div>
      <div>
        <label className="block text-sm font-medium mb-1.5">WhatsApp Number</label>
        <input
          type="tel"
          value={value.whatsapp}
          onChange={e => onChange({ ...value, whatsapp: e.target.value })}
          className="input w-full"
          placeholder="256700000000 (no + or spaces)"
        />
        <p className="text-xs text-gray-400 mt-1">Used in wa.me link — digits only, no spaces</p>
      </div>
      <div>
        <label className="block text-sm font-medium mb-1.5">Business Hours</label>
        <input
          type="text"
          value={value.hours}
          onChange={e => onChange({ ...value, hours: e.target.value })}
          className="input w-full"
          placeholder="Mon-Sat, 9am-6pm EAT"
        />
      </div>
    </div>
  );
}

// ── Main Page ──────────────────────────────────────────────────────────────────
export default function PageEditorPage() {
  const params = useParams<{ slug: string }>();
  const router = useRouter();
  const config = PAGE_CONFIG[params.slug];

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

  // For FAQ
  const [faqData, setFaqData] = useState<FAQCategory[]>([]);
  // For contact
  const [contactData, setContactData] = useState({ email: "", phone: "", whatsapp: "", hours: "" });
  // For text pages
  const [textContent, setTextContent] = useState("");

  useEffect(() => {
    if (!config) return setLoading(false);

    const keys =
      config.type === "contact"
        ? ["contact_email", "contact_phone", "contact_whatsapp", "contact_hours"].join(",")
        : config.settingKey;

    fetch(`/api/settings/public`, { credentials: "include" })
      .then(r => r.json())
      .then(data => {
        const s = data.settings || {};
        if (config.type === "faq") {
          try { setFaqData(JSON.parse(s.faq_items || "[]")); } catch { setFaqData([]); }
        } else if (config.type === "contact") {
          setContactData({
            email: s.contact_email || "support@adultstore.com",
            phone: s.contact_phone || "+256 700 000 000",
            whatsapp: s.contact_whatsapp || "256700000000",
            hours: s.contact_hours || "Mon-Sat, 9am-6pm EAT",
          });
        } else {
          setTextContent(s[config.settingKey] || "");
        }
      })
      .catch(() => setError("Failed to load content"))
      .finally(() => setLoading(false));
  }, [params.slug]);

  async function handleSave() {
    if (!config) return;
    setSaving(true);
    setError("");
    try {
      const csrf = await getCsrfToken();
      let payload: Record<string, string> = {};

      if (config.type === "faq") {
        payload = { faq_items: JSON.stringify(faqData) };
      } else if (config.type === "contact") {
        payload = {
          contact_email: contactData.email,
          contact_phone: contactData.phone,
          contact_whatsapp: contactData.whatsapp,
          contact_hours: contactData.hours,
        };
      } else {
        payload = { [config.settingKey]: textContent };
      }

      const res = await fetch("/api/admin/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json", "x-csrf-token": csrf },
        credentials: "include",
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to save");
      }

      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  if (!config) {
    return (
      <div className="p-6 text-center">
        <p className="text-gray-500">Page not found</p>
        <Link href="/admin/content/pages" className="text-accent underline mt-2 inline-block">Back to Pages</Link>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Link href="/admin/content/pages" className="p-2 hover:bg-gray-100 rounded-lg">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <h1 className="text-xl font-bold">Edit: {config.title}</h1>
            <p className="text-sm text-gray-500">{config.description}</p>
          </div>
        </div>
        <button
          onClick={handleSave}
          disabled={saving}
          className={`flex items-center gap-2 px-5 py-2 rounded-lg text-sm font-medium transition-colors ${
            saved
              ? "bg-green-500 text-white"
              : "btn-primary"
          }`}
        >
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          {saved ? "Saved!" : "Save Changes"}
        </button>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">{error}</div>
      )}

      <div className="bg-white rounded-xl border p-6">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-accent" />
          </div>
        ) : config.type === "faq" ? (
          <FAQEditor value={faqData} onChange={setFaqData} />
        ) : config.type === "contact" ? (
          <ContactEditor value={contactData} onChange={setContactData} />
        ) : (
          <div>
            <label className="block text-sm font-medium mb-2">Page Content</label>
            <textarea
              value={textContent}
              onChange={e => setTextContent(e.target.value)}
              rows={24}
              className="input w-full resize-y font-mono text-sm"
              placeholder="Enter page content (HTML supported)..."
            />
            <p className="text-xs text-gray-400 mt-2">HTML tags are supported. {textContent.length} characters.</p>
          </div>
        )}
      </div>
    </div>
  );
}
