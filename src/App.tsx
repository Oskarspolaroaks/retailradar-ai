import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { Layout } from "./components/Layout";
import Landing from "./pages/Landing";
import AboutUs from "./pages/AboutUs";
import Pricing from "./pages/Pricing";
import Auth from "./pages/Auth";
import Dashboard from "./pages/Dashboard";
import Products from "./pages/Products";
import Recommendations from "./pages/Recommendations";
import Competitors from "./pages/Competitors";
import Alerts from "./pages/Alerts";
import PricingSimulator from "./pages/PricingSimulator";
import Settings from "./pages/Settings";
import Symphony from "./pages/Symphony";
import SmartPrice from "./pages/SmartPrice";
import WeeklySales from "./pages/WeeklySales";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="/about" element={<AboutUs />} />
          <Route path="/pricing" element={<Pricing />} />
          <Route path="/auth" element={<Auth />} />
          <Route path="/dashboard" element={<Layout><Dashboard /></Layout>} />
          <Route path="/products" element={<Layout><Products /></Layout>} />
          <Route path="/recommendations" element={<Layout><Recommendations /></Layout>} />
          <Route path="/competitors" element={<Layout><Competitors /></Layout>} />
          <Route path="/alerts" element={<Layout><Alerts /></Layout>} />
          <Route path="/pricing-simulator" element={<Layout><PricingSimulator /></Layout>} />
          <Route path="/symphony" element={<Layout><Symphony /></Layout>} />
          <Route path="/smart-price" element={<Layout><SmartPrice /></Layout>} />
          <Route path="/weekly-sales" element={<Layout><WeeklySales /></Layout>} />
          <Route path="/settings" element={<Layout><Settings /></Layout>} />
          {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
