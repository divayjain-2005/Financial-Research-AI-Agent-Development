import { Switch, Route, Router as WouterRouter } from "wouter";
import AuthGate from "@/components/AuthGate";
import Dashboard from "@/pages/index";
import Stocks from "@/pages/stocks";
import Options from "@/pages/options";
import Futures from "@/pages/futures";
import Bonds from "@/pages/bonds";
import EconomicIndicators from "@/pages/economic-indicators";
import Compare from "@/pages/compare";
import Portfolio from "@/pages/portfolio";
import Watchlist from "@/pages/watchlist";
import Sectors from "@/pages/sectors";
import Calculators from "@/pages/calculators";
import Wellness from "@/pages/wellness";
import Brokers from "@/pages/brokers";
import Chat from "@/pages/chat";

function Router() {
  return (
    <Switch>
      <Route path="/" component={Dashboard} />
      <Route path="/stocks" component={Stocks} />
      <Route path="/options" component={Options} />
      <Route path="/futures" component={Futures} />
      <Route path="/bonds" component={Bonds} />
      <Route path="/economic-indicators" component={EconomicIndicators} />
      <Route path="/compare" component={Compare} />
      <Route path="/portfolio" component={Portfolio} />
      <Route path="/watchlist" component={Watchlist} />
      <Route path="/sectors" component={Sectors} />
      <Route path="/calculators" component={Calculators} />
      <Route path="/wellness" component={Wellness} />
      <Route path="/brokers" component={Brokers} />
      <Route path="/chat" component={Chat} />
    </Switch>
  );
}

export default function App() {
  return (
    <AuthGate>
      <WouterRouter base={import.meta.env.BASE_URL?.replace(/\/$/, "") ?? ""}>
        <Router />
      </WouterRouter>
    </AuthGate>
  );
}
