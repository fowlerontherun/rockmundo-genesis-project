import type { ReactNode } from "react";
import {
  Accessibility, CalendarDays, CarFront, CircleHelp, Clock3, Coffee,
  HeartPulse, Mail, MapPin, ShieldCheck, Ticket, TentTree, Users,
} from "lucide-react";
import type { FestivalPublicEdition, FestivalVisitorGuideKey } from "../domain/festivalLaunch";
import type { FestivalPublicEventPhase } from "./festivalEventPhase";
import { SponsorIdentity } from "./SponsorIdentity";
import {
  auditFestivalSponsorSlots, festivalVisitorContactLink, festivalVisitorSalesLabel,
  formatFestivalEditionDate, getPublishedFestivalCampingTickets,
  isMainFestivalSponsor, isPublishedFestivalPerformance, orderFestivalPublicSponsors,
} from "./festivalPublicDisplay";

interface PanelProps {
  id: string;
  title: string;
  subtitle: string;
  icon: ReactNode;
  children: ReactNode;
  open?: boolean;
}
function Panel({ id, title, subtitle, icon, children, open = false }: PanelProps) {
  return (
    <section id={"visitor-" + id} className="scroll-mt-6 rounded-xl border bg-card p-4 shadow-sm sm:p-5">
      <details className="group" open={open}>
        <summary className="flex cursor-pointer list-none items-start gap-3 rounded-md focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary [&::-webkit-details-marker]:hidden">
          <span aria-hidden="true" className="mt-0.5 rounded-lg bg-primary/10 p-2 text-primary">{icon}</span>
          <span className="min-w-0 flex-1">
            <span className="block text-lg font-semibold">{title}</span>
            <span className="block text-sm text-muted-foreground">{subtitle}</span>
          </span>
          <span aria-hidden="true" className="mt-1 text-lg text-muted-foreground group-open:rotate-45">+</span>
        </summary>
        <div className="mt-4 space-y-3 text-sm leading-relaxed">{children}</div>
      </details>
    </section>
  );
}
function Unconfirmed({ children = "Not yet confirmed for this edition." }: { children?: ReactNode }) {
  return <p className="rounded-md border border-dashed bg-muted/30 p-3 text-sm text-muted-foreground" role="status">{children}</p>;
}

