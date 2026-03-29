"use client";

import { useState } from 'react';
import { ChevronDown, ChevronUp, BookOpen, Zap, ArrowRight, Target, Star } from 'lucide-react';

// ─── Static playbook data from data.js ──────────────────────────────────────

const CONVERSION_BENCHMARKS = [
  { value: '8–12%', label: 'Cold Email Reply Rate', note: 'Highly personalized campaigns' },
  { value: '5–10×', label: 'Warm vs Cold Conversion', note: 'Warm outreach advantage' },
  { value: '5–9', label: 'Touches to Convert', note: 'Average touchpoints to close' },
  { value: '2–4%', label: 'Meeting Booked Rate', note: 'Of qualified cold contacts' },
  { value: '+45%', label: 'Social Proof Boost', note: 'Reply rate increase with testimonials' },
  { value: '$42', label: 'Email ROI per $1 Spent', note: 'B2B cold email average return' },
];

const CONVERSION_FUNNEL = [
  { stage: 'Awareness', action: 'Cold email / phone intro', conv: '100%', notes: 'Volume play — reach all 74 CRITICAL prospects in Month 1' },
  { stage: 'Interest', action: 'Free sample shipped / dropped off', conv: '30-40%', notes: 'Free sample converts ~35% of cold contacts to interested' },
  { stage: 'Consideration', action: 'Pricing call / follow-up sequence', conv: '15-20%', notes: 'Of those who tried sample, 50% consider ordering' },
  { stage: 'Intent', action: 'First trial order placed', conv: '8-12%', notes: 'Trial order = 1-10 lbs, no commitment' },
  { stage: 'Purchase', action: 'Recurring weekly/biweekly order', conv: '5-8%', notes: '~5-8% of initial contacts become recurring buyers' },
  { stage: 'Advocacy', action: 'Referral to other businesses', conv: '2-3%', notes: 'Happy customers in tight-knit community = organic referrals' },
];

