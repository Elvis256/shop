"use client";

import Image from "next/image";
import Link from "next/link";
import { Shield, Heart, Lock, Truck, Award, Users } from "lucide-react";

export default function AboutPage() {
  return (
    <div className="min-h-screen">
      {/* Hero Section */}
      <section className="bg-gradient-to-br from-gray-900 to-gray-800 text-white py-20">
        <div className="max-w-4xl mx-auto px-4 text-center">
          <h1 className="text-4xl md:text-5xl font-bold mb-6">
            Your Trusted Partner in Intimate Wellness
          </h1>
          <p className="text-xl text-gray-300 max-w-2xl mx-auto">
            We believe everyone deserves access to high-quality intimate products 
            in a safe, discreet, and judgment-free environment.
          </p>
        </div>
      </section>

      {/* Mission Section */}
      <section className="py-16 bg-white">
        <div className="max-w-6xl mx-auto px-4">
          <div className="grid md:grid-cols-2 gap-12 items-center">
            <div>
              <h2 className="text-3xl font-bold mb-6">Our Mission</h2>
              <p className="text-gray-600 mb-4">
                Founded with a vision to normalize conversations around intimate wellness, 
                we've grown to become East Africa's most trusted adult store.
              </p>
              <p className="text-gray-600 mb-4">
                We carefully curate our collection to include only premium, body-safe products 
                from reputable brands worldwide. Every item undergoes rigorous quality checks 
                before reaching our shelves.
              </p>
              <p className="text-gray-600">
                Our commitment goes beyond just selling products – we're here to educate, 
                support, and empower you on your journey to better intimate wellness.
              </p>
            </div>
            <div className="bg-gray-100 rounded-2xl p-8">
              <div className="grid grid-cols-2 gap-6">
                <div className="text-center">
                  <div className="text-4xl font-bold text-accent">10K+</div>
                  <div className="text-gray-600 text-sm">Happy Customers</div>
                </div>
                <div className="text-center">
                  <div className="text-4xl font-bold text-accent">500+</div>
                  <div className="text-gray-600 text-sm">Products</div>
                </div>
                <div className="text-center">
                  <div className="text-4xl font-bold text-accent">100%</div>
                  <div className="text-gray-600 text-sm">Discreet Delivery</div>
                </div>
                <div className="text-center">
                  <div className="text-4xl font-bold text-accent">4.8★</div>
                  <div className="text-gray-600 text-sm">Customer Rating</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Values Section */}
      <section className="py-16 bg-gray-50">
        <div className="max-w-6xl mx-auto px-4">
          <h2 className="text-3xl font-bold text-center mb-12">Why Choose Us</h2>
          <div className="grid md:grid-cols-3 gap-8">
            <div className="bg-white rounded-xl p-6 text-center">
              <div className="w-14 h-14 bg-accent/10 rounded-full flex items-center justify-center mx-auto mb-4">
                <Lock className="w-7 h-7 text-accent" />
              </div>
              <h3 className="font-semibold text-lg mb-2">100% Private & Discreet</h3>
              <p className="text-gray-600 text-sm">
                Plain packaging, discreet billing, and secure transactions. 
                Your privacy is our top priority.
              </p>
            </div>
            <div className="bg-white rounded-xl p-6 text-center">
              <div className="w-14 h-14 bg-accent/10 rounded-full flex items-center justify-center mx-auto mb-4">
                <Shield className="w-7 h-7 text-accent" />
              </div>
              <h3 className="font-semibold text-lg mb-2">Body-Safe Products</h3>
              <p className="text-gray-600 text-sm">
                We only stock products made from medical-grade, body-safe materials. 
                Your health matters.
              </p>
            </div>
            <div className="bg-white rounded-xl p-6 text-center">
              <div className="w-14 h-14 bg-accent/10 rounded-full flex items-center justify-center mx-auto mb-4">
                <Truck className="w-7 h-7 text-accent" />
              </div>
              <h3 className="font-semibold text-lg mb-2">Fast & Secure Delivery</h3>
              <p className="text-gray-600 text-sm">
                Nationwide delivery with real-time tracking. 
                Same-day delivery available in Kampala.
              </p>
            </div>
            <div className="bg-white rounded-xl p-6 text-center">
              <div className="w-14 h-14 bg-accent/10 rounded-full flex items-center justify-center mx-auto mb-4">
                <Award className="w-7 h-7 text-accent" />
              </div>
              <h3 className="font-semibold text-lg mb-2">Quality Guaranteed</h3>
              <p className="text-gray-600 text-sm">
                All products come with manufacturer warranty. 
                Not satisfied? We offer hassle-free returns.
              </p>
            </div>
            <div className="bg-white rounded-xl p-6 text-center">
              <div className="w-14 h-14 bg-accent/10 rounded-full flex items-center justify-center mx-auto mb-4">
                <Heart className="w-7 h-7 text-accent" />
              </div>
              <h3 className="font-semibold text-lg mb-2">Expert Support</h3>
              <p className="text-gray-600 text-sm">
                Our knowledgeable team is here to help you find the perfect products 
                for your needs.
              </p>
            </div>
            <div className="bg-white rounded-xl p-6 text-center">
              <div className="w-14 h-14 bg-accent/10 rounded-full flex items-center justify-center mx-auto mb-4">
                <Users className="w-7 h-7 text-accent" />
              </div>
              <h3 className="font-semibold text-lg mb-2">Inclusive & Welcoming</h3>
              <p className="text-gray-600 text-sm">
                We celebrate all bodies, identities, and orientations. 
                Everyone is welcome here.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-16 bg-accent text-white">
        <div className="max-w-4xl mx-auto px-4 text-center">
          <h2 className="text-3xl font-bold mb-4">Ready to Explore?</h2>
          <p className="text-lg text-white/80 mb-8">
            Browse our curated collection of premium intimate products.
          </p>
          <Link
            href="/category"
            className="inline-flex items-center gap-2 bg-white text-accent px-8 py-3 rounded-lg font-semibold hover:bg-gray-100 transition-colors"
          >
            Shop Now
          </Link>
        </div>
      </section>
    </div>
  );
}
