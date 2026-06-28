/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Building2,
  CalendarCheck2,
  Users2,
  Coins,
  Wrench,
  Globe2,
  ArrowRight,
  Smartphone,
  Check,
  ChevronRight,
} from 'lucide-react';


interface LandingPageProps {
  onNavigate: (route: 'landing' | 'demo' | 'login') => void;
}

export default function LandingPage({ onNavigate }: LandingPageProps) {
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  const [activeFeatureTab, setActiveFeatureTab] = useState(0);
  const heroRef = useRef<HTMLDivElement>(null);

  // Mouse move listener for liquid mercury / spotlight effect
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (heroRef.current) {
        const rect = heroRef.current.getBoundingClientRect();
        // Calculate relative position inside the hero container
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        setMousePos({ x, y });
      }
    };

    window.addEventListener('mousemove', handleMouseMove);
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, []);

  const features = [
    {
      id: 'rooms',
      icon: Building2,
      label: 'Room & Unit Management',
      title: 'Live room states, housekeepers, and maintenance sync.',
      desc: 'Track physical rooms across floor-plans, instantly toggle housekeeping between Clean, Dirty, or Inspecting, and lock down rooms under maintenance in real-time.',
      badge: 'Live Operations',
      details: [
        'Interactive floor layouts with quick statuses',
        'Automatic dirty tag generation upon check-out',
        'Direct maintenance dispatch from the room card'
      ],
      interactiveType: 'rooms'
    },
    {
      id: 'bookings',
      icon: CalendarCheck2,
      label: 'Smart Bookings',
      title: 'Full booking lifecycle — walk-ins, OTA, WhatsApp.',
      desc: 'Simultaneously monitor Booking.com, Airbnb, WhatsApp inquiries, and manual walk-ins. Detect over-stays and pending payouts in a unified, multi-layered calendar grid.',
      badge: 'Unified Inbox',
      details: [
        'Single-click walk-in creation with automated pricing',
        'Smart check-out tracking for prompt room turnover',
        'WhatsApp guest message templates with instant booking codes'
      ],
      interactiveType: 'bookings'
    },
    {
      id: 'guests',
      icon: Users2,
      label: 'Guest Profiles & VIPs',
      title: 'CNIC/Passport scanning, stay history, and identity logs.',
      desc: 'Maintain pristine records of guest preferences, legal identity files, aggregate stay counts, and total spending to serve VIPs with tailored hospitality.',
      badge: 'CRM Core',
      details: [
        'Instant digital identity proof file storage',
        'VIP custom tagging and stay preference records',
        'Direct connection to guest WhatsApp & Email channels'
      ],
      interactiveType: 'guests'
    },
    {
      id: 'finance',
      icon: Coins,
      label: 'Finance & Investors',
      title: 'Expense audit tracks, equity sheets, and P&L logs.',
      desc: 'Break down operating costs like housekeeping supplies, utilities, or staff payouts. Share clear equity percentages and quarterly P&L logs with hotel owners.',
      badge: 'Equity Core',
      details: [
        'Bespoke visual profit & loss monthly grids',
        'Instant equity split calculators for fractional investors',
        'Categorized audit trails for every rupee spent'
      ],
      interactiveType: 'finance'
    },
    {
      id: 'maintenance',
      icon: Wrench,
      label: 'Maintenance Workflow',
      title: 'Issue tickets, assigned vendors, and photographic proofs.',
      desc: 'Empower housekeepers to take photo logs of damages, assign external HVAC/electrical technicians, and track final repairs before putting rooms back in the market.',
      badge: 'Fault Logs',
      details: [
        'Before/after damage log photo uploads',
        'Vendor cost records and payment logs',
        'Urgency tag priorities (High / Medium / Low)'
      ],
      interactiveType: 'maintenance'
    },
    {
      id: 'website',
      icon: Globe2,
      label: 'Website Integration',
      title: 'Direct web booking requests stream straight into your console.',
      desc: 'Replace expensive third-party channel managers with a beautiful direct-booking guest portal. All requests update your live operations screen instantly.',
      badge: 'Zero Commissions',
      details: [
        'Free, direct-to-database booking widget integration',
        'Real-time notifications for incoming guest requests',
        'Commission-free guest reservation flow'
      ],
      interactiveType: 'website'
    }
  ];

  return (
    <div className="min-h-screen bg-[#070708] text-[#F3EFE9] font-sans overflow-x-hidden selection:bg-[#c5a880] selection:text-[#0a0a0a]">
      {/* Decorative Mercury Backdrop Light */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-[1400px] h-[600px] overflow-hidden pointer-events-none z-0">
        <div className="absolute top-[-250px] left-1/2 -translate-x-1/2 w-[700px] h-[500px] bg-[radial-gradient(ellipse_at_center,rgba(197,168,128,0.08)_0%,rgba(197,168,128,0.01)_60%,transparent_100%)] blur-3xl" />
        <div className="absolute top-[100px] left-1/4 w-[250px] h-[250px] bg-[#c5a880]/[0.02] rounded-full blur-3xl animate-pulse" />
        <div className="absolute top-[150px] right-1/4 w-[300px] h-[300px] bg-[#9e7546]/[0.015] rounded-full blur-3xl animate-pulse" style={{ animationDuration: '6s' }} />
      </div>

      {/* Navigation Header */}
      <header className="sticky top-0 z-50 w-full border-b border-white/[0.04] bg-[#070708]/80 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
        <div className="flex items-center space-x-3 group cursor-pointer" onClick={() => onNavigate('landing')}>
          <div className="relative w-9 h-9 rounded-lg border border-[#c5a880]/30 flex items-center justify-center bg-black overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-tr from-[#c5a880]/20 to-transparent" />
            <span className="font-serif font-semibold text-lg text-[#c5a880] tracking-wider">Z</span>
          </div>
          <div>
            <span className="font-display font-medium text-base tracking-widest text-white block">ZAVARI<span className="text-[#c5a880]">HAUS</span></span>
            <span className="text-[10px] uppercase tracking-[0.25em] text-[#c5a880]/80 block font-mono">Hotel Management</span>
          </div>
        </div>

          <nav className="hidden md:flex items-center space-x-8 text-xs font-mono uppercase tracking-widest text-[#F3EFE9]/70">
            <a href="#features" className="hover:text-[#c5a880] transition-colors">Features</a>
            <a href="#sandbox" className="hover:text-[#c5a880] transition-colors">Try Demo</a>
            <a href="#about" className="hover:text-[#c5a880] transition-colors">About</a>
          </nav>

          <div className="flex items-center space-x-4">
            <button
              id="nav-login-btn"
              onClick={() => onNavigate('login')}
              className="text-xs font-mono uppercase tracking-widest hover:text-[#c5a880] transition-colors px-4 py-2 border border-transparent hover:border-white/[0.08] rounded-md"
            >
              Admin Login
            </button>
            <button
              id="nav-demo-btn"
              onClick={() => onNavigate('demo')}
              className="relative overflow-hidden text-xs font-mono uppercase tracking-widest px-5 py-2.5 bg-[#c5a880] text-black font-semibold rounded-md transition-all duration-300 hover:bg-[#b48e5c] hover:shadow-[0_0_20px_rgba(197,168,128,0.2)] group"
            >
              <span className="relative z-10 flex items-center">
                Live Demo <ArrowRight className="w-3.5 h-3.5 ml-1.5 group-hover:translate-x-1 transition-transform" />
              </span>
            </button>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section
        id="hero-section"
        ref={heroRef}
        className="relative min-h-[90vh] flex flex-col justify-center items-center px-6 pt-12 pb-24 z-10"
      >
        {/* Interactive Liquid Mercury Spotlight Element */}
        <div
          className="absolute pointer-events-none rounded-full bg-[radial-gradient(circle_at_center,rgba(197,168,128,0.12)_0%,rgba(197,168,128,0.03)_40%,transparent_70%)] blur-2xl z-0 transition-opacity duration-300 hidden md:block"
          style={{
            width: '600px',
            height: '600px',
            left: `${mousePos.x - 300}px`,
            top: `${mousePos.y - 300}px`,
          }}
        />

        <div className="max-w-4xl mx-auto text-center space-y-8 relative z-10">
          {/* Subtle Tagline Badge */}
          <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="inline-flex items-center space-x-2 px-3 py-1.5 rounded-full border border-[#c5a880]/20 bg-[#c5a880]/[0.03] backdrop-blur-md"
          >
          </motion.div>

          {/* Master Display Typography */}
          <div className="space-y-4">
            <motion.h1
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.1 }}
              className="text-4xl sm:text-6xl lg:text-7xl font-light font-display tracking-tight text-white leading-[1.1]"
            >
              ZavariHaus <br />
              <span className="font-serif italic font-medium text-[#c5a880] tracking-wide">Hotel Management System</span>
            </motion.h1>

            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.2 }}
              className="text-base sm:text-lg text-[#F3EFE9]/70 max-w-2xl mx-auto font-light leading-relaxed"
            >
              Bookings, rooms, guests, housekeeping, expenses, and investor reporting — in one dashboard.
            </motion.p>
          </div>

          {/* Luxury Actions */}
          <motion.div
            initial={{ opacity: 0, y: 25 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.3 }}
            className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-4"
          >
            <button
              id="hero-demo-btn"
              onClick={() => onNavigate('demo')}
              className="w-full sm:w-auto relative px-8 py-4 bg-white text-black font-semibold rounded-lg text-sm tracking-wider uppercase font-mono shadow-[0_4px_30px_rgba(255,255,255,0.05)] hover:shadow-[0_0_30px_rgba(197,168,128,0.3)] transition-all duration-300 group overflow-hidden"
            >
              {/* Interactive liquid slide background */}
              <span className="absolute inset-0 w-full h-full bg-gradient-to-r from-[#e8dbbf] to-[#c5a880] transform scale-x-0 group-hover:scale-x-100 transition-transform duration-500 origin-left -z-0" />
              <span className="relative z-10 flex items-center justify-center">
                View Live Demo
                <ArrowRight className="w-4 h-4 ml-2 group-hover:translate-x-1 transition-transform" />
              </span>
            </button>

            <button
              id="hero-login-btn"
              onClick={() => onNavigate('login')}
              className="w-full sm:w-auto px-8 py-4 rounded-lg text-sm tracking-wider uppercase font-mono border border-white/10 hover:border-[#c5a880]/60 hover:bg-white/[0.02] transition-all duration-300 flex items-center justify-center"
            >
              Admin Login <ChevronRight className="w-4 h-4 ml-1.5 opacity-60" />
            </button>
          </motion.div>

          {/* Quick Metrics Banner */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 1, delay: 0.5 }}
            className="grid grid-cols-2 md:grid-cols-4 gap-4 max-w-3xl mx-auto pt-16"
          >
            {[
              { num: '7+', label: 'Room Types' },
              { num: '100%', label: 'Browser-Based' },
              { num: 'Audit', label: 'Real-time Logs' },
              { num: 'Multi-Role', label: 'Staff Access' }
            ].map((m, i) => (
              <div key={i} className="p-4 rounded-lg border border-white/[0.03] bg-white/[0.01] backdrop-blur-sm">
                <span className="block text-xl font-display font-medium text-[#c5a880]">{m.num}</span>
                <span className="block text-[10px] uppercase tracking-widest text-[#F3EFE9]/40 mt-1 font-mono">{m.label}</span>
              </div>
            ))}
          </motion.div>
        </div>

        {/* Minimal interactive dashboard card preview */}
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1, delay: 0.4 }}
          className="w-full max-w-5xl mx-auto mt-20 relative px-4"
        >
          <div className="absolute inset-0 bg-[#c5a880]/[0.03] rounded-2xl blur-3xl" />
          <div className="relative rounded-xl border border-white/10 bg-[#0d0d0f]/90 p-1.5 shadow-[0_25px_60px_-15px_rgba(0,0,0,0.9)]">
            {/* Window bar */}
            <div className="flex items-center justify-between px-4 py-2 border-b border-white/[0.04]">
              <div className="flex items-center space-x-2">
                <span className="w-2.5 h-2.5 rounded-full bg-red-500/40" />
                <span className="w-2.5 h-2.5 rounded-full bg-yellow-500/40" />
                <span className="w-2.5 h-2.5 rounded-full bg-green-500/40" />
                <span className="text-[10px] text-white/30 font-mono pl-2">ZavariHaus Admin Sandbox Console - 2026</span>
              </div>
              <div className="flex items-center space-x-3">
                <span className="text-[10px] font-mono py-0.5 px-2 rounded bg-green-500/10 text-green-400 border border-green-500/20 flex items-center gap-1.5 animate-pulse">
                  <span className="w-1.5 h-1.5 rounded-full bg-green-400" /> Connected
                </span>
              </div>
            </div>

            {/* Dashboard Mockup Details */}
            <div className="grid grid-cols-1 md:grid-cols-12 gap-4 p-4 min-h-[300px]">
              {/* Rooms Preview Panel */}
              <div className="md:col-span-8 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <span className="text-xs uppercase font-mono tracking-widest text-[#c5a880]">Active Room Matrix</span>
                    <span className="text-[10px] font-mono px-1.5 py-0.5 bg-white/5 rounded text-white/60">Live State</span>
                  </div>
                  <span className="text-[10px] font-mono text-white/40">Total Rooms: 8</span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {[
                    { nr: '101', name: 'Royal Silk Suite', stat: 'Occupied', hk: 'Clean' },
                    { nr: '102', name: 'Jasmine Studio', stat: 'Occupied', hk: 'Clean' },
                    { nr: '103', name: 'Karakoram Vista', stat: 'Available', hk: 'Clean' },
                    { nr: '201', name: 'Onyx Penthouse', stat: 'Booked', hk: 'Inspecting' },
                    { nr: '202', name: 'Mughal Suite', stat: 'Available', hk: 'Dirty' },
                    { nr: '203', name: 'Citrus Studio', stat: 'Maintenance', hk: 'Dirty' },
                    { nr: '301', name: 'Indus Double', stat: 'Occupied', hk: 'Clean' },
                    { nr: '302', name: 'Himalayan Retreat', stat: 'Available', hk: 'Clean' }
                  ].map((rm, i) => (
                    <div key={i} className="p-3 rounded bg-white/[0.02] border border-white/[0.05] hover:border-[#c5a880]/30 transition-all duration-300 cursor-pointer">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-mono font-medium text-white">{rm.nr}</span>
                        <span className={`w-2 h-2 rounded-full ${rm.stat === 'Occupied' ? 'bg-amber-500' :
                            rm.stat === 'Available' ? 'bg-green-500' :
                              rm.stat === 'Booked' ? 'bg-blue-500' : 'bg-red-500'
                          }`} />
                      </div>
                      <p className="text-[10px] text-white/50 truncate mt-1.5 font-light">{rm.name}</p>
                      <div className="flex items-center justify-between mt-2 pt-1.5 border-t border-white/[0.03]">
                        <span className="text-[9px] font-mono uppercase text-white/40">{rm.stat}</span>
                        <span className={`text-[8px] font-mono px-1 rounded ${rm.hk === 'Clean' ? 'bg-green-500/10 text-green-400' :
                            rm.hk === 'Dirty' ? 'bg-red-500/10 text-red-400' : 'bg-yellow-500/10 text-yellow-400'
                          }`}>{rm.hk}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Sidebar Action Simulator */}
              <div className="md:col-span-4 border-l border-white/[0.04] pl-4 space-y-4">
                <div className="text-xs uppercase font-mono tracking-widest text-[#c5a880]">Real-time Sync Stream</div>
                <div className="space-y-2 bg-black/40 p-3 rounded border border-white/[0.03] max-h-[220px] overflow-y-auto font-mono text-[9px] text-white/60">
                  <span className="text-[10px] font-mono text-white/30">[04:28:10] Syncing bookings database...</span>
                  <div className="text-amber-400/80">[04:28:15] GUEST_CHECKIN | Zara Alizai (102)</div>
                  <div className="text-green-400/80">[04:28:18] ROOM 102 state → OCCUPIED</div>
                  <div className="text-white/30">[04:28:30] Web requests polled: 0 pending</div>
                  <div className="text-red-400/80">[04:28:44] MAINTENANCE: Room 203 flag HIGH</div>
                  <div className="text-[#c5a880] animate-pulse">[04:28:56] SYNC: Local state engine active</div>
                </div>

                <button
                  onClick={() => onNavigate('demo')}
                  className="w-full py-2.5 rounded bg-[#c5a880]/10 hover:bg-[#c5a880]/20 border border-[#c5a880]/30 text-xs text-[#c5a880] font-mono uppercase tracking-widest transition-all duration-300"
                >
                  Open Live Demo
                </button>
              </div>
            </div>
          </div>
        </motion.div>
      </section>

      {/* Built For Every Corner Section */}
      <section id="features" className="py-24 border-t border-white/[0.04] bg-[#09090a] relative">
        <div className="max-w-7xl mx-auto px-6">
          <div className="max-w-3xl mx-auto text-center space-y-4 mb-20">
            <h2 className="text-xs uppercase tracking-[0.25em] text-[#c5a880] font-mono">Operations Framework</h2>
            <p className="text-3xl sm:text-4xl font-light font-display text-white">
            Built for every corner of your <span className="font-serif italic text-[#c5a880]">hotel operations</span>
          </p>
          <p className="text-sm text-white/50 max-w-lg mx-auto font-light">
            Stop stitching separate tools together. Manage walk-ins, housekeeping, maintenance, and investor payouts inside one platform.
          </p>
          </div>

          {/* Interactive Bento Feature Showcase */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
            {/* Feature Select List (Left side) */}
            <div className="lg:col-span-5 space-y-3">
              {features.map((feat, index) => {
                const IconComponent = feat.icon;
                const isSelected = activeFeatureTab === index;
                return (
                  <div
                    key={feat.id}
                    onClick={() => setActiveFeatureTab(index)}
                    className={`p-4 rounded-xl border transition-all duration-300 cursor-pointer text-left flex items-start space-x-4 ${isSelected
                        ? 'bg-[#121215] border-[#c5a880]/40 shadow-[0_4px_20px_rgba(0,0,0,0.4)]'
                        : 'bg-transparent border-white/[0.02] hover:border-white/[0.08] hover:bg-white/[0.01]'
                      }`}
                  >
                    <div className={`p-2.5 rounded-lg border transition-colors ${isSelected ? 'bg-[#c5a880] border-[#c5a880] text-black' : 'bg-white/[0.02] border-white/[0.06] text-[#c5a880]'
                      }`}>
                      <IconComponent className="w-5 h-5" />
                    </div>
                    <div className="space-y-1">
                      <div className="flex items-center space-x-2">
                        <span className={`text-xs font-semibold tracking-wider font-mono ${isSelected ? 'text-white' : 'text-white/80'}`}>{feat.label}</span>
                        {isSelected && (
                          <span className="text-[8px] uppercase font-mono px-1.5 py-0.5 bg-[#c5a880]/15 text-[#c5a880] rounded border border-[#c5a880]/20">Active</span>
                        )}
                      </div>
                      <p className="text-xs text-white/40 font-light truncate max-w-[250px]">{feat.title}</p>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Feature Rich Sandbox Details (Right side) */}
            <div className="lg:col-span-7 rounded-2xl border border-white/[0.06] bg-[#0c0c0e] p-6 sm:p-8 min-h-[460px] flex flex-col justify-between relative overflow-hidden">
              <div className="absolute top-0 right-0 w-[200px] h-[200px] bg-[#c5a880]/[0.01] rounded-full blur-3xl pointer-events-none" />

              <AnimatePresence mode="wait">
                <motion.div
                  key={activeFeatureTab}
                  initial={{ opacity: 0, x: 15 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -15 }}
                  transition={{ duration: 0.4 }}
                  className="space-y-6"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-mono tracking-widest uppercase text-[#c5a880] px-2 py-0.5 rounded bg-[#c5a880]/5 border border-[#c5a880]/10">
                      {features[activeFeatureTab].badge}
                    </span>
                    <span className="text-[10px] font-mono text-white/30">MODULE 0{activeFeatureTab + 1}</span>
                  </div>

                  <div className="space-y-3 text-left">
                    <h3 className="text-2xl font-light font-display text-white">{features[activeFeatureTab].title}</h3>
                    <p className="text-sm text-white/60 font-light leading-relaxed">{features[activeFeatureTab].desc}</p>
                  </div>

                  <div className="space-y-3 pt-4 border-t border-white/[0.05] text-left">
                    <span className="text-xs font-mono text-white/40 uppercase tracking-widest block mb-1">Standard Workflows Included</span>
                    <div className="grid grid-cols-1 sm:grid-cols-1 gap-2.5">
                      {features[activeFeatureTab].details.map((detail, idx) => (
                        <div key={idx} className="flex items-start space-x-2.5 text-xs text-white/70">
                          <Check className="w-4 h-4 text-[#c5a880] shrink-0 mt-0.5" />
                          <span className="font-light">{detail}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </motion.div>
              </AnimatePresence>

              {/* Simulated Micro UI View */}
              <div className="mt-8 pt-6 border-t border-white/[0.05] flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className="w-2.5 h-2.5 rounded-full bg-[#c5a880] animate-ping" />
                  <span className="text-[10px] font-mono text-white/40 uppercase tracking-widest">Interactive in Demo Sandbox</span>
                </div>
                <button
                  onClick={() => onNavigate('demo')}
                  className="text-xs font-mono tracking-widest text-[#c5a880] hover:text-[#e8dbbf] transition-colors flex items-center group"
                >
                  Try in Demo <ArrowRight className="w-3.5 h-3.5 ml-1.5 group-hover:translate-x-1 transition-transform" />
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Exquisite Details Section */}
      <section id="about" className="py-24 bg-[#070708] relative">
        <div className="max-w-7xl mx-auto px-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
            <div className="space-y-8 text-left">
              <span className="text-xs uppercase tracking-[0.25em] text-[#c5a880] font-mono block">The Aesthetic Imperative</span>
              <h2 className="text-3xl sm:text-5xl font-light font-display text-white leading-tight">
                A complete hotel operations tool,<br />
                <span className="font-serif italic font-medium text-[#c5a880]">properly designed</span>
              </h2>
              <p className="text-sm text-white/60 font-light leading-relaxed">
                Most hotel tools are cluttered, require staff training, and aren't made for smaller properties.
                <br /><br />
                ZavariHaus keeps it focused. Receptionists can check in guests, track room states, and log expenses without hunting through menus.
              </p>

              <div className="grid grid-cols-2 gap-6 pt-4 font-mono">
                <div className="space-y-2 border-l border-[#c5a880]/30 pl-4">
                  <div className="text-xs text-white/40 uppercase tracking-wider">Interface Language</div>
                  <div className="text-sm text-white font-medium">Liquid Glass Theme</div>
                </div>
                <div className="space-y-2 border-l border-[#c5a880]/30 pl-4">
                  <div className="text-xs text-white/40 uppercase tracking-wider">Database Mode</div>
                  <div className="text-sm text-white font-medium">Instant State Cache</div>
                </div>
              </div>
            </div>

            <div className="relative rounded-2xl border border-[#c5a880]/20 bg-gradient-to-tr from-[#121214] to-[#09090a] p-8 overflow-hidden group">
              <div className="absolute top-[-100px] left-[-100px] w-[300px] h-[300px] bg-[#c5a880]/[0.02] rounded-full blur-3xl" />

              <div className="space-y-6 relative z-10 text-left">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-mono uppercase tracking-widest text-[#c5a880]">Zavari Philosophy</span>
                  <Smartphone className="w-4 h-4 text-white/30" />
                </div>

                <h3 className="text-xl font-serif text-[#c5a880] italic">"Good tools stay out of the way."</h3>
                <p className="text-xs text-white/50 leading-relaxed font-light">
                  When a guest checks in, the receptionist should be focused on them, not the screen. Every action in ZavariHaus is designed to complete in 2–3 clicks with no friction.
                </p>

                <div className="space-y-3 pt-6 border-t border-white/[0.05] text-xs">
                  {[
                    'Identity proof scanning and filing',
                    'Automatic dirty-flag on room check-out',
                    'Local cache + database sync'
                  ].map((phrase, i) => (
                    <div key={i} className="flex items-center space-x-2 text-white/70 font-light">
                      <div className="w-1.5 h-1.5 rounded-full bg-[#c5a880]" />
                      <span>{phrase}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section id="sandbox" className="py-24 border-t border-white/[0.04] bg-gradient-to-b from-[#09090a] to-black relative">
        <div className="max-w-4xl mx-auto px-6 text-center space-y-8 relative z-10">
          <h2 className="text-xs uppercase tracking-[0.25em] text-[#c5a880] font-mono">No signup needed</h2>
          <p className="text-3xl sm:text-5xl font-light font-display text-white">
            See it working <span className="font-serif italic text-[#c5a880]">right now</span>
          </p>
          <p className="text-sm text-white/50 max-w-lg mx-auto font-light leading-relaxed">
            Click View Live Demo to enter a fully pre-populated hotel setup. Explore bookings, rooms, guests, and expenses — no account required.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-4">
            <button
              id="footer-demo-btn"
              onClick={() => onNavigate('demo')}
              className="w-full sm:w-auto relative px-8 py-4 bg-[#c5a880] text-black font-semibold rounded-lg text-sm tracking-wider uppercase font-mono shadow-[0_4px_30px_rgba(197,168,128,0.15)] hover:bg-[#b48e5c] transition-all duration-300"
            >
              View Live Demo
            </button>
            <button
              id="footer-login-btn"
              onClick={() => onNavigate('login')}
              className="w-full sm:w-auto px-8 py-4 rounded-lg text-sm tracking-wider uppercase font-mono border border-white/10 hover:border-[#c5a880]/60 hover:bg-white/[0.02] transition-all duration-300"
            >
              Admin Login
            </button>
          </div>

          <p className="text-[10px] font-mono text-white/30 pt-8 uppercase tracking-widest">
            ZavariHaus — Hotel Management System
          </p>
        </div>
      </section>
    </div>
  );
}
