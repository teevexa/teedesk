import React, { Component, ErrorInfo, ReactNode } from 'react';
import { motion } from 'framer-motion';
import { AlertTriangle, RefreshCw, Home } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('AI Chatbot Error:', error, errorInfo);
  }

  handleReload = () => {
    window.location.reload();
  };

  handleReset = () => {
    this.setState({ hasError: false, error: undefined });
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-gradient-secondary p-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.5 }}
            className="max-w-md w-full"
          >
            <Card className="glass-card p-8 text-center space-y-6">
              <div className="p-4 rounded-full bg-destructive/20 mx-auto w-16 h-16 flex items-center justify-center">
                <AlertTriangle className="h-8 w-8 text-destructive" />
              </div>
              
              <div>
                <h2 className="text-2xl font-bold gradient-text mb-2">
                  Oops! Something went wrong
                </h2>
                <p className="text-muted-foreground text-sm">
                  The AI chatbot encountered an unexpected error. This might be due to 
                  browser compatibility or network issues.
                </p>
              </div>

              {this.state.error && (
                <details className="text-left">
                  <summary className="text-sm font-medium cursor-pointer text-muted-foreground">
                    Technical Details
                  </summary>
                  <pre className="text-xs mt-2 p-3 bg-muted/30 rounded overflow-auto">
                    {this.state.error.message}
                  </pre>
                </details>
              )}

              <div className="flex gap-3">
                <Button
                  onClick={this.handleReset}
                  variant="outline"
                  className="flex-1"
                >
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Try Again
                </Button>
                <Button
                  onClick={this.handleReload}
                  className="flex-1 bg-gradient-primary"
                >
                  <Home className="h-4 w-4 mr-2" />
                  Reload App
                </Button>
              </div>

              <div className="text-xs text-muted-foreground">
                <p>Ensure your browser supports:</p>
                <ul className="mt-1 space-y-1">
                  <li>• WebGL for AI model acceleration</li>
                  <li>• Speech API for voice features</li>
                  <li>• Modern JavaScript features</li>
                </ul>
              </div>
            </Card>
          </motion.div>
        </div>
      );
    }

    return this.props.children;
  }
}