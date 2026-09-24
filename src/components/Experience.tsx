import React from 'react'
import { motion } from 'framer-motion'
import { useLanguagePreference } from '../utils/language'
import { Rocket, CircleDollarSign, GraduationCap, Globe2, BookOpen } from 'lucide-react'

interface TimelineItem {
  year: string
  title: string
  company: string
  description: string
  descriptionEn: string
  type: 'work' | 'education' | 'opensource'
  color: string
  gradient: string
  icon: React.ReactNode
}

const experiences: TimelineItem[] = [
  {
    year: "Mar 2026 - Present",
    title: "Founder & Full-Stack Engineer",
    company: "Ting AI — Market Intelligence Platform",
    description: "Membangun dan men-deploy platform SaaS AI dari nol: 500+ pengguna aktif, backend Express/Node di VPS Windows, integrasi Yahoo Finance & FMP real-time, rata-rata API response <200ms. Auth flow (Supabase), sistem Pro subscription, dan 6+ fitur analitik portofolio dikerjakan dalam 4 bulan.",
    descriptionEn: "Built & shipped AI-powered SaaS from zero: 500+ active users, Express/Node backend on Windows VPS, real-time Yahoo Finance & FMP integration, <200ms avg API response. Delivered auth flows, Pro subscription system, and 6+ portfolio analytics features within 4 months.",
    type: "work",
    color: "#25d0c3",
    gradient: "from-[#25d0c3]/20 via-[#25d0c3]/5 to-transparent",
    icon: <Rocket size={22} />
  },
  {
    year: "Feb 2026 - Present",
    title: "Full-Stack Developer",
    company: "Central Jual Emas — Gold Trading Platform",
    description: "Mengembangkan platform perdagangan emas responsif dengan kalkulasi harga real-time dan sistem manajemen order. Waktu load halaman ditekan di bawah 1.5 detik. UI dikerjakan dari desain ke production-ready dalam 3 minggu.",
    descriptionEn: "Built responsive gold trading platform with real-time price calculation and order management system. Page load under 1.5s. UI shipped from design to production-ready in 3 weeks.",
    type: "work",
    color: "#4ea8de",
    gradient: "from-[#4ea8de]/20 via-[#4ea8de]/5 to-transparent",
    icon: <CircleDollarSign size={22} />
  },
  {
    year: "2024 - 2025",
    title: "Full-Stack Web Developer (Contract)",
    company: "Universitas Primagraha (upg.ac.id)",
    description: "Membangun portal akademik dan sistem informasi untuk universitas dengan 3.000+ mahasiswa aktif. Sistem mencakup OPAC perpustakaan, CBT ujian online, dan portal utama. Uptime mencapai 99%+ sejak live.",
    descriptionEn: "Built academic portal & information systems for a university with 3,000+ active students. Systems include library OPAC, online CBT exam platform, and main portal. 99%+ uptime since launch.",
    type: "work",
    color: "#f59e0b",
    gradient: "from-[#f59e0b]/20 via-[#f59e0b]/5 to-transparent",
    icon: <GraduationCap size={22} />
  },
  {
    year: "2025 - Present",
    title: "Open Source Contributor",
    company: "Tscircuit, Archestra, Matchpack",
    description: "Berkontribusi pada 3 repositori OSS aktif: implementasi analog simulation viewer, MCP catalog form, dan algoritma ChipPartitionsSolver. PR diterima dan di-merge dalam siklus review <48 jam.",
    descriptionEn: "Contributed to 3 active OSS repositories: analog simulation viewer, MCP catalog form, and ChipPartitionsSolver algorithm. PRs merged within 48-hour review cycles.",
    type: "opensource",
    color: "#a78bfa",
    gradient: "from-[#a78bfa]/20 via-[#a78bfa]/5 to-transparent",
    icon: <Globe2 size={22} />
  },
  {
    year: "2022 - 2026",
    title: "Bachelor of Informatics",
    company: "Universitas Multimedia Nusantara (UMN)",
    description: "S1 Informatika, fokus pada rekayasa perangkat lunak dan sistem cerdas. Menyelesaikan proyek freelance production-grade secara paralel selama masa studi.",
    descriptionEn: "Bachelor of Informatics, specializing in software engineering and intelligent systems. Completed production-grade freelance projects concurrently during studies.",
    type: "education",
    color: "#d6b15d",
    gradient: "from-[#d6b15d]/20 via-[#d6b15d]/5 to-transparent",
    icon: <BookOpen size={22} />
  }
]


