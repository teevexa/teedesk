import React from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface ErrorHandlerProps {
  error: Error;
  resetError: () => void;
  title?: string;
}

export const ErrorHandler: React.FC<ErrorHandlerProps> = ({ 
  error, 
  resetError, 
  title = "Something went wrong" 
}) => {
  return (
    <div className="flex items-center justify-center min-h-[400px] p-4">
      <Card className="glass-card max-w-md w-full">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 p-3 rounded-full bg-destructive/20">
            <AlertTriangle className="h-8 w-8 text-destructive" />
          </div>
          <CardTitle className="text-xl font-semibold">{title}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-center">
          <p className="text-sm text-muted-foreground">
            {error.message || "An unexpected error occurred. Please try again."}
          </p>
          
          <Button 
            onClick={resetError}
            className="w-full bg-gradient-primary hover:shadow-glow"
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            Try Again
          </Button>
          
          <details className="text-left">
            <summary className="text-xs text-muted-foreground cursor-pointer">
              Technical Details
            </summary>
            <pre className="text-xs bg-muted/20 p-2 rounded mt-2 overflow-auto">
              {error.stack}
            </pre>
          </details>
        </CardContent>
      </Card>
    </div>
  );
};