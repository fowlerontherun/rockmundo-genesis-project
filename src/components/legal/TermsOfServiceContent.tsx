import { ScrollArea } from "@/components/ui/scroll-area";

export const TERMS_VERSION = "1.0";

export const TermsOfServiceContent = () => {
  return (
    <ScrollArea className="h-[400px] pr-4">
      <div className="space-y-4 text-sm">
        <div>
          <h3 className="font-bold text-base mb-2">ROCKMUNDO TERMS OF SERVICE</h3>
          <p className="text-muted-foreground text-xs">Version {TERMS_VERSION} - Last updated December 2024</p>
        </div>

        <p className="text-muted-foreground">
          By creating an account and using Rockmundo, you agree to the following terms and conditions:
        </p>

        <div className="space-y-3">
          <div>
            <h4 className="font-semibold text-primary">1. Intellectual Property Ownership</h4>
            <p className="text-muted-foreground">
              All music, lyrics, audio recordings, and creative content generated using Rockmundo's AI systems 
              are the exclusive intellectual property of Rockmundo. This includes, but is not limited to, 
              AI-generated songs, melodies, and audio files created within the game.
            </p>
          </div>

          <div>
            <h4 className="font-semibold text-primary">2. Prohibited External Distribution</h4>
            <p className="text-muted-foreground">
              You may <span className="font-semibold text-destructive">NOT</span> upload, distribute, publish, 
              or share any AI-generated music from Rockmundo to external platforms including, but not limited to:
            </p>
            <ul className="list-disc list-inside text-muted-foreground mt-1 ml-2 space-y-0.5">
              <li>Spotify, Apple Music, YouTube Music, Amazon Music, Tidal, Deezer</li>
              <li>SoundCloud, Bandcamp, or any music distribution service</li>
              <li>YouTube, TikTok, Instagram, or any social media platform</li>
              <li>Any website, app, or service outside of Rockmundo</li>
            </ul>
          </div>

          <div>
            <h4 className="font-semibold text-primary">3. In-Game Use Only</h4>
            <p className="text-muted-foreground">
              AI-generated music is licensed exclusively for use within the Rockmundo game ecosystem. 
              You may enjoy, share, and interact with your music within the game, but it must remain 
              within the Rockmundo platform.
            </p>
          </div>

          <div>
            <h4 className="font-semibold text-primary">4. No Copyright Claims</h4>
            <p className="text-muted-foreground">
              You may not register, claim, or assert copyright ownership over any AI-generated content 
              created within Rockmundo. All copyright and intellectual property rights remain with Rockmundo.
            </p>
          </div>

          <div>
            <h4 className="font-semibold text-primary">5. Violation Consequences</h4>
            <p className="text-muted-foreground">
              Violation of these terms may result in:
            </p>
            <ul className="list-disc list-inside text-muted-foreground mt-1 ml-2 space-y-0.5">
              <li>Immediate suspension or termination of your account</li>
              <li>Removal of all your content from the platform</li>
              <li>Legal action to protect Rockmundo's intellectual property</li>
            </ul>
          </div>

          <div>
            <h4 className="font-semibold text-primary">6. Acceptance</h4>
            <p className="text-muted-foreground">
              By creating an account and using Rockmundo's services, you acknowledge that you have read, 
              understood, and agree to be bound by these Terms of Service. If you do not agree to these 
              terms, you may not use Rockmundo.
            </p>
          </div>
        </div>
      </div>
    </ScrollArea>
  );
};