export default function Experience({ sectionId }: { sectionId?: string }) {
  const { language } = useLanguagePreference()
  const isEn = language === 'en'

  return (
    <section id={sectionId || "experience"} className="py-28 relative overflow-hidden">
      {/* Ambient blobs */}
      <div className="absolute top-20 -right-40 w-80 h-80 rounded-full pointer-events-none" style={{ background: 'radial-gradient(circle, #25d0c315, transparent 70%)' }} />
      <div className="absolute bottom-20 -left-40 w-96 h-96 rounded-full pointer-events-none" style={{ background: 'radial-gradient(circle, #a78bfa15, transparent 70%)' }} />

      <div className="container-saas relative z-10">
        {/* Header */}
        <div className="mb-16">
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="inline-flex items-center gap-2 mb-4 px-4 py-1.5 rounded-full border border-white/[0.08] bg-white/[0.02] backdrop-blur-md"
          >
            <div className="w-1.5 h-1.5 rounded-full bg-[#25d0c3] animate-pulse" />
            <span className="text-[10px] font-mono text-white/50 tracking-widest uppercase">
              {isEn ? 'Journey' : 'Perjalanan'}
            </span>
          </motion.div>
          <h2 className="text-3xl md:text-4xl lg:text-5xl font-black text-white tracking-tight">
            {isEn ? 'Experience ' : 'Pengalaman '}
            <span className="bg-gradient-to-r from-[#25d0c3] to-[#4ea8de] bg-clip-text text-transparent">
              {isEn ? '& Timeline' : '& Timeline'}
            </span>
          </h2>
        </div>

        {/* Timeline cards */}
        <div className="space-y-6">
          {experiences.map((exp, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, x: index % 2 === 0 ? -30 : 30, y: 20 }}
              whileInView={{ opacity: 1, x: 0, y: 0 }}
              viewport={{ once: true, margin: "-80px" }}
              transition={{ duration: 0.7, delay: index * 0.08, ease: [0.16, 1, 0.3, 1] }}
              whileHover={{ y: -4 }}
              className="group relative"
            >
              <div className={`
                relative rounded-2xl border border-white/[0.06] bg-white/[0.015] backdrop-blur-sm
                p-6 md:p-8 overflow-hidden transition-all duration-500
                hover:border-white/[0.12] hover:bg-white/[0.025]
              `}>
                {/* Left gradient accent */}
                <div
                  className={`absolute top-0 left-0 bottom-0 w-1 rounded-full bg-gradient-to-b ${exp.gradient}`}
                  style={{ background: `linear-gradient(to bottom, ${exp.color}40, transparent)` }}
                />

                {/* Hover glow */}
                <div
                  className="absolute -inset-20 opacity-0 group-hover:opacity-100 transition-opacity duration-700 pointer-events-none rounded-[4rem] blur-3xl"
                  style={{ background: `radial-gradient(circle, ${exp.color}08, transparent 70%)` }}
                />

                <div className="relative z-10 flex flex-col md:flex-row md:items-start gap-4 md:gap-8">
                  {/* Icon + Year */}
                  <div className="flex items-center md:flex-col md:items-center gap-3 md:gap-2 md:min-w-[100px] shrink-0">
                    <motion.div
                      whileHover={{ scale: 1.15, rotate: 5 }}
                      className="w-12 h-12 rounded-2xl flex items-center justify-center border border-white/[0.08] bg-white/[0.03] backdrop-blur-sm"
                      style={{ color: exp.color }}
                    >
                      {exp.icon}
                    </motion.div>
                    <span
                      className="text-[10px] font-mono tracking-wider px-3 py-1 rounded-full border whitespace-nowrap"
                      style={{
                        color: `${exp.color}cc`,
                        borderColor: `${exp.color}30`,
                        background: `${exp.color}0a`
                      }}
                    >
                      {exp.year}
                    </span>
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <h3 className="text-lg md:text-xl font-bold text-white mb-1 group-hover:text-[#25d0c3] transition-colors duration-300">
                      {exp.title}
                    </h3>
                    <div className="flex items-center gap-2 mb-3">
                      <span className="text-sm font-semibold" style={{ color: exp.color }}>
                        {exp.company}
                      </span>
                    </div>
                    <p className="text-sm text-white/40 leading-relaxed">
                      {isEn ? exp.descriptionEn : exp.description}
                    </p>
                  </div>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  )
}
