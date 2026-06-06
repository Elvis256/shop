"use client";

import Link from "next/link";
import { Briefcase, MapPin, Users, Rocket, Heart, Shield, ChevronRight, Clock } from "lucide-react";

const openings = [
  {
    title: "Delivery Rider",
    type: "Full-time",
    location: "Kampala",
    description: "Join our discreet delivery team. Motorcycle required. Competitive daily pay + tips.",
  },
  {
    title: "Customer Support Agent",
    type: "Full / Part-time",
    location: "Remote (Uganda)",
    description: "Help customers via WhatsApp, live chat, and phone. Training provided.",
  },
  {
    title: "Field Sales Agent",
    type: "Commission-based",
    location: "Kampala, Entebbe, Jinja, Mbarara",
    description: "Grow our customer base in your area. Earn commission on every referral sale.",
  },
  {
    title: "Content Creator",
    type: "Contract",
    location: "Remote",
    description: "Write educational blog posts and social media content about wellness topics.",
  },
  {
    title: "Warehouse Associate",
    type: "Full-time",
    location: "Kampala",
    description: "Pick, pack, and prepare orders for discreet shipping. Attention to detail is key.",
  },
];

const perks = [
  { icon: Heart, title: "Health Benefits", desc: "Medical cover for full-time staff" },
  { icon: Rocket, title: "Growth", desc: "Learn and grow with a fast-scaling startup" },
  { icon: Shield, title: "Safe Culture", desc: "Inclusive, judgment-free workplace" },
  { icon: Users, title: "Team Events", desc: "Monthly team activities and bonding" },
];

export default function CareersPage() {
  return (
    <div className="min-h-screen">
      {/* Hero */}
      <section className="bg-gradient-to-br from-gray-900 to-gray-800 text-white py-20">
        <div className="max-w-4xl mx-auto px-4 text-center">
          <h1 className="text-4xl md:text-5xl font-bold mb-6">
            Join PleasureZone Uganda
          </h1>
          <p className="text-xl text-gray-300 max-w-2xl mx-auto">
            Help us build East Africa&apos;s most trusted intimate wellness platform.
            We&apos;re growing fast and looking for people who believe everyone deserves
            access to quality products without stigma.
          </p>
        </div>
      </section>

      {/* Why Join Us */}
      <section className="py-16 bg-surface">
        <div className="max-w-5xl mx-auto px-4">
          <h2 className="text-2xl font-semibold text-center mb-10">Why Work With Us</h2>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {perks.map((perk) => (
              <div key={perk.title} className="card text-center">
                <perk.icon className="w-8 h-8 text-primary mx-auto mb-3" />
                <h3 className="font-medium mb-1">{perk.title}</h3>
                <p className="text-text-muted text-sm">{perk.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Open Positions */}
      <section className="py-16 bg-surface-secondary">
        <div className="max-w-3xl mx-auto px-4">
          <h2 className="text-2xl font-semibold text-center mb-2">Open Positions</h2>
          <p className="text-text-muted text-center mb-10">
            Don&apos;t see a role that fits? Send your CV to{" "}
            <a href="mailto:careers@pleasurezone.ug" className="link">careers@pleasurezone.ug</a>
          </p>

          <div className="space-y-4">
            {openings.map((job) => (
              <div key={job.title} className="card group cursor-pointer">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <h3 className="text-lg font-medium mb-1 group-hover:text-primary transition-colors">
                      {job.title}
                    </h3>
                    <p className="text-text-muted text-sm mb-3">{job.description}</p>
                    <div className="flex flex-wrap gap-3 text-xs text-text-muted">
                      <span className="flex items-center gap-1">
                        <Clock className="w-3.5 h-3.5" /> {job.type}
                      </span>
                      <span className="flex items-center gap-1">
                        <MapPin className="w-3.5 h-3.5" /> {job.location}
                      </span>
                    </div>
                  </div>
                  <ChevronRight className="w-5 h-5 text-text-muted group-hover:text-primary transition-colors mt-1 shrink-0" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Become a Seller / Agent CTA */}
      <section className="py-16 bg-surface">
        <div className="max-w-3xl mx-auto px-4 text-center">
          <h2 className="text-2xl font-semibold mb-4">Other Ways to Earn</h2>
          <div className="grid sm:grid-cols-2 gap-6">
            <div className="card">
              <Briefcase className="w-8 h-8 text-primary mx-auto mb-3" />
              <h3 className="font-medium mb-2">Sell on PleasureZone</h3>
              <p className="text-text-muted text-sm mb-4">
                List your products on our marketplace and reach thousands of customers.
              </p>
              <Link href="/seller/register" className="btn-primary text-sm">
                Start Selling
              </Link>
            </div>
            <div className="card">
              <Users className="w-8 h-8 text-primary mx-auto mb-3" />
              <h3 className="font-medium mb-2">Join the Affiliate Program</h3>
              <p className="text-text-muted text-sm mb-4">
                Earn commission by referring customers. No inventory needed.
              </p>
              <Link href="/affiliate" className="btn-primary text-sm">
                Become an Affiliate
              </Link>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
