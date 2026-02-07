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
  Mic, Calendar, Guitar, Headphones, Radio, Clock, Brain, Briefcase,
  Heart, Shield, Sparkles, Zap
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
            <TabsList className="grid w-full grid-cols-6">
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="music">Music</TabsTrigger>
              <TabsTrigger value="perform">Perform</TabsTrigger>
              <TabsTrigger value="skills">Skills</TabsTrigger>
              <TabsTrigger value="growth">Career</TabsTrigger>
              <TabsTrigger value="social">Social</TabsTrigger>
            </TabsList>

            {/* ========== OVERVIEW ========== */}
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
                    <li>Travel to 100+ cities across the world</li>
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
                      Attend university courses, read skill books, watch videos, or work with mentors. Level up across 12+ skill categories.
                    </p>
                  </div>
                  <div className="space-y-2">
                    <h4 className="font-semibold">2. Create Music</h4>
                    <p className="text-sm text-muted-foreground">
                      Write songs in the Songwriting Studio, then record them at studios. Your skills in mixing, DAW, and production directly boost recording quality.
                    </p>
                  </div>
                  <div className="space-y-2">
                    <h4 className="font-semibold">3. Build Your Band</h4>
                    <p className="text-sm text-muted-foreground">
                      Form bands, rehearse songs to build familiarity (skilled musicians learn faster!), and develop chemistry through performances.
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
                      Book gigs at venues, perform at festivals, or compete in award shows. Your stage skills and improvisation ability affect every performance.
                    </p>
                  </div>
                  <div className="space-y-2">
                    <h4 className="font-semibold">6. Grow Your Reach</h4>
                    <p className="text-sm text-muted-foreground">
                      Release albums, stream on platforms, sign with labels, engage on Twaater, and travel to new cities to expand your influence.
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
                    <li>Gigs, rehearsals, classes, and work shifts have set durations</li>
                    <li>Check your <strong>Schedule</strong> to see upcoming activities</li>
                    <li>You can't double-book — plan your time wisely!</li>
                    <li>Employment has auto clock-in for scheduled shifts</li>
                  </ul>
                </CardContent>
              </Card>
            </TabsContent>

            {/* ========== MUSIC ========== */}
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
                    <li>Song quality based on your songwriting, composing, and genre skills</li>
                    <li>Music Theory skills provide a bonus multiplier (up to 10%)</li>
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
                    <li>Book sessions at city studios with time slots</li>
                    <li>Hire producers to enhance quality (1-30% bonus)</li>
                    <li>Studio quality affects recording output (up to 20% bonus)</li>
                    <li>Add orchestra arrangements for extra impact</li>
                    <li><strong>Your skills matter:</strong> Mixing, DAW, production, and theory skills boost quality by up to 30%</li>
                    <li>Well-rehearsed songs record better; unrehearsed songs are penalized</li>
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
                    <li><strong>Skill efficiency:</strong> Higher instrument and theory skills = faster familiarity gains (up to 1.6x speed)</li>
                    <li>Stages: Unrehearsed → Loose → Tight → Perfected</li>
                    <li>Higher familiarity = better live performances and recordings</li>
                    <li>Builds band chemistry over time</li>
                  </ul>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Radio className="h-5 w-5" />
                    Radio, Streaming & Charts
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  <p>Get your music heard:</p>
                  <ul className="list-disc list-inside space-y-1 ml-4 text-sm">
                    <li>Release recorded songs to streaming platforms</li>
                    <li>Earn royalties based on listener count</li>
                    <li>Radio play increases exposure and fame</li>
                    <li>Chart positions unlock new opportunities</li>
                    <li>Charts drive streaming discovery; streaming provides revenue</li>
                  </ul>
                </CardContent>
              </Card>
            </TabsContent>

            {/* ========== PERFORM ========== */}
            <TabsContent value="perform" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Mic className="h-5 w-5" />
                    Open Mic Nights
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  <p>Access from <strong>Performance → Open Mic</strong></p>
                  <ul className="list-disc list-inside space-y-1 ml-4 text-sm">
                    <li>Every city has an open mic venue with a weekly night</li>
                    <li>Sign up to perform <strong>2 songs</strong> of your choice</li>
                    <li>Performances start at <strong>8 PM</strong> on the venue's day</li>
                    <li>Earn <strong>fame and fans</strong> (no money — it's about exposure!)</li>
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
                    <li><strong>Performance factors:</strong> Song quality (25%), rehearsal (20%), chemistry (15%), equipment (12%), crew (8%), instrument skills (10%), stage skills (10%)</li>
                    <li><strong>Stage skills matter:</strong> Showmanship, crowd engagement, and stage tech now directly impact performance</li>
                    <li><strong>Improvisation:</strong> Higher improv skill increases chance of amazing moments and reduces bad rolls</li>
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
                    <li>No booking required — play anytime</li>
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
                    <li>Improvisation skills make jams more rewarding</li>
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

            {/* ========== SKILLS ========== */}
            <TabsContent value="skills" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Brain className="h-5 w-5" />
                    Skill Categories
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  <p>Master 12+ skill categories, each with Basic → Professional → Mastery tiers:</p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-2">
                    <div className="space-y-1">
                      <h4 className="font-semibold text-sm">🎵 Musical</h4>
                      <ul className="list-disc list-inside space-y-0.5 ml-2 text-xs text-muted-foreground">
                        <li>Songwriting & Production (mixing, DAW, vocals)</li>
                        <li>Instruments (strings, keys, percussion, wind, brass, electronic, world)</li>
                        <li>Genre Expertise (rock, jazz, electronic, hip-hop, etc.)</li>
                        <li>Music Theory & Ear Training</li>
                      </ul>
                    </div>
                    <div className="space-y-1">
                      <h4 className="font-semibold text-sm">🎤 Performance</h4>
                      <ul className="list-disc list-inside space-y-0.5 ml-2 text-xs text-muted-foreground">
                        <li>Stage Showmanship (presence, crowd work, tech)</li>
                        <li>Improvisation (spontaneous solos, stage recovery)</li>
                        <li>Vocal & Performance Skills</li>
                        <li>Rapping (flow, delivery, freestyle)</li>
                      </ul>
                    </div>
                    <div className="space-y-1">
                      <h4 className="font-semibold text-sm">💼 Business</h4>
                      <ul className="list-disc list-inside space-y-0.5 ml-2 text-xs text-muted-foreground">
                        <li>Contracts & Rights (deals, royalties)</li>
                        <li>Marketing & Branding (PR, campaigns)</li>
                        <li>Booking & Touring (logistics, routing)</li>
                      </ul>
                    </div>
                    <div className="space-y-1">
                      <h4 className="font-semibold text-sm">🧠 Support</h4>
                      <ul className="list-disc list-inside space-y-0.5 ml-2 text-xs text-muted-foreground">
                        <li>Audience Psychology (fan engagement, trends)</li>
                        <li>Music Health & Endurance (conditioning, vocal care, mental resilience)</li>
                      </ul>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="border-primary/30">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Zap className="h-5 w-5 text-primary" />
                    How Skills Affect Gameplay
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="space-y-1">
                    <h4 className="font-semibold text-sm flex items-center gap-1">
                      <Headphones className="h-3.5 w-3.5" /> Recording
                    </h4>
                    <p className="text-xs text-muted-foreground">
                      Mixing, DAW, production, vocal production, and theory skills boost recording quality by up to <strong>30%</strong>. A skilled musician produces noticeably better recordings at the same studio.
                    </p>
                  </div>
                  <div className="space-y-1">
                    <h4 className="font-semibold text-sm flex items-center gap-1">
                      <Users className="h-3.5 w-3.5" /> Rehearsals
                    </h4>
                    <p className="text-xs text-muted-foreground">
                      Instrument and theory skills give up to <strong>1.6x efficiency</strong>. Skilled musicians reach "Perfected" familiarity in ~3.75 hours vs 6 for beginners.
                    </p>
                  </div>
                  <div className="space-y-1">
                    <h4 className="font-semibold text-sm flex items-center gap-1">
                      <Guitar className="h-3.5 w-3.5" /> Gigs
                    </h4>
                    <p className="text-xs text-muted-foreground">
                      Instrument skills (10%) and stage skills (10%) — showmanship, crowd engagement, stage tech — both contribute to gig performance. Improvisation skill shifts random events in your favor.
                    </p>
                  </div>
                  <div className="space-y-1">
                    <h4 className="font-semibold text-sm flex items-center gap-1">
                      <Music className="h-3.5 w-3.5" /> Songwriting
                    </h4>
                    <p className="text-xs text-muted-foreground">
                      Composing, lyrics, genre expertise, and production skills determine song quality. Music Theory adds a bonus multiplier.
                    </p>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Education Options</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  <p>Access from <strong>Education</strong> in navigation:</p>
                  <ul className="list-disc list-inside space-y-1 ml-4 text-sm">
                    <li><strong>University:</strong> Enroll in courses, attend daily classes (10 AM–2 PM game time), earn consistent XP</li>
                    <li><strong>Skill Books:</strong> Purchase and read books, gain XP over multiple days</li>
                    <li><strong>Mentors:</strong> One-on-one sessions with specialists for focused skill gains</li>
                    <li><strong>Videos:</strong> Watch educational content for quick learning</li>
                  </ul>
                </CardContent>
              </Card>
            </TabsContent>

            {/* ========== CAREER ========== */}
            <TabsContent value="growth" className="space-y-4">
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
                    <li>Merchandise sales (spike during gigs & tours)</li>
                    <li>Festival prizes and award show winnings</li>
                    <li>Employment — work jobs for steady income</li>
                  </ul>
                  <p className="mt-2 text-sm">
                    Spend on equipment, studio time, education, travel, band expenses, and more.
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Briefcase className="h-5 w-5" />
                    Employment
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  <p>Access from <strong>Business → Employment</strong></p>
                  <ul className="list-disc list-inside space-y-1 ml-4 text-sm">
                    <li>1,700+ jobs across all cities (food, retail, music industry, etc.)</li>
                    <li>Filter by city, category, and wage range</li>
                    <li>Auto clock-in for scheduled shifts (if you're in the right city)</li>
                    <li>Jobs affect health and energy — watch the impact indicators</li>
                    <li>Steady income while building your music career</li>
                  </ul>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Sparkles className="h-5 w-5" />
                    Labels & Record Deals
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  <p>Access from <strong>Business → Labels</strong></p>
                  <ul className="list-disc list-inside space-y-1 ml-4 text-sm">
                    <li>Submit demos to record labels for contract offers</li>
                    <li>AI evaluates your fame and song quality for deal terms</li>
                    <li>Sign contracts for advances, royalty splits, and release quotas</li>
                    <li>Or start your own label — review demos, manage artists, hire staff</li>
                  </ul>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Heart className="h-5 w-5" />
                    Passive Growth
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  <p>Your career grows even when you're not actively playing:</p>
                  <ul className="list-disc list-inside space-y-1 ml-4 text-sm">
                    <li>Characters gain 1-5 fame daily</li>
                    <li>Bands gain 1-5 fame and 1-5 fans daily</li>
                    <li>Activity bonuses stack on top of passive growth</li>
                    <li>Streaming royalties accumulate over time</li>
                  </ul>
                </CardContent>
              </Card>
            </TabsContent>

            {/* ========== SOCIAL ========== */}
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
                  <CardTitle className="flex items-center gap-2">
                    <Heart className="h-5 w-5" />
                    Relationships
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  <p>Build friendships with other players:</p>
                  <ul className="list-disc list-inside space-y-1 ml-4 text-sm">
                    <li><strong>Friendship tiers:</strong> Acquaintance → Bandmate → Inner Circle → Legendary Duo</li>
                    <li>Each tier unlocks perks (merch discounts, shared XP, co-op goals)</li>
                    <li>Set relationship status: Best Friends, Rivals, Romance, or Mentor</li>
                    <li>Affinity grows through chats, gifts, trades, jams, and gigs together</li>
                  </ul>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Gettit (Community Forum)</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  <p>Access from <strong>Social → Gettit</strong>:</p>
                  <ul className="list-disc list-inside space-y-1 ml-4 text-sm">
                    <li>Reddit-style player community with subreddits</li>
                    <li>Post and discuss in topic-specific communities</li>
                    <li>Upvote/downvote posts and comments</li>
                    <li>Create your own subreddits</li>
                  </ul>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Twaater & DikCok</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  <p>Access from <strong>Social Media</strong>:</p>
                  <ul className="list-disc list-inside space-y-1 ml-4 text-sm">
                    <li><strong>Twaater:</strong> Post updates, build fanbase, promote shows, earn XP</li>
                    <li><strong>DikCok:</strong> Create viral short videos, join trending challenges, gain fans</li>
                    <li>Cross-promote: DikCok videos boost your Twaater following</li>
                    <li>Audience Psychology skills improve fan growth from social media</li>
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
                  <p>Explore 100+ cities worldwide:</p>
                  <ul className="list-disc list-inside space-y-1 ml-4 text-sm">
                    <li>Each city has unique venues, studios, and open mic nights</li>
                    <li>Travel by train, bus, plane, or ship between cities</li>
                    <li>Different districts within cities offer various opportunities</li>
                    <li>Build local fanbases in multiple cities and countries</li>
                    <li>Weather and seasons affect travel and performances</li>
                    <li>Music Health skills reduce energy costs from touring</li>
                  </ul>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Shield className="h-5 w-5" />
                    Underworld
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  <p>Access from <strong>Underworld</strong> in navigation:</p>
                  <ul className="list-disc list-inside space-y-1 ml-4 text-sm">
                    <li>Explore the seedy underbelly of the music industry</li>
                    <li>Purchase single-use consumable items with various effects</li>
                    <li>Items boost health, energy, fame, cash, XP, or skills</li>
                    <li>Items disappear from inventory after use — buy wisely!</li>
                  </ul>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>

          <div className="mt-6 p-4 bg-muted rounded-lg">
            <h3 className="font-semibold mb-2">Getting Started Tips:</h3>
            <ol className="list-decimal list-inside space-y-1 text-sm">
              <li>Complete your character profile and pick an origin story</li>
              <li>Write your first song in the Songwriting Studio</li>
              <li>Attend university classes or read books to improve skills</li>
              <li>Sign up for an <strong>Open Mic Night</strong> to get your first fans!</li>
              <li>Get a job for steady income while building your career</li>
              <li>Form or join a band with other players</li>
              <li>Rehearse your songs to improve familiarity (your skills speed this up!)</li>
              <li>Record your best songs — your mixing and production skills boost quality</li>
              <li>Book your first gig at a small venue</li>
              <li>Post on Twaater and create DikCok videos to grow your fanbase</li>
            </ol>
          </div>

          <div className="mt-4 p-4 bg-primary/10 border border-primary/20 rounded-lg">
            <h3 className="font-semibold mb-2 flex items-center gap-2">
              <Zap className="h-4 w-4" />
              Pro Tip: Skills Are Everything!
            </h3>
            <p className="text-sm text-muted-foreground">
              Your skills now affect <strong>every</strong> gameplay system. Higher mixing skills = better recordings. 
              Higher instrument skills = faster rehearsals. Higher showmanship = better gigs. Higher improvisation = 
              more lucky breaks on stage. Invest in your skills early and the benefits compound across your entire career!
            </p>
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
};
