import { Navbar } from "@/components/Navbar"
import { Hero } from "@/components/Hero"
import { Features } from "@/components/Features"
import { HowItWorks } from "@/components/HowItWorks"
import { WhyLocal } from "@/components/WhyLocal"
import { Download } from "@/components/Download"
import { Footer } from "@/components/Footer"
import { Starfield } from "@/components/Starfield"

const VIDEO_SRC =
  "https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260314_131748_f2ca2a28-fed7-44c8-b9a9-bd9acdd5ec31.mp4"

function App() {
  return (
    <div className="relative min-h-screen overflow-x-hidden bg-background">
      {/* Persistent twinkling starfield + cursor sparkles behind everything.
          Fixed-position, full viewport, pointer-events disabled. */}
      <Starfield />

      {/* Cinematic background video pinned to the hero. The starfield shows
          through everywhere else — solid blue felt dead below the hero. */}
      <div className="pointer-events-none absolute inset-x-0 top-0 z-[1] h-screen overflow-hidden">
        <video
          autoPlay
          loop
          muted
          playsInline
          className="h-full w-full object-cover opacity-90"
          aria-hidden="true"
        >
          <source src={VIDEO_SRC} type="video/mp4" />
        </video>
        <div className="absolute inset-0 bg-background/35" />
        <div className="absolute inset-x-0 bottom-0 h-40 bg-gradient-to-b from-transparent to-background" />
      </div>

      <div className="relative z-10">
        <Navbar />
        <Hero />
        <Features />
        <HowItWorks />
        <WhyLocal />
        <Download />
        <Footer />
      </div>
    </div>
  )
}

export default App
