import React from 'react';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { TrendingUp, TrendingDown, Minus, Tag, AlertTriangle, Building2, User, Calendar, Package } from 'lucide-react';
import { AnalysisResult, Entity, SentimentLabel } from '@/types';

interface MessageAnalysisBadgesProps {
  analysis?: AnalysisResult;
  sentiment?: SentimentLabel;
  sentimentScore?: number;
  intent?: string;
  intentConfidence?: number;
  entities?: Entity[];
  className?: string;
}

const SENTIMENT_CONFIG: Record<SentimentLabel, { icon: React.ElementType; label: string; className: string }> = {
  positive: { icon: TrendingUp, label: 'Positive', className: 'bg-emerald-100 text-emerald-700 border-emerald-200' },
  negative: { icon: TrendingDown, label: 'Negative', className: 'bg-red-100 text-red-700 border-red-200' },
  neutral: { icon: Minus, label: 'Neutral', className: 'bg-slate-100 text-slate-600 border-slate-200' },
};

const ENTITY_ICONS: Record<string, React.ElementType> = {
  ORG: Building2,
  PRODUCT: Package,
  PERSON: User,
  DATE: Calendar,
  default: Tag,
};

function SentimentBadge({ label, score }: { label: SentimentLabel; score?: number }) {
  const cfg = SENTIMENT_CONFIG[label];
  const Icon = cfg.icon;
  const scoreStr = score !== undefined ? ` (${score > 0 ? '+' : ''}${score.toFixed(2)})` : '';

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Badge
            variant="outline"
            className={`text-xs px-1.5 py-0.5 gap-1 cursor-default ${cfg.className}`}
          >
            <Icon className="h-3 w-3" />
            {cfg.label}
          </Badge>
        </TooltipTrigger>
        <TooltipContent side="top" className="text-xs">
          Sentiment{scoreStr}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

function IntentBadge({ intent, confidence }: { intent: string; confidence?: number }) {
  const label = intent.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
  const pct = confidence !== undefined ? `${Math.round(confidence * 100)}%` : null;

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Badge
            variant="outline"
            className="text-xs px-1.5 py-0.5 gap-1 cursor-default bg-violet-100 text-violet-700 border-violet-200"
          >
            <Tag className="h-3 w-3" />
            {label}
          </Badge>
        </TooltipTrigger>
        <TooltipContent side="top" className="text-xs">
          Intent{pct ? ` · ${pct} confidence` : ''}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

function EntityBadge({ entity }: { entity: Entity }) {
  const Icon = ENTITY_ICONS[entity.label] ?? ENTITY_ICONS.default;
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Badge
            variant="outline"
            className="text-xs px-1.5 py-0.5 gap-1 cursor-default bg-sky-100 text-sky-700 border-sky-200 max-w-[120px] truncate"
          >
            <Icon className="h-3 w-3 flex-shrink-0" />
            <span className="truncate">{entity.text}</span>
          </Badge>
        </TooltipTrigger>
        <TooltipContent side="top" className="text-xs">
          {entity.label}: {entity.text}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

function EscalationBadge() {
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Badge
            variant="outline"
            className="text-xs px-1.5 py-0.5 gap-1 cursor-default bg-orange-100 text-orange-700 border-orange-200"
          >
            <AlertTriangle className="h-3 w-3" />
            Escalate
          </Badge>
        </TooltipTrigger>
        <TooltipContent side="top" className="text-xs">
          AI recommends escalation based on negative sentiment
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

export function MessageAnalysisBadges({
  analysis,
  sentiment: propSentiment,
  sentimentScore: propScore,
  intent: propIntent,
  intentConfidence: propConfidence,
  entities: propEntities,
  className = '',
}: MessageAnalysisBadgesProps) {
  // Prefer analysis object, fall back to individual props
  const sentiment = analysis?.sentiment ?? propSentiment;
  const sentimentScore = analysis?.sentiment_score ?? propScore;
  const intent = analysis?.intent ?? propIntent;
  const intentConfidence = analysis?.intent_confidence ?? propConfidence;
  const entities = analysis?.entities ?? propEntities ?? [];
  const escalation = analysis?.escalation_recommended ?? false;

  const hasBadges = sentiment || intent || entities.length > 0 || escalation;
  if (!hasBadges) return null;

  return (
    <div className={`flex flex-wrap gap-1 mt-1 ${className}`}>
      {sentiment && <SentimentBadge label={sentiment} score={sentimentScore} />}
      {intent && <IntentBadge intent={intent} confidence={intentConfidence} />}
      {entities.slice(0, 3).map((e, i) => (
        <EntityBadge key={`${e.label}-${i}`} entity={e} />
      ))}
      {escalation && <EscalationBadge />}
    </div>
  );
}