export function festivalGuideCampingAvailable(edition: FestivalPublicEdition): boolean {
  // An organiser note alone cannot invent a campsite or camping ticket.
  return getPublishedFestivalCampingTickets(edition.ticketProducts).length > 0;
}
export function festivalGuideText(edition: FestivalPublicEdition, key: FestivalVisitorGuideKey, legacy: string | null) {
  const published = edition.visitorGuide?.sections[key]?.trim();
  if (published) return { text: published, editionSpecific: true };
  // Existing public profile notes are retained as labelled general guidance,
  // not falsely presented as new-edition verified services.
  return { text: legacy?.trim() ?? "", editionSpecific: false };
}
function Note({ edition, field, legacy }: {
  edition: FestivalPublicEdition; field: FestivalVisitorGuideKey; legacy: string | null;
}) {
  const note = festivalGuideText(edition, field, legacy);
  if (!note.text) return <Unconfirmed />;
  return (
    <div>
      {!note.editionSpecific && <p className="mb-2 text-xs font-semibold text-muted-foreground">
        General organiser guidance — arrangements for this edition may differ
      </p>}
      <p className="whitespace-pre-line">{note.text}</p>
    </div>
  );
}
export function FestivalVisitorGuide({ edition: f, phase, onViewTimetable, onViewTickets }: {
  edition: FestivalPublicEdition;
  phase: FestivalPublicEventPhase;
  onViewTimetable: () => void;
  onViewTickets: () => void;
}) {
  const campingTickets = getPublishedFestivalCampingTickets(f.ticketProducts);
  const campingAvailable = festivalGuideCampingAvailable(f);
  const publishedPerformances = (f.lineup ?? []).filter(isPublishedFestivalPerformance);
  const sponsors = orderFestivalPublicSponsors(f.sponsors);
  const sponsorAudit = auditFestivalSponsorSlots(f.sponsors);
  const main = sponsors.find(isMainFestivalSponsor);
  const supporting = sponsors.filter((s) => !isMainFestivalSponsor(s)).slice(0, 4);
  const contact = festivalGuideText(f, "contact", f.information.contact);
  const contactHref = festivalVisitorContactLink(contact.text);
  const cancelled = f.launchStatus === "cancelled_before_event";
  const nav = [
    ["arrival", "Getting here"], ["times", "Opening times"], ["entry", "Tickets & refunds"],
    ...(campingAvailable ? [["camping", "Camping"]] : []),
    ["access", "Accessibility"], ["food", "Food & drink"],
    ["welfare", "Safety"], ["faq", "FAQs"], ["contacts", "Contact"], ["partners", "Partners"],
  ];
  return (
    <div className="space-y-5">
      <header className="space-y-3">
        <h2 className="text-2xl font-bold">Your festival visitor guide</h2>
        <p className="text-sm text-muted-foreground">
          Information for this annual edition of {f.name}. Only the published plan,
          approved organiser notes and live ticket data are treated as confirmed.
        </p>
        <div className="grid gap-3 rounded-xl border bg-card p-4 text-sm sm:grid-cols-2 lg:grid-cols-4">
          <div><span className="flex items-center gap-2 text-muted-foreground"><MapPin className="h-4 w-4" /> Location</span>
            <strong className="mt-1 block">{f.city}, {f.country}</strong></div>
          <div><span className="flex items-center gap-2 text-muted-foreground"><CalendarDays className="h-4 w-4" /> Dates</span>
            <strong className="mt-1 block">
              {formatFestivalEditionDate(f.startsAt, f.timezone)} – {formatFestivalEditionDate(f.endsAt, f.timezone)}
            </strong></div>
          <div><span className="flex items-center gap-2 text-muted-foreground"><Users className="h-4 w-4" /> Site & stages</span>
            <strong className="mt-1 block">
              {f.visitorGuide?.siteStyle || f.festivalType || "Site style not yet confirmed"} · {f.stages.length} published stage{f.stages.length === 1 ? "" : "s"}
            </strong></div>
          <div><span className="flex items-center gap-2 text-muted-foreground"><Ticket className="h-4 w-4" /> Ticket sales</span>
            <strong className="mt-1 block">{festivalVisitorSalesLabel(phase, f.launchStatus)}</strong></div>
        </div>
      </header>
      <nav aria-label="Jump to visitor information" className="flex flex-wrap gap-2">
        {nav.map(([key, label]) => (
          <a key={key} href={"#visitor-" + key}
            onClick={() => document.getElementById("visitor-" + key)?.querySelector("details")?.setAttribute("open", "")}
            className="rounded-full border bg-background px-3 py-2 text-sm font-medium hover:bg-accent focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary">
            {label}
          </a>
        ))}
      </nav>
      <div className="grid items-start gap-4 lg:grid-cols-2">
        <Panel id="arrival" title="Getting here" subtitle="City, site, transport and parking" icon={<MapPin className="h-5 w-5" />} open>
          <p><strong>Confirmed destination:</strong> {f.city}, {f.country}.</p>
          <p><strong>Festival site:</strong></p>
          <Note edition={f} field="site" legacy={null} />
          <p><strong>Transport:</strong></p>
          <Note edition={f} field="transport" legacy={f.information.travel} />
          <p className="flex items-center gap-2 font-medium"><CarFront className="h-4 w-4" /> Parking</p>
          <Note edition={f} field="parking" legacy={null} />
          <p className="text-xs text-muted-foreground">Routes, travel times and available parking are not assumed from the festival city.</p>
        </Panel>
        <Panel id="times" title="Opening times" subtitle="Festival dates, gates, performances and curfew" icon={<Clock3 className="h-5 w-5" />}>
          <p><strong>Event dates:</strong> {formatFestivalEditionDate(f.startsAt, f.timezone)} – {formatFestivalEditionDate(f.endsAt, f.timezone)}.</p>
          <p><strong>Gate opening ({f.timezone}):</strong></p>
          <Note edition={f} field="gates" legacy={null} />
          <p><strong>Curfew ({f.timezone}):</strong></p>
          <Note edition={f} field="curfew" legacy={null} />
          <p>{publishedPerformances.length} confirmed published performance{publishedPerformances.length === 1 ? "" : "s"} with stage and times.</p>
          <button type="button" className="font-semibold text-primary underline underline-offset-2" onClick={onViewTimetable}>
            View the published timetable
          </button>
        </Panel>
        <Panel id="entry" title="Tickets & refunds" subtitle="Admission, access, transfer and cancellation" icon={<Ticket className="h-5 w-5" />}>
          {cancelled && <p role="alert" className="rounded-lg border border-amber-600/40 p-3 font-semibold">
            This festival edition is cancelled. Ticket purchases and check-in are closed. Refund eligibility is not assumed.
          </p>}
          {f.ticketProducts.filter((p) => p.productClass === "admission").length ? (
            <ul className="space-y-2">
              {f.ticketProducts.filter((p) => p.productClass === "admission").map((p) => (
                <li className="rounded-lg border p-3" key={p.id}>
                  <strong>{p.name}</strong>
                  <span className="block text-muted-foreground">Access: {p.accessStartDate} – {p.accessEndDate}</span>
                  <span className="block text-muted-foreground">Sales: {p.saleStatus.replaceAll("_", " ")}</span>
                </li>
              ))}
            </ul>
          ) : <Unconfirmed>Admission products have not been published.</Unconfirmed>}
          <p>Upgrades and add-ons do not grant admission on their own. Ticket transfers and refunds follow published game and organiser rules only.</p>
          <Note edition={f} field="ticketHelp" legacy={null} />
          <p className="font-semibold">Published entry conditions</p>
          <Note edition={f} field="terms" legacy={f.information.terms} />
          <p className="font-semibold">Age and ID guidance</p>
          <Note edition={f} field="ageGuidance" legacy={f.information.ageGuidance} />
          <p className="font-semibold">Refund policy</p>
          <Note edition={f} field="refundPolicy" legacy={f.information.refundPolicy} />
          <button type="button" className="font-semibold text-primary underline underline-offset-2" onClick={onViewTickets}>Review tickets</button>
        </Panel>
        {campingAvailable && (
          <Panel id="camping" title="Camping" subtitle="Published camping ticket options" icon={<TentTree className="h-5 w-5" />}>
            <ul className="space-y-2">
              {campingTickets.map((p) => <li className="rounded-lg border p-3" key={p.name}>
                {p.name} — {p.saleStatus.replaceAll("_", " ")}
              </li>)}
            </ul>
            <p>A camping add-on never replaces admission.</p>
            <Note edition={f} field="camping" legacy={f.information.camping} />
            <p className="text-muted-foreground">Campground facilities are not implied by camping ticket availability.</p>
          </Panel>
        )}
        <Panel id="access" title="Accessibility" subtitle="Published access and assistance details" icon={<Accessibility className="h-5 w-5" />}>
          <Note edition={f} field="accessibility" legacy={f.information.accessibility} />
          <p className="text-muted-foreground">For specific needs, contact the organiser before arranging travel.</p>
        </Panel>
        <Panel id="food" title="Food & drink" subtitle="Approved vendors, facilities and dietary options" icon={<Coffee className="h-5 w-5" />}>
          <Note edition={f} field="foodAndDrink" legacy={f.information.foodAndDrink} />
        </Panel>
        <Panel id="welfare" title="Safety & welfare" subtitle="Medical, security and lost property" icon={<HeartPulse className="h-5 w-5" />}>
          {f.visitorGuide?.verifiedSafety?.summary ? (
            <p className="whitespace-pre-line">{f.visitorGuide.verifiedSafety.summary}</p>
          ) : <Unconfirmed>
            On-site medical assistance, security, welfare and lost-property provision have not been verified for this edition.
            No staffing roster or operational readiness score is published as a visitor-facing guarantee.
          </Unconfirmed>}
        </Panel>
        <Panel id="faq" title="Frequently asked questions" subtitle="Answers grounded in the published edition" icon={<CircleHelp className="h-5 w-5" />}>
          <details className="border-b py-2">
            <summary className="cursor-pointer font-medium">Where is the festival?</summary>
            <p className="mt-2">{f.city}, {f.country}. Exact site and directions appear above only when published.</p>
          </details>
          <details className="border-b py-2">
            <summary className="cursor-pointer font-medium">Where is the running order?</summary>
            <p className="mt-2">{publishedPerformances.length ? "Confirmed stage times are on the Timetable tab." : "The confirmed running order is not yet published."}</p>
          </details>
          <details className="border-b py-2">
            <summary className="cursor-pointer font-medium">Does an upgrade include entry?</summary>
            <p className="mt-2">No. A valid admission ticket is required.</p>
          </details>
          <details className="border-b py-2">
            <summary className="cursor-pointer font-medium">What happens if the event is cancelled?</summary>
            <p className="mt-2">{cancelled ? "This edition is cancelled. " : ""}
              Any refund depends on the actual published policy and ticket status. No automatic eligibility is promised.</p>
          </details>
          {campingAvailable && <details className="border-b py-2">
            <summary className="cursor-pointer font-medium">Is camping included?</summary>
            <p className="mt-2">Published camping ticket options are listed above. Check the specific ticket; do not assume camping is included.</p>
          </details>}
          {f.visitorGuide?.sections.faq && (
            <div className="pt-2"><p className="font-semibold">More from the organiser</p>
              <p className="mt-2 whitespace-pre-line">{f.visitorGuide.sections.faq}</p></div>
          )}
        </Panel>
        <Panel id="contacts" title="Contact the organiser" subtitle="Visitor enquiries and updates" icon={<Mail className="h-5 w-5" />}>
          <Note edition={f} field="contact" legacy={f.information.contact} />
          {contactHref && <a href={contactHref}
            target={contactHref.startsWith("https:") ? "_blank" : undefined}
            rel={contactHref.startsWith("https:") ? "noopener noreferrer" : undefined}
            className="inline-block font-semibold text-primary underline underline-offset-2">
            Contact the organiser
          </a>}
        </Panel>
        <Panel id="partners" title="Festival partners" subtitle="Canonical sponsor identities for this edition" icon={<ShieldCheck className="h-5 w-5" />}>
          {!main && <p>No main sponsor has been published for this edition.</p>}
          {main && <div className="rounded-lg border border-primary/40 p-3">
            <p className="mb-2 font-semibold">Main sponsor</p>
            <SponsorIdentity name={main.name} logoReference={main.logoReference} />
            <p className="mt-2">{main.name}</p>
          </div>}
          <div className="grid gap-3 sm:grid-cols-2">
            {supporting.map((s) => <div key={s.id} className="rounded-lg border p-3">
              <SponsorIdentity name={s.name} logoReference={s.logoReference} />
              <p className="mt-2 font-medium">{s.name}</p>
              <p className="text-muted-foreground">{s.relationshipLabel}</p>
            </div>)}
          </div>
          {!main && supporting.length === 0 && <Unconfirmed>Partners have not been announced yet.</Unconfirmed>}
          {!sponsorAudit.ready && sponsors.length > 0 && <p className="text-muted-foreground">
            Sponsor slot allocation is awaiting confirmation. Only published canonical identities are shown.
          </p>}
        </Panel>
      </div>
      <p className="text-sm text-muted-foreground">
        Check this edition's published details again before travelling. Unconfirmed information is not an assurance of facilities or services.
      </p>
    </div>
  );
}
