import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { WalletProvider } from "@/lib/wallet";
import { ThemeProvider } from "@/lib/theme";
import { WebSocketProvider } from "@/lib/WebSocketContext";
import Feed from "@/pages/Feed";
import Admin from "@/pages/Admin";
import Profile from "@/pages/Profile";
import Leaderboard from "@/pages/Leaderboard";
import Notifications from "@/pages/Notifications";
import Messages from "@/pages/Messages";
import InvestorShowcase from "@/pages/InvestorShowcase";
import NotFound from "@/pages/not-found";

function Router() {
  return (
    <Switch>
      <Route path="/" component={Feed} />
      <Route path="/admin" component={Admin} />
      <Route path="/leaderboard" component={Leaderboard} />
      <Route path="/profile/:username" component={Profile} />
      <Route path="/notifications" component={Notifications} />
      <Route path="/messages" component={Messages} />
      <Route path="/investor-dashboard" component={InvestorShowcase} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <TooltipProvider>
          <WalletProvider>
            <WebSocketProvider>
              <Toaster />
              <Router />
            </WebSocketProvider>
          </WalletProvider>
        </TooltipProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

export default App;