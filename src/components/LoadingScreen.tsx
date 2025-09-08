import React from 'react';
import { motion } from 'framer-motion';
import { Bot, Cpu, Database, Zap } from 'lucide-react';

export const LoadingScreen: React.FC = () => {
  const loadingSteps = [
    { icon: Database, label: 'Connecting to Database', delay: 0 },
    { icon: Cpu, label: 'Initializing AI Models', delay: 0.5 },
    { icon: Bot, label: 'Loading NLP Pipeline', delay: 1 },
    { icon: Zap, label: 'Ready for Conversations', delay: 1.5 }
  ];

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-secondary">
      <div className="text-center space-y-8">
        {/* Main Logo */}
        <motion.div
          initial={{ opacity: 0, scale: 0.5 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.8, ease: "easeOut" }}
          className="relative"
        >
          <div className="p-6 rounded-full bg-gradient-primary glow-primary mx-auto w-24 h-24 flex items-center justify-center">
            <Bot className="h-12 w-12 text-primary-foreground" />
          </div>
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
            className="absolute inset-0 border-4 border-primary/30 border-t-primary rounded-full"
          />
        </motion.div>

        {/* Title */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3, duration: 0.6 }}
        >
          <h1 className="text-4xl font-bold gradient-text mb-2">
            AI Customer Support
          </h1>
          <p className="text-muted-foreground">
            Powered by Advanced NLP & Machine Learning
          </p>
        </motion.div>

        {/* Loading Steps */}
        <div className="space-y-4 max-w-md mx-auto">
          {loadingSteps.map((step, index) => (
            <motion.div
              key={step.label}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: step.delay, duration: 0.5 }}
              className="flex items-center gap-4 p-4 glass-card rounded-lg"
            >
              <div className="p-2 rounded-lg bg-primary/20">
                <step.icon className="h-5 w-5 text-primary" />
              </div>
              <span className="text-sm font-medium">{step.label}</span>
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: "100%" }}
                transition={{ delay: step.delay + 0.2, duration: 0.8 }}
                className="ml-auto h-1 bg-gradient-primary rounded-full flex-1 max-w-20"
              />
            </motion.div>
          ))}
        </div>

        {/* Features Preview */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 2, duration: 0.6 }}
          className="flex flex-wrap justify-center gap-2 mt-8"
        >
          {[
            '🎯 Intent Detection',
            '😊 Sentiment Analysis', 
            '🏷️ Entity Recognition',
            '🎤 Voice Support',
            '📊 Real-time Analytics'
          ].map((feature, index) => (
            <motion.span
              key={feature}
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 2.2 + (index * 0.1) }}
              className="px-3 py-1 text-xs rounded-full glass border border-primary/30 text-muted-foreground"
            >
              {feature}
            </motion.span>
          ))}
        </motion.div>
      </div>
    </div>
  );
};