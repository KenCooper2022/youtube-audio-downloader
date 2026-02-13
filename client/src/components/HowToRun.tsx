import { useState } from "react";
import { Monitor, Smartphone, Globe, Terminal, ChevronDown, ChevronRight, ExternalLink, Copy, Check } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const { toast } = useToast();

  const handleCopy = () => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    toast({ title: "Copied to clipboard" });
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Button variant="ghost" size="sm" onClick={handleCopy} className="h-6 w-6 p-0 ml-2" data-testid={`button-copy-${text.slice(0, 10)}`}>
      {copied ? <Check className="h-3 w-3 text-green-500" /> : <Copy className="h-3 w-3 text-muted-foreground" />}
    </Button>
  );
}

function CodeBlock({ children }: { children: string }) {
  return (
    <div className="flex items-center bg-muted/50 dark:bg-muted/30 rounded px-3 py-1.5 font-mono text-sm my-1">
      <code className="flex-1 select-all">{children}</code>
      <CopyButton text={children} />
    </div>
  );
}

interface SectionProps {
  icon: React.ReactNode;
  title: string;
  badge?: string;
  badgeVariant?: "default" | "secondary" | "outline";
  defaultOpen?: boolean;
  children: React.ReactNode;
  testId: string;
}

function CollapsibleSection({ icon, title, badge, badgeVariant = "secondary", defaultOpen = false, children, testId }: SectionProps) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <Card className="overflow-hidden" data-testid={testId}>
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center gap-3 p-4 text-left hover:bg-muted/30 transition-colors"
        data-testid={`button-toggle-${testId}`}
      >
        <div className="text-muted-foreground">{icon}</div>
        <span className="font-medium flex-1">{title}</span>
        {badge && <Badge variant={badgeVariant} className="text-[10px] uppercase tracking-wider">{badge}</Badge>}
        {open ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
      </button>
      {open && (
        <div className="px-4 pb-4 pt-0 border-t">
          <div className="pt-4 space-y-3 text-sm text-foreground/80 leading-relaxed">
            {children}
          </div>
        </div>
      )}
    </Card>
  );
}

