import { BarChart3, Package, Zap, MoreHorizontal } from "lucide-react";
import { NavLink } from "@/components/NavLink";
import { useState } from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { AlertCircle, Calculator, Settings, CalendarDays, Music, Radar } from "lucide-react";

const primaryItems = [
  { title: "Dashboard", url: "/dashboard", icon: BarChart3 },
  { title: "Products", url: "/products", icon: Package },
  { title: "Price Opt.", url: "/smart-price", icon: Zap },
  { title: "PriceRadar", url: "/price-radar", icon: Radar },
];

const moreItems = [
  { title: "Weekly Sales", url: "/weekly-sales", icon: CalendarDays },
  { title: "Price Simulator", url: "/pricing-simulator", icon: Calculator },
  { title: "Symphony", url: "/symphony", icon: Music },
  { title: "Alerts", url: "/alerts", icon: AlertCircle },
  { title: "Settings", url: "/settings", icon: Settings },
];

export function BottomNavigation() {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-card border-t border-border md:hidden">
      <div className="flex items-center justify-around h-16 px-2">
        {primaryItems.map((item) => (
          <NavLink
            key={item.title}
            to={item.url}
            end
            className="flex flex-col items-center justify-center gap-1 px-3 py-2 text-muted-foreground hover:text-primary transition-colors"
            activeClassName="text-primary"
          >
            <item.icon className="h-5 w-5" />
            <span className="text-[10px] font-medium">{item.title}</span>
          </NavLink>
        ))}
        
        <Sheet open={isOpen} onOpenChange={setIsOpen}>
          <SheetTrigger asChild>
            <button className="flex flex-col items-center justify-center gap-1 px-3 py-2 text-muted-foreground hover:text-primary transition-colors">
              <MoreHorizontal className="h-5 w-5" />
              <span className="text-[10px] font-medium">More</span>
            </button>
          </SheetTrigger>
          <SheetContent side="bottom" className="h-auto max-h-[70vh]">
            <SheetHeader>
              <SheetTitle className="text-left">More Options</SheetTitle>
            </SheetHeader>
            <div className="grid grid-cols-3 gap-4 py-6">
              {moreItems.map((item) => (
                <NavLink
                  key={item.title}
                  to={item.url}
                  end
                  onClick={() => setIsOpen(false)}
                  className="flex flex-col items-center justify-center gap-2 p-4 rounded-xl text-muted-foreground hover:bg-muted hover:text-primary transition-colors"
                  activeClassName="bg-primary/10 text-primary"
                >
                  <item.icon className="h-6 w-6" />
                  <span className="text-xs font-medium text-center">{item.title}</span>
                </NavLink>
              ))}
            </div>
          </SheetContent>
        </Sheet>
      </div>
    </nav>
  );
}
