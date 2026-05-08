import { Link } from 'react-router-dom'
import {
  Package,
  Shield,
  Clock,
  Award,
  Phone,
  MapPin,
  Mail,
  ChevronRight,
  Star,
  Truck,
  Cog,
  Zap,
  ArrowRight,
  Wrench,
  Car,
  CircuitBoard,
  Droplets,
} from 'lucide-react'

const services = [
  { icon: Cog, title: 'Engine Parts', desc: 'Pistons, gaskets, timing belts, oil filters and complete engine component kits for all makes.' },
  { icon: Car, title: 'Body & Interior', desc: 'Mirrors, bumpers, lights, seats, and interior trim parts to keep your vehicle looking great.' },
  { icon: CircuitBoard, title: 'Electrical Parts', desc: 'Batteries, alternators, starters, sensors, and wiring for reliable electrical performance.' },
  { icon: Droplets, title: 'Brakes & Suspension', desc: 'Brake pads, rotors, shock absorbers, and steering components for safe driving.' },
  { icon: Truck, title: 'Bulk Orders', desc: 'Wholesale pricing on bulk orders for garages, workshops, and fleet operators.' },
  { icon: Shield, title: 'Genuine & OEM', desc: 'Original and quality aftermarket parts sourced from trusted manufacturers worldwide.' },
]

const stats = [
  { value: '10+', label: 'Years in Business' },
  { value: '10,000+', label: 'Parts in Stock' },
  { value: '98%', label: 'Customer Satisfaction' },
  { value: 'Same Day', label: 'Delivery Available' },
]

const reviews = [
  { name: 'Kamal Perera', text: 'Always have the parts I need in stock. Fair prices and genuine quality. My go-to shop for all spares.', stars: 5 },
  { name: 'Nimal Silva', text: 'Great selection of engine and brake parts. They even sourced a rare part for my old model within a day.', stars: 5 },
  { name: 'Anura Jayewardene', text: 'Reliable supplier for our workshop. Bulk orders are always on time and well-packed. Highly recommended.', stars: 4 },
]

