// Promo campaigns: named sets of boosted cards, each with its own card art and its own walkout,
// added to the pool from the day they go live. A campaign's card is a promo of a real season, made
// to the overall it's given (every rating lifted with it), so the players a campaign is about come
// out where it wants them, above their gold cards. To add one: a new entry in CAMPAIGNS (a theme
// with its art in styles.css, `.utc.th-<theme>`), and its launch shows once to every player.
//
// The first, Moments: the heroes of the games Flashbacks replays (src/ut/flashbacks.ts). A
// Flashback's first clear gives its hero's Moments card; they come in Premium packs too.
import { promoLift, rateCard } from './rate';
import type { CardLine, UtSport } from './types';

export interface CampaignCard {
  name: string;
  season: number;
  fr: string;
  /** the overall the card comes out at */
  ovr: number;
  /** what it's for, on the card */
  moment: string;
  /** the rating the moment was about: 10 more on top */
  perk?: string;
}

export interface Campaign {
  id: string;
  name: string;
  /** the card art and walkout: `th-<theme>` */
  theme: 'moments';
  /** live from this Eastern day */
  since: string;
  blurb: string;
  cards: Record<UtSport, CampaignCard[]>;
}

export const CAMPAIGNS: Campaign[] = [
  {
    id: 'moments',
    name: 'Moments',
    theme: 'moments',
    since: '2026-10-27',
    blurb: 'The players behind the games no one forgets, at their very best. Play the moments in Flashbacks; each one cleared brings its hero’s card.',
    cards: {
      nba: [
        { name: 'Tracy McGrady', season: 2005, fr: 'HOU', ovr: 97, moment: '13 in 33 seconds', perk: '3PT' },
        { name: 'Ray Allen', season: 2013, fr: 'MIA', ovr: 92, moment: 'The corner three', perk: '3PT' },
        { name: 'Michael Jordan', season: 1998, fr: 'CHI', ovr: 99, moment: 'The Last Shot', perk: 'MID' },
        { name: 'Kobe Bryant', season: 2006, fr: 'LAL', ovr: 99, moment: '81 points', perk: 'MID' },
        { name: 'Kyrie Irving', season: 2016, fr: 'CLE', ovr: 95, moment: 'Game 7, the shot', perk: '3PT' },
      ],
      nfl: [
        { name: 'Tom Brady', season: 2016, fr: 'NE', ovr: 99, moment: '28–3', perk: 'TUP' },
        { name: 'John Elway', season: 1986, fr: 'DEN', ovr: 97, moment: 'The Drive', perk: 'DAC' },
        { name: 'Joe Montana', season: 1988, fr: 'SF', ovr: 98, moment: 'The winning drive', perk: 'TUP' },
        { name: 'Eli Manning', season: 2007, fr: 'NYG', ovr: 96, moment: 'The helmet catch', perk: 'TUP' },
        { name: 'Patrick Mahomes', season: 2019, fr: 'KC', ovr: 98, moment: 'The comeback', perk: 'DAC' },
      ],
    },
  },
];

/** The Eastern day (YYYY-MM-DD) now. */
const today = () => new Date().toLocaleDateString('en-CA', { timeZone: 'America/New_York' });

export function liveCampaigns(day = today()): Campaign[] {
  return CAMPAIGNS.filter((c) => c.since <= day);
}

export const campaignOf = (id: string | undefined): Campaign | undefined => CAMPAIGNS.find((c) => c.id === id);

/** A campaign card's id: its season card's, the campaign after it. */
export const campaignCardId = (season: CardLine, c: Campaign) => season.id.replace(':season:', ':promo:') + ':' + c.id;

/**
 * The live campaigns' cards for this sport, made from their season lines: the boost that brings
 * each to its overall (rateCard lifts a promo's every rating with it).
 */
export function campaignLines(sport: UtSport, seasons: CardLine[], day = today()): CardLine[] {
  const out: CardLine[] = [];
  for (const c of liveCampaigns(day)) {
    for (const cc of c.cards[sport]) {
      const base = seasons.find((l) => l.kind === 'season' && l.name === cc.name && l.season === cc.season && l.fr === cc.fr);
      if (!base) continue;
      // (a season card's overall is already on the squeezed scale)
      const at = rateCard(base).ovr;
      // promoLift(boost) = the gap to the overall it's given
      const unit = promoLift(1, sport) - promoLift(0, sport);
      const boost = Math.max(1, Math.round((cc.ovr - at) / unit - promoLift(0, sport) / unit));
      out.push({ ...base, id: campaignCardId(base, c), kind: 'promo', boost, label: c.name, seasonId: base.id, campaign: c.id, moment: cc.moment, perk: cc.perk });
    }
  }
  return out;
}