const PLAYBOOK_TIERS = [
  {
    tier: 'TIER 1 — HIGH-TOUCH (CRITICAL Score 70-100)',
    tierClass: 'text-[#e8614a]',
    targets: 'Georgian Restaurants, Georgian Bakeries, Georgian Markets, Distributors',
    approach: 'White-glove direct approach. Personal visit + sample drop-off preferred.',
    sequence: [
      { touch: 1, day: 1, channel: 'Phone Call', subject: 'Intro call — free sample offer', script: `Hi, my name is [Name] from Colchis Creamery — we're an Ohio-based Georgian cheese producer. I noticed you're serving khachapuri, and I'd love to drop off a free sample of our Imeruli and Sulguni to let the cheese speak for itself. Would you be open to a quick 5-minute tasting?` },
      { touch: 2, day: 3, channel: 'In-Person Visit', subject: 'Free sample drop + live demo', script: `Bring 1-2 lb samples of Imeruli and Sulguni. If possible, show the melt/stretch properties. Leave a one-page pricing sheet and business card. Key message: 'Our shredded packs save your kitchen 30-45 minutes of prep per shift.'` },
      { touch: 3, day: 10, channel: 'Follow-up Email', subject: 'How did [BusinessName] like the Georgian cheese sample?', script: `Subject: Your team's reaction to the Colchis sample?\n\nHi [Name],\n\nFollowed up after leaving the sample last week. Curious what your chef thought of the melt and stretch on the Sulguni — we've had bakeries tell us it reduces their khachapuri prep time significantly because they no longer need to shred in-house.\n\nI'd love to set up a 10-minute call to talk pricing for regular weekly delivery. What does next week look like?\n\n—[Your name], Colchis Creamery` },
      { touch: 4, day: 17, channel: 'Phone Call', subject: 'Pricing discussion + first order setup', script: `Call to confirm interest and discuss minimum order quantities. Offer a 'first month' discount or a free 5-lb trial order to reduce risk. Ask: 'What's your current cheese supplier? Are you satisfied with delivery consistency?'` },
      { touch: 5, day: 30, channel: 'Email', subject: 'Last chance — seasonal pricing ends soon', script: `Final urgency email. Mention limited batch availability or seasonal pricing. Offer to be their exclusive local Georgian cheese source.` },
    ],
    valueProps: [
      'Shredded packs eliminate in-house prep — save 30-45 min per shift',
      'Locally produced = 2-3 day freshness vs. 10-14 day imported',
      'FDA compliant, Ohio-made — simplifies supplier audits',
      'One-stop source for Imeruli, Sulguni, Smoked Sulguni, Nadughi',
      'Authentic Georgian recipe — your menu authenticity story',
    ],
  },
  {
    tier: 'TIER 2 — MEDIUM-TOUCH (HIGH Score 50-69)',
    tierClass: 'text-[#c9a84c]',
    targets: 'Eastern European Groceries, Caucasian/Eurasian Restaurants, Russian Restaurants, EE Markets',
    approach: 'Email-first, phone follow-up. Lead with product comparison angle.',
    sequence: [
      { touch: 1, day: 1, channel: 'Cold Email', subject: 'Your customers are asking for Georgian cheese — [BusinessName]', script: `Subject: Your customers are already asking for sulguni\n\nHi [Name],\n\nI run Colchis Creamery, an Ohio-based producer of authentic Georgian cheeses — Sulguni, Imeruli, and Smoked Sulguni.\n\nGeorgian cheese is one of the fastest-growing specialty dairy requests at Eastern European markets right now — your customers likely already know these cheeses from home.\n\nWe offer weekly delivery and can start with a small trial shipment. Can I send you a 2-lb sample?\n\n—[Name]` },
      { touch: 2, day: 7, channel: 'Email Follow-Up', subject: 'Re: Georgian cheese for [BusinessName]', script: `Quick follow-up to my email from [date]. Attached is our current price list and product spec sheet. Our Sulguni compares directly to what you may be importing, but fresher and at competitive wholesale pricing.\n\nWould a 10-minute call this week work?` },
      { touch: 3, day: 14, channel: 'Phone Call', subject: 'Follow-up call', script: `Reference your email, offer free sample delivery if they haven't responded. Ask about their current cheese supplier and delivery frequency.` },
      { touch: 4, day: 25, channel: 'Email', subject: 'Other [city] stores are already stocking it', script: `Social proof email. Mention (if applicable) similar stores that have already ordered. Include a quote from a satisfied customer.` },
      { touch: 5, day: 45, channel: 'Re-engagement', subject: 'Checking back in — new seasonal products', script: `Mention new product launches (smoked sulguni, nadughi) to create fresh interest.` },
    ],
    valueProps: [
      'Sulguni recognized by Russian/EE diaspora — zero education required',
      'Premium retail pricing opportunity ($9-11/lb wholesale, $14-18/lb retail)',
      'Weekly delivery from Columbus — fresher than imported European brands',
      'Full product line including smoked sulguni and nadughi',
    ],
  },
  {
    tier: 'TIER 3 — EDUCATIONAL APPROACH (MEDIUM Score 35-49)',
    tierClass: 'text-[#4d9a5a]',
    targets: 'Artisan Pizzerias, International Markets, Uzbek/Armenian Restaurants',
    approach: 'Content-led. Educate on sulguni-as-halloumi substitution. Taste test critical.',
    sequence: [
      { touch: 1, day: 1, channel: 'Email', subject: 'Have you tried sulguni as a halloumi alternative?', script: `Subject: Better than halloumi for grilling — Georgian Sulguni\n\nHi [Name],\n\nGeorgian Sulguni cheese grills identically to halloumi — same elastic texture, similar salt level — but with a milkier, more complex flavor profile your guests will notice.\n\nI'd love to send you a 1-lb sample to try on your next menu R&D session. Colchis Creamery is Ohio-made, FDA compliant, and available for weekly delivery.\n\nWorth a taste?` },
      { touch: 2, day: 10, channel: 'Email', subject: 'Sulguni on your specials board this week?', script: `Follow-up with a recipe idea specific to their menu type (e.g., pizza: 'Sulguni + fig + prosciutto white pie recipe').` },
      { touch: 3, day: 21, channel: 'Email', subject: 'Quick question about your cheese sourcing', script: `Ask about their current specialty cheese supplier. Offer a competitive price comparison.` },
    ],
    valueProps: [
      'Sulguni = halloumi alternative (grills identically, more complex flavor)',
      "Differentiator for your menu — 'American-made Georgian cheese' is a story",
      'Nadughi = premium ricotta alternative for upscale brunch menus',
      "Artisan cheese shops: unique 'made in Ohio' Georgian cheese is a compelling narrative",
    ],
  },
  {
    tier: 'TIER 4 — DISTRIBUTOR PARTNERSHIP (Strategic)',
    tierClass: 'text-[#4a7a9a]',
    targets: "Specialty Food Distributors (Chef's Warehouse, Atalanta, JJK, etc.)",
    approach: 'Executive-level outreach. Formal pitch deck + product samples. Long sales cycle (3-6 months).',
    sequence: [
      { touch: 1, day: 1, channel: 'LinkedIn + Email', subject: 'Partnership proposal — Georgian cheese category for [Distributor]', script: `Subject: Filling a white space in your Georgian/Eastern European cheese category\n\nHi [Name],\n\nColchis Creamery is the only US-based producer of authentic Georgian cheeses (Sulguni, Imeruli, Smoked Sulguni) with FDA compliance and weekly production capacity.\n\nYour existing accounts — Georgian restaurants, Eastern European groceries, artisan markets — are actively asking their distributors for domestic Georgian cheese. We can fulfill that demand.\n\nI'd love 20 minutes to walk you through our product line and discuss a potential distribution partnership. Are you open to a call next week?` },
      { touch: 2, day: 10, channel: 'Sample Shipment', subject: 'Sample package arriving [date]', script: `Ship a professional sample box: all products, spec sheets, shelf-life data, pricing, minimum order info, and a short origin story card.` },
      { touch: 3, day: 17, channel: 'Phone Call', subject: 'Follow-up on sample package', script: `Detailed product discussion. Cover: shelf life, MOQ, lead time, cold chain logistics, pricing tiers.` },
      { touch: 4, day: 35, channel: 'Email', subject: 'Q2 launch window — finalize details', script: `Create urgency around production calendar / Q2 launch timing. Provide draft distribution agreement terms.` },
    ],
    valueProps: [
      'Only US-made Georgian cheese — fills white space in specialty cheese category',
      'One partnership = access to 50-500 end accounts',
      'Lower distribution cost than European imports',
      'Unique product with built-in PR/food media appeal',
      'Georgian cuisine trend: 40%+ increase in US restaurant openings 2023-2026',
    ],
  },
];

