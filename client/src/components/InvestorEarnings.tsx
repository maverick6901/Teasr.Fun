
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { DollarSign, TrendingUp, Users, Info } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { motion } from "framer-motion";

interface InvestorEarning {
  postId: string;
  postTitle: string;
  position: number;
  earningsGenerated: string;
  totalUnlocks: number;
}

interface InvestorEarningsProps {
  totalEarnings: string;
  investments: InvestorEarning[];
  className?: string;
}

export function InvestorEarnings({
  totalEarnings,
  investments,
  className = ""
}: InvestorEarningsProps) {
  // Calculate aggregate stats
  const totalInvestments = investments.length;
  const totalUnlocks = investments.reduce((sum, inv) => sum + inv.totalUnlocks, 0);
  
  // Calculate overall progress (example: based on earnings milestones)
  const earningsValue = parseFloat(totalEarnings);
  const milestones = [10, 50, 100, 500, 1000]; // Example earning milestones in USD
  let currentMilestone = milestones[0];
  let nextMilestone = milestones[1];
  
  for (let i = 0; i < milestones.length - 1; i++) {
    if (earningsValue >= milestones[i] && earningsValue < milestones[i + 1]) {
      currentMilestone = milestones[i];
      nextMilestone = milestones[i + 1];
      break;
    } else if (earningsValue >= milestones[milestones.length - 1]) {
      currentMilestone = milestones[milestones.length - 2];
      nextMilestone = milestones[milestones.length - 1];
      break;
    }
  }
  
  const progressPercent = Math.min(
    ((earningsValue - currentMilestone) / (nextMilestone - currentMilestone)) * 100,
    100
  );

  return (
    <div className={`space-y-6 ${className}`} data-testid="investor-earnings">
      {/* Total Earnings Card */}
      <Card className="p-6 bg-gradient-to-br from-purple-500/10 via-purple-500/5 to-pink-500/10 border-purple-500/20">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-sm text-muted-foreground font-medium mb-1">
              Total Investor Earnings
            </p>
            <div className="flex items-center gap-2">
              <DollarSign className="w-6 h-6 text-purple-600" />
              <span className="text-3xl font-mono font-bold text-foreground">
                {parseFloat(totalEarnings).toFixed(2)}
              </span>
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              From {totalInvestments} {totalInvestments === 1 ? "investment" : "investments"} • {totalUnlocks} total unlocks
            </p>
          </div>
          <Badge className="bg-gradient-to-r from-purple-600 to-pink-600 text-white">
            <TrendingUp className="w-3 h-3 mr-1" />
            Active Investor
          </Badge>
        </div>
      </Card>

      {/* Single Progress Bar with Explanation */}
      <Card className="p-6 border-purple-500/20">
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold">Earnings Progress</h3>
            <span className="text-sm text-muted-foreground">
              ${currentMilestone} → ${nextMilestone}
            </span>
          </div>
          
          <Progress value={progressPercent} className="h-2" />
          
          <div className="flex items-start gap-2 p-3 bg-purple-500/10 border-l-2 border-purple-500 rounded">
            <Info className="w-4 h-4 text-purple-600 flex-shrink-0 mt-0.5" />
            <div className="text-xs text-muted-foreground leading-relaxed">
              <p className="font-semibold text-foreground mb-1">How Investor Earnings Work:</p>
              <ul className="space-y-1 list-disc list-inside">
                <li>Creators set max investors (1-100) and revenue share % per post</li>
                <li>First buyers who choose "Investor Option" secure spots</li>
                <li>Once all spots filled, your share is distributed from each new unlock</li>
                <li>Platform fee: $0.05 USDC per transaction</li>
                <li>Your earnings = (Revenue Share % ÷ Total Investors) × (Payment - Platform Fee)</li>
              </ul>
            </div>
          </div>
        </div>
      </Card>

      {/* Investment List */}
      {investments.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-muted-foreground">
            Your Investments
          </h3>
          <div className="space-y-2">
            {investments.map((investment, index) => (
              <motion.div
                key={investment.postId}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.05 }}
              >
                <Card className="p-4 hover-elevate cursor-pointer" data-testid={`card-investment-${investment.postId}`}>
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <h4 className="font-semibold text-sm truncate">
                          {investment.postTitle}
                        </h4>
                        <Badge variant="secondary" className="text-xs px-2 py-0">
                          #{investment.position}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-4 text-xs text-muted-foreground">
                        <div className="flex items-center gap-1">
                          <Users className="w-3 h-3" />
                          {investment.totalUnlocks} unlocks
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-lg font-mono font-bold text-green-600">
                        +${parseFloat(investment.earningsGenerated).toFixed(2)}
                      </p>
                      <p className="text-xs text-muted-foreground">earned</p>
                    </div>
                  </div>
                </Card>
              </motion.div>
            ))}
          </div>
        </div>
      )}

      {/* Empty State */}
      {investments.length === 0 && (
        <Card className="p-8 text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-muted mb-4">
            <DollarSign className="w-8 h-8 text-muted-foreground" />
          </div>
          <h3 className="font-semibold mb-2">No Investments Yet</h3>
          <p className="text-sm text-muted-foreground max-w-sm mx-auto">
            Become an early investor in exclusive content and start earning revenue share from every future unlock!
          </p>
        </Card>
      )}
    </div>
  );
}
