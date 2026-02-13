import { useState, useEffect } from "react";
import { Server, Check, X, Loader2, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";

interface ServerSettingsProps {
  onServerChange?: (url: string) => void;
}

export function ServerSettings({ onServerChange }: ServerSettingsProps) {
  const [serverUrl, setServerUrl] = useState("");
  const [isConnected, setIsConnected] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    const saved = localStorage.getItem("serverUrl");
    if (saved) {
      setServerUrl(saved);
      window.API_BASE_URL = saved;
      testConnection(saved);
    }
  }, []);

  const testConnection = async (url: string) => {
    if (!url.trim()) {
      setIsConnected(false);
      return;
    }
    
    setIsTesting(true);
    try {
      const cleanUrl = url.replace(/\/$/, "");
      const response = await fetch(`${cleanUrl}/api/health`, {
        method: "GET",
        mode: "cors",
      });
      
      if (response.ok) {
        setIsConnected(true);
        toast({
          title: "Connected",
          description: "Successfully connected to server",
        });
      } else {
        setIsConnected(false);
        toast({
          title: "Connection failed",
          description: "Server returned an error",
          variant: "destructive",
        });
      }
    } catch (error) {
      setIsConnected(false);
      toast({
        title: "Connection failed",
        description: "Could not reach the server",
        variant: "destructive",
      });
    } finally {
      setIsTesting(false);
    }
  };

  const handleSave = () => {
    const cleanUrl = serverUrl.trim().replace(/\/$/, "");
    localStorage.setItem("serverUrl", cleanUrl);
    window.API_BASE_URL = cleanUrl;
    onServerChange?.(cleanUrl);
    testConnection(cleanUrl);
  };

  const handleClear = () => {
    setServerUrl("");
    setIsConnected(false);
    localStorage.removeItem("serverUrl");
    window.API_BASE_URL = undefined;
    onServerChange?.("");
    toast({
      title: "Server cleared",
      description: "Using local server",
    });
  };

  return (
    <Card className="p-4 mb-6" data-testid="card-server-settings">
      <div className="flex items-center gap-2 mb-3">
        <Server className="w-4 h-4 text-muted-foreground" />
        <span className="text-sm font-medium">Server Connection</span>
        {isConnected ? (
          <Badge variant="outline" className="text-green-600 border-green-600">
            <Check className="w-3 h-3 mr-1" />
            Connected
          </Badge>
        ) : serverUrl ? (
          <Badge variant="outline" className="text-red-600 border-red-600">
            <X className="w-3 h-3 mr-1" />
            Disconnected
          </Badge>
        ) : null}
      </div>
      
      <div className="flex flex-col sm:flex-row gap-2">
        <Input
          value={serverUrl}
          onChange={(e) => setServerUrl(e.target.value)}
          placeholder="http://192.168.1.x:5000"
          className="flex-1"
          data-testid="input-server-url"
        />
        <div className="flex gap-2 flex-wrap">
          <Button 
            onClick={handleSave} 
            disabled={isTesting}
            size="sm"
            data-testid="button-save-server"
          >
            {isTesting ? <Loader2 className="w-4 h-4 animate-spin" /> : "Save"}
          </Button>
          {serverUrl && (
            <Button
              onClick={() => testConnection(serverUrl)}
              disabled={isTesting}
              size="icon"
              variant="outline"
              data-testid="button-test-connection"
            >
              <RefreshCw className={`w-4 h-4 ${isTesting ? "animate-spin" : ""}`} />
            </Button>
          )}
          {serverUrl && (
            <Button
              onClick={handleClear}
              size="icon"
              variant="ghost"
              data-testid="button-clear-server"
            >
              <X className="w-4 h-4" />
            </Button>
          )}
        </div>
      </div>
      
      <p className="text-xs text-muted-foreground mt-2">
        Enter the URL of your YouTube Downloader server to connect from this device.
      </p>
    </Card>
  );
}