export function HowToRun() {
  return (
    <div className="w-full max-w-3xl mx-auto space-y-4" data-testid="how-to-run-page">
      <div className="mb-6">
        <h2 className="text-lg font-semibold mb-1">How to Run</h2>
        <p className="text-sm text-muted-foreground">
          Pick your platform below. Each section walks you through getting the app running from scratch.
        </p>
      </div>

      <CollapsibleSection
        icon={<Terminal className="h-5 w-5" />}
        title="macOS"
        badge="Recommended"
        badgeVariant="default"
        defaultOpen={true}
        testId="section-macos"
      >
        <p className="font-medium">First time (2 steps):</p>
        <ol className="list-decimal list-inside space-y-1.5 ml-1">
          <li>Open <strong>Terminal</strong> (press <kbd className="bg-muted px-1.5 py-0.5 rounded text-xs">Cmd + Space</kbd>, type "Terminal", press Enter)</li>
          <li>Paste this command and press Enter:</li>
        </ol>
        <CodeBlock>cd ~/Downloads/youtube-audio-downloader && make install</CodeBlock>
        <p className="text-xs text-muted-foreground">If your folder is somewhere else, change the path after <code className="bg-muted/50 dark:bg-muted/30 px-1 rounded text-xs">cd</code>.</p>

        <div className="border-t pt-3 mt-3">
          <p className="font-medium">Every time after that:</p>
          <CodeBlock>cd ~/Downloads/youtube-audio-downloader && make run</CodeBlock>
        </div>

        <div className="border-t pt-3 mt-3">
          <p className="font-medium">Alternative: drag-and-drop method</p>
          <ol className="list-decimal list-inside space-y-1 ml-1">
            <li>Open Terminal</li>
            <li>Type <code className="bg-muted/50 dark:bg-muted/30 px-1 rounded text-xs">cd </code> (with a space after it)</li>
            <li>Drag the project folder from Finder into the Terminal window</li>
            <li>Press Enter, then type <code className="bg-muted/50 dark:bg-muted/30 px-1 rounded text-xs">make install</code></li>
          </ol>
        </div>

        <div className="bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 rounded p-3 mt-3 text-xs">
          <strong>Why Terminal?</strong> macOS blocks downloaded files from running when you double-click them (Gatekeeper security). Running from Terminal avoids this completely — no workarounds needed.
        </div>
      </CollapsibleSection>

      <CollapsibleSection
        icon={<Monitor className="h-5 w-5" />}
        title="Windows"
        testId="section-windows"
      >
        <p className="font-medium">First time:</p>
        <ol className="list-decimal list-inside space-y-1.5 ml-1">
          <li>Extract the zip file</li>
          <li>Double-click <code className="bg-muted/50 dark:bg-muted/30 px-1.5 py-0.5 rounded text-xs">install.bat</code></li>
          <li>Follow the prompts — it installs Node.js, yt-dlp, FFmpeg, and everything else</li>
          <li>The app opens in your browser when ready</li>
        </ol>

        <div className="border-t pt-3 mt-3">
          <p className="font-medium">Every time after that:</p>
          <p>Double-click <code className="bg-muted/50 dark:bg-muted/30 px-1.5 py-0.5 rounded text-xs">start.bat</code> to start the app.</p>
        </div>

        <div className="border-t pt-3 mt-3">
          <p className="font-medium">Or from Command Prompt:</p>
          <CodeBlock>npm run dev</CodeBlock>
          <p className="text-xs text-muted-foreground">Opens at <code>http://localhost:5000</code></p>
        </div>
      </CollapsibleSection>

      <CollapsibleSection
        icon={<Terminal className="h-5 w-5" />}
        title="Linux"
        testId="section-linux"
      >
        <p className="font-medium">First time:</p>
        <CodeBlock>cd youtube-audio-downloader && make install</CodeBlock>

        <div className="border-t pt-3 mt-3">
          <p className="font-medium">Every time after:</p>
          <CodeBlock>make run</CodeBlock>
        </div>

        <p className="text-xs text-muted-foreground mt-2">
          Or use <code className="bg-muted/50 dark:bg-muted/30 px-1 rounded text-xs">bash install.sh</code> for the interactive installer. Opens at <code>http://localhost:5000</code>.
        </p>
      </CollapsibleSection>

      <CollapsibleSection
        icon={<Terminal className="h-5 w-5" />}
        title="All Make Commands"
        testId="section-commands"
      >
        <p>Once in the project folder in Terminal, these commands are available:</p>
        <div className="space-y-1 mt-2">
          <div className="flex items-center gap-3">
            <code className="bg-muted/50 dark:bg-muted/30 px-1.5 py-0.5 rounded text-xs font-semibold w-36">make install</code>
            <span className="text-xs text-muted-foreground">First-time setup + start</span>
          </div>
          <div className="flex items-center gap-3">
            <code className="bg-muted/50 dark:bg-muted/30 px-1.5 py-0.5 rounded text-xs font-semibold w-36">make run</code>
            <span className="text-xs text-muted-foreground">Start the app (daily use)</span>
          </div>
          <div className="flex items-center gap-3">
            <code className="bg-muted/50 dark:bg-muted/30 px-1.5 py-0.5 rounded text-xs font-semibold w-36">make desktop</code>
            <span className="text-xs text-muted-foreground">Build standalone .dmg / .exe</span>
          </div>
          <div className="flex items-center gap-3">
            <code className="bg-muted/50 dark:bg-muted/30 px-1.5 py-0.5 rounded text-xs font-semibold w-36">make mobile</code>
            <span className="text-xs text-muted-foreground">Build Android / iOS app</span>
          </div>
          <div className="flex items-center gap-3">
            <code className="bg-muted/50 dark:bg-muted/30 px-1.5 py-0.5 rounded text-xs font-semibold w-36">make package</code>
            <span className="text-xs text-muted-foreground">Create a zip to share</span>
          </div>
          <div className="flex items-center gap-3">
            <code className="bg-muted/50 dark:bg-muted/30 px-1.5 py-0.5 rounded text-xs font-semibold w-36">make clean</code>
            <span className="text-xs text-muted-foreground">Remove build files</span>
          </div>
        </div>
      </CollapsibleSection>

      <CollapsibleSection
        icon={<Smartphone className="h-5 w-5" />}
        title="Mobile (Android / iOS)"
        testId="section-mobile"
      >
        <p>The mobile app connects to a server running on your computer.</p>
        <ol className="list-decimal list-inside space-y-1.5 ml-1">
          <li>Start the server on your computer using the steps above</li>
          <li>Find your computer's local IP address:
            <div className="ml-6 mt-1 space-y-1">
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="text-[10px] w-16 justify-center">macOS</Badge>
                <code className="bg-muted/50 dark:bg-muted/30 px-1.5 py-0.5 rounded text-xs">ipconfig getifaddr en0</code>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="text-[10px] w-16 justify-center">Windows</Badge>
                <code className="bg-muted/50 dark:bg-muted/30 px-1.5 py-0.5 rounded text-xs">ipconfig</code>
                <span className="text-xs text-muted-foreground">(look for IPv4 Address)</span>
              </div>
            </div>
          </li>
          <li>Open the app on your phone</li>
          <li>Go to the <strong>Settings</strong> tab</li>
          <li>Enter your server URL, for example: <code className="bg-muted/50 dark:bg-muted/30 px-1.5 py-0.5 rounded text-xs">http://192.168.1.100:5000</code></li>
          <li>Make sure your phone and computer are on the same WiFi network</li>
        </ol>

        <div className="border-t pt-3 mt-3">
          <p className="font-medium">Building the mobile app:</p>
          <CodeBlock>make mobile</CodeBlock>
          <p className="text-xs text-muted-foreground">
            You'll need Android Studio or Xcode to compile the final app.
          </p>
        </div>
      </CollapsibleSection>

      <CollapsibleSection
        icon={<Globe className="h-5 w-5" />}
        title="Desktop App (.dmg / .exe)"
        testId="section-desktop"
      >
        <p>Build a standalone desktop application:</p>
        <CodeBlock>make desktop</CodeBlock>

        <div className="ml-1 mt-2 space-y-1">
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="text-[10px] w-16 justify-center">macOS</Badge>
            <span className="text-xs">Creates a .dmg in <code className="bg-muted/50 dark:bg-muted/30 px-1 rounded text-xs">electron-dist/</code></span>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="text-[10px] w-16 justify-center">Windows</Badge>
            <span className="text-xs">Creates a .exe in <code className="bg-muted/50 dark:bg-muted/30 px-1 rounded text-xs">electron-dist/</code></span>
          </div>
        </div>

        <div className="bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded p-3 mt-3 text-xs">
          <strong>Note:</strong> yt-dlp and FFmpeg must be installed on the computer running the desktop app.
        </div>
      </CollapsibleSection>

      <CollapsibleSection
        icon={<Terminal className="h-5 w-5" />}
        title="YouTube API Key"
        testId="section-env"
      >
        <p>The app needs one API key to search YouTube:</p>
        <div className="space-y-2">
          <div>
            <code className="bg-muted/50 dark:bg-muted/30 px-1.5 py-0.5 rounded text-xs font-semibold">GOOGLE_API_KEY</code>
            <span className="text-xs text-muted-foreground ml-2">— YouTube Data API v3 key</span>
          </div>
          <p className="text-xs">Get one free at:</p>
          <a
            href="https://console.cloud.google.com/apis/credentials"
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-blue-600 dark:text-blue-400 hover:underline inline-flex items-center gap-1"
            data-testid="link-google-console"
          >
            Google Cloud Console <ExternalLink className="h-3 w-3" />
          </a>
          <p className="text-xs text-muted-foreground">
            The installer prompts you for this key during setup. You can also set it manually in a <code>.env</code> file:
          </p>
          <CodeBlock>GOOGLE_API_KEY=your_key_here</CodeBlock>
        </div>
      </CollapsibleSection>

      <div className="text-center text-xs text-muted-foreground pt-4 pb-8">
        For detailed technical documentation, see the <code>docs/</code> folder in the project files.
      </div>
    </div>
  );
}
