import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { 
  BarChart3, 
  Users, 
  Target, 
  Lightbulb,
  Globe,
  Award,
  ArrowRight,
  Linkedin,
  Mail
} from "lucide-react";
import { Link } from "react-router-dom";

const AboutUs = () => {
  const team = [
    {
      name: "Jānis Bērziņš",
      role: "CEO & Līdzdibinātājs",
      bio: "15+ gadu pieredze mazumtirdzniecības analītikā",
      image: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=300&h=300&fit=crop&crop=face"
    },
    {
      name: "Anna Kalniņa",
      role: "CTO & Līdzdibinātāja",
      bio: "AI/ML eksperte ar pieredzi Fortune 500",
      image: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=300&h=300&fit=crop&crop=face"
    },
    {
      name: "Mārtiņš Ozols",
      role: "Head of Product",
      bio: "Bijušais kategoriju vadītājs Rimi Baltic",
      image: "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=300&h=300&fit=crop&crop=face"
    },
    {
      name: "Laura Liepiņa",
      role: "Head of Data Science",
      bio: "PhD datu zinātnē, specializācija cenu optimizācijā",
      image: "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=300&h=300&fit=crop&crop=face"
    }
  ];

  const values = [
    {
      icon: Target,
      title: "Precizitāte",
      description: "Mūsu algoritmi nodrošina 95%+ precizitāti cenu rekomendācijās"
    },
    {
      icon: Lightbulb,
      title: "Inovācija",
      description: "Pastāvīgi attīstām jaunas AI funkcijas tirgus vajadzībām"
    },
    {
      icon: Users,
      title: "Partnerība",
      description: "Strādājam kopā ar klientiem kā stratēģiski partneri"
    },
    {
      icon: Globe,
      title: "Lokāla ekspertīze",
      description: "Dziļa izpratne par Baltijas mazumtirdzniecības tirgu"
    }
  ];

  const milestones = [
    { year: "2021", event: "Uzņēmuma dibināšana Rīgā" },
    { year: "2022", event: "Pirmie 10 klienti Latvijā" },
    { year: "2023", event: "Ekspansija uz Lietuvu un Igauniju" },
    { year: "2024", event: "AI Copilot funkcijas ieviešana" },
    { year: "2025", event: "100+ aktīvu klientu Baltijā" }
  ];

  return (
    <div className="min-h-screen bg-background">
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
            <Link to="/about" className="text-primary font-medium">Par mums</Link>
            <Link to="/pricing" className="text-muted-foreground hover:text-foreground transition-colors">Cenas</Link>
            <Link to="/auth">
              <Button variant="outline" className="border-primary/50 hover:bg-primary/10">
                Pieslēgties
              </Button>
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="pt-32 pb-20 relative overflow-hidden">
        <div className="absolute inset-0 grid-pattern opacity-20" />
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-primary/20 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 right-1/4 w-64 h-64 bg-chart-4/20 rounded-full blur-3xl" />
        
        <div className="container mx-auto px-6 relative z-10">
          <div className="max-w-4xl mx-auto text-center">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full glass mb-8">
              <Award className="h-4 w-4 text-primary" />
              <span className="text-sm font-medium">Baltijas līderis cenu analītikā</span>
            </div>
            
            <h1 className="text-4xl md:text-6xl font-bold mb-6">
              Mēs esam <span className="text-gradient">RetailRadar AI</span>
            </h1>
            
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto mb-10">
              Mūsu misija ir palīdzēt Baltijas mazumtirgotājiem pieņemt gudrākus 
              cenu lēmumus, izmantojot jaunākās AI tehnoloģijas.
            </p>
          </div>
        </div>
      </section>

      {/* Story Section */}
      <section className="py-20 relative">
        <div className="container mx-auto px-6">
          <div className="grid lg:grid-cols-2 gap-16 items-center">
            <div>
              <h2 className="text-3xl font-bold mb-6">Mūsu stāsts</h2>
              <div className="space-y-4 text-muted-foreground">
                <p>
                  RetailRadar AI sākās ar vienkāršu novērojumu: Baltijas mazumtirgotāji 
                  pavada neskaitāmas stundas, manuāli analizējot konkurentu cenas un 
                  pieņemot cenu lēmumus, balstoties uz intuīciju.
                </p>
                <p>
                  Mūsu dibinātāji — bijušie kategoriju vadītāji un datu zinātnieki — 
                  nolēma izveidot platformu, kas automatizē šo procesu un sniedz 
                  datu balstītas rekomendācijas reāllaikā.
                </p>
                <p>
                  Šodien mēs apkalpojam vairāk nekā 100 mazumtirdzniecības uzņēmumus 
                  visā Baltijā, palīdzot tiem palielināt peļņas maržu vidēji par 8%.
                </p>
              </div>
            </div>
            
            <div className="relative">
              <div className="absolute inset-0 bg-gradient-to-br from-primary/20 to-chart-4/20 rounded-3xl blur-2xl" />
              <Card className="relative border-gradient">
                <CardContent className="p-8">
                  <h3 className="text-xl font-semibold mb-6">Mūsu ceļš</h3>
                  <div className="space-y-4">
                    {milestones.map((milestone, index) => (
                      <div key={index} className="flex items-center gap-4">
                        <div className="w-16 text-primary font-mono font-bold">{milestone.year}</div>
                        <div className="flex-1 h-px bg-border" />
                        <div className="flex-1 text-sm">{milestone.event}</div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </section>

      {/* Values Section */}
      <section className="py-20 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-primary/5 to-transparent" />
        
        <div className="container mx-auto px-6 relative z-10">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold mb-4">Mūsu vērtības</h2>
            <p className="text-muted-foreground max-w-2xl mx-auto">
              Principi, kas vada mūsu darbu katru dienu
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            {values.map((value, index) => (
              <Card 
                key={index} 
                className="group border-gradient hover:glow-sm transition-all duration-300"
                style={{ animationDelay: `${index * 100}ms` }}
              >
                <CardContent className="p-6 text-center">
                  <div className="h-14 w-14 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-4 group-hover:bg-primary/20 transition-colors">
                    <value.icon className="h-7 w-7 text-primary" />
                  </div>
                  <h3 className="text-lg font-semibold mb-2">{value.title}</h3>
                  <p className="text-sm text-muted-foreground">{value.description}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Team Section */}
      <section className="py-20">
        <div className="container mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold mb-4">Mūsu komanda</h2>
            <p className="text-muted-foreground max-w-2xl mx-auto">
              Profesionāļi ar dziļu pieredzi mazumtirdzniecībā un tehnoloģijās
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
            {team.map((member, index) => (
              <Card 
                key={index} 
                className="group overflow-hidden border-gradient hover:glow-sm transition-all duration-300"
              >
                <div className="aspect-square overflow-hidden">
                  <img 
                    src={member.image} 
                    alt={member.name}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                  />
                </div>
                <CardContent className="p-6">
                  <h3 className="font-semibold text-lg">{member.name}</h3>
                  <p className="text-primary text-sm mb-2">{member.role}</p>
                  <p className="text-sm text-muted-foreground mb-4">{member.bio}</p>
                  <div className="flex gap-3">
                    <Button variant="ghost" size="icon" className="h-8 w-8">
                      <Linkedin className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8">
                      <Mail className="h-4 w-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20">
        <div className="container mx-auto px-6">
          <Card className="relative overflow-hidden border-0 bg-gradient-to-br from-primary/20 via-card to-chart-4/20">
            <div className="absolute inset-0 grid-pattern opacity-10" />
            <CardContent className="relative z-10 p-12 md:p-16 text-center">
              <h2 className="text-3xl md:text-4xl font-bold mb-4">
                Gatavi sadarboties?
              </h2>
              <p className="text-lg text-muted-foreground max-w-2xl mx-auto mb-8">
                Pievienojieties mūsu klientu saimei un sāciet optimizēt savas cenas jau šodien.
              </p>
              <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                <Link to="/auth">
                  <Button size="lg" className="glow">
                    Sākt bez maksas
                    <ArrowRight className="ml-2 h-5 w-5" />
                  </Button>
                </Link>
                <Link to="/pricing">
                  <Button size="lg" variant="outline" className="border-primary/50">
                    Apskatīt cenas
                  </Button>
                </Link>
              </div>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border/50 py-12">
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
              <Link to="/about" className="hover:text-foreground transition-colors">Par mums</Link>
              <Link to="/pricing" className="hover:text-foreground transition-colors">Cenas</Link>
              <a href="#" className="hover:text-foreground transition-colors">Kontakti</a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default AboutUs;
