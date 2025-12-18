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
import { 
  HelpCircle, Music, Users, TrendingUp, MapPin, Trophy, DollarSign, 
  Mic, Calendar, Guitar, Headphones, Radio, Clock
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

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
            <TabsList className="grid w-full grid-cols-5">
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="music">Music</TabsTrigger>
              <TabsTrigger value="perform">Perform</TabsTrigger>
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
                    <li>Perform at venues, open mics, festivals, and award shows</li>
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
                    <h4 className="font-semibold">4. Start Small</h4>
                    <p className="text-sm text-muted-foreground">
                      Begin with open mic nights and busking to gain experience and fans without upfront costs.
                    </p>
                  </div>
                  <div className="space-y-2">
                    <h4 className="font-semibold">5. Perform & Earn</h4>
                    <p className="text-sm text-muted-foreground">
                      Book gigs at venues, perform at festivals, or compete in award shows. Earn money and build your fanbase.
                    </p>
                  </div>
                  <div className="space-y-2">
                    <h4 className="font-semibold">6. Grow Your Reach</h4>
                    <p className="text-sm text-muted-foreground">
                      Release albums, stream on platforms, engage on Twaater (social media), and travel to new cities to expand your influence.
                    </p>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Clock className="h-5 w-5" />
                    Scheduling System
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  <p>Your activities are scheduled and block time slots:</p>
                  <ul className="list-disc list-inside space-y-1 ml-4 text-sm">
                    <li>Open mic nights happen at specific times (8 PM each venue's day)</li>
                    <li>Gigs, rehearsals, and classes have set durations</li>
                    <li>Check your <strong>Schedule</strong> to see upcoming activities</li>
                    <li>You can't double-book - plan your time wisely!</li>
                  </ul>
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
                  <CardTitle className="flex items-center gap-2">
                    <Headphones className="h-5 w-5" />
                    Recording Studio
                  </CardTitle>
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
                  <CardTitle className="flex items-center gap-2">
                    <Users className="h-5 w-5" />
                    Rehearsals
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  <p>Access from <strong>Performance → Rehearsals</strong></p>
                  <ul className="list-disc list-inside space-y-1 ml-4 text-sm">
                    <li>Book rehearsal rooms in your city</li>
                    <li>Practice specific songs to increase familiarity</li>
                    <li>Higher familiarity = better live performances</li>
                    <li>Builds band chemistry over time</li>
                    <li>Different room sizes and costs available</li>
                  </ul>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Radio className="h-5 w-5" />
                    Radio & Streaming
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  <p>Get your music heard:</p>
                  <ul className="list-disc list-inside space-y-1 ml-4 text-sm">
                    <li>Release recorded songs to streaming platforms</li>
                    <li>Earn royalties based on listener count</li>
                    <li>Radio play increases exposure and fame</li>
                    <li>Chart positions unlock new opportunities</li>
                  </ul>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="perform" className="space-y-4">
              <Card className="border-primary/50">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Mic className="h-5 w-5 text-primary" />
                    Open Mic Nights
                    <Badge variant="secondary" className="ml-2">New!</Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  <p>Access from <strong>Performance → Open Mic</strong></p>
                  <ul className="list-disc list-inside space-y-1 ml-4 text-sm">
                    <li>Every city has an open mic venue with a weekly night</li>
                    <li>Sign up to perform <strong>2 songs</strong> of your choice</li>
                    <li>Performances start at <strong>8 PM</strong> on the venue's day</li>
                    <li>Wait until the scheduled time to start your set</li>
                    <li>Earn <strong>fame and fans</strong> (no money - it's about exposure!)</li>
                    <li>Great for new artists to build an audience</li>
                    <li>Live commentary during your performance</li>
                  </ul>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Guitar className="h-5 w-5" />
                    Gigs
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  <p>Access from <strong>Performance → Gig Booking</strong></p>
                  <ul className="list-disc list-inside space-y-1 ml-4 text-sm">
                    <li>Book venues based on your fame level</li>
                    <li>Create setlists from your rehearsed songs</li>
                    <li>Performance quality affects payouts and fan gain</li>
                    <li>Earn money from ticket sales and merchandise</li>
                    <li>Bigger venues = more fans but higher stakes</li>
                  </ul>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Busking</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  <p>Access from <strong>Performance → Busking</strong></p>
                  <ul className="list-disc list-inside space-y-1 ml-4 text-sm">
                    <li>Quick performances on the street</li>
                    <li>No booking required - play anytime</li>
                    <li>Earn tips based on performance and location</li>
                    <li>Good for practice and quick cash</li>
                    <li>Different spots have different foot traffic</li>
                  </ul>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Jam Sessions</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  <p>Access from <strong>Performance → Jam Sessions</strong></p>
                  <ul className="list-disc list-inside space-y-1 ml-4 text-sm">
                    <li>Spontaneous music sessions with other players</li>
                    <li>Improves chemistry with bandmates</li>
                    <li>Can lead to songwriting inspiration</li>
                    <li>Builds relationships and networking</li>
                  </ul>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Festivals & Awards</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  <p>Special events throughout the year:</p>
                  <ul className="list-disc list-inside space-y-1 ml-4 text-sm">
                    <li><strong>Festivals:</strong> Apply for slots, compete for prizes</li>
                    <li><strong>Award Shows:</strong> Qualify through chart performance</li>
                    <li><strong>Eurovision:</strong> Represent your country!</li>
                    <li>Big fame boosts and prize money available</li>
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
                  <p className="mt-3 text-sm text-muted-foreground">
                    <strong>Note:</strong> Open mic nights don't pay - they're about building exposure and fans!
                  </p>
                  <p className="mt-2 text-sm">
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
                    <li>Put bands on hiatus if you need a break</li>
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
                    <li>Each city has unique venues, studios, and open mic nights</li>
                    <li>Travel between cities to expand your reach</li>
                    <li>Different districts within cities offer various opportunities</li>
                    <li>Build local fanbases in multiple cities</li>
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
              <li>Sign up for an <strong>Open Mic Night</strong> to get your first fans!</li>
              <li>Practice busking to earn initial cash</li>
              <li>Form or join a band with other players</li>
              <li>Rehearse your songs to improve familiarity</li>
              <li>Book your first gig at a small venue</li>
              <li>Keep posting on Twaater to build your fanbase</li>
            </ol>
          </div>

          <div className="mt-4 p-4 bg-primary/10 border border-primary/20 rounded-lg">
            <h3 className="font-semibold mb-2 flex items-center gap-2">
              <Mic className="h-4 w-4" />
              Pro Tip: Start with Open Mic!
            </h3>
            <p className="text-sm text-muted-foreground">
              Open mic nights are the perfect way to start your career. They're free to enter, you only need 2 songs, 
              and you'll earn fame and fans even as a beginner. Check the Open Mic page to find venues in your city 
              and sign up for the next available slot!
            </p>
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
};