export function LandingPage() {
  return (
    <div className="min-h-screen bg-[#0a0f0f] text-white overflow-x-hidden">
      {/* Navbar */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-[#0a0f0f]/80 backdrop-blur-lg border-b border-white/5">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center border border-emerald-900/40 overflow-hidden bg-white/90">
              <img src="/Gelioya motors logo 01.png" alt="Gelioya Motors" className="w-8 h-8 object-contain" />
            </div>
            <div>
              <h1 className="text-base font-bold text-white leading-tight">Gelioya Motors</h1>
              <p className="text-[10px] text-emerald-400/80 font-medium tracking-wider uppercase">Auto Spare Parts</p>
            </div>
          </div>
          <div className="hidden md:flex items-center gap-8 text-sm text-slate-400">
            <a href="#about" className="hover:text-white transition-colors">About</a>
            <a href="#services" className="hover:text-white transition-colors">Products</a>
            <a href="#reviews" className="hover:text-white transition-colors">Reviews</a>
            <a href="#contact" className="hover:text-white transition-colors">Contact</a>
          </div>
          <Link
            to="/login"
            className="flex items-center gap-2 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-semibold rounded-xl transition-colors"
          >
            Business Login <ArrowRight size={14} />
          </Link>
        </div>
      </nav>

      {/* Hero */}
      <section className="relative pt-32 pb-20 lg:pt-44 lg:pb-32">
        {/* Background glow */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[600px] bg-emerald-500/5 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute top-20 right-0 w-[400px] h-[400px] bg-blue-500/5 rounded-full blur-3xl pointer-events-none" />

        <div className="relative max-w-7xl mx-auto px-6 text-center">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-emerald-500/10 border border-emerald-900/30 rounded-full text-emerald-400 text-xs font-semibold mb-6">
            <Award size={14} />
            Trusted Since 2015
          </div>
          <h1 className="text-4xl sm:text-5xl lg:text-7xl font-extrabold leading-tight tracking-tight">
            Quality Spare Parts
            <br />
            <span className="bg-gradient-to-r from-emerald-400 via-emerald-300 to-teal-400 bg-clip-text text-transparent">
              You Can Trust
            </span>
          </h1>
          <p className="mt-6 text-lg text-slate-400 max-w-2xl mx-auto leading-relaxed">
            Gelioya Motors is your one-stop shop for genuine and quality aftermarket auto spare parts. From engine components to body parts, we stock everything your vehicle needs at competitive prices.
          </p>
          <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
            <a
              href="#contact"
              className="flex items-center gap-2 px-8 py-4 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-2xl transition-colors text-base shadow-lg shadow-emerald-900/30"
            >
              Contact Us <ChevronRight size={18} />
            </a>
            <a
              href="#services"
              className="flex items-center gap-2 px-8 py-4 bg-white/5 hover:bg-white/10 border border-white/10 text-white font-semibold rounded-2xl transition-colors text-base"
            >
              Browse Products
            </a>
          </div>

          {/* Stats */}
          <div className="mt-20 grid grid-cols-2 lg:grid-cols-4 gap-6 max-w-4xl mx-auto">
            {stats.map((s) => (
              <div key={s.label} className="text-center">
                <div className="text-3xl lg:text-4xl font-extrabold bg-gradient-to-r from-emerald-400 to-teal-300 bg-clip-text text-transparent">{s.value}</div>
                <div className="mt-1 text-sm text-slate-500">{s.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* About */}
      <section id="about" className="py-20 lg:py-28">
        <div className="max-w-7xl mx-auto px-6">
          <div className="grid lg:grid-cols-2 gap-12 lg:gap-20 items-center">
            <div>
              <h2 className="text-xs font-bold uppercase tracking-widest text-emerald-400 mb-3">About Us</h2>
              <h3 className="text-3xl lg:text-4xl font-extrabold leading-tight">
                Your Reliable Source
                <br />
                for Auto Parts
              </h3>
              <p className="mt-6 text-slate-400 leading-relaxed">
                Located in the heart of Gelioya, we've been the trusted spare parts supplier for over 15 years. Our extensive inventory covers all major vehicle brands — from Japanese imports to European models.
              </p>
              <p className="mt-4 text-slate-400 leading-relaxed">
                Whether you need a single replacement part or bulk orders for your workshop, we offer genuine and quality aftermarket parts at the best prices. That's why customers keep coming back.
              </p>
              <div className="mt-8 flex items-center gap-6">
                <div className="flex items-center gap-2 text-emerald-400">
                  <Shield size={20} />
                  <span className="text-sm font-semibold">Genuine Parts</span>
                </div>
                <div className="flex items-center gap-2 text-emerald-400">
                  <Award size={20} />
                  <span className="text-sm font-semibold">Quality Guarantee</span>
                </div>
              </div>
            </div>
            <div className="relative">
              <div className="aspect-[4/3] rounded-3xl bg-gradient-to-br from-emerald-900/30 via-slate-900/50 to-teal-900/20 border border-emerald-900/20 overflow-hidden flex items-center justify-center">
                <div className="text-center p-8">
                  <div className="inline-flex items-center justify-center w-20 h-20 bg-white/90 rounded-2xl border border-emerald-900/30 mb-4 overflow-hidden">
                    <img src="/Gelioya motors logo 01.png" alt="Gelioya Motors" className="w-16 h-16 object-contain" />
                  </div>
                  <p className="text-slate-500 text-lg font-medium">Gelioya Motors</p>
                  <p className="text-slate-600 text-sm mt-1">Quality Auto Spare Parts Since 2015</p>
                </div>
              </div>
              <div className="absolute -bottom-4 -right-4 w-32 h-32 bg-emerald-500/10 rounded-2xl border border-emerald-900/20 flex items-center justify-center">
                <div className="text-center">
                  <div className="text-2xl font-extrabold text-emerald-400">10+</div>
                  <div className="text-[10px] text-slate-500 uppercase tracking-wider">Years</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Services */}
      <section id="services" className="py-20 lg:py-28 bg-gradient-to-b from-transparent via-emerald-950/10 to-transparent">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-14">
            <h2 className="text-xs font-bold uppercase tracking-widest text-emerald-400 mb-3">Our Products</h2>
            <h3 className="text-3xl lg:text-4xl font-extrabold">Complete Range of Spare Parts</h3>
            <p className="mt-4 text-slate-400 max-w-xl mx-auto">From engine components to body parts, we stock everything you need for any vehicle make and model.</p>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {services.map((s) => (
              <div
                key={s.title}
                className="group p-6 rounded-2xl bg-white/[0.02] border border-white/5 hover:border-emerald-800/40 hover:bg-emerald-950/10 transition-all duration-300"
              >
                <div className="w-12 h-12 rounded-xl bg-emerald-500/10 flex items-center justify-center mb-4 group-hover:bg-emerald-500/20 transition-colors">
                  <s.icon size={22} className="text-emerald-400" />
                </div>
                <h4 className="text-lg font-bold text-white mb-2">{s.title}</h4>
                <p className="text-sm text-slate-400 leading-relaxed">{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Reviews */}
      <section id="reviews" className="py-20 lg:py-28">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-14">
            <h2 className="text-xs font-bold uppercase tracking-widest text-emerald-400 mb-3">Customer Reviews</h2>
            <h3 className="text-3xl lg:text-4xl font-extrabold">What Our Customers Say</h3>
          </div>
          <div className="grid md:grid-cols-3 gap-6">
            {reviews.map((r) => (
              <div key={r.name} className="p-6 rounded-2xl bg-white/[0.02] border border-white/5">
                <div className="flex gap-1 mb-4">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Star key={i} size={16} className={i < r.stars ? 'text-amber-400 fill-amber-400' : 'text-slate-700'} />
                  ))}
                </div>
                <p className="text-slate-300 text-sm leading-relaxed mb-4">"{r.text}"</p>
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full bg-emerald-500/10 flex items-center justify-center text-sm font-bold text-emerald-400">
                    {r.name.charAt(0)}
                  </div>
                  <span className="text-sm font-medium text-slate-200">{r.name}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Contact / CTA */}
      <section id="contact" className="py-20 lg:py-28 bg-gradient-to-b from-transparent via-emerald-950/10 to-transparent">
        <div className="max-w-7xl mx-auto px-6">
          <div className="grid lg:grid-cols-2 gap-12">
            <div>
              <h2 className="text-xs font-bold uppercase tracking-widest text-emerald-400 mb-3">Get In Touch</h2>
              <h3 className="text-3xl lg:text-4xl font-extrabold leading-tight">
                Looking for
                <br />
                Spare Parts?
              </h3>
              <p className="mt-4 text-slate-400 leading-relaxed">
                Visit our shop or give us a call. We're here to help you find the right parts for your vehicle.
              </p>
              <div className="mt-8 space-y-4">
                <div className="flex items-center gap-4">
                  <div className="w-11 h-11 rounded-xl bg-emerald-500/10 flex items-center justify-center flex-shrink-0">
                    <MapPin size={18} className="text-emerald-400" />
                  </div>
                  <div>
                    <div className="text-sm font-semibold text-white">Location</div>
                    <div className="text-sm text-slate-400">Gelioya, Kandy District, Sri Lanka</div>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <div className="w-11 h-11 rounded-xl bg-emerald-500/10 flex items-center justify-center flex-shrink-0">
                    <Phone size={18} className="text-emerald-400" />
                  </div>
                  <div>
                    <div className="text-sm font-semibold text-white">Phone</div>
                    <div className="text-sm text-slate-400">+94 77 654 4898</div>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <div className="w-11 h-11 rounded-xl bg-emerald-500/10 flex items-center justify-center flex-shrink-0">
                    <Mail size={18} className="text-emerald-400" />
                  </div>
                  <div>
                    <div className="text-sm font-semibold text-white">Email</div>
                    <div className="text-sm text-slate-400">Gelioyamotors@gmail.com</div>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <div className="w-11 h-11 rounded-xl bg-emerald-500/10 flex items-center justify-center flex-shrink-0">
                    <Clock size={18} className="text-emerald-400" />
                  </div>
                  <div>
                    <div className="text-sm font-semibold text-white">Working Hours</div>
                    <div className="text-sm text-slate-400">Mon–Sat: 8:00 AM – 6:00 PM</div>
                  </div>
                </div>
              </div>
            </div>

            {/* Contact form */}
            <div className="p-6 sm:p-8 rounded-2xl bg-white/[0.02] border border-white/5">
              <h4 className="text-lg font-bold text-white mb-6">Send Us a Message</h4>
              <form className="space-y-4" onSubmit={(e) => e.preventDefault()}>
                <div>
                  <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">Name</label>
                  <input type="text" placeholder="Your name" className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-sm text-white placeholder-slate-600 focus:ring-2 focus:ring-emerald-500 outline-none transition-all" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">Phone</label>
                  <input type="tel" placeholder="+94 7X XXX XXXX" className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-sm text-white placeholder-slate-600 focus:ring-2 focus:ring-emerald-500 outline-none transition-all" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">Message</label>
                  <textarea rows={4} placeholder="Tell us what parts you need..." className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-sm text-white placeholder-slate-600 focus:ring-2 focus:ring-emerald-500 outline-none transition-all resize-none" />
                </div>
                <button type="submit" className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold rounded-xl transition-colors text-sm">
                  Send Message <ArrowRight size={16} />
                </button>
              </form>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 border-t border-white/5">
        <div className="max-w-7xl mx-auto px-6">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 bg-white/90 rounded-lg flex items-center justify-center border border-emerald-900/30 overflow-hidden">
                <img src="/Gelioya motors logo 01.png" alt="Gelioya Motors" className="w-7 h-7 object-contain" />
              </div>
              <div>
                <span className="text-sm font-bold text-white">Gelioya Motors</span>
                <span className="text-xs text-slate-600 ml-2">© {new Date().getFullYear()}</span>
              </div>
            </div>
            <div className="flex items-center gap-6 text-xs text-slate-600">
              <span>Auto Spare Parts</span>
              <span>•</span>
              <span>Gelioya, Sri Lanka</span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  )
}
