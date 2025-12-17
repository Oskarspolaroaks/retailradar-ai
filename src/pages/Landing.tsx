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
  Store
} from "lucide-react";
import { Link } from "react-router-dom";

const Landing = () => {
  const features = [
    {
      icon: BarChart3,
      title: "ABC Segmentācija",
      description: "Automātiska produktu klasifikācija pēc ienesīguma ar konfigurējamiem sliekšņiem (A=80%, B=15%, C=5%)."
    },
    {
      icon: TrendingUp,
      title: "Cenu Elastība",
      description: "Pieprasījuma jutīguma analīze, izmantojot vēsturiskos pārdošanas un cenu datus optimālai cenu noteikšanai."
    },
    {
      icon: Target,
      title: "Smart Price",
      description: "Automātiskas cenu rekomendācijas, kas nodrošina konkurētspēju un aizsargā peļņas maržu."
    },
    {
      icon: Brain,
      title: "PriceMind Copilot",
      description: "AI asistents, kas analizē datus un sniedz konkrētas cenu rekomendācijas dabiskā valodā."
    },
    {
      icon: Store,
      title: "Konkurentu Monitorings",
      description: "Automātiska konkurentu cenu un akciju izsekošana ar AI produktu sasaisti."
    },
    {
      icon: PieChart,
      title: "Symphony Analītika",
      description: "Dziļa kategoriju analīze ar produktu lomu noteikšanu un rotācijas metriku."
    }
  ];

  const benefits = [
    "Palieliniet peļņas maržu par 3-8% ar optimizētām cenām",
    "Ietaupiet 10+ stundas nedēļā ar automatizētu analītiku",
    "Reaģējiet uz konkurentu izmaiņām reāllaikā",
    "Pieņemiet datu balstītus lēmumus, nevis minējumus"
  ];

  const metrics = [
    { value: "80%", label: "A klases produktu fokuss" },
    { value: "15%", label: "Vidējā maržas uzlabošana" },
    { value: "24/7", label: "Konkurentu monitorings" },
    { value: "100+", label: "Analītikas metriku" }
  ];

  return (
    <div className="min-h-screen bg-background">
      {/* Hero Section */}
      <header className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-background to-accent/10" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,hsl(var(--primary)/0.15),transparent_50%)]" />
        
        <nav className="relative z-10 container mx-auto px-6 py-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-primary flex items-center justify-center">
              <BarChart3 className="h-6 w-6 text-primary-foreground" />
            </div>
            <span className="text-2xl font-bold tracking-tight">RetailRadar AI</span>
          </div>
          <div className="flex items-center gap-4">
            <Link to="/auth">
              <Button variant="ghost">Pieslēgties</Button>
            </Link>
            <Link to="/auth">
              <Button>Sākt bez maksas</Button>
            </Link>
          </div>
        </nav>

        <div className="relative z-10 container mx-auto px-6 py-24 md:py-32">
          <div className="max-w-4xl mx-auto text-center">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 text-primary text-sm font-medium mb-8">
              <Zap className="h-4 w-4" />
              Mazumtirdzniecības analītika ar AI
            </div>
            
            <h1 className="text-4xl md:text-6xl lg:text-7xl font-bold tracking-tight mb-6 bg-gradient-to-br from-foreground via-foreground to-muted-foreground bg-clip-text">
              Optimizējiet cenas.
              <br />
              <span className="text-primary">Palieliniet peļņu.</span>
            </h1>
            
            <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto mb-10">
              RetailRadar AI apvieno pārdošanas datus, konkurentu cenas un AI rekomendācijas 
              vienā platformā Baltijas mazumtirgotājiem.
            </p>
            
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link to="/auth">
                <Button size="lg" className="text-lg px-8 h-14">
                  Izmēģināt bez maksas
                  <ArrowRight className="ml-2 h-5 w-5" />
                </Button>
              </Link>
              <Link to="/dashboard">
                <Button size="lg" variant="outline" className="text-lg px-8 h-14">
                  Skatīt demo
                </Button>
              </Link>
            </div>
          </div>
        </div>

        {/* Metrics bar */}
        <div className="relative z-10 border-y bg-card/50 backdrop-blur-sm">
          <div className="container mx-auto px-6 py-8">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
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
        </div>
      </header>

      {/* Features Section */}
      <section className="py-24 bg-muted/30">
        <div className="container mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">
              Viss nepieciešamais vienuviet
            </h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              No ABC segmentācijas līdz AI rekomendācijām — pilns rīku komplekts 
              kategoriju vadītājiem un cenu analītiķiem.
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {features.map((feature, index) => (
              <Card key={index} className="group hover:shadow-lg transition-all duration-300 border-border/50 hover:border-primary/30">
                <CardContent className="p-6">
                  <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center mb-4 group-hover:bg-primary/20 transition-colors">
                    <feature.icon className="h-6 w-6 text-primary" />
                  </div>
                  <h3 className="text-xl font-semibold mb-2">{feature.title}</h3>
                  <p className="text-muted-foreground">{feature.description}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Benefits Section */}
      <section className="py-24">
        <div className="container mx-auto px-6">
          <div className="grid lg:grid-cols-2 gap-16 items-center">
            <div>
              <h2 className="text-3xl md:text-4xl font-bold mb-6">
                Kāpēc izvēlēties RetailRadar AI?
              </h2>
              <p className="text-lg text-muted-foreground mb-8">
                Mūsu platforma ir veidota speciāli Baltijas mazumtirgotājiem, 
                ņemot vērā vietējā tirgus specifiku un integrāciju ar populārākajiem 
                piegādātājiem un konkurentiem.
              </p>
              
              <ul className="space-y-4">
                {benefits.map((benefit, index) => (
                  <li key={index} className="flex items-start gap-3">
                    <CheckCircle className="h-6 w-6 text-primary flex-shrink-0 mt-0.5" />
                    <span className="text-lg">{benefit}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="relative">
              <div className="absolute inset-0 bg-gradient-to-br from-primary/20 to-accent/20 rounded-3xl blur-3xl" />
              <Card className="relative border-2">
                <CardContent className="p-8">
                  <div className="flex items-center gap-4 mb-6">
                    <div className="h-14 w-14 rounded-2xl bg-gradient-to-br from-primary to-primary/70 flex items-center justify-center">
                      <LineChart className="h-7 w-7 text-primary-foreground" />
                    </div>
                    <div>
                      <h4 className="font-semibold text-lg">Reāllaika analītika</h4>
                      <p className="text-sm text-muted-foreground">Visi dati vienā skatā</p>
                    </div>
                  </div>
                  
                  <div className="space-y-4">
                    <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                      <span className="text-sm">A klases produkti</span>
                      <span className="font-semibold text-primary">+5.2% marža</span>
                    </div>
                    <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                      <span className="text-sm">Konkurentu cenas</span>
                      <span className="font-semibold text-orange-500">12 brīdinājumi</span>
                    </div>
                    <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                      <span className="text-sm">Jauni ieteikumi</span>
                      <span className="font-semibold text-green-500">28 aktīvi</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </section>

      {/* Target Audience Section */}
      <section className="py-24 bg-muted/30">
        <div className="container mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">
              Kam paredzēts RetailRadar AI?
            </h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              Mūsu risinājums ir izstrādāts Baltijas mazumtirdzniecības profesionāļiem.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            <Card className="text-center p-8">
              <Users className="h-12 w-12 text-primary mx-auto mb-4" />
              <h3 className="text-xl font-semibold mb-2">Kategoriju vadītāji</h3>
              <p className="text-muted-foreground">
                Optimizējiet sortimentu un cenas ar datu balstītiem lēmumiem.
              </p>
            </Card>
            
            <Card className="text-center p-8">
              <TrendingUp className="h-12 w-12 text-primary mx-auto mb-4" />
              <h3 className="text-xl font-semibold mb-2">Cenu analītiķi</h3>
              <p className="text-muted-foreground">
                Automatizējiet konkurentu monitoringu un cenu analīzi.
              </p>
            </Card>
            
            <Card className="text-center p-8">
              <Shield className="h-12 w-12 text-primary mx-auto mb-4" />
              <h3 className="text-xl font-semibold mb-2">Vadības komanda</h3>
              <p className="text-muted-foreground">
                Saņemiet pilnu pārskatu par maržu un konkurētspēju.
              </p>
            </Card>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-24">
        <div className="container mx-auto px-6">
          <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-primary to-primary/80 p-12 md:p-16 text-center">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_70%_30%,hsl(var(--primary-foreground)/0.1),transparent_50%)]" />
            
            <div className="relative z-10">
              <h2 className="text-3xl md:text-4xl font-bold text-primary-foreground mb-4">
                Gatavi sākt?
              </h2>
              <p className="text-lg text-primary-foreground/80 max-w-2xl mx-auto mb-8">
                Pievienojieties Baltijas mazumtirgotājiem, kas jau izmanto RetailRadar AI 
                peļņas palielināšanai un konkurētspējas uzlabošanai.
              </p>
              
              <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                <Link to="/auth">
                  <Button size="lg" variant="secondary" className="text-lg px-8 h-14">
                    Sākt bez maksas
                    <ArrowRight className="ml-2 h-5 w-5" />
                  </Button>
                </Link>
                <Button size="lg" variant="outline" className="text-lg px-8 h-14 bg-transparent border-primary-foreground/30 text-primary-foreground hover:bg-primary-foreground/10">
                  Pieprasīt demo
                </Button>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t py-12">
        <div className="container mx-auto px-6">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="flex items-center gap-3">
              <div className="h-8 w-8 rounded-lg bg-primary flex items-center justify-center">
                <BarChart3 className="h-5 w-5 text-primary-foreground" />
              </div>
              <span className="font-semibold">RetailRadar AI</span>
            </div>
            
            <p className="text-sm text-muted-foreground">
              © 2024 RetailRadar AI. Visas tiesības aizsargātas.
            </p>
            
            <div className="flex items-center gap-6 text-sm text-muted-foreground">
              <a href="#" className="hover:text-foreground transition-colors">Privātuma politika</a>
              <a href="#" className="hover:text-foreground transition-colors">Lietošanas noteikumi</a>
              <a href="#" className="hover:text-foreground transition-colors">Kontakti</a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Landing;
