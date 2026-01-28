import { Progress } from "@/components/ui/progress";

interface LoadingBarProps {
  isLoading: boolean;
  progress?: number;
  message?: string;
}

export function LoadingBar({ isLoading, progress, message }: LoadingBarProps) {
  if (!isLoading) return null;

  return (
    <div className="w-full max-w-2xl mx-auto mt-6" data-testid="loading-bar">
      <div className="space-y-2">
        {message && (
          <p className="text-sm text-muted-foreground text-center animate-pulse">
            {message}
          </p>
        )}
        <div className="relative">
          <Progress 
            value={progress} 
            className="h-2 bg-muted/50"
          />
          <div 
            className="absolute inset-0 h-2 rounded-full overflow-hidden"
            style={{
              background: progress === undefined 
                ? 'linear-gradient(90deg, transparent, hsl(300 100% 50% / 0.5), hsl(180 100% 45% / 0.5), transparent)'
                : 'transparent',
              backgroundSize: '200% 100%',
              animation: progress === undefined ? 'shimmer 1.5s infinite' : 'none',
            }}
          />
        </div>
      </div>
      <style>{`
        @keyframes shimmer {
          0% { background-position: -200% 0; }
          100% { background-position: 200% 0; }
        }
      `}</style>
    </div>
  );
}
