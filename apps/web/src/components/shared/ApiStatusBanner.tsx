import React, { useEffect, useState } from 'react';
import { AlertTriangle, Wifi, WifiOff } from 'lucide-react';
import { healthService } from '@/services/health.service';
import { useUIStore } from '@/store';

export const ApiStatusBanner: React.FC = () => {
  const { isBackendConnected, setBackendConnected } = useUIStore();
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    const check = async () => {
      const health = await healthService.check();
      setBackendConnected(health.status === 'ok', health.version);
      setChecked(true);
    };
    check();
    // Re-check every 30 seconds
    const interval = setInterval(check, 30_000);
    return () => clearInterval(interval);
  }, [setBackendConnected]);

  if (!checked || isBackendConnected) return null;

  return (
    <div className="bg-warning/10 border-b border-warning/30 px-4 py-2">
      <div className="flex items-center gap-2 text-sm text-warning">
        <AlertTriangle className="h-4 w-4 flex-shrink-0" />
        <span>
          <strong>Backend not connected.</strong> AI features require the FastAPI service running on{' '}
          {import.meta.env.VITE_API_URL || 'http://localhost:8000'}.{' '}
          <span className="text-muted-foreground">
            Run <code className="text-xs bg-muted px-1 rounded">bash scripts/dev.sh api</code> to
            start it.
          </span>
        </span>
      </div>
    </div>
  );
};
