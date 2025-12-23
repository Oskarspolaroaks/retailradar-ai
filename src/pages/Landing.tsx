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
  Play,
  Star,
  Quote,
  ChevronRight,
  Sparkles,
  Globe,
  Clock
} from "lucide-react";
import { Link } from "react-router-dom";

const Landing = () => {
  const features = [
    {
      icon: BarChart3,
      title: "ABC Segmentācija",
      description: "Automātiska produktu klasifikācija pēc ienesīguma ar konfigurējamiem sliekšņiem."
    },
    {
      icon: TrendingUp,
      title: "Cenu Elastība",
      description: "Pieprasījuma jutīguma analīze optimālai cenu noteikšanai."
    },
    {
      icon: Target,
      title: "Smart Price",
      description: "Automātiskas cenu rekomendācijas, kas aizsargā peļņas maržu."
    },
    {
      icon: Brain,
      title: "PriceMind Copilot",
      description: "AI asistents ar konkrētām cenu rekomendācijām dabiskā valodā."
    },
    {
      icon: Store,
      title: "Konkurentu Monitorings",
      description: "Automātiska konkurentu cenu un akciju izsekošana reāllaikā."
    },
    {
      icon: PieChart,
      title: "Symphony Analītika",
      description: "Dziļa kategoriju analīze ar produktu lomu noteikšanu."
    }
  ];

  const benefits = [
    "Palieliniet peļņas maržu par 3-8%",
    "Ietaupiet 10+ stundas nedēļā",
    "Reaģējiet reāllaikā uz konkurentu izmaiņām",
    "Pieņemiet datu balstītus lēmumus"
  ];

  const metrics = [
    { value: "100+", label: "Aktīvi klienti", suffix: "" },
    { value: "8", label: "Vidējā maržas uzlabošana", suffix: "%" },
    { value: "24/7", label: "Monitorings", suffix: "" },
    { value: "1M+", label: "Analizēti produkti", suffix: "" }
  ];

  const testimonials = [
    {
      name: "Mārtiņš Liepiņš",
      role: "Kategoriju vadītājs",
      company: "Baltic Foods",
      image: "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=100&h=100&fit=crop&crop=face",
      quote: "RetailRadar AI palīdzēja mums palielināt A kategorijas produktu maržu par 12% tikai 3 mēnešu laikā. Konkurentu monitorings ir neatsverams.",
      rating: 5
    },
    {
      name: "Ilze Ozola",
      role: "Cenu analītiķe",
      company: "MaxiMart",
      image: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=100&h=100&fit=crop&crop=face",
      quote: "Pirms RetailRadar pavadīju 15 stundas nedēļā manuāli analizējot konkurentu cenas. Tagad tas notiek automātiski un precīzāk.",
      rating: 5
    },
    {
      name: "Andris Kalniņš",
      role: "Komercdirektors",
      company: "SmartRetail",
      image: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100&h=100&fit=crop&crop=face",
      quote: "AI rekomendācijas ir precīzas un viegli izpildāmas. Mūsu komanda tagad var fokusēties uz stratēģiju, nevis rutīnu.",
      rating: 5
    }
  ];

  const logos = [
    "Baltic Foods", "MaxiMart", "SmartRetail", "NordShop", "EuroMarket", "PrimeMart"
  ];

  return (
    <div className="min-h-screen bg-background overflow-hidden">
      {/* Navigation */}
      <nav className="fixed top-0 left-0 right-0 z-50 glass-strong">
        <div className="container mx-auto px-6 py-4 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-primary flex items-center justify-center glow-sm">
              <BarChart3 className="h-6 w-6 text-primary-foreground" />
            </div>
            <span className="text-xl font-bold">RetailRadar AI</span>
          </Link>
          
          <div className="hidden md:flex items-center gap-8">
            <Link to="/about" className="text-muted-foreground hover:text-foreground transition-colors">
              Par mums
            </Link>
            <Link to="/pricing" className="text-muted-foreground hover:text-foreground transition-colors">
              Cenas
            </Link>
            <Link to="/auth">
              <Button variant="ghost">Pieslēgties</Button>
            </Link>
            <Link to="/auth">
              <Button className="glow-sm">Sākt bez maksas</Button>
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <header className="relative pt-32 pb-20 md:pt-40 md:pb-32">
        {/* Background Effects */}
        <div className="absolute inset-0 grid-pattern opacity-30" />
        <div className="absolute top-0 left-1/4 w-[500px] h-[500px] bg-primary/20 rounded-full blur-[120px] animate-pulse-glow" />
        <div className="absolute bottom-0 right-1/4 w-[400px] h-[400px] bg-chart-4/15 rounded-full blur-[100px]" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-gradient-radial opacity-50" />
        
        <div className="container mx-auto px-6 relative z-10">
          <div className="max-w-5xl mx-auto text-center">
            {/* Badge */}
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full glass mb-8 animate-fade-in">
              <Sparkles className="h-4 w-4 text-primary" />
              <span className="text-sm font-medium">AI-powered retail analytics</span>
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            </div>
            
            {/* Main Heading */}
            <h1 className="text-5xl md:text-7xl lg:text-8xl font-bold tracking-tight mb-8 animate-fade-in-up">
              <span className="block">Optimizējiet cenas.</span>
              <span className="text-gradient">Palieliniet peļņu.</span>
            </h1>
            
            {/* Subtitle */}
            <p className="text-xl md:text-2xl text-muted-foreground max-w-3xl mx-auto mb-12 animate-fade-in-up" style={{ animationDelay: '0.1s' }}>
              RetailRadar AI apvieno pārdošanas datus, konkurentu cenas un AI rekomendācijas 
              vienā platformā Baltijas mazumtirgotājiem.
            </p>
            
            {/* CTA Buttons */}
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-16 animate-fade-in-up" style={{ animationDelay: '0.2s' }}>
              <Link to="/auth">
                <Button size="lg" className="text-lg px-8 h-14 glow">
                  Izmēģināt bez maksas
                  <ArrowRight className="ml-2 h-5 w-5" />
                </Button>
              </Link>
              <Button size="lg" variant="outline" className="text-lg px-8 h-14 border-primary/50 hover:bg-primary/10">
                <Play className="mr-2 h-5 w-5" />
                Skatīt demo
              </Button>
            </div>

            {/* Trust Badges */}
            <div className="flex items-center justify-center gap-8 text-sm text-muted-foreground animate-fade-in" style={{ animationDelay: '0.3s' }}>
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-primary" />
                <span>14 dienu izmēģinājums</span>
              </div>
              <div className="flex items-center gap-2">
                <Shield className="h-4 w-4 text-primary" />
                <span>GDPR compliant</span>
              </div>
              <div className="flex items-center gap-2">
                <Globe className="h-4 w-4 text-primary" />
                <span>Baltijas fokuss</span>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Metrics Bar */}
      <section className="relative py-12 border-y border-border/50 glass">
        <div className="container mx-auto px-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            {metrics.map((metric, index) => (
              <div key={index} className="text-center">
                <div className="text-4xl md:text-5xl font-bold text-gradient mb-2">
                  {metric.value}{metric.suffix}
                </div>
                <div className="text-sm text-muted-foreground">{metric.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Client Logos */}
      <section className="py-16 relative overflow-hidden">
        <div className="container mx-auto px-6">
          <p className="text-center text-sm text-muted-foreground mb-8">
            Uzticas vadošie Baltijas mazumtirgotāji
          </p>
          <div className="flex flex-wrap items-center justify-center gap-12">
            {logos.map((logo, index) => (
              <div 
                key={index} 
                className="text-xl font-semibold text-muted-foreground/50 hover:text-muted-foreground transition-colors"
              >
                {logo}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-24 relative">
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-primary/5 to-transparent" />
        
        <div className="container mx-auto px-6 relative z-10">
          <div className="text-center mb-16">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full glass mb-6">
              <Zap className="h-4 w-4 text-primary" />
              <span className="text-sm font-medium">Pilns funkciju komplekts</span>
            </div>
            <h2 className="text-4xl md:text-5xl font-bold mb-4">
              Viss nepieciešamais <span className="text-gradient">vienuviet</span>
            </h2>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              No ABC segmentācijas līdz AI rekomendācijām — pilns rīku komplekts 
              kategoriju vadītājiem un cenu analītiķiem.
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {features.map((feature, index) => (
              <Card 
                key={index} 
                className="group border-gradient hover:glow-sm transition-all duration-500"
                style={{ animationDelay: `${index * 50}ms` }}
              >
                <CardContent className="p-8">
                  <div className="h-14 w-14 rounded-2xl bg-primary/10 flex items-center justify-center mb-6 group-hover:bg-primary/20 group-hover:scale-110 transition-all duration-300">
                    <feature.icon className="h-7 w-7 text-primary" />
                  </div>
                  <h3 className="text-xl font-semibold mb-3">{feature.title}</h3>
                  <p className="text-muted-foreground">{feature.description}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Dashboard Preview Section */}
      <section className="py-24 relative overflow-hidden">
        <div className="container mx-auto px-6">
          <div className="grid lg:grid-cols-2 gap-16 items-center">
            <div>
              <h2 className="text-4xl font-bold mb-6">
                Kāpēc izvēlēties <span className="text-gradient">RetailRadar AI?</span>
              </h2>
              <p className="text-xl text-muted-foreground mb-8">
                Mūsu platforma ir veidota speciāli Baltijas mazumtirgotājiem, 
                ņemot vērā vietējā tirgus specifiku.
              </p>
              
              <ul className="space-y-4">
                {benefits.map((benefit, index) => (
                  <li key={index} className="flex items-start gap-4 group">
                    <div className="h-6 w-6 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0 mt-0.5 group-hover:bg-primary/30 transition-colors">
                      <CheckCircle className="h-4 w-4 text-primary" />
                    </div>
                    <span className="text-lg">{benefit}</span>
                  </li>
                ))}
              </ul>

              <div className="mt-10">
                <Link to="/auth">
                  <Button size="lg" className="glow">
                    Sākt bez maksas
                    <ArrowRight className="ml-2 h-5 w-5" />
                  </Button>
                </Link>
              </div>
            </div>

            <div className="relative">
              <div className="absolute inset-0 bg-gradient-to-br from-primary/20 to-chart-4/20 rounded-3xl blur-3xl" />
              <Card className="relative border-gradient overflow-hidden">
                <CardContent className="p-0">
                  {/* Mock Dashboard UI */}
                  <div className="bg-card p-6">
                    <div className="flex items-center justify-between mb-6">
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-lg bg-primary/20 flex items-center justify-center">
                          <LineChart className="h-5 w-5 text-primary" />
                        </div>
                        <div>
                          <div className="font-semibold">Reāllaika analītika</div>
                          <div className="text-xs text-muted-foreground">Atjaunots pirms 2 min</div>
                        </div>
                      </div>
                      <div className="h-2 w-2 rounded-full bg-success animate-pulse" />
                    </div>
                    
                    {/* Mock Stats */}
                    <div className="grid grid-cols-3 gap-4 mb-6">
                      <div className="p-4 rounded-xl bg-secondary/50">
                        <div className="text-2xl font-bold text-primary">+5.2%</div>
                        <div className="text-xs text-muted-foreground">Marža</div>
                      </div>
                      <div className="p-4 rounded-xl bg-secondary/50">
                        <div className="text-2xl font-bold text-warning">12</div>
                        <div className="text-xs text-muted-foreground">Brīdinājumi</div>
                      </div>
                      <div className="p-4 rounded-xl bg-secondary/50">
                        <div className="text-2xl font-bold text-success">28</div>
                        <div className="text-xs text-muted-foreground">Ieteikumi</div>
                      </div>
                    </div>

                    {/* Mock Chart */}
                    <div className="h-32 bg-secondary/30 rounded-xl flex items-end justify-around p-4">
                      {[40, 65, 45, 80, 55, 90, 70].map((height, i) => (
                        <div 
                          key={i} 
                          className="w-8 bg-gradient-to-t from-primary to-primary/50 rounded-t-lg transition-all duration-500 hover:from-primary hover:to-primary/70"
                          style={{ height: `${height}%` }}
                        />
                      ))}
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </section>

      {/* Testimonials Section */}
      <section className="py-24 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-primary/5 to-transparent" />
        
        <div className="container mx-auto px-6 relative z-10">
          <div className="text-center mb-16">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full glass mb-6">
              <Star className="h-4 w-4 text-primary" />
              <span className="text-sm font-medium">Klientu atsauksmes</span>
            </div>
            <h2 className="text-4xl md:text-5xl font-bold mb-4">
              Ko saka mūsu <span className="text-gradient">klienti</span>
            </h2>
            <p className="text-xl text-muted-foreground">
              Reāli rezultāti no reāliem Baltijas uzņēmumiem
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            {testimonials.map((testimonial, index) => (
              <Card 
                key={index} 
                className="group border-gradient hover:glow-sm transition-all duration-500 relative overflow-hidden"
              >
                <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-full blur-2xl group-hover:bg-primary/10 transition-colors" />
                <CardContent className="p-8 relative z-10">
                  <Quote className="h-10 w-10 text-primary/20 mb-4" />
                  
                  <p className="text-lg mb-6 leading-relaxed">
                    "{testimonial.quote}"
                  </p>
                  
                  <div className="flex items-center gap-1 mb-6">
                    {[...Array(testimonial.rating)].map((_, i) => (
                      <Star key={i} className="h-4 w-4 fill-primary text-primary" />
                    ))}
                  </div>
                  
                  <div className="flex items-center gap-4">
                    <img 
                      src={testimonial.image} 
                      alt={testimonial.name}
                      className="h-12 w-12 rounded-full object-cover ring-2 ring-primary/20"
                    />
                    <div>
                      <div className="font-semibold">{testimonial.name}</div>
                      <div className="text-sm text-muted-foreground">
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
      <section className="py-24">
        <div className="container mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold mb-4">
              Kam paredzēts <span className="text-gradient">RetailRadar AI?</span>
            </h2>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              Mūsu risinājums ir izstrādāts Baltijas mazumtirdzniecības profesionāļiem.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            <Card className="group text-center border-gradient hover:glow-sm transition-all duration-300">
              <CardContent className="p-10">
                <div className="h-16 w-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-6 group-hover:bg-primary/20 group-hover:scale-110 transition-all">
                  <Users className="h-8 w-8 text-primary" />
                </div>
                <h3 className="text-xl font-semibold mb-3">Kategoriju vadītāji</h3>
                <p className="text-muted-foreground">
                  Optimizējiet sortimentu un cenas ar datu balstītiem lēmumiem.
                </p>
              </CardContent>
            </Card>
            
            <Card className="group text-center border-gradient hover:glow-sm transition-all duration-300">
              <CardContent className="p-10">
                <div className="h-16 w-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-6 group-hover:bg-primary/20 group-hover:scale-110 transition-all">
                  <TrendingUp className="h-8 w-8 text-primary" />
                </div>
                <h3 className="text-xl font-semibold mb-3">Cenu analītiķi</h3>
                <p className="text-muted-foreground">
                  Automatizējiet konkurentu monitoringu un cenu analīzi.
                </p>
              </CardContent>
            </Card>
            
            <Card className="group text-center border-gradient hover:glow-sm transition-all duration-300">
              <CardContent className="p-10">
                <div className="h-16 w-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-6 group-hover:bg-primary/20 group-hover:scale-110 transition-all">
                  <Shield className="h-8 w-8 text-primary" />
                </div>
                <h3 className="text-xl font-semibold mb-3">Vadības komanda</h3>
                <p className="text-muted-foreground">
                  Saņemiet pilnu pārskatu par maržu un konkurētspēju.
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-24">
        <div className="container mx-auto px-6">
          <Card className="relative overflow-hidden border-0 bg-gradient-to-br from-primary/20 via-card to-chart-4/20">
            <div className="absolute inset-0 grid-pattern opacity-10" />
            <div className="absolute top-0 right-0 w-96 h-96 bg-primary/20 rounded-full blur-3xl" />
            <div className="absolute bottom-0 left-0 w-64 h-64 bg-chart-4/20 rounded-full blur-3xl" />
            
            <CardContent className="relative z-10 p-12 md:p-20 text-center">
              <h2 className="text-4xl md:text-5xl font-bold mb-6">
                Gatavi sākt?
              </h2>
              <p className="text-xl text-muted-foreground max-w-2xl mx-auto mb-10">
                Pievienojieties 100+ Baltijas mazumtirgotājiem, kas jau izmanto RetailRadar AI 
                peļņas palielināšanai un konkurētspējas uzlabošanai.
              </p>
              
              <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                <Link to="/auth">
                  <Button size="lg" className="text-lg px-10 h-14 glow">
                    Sākt bez maksas
                    <ArrowRight className="ml-2 h-5 w-5" />
                  </Button>
                </Link>
                <Link to="/pricing">
                  <Button size="lg" variant="outline" className="text-lg px-10 h-14 border-primary/50 hover:bg-primary/10">
                    Apskatīt cenas
                  </Button>
                </Link>
              </div>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border/50 py-16">
        <div className="container mx-auto px-6">
          <div className="grid md:grid-cols-4 gap-12 mb-12">
            <div>
              <div className="flex items-center gap-3 mb-4">
                <div className="h-10 w-10 rounded-xl bg-primary flex items-center justify-center">
                  <BarChart3 className="h-6 w-6 text-primary-foreground" />
                </div>
                <span className="text-xl font-bold">RetailRadar AI</span>
              </div>
              <p className="text-sm text-muted-foreground">
                AI-powered cenu analītikas platforma Baltijas mazumtirgotājiem.
              </p>
            </div>
            
            <div>
              <h4 className="font-semibold mb-4">Produkts</h4>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li><Link to="/about" className="hover:text-foreground transition-colors">Par mums</Link></li>
                <li><Link to="/pricing" className="hover:text-foreground transition-colors">Cenas</Link></li>
                <li><a href="#" className="hover:text-foreground transition-colors">Funkcijas</a></li>
              </ul>
            </div>
            
            <div>
              <h4 className="font-semibold mb-4">Resursi</h4>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li><a href="#" className="hover:text-foreground transition-colors">Dokumentācija</a></li>
                <li><a href="#" className="hover:text-foreground transition-colors">API</a></li>
                <li><a href="#" className="hover:text-foreground transition-colors">Atbalsts</a></li>
              </ul>
            </div>
            
            <div>
              <h4 className="font-semibold mb-4">Juridiskā info</h4>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li><a href="#" className="hover:text-foreground transition-colors">Privātuma politika</a></li>
                <li><a href="#" className="hover:text-foreground transition-colors">Lietošanas noteikumi</a></li>
                <li><a href="#" className="hover:text-foreground transition-colors">GDPR</a></li>
              </ul>
            </div>
          </div>
          
          <div className="border-t border-border/50 pt-8 flex flex-col md:flex-row items-center justify-between gap-4">
            <p className="text-sm text-muted-foreground">
              © 2024 RetailRadar AI. Visas tiesības aizsargātas.
            </p>
            <div className="flex items-center gap-4 text-sm text-muted-foreground">
              <span>Izveidots ar ❤️ Rīgā, Latvijā</span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Landing;
