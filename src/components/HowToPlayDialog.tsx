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
  Heart, Shield, Sparkles, Zap, Home, ShoppingBag, Plane, Star,
  Newspaper, Camera, Activity, Package, Award, Tv, BookOpen, Wrench
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

const Section = ({ icon: Icon, title, children }: { icon: any; title: string; children: React.ReactNode }) => (
  <Card>
    <CardHeader className="pb-2">
      <CardTitle className="flex items-center gap-2 text-base">
        <Icon className="h-5 w-5 text-primary" />
        {title}
      </CardTitle>
    </CardHeader>
    <CardContent className="space-y-2 text-sm">{children}</CardContent>
  </Card>
);

const BulletList = ({ items }: { items: (string | React.ReactNode)[] }) => (
  <ul className="list-disc list-inside space-y-1 ml-2 text-muted-foreground">
    {items.map((item, i) => <li key={i}>{item}</li>)}
  </ul>
);

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
            <TabsList className="grid w-full grid-cols-4 sm:grid-cols-8 h-auto">
              <TabsTrigger value="overview" className="text-xs">Overview</TabsTrigger>
              <TabsTrigger value="music" className="text-xs">Music</TabsTrigger>
              <TabsTrigger value="perform" className="text-xs">Perform</TabsTrigger>
              <TabsTrigger value="skills" className="text-xs">Skills</TabsTrigger>
              <TabsTrigger value="career" className="text-xs">Career</TabsTrigger>
              <TabsTrigger value="social" className="text-xs">Social</TabsTrigger>
              <TabsTrigger value="world" className="text-xs">World</TabsTrigger>
              <TabsTrigger value="lifestyle" className="text-xs">Lifestyle</TabsTrigger>
            </TabsList>

            {/* ========== OVERVIEW ========== */}
            <TabsContent value="overview" className="space-y-3">
              <Section icon={Trophy} title="Game Objective">
                <p>Build your music career from solo artist to global rock star!</p>
                <BulletList items={[
                  "Create original songs, record them, and release albums",
                  "Form or join bands with other players",
                  "Perform at venues, open mics, festivals, and award shows",
                  "Build fame, earn money, and unlock new opportunities",
                  "Travel to 180+ cities across the world",
                  "Sign record deals, manage merchandise, go on tours",
                  "Climb the charts, dominate streaming, get on radio",
                ]} />
              </Section>

              <Section icon={TrendingUp} title="Core Game Loop">
                <div className="space-y-2">
                  {[
                    ["1. Learn & Improve", "Attend university, read books, watch videos, hire mentors. Level up 12+ skill categories from Basic → Professional → Mastery."],
                    ["2. Create Music", "Write songs in the Songwriting Studio, then record at city studios. Skills in mixing, DAW, and production boost quality."],
                    ["3. Build Your Band", "Form bands, rehearse songs, develop chemistry through gigs and jam sessions."],
                    ["4. Start Small", "Begin with open mic nights and busking — gain fans without upfront costs."],
                    ["5. Perform & Earn", "Book gigs, go on tours, perform at festivals. Stage skills and improvisation matter."],
                    ["6. Release & Promote", "Release singles/albums, get on streaming platforms, submit to radio, create social media content."],
                    ["7. Grow Your Empire", "Sign with labels, manage merchandise, handle PR & interviews, expand to new markets."],
                  ].map(([title, desc]) => (
                    <div key={title}>
                      <h4 className="font-semibold">{title}</h4>
                      <p className="text-muted-foreground">{desc}</p>
                    </div>
                  ))}
                </div>
              </Section>

              <Section icon={Clock} title="Scheduling & Time System">
                <BulletList items={[
                  "Activities are scheduled with real durations (gigs, rehearsals, classes, shifts)",
                  "Open mic nights happen at 8 PM on each venue's specific day",
                  "The game calendar tracks seasons and special events",
                  "You can't double-book — plan your time wisely!",
                  "Employment has auto clock-in for scheduled shifts",
                  "Check your Schedule page to see all upcoming activities",
                ]} />
              </Section>

              <Section icon={Activity} title="Health & Energy">
                <BulletList items={[
                  "Your character has Health (0-100) and Energy (0-100) stats",
                  "Performing, working, traveling, and training drain energy",
                  "Low health prevents you from working or performing",
                  "Rest at your accommodation to recover energy",
                  "Food and consumable items can restore health and energy",
                  "Music Health skills reduce energy costs from touring and performing",
                  "Balance activity with rest — burnout hurts your career!",
                ]} />
              </Section>
            </TabsContent>

            {/* ========== MUSIC ========== */}
            <TabsContent value="music" className="space-y-3">
              <Section icon={Music} title="Songwriting">
                <p>Access: <strong>Music Hub → Songwriting Studio</strong></p>
                <BulletList items={[
                  "Write lyrics manually or use AI assistance",
                  "Select genre, mood, tempo, and song structure",
                  "Song quality based on songwriting, composing, and genre skills",
                  "Music Theory provides a bonus multiplier (up to 10%)",
                  "Choose instruments — your skill levels affect quality",
                  "Completed songs go to your Song Manager",
                ]} />
              </Section>

              <Section icon={Headphones} title="Recording Studio">
                <p>Access: <strong>Music Hub → Recording Studio</strong></p>
                <BulletList items={[
                  "Book sessions at city studios with time slots",
                  "Hire producers to enhance quality (1-30% bonus)",
                  "Studio quality affects recording output (up to 20% bonus)",
                  "Add orchestra arrangements for extra impact",
                  <><strong>Your skills matter:</strong> Mixing, DAW, production, theory boost quality by up to 30%</>,
                  "Well-rehearsed songs record better; unrehearsed songs are penalized",
                ]} />
              </Section>

              <Section icon={Package} title="Release Manager">
                <p>Access: <strong>Music Hub → Release Manager</strong></p>
                <BulletList items={[
                  "Package recorded songs into singles or albums",
                  "Choose release format, artwork, and distribution",
                  "Manufacturing takes time — plan ahead!",
                  "Label contracts may cover manufacturing costs",
                  "Released music goes to streaming platforms and physical distribution",
                ]} />
              </Section>

              <Section icon={Radio} title="Radio, Streaming & Charts">
                <BulletList items={[
                  "Released songs appear on streaming platforms automatically",
                  "Earn royalties based on listener count and fame",
                  "Submit tracks to radio stations for airplay",
                  "Radio play increases exposure, fame, and streams",
                  "Chart positions unlock festivals, awards, and label interest",
                  "Charts drive streaming discovery — a hit single snowballs!",
                  "Monitor your chart positions and streaming stats in the Music Hub",
                ]} />
              </Section>

              <Section icon={Users} title="Rehearsals">
                <p>Access: <strong>Performance → Rehearsals</strong></p>
                <BulletList items={[
                  "Book rehearsal rooms in your current city",
                  "Practice specific songs to increase familiarity",
                  <><strong>Skill efficiency:</strong> Higher instrument & theory = faster gains (up to 1.6x speed)</>,
                  "Familiarity stages: Unrehearsed → Loose → Tight → Perfected",
                  "Higher familiarity = better gig and recording quality",
                  "Builds band chemistry over time",
                ]} />
              </Section>
            </TabsContent>

            {/* ========== PERFORM ========== */}
            <TabsContent value="perform" className="space-y-3">
              <Section icon={Mic} title="Open Mic Nights">
                <p>Access: <strong>Performance → Open Mic</strong></p>
                <BulletList items={[
                  "Every city has an open mic venue with a weekly night",
                  "Sign up to perform 2 songs of your choice",
                  "Performances start at 8 PM on the venue's scheduled day",
                  "Earn fame and fans (no money — it's exposure!)",
                  "Great for new artists to build an early audience",
                  "Live commentary during your performance",
                ]} />
              </Section>

              <Section icon={Guitar} title="Gigs">
                <p>Access: <strong>Performance → Gig Booking</strong></p>
                <BulletList items={[
                  "Book venues based on your fame level",
                  "Create setlists from your rehearsed songs",
                  <><strong>Performance factors:</strong> Song quality (25%), rehearsal (20%), chemistry (15%), equipment (12%), crew (8%), instrument skills (10%), stage skills (10%)</>,
                  "Showmanship, crowd engagement, and stage tech directly impact results",
                  "Higher improvisation = more amazing moments, fewer bad rolls",
                  "Earn money from ticket sales and merchandise",
                  "Merch sales spike during gigs!",
                ]} />
              </Section>

              <Section icon={Music} title="Busking">
                <p>Access: <strong>Performance → Busking</strong></p>
                <BulletList items={[
                  "Quick street performances — no booking required",
                  "Earn tips based on performance quality and location foot traffic",
                  "Good for practice and quick cash early on",
                  "Different spots in each city have different earnings potential",
                ]} />
              </Section>

              <Section icon={Users} title="Jam Sessions">
                <p>Access: <strong>Performance → Jam Sessions</strong></p>
                <BulletList items={[
                  "Spontaneous music sessions with bandmates",
                  "Improves chemistry with band members",
                  "Can lead to songwriting inspiration",
                  "Improvisation skills make jams more rewarding",
                ]} />
              </Section>

              <Section icon={Plane} title="Touring">
                <p>Access: <strong>Performance → Tours</strong></p>
                <BulletList items={[
                  "Plan multi-city tours with your band",
                  "Book venues in sequence across different cities",
                  "Tour logistics: travel time, accommodation, crew costs",
                  "Bigger tours = more fans but higher expenses",
                  "Tour merchandise generates significant income",
                  "Build regional fanbases by touring consistently",
                ]} />
              </Section>

              <Section icon={Award} title="Festivals & Award Shows">
                <BulletList items={[
                  <><strong>Festivals:</strong> Apply for performance slots, compete for prizes, gain massive exposure</>,
                  <><strong>Award Shows:</strong> Qualify through chart performance and fame, win trophies and prize money</>,
                  <><strong>Eurovision:</strong> Represent your country on the world stage!</>,
                  "Red carpet events boost fame through media interactions",
                  "Award wins provide fame boosts and significant prize money",
                  "Major events appear on the game calendar",
                ]} />
              </Section>
            </TabsContent>

            {/* ========== SKILLS ========== */}
            <TabsContent value="skills" className="space-y-3">
              <Section icon={Brain} title="Skill Categories">
                <p>Master 12+ skill categories, each with <strong>Basic → Professional → Mastery</strong> tiers:</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-2">
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
                      <li>Music Health & Endurance (conditioning, vocal care)</li>
                      <li>Mental resilience and burnout prevention</li>
                    </ul>
                  </div>
                </div>
              </Section>

              <Section icon={Zap} title="How Skills Affect Gameplay">
                <div className="space-y-2">
                  {[
                    ["🎧 Recording", "Mixing, DAW, production, vocal production, and theory boost quality by up to 30%."],
                    ["🎸 Rehearsals", "Instrument and theory skills give up to 1.6x efficiency. Skilled musicians reach 'Perfected' in ~3.75 hours vs 6 for beginners."],
                    ["🎤 Gigs", "Instrument skills (10%) and stage skills (10%) contribute to performance. Improvisation shifts random events in your favor."],
                    ["🎵 Songwriting", "Composing, lyrics, genre expertise, and production determine song quality. Music Theory adds a bonus multiplier."],
                    ["📱 Social Media", "Audience Psychology skills improve fan growth from Twaater and DikCok content."],
                    ["💼 Business", "Contract negotiation skills improve label deal terms. Marketing skills boost PR effectiveness."],
                  ].map(([title, desc]) => (
                    <div key={title}>
                      <h4 className="font-semibold text-sm">{title}</h4>
                      <p className="text-xs text-muted-foreground">{desc}</p>
                    </div>
                  ))}
                </div>
              </Section>

              <Section icon={BookOpen} title="Education Options">
                <p>Access: <strong>Education</strong> in navigation</p>
                <BulletList items={[
                  <><strong>University:</strong> Enroll in courses across all cities, attend daily classes (10 AM–2 PM game time), earn consistent XP. 23,000+ courses available!</>,
                  <><strong>Skill Books:</strong> Purchase and read books, gain XP over multiple reading sessions</>,
                  <><strong>Mentors:</strong> 126 Legendary Masters covering every skill — discover them through exploration, gigs, and achievements. Costs $15k-$250k+</>,
                  <><strong>YouTube Videos:</strong> Watch educational content for quick, free learning</>,
                  <><strong>Summary Tab:</strong> Track your overall education progress and recent achievements</>,
                ]} />
              </Section>
            </TabsContent>

            {/* ========== CAREER ========== */}
            <TabsContent value="career" className="space-y-3">
              <Section icon={DollarSign} title="Economy & Earning">
                <p>Ways to earn money:</p>
                <BulletList items={[
                  "Gig payouts (venue size & fame affect payment)",
                  "Busking tips",
                  "Album sales and streaming royalties",
                  "Merchandise sales (spike during gigs & tours)",
                  "Festival prizes and award show winnings",
                  "Employment — work jobs for steady income",
                  "Label advances when signing deals",
                ]} />
                <p className="mt-2 text-muted-foreground">Spend on equipment, studio time, education, travel, accommodation, band expenses, and more.</p>
              </Section>

              <Section icon={Briefcase} title="Employment">
                <p>Access: <strong>Business → Employment</strong></p>
                <BulletList items={[
                  "1,700+ jobs across all 180 cities (food, retail, music industry, etc.)",
                  "Filter by city, category, and wage range",
                  "Auto clock-in for scheduled shifts (if in the right city with enough health/energy)",
                  "Jobs affect health and energy — watch the impact indicators",
                  "Steady income while building your music career",
                  "Some music industry jobs provide skill XP too!",
                ]} />
              </Section>

              <Section icon={Sparkles} title="Labels & Record Deals">
                <p>Access: <strong>Business → Labels</strong></p>
                <BulletList items={[
                  "Submit demos to record labels for contract offers",
                  "AI evaluates your fame and song quality for deal terms",
                  "Sign contracts for advances, royalty splits, and release quotas",
                  "Labels may cover manufacturing and marketing costs",
                  "Contract types: distribution, licensing, standard, 360 deals",
                  "Or start your own label — review demos, manage artists, hire staff",
                ]} />
              </Section>

              <Section icon={Newspaper} title="PR & Interviews">
                <p>Access: <strong>Career → PR</strong></p>
                <BulletList items={[
                  "Hire PR managers to boost your public image",
                  "Get invited to magazine, TV, and radio interviews",
                  "Your responses in interviews affect public perception",
                  "Good PR increases fame and fan loyalty",
                  "Media cooldowns prevent over-saturation",
                  "Marketing & Branding skills improve PR outcomes",
                ]} />
              </Section>

              <Section icon={ShoppingBag} title="Merchandise">
                <p>Access: <strong>Commerce → Merch</strong></p>
                <BulletList items={[
                  "Design and sell band merchandise (t-shirts, posters, etc.)",
                  "Merch sales spike during gigs and tours",
                  "Set up merch stands at venues",
                  "Online merch store generates passive income",
                  "Custom designs with your band logo and art",
                ]} />
              </Section>

              <Section icon={Wrench} title="Equipment">
                <p>Access: <strong>Commerce → Equipment Shop</strong></p>
                <BulletList items={[
                  "Buy instruments, amps, effects pedals, and accessories",
                  "Equipment quality contributes 12% to gig performance",
                  "Better gear = better sound at gigs and in recordings",
                  "Upgrade as your career grows and budget allows",
                  "Equipment condition degrades with use — maintain your gear!",
                ]} />
              </Section>

              <Section icon={Heart} title="Passive Growth">
                <BulletList items={[
                  "Characters gain 1-5 fame daily",
                  "Bands gain 1-5 fame and 1-5 fans daily",
                  "Activity bonuses stack on top of passive growth",
                  "Streaming royalties accumulate over time",
                  "Chart positions compound fame gains",
                ]} />
              </Section>
            </TabsContent>

            {/* ========== SOCIAL ========== */}
            <TabsContent value="social" className="space-y-3">
              <Section icon={Users} title="Band System">
                <p>Access: <strong>Band Manager</strong></p>
                <BulletList items={[
                  "Create a band or join existing ones",
                  "Invite friends or collaborate with other players",
                  "Chemistry builds through rehearsals and performances",
                  "Higher chemistry = better performance bonuses",
                  "Band leaders manage setlists and bookings",
                  "Share earnings and expenses",
                  "Hire crew members (sound engineers, road crew, etc.)",
                  "Band leadership votes for democratic decisions",
                  "Put bands on hiatus if you need a break",
                ]} />
              </Section>

              <Section icon={Heart} title="Relationships & Friendships">
                <BulletList items={[
                  <><strong>Friendship tiers:</strong> Acquaintance → Bandmate → Inner Circle → Legendary Duo</>,
                  "Each tier unlocks perks (merch discounts, shared XP, co-op goals)",
                  "Set relationship status: Best Friends, Rivals, Romance, or Mentor",
                  "Affinity grows through chats, gifts, trades, jams, and gigs together",
                ]} />
              </Section>

              <Section icon={Tv} title="Twaater & DikCok">
                <p>Access: <strong>Social Media</strong></p>
                <BulletList items={[
                  <><strong>Twaater:</strong> Post updates, build fanbase, promote shows, earn XP</>,
                  <><strong>DikCok:</strong> Create viral short videos, join trending challenges, gain fans</>,
                  "Cross-promote: DikCok videos boost Twaater following",
                  "Video types: tutorials, gear reviews, challenges, behind-the-scenes",
                  "Audience Psychology skills improve fan growth",
                  "Consistent posting builds momentum",
                ]} />
              </Section>

              <Section icon={Users} title="Gettit (Community Forum)">
                <p>Access: <strong>Social → Gettit</strong></p>
                <BulletList items={[
                  "Reddit-style player community with subreddits",
                  "Post and discuss in topic-specific communities",
                  "Upvote/downvote posts and comments",
                  "Create your own subreddits",
                ]} />
              </Section>

              <Section icon={Star} title="Achievements">
                <BulletList items={[
                  "Unlock achievements for career milestones",
                  "Categories: music, performance, social, business, exploration",
                  "Achievements grant rewards (cash, fame, items)",
                  "Rarity tiers: Common, Uncommon, Rare, Epic, Legendary",
                  "Track your collection in the Achievements page",
                ]} />
              </Section>
            </TabsContent>

            {/* ========== WORLD ========== */}
            <TabsContent value="world" className="space-y-3">
              <Section icon={MapPin} title="180+ Cities Worldwide">
                <BulletList items={[
                  "Each city has unique venues, studios, open mic nights, and jobs",
                  "Different districts within cities offer various opportunities",
                  "Build local fanbases in multiple cities and countries",
                  "City fame and country fame tracked separately",
                  "Some cities have special music scenes (Nashville, London, Tokyo, etc.)",
                ]} />
              </Section>

              <Section icon={Plane} title="Travel System">
                <BulletList items={[
                  "Travel by train, bus, plane, or ship between cities",
                  "Each transport mode has different costs, speed, and energy impact",
                  "Planes are fastest but most expensive",
                  "Trains and buses are cheaper but take longer",
                  "Ships available for overseas travel",
                  "Music Health skills reduce energy costs from travel",
                  "You must be in a city to work, perform, or attend classes there",
                ]} />
              </Section>

              <Section icon={Home} title="Housing & Accommodation">
                <BulletList items={[
                  "Find accommodation in each city you visit",
                  "Options range from hostels to luxury apartments",
                  "Better housing provides better rest and energy recovery",
                  "Some accommodations offer practice space",
                  "Costs vary by city and quality level",
                ]} />
              </Section>

              <Section icon={Calendar} title="Game Calendar & Events">
                <BulletList items={[
                  "Seasonal effects influence gameplay (summer festival season, etc.)",
                  "Major events appear on the calendar (award shows, festivals)",
                  "Weather and seasons affect travel and outdoor performances",
                  "Special holidays and music events throughout the year",
                  "Plan your career moves around the calendar for maximum impact",
                ]} />
              </Section>

              <Section icon={Shield} title="Underworld">
                <p>Access: <strong>Underworld</strong> in navigation</p>
                <BulletList items={[
                  "Explore the seedy underbelly of the music industry",
                  "Purchase single-use consumable items with various effects",
                  "Items boost health, energy, fame, cash, XP, or skills",
                  "Items disappear from inventory after use — buy wisely!",
                  "Risk vs reward: some items have side effects",
                ]} />
              </Section>
            </TabsContent>

            {/* ========== LIFESTYLE ========== */}
            <TabsContent value="lifestyle" className="space-y-3">
              <Section icon={Camera} title="Modeling">
                <p>Access: <strong>Career → Modeling</strong></p>
                <BulletList items={[
                  "Take on modeling gigs for extra income and fame",
                  "Fashion shoots, magazine covers, brand deals",
                  "Boost your public image and recognition",
                  "Higher fame unlocks better modeling opportunities",
                ]} />
              </Section>

              <Section icon={Home} title="Character & Identity">
                <p>Access: <strong>Character Hub</strong></p>
                <BulletList items={[
                  "Customize your character's appearance and avatar",
                  "Choose an origin story that shapes your journey",
                  "Track your character stats: health, energy, fame, cash",
                  "View your complete skill tree and progress",
                  "Manage your wardrobe and clothing items",
                  "Equip instruments and gear",
                ]} />
              </Section>

              <Section icon={Star} title="VIP & Premium Features">
                <BulletList items={[
                  "VIP status unlocks exclusive content and bonuses",
                  "Premium avatar clothing and accessories",
                  "Limited edition items and skin collections",
                  "Special VIP-only events and opportunities",
                ]} />
              </Section>

              <Section icon={Activity} title="Minigames & Side Hustles">
                <BulletList items={[
                  <><strong>Rhythm Challenge:</strong> Test your timing and earn XP + cash</>,
                  <><strong>Lyric Scramble:</strong> Unscramble song lyrics for rewards</>,
                  <><strong>Soundcheck Mix:</strong> Mix audio levels for bonus earnings</>,
                  "Side hustles level up with practice for better rewards",
                  "Quick activities between main career moves",
                ]} />
              </Section>

              <Section icon={Sparkles} title="Random Events">
                <BulletList items={[
                  "Unexpected opportunities and challenges pop up during gameplay",
                  "Events can be positive (surprise gig offers, fan encounters) or negative (equipment breakdowns)",
                  "Your skills and fame level influence which events you encounter",
                  "React to events for bonus rewards or to avoid penalties",
                ]} />
              </Section>
            </TabsContent>
          </Tabs>

          <div className="mt-6 p-4 bg-muted rounded-lg">
            <h3 className="font-semibold mb-2">🚀 Getting Started Tips:</h3>
            <ol className="list-decimal list-inside space-y-1 text-sm">
              <li>Complete your character profile and pick an origin story</li>
              <li>Write your first song in the Songwriting Studio</li>
              <li>Attend university classes or read books to improve skills</li>
              <li>Sign up for an <strong>Open Mic Night</strong> to get your first fans!</li>
              <li>Get a job for steady income while building your career</li>
              <li>Form or join a band with other players</li>
              <li>Rehearse your songs to improve familiarity (your skills speed this up!)</li>
              <li>Record your best songs — your mixing and production skills boost quality</li>
              <li>Release your first single through the Release Manager</li>
              <li>Book your first gig at a small venue</li>
              <li>Post on Twaater and create DikCok videos to grow your fanbase</li>
              <li>Submit tracks to radio stations for airplay</li>
              <li>Set up merchandise to earn during gigs</li>
              <li>Start planning a tour across multiple cities!</li>
            </ol>
          </div>

          <div className="mt-4 p-4 bg-primary/10 border border-primary/20 rounded-lg">
            <h3 className="font-semibold mb-2 flex items-center gap-2">
              <Zap className="h-4 w-4" />
              Pro Tip: Skills Are Everything!
            </h3>
            <p className="text-sm text-muted-foreground">
              Your skills affect <strong>every</strong> gameplay system. Higher mixing skills = better recordings. 
              Higher instrument skills = faster rehearsals. Higher showmanship = better gigs. Higher improvisation = 
              more lucky breaks on stage. Audience Psychology = faster fan growth. Invest in your skills early and 
              the benefits compound across your entire career!
            </p>
          </div>

          <div className="mt-4 p-4 bg-warning/10 border border-warning/20 rounded-lg">
            <h3 className="font-semibold mb-2 flex items-center gap-2">
              <Heart className="h-4 w-4" />
              Remember: Balance Is Key!
            </h3>
            <p className="text-sm text-muted-foreground">
              Every action costs time and energy. Working too much drains health. Touring without rest causes burnout. 
              Balance performing, creating, learning, and resting for the best long-term career growth. 
              Check your health and energy before committing to activities!
            </p>
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
};
