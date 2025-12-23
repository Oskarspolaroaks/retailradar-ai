import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { 
  BarChart3, 
  Check,
  ArrowRight,
  Zap,
  Crown,
  Building2,
  Star
} from "lucide-react";
import { Link } from "react-router-dom";

const Pricing = () => {
  const plans = [
    {
      name: "Starter",
      price: "150",
      description: "Maziem un vidējiem uzņēmumiem",
      icon: Zap,
      popular: false,
      features: [
        "Līdz 1,000 SKU",
        "ABC segmentācija",
        "Pamata cenu analītika",
        "Nedēļas pārskati",
        "E-pasta atbalsts",
        "1 lietotāja konts",
        "Datu eksports (CSV)",
        "3 mēnešu vēsture"
      ],
      notIncluded: [
        "Konkurentu monitorings",
        "AI rekomendācijas",
        "API piekļuve"
      ]
    },
    {
      name: "Professional",
      price: "299",
      description: "Augošiem uzņēmumiem ar lielāku sortimentu",
      icon: Crown,
      popular: true,
      features: [
        "Līdz 10,000 SKU",
        "ABC segmentācija",
        "Pilna cenu analītika",
        "Konkurentu monitorings (3 konkurenti)",
        "AI Smart Price rekomendācijas",
        "PriceMind Copilot",
        "Reāllaika brīdinājumi",
        "5 lietotāju konti",
        "API piekļuve",
        "12 mēnešu vēsture",
        "Prioritāra atbalsta līnija"
      ],
      notIncluded: []
    },
    {
      name: "Enterprise",
      price: null,
      description: "Lieliem uzņēmumiem ar specifiskām vajadzībām",
      icon: Building2,
      popular: false,
      features: [
        "Neierobežots SKU skaits",
        "Pilna platformas funkcionalitāte",
        "Neierobežots konkurentu skaits",
        "Pielāgoti AI modeļi",
        "Dedicated account manager",
        "SLA garantija 99.9%",
        "Neierobežoti lietotāji",
        "SSO integrācija",
        "Custom integrācijas",
        "On-premise opcija",
        "24/7 prioritārs atbalsts",
        "Kvartāla biznesa pārskati"
      ],
      notIncluded: []
    }
  ];

  const faqs = [
    {
      question: "Vai ir bezmaksas izmēģinājuma periods?",
      answer: "Jā, piedāvājam 14 dienu bezmaksas izmēģinājumu visām pakām. Nav nepieciešama kredītkarte."
    },
    {
      question: "Vai varu mainīt plānu vēlāk?",
      answer: "Protams! Jūs varat jebkurā laikā pāriet uz augstāku vai zemāku plānu."
    },
    {
      question: "Kā notiek maksājumi?",
      answer: "Piedāvājam ikmēneša vai gada maksājumus. Gada maksājumiem ir 15% atlaide."
    },
    {
      question: "Vai ir pieejama palīdzība ieviešanā?",
      answer: "Jā, visiem Professional un Enterprise klientiem nodrošinām bezmaksas onboarding sesiju."
    }
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
            <Link to="/about" className="text-muted-foreground hover:text-foreground transition-colors">Par mums</Link>
            <Link to="/pricing" className="text-primary font-medium">Cenas</Link>
            <Link to="/auth">
              <Button variant="outline" className="border-primary/50 hover:bg-primary/10">
                Pieslēgties
              </Button>
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="pt-32 pb-16 relative overflow-hidden">
        <div className="absolute inset-0 grid-pattern opacity-20" />
        <div className="absolute top-1/3 left-1/2 -translate-x-1/2 w-[600px] h-[600px] bg-primary/10 rounded-full blur-3xl" />
        
        <div className="container mx-auto px-6 relative z-10">
          <div className="max-w-3xl mx-auto text-center">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full glass mb-8">
              <Star className="h-4 w-4 text-primary" />
              <span className="text-sm font-medium">Caurspīdīga cenu politika</span>
            </div>
            
            <h1 className="text-4xl md:text-5xl font-bold mb-6">
              Izvēlieties savu <span className="text-gradient">plānu</span>
            </h1>
            
            <p className="text-xl text-muted-foreground">
              Elastīgi plāni katram biznesa posmam. Sāciet ar bezmaksas izmēģinājumu.
            </p>
          </div>
        </div>
      </section>

      {/* Pricing Cards */}
      <section className="py-12 relative">
        <div className="container mx-auto px-6">
          <div className="grid md:grid-cols-3 gap-8 max-w-6xl mx-auto">
            {plans.map((plan, index) => (
              <Card 
                key={index} 
                className={`relative overflow-hidden transition-all duration-300 hover:translate-y-[-4px] ${
                  plan.popular 
                    ? 'border-primary glow' 
                    : 'border-gradient hover:glow-sm'
                }`}
              >
                {plan.popular && (
                  <div className="absolute top-0 left-0 right-0 bg-primary py-1 text-center">
                    <span className="text-xs font-semibold text-primary-foreground">
                      POPULĀRĀKAIS
                    </span>
                  </div>
                )}
                
                <CardHeader className={plan.popular ? 'pt-10' : ''}>
                  <div className="flex items-center gap-3 mb-4">
                    <div className={`h-12 w-12 rounded-xl flex items-center justify-center ${
                      plan.popular ? 'bg-primary' : 'bg-primary/10'
                    }`}>
                      <plan.icon className={`h-6 w-6 ${
                        plan.popular ? 'text-primary-foreground' : 'text-primary'
                      }`} />
                    </div>
                    <div>
                      <CardTitle className="text-xl">{plan.name}</CardTitle>
                      <p className="text-sm text-muted-foreground">{plan.description}</p>
                    </div>
                  </div>
                  
                  <div className="flex items-baseline gap-1">
                    {plan.price ? (
                      <>
                        <span className="text-4xl font-bold">€{plan.price}</span>
                        <span className="text-muted-foreground">/mēnesī</span>
                      </>
                    ) : (
                      <span className="text-2xl font-bold">Pēc pieprasījuma</span>
                    )}
                  </div>
                </CardHeader>
                
                <CardContent>
                  <Link to={plan.price ? "/auth" : "#"}>
                    <Button 
                      className={`w-full mb-6 ${plan.popular ? 'glow' : ''}`}
                      variant={plan.popular ? "default" : "outline"}
                    >
                      {plan.price ? "Sākt bez maksas" : "Sazināties"}
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </Button>
                  </Link>
                  
                  <div className="space-y-3">
                    {plan.features.map((feature, fIndex) => (
                      <div key={fIndex} className="flex items-start gap-3">
                        <Check className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
                        <span className="text-sm">{feature}</span>
                      </div>
                    ))}
                    
                    {plan.notIncluded.map((feature, fIndex) => (
                      <div key={fIndex} className="flex items-start gap-3 opacity-40">
                        <Check className="h-5 w-5 flex-shrink-0 mt-0.5" />
                        <span className="text-sm line-through">{feature}</span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Feature Comparison Note */}
      <section className="py-12">
        <div className="container mx-auto px-6">
          <div className="max-w-4xl mx-auto">
            <Card className="border-gradient">
              <CardContent className="p-8 flex flex-col md:flex-row items-center gap-6">
                <div className="flex-1">
                  <h3 className="text-xl font-semibold mb-2">Nepieciešama palīdzība izvēlē?</h3>
                  <p className="text-muted-foreground">
                    Sazinieties ar mūsu ekspertiem, un mēs palīdzēsim izvēlēties 
                    piemērotāko risinājumu jūsu biznesam.
                  </p>
                </div>
                <Button variant="outline" className="border-primary/50">
                  Rezervēt konsultāciju
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* FAQ Section */}
      <section className="py-20 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-primary/5 to-transparent" />
        
        <div className="container mx-auto px-6 relative z-10">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold mb-4">Biežāk uzdotie jautājumi</h2>
          </div>
          
          <div className="grid md:grid-cols-2 gap-6 max-w-4xl mx-auto">
            {faqs.map((faq, index) => (
              <Card key={index} className="border-gradient hover:glow-sm transition-all duration-300">
                <CardContent className="p-6">
                  <h3 className="font-semibold mb-2">{faq.question}</h3>
                  <p className="text-sm text-muted-foreground">{faq.answer}</p>
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
                Gatavi sākt?
              </h2>
              <p className="text-lg text-muted-foreground max-w-2xl mx-auto mb-8">
                Pievienojieties 100+ Baltijas uzņēmumiem, kas jau izmanto RetailRadar AI.
              </p>
              <Link to="/auth">
                <Button size="lg" className="glow">
                  Sākt 14 dienu izmēģinājumu
                  <ArrowRight className="ml-2 h-5 w-5" />
                </Button>
              </Link>
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

export default Pricing;
