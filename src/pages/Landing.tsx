import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { 
  BarChart3, 
  TrendingUp, 
  Target, 
  Zap, 
  Shield, 
  Users,
  ArrowRight,
  CheckCircle,
  LineChart,
  PieChart,
  Brain,
  Store,
  Star,
  ChevronRight,
  ChevronDown,
  Menu,
  X
} from "lucide-react";
import { Link } from "react-router-dom";
import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

const Landing = () => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const features = [
    {
      icon: BarChart3,
      title: "ABC Segmentācija",
      description: "Automātiska produktu klasifikācija pēc ienesīguma ar konfigurējamiem sliekšņiem.",
      image: "https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=600&h=400&fit=crop"
    },
    {
      icon: TrendingUp,
      title: "Cenu Elastība",
      description: "Pieprasījuma jutīguma analīze optimālai cenu noteikšanai.",
      image: "https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=600&h=400&fit=crop"
    },
    {
      icon: Target,
      title: "Smart Price",
      description: "Automātiskas cenu rekomendācijas, kas aizsargā peļņas maržu.",
      image: "https://images.unsplash.com/photo-1611974789855-9c2a0a7236a3?w=600&h=400&fit=crop"
    },
    {
      icon: Brain,
      title: "PriceMind Copilot",
      description: "AI asistents ar konkrētām cenu rekomendācijām dabiskā valodā.",
      image: "https://images.unsplash.com/photo-1677442136019-21780ecad995?w=600&h=400&fit=crop"
    },
    {
      icon: Store,
      title: "Konkurentu Monitorings",
      description: "Automātiska konkurentu cenu un akciju izsekošana reāllaikā.",
      image: "https://images.unsplash.com/photo-1556742049-0cfed4f6a45d?w=600&h=400&fit=crop"
    },
    {
      icon: PieChart,
      title: "Symphony Analītika",
      description: "Dziļa kategoriju analīze ar produktu lomu noteikšanu.",
      image: "https://images.unsplash.com/photo-1543286386-713bdd548da4?w=600&h=400&fit=crop"
    }
  ];

  const overviewFeatures = [
    {
      title: "Viss vienkopus",
      description: "Vienā skatā aplūkojiet visu, kas nepieciešams jūsu biznesam — pārdošanas dati, konkurentu cenas, maržu analīze un AI ieteikumi.",
      image: "https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=800&h=600&fit=crop"
    },
    {
      title: "Datu savienošana",
      description: "Piekļūstiet visiem jūsu datu avotiem vienuviet — ERP sistēmas, Excel faili, konkurentu vietnes un partneru atskaites.",
      image: "https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=800&h=600&fit=crop"
    },
    {
      title: "Viedas rekomendācijas",
      description: "AI analizē jūsu datus un sniedz konkrētas, izpildāmas rekomendācijas cenu un sortimenta optimizācijai.",
      image: "https://images.unsplash.com/photo-1677442136019-21780ecad995?w=800&h=600&fit=crop"
    },
    {
      title: "Droša platforma",
      description: "Uzņēmuma līmeņa drošība ar GDPR atbilstību. Jūsu dati ir aizsargāti ar šifrēšanu un regulārām drošības pārbaudēm.",
      image: "https://images.unsplash.com/photo-1563986768609-322da13575f3?w=800&h=600&fit=crop"
    }
  ];

  const testimonials = [
    {
      name: "Mārtiņš Liepiņš",
      role: "Kategoriju vadītājs",
      company: "Baltic Foods",
      image: "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=100&h=100&fit=crop&crop=face",
      quote: "RetailRadar AI palīdzēja mums palielināt A kategorijas produktu maržu par 12% tikai 3 mēnešu laikā.",
      rating: 5
    },
    {
      name: "Ilze Ozola",
      role: "Cenu analītiķe",
      company: "MaxiMart",
      image: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=100&h=100&fit=crop&crop=face",
      quote: "Pirms RetailRadar pavadīju 15 stundas nedēļā manuāli analizējot konkurentu cenas. Tagad tas notiek automātiski.",
      rating: 5
    },
    {
      name: "Andris Kalniņš",
      role: "Komercdirektors",
      company: "SmartRetail",
      image: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100&h=100&fit=crop&crop=face",
      quote: "AI rekomendācijas ir precīzas un viegli izpildāmas. Mūsu komanda tagad var fokusēties uz stratēģiju.",
      rating: 5
    }
  ];

  const metrics = [
    { value: "100+", label: "Aktīvi lietotāji" },
    { value: "8%", label: "Vidējā maržas uzlabošana" },
    { value: "24/7", label: "Monitorings" },
    { value: "1M+", label: "Analizēti produkti" }
  ];

  const faqItems = [
    {
      question: "Cik ilgi aizņem ieviešana?",
      answer: "Pamata ieviešana notiek 1-2 nedēļu laikā. Mūsu komanda palīdz ar datu importu un sistēmas konfigurāciju."
    },
    {
      question: "Vai man ir nepieciešama tehniska pieredze?",
      answer: "Nē, platforma ir veidota lietotājam draudzīga. Visi rīki ir pieejami caur intuitīvu saskarni bez programmēšanas prasmēm."
    },
    {
      question: "Kādi datu formāti tiek atbalstīti?",
      answer: "Mēs atbalstām Excel, CSV, API integrācijas un tiešu savienojumu ar populārākajām ERP sistēmām."
    },
    {
      question: "Vai ir pieejams bezmaksas izmēģinājums?",
      answer: "Jā, piedāvājam 14 dienu bezmaksas izmēģinājumu ar pilnu funkcionalitāti bez kredītkartes."
    }
  ];

  return (
    <div className="min-h-screen bg-background">
      {/* Navigation - Microsoft style clean nav */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-background/95 backdrop-blur-sm border-b border-border">
        <div className="container mx-auto px-4 md:px-6">
          <div className="flex items-center justify-between h-14 md:h-16">
            {/* Logo */}
            <Link to="/" className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-lg bg-primary flex items-center justify-center">
                <BarChart3 className="h-5 w-5 text-primary-foreground" />
              </div>
              <span className="font-semibold text-lg">RetailRadar AI</span>
            </Link>
            
            {/* Desktop Navigation */}
            <div className="hidden md:flex items-center gap-6">
              <Link to="/about" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                Par mums
              </Link>
              <Link to="/pricing" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                Cenas
              </Link>
              <Link to="/auth" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                Pieslēgties
              </Link>
              <Link to="/auth">
                <Button size="sm">Sākt bez maksas</Button>
              </Link>
            </div>

            {/* Mobile menu button */}
            <button 
              className="md:hidden p-2"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            >
              {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
          </div>

          {/* Mobile Navigation */}
          {mobileMenuOpen && (
            <div className="md:hidden py-4 border-t border-border">
              <div className="flex flex-col gap-3">
                <Link 
                  to="/about" 
                  className="text-sm text-muted-foreground hover:text-foreground transition-colors py-2"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  Par mums
                </Link>
                <Link 
                  to="/pricing" 
                  className="text-sm text-muted-foreground hover:text-foreground transition-colors py-2"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  Cenas
                </Link>
                <Link 
                  to="/auth" 
                  className="text-sm text-muted-foreground hover:text-foreground transition-colors py-2"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  Pieslēgties
                </Link>
                <Link to="/auth" onClick={() => setMobileMenuOpen(false)}>
                  <Button size="sm" className="w-full">Sākt bez maksas</Button>
                </Link>
              </div>
            </div>
          )}
        </div>
      </nav>

      {/* Hero Section - Microsoft style with large image */}
      <section className="pt-16 md:pt-20">
        <div className="relative bg-gradient-to-b from-secondary/50 to-background">
          {/* Hero Image */}
          <div className="container mx-auto px-4 md:px-6 pt-12 md:pt-20 pb-8 md:pb-12">
            <div className="max-w-4xl mx-auto text-center mb-8 md:mb-12">
              <h1 className="text-3xl md:text-5xl lg:text-6xl font-bold tracking-tight mb-4 md:mb-6">
                Cenu analītika ikdienas biznesam
              </h1>
              <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto mb-6 md:mb-8">
                Pārvaldiet cenas, konkurentu datus un peļņas analīzi vienuviet. 
                Pieejams datorā un mobilajā ierīcē.
              </p>
              
              {/* CTA Buttons - Microsoft style */}
              <div className="flex flex-col sm:flex-row items-center justify-center gap-3 mb-8">
                <Link to="/auth">
                  <Button size="lg" className="w-full sm:w-auto px-8">
                    Pieslēgties
                  </Button>
                </Link>
                <Link to="/auth">
                  <Button size="lg" variant="outline" className="w-full sm:w-auto px-8">
                    Izveidot bezmaksas kontu
                  </Button>
                </Link>
              </div>
            </div>

            {/* Dashboard Preview Image */}
            <div className="relative max-w-5xl mx-auto">
              <div className="rounded-xl overflow-hidden shadow-2xl border border-border bg-card">
                <div className="bg-card p-4 md:p-6">
                  {/* Mock Dashboard Header */}
                  <div className="flex items-center gap-3 mb-4 md:mb-6">
                    <div className="h-8 w-8 md:h-10 md:w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                      <LineChart className="h-4 w-4 md:h-5 md:w-5 text-primary" />
                    </div>
                    <div>
                      <div className="font-semibold text-sm md:text-base">Izpilddirektora panelis</div>
                      <div className="text-xs text-muted-foreground">Reāllaika dati</div>
                    </div>
                    <div className="ml-auto flex items-center gap-2">
                      <div className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
                      <span className="text-xs text-muted-foreground hidden sm:inline">Tiešsaistē</span>
                    </div>
                  </div>
                  
                  {/* Mock Stats Grid */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4 mb-4 md:mb-6">
                    <div className="p-3 md:p-4 rounded-lg bg-secondary/50">
                      <div className="text-xs text-muted-foreground mb-1">Apgrozījums</div>
                      <div className="text-lg md:text-2xl font-bold">€124,500</div>
                      <div className="text-xs text-green-600">+12.5%</div>
                    </div>
                    <div className="p-3 md:p-4 rounded-lg bg-secondary/50">
                      <div className="text-xs text-muted-foreground mb-1">Marža</div>
                      <div className="text-lg md:text-2xl font-bold">24.8%</div>
                      <div className="text-xs text-green-600">+2.3%</div>
                    </div>
                    <div className="p-3 md:p-4 rounded-lg bg-secondary/50">
                      <div className="text-xs text-muted-foreground mb-1">Produkti</div>
                      <div className="text-lg md:text-2xl font-bold">1,248</div>
                      <div className="text-xs text-muted-foreground">Aktīvi</div>
                    </div>
                    <div className="p-3 md:p-4 rounded-lg bg-secondary/50">
                      <div className="text-xs text-muted-foreground mb-1">Ieteikumi</div>
                      <div className="text-lg md:text-2xl font-bold">28</div>
                      <div className="text-xs text-primary">Jauni</div>
                    </div>
                  </div>

                  {/* Mock Chart */}
                  <div className="h-24 md:h-32 bg-secondary/30 rounded-lg flex items-end justify-around p-3 md:p-4">
                    {[40, 65, 45, 80, 55, 90, 70, 85, 60, 75, 50, 88].map((height, i) => (
                      <div 
                        key={i} 
                        className="w-4 md:w-6 bg-primary/60 rounded-t"
                        style={{ height: `${height}%` }}
                      />
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Overview Section with Tabs - Microsoft style */}
      <section className="py-16 md:py-24 bg-secondary/30">
        <div className="container mx-auto px-4 md:px-6">
          <div className="text-center mb-8 md:mb-12">
            <h2 className="text-2xl md:text-4xl font-bold mb-3">
              RetailRadar var mainīt visu
            </h2>
            <p className="text-muted-foreground max-w-2xl mx-auto">
              Pilns rīku komplekts Baltijas mazumtirgotājiem
            </p>
          </div>

          <Tabs defaultValue="overview" className="max-w-5xl mx-auto">
            <TabsList className="grid w-full grid-cols-3 mb-8">
              <TabsTrigger value="overview">Pārskats</TabsTrigger>
              <TabsTrigger value="features">Funkcijas</TabsTrigger>
              <TabsTrigger value="ai">AI Copilot</TabsTrigger>
            </TabsList>

            <TabsContent value="overview" className="space-y-4">
              <Accordion type="single" collapsible className="space-y-3">
                {overviewFeatures.map((feature, index) => (
                  <AccordionItem key={index} value={`item-${index}`} className="border rounded-xl bg-card overflow-hidden">
                    <AccordionTrigger className="px-6 py-4 hover:no-underline hover:bg-secondary/50">
                      <span className="font-semibold text-left">{feature.title}</span>
                    </AccordionTrigger>
                    <AccordionContent className="px-6 pb-4">
                      <div className="grid md:grid-cols-2 gap-6 items-center">
                        <p className="text-muted-foreground">{feature.description}</p>
                        <img 
                          src={feature.image} 
                          alt={feature.title}
                          className="rounded-lg w-full h-48 object-cover"
                        />
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
            </TabsContent>

            <TabsContent value="features">
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                {features.map((feature, index) => (
                  <Card key={index} className="group hover:shadow-lg transition-shadow">
                    <CardContent className="p-6">
                      <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center mb-4 group-hover:bg-primary/20 transition-colors">
                        <feature.icon className="h-6 w-6 text-primary" />
                      </div>
                      <h3 className="font-semibold mb-2">{feature.title}</h3>
                      <p className="text-sm text-muted-foreground">{feature.description}</p>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </TabsContent>

            <TabsContent value="ai">
              <Card className="overflow-hidden">
                <CardContent className="p-0">
                  <div className="grid md:grid-cols-2">
                    <div className="p-6 md:p-8">
                      <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-sm mb-4">
                        <Brain className="h-4 w-4" />
                        <span>AI-Powered</span>
                      </div>
                      <h3 className="text-2xl font-bold mb-4">PriceMind Copilot</h3>
                      <p className="text-muted-foreground mb-6">
                        Jautājiet jebko par jūsu cenām, konkurentiem vai peļņu dabiskā valodā. 
                        AI analizē jūsu datus un sniedz konkrētas atbildes ar ieteikumiem.
                      </p>
                      <ul className="space-y-3">
                        <li className="flex items-center gap-3">
                          <CheckCircle className="h-5 w-5 text-primary" />
                          <span className="text-sm">Atbildes dabiskā valodā</span>
                        </li>
                        <li className="flex items-center gap-3">
                          <CheckCircle className="h-5 w-5 text-primary" />
                          <span className="text-sm">Konkrēti cenu ieteikumi</span>
                        </li>
                        <li className="flex items-center gap-3">
                          <CheckCircle className="h-5 w-5 text-primary" />
                          <span className="text-sm">Konkurentu analīze</span>
                        </li>
                      </ul>
                    </div>
                    <div className="bg-secondary/50 p-6 md:p-8">
                      {/* Mock AI Chat */}
                      <div className="space-y-4">
                        <div className="bg-background rounded-lg p-3">
                          <p className="text-sm">Kurus produktus vajadzētu paaugstināt cenā?</p>
                        </div>
                        <div className="bg-primary/10 rounded-lg p-3">
                          <p className="text-sm">Balstoties uz ABC analīzi, ieteicu paaugstināt cenu 12 A-kategorijas produktiem ar zemu cenu indeksu. Potenciālā maržas uzlabošana: +€2,340 mēnesī.</p>
                        </div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </section>

      {/* Metrics Section */}
      <section className="py-12 md:py-16 border-y border-border">
        <div className="container mx-auto px-4 md:px-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 md:gap-8">
            {metrics.map((metric, index) => (
              <div key={index} className="text-center">
                <div className="text-3xl md:text-4xl font-bold text-primary mb-1">
                  {metric.value}
                </div>
                <div className="text-sm text-muted-foreground">{metric.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Testimonials Section */}
      <section className="py-16 md:py-24">
        <div className="container mx-auto px-4 md:px-6">
          <div className="text-center mb-8 md:mb-12">
            <h2 className="text-2xl md:text-4xl font-bold mb-3">
              Ko saka mūsu klienti
            </h2>
            <p className="text-muted-foreground">
              Reāli rezultāti no Baltijas uzņēmumiem
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-6 max-w-5xl mx-auto">
            {testimonials.map((testimonial, index) => (
              <Card key={index} className="hover:shadow-lg transition-shadow">
                <CardContent className="p-6">
                  <div className="flex items-center gap-1 mb-4">
                    {[...Array(testimonial.rating)].map((_, i) => (
                      <Star key={i} className="h-4 w-4 fill-primary text-primary" />
                    ))}
                  </div>
                  <p className="text-sm mb-6 leading-relaxed">
                    "{testimonial.quote}"
                  </p>
                  <div className="flex items-center gap-3">
                    <img 
                      src={testimonial.image} 
                      alt={testimonial.name}
                      className="h-10 w-10 rounded-full object-cover"
                    />
                    <div>
                      <div className="font-medium text-sm">{testimonial.name}</div>
                      <div className="text-xs text-muted-foreground">
                        {testimonial.role}, {testimonial.company}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Target Audience Section */}
      <section className="py-16 md:py-24 bg-secondary/30">
        <div className="container mx-auto px-4 md:px-6">
          <div className="text-center mb-8 md:mb-12">
            <h2 className="text-2xl md:text-4xl font-bold mb-3">
              Kam paredzēts RetailRadar AI?
            </h2>
            <p className="text-muted-foreground max-w-2xl mx-auto">
              Mūsu risinājums ir izstrādāts Baltijas mazumtirdzniecības profesionāļiem
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-6 max-w-4xl mx-auto">
            <Card className="text-center hover:shadow-lg transition-shadow">
              <CardContent className="p-6 md:p-8">
                <div className="h-14 w-14 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-4">
                  <Users className="h-7 w-7 text-primary" />
                </div>
                <h3 className="font-semibold mb-2">Kategoriju vadītāji</h3>
                <p className="text-sm text-muted-foreground">
                  Optimizējiet sortimentu un cenas ar datu balstītiem lēmumiem.
                </p>
              </CardContent>
            </Card>
            
            <Card className="text-center hover:shadow-lg transition-shadow">
              <CardContent className="p-6 md:p-8">
                <div className="h-14 w-14 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-4">
                  <TrendingUp className="h-7 w-7 text-primary" />
                </div>
                <h3 className="font-semibold mb-2">Cenu analītiķi</h3>
                <p className="text-sm text-muted-foreground">
                  Automatizējiet konkurentu monitoringu un cenu analīzi.
                </p>
              </CardContent>
            </Card>
            
            <Card className="text-center hover:shadow-lg transition-shadow">
              <CardContent className="p-6 md:p-8">
                <div className="h-14 w-14 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-4">
                  <Shield className="h-7 w-7 text-primary" />
                </div>
                <h3 className="font-semibold mb-2">Vadības komanda</h3>
                <p className="text-sm text-muted-foreground">
                  Saņemiet pilnu pārskatu par maržu un konkurētspēju.
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* FAQ Section */}
      <section className="py-16 md:py-24">
        <div className="container mx-auto px-4 md:px-6">
          <div className="max-w-3xl mx-auto">
            <div className="text-center mb-8 md:mb-12">
              <h2 className="text-2xl md:text-4xl font-bold mb-3">
                Bieži uzdotie jautājumi
              </h2>
            </div>

            <Accordion type="single" collapsible className="space-y-3">
              {faqItems.map((item, index) => (
                <AccordionItem key={index} value={`faq-${index}`} className="border rounded-xl bg-card overflow-hidden">
                  <AccordionTrigger className="px-6 py-4 hover:no-underline hover:bg-secondary/50">
                    <span className="font-medium text-left">{item.question}</span>
                  </AccordionTrigger>
                  <AccordionContent className="px-6 pb-4">
                    <p className="text-muted-foreground">{item.answer}</p>
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-16 md:py-24 bg-primary/5">
        <div className="container mx-auto px-4 md:px-6">
          <div className="max-w-3xl mx-auto text-center">
            <h2 className="text-2xl md:text-4xl font-bold mb-4">
              Gatavi sākt?
            </h2>
            <p className="text-muted-foreground mb-8 max-w-xl mx-auto">
              Pievienojieties 100+ Baltijas mazumtirgotājiem, kas jau izmanto RetailRadar AI 
              peļņas palielināšanai.
            </p>
            
            <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
              <Link to="/auth">
                <Button size="lg" className="w-full sm:w-auto px-8">
                  Sākt bez maksas
                  <ArrowRight className="ml-2 h-5 w-5" />
                </Button>
              </Link>
              <Link to="/pricing">
                <Button size="lg" variant="outline" className="w-full sm:w-auto px-8">
                  Apskatīt cenas
                </Button>
              </Link>
            </div>

            <p className="text-xs text-muted-foreground mt-6">
              14 dienu bezmaksas izmēģinājums • Nav nepieciešama kredītkarte • GDPR atbilstība
            </p>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border py-12 md:py-16">
        <div className="container mx-auto px-4 md:px-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 mb-8 md:mb-12">
            <div className="col-span-2 md:col-span-1">
              <div className="flex items-center gap-2 mb-4">
                <div className="h-8 w-8 rounded-lg bg-primary flex items-center justify-center">
                  <BarChart3 className="h-5 w-5 text-primary-foreground" />
                </div>
                <span className="font-semibold">RetailRadar AI</span>
              </div>
              <p className="text-sm text-muted-foreground">
                AI cenu analītikas platforma Baltijas mazumtirgotājiem.
              </p>
            </div>
            
            <div>
              <h4 className="font-semibold mb-4 text-sm">Produkts</h4>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li><Link to="/about" className="hover:text-foreground transition-colors">Par mums</Link></li>
                <li><Link to="/pricing" className="hover:text-foreground transition-colors">Cenas</Link></li>
                <li><a href="#" className="hover:text-foreground transition-colors">Funkcijas</a></li>
              </ul>
            </div>
            
            <div>
              <h4 className="font-semibold mb-4 text-sm">Resursi</h4>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li><a href="#" className="hover:text-foreground transition-colors">Dokumentācija</a></li>
                <li><a href="#" className="hover:text-foreground transition-colors">API</a></li>
                <li><a href="#" className="hover:text-foreground transition-colors">Atbalsts</a></li>
              </ul>
            </div>
            
            <div>
              <h4 className="font-semibold mb-4 text-sm">Juridiskā info</h4>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li><a href="#" className="hover:text-foreground transition-colors">Privātuma politika</a></li>
                <li><a href="#" className="hover:text-foreground transition-colors">Lietošanas noteikumi</a></li>
                <li><a href="#" className="hover:text-foreground transition-colors">GDPR</a></li>
              </ul>
            </div>
          </div>
          
          <div className="border-t border-border pt-8 flex flex-col md:flex-row items-center justify-between gap-4">
            <p className="text-sm text-muted-foreground">
              © 2024 RetailRadar AI. Visas tiesības aizsargātas.
            </p>
            <p className="text-sm text-muted-foreground">
              Izveidots Rīgā, Latvijā
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Landing;
