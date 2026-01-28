import { Progress } from "@/components/ui/progress";

interface LoadingBarProps {
  isLoading: boolean;
  progress?: number;
  message?: string;
}

export function LoadingBar({ isLoading, progress, message }: LoadingBarProps) {
  if (!isLoading) return null;

  return (
    <div className="w-full max-w-xl mx-auto mt-6" data-testid="loading-bar">
      <div className="space-y-2">
        {message && (
          <p className="text-xs text-muted-foreground text-center font-mono uppercase tracking-wider">
            {message}
          </p>
        )}
        <div className="relative">
          <div className="h-1 bg-muted rounded-sm overflow-hidden">
            {progress !== undefined ? (
              <div 
                className="h-full bg-foreground transition-all duration-300"
                style={{ width: `${progress}%` }}
              />
            ) : (
              <div 
                className="h-full bg-foreground/40 animate-pulse"
                style={{ width: '100%' }}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
