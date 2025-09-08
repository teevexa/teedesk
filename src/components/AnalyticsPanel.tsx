import React from 'react';
import { motion } from 'framer-motion';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { AIAnalysis } from '@/lib/ai-services';
import { 
  BarChart3, 
  TrendingUp, 
  Users, 
  MessageSquare, 
  Heart,
  AlertTriangle 
} from 'lucide-react';

interface AnalyticsPanelProps {
  analytics?: {
    totalMessages: number;
    sentimentDistribution: Record<string, number>;
    intentDistribution: Record<string, number>;
    satisfactionRate: number;
    urgentIssues: number;
  };
}

export const AnalyticsPanel: React.FC<AnalyticsPanelProps> = ({ analytics }) => {
  // Default analytics data if none provided
  const defaultAnalytics = {
    totalMessages: 1247,
    sentimentDistribution: {
      positive: 542,
      negative: 198,
      neutral: 507
    },
    intentDistribution: {
      order_tracking: 312,
      refund_request: 156,
      complaint: 89,
      support_request: 423,
      billing_inquiry: 134,
      general_inquiry: 133
    },
    satisfactionRate: 87,
    urgentIssues: 12
  };

  const data = analytics || defaultAnalytics;
  const getSentimentColor = (sentiment: string) => {
    switch (sentiment) {
      case 'positive': return 'text-success';
      case 'negative': return 'text-destructive';
      default: return 'text-muted-foreground';
    }
  };

  const getIntentIcon = (intent: string) => {
    switch (intent) {
      case 'order_tracking': return '📦';
      case 'refund_request': return '💰';
      case 'complaint': return '⚠️';
      case 'support_request': return '🔧';
      case 'billing_inquiry': return '💳';
      default: return '💬';
    }
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center gap-3 mb-6">
        <div className="p-2 rounded-lg bg-gradient-primary">
          <BarChart3 className="h-5 w-5 text-primary-foreground" />
        </div>
        <div>
          <h2 className="text-xl font-semibold gradient-text">Analytics Dashboard</h2>
          <p className="text-sm text-muted-foreground">Real-time conversation insights</p>
        </div>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          <Card className="glass-card p-4">
            <div className="flex items-center gap-3">
              <MessageSquare className="h-8 w-8 text-primary" />
              <div>
                <p className="text-2xl font-bold">{data.totalMessages}</p>
                <p className="text-xs text-muted-foreground">Total Messages</p>
              </div>
            </div>
          </Card>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <Card className="glass-card p-4">
            <div className="flex items-center gap-3">
              <Heart className="h-8 w-8 text-success" />
              <div>
                <p className="text-2xl font-bold">{data.satisfactionRate}%</p>
                <p className="text-xs text-muted-foreground">Satisfaction</p>
              </div>
            </div>
          </Card>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
        >
          <Card className="glass-card p-4">
            <div className="flex items-center gap-3">
              <AlertTriangle className="h-8 w-8 text-warning" />
              <div>
                <p className="text-2xl font-bold">{data.urgentIssues}</p>
                <p className="text-xs text-muted-foreground">Urgent Issues</p>
              </div>
            </div>
          </Card>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
        >
          <Card className="glass-card p-4">
            <div className="flex items-center gap-3">
              <TrendingUp className="h-8 w-8 text-accent" />
              <div>
                <p className="text-2xl font-bold">+12%</p>
                <p className="text-xs text-muted-foreground">Response Rate</p>
              </div>
            </div>
          </Card>
        </motion.div>
      </div>

      {/* Sentiment Analysis */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5 }}
      >
        <Card className="glass-card p-6">
          <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
            😊 Sentiment Distribution
          </h3>
          <div className="space-y-4">
            {Object.entries(data.sentimentDistribution).map(([sentiment, count]) => (
              <div key={sentiment} className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Badge variant="outline" className={getSentimentColor(sentiment)}>
                    {sentiment}
                  </Badge>
                  <span className="text-sm">{count} messages</span>
                </div>
                <Progress 
                  value={(count / data.totalMessages) * 100} 
                  className="w-24 h-2"
                />
              </div>
            ))}
          </div>
        </Card>
      </motion.div>

      {/* Intent Distribution */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.6 }}
      >
        <Card className="glass-card p-6">
          <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
            🎯 Intent Analysis
          </h3>
          <div className="space-y-3">
            {Object.entries(data.intentDistribution).map(([intent, count]) => (
              <div key={intent} className="flex items-center justify-between p-3 rounded-lg bg-muted/30">
                <div className="flex items-center gap-3">
                  <span className="text-lg">{getIntentIcon(intent)}</span>
                  <div>
                    <p className="font-medium">{intent.replace('_', ' ')}</p>
                    <p className="text-xs text-muted-foreground">{count} messages</p>
                  </div>
                </div>
                <Badge variant="secondary">
                  {Math.round((count / data.totalMessages) * 100)}%
                </Badge>
              </div>
            ))}
          </div>
        </Card>
      </motion.div>
    </div>
  );
};