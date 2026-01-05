import { Button } from "@/components/ui/button";
import { 
  ArrowRight,
  Menu,
  X,
  Sparkles
} from "lucide-react";
import { Link } from "react-router-dom";
import { useState, useEffect } from "react";
import { AnimatedSection } from "@/hooks/useScrollAnimation";

// Import images
import heroTeamImg from "@/assets/hero-team.jpg";
import pricemindAiImg from "@/assets/pricemind-ai.jpg";
import analyticsWorkImg from "@/assets/analytics-work.jpg";
import retailManagerImg from "@/assets/retail-manager.jpg";
import smartPricingImg from "@/assets/smart-pricing.jpg";

const Landing = () => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 50);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const services = [
    {
      number: "01",
      title: "CENU ANALĪTIKA",
      description: "Reāllaika konkurentu cenu monitorings un automatizēta analīze visām jūsu produktu kategorijām.",
      image: analyticsWorkImg
    },
    {
      number: "02", 
      title: "PRICEMIND COPILOT",
      description: "Jūsu neredzamais cenu stratēģis. AI asistents, kas saprot jūsu biznesu un sniedz konkrētus ieteikumus dabiskā valodā.",
      image: pricemindAiImg
    },
    {
      number: "03",
      title: "SMART PRICING",
      description: "Automātiskas cenu rekomendācijas, kas balstās uz pārdošanas datiem, konkurentu cenām un maržas mērķiem.",
      image: smartPricingImg
    },
    {
      number: "04",
      title: "VEIKALU PĀRVALDĪBA",
      description: "Pilns pārskats par katru veikalu — no ABC analīzes līdz pārdošanas trendiem un krājumu optimizācijai.",
      image: retailManagerImg
    }
  ];

  const stats = [
    { value: "Since", label: "2024" },
    { value: "Rīga,", label: "Latvija" }
  ];

  return (
    <div className="min-h-screen bg-background">
      {/* Navigation */}
      <nav className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        scrolled ? 'bg-background/95 backdrop-blur-sm border-b border-border' : 'bg-transparent'
      }`}>
        <div className="container mx-auto px-6 md:px-12">
          <div className="flex items-center justify-between h-16 md:h-20">
            {/* Logo */}
            <Link to="/" className="text-xl font-bold tracking-tight">
              RETAILRADAR
            </Link>
            
            {/* Desktop Navigation */}
            <div className="hidden md:flex items-center gap-8">
              <Link to="/about" className="text-sm font-medium hover:opacity-60 transition-opacity">
                PAR MUMS
              </Link>
              <Link to="/pricing" className="text-sm font-medium hover:opacity-60 transition-opacity">
                CENAS
              </Link>
              <Link to="/auth" className="text-sm font-medium hover:opacity-60 transition-opacity">
                PIESLĒGTIES
              </Link>
              <Link to="/auth">
                <Button className="rounded-full px-6">
                  SĀKT TAGAD
                </Button>
              </Link>
            </div>

            {/* Mobile menu button */}
            <button 
              className="md:hidden p-2"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            >
              {mobileMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
            </button>
          </div>

          {/* Mobile Navigation */}
          {mobileMenuOpen && (
            <div className="md:hidden py-6 border-t border-border">
              <div className="flex flex-col gap-4">
                <Link 
                  to="/about" 
                  className="text-lg font-medium"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  PAR MUMS
                </Link>
                <Link 
                  to="/pricing" 
                  className="text-lg font-medium"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  CENAS
                </Link>
                <Link 
                  to="/auth" 
                  className="text-lg font-medium"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  PIESLĒGTIES
                </Link>
                <Link to="/auth" onClick={() => setMobileMenuOpen(false)}>
                  <Button className="w-full rounded-full mt-2">SĀKT TAGAD</Button>
                </Link>
              </div>
            </div>
          )}
        </div>
      </nav>

      {/* Hero Section - Bold Typography */}
      <section className="relative min-h-screen hero-gradient flex items-center">
        {/* Side indicators */}
        <div className="absolute left-6 md:left-12 top-1/2 -translate-y-1/2 hidden md:flex flex-col items-center gap-3">
          <div className="w-px h-8 bg-foreground/20" />
          <span className="text-xs font-medium tracking-wider -rotate-90 origin-center whitespace-nowrap">
            {stats[0].value} {stats[0].label}
          </span>
        </div>

        <div className="absolute right-6 md:right-12 top-1/2 -translate-y-1/2 hidden md:flex flex-col items-center gap-3">
          <span className="text-xs font-medium tracking-wider -rotate-90 origin-center whitespace-nowrap">
            {stats[1].value} {stats[1].label}
          </span>
          <div className="w-px h-8 bg-foreground/20" />
        </div>

        <div className="container mx-auto px-6 md:px-12 pt-24 md:pt-32">
          <div className="max-w-6xl mx-auto text-center">
            {/* Main headline */}
            <h1 className="text-display text-[12vw] md:text-[10vw] lg:text-[8vw] leading-[0.85] mb-8">
              <span className="block">KATRA</span>
              <span className="block relative">
                CENA
                <span className="absolute -right-2 md:-right-4 top-0 text-[3vw] md:text-[2vw] font-normal">™</span>
              </span>
              <span className="block">IR SVARĪGA</span>
            </h1>

            {/* Description */}
            <p className="text-base md:text-lg text-muted-foreground max-w-xl mx-auto mb-10 leading-relaxed">
              RetailRadar AI ir cenu analītikas platforma Baltijas mazumtirgotājiem. 
              No datu analīzes līdz stratēģiskām rekomendācijām — mēs rūpējamies par katru cenu.
            </p>

            {/* CTA */}
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link to="/auth">
                <Button size="lg" className="rounded-full px-8 gap-2 text-base">
                  SĀKT BEZ MAKSAS
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
              <Link to="/about">
                <Button size="lg" variant="outline" className="rounded-full px-8 text-base">
                  UZZINĀT VAIRĀK
                </Button>
              </Link>
            </div>
          </div>
        </div>

        {/* Scroll indicator */}
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2">
          <span className="text-xs font-medium tracking-wider">SCROLL</span>
          <div className="w-px h-12 bg-foreground/30 animate-pulse" />
        </div>
      </section>

      {/* Hero Image Section */}
      <AnimatedSection>
        <section className="relative">
          <div className="container mx-auto px-6 md:px-12">
            <div className="relative -mt-20 md:-mt-32 z-10">
              <img 
                src={heroTeamImg} 
                alt="RetailRadar komanda analizē datus"
                className="w-full h-[50vh] md:h-[70vh] object-cover rounded-2xl shadow-2xl"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-background/20 to-transparent rounded-2xl" />
            </div>
          </div>
        </section>
      </AnimatedSection>

      {/* PriceMind Section */}
      <AnimatedSection>
        <section className="py-24 md:py-40">
          <div className="container mx-auto px-6 md:px-12">
            <div className="grid md:grid-cols-2 gap-12 md:gap-20 items-center">
              <div>
                <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-accent/50 text-foreground text-sm font-medium mb-6">
                  <Sparkles className="h-4 w-4" />
                  AI-POWERED
                </div>
                <h2 className="text-display text-5xl md:text-7xl lg:text-8xl mb-6">
                  PRICE<br/>MIND
                </h2>
                <p className="text-lg md:text-xl text-muted-foreground mb-8 leading-relaxed">
                  Iepazīstieties ar PriceMind — jūsu neredzamo cenu stratēģi. 
                  Viņš nepārtraukti analizē jūsu datus, konkurentu cenas un tirgus tendences, 
                  lai sniegtu jums konkrētus, izpildāmus ieteikumus dabiskā valodā.
                </p>
                <ul className="space-y-4 mb-8">
                  <li className="flex items-start gap-3">
                    <div className="w-1.5 h-1.5 rounded-full bg-foreground mt-2.5" />
                    <span className="text-muted-foreground">Jautājiet jebko par cenām, maržām vai konkurentiem</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <div className="w-1.5 h-1.5 rounded-full bg-foreground mt-2.5" />
                    <span className="text-muted-foreground">Saņemiet konkrētas darbības ar skaitļiem un pamatojumu</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <div className="w-1.5 h-1.5 rounded-full bg-foreground mt-2.5" />
                    <span className="text-muted-foreground">Ietaupiet stundas, ko pavadījāt manuālā analīzē</span>
                  </li>
                </ul>
                <Link to="/auth">
                  <Button className="rounded-full px-8 gap-2">
                    IZMĒĢINĀT PRICEMIND
                    <ArrowRight className="h-4 w-4" />
                  </Button>
                </Link>
              </div>
              <div className="relative">
                <img 
                  src={pricemindAiImg} 
                  alt="PriceMind AI asistents"
                  className="w-full aspect-square object-cover rounded-2xl"
                />
                <div className="absolute -bottom-4 -right-4 md:-bottom-8 md:-right-8 bg-card border border-border rounded-xl p-4 md:p-6 shadow-xl max-w-xs">
                  <p className="text-sm font-medium mb-1">PriceMind saka:</p>
                  <p className="text-xs text-muted-foreground">
                    "Iesaku paaugstināt Coca-Cola 2L cenu par 3% — konkurenti ir par 8% dārgāki, 
                    un ABC-A produktam tas palielinās maržu par €2,400/mēn."
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>
      </AnimatedSection>

      {/* Services Section */}
      <section className="py-24 md:py-40 bg-secondary/30">
        <div className="container mx-auto px-6 md:px-12">
          <AnimatedSection>
            <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-6 mb-16 md:mb-24">
              <h2 className="text-display text-4xl md:text-6xl lg:text-7xl">
                KO MĒS<br/>DARĀM
              </h2>
              <p className="text-muted-foreground max-w-md text-lg">
                Pilns cenu pārvaldības ekosistēma — no datu apkopošanas līdz stratēģisku lēmumu pieņemšanai.
              </p>
            </div>
          </AnimatedSection>

          <div className="space-y-0">
            {services.map((service, index) => (
              <AnimatedSection key={index}>
                <div className="group border-t border-border py-8 md:py-12">
                  <div className="grid md:grid-cols-12 gap-6 md:gap-8 items-start">
                    <div className="md:col-span-1">
                      <span className="text-sm font-medium text-muted-foreground">{service.number}</span>
                    </div>
                    <div className="md:col-span-4">
                      <h3 className="text-2xl md:text-3xl font-bold tracking-tight mb-4 md:mb-0">
                        {service.title}
                      </h3>
                    </div>
                    <div className="md:col-span-4">
                      <p className="text-muted-foreground leading-relaxed">
                        {service.description}
                      </p>
                    </div>
                    <div className="md:col-span-3">
                      <div className="overflow-hidden rounded-lg">
                        <img 
                          src={service.image} 
                          alt={service.title}
                          className="w-full h-32 md:h-40 object-cover transition-transform duration-500 group-hover:scale-105"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </AnimatedSection>
            ))}
          </div>
        </div>
      </section>

      {/* Stats Section */}
      <AnimatedSection>
        <section className="py-24 md:py-40">
          <div className="container mx-auto px-6 md:px-12">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-8 md:gap-12">
              <div className="text-center">
                <div className="text-display text-5xl md:text-7xl mb-2">100+</div>
                <p className="text-sm text-muted-foreground font-medium tracking-wider">AKTĪVI LIETOTĀJI</p>
              </div>
              <div className="text-center">
                <div className="text-display text-5xl md:text-7xl mb-2">8%</div>
                <p className="text-sm text-muted-foreground font-medium tracking-wider">MARŽAS PIEAUGUMS</p>
              </div>
              <div className="text-center">
                <div className="text-display text-5xl md:text-7xl mb-2">24/7</div>
                <p className="text-sm text-muted-foreground font-medium tracking-wider">MONITORINGS</p>
              </div>
              <div className="text-center">
                <div className="text-display text-5xl md:text-7xl mb-2">1M+</div>
                <p className="text-sm text-muted-foreground font-medium tracking-wider">ANALIZĒTI SKU</p>
              </div>
            </div>
          </div>
        </section>
      </AnimatedSection>

      {/* Large Image Section */}
      <AnimatedSection>
        <section className="py-12 md:py-24">
          <div className="container mx-auto px-6 md:px-12">
            <div className="relative overflow-hidden rounded-2xl">
              <img 
                src={retailManagerImg} 
                alt="Mazumtirdzniecības vadītāja ar planšeti"
                className="w-full h-[60vh] md:h-[80vh] object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-r from-background/80 to-transparent flex items-center">
                <div className="p-8 md:p-16 max-w-xl">
                  <h3 className="text-display text-3xl md:text-5xl mb-4">
                    NO DATIEM<br/>LĪDZ DARBĪBĀM
                  </h3>
                  <p className="text-muted-foreground mb-6 text-lg">
                    Mēs pārvēršam jūsu pārdošanas un tirgus datus konkrētās darbībās, 
                    kuras jūsu komanda var izpildīt šodien.
                  </p>
                  <Link to="/auth">
                    <Button className="rounded-full px-8 gap-2">
                      SĀKT TAGAD
                      <ArrowRight className="h-4 w-4" />
                    </Button>
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </section>
      </AnimatedSection>

      {/* CTA Section */}
      <section className="py-24 md:py-40 bg-foreground text-background">
        <div className="container mx-auto px-6 md:px-12 text-center">
          <AnimatedSection>
            <h2 className="text-display text-5xl md:text-7xl lg:text-8xl mb-6">
              GATAVI<br/>SĀKT?
            </h2>
            <p className="text-background/70 max-w-xl mx-auto mb-10 text-lg">
              Pievienojieties Baltijas mazumtirgotājiem, kuri jau izmanto RetailRadar AI, 
              lai pieņemtu gudrākus cenu lēmumus.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link to="/auth">
                <Button size="lg" variant="secondary" className="rounded-full px-8 gap-2 text-base">
                  IZVEIDOT KONTU
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
              <Link to="/pricing">
                <Button size="lg" variant="outline" className="rounded-full px-8 text-base border-background/30 text-background hover:bg-background/10">
                  APSKATĪT CENAS
                </Button>
              </Link>
            </div>
          </AnimatedSection>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 border-t border-border">
        <div className="container mx-auto px-6 md:px-12">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="text-sm font-medium">
              RETAILRADAR AI © 2024
            </div>
            <div className="flex items-center gap-8">
              <Link to="/about" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                Par mums
              </Link>
              <Link to="/pricing" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                Cenas
              </Link>
              <Link to="/auth" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                Pieslēgties
              </Link>
            </div>
            <div className="text-sm text-muted-foreground">
              Rīga, Latvija
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Landing;