const BEST_PRACTICES = [
  { practice: 'Always lead with a free sample', detail: 'Physical product always outperforms pitch decks for food B2B. A tasting converts 3-5× better than any email sequence alone.' },
  { practice: 'Target the decision-maker directly', detail: 'Restaurant: owner/head chef. Grocery: buyer/owner. Distributor: VP Purchasing or Category Manager. LinkedIn is the best source for finding names.' },
  { practice: 'Use the labor-saving angle first', detail: "'Our shredded packs eliminate 30-45 min of daily prep' is more compelling than 'our cheese is delicious.' ROI = fastest path to yes." },
  { practice: 'Leverage proximity advantage', detail: "'Made in Columbus — 2 days fresh delivery' beats any imported product on freshness. Emphasize supply chain reliability." },
  { practice: 'Build clusters geographically', detail: 'When you close one Brooklyn Georgian restaurant, immediately call all nearby Georgian restaurants in the same neighborhood. Social proof = instant referral.' },
  { practice: 'Follow up 5-9 times', detail: '80% of deals close after the 5th touch. Most salespeople give up after 2. Set calendar reminders and use a simple CRM tracker.' },
  { practice: 'Personalize to their specific dishes', detail: "'I noticed you serve Megruli khachapuri — that requires ~350g of sulguni per piece, which means [math]. We can save you [$/month].' Specific math closes deals." },
  { practice: 'Offer a low-risk first order', detail: "'Start with 10 lbs, no commitment' removes every objection. The product quality will convert them to recurring customers." },
];

// ─── Components ─────────────────────────────────────────────────────────────

function SequenceStep({ step, tierIndex, stepIndex }: { step: any; tierIndex: number; stepIndex: number }) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="flex gap-2.5 p-3 bg-[#1F1F1F] rounded-lg">
      <div className="w-6 h-6 rounded-full bg-[#1a2e1e] text-[#4d9a5a] text-[10px] font-bold flex items-center justify-center shrink-0">
        {step.touch}
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-[9px] text-[#666666] uppercase tracking-wider">Day {step.day}</div>
        <div className="text-[11px] font-semibold text-[#F0EDE6] mt-0.5">{step.channel}</div>
        <div className="text-[10px] text-[#888888] italic mt-0.5">{step.subject}</div>
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="text-[10px] text-[#4d9a5a] mt-1.5 flex items-center gap-1 hover:text-[#6dba7a] transition-colors"
        >
          {isOpen ? 'Hide' : 'View'} script
          {isOpen ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
        </button>
        {isOpen && (
          <div className="mt-2 text-[10px] text-[#888888] leading-relaxed bg-[#141414] rounded-lg p-3 whitespace-pre-wrap border border-[#2A2A2A]">
            {step.script}
          </div>
        )}
      </div>
    </div>
  );
}

