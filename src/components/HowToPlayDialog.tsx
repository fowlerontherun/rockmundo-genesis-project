import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { HelpCircle, Music, Users, TrendingUp, MapPin, Trophy, DollarSign } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const HowToPlayDialog = () => {
  const [open, setOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="icon" title="How to Play">
          <HelpCircle className="h-5 w-5" />
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-4xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle className="text-2xl">How to Play Rockmundo</DialogTitle>
        </DialogHeader>
        <ScrollArea className="h-[70vh] pr-4">
          <Tabs defaultValue="overview" className="w-full">
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="music">Music</TabsTrigger>
              <TabsTrigger value="growth">Growth</TabsTrigger>
              <TabsTrigger value="social">Social</TabsTrigger>
            </TabsList>

            <TabsContent value="overview" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Trophy className="h-5 w-5" />
                    Game Objective
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <p>Build your music career from solo artist to global rock star!</p>
                  <ul className="list-disc list-inside space-y-2 ml-4">
                    <li>Create original songs and improve your skills</li>
                    <li>Form or join bands with other players</li>
                    <li>Perform at venues, festivals, and award shows</li>
                    <li>Build fame, earn money, and unlock new opportunities</li>
                  </ul>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <TrendingUp className="h-5 w-5" />
                    Core Game Loop
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="space-y-2">
                    <h4 className="font-semibold">1. Learn & Improve</h4>
                    <p className="text-sm text-muted-foreground">
                      Attend university courses, read skill books, watch educational videos, or work with mentors to gain XP and level up your skills.
                    </p>
                  </div>
                  <div className="space-y-2">
                    <h4 className="font-semibold">2. Create Music</h4>
                    <p className="text-sm text-muted-foreground">
                      Write original songs in the Songwriting Studio, then record them at city studios with producers.
                    </p>
                  </div>
                  <div className="space-y-2">
                    <h4 className="font-semibold">3. Build Your Band</h4>
                    <p className="text-sm text-muted-foreground">
                      Form bands with friends, rehearse songs to build familiarity, and develop chemistry through performances.
                    </p>
                  </div>
                  <div className="space-y-2">
                    <h4 className="font-semibold">4. Perform & Earn</h4>
                    <p className="text-sm text-muted-foreground">
                      Book gigs at venues, perform at festivals, or busk on the streets. Earn money and build your fanbase.
                    </p>
                  </div>
                  <div className="space-y-2">
                    <h4 className="font-semibold">5. Grow Your Reach</h4>
                    <p className="text-sm text-muted-foreground">
                      Release albums, stream on platforms, engage on Twaater (social media), and travel to new cities to expand your influence.
                    </p>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="music" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Music className="h-5 w-5" />
                    Songwriting
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  <p>Access from <strong>Music Hub → Songwriting Studio</strong></p>
                  <ul className="list-disc list-inside space-y-1 ml-4 text-sm">
                    <li>Write lyrics (manually or use AI assistance)</li>
                    <li>Select genre, mood, and song structure</li>
                    <li>Song quality based on your songwriting skill level</li>
                    <li>Complete songs go to your Song Manager</li>
                  </ul>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Recording Studio</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  <p>Access from <strong>Music Hub → Recording Studio</strong></p>
                  <ul className="list-disc list-inside space-y-1 ml-4 text-sm">
                    <li>Book sessions at city studios</li>
                    <li>Hire producers to enhance quality</li>
                    <li>Studio quality affects recording output</li>
                    <li>Costs vary by studio and producer</li>
                  </ul>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Performances</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  <p>Multiple ways to perform:</p>
                  <ul className="list-disc list-inside space-y-1 ml-4 text-sm">
                    <li><strong>Gigs:</strong> Book venues, create setlists, perform live</li>
                    <li><strong>Busking:</strong> Quick performances for practice and cash</li>
                    <li><strong>Festivals:</strong> Compete in seasonal music festivals</li>
                    <li><strong>Award Shows:</strong> Qualify for prestigious events</li>
                  </ul>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="growth" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Skills & XP System</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  <p>Multiple skill tracks to master:</p>
                  <ul className="list-disc list-inside space-y-1 ml-4 text-sm">
                    <li><strong>Instruments:</strong> Guitar, bass, drums, keyboards, vocals</li>
                    <li><strong>Songwriting:</strong> Lyrics, composition, arrangement</li>
                    <li><strong>Performance:</strong> Stage presence, crowd work</li>
                    <li><strong>Business:</strong> Marketing, management, production</li>
                  </ul>
                  <p className="mt-3 text-sm">
                    Earn XP through education, practice, and performances. Skills level up automatically when you earn enough XP.
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Education Options</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  <p>Access from <strong>Education</strong> in navigation:</p>
                  <ul className="list-disc list-inside space-y-1 ml-4 text-sm">
                    <li><strong>University:</strong> Enroll in courses, attend daily classes (10 AM - 2 PM game time), earn consistent XP</li>
                    <li><strong>Skill Books:</strong> Purchase and read books, gain XP over multiple days</li>
                    <li><strong>Mentors:</strong> One-on-one sessions with specialists for focused skill gains</li>
                    <li><strong>Videos:</strong> Watch educational content for quick learning</li>
                  </ul>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <DollarSign className="h-5 w-5" />
                    Economy
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  <p>Ways to earn money:</p>
                  <ul className="list-disc list-inside space-y-1 ml-4 text-sm">
                    <li>Gig payouts (venue size & your fame affect payment)</li>
                    <li>Busking earnings</li>
                    <li>Album sales and streaming royalties</li>
                    <li>Merchandise sales</li>
                    <li>Festival prizes</li>
                  </ul>
                  <p className="mt-3 text-sm">
                    Spend on equipment, studio time, education, travel, and band expenses.
                  </p>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="social" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Users className="h-5 w-5" />
                    Band System
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  <p>Access from <strong>Band Manager</strong>:</p>
                  <ul className="list-disc list-inside space-y-1 ml-4 text-sm">
                    <li>Create a band or join existing ones</li>
                    <li>Invite friends or collaborate with other players</li>
                    <li>Chemistry builds through rehearsals and performances</li>
                    <li>Higher chemistry = better performance bonuses</li>
                    <li>Band leaders manage setlists and bookings</li>
                    <li>Share earnings and expenses</li>
                  </ul>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Twaater (Social Media)</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  <p>Access from <strong>Social Media → Twaater</strong>:</p>
                  <ul className="list-disc list-inside space-y-1 ml-4 text-sm">
                    <li>Post updates about your music career</li>
                    <li>Build fanbase through engagement</li>
                    <li>Interact with other players</li>
                    <li>Earn XP from daily posts</li>
                    <li>Promote upcoming shows</li>
                  </ul>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <MapPin className="h-5 w-5" />
                    World & Travel
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  <p>Explore different cities:</p>
                  <ul className="list-disc list-inside space-y-1 ml-4 text-sm">
                    <li>Each city has unique venues, studios, and music scenes</li>
                    <li>Travel between cities to expand your reach</li>
                    <li>Different districts within cities offer various opportunities</li>
                    <li>Weather and seasons affect travel and performances</li>
                  </ul>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>

          <div className="mt-6 p-4 bg-muted rounded-lg">
            <h3 className="font-semibold mb-2">Getting Started Tips:</h3>
            <ol className="list-decimal list-inside space-y-1 text-sm">
              <li>Complete your character profile first</li>
              <li>Write your first song in the Songwriting Studio</li>
              <li>Attend university classes or read books to improve skills</li>
              <li>Practice busking to earn initial cash</li>
              <li>Form or join a band with other players</li>
              <li>Book your first gig at a small venue</li>
              <li>Keep posting on Twaater to build your fanbase</li>
            </ol>
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
};
