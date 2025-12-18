-- Add Twaater-specific random events
INSERT INTO public.random_events (
  title, description, category, is_common,
  option_a_text, option_a_effects, option_a_outcome_text,
  option_b_text, option_b_effects, option_b_outcome_text
) VALUES 
(
  'Viral Twaat!',
  'One of your recent twaats is blowing up! The algorithm blessed you today and notifications are flooding in. How do you capitalize on this moment?',
  'twaater',
  true,
  'Ride the wave - Post more content while hot',
  '{"fans": 200, "fame": 50, "energy": -15}',
  'You posted while the momentum was hot! Your engagement skyrocketed and you gained a ton of new followers. Worth the energy!',
  'Stay humble - Let it happen naturally',
  '{"fans": 50, "xp": 20, "energy": 5}',
  'You let your viral moment speak for itself. A smaller boost in followers, but you feel refreshed and ready for more.'
),
(
  'Bot Celebrity Shoutout',
  '@MusicWeeklyReview, a major music industry account with 500k followers, just quoted your twaat with praise! This is huge exposure.',
  'twaater',
  false,
  'Quote twaat them back with gratitude',
  '{"fans": 150, "fame": 40, "energy": -10}',
  'Your grateful response went viral too! The music community loved the wholesome interaction and you gained serious credibility.',
  'Send a private thank you instead',
  '{"fans": 30, "fame": 10, "health": 5}',
  'You kept things professional with a private message. Less public engagement but the industry insider appreciated your class.'
),
(
  'Troll Wave Incoming',
  'A group of trolls has started flooding your mentions with negative comments about your latest release. Your notifications are blowing up with hate.',
  'twaater',
  true,
  'Clap back with a clever response',
  '{"fame": 25, "fans": -30, "energy": -20}',
  'Your response went viral! Some loved your confidence, others thought it was petty. You lost some fans but gained notoriety.',
  'Ignore, mute, and move on',
  '{"health": 10, "energy": -10, "xp": 15}',
  'You took the high road and ignored the trolls. Your mental health thanks you, and the drama died down quickly.'
),
(
  'Trending Topic',
  'You''re trending locally! Your name and your latest content are showing up on the Explore page. This doesn''t happen every day!',
  'twaater',
  false,
  'Post while trending to maximize exposure',
  '{"fans": 180, "fame": 35, "energy": -20}',
  'You capitalized on your trending status with fresh content. New followers poured in and your engagement metrics soared!',
  'Let the algorithm do its thing',
  '{"fans": 75, "fame": 15}',
  'You let the trend play out naturally. Decent follower growth without the extra effort.'
),
(
  'Collaboration Request',
  'A verified Twaater account with a big following just DM''d you about a potential collaboration. They want to do a joint livestream!',
  'twaater',
  false,
  'Accept and prepare for the collab',
  '{"fans": 250, "fame": 60, "energy": -25, "cash": -500}',
  'The collaboration was a hit! You split costs but the exposure was incredible. Both your fanbases loved the crossover content.',
  'Politely decline - focus on solo content',
  '{"xp": 30, "energy": 10}',
  'You decided to focus on your own brand. No new followers but you feel more confident in your independent path.'
),
(
  'Account Impersonator',
  'Someone created a fake account pretending to be you! They''re scamming your fans and posting embarrassing content. Your real followers are confused.',
  'twaater',
  false,
  'Make a public callout and report',
  '{"fans": 50, "fame": 20, "energy": -15}',
  'Your callout went viral and the community rallied behind you. The fake account got banned and you looked stronger for handling it publicly.',
  'Quietly report and wait',
  '{"fans": -20, "health": -5}',
  'The fake account stayed up for a while before getting banned. Some fans were scammed and you lost a few followers who thought YOU were the fake.'
);