export function PlaybookView() {
  return (
    <div>
      {/* Header */}
      <div className="mb-2">
        <h2 className="font-serif text-xl font-semibold text-[#F0EDE6]">B2B Sales Playbook</h2>
        <p className="text-xs text-[#888888]">Research-backed outreach strategies for maximum conversion — tiered by prospect priority</p>
      </div>

      {/* Conversion Benchmarks */}
      <div className="mb-6">
        <h3 className="text-xs font-semibold text-[#F0EDE6] tracking-wide mb-3 flex items-center gap-2">
          <Zap className="w-3.5 h-3.5 text-[#c9a84c]" />
          Conversion Benchmarks
        </h3>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          {CONVERSION_BENCHMARKS.map((b, i) => (
            <div key={i} className="bg-[#141414] border border-[#2A2A2A] rounded-xl p-4 text-center hover:shadow-lg hover:-translate-y-0.5 transition-all">
              <div className="text-xl font-semibold text-[#c9a84c] tabular-nums">{b.value}</div>
              <div className="text-[10px] font-semibold text-[#666666] uppercase tracking-wider mt-1.5">{b.label}</div>
              <div className="text-[10px] text-[#888888] mt-1 leading-snug">{b.note}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Conversion Funnel */}
      <div className="mb-6">
        <h3 className="text-xs font-semibold text-[#F0EDE6] tracking-wide mb-1 flex items-center gap-2">
          <Target className="w-3.5 h-3.5 text-[#4d9a5a]" />
          Conversion Funnel
        </h3>
        <p className="text-[10px] text-[#666666] mb-3">Expected conversion rates at each stage of the B2B sales process</p>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2.5">
          {CONVERSION_FUNNEL.map((f, i) => (
            <div key={i} className="bg-[#141414] border border-[#2A2A2A] rounded-xl p-3.5 text-center relative">
              <div className="text-[10px] font-semibold uppercase tracking-wider text-[#666666] mb-1.5">{f.stage}</div>
              <div className="text-xl font-semibold text-[#c9a84c] tabular-nums">{f.conv}</div>
              <div className="text-[10px] text-[#888888] mt-1.5 leading-snug">{f.action}</div>
              <div className="text-[10px] text-[#666666] mt-1 leading-snug italic">{f.notes}</div>
              {i < CONVERSION_FUNNEL.length - 1 && (
                <div className="absolute -right-2 top-1/2 -translate-y-1/2 z-10 text-[#666666] hidden lg:block">
                  <ArrowRight className="w-3.5 h-3.5" />
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Outreach Sequences by Tier */}
      <div className="mb-6">
        <h3 className="text-xs font-semibold text-[#F0EDE6] tracking-wide mb-3 flex items-center gap-2">
          <BookOpen className="w-3.5 h-3.5 text-[#e8614a]" />
          Outreach Sequences by Tier
        </h3>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {PLAYBOOK_TIERS.map((tier, ti) => (
            <div key={ti} className="bg-[#141414] border border-[#2A2A2A] rounded-xl p-5">
              <div className={`text-[10px] font-semibold uppercase tracking-wider mb-2 ${tier.tierClass}`}>
                {tier.tier}
              </div>
              <div className="font-serif text-base font-semibold text-[#F0EDE6] mb-2">{tier.targets}</div>
              <div className="text-[11px] text-[#888888] mb-4 leading-relaxed">{tier.approach}</div>

              <div className="space-y-2.5 mb-4">
                {tier.sequence.map((step, si) => (
                  <SequenceStep key={si} step={step} tierIndex={ti} stepIndex={si} />
                ))}
              </div>

              <div className="border-t border-[#2A2A2A] pt-3">
                <div className="text-[10px] font-semibold uppercase tracking-wider text-[#666666] mb-2">Key Value Props</div>
                <div className="space-y-1.5">
                  {tier.valueProps.map((vp, vi) => (
                    <div key={vi} className="flex items-start gap-1.5 text-[11px] text-[#888888] leading-snug">
                      <span className="text-[#4d9a5a] shrink-0 text-[10px] mt-px">→</span>
                      {vp}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Best Practices */}
      <div>
        <h3 className="text-xs font-semibold text-[#F0EDE6] tracking-wide mb-3 flex items-center gap-2">
          <Star className="w-3.5 h-3.5 text-[#c9a84c]" />
          8 Best Practices
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {BEST_PRACTICES.map((bp, i) => (
            <div key={i} className="bg-[#141414] border border-[#2A2A2A] rounded-xl p-4 flex gap-3 hover:shadow-lg hover:-translate-y-0.5 transition-all">
              <div className="w-7 h-7 rounded-full bg-[#3d3018] text-[#c9a84c] text-xs font-bold flex items-center justify-center shrink-0">
                {i + 1}
              </div>
              <div>
                <div className="text-xs font-semibold text-[#F0EDE6] mb-1">{bp.practice}</div>
                <div className="text-[11px] text-[#888888] leading-relaxed">{bp.detail}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
