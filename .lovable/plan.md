# Skin Sale Market (real money, player to player)

## What players get
- A new **Skin Market** tab in the Skin Store.
- **Sell:** a player who bought a set with real money can list either one item from it or the whole set, at a price they choose (minimum £0.99, maximum £49.99).
- **Buy:** other players pay the seller's price by card through Stripe checkout. The item, or every item in the set, moves to the buyer's character as soon as the payment is confirmed.
- **Get paid:** sellers link a payout account once ("Set up payouts"). Stripe checks their identity and sends their money to their bank. The game keeps a market fee (suggested 15%).
- **My listings / history:** cancel open listings and see your sales and purchases.

## Rules
- Only items that came from a real-money set purchase can be sold. Items bought with game money, or given out free, can't be.
- A listed item is locked: the seller can't wear it or list it twice while it's for sale.
- Once an item sells, the seller loses it and the buyer owns it. The set purchase record keeps the full ownership trail.
- You can't buy your own listing or buy an item you already own.
- If a payment fails or the buyer leaves checkout, the listing goes back on sale after 30 minutes.
- Refunds and disputes go through Stripe. A refunded sale returns the item to the seller.

## What you need to do
- Turn on **Stripe Connect** in your Stripe account (Settings → Connect) and accept the platform terms. Sellers can't get paid until this is on.
- Confirm the fee (15% suggested) and the price limits.
- Real-money trading between players may bring tax and consumer-law duties. Check them for the UK/EU.

## Technical details
- New tables: `skin_market_listings` (seller profile, item type/id or collection id, price in pence, status open/reserved/sold/cancelled, reserved_until), `skin_market_sales` (listing, buyer, Stripe session/payment intent, fee, seller payout, status), and `seller_payout_accounts` (user_id, Stripe Connect account id, onboarding status). RLS: anyone signed in can see open listings; people see only their own sales and payout account. All changes go through SECURITY DEFINER RPCs (`create_skin_listing`, `cancel_skin_listing`, `complete_skin_market_sale`, which is service-role only and does the transfer atomically).
- Eligibility check against `skin_collection_purchases` and `player_owned_skins` for the seller's profile. Equipping a listed item is blocked by a trigger.
- Edge functions: `skin-market-connect` (Express account plus onboarding link), `skin-market-checkout` (reserves the listing, then makes a Checkout Session with `application_fee_amount` and `transfer_data.destination`), and a verify action on return, matching the existing set-purchase pattern. The `stripe-webhook` handler is extended for `checkout.session.completed` and `charge.refunded` so a buyer who closes the tab still gets the item.
- UI: a market tab, a listing dialog and a payouts card in `SkinStore.tsx`. Banner version and VersionHistory get updated.
- Tests cover eligibility, the self-buy block, the fee/payout split, and the reserve timeout.
