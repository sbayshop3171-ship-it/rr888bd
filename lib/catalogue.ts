/* ============================================================
   Game catalogue.

   GENERATED from the icon pack manifest
   (`game rate/icons/manifest.csv`) — every entry points at a real
   thumbnail under public/games/icons/<SECTION>/. Regenerate rather
   than hand-editing rows; the demo map at the bottom is hand-kept.

   Once an aggregator is licensed this is replaced by a Supabase
   `games` table with the same shape, so nothing above this layer
   has to change.
   ============================================================ */

import { CLIPS } from './clips';
import { TRIAL_GAMES, TRIAL_PROVIDER, trialArt, trialUrl } from './demo-library';

export type Tag = 'hot' | 'new' | 'top';

export interface Game {
  /** slug used in the URL: /casino/<slug> */
  id: string;
  name: string;
  provider: string;
  tag?: Tag;
  /** Tile artwork under public/games/. Omitted -> GameArt draws the tile. */
  thumb?: string;
  /** Aggregator game code — what a launch call is keyed on. */
  code?: string;
  /** The provider publishes a trial/fun mode for this game. */
  demo?: boolean;
}

export type CategoryKey =
  | 'hot' | 'sports' | 'live' | 'slot'
  | 'poker' | 'fish' | 'lottery' | 'jackpot';

/** Two games can share a name across providers, so the id is passed in
    explicitly by the generator instead of being derived here. */
const g = (
  name: string, provider: string, tag?: Tag, thumb?: string,
  id?: string, code?: string, demo = false,
): Game => ({
  id: id ?? name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''),
  name, provider, tag, thumb, code, demo,
});

/** hot 39, sports 18, live 30, slot 40, poker 32, fish 31, lottery 35, jackpot 20 */
export const CATALOGUE: Record<CategoryKey, Game[]> = {
  hot: [
    /* ---- The house's own games (hand-kept, not generated).
       They run on our engine in lib/mini-games.ts and open at /game/<id>,
       so they carry no provider code and need no aggregator. The order
       here is the order the home rail shows: Aviator, then ours. Tiles are
       drawn by GameArt from the id — deliberately no `thumb`, since the
       artwork for these is ours to make. ---- */
    g('Aviator', 'Spribe', 'hot', '/games/icons/CK44/aviator.webp', 'aviator', undefined, false),
    g('Crash', 'rr888bd', 'hot', undefined, 'crash', undefined, false),
    g('JetX', 'rr888bd', 'hot', undefined, 'jetx', undefined, false),
    g('Limbo', 'rr888bd', 'new', undefined, 'limbo', undefined, false),
    g('Dice', 'rr888bd', 'new', undefined, 'dice', undefined, false),
    g('Plinko', 'rr888bd', 'new', undefined, 'plinko', undefined, false),
    g('Coin Flip', 'rr888bd', 'new', undefined, 'coin-flip', undefined, false),
    g('Golden Ace', 'rr888bd', 'new', undefined, 'golden-ace', undefined, false),

    /* ---- The CK44 hot rail, tile for tile (hand-kept).
       Key art lives in public/games/icons/CK44/, converted from the pack the
       user supplied. No aggregator code yet, so these open the "coming soon"
       placeholder and `playableFirst` keeps them behind everything that
       actually runs — the artwork is here so the lobby reads right the day a
       contract is signed. ---- */
    g('Anubis Wrath', 'JILI', 'hot', '/games/icons/CK44/anubis-wrath.webp', 'anubis-wrath', undefined, false),
    g('Treasures of Aztec', 'PG Soft', 'hot', '/games/icons/CK44/treasures-of-aztec.webp', 'treasures-of-aztec', undefined, false),
    g('Circus Joker 4096', 'JILI', 'hot', '/games/icons/CK44/circus-joker-4096.webp', 'circus-joker-4096', undefined, false),
    g('Clover Coins 4x4', 'JILI', 'hot', '/games/icons/CK44/clover-coins-4x4.webp', 'clover-coins-4x4', undefined, false),
    g('Coin UP: Lightning', 'Booongo', 'hot', '/games/icons/CK44/coin-up-lightning.webp', 'coin-up-lightning', undefined, false),
    g('Coin UP: Hot Fire 3x3', 'Booongo', 'hot', '/games/icons/CK44/coin-up-hot-fire.webp', 'coin-up-hot-fire', undefined, false),
    g('9 Wickets', 'JILI', 'hot', '/games/icons/CK44/9-wickets.webp', '9-wickets', undefined, false),
    g('FlyX', 'Microgaming', 'hot', '/games/icons/CK44/flyx.webp', 'flyx', undefined, false),
    g('FlyX Cash Turbo', 'Microgaming', 'hot', '/games/icons/CK44/flyx-cash-turbo.webp', 'flyx-cash-turbo', undefined, false),
    g('Fortune Coins 2', 'JILI', 'hot', '/games/icons/CK44/fortune-coins-2.webp', 'fortune-coins-2', undefined, false),
    g('Fortune Gems 3', 'JILI', 'hot', '/games/icons/CK44/fortune-gems-3.webp', 'fortune-gems-3', undefined, false),
    g('Fruity Bonanza', 'JILI', 'hot', '/games/icons/CK44/fruity-bonanza.webp', 'fruity-bonanza', undefined, false),
    g('Funky Time', 'Evolution', 'hot', '/games/icons/CK44/funky-time.webp', 'funky-time', undefined, false),
    g('Queen of Inca', 'JILI', 'hot', '/games/icons/CK44/queen-of-inca.webp', 'queen-of-inca', undefined, false),
    g('Jackpot Joker', 'JILI', 'hot', '/games/icons/CK44/jackpot-joker.webp', 'jackpot-joker', undefined, false),
    g('Jackpot Joker Fever', 'JILI', 'hot', '/games/icons/CK44/jackpot-joker-fever.webp', 'jackpot-joker-fever', undefined, false),
    g('Magic Ace Wild Lock', 'JILI', 'hot', '/games/icons/CK44/magic-ace-wild-lock.webp', 'magic-ace-wild-lock', undefined, false),
    g('Mighty Sevens', 'JILI', 'hot', '/games/icons/CK44/mighty-sevens.webp', 'mighty-sevens', undefined, false),
    g('Money Pot', 'JILI', 'hot', '/games/icons/CK44/money-pot.webp', 'money-pot', undefined, false),
    g('Pinata Wins', 'PG Soft', 'hot', '/games/icons/CK44/pinata-wins.webp', 'pinata-wins', undefined, false),
    g('Pirate Legends', 'Yellow Bat', 'hot', '/games/icons/CK44/pirate-legends.webp', 'pirate-legends', undefined, false),
    g('Egypt Power x1000', 'Booongo', 'hot', '/games/icons/CK44/egypt-power-1000.webp', 'egypt-power-1000', undefined, false),
    g('Sugar Bang Bang 2', 'JILI', 'hot', '/games/icons/CK44/sugar-bang-bang-2.webp', 'sugar-bang-bang-2', undefined, false),
    g('Super Ace', 'JILI', 'hot', '/games/icons/CK44/super-ace.webp', 'super-ace', undefined, false),
    g('Super Elements', 'JILI', 'hot', '/games/icons/CK44/super-elements.webp', 'super-elements', undefined, false),
    g('Wild Bounty Showdown', 'PG Soft', 'hot', '/games/icons/CK44/wild-bounty-showdown.webp', 'wild-bounty-showdown', undefined, false),
    g('3 Charge Buffalo', 'JILI', 'hot', '/games/icons/HOT/JILI__3-Charge-Buffalo.avif', '3-charge-buffalo', '1185', true),
    g('Bikini Paradise', 'PG Soft', 'hot', '/games/icons/HOT/PG-Soft__Bikini-Paradise.avif', 'bikini-paradise', '102', true),
    g('Beer Tycoon', 'JDB', 'hot', '/games/icons/HOT/JDB__Beer-Tycoon.avif', 'beer-tycoon', '817', true),
    g('Animal Racing', 'FaChai', 'hot', '/games/icons/HOT/FaChai__ANIMAL-RACING.avif', 'animal-racing', '1342', true),
    g('Apollo Pays', 'Big Time Gaming', 'hot', '/games/icons/HOT/Big-Time-Gaming__Apollo-Pays.avif', 'apollo-pays', '5878', true),
    g('Advent of the Dragon', 'Live22', 'hot', '/games/icons/HOT/Live22__Advent-of-the-Dragon.png', 'advent-of-the-dragon', '12995', false),
    g('10,001 Nights Megaways', 'Red Tiger', 'hot', '/games/icons/HOT/Red-Tiger__10-001-Nights-Megaways.avif', '10-001-nights-megaways', '23700', true),
    g('Big Bass Amazon Xtreme', 'Pragmatic Play', 'hot', '/games/icons/HOT/Pragmatic-Play__Big-Bass-Amazon-Xtreme.avif', 'big-bass-amazon-xtreme', '21876', true),
    g('Ace Round', 'Evoplay', 'hot', '/games/icons/HOT/Evoplay__Ace-Round.avif', 'ace-round-evoplay', '1242', false),
    g('Ace Round', 'Evoplay', 'hot', '/games/icons/HOT/Evoplay__Ace-Round-2.avif', 'ace-round-evoplay-2', '20722', false),
    g('Avia Fly 2', 'InOut', 'hot', '/games/icons/HOT/InOut__Avia-Fly-2.avif', 'avia-fly-2', '10071', true),
    g('Atlantis', 'Yellow Bat', 'hot', '/games/icons/HOT/Yellow-Bat__ATLANTIS.png', 'atlantis', '13277', false),
    g('Adventure Of Sinbad', 'Eazy Gaming', 'hot', '/games/icons/HOT/Eazy-Gaming__Adventure-Of-Sinbad.avif', 'adventure-of-sinbad', '5812', false),
    g('1Tap Mines', 'Turbo Games', 'hot', '/games/icons/HOT/Turbo-Games__1Tap-Mines.avif', '1tap-mines', '7293', true),
    g('1000 Olympus Rivals', 'Amigo', 'hot', '/games/icons/HOT/Amigo__1000-Olympus-Rivals.avif', '1000-olympus-rivals', '10020', false),
    g('LuckSportGaming', 'Lucky Sport', 'hot', '/games/icons/HOT/Lucky-Sport__LuckSportGaming.avif', 'lucksportgaming', '7004', false),
    g('Balloon', 'Spribe', 'hot', '/games/icons/HOT/Spribe__Balloon.avif', 'balloon', '1019', true),
    g('3 Lucky Piggy', 'JILI', 'hot', '/games/icons/HOT/JILI__3-Lucky-Piggy.avif', '3-lucky-piggy', '1026', true),
    g('Candy Burst', 'PG Soft', 'hot', '/games/icons/HOT/PG-Soft__Candy-Burst.avif', 'candy-burst', '172', true),
    g('Big Three Dragons', 'JDB', 'hot', '/games/icons/HOT/JDB__Big-Three-Dragons.avif', 'big-three-dragons', '438', true),
    g('Bao Chuan Fishing', 'FaChai', 'hot', '/games/icons/HOT/FaChai__BAO-CHUAN-FISHING.avif', 'bao-chuan-fishing', '1413', true),
    g('Beef Lightning', 'Big Time Gaming', 'hot', '/games/icons/HOT/Big-Time-Gaming__Beef-Lightning.avif', 'beef-lightning', '5885', false),
    g('Apes Squad', 'Live22', 'hot', '/games/icons/HOT/Live22__Apes-Squad.png', 'apes-squad', '12987', false),
    g('10001 Nights', 'Red Tiger', 'hot', '/games/icons/HOT/Red-Tiger__10001-Nights.avif', '10001-nights', '23607', false),
    g('Big Bass Bonanza', 'Pragmatic Play', 'hot', '/games/icons/HOT/Pragmatic-Play__Big-Bass-Bonanza.avif', 'big-bass-bonanza', '22050', true),
    g('AviaFly', 'InOut', 'hot', '/games/icons/HOT/InOut__AviaFly.avif', 'aviafly', '1373', true),
    g('Beasty Bingo', 'Yellow Bat', 'hot', '/games/icons/HOT/Yellow-Bat__BEASTY-BINGO.png', 'beasty-bingo', '13275', false),
    g('Gates of Olympus', 'Pragmatic Play', 'hot', '/games/icons/PRAGMATIC/Pragmatic-Play__Gates-of-Olympus.png', 'gates-of-olympus', undefined, true),
    g('Gates of Olympus 1000', 'Pragmatic Play', 'hot', '/games/icons/PRAGMATIC/Pragmatic-Play__Gates-of-Olympus-1000.png', 'gates-of-olympus-1000', undefined, true),
    g('Sweet Bonanza', 'Pragmatic Play', 'hot', '/games/icons/PRAGMATIC/Pragmatic-Play__Sweet-Bonanza.png', 'sweet-bonanza', undefined, true),
    g('Sweet Bonanza 1000', 'Pragmatic Play', 'hot', '/games/icons/PRAGMATIC/Pragmatic-Play__Sweet-Bonanza-1000.png', 'sweet-bonanza-1000', undefined, true),
    g('Sugar Rush', 'Pragmatic Play', 'hot', '/games/icons/PRAGMATIC/Pragmatic-Play__Sugar-Rush.png', 'sugar-rush', undefined, true),
    g('Starlight Princess', 'Pragmatic Play', 'hot', '/games/icons/PRAGMATIC/Pragmatic-Play__Starlight-Princess.png', 'starlight-princess', undefined, true),
    g('The Dog House', 'Pragmatic Play', 'hot', '/games/icons/PRAGMATIC/Pragmatic-Play__The-Dog-House.png', 'the-dog-house', undefined, true),
    g('Wolf Gold', 'Pragmatic Play', 'hot', '/games/icons/PRAGMATIC/Pragmatic-Play__Wolf-Gold.png', 'wolf-gold', undefined, true),
    g('Wild West Gold', 'Pragmatic Play', 'hot', '/games/icons/PRAGMATIC/Pragmatic-Play__Wild-West-Gold.png', 'wild-west-gold', undefined, true),

    /* ---- Eighteen more Pragmatic titles that open on the studio's own demo
       host. Same deal as the block above: no operator account, no token, so
       a tap is a real spin rather than a placeholder. Each symbol below was
       fetched once before being listed — a wrong one answers "an error has
       occurred" instead of rendering. ---- */
    g('Fruit Party', 'Pragmatic Play', 'hot', '/games/icons/PRAGMATIC/fruit-party.webp', 'fruit-party', undefined, true),
    g('Great Rhino Megaways', 'Pragmatic Play', 'hot', '/games/icons/PRAGMATIC/great-rhino-megaways.webp', 'great-rhino-megaways', undefined, true),
    g('Buffalo King Megaways', 'Pragmatic Play', 'hot', '/games/icons/PRAGMATIC/buffalo-king-megaways.webp', 'buffalo-king-megaways', undefined, true),
    g('Release the Kraken', 'Pragmatic Play', 'hot', '/games/icons/PRAGMATIC/release-the-kraken.webp', 'release-the-kraken', undefined, true),
    g('Madame Destiny', 'Pragmatic Play', 'hot', '/games/icons/PRAGMATIC/madame-destiny.webp', 'madame-destiny', undefined, true),
    g('Power of Thor Megaways', 'Pragmatic Play', 'hot', '/games/icons/PRAGMATIC/power-of-thor-megaways.webp', 'power-of-thor-megaways', undefined, true),
    g('Fire Strike', 'Pragmatic Play', 'hot', '/games/icons/PRAGMATIC/fire-strike.webp', 'fire-strike', undefined, true),
    g('Mustang Gold', 'Pragmatic Play', 'hot', '/games/icons/PRAGMATIC/mustang-gold.webp', 'mustang-gold', undefined, true),
    g('Aztec Gems', 'Pragmatic Play', 'hot', '/games/icons/PRAGMATIC/aztec-gems.webp', 'aztec-gems', undefined, true),
    g('5 Lions Megaways', 'Pragmatic Play', 'hot', '/games/icons/PRAGMATIC/5-lions-megaways.webp', '5-lions-megaways', undefined, true),
    g('Hot Fiesta', 'Pragmatic Play', 'hot', '/games/icons/PRAGMATIC/hot-fiesta.webp', 'hot-fiesta', undefined, true),
    g('Juicy Fruits', 'Pragmatic Play', 'hot', '/games/icons/PRAGMATIC/juicy-fruits.webp', 'juicy-fruits', undefined, true),
    g('Gems Bonanza', 'Pragmatic Play', 'hot', '/games/icons/PRAGMATIC/gems-bonanza.webp', 'gems-bonanza', undefined, true),
    g('The Hand of Midas', 'Pragmatic Play', 'hot', '/games/icons/PRAGMATIC/the-hand-of-midas.webp', 'the-hand-of-midas', undefined, true),
    g('Wisdom of Athena', 'Pragmatic Play', 'hot', '/games/icons/PRAGMATIC/wisdom-of-athena.webp', 'wisdom-of-athena', undefined, true),
    g('Chilli Heat', 'Pragmatic Play', 'hot', '/games/icons/PRAGMATIC/chilli-heat.webp', 'chilli-heat', undefined, true),
    g('Zeus vs Hades - Gods of War', 'Pragmatic Play', 'hot', '/games/icons/PRAGMATIC/zeus-vs-hades-gods-of-war.webp', 'zeus-vs-hades-gods-of-war', undefined, true),
    g('Curse of the Werewolf Megaways', 'Pragmatic Play', 'hot', '/games/icons/PRAGMATIC/curse-of-the-werewolf-megaways.webp', 'curse-of-the-werewolf-megaways', undefined, true),
    g('Bounty Hunter', 'Pragmatic Play', 'hot', '/games/icons/FISH/Pragmatic-Play__Bounty-Hunter.avif', 'bounty-hunter', undefined, true),
    g('Fishin\' Reels', 'Pragmatic Play', 'hot', '/games/icons/FISH/Pragmatic-Play__Fishin-Reels.avif', 'fishin-reels', undefined, true),
  ],
  sports: [
    g('Animal Racing', 'FaChai', 'hot', '/games/icons/HOT/FaChai__ANIMAL-RACING.avif', 'animal-racing', '1342', true),
    g('LuckSportGaming', 'Lucky Sport', 'hot', '/games/icons/HOT/Lucky-Sport__LuckSportGaming.avif', 'lucksportgaming', '7004', false),
    g('Cricket King 18', 'JILI', undefined, '/games/icons/SPORTS/JILI__Cricket-King-18.avif', 'cricket-king-18', '1014', true),
    g('Shaolin Soccer', 'PG Soft', undefined, '/games/icons/SPORTS/PG-Soft__Shaolin-Soccer.avif', 'shaolin-soccer', '999', true),
    g('KingOfFootball', 'JDB', undefined, '/games/icons/SPORTS/JDB__KingOfFootball.avif', 'kingoffootball', '283', true),
    g('Macau Racing', 'Red Tiger', undefined, '/games/icons/SPORTS/Red-Tiger__Macau-Racing.avif', 'macau-racing', '8528', false),
    g('1st Cricket League', 'Amigo', 'hot', '/games/icons/SPORTS/Amigo__1st-Cricket-League.avif', '1st-cricket-league', '10016', false),
    g('Cricket Road', 'InOut', undefined, '/games/icons/SPORTS/InOut__Cricket-Road.avif', 'cricket-road', '10064', true),
    g('Basketball', 'Evoplay', undefined, '/games/icons/SPORTS/Evoplay__Basketball.avif', 'basketball-evoplay', '1420', false),
    g('Basketball', 'Evoplay', undefined, '/games/icons/SPORTS/Evoplay__Basketball-2.avif', 'basketball-evoplay-2', '20736', false),
    g('Cricket Boom', 'Turbo Games', 'hot', '/games/icons/SPORTS/Turbo-Games__Cricket-Boom.avif', 'cricket-boom', '7302', true),
    g('Cricket Sah 75', 'JILI', undefined, '/games/icons/SPORTS/JILI__Cricket-Sah-75.avif', 'cricket-sah-75', '462', true),
    g('Cricket War', 'JILI', undefined, '/games/icons/SPORTS/JILI__Cricket-War.avif', 'cricket-war', '764', true),
    g('Football', 'Evoplay', undefined, '/games/icons/SPORTS/Evoplay__Football.jpg', 'football', '2245', false),
    g('Football Bet', 'Evoplay', undefined, '/games/icons/SPORTS/Evoplay__Football-Bet.jpg', 'football-bet', '2247', false),
    g('Football Manager', 'Evoplay', undefined, '/games/icons/SPORTS/Evoplay__Football-Manager.jpg', 'football-manager', '2250', false),
    g('Hercules: Sports Legend', 'Evoplay', undefined, '/games/icons/SPORTS/Evoplay__Hercules-Sports-Legend.png', 'hercules-sports-legend', '10429', false),
    g('Soccer Solo Striker', 'Evoplay', undefined, '/games/icons/SPORTS/Evoplay__Soccer-Solo-Striker.jpg', 'soccer-solo-striker', '3848', false),
  ],
  live: [
    g('Crazy Time', 'Evolution', 'hot', '/games/icons/CK44/crazy-time.webp', 'crazy-time', '22870', false),
    g('Andar Bahar', 'JILI', undefined, '/games/icons/LIVE-CASINO/JILI__Andar-Bahar.avif', 'andar-bahar', '505', true),
    g('Baccarat Deluxe', 'PG Soft', undefined, '/games/icons/LIVE-CASINO/PG-Soft__Baccarat-Deluxe.avif', 'baccarat-deluxe', '145', true),
    g('Dragon Tiger - Joker Bonus', 'JDB', undefined, '/games/icons/LIVE-CASINO/JDB__Dragon-Tiger---Joker-Bonus.avif', 'dragon-tiger-joker-bonus', '28', true),
    g('Mini Roulette', 'Spribe', 'hot', '/games/icons/LIVE-CASINO/Spribe__Mini-Roulette.avif', 'mini-roulette', '723', true),
    g('Classic Blackjack', 'Red Tiger', undefined, '/games/icons/LIVE-CASINO/Red-Tiger__Classic-Blackjack.avif', 'classic-blackjack', '23693', true),
    g('Dragon Bonus Baccarat', 'Pragmatic Play', undefined, '/games/icons/LIVE-CASINO/Pragmatic-Play__Dragon-Bonus-Baccarat.png', 'dragon-bonus-baccarat', '5550', true),
    g('American Roulette 3D', 'Evoplay', undefined, '/games/icons/LIVE-CASINO/Evoplay__American-Roulette-3D.avif', 'american-roulette-3d-evoplay', '1322', false),
    g('Roulette', 'InOut', undefined, '/games/icons/LIVE-CASINO/InOut__Roulette.avif', 'roulette-inout', '10049', true),
    g('Baccarat', 'JILI', undefined, '/games/icons/LIVE-CASINO/JILI__Baccarat.avif', 'baccarat-jili', '855', true),
    g('Dragon Tiger Luck', 'PG Soft', 'hot', '/games/icons/LIVE-CASINO/PG-Soft__Dragon-Tiger-Luck.avif', 'dragon-tiger-luck', '272', true),
    g('European Roulette', 'Red Tiger', undefined, '/games/icons/LIVE-CASINO/Red-Tiger__European-Roulette.avif', 'european-roulette-red-tiger', '8426', true),
    g('European Roulette', 'JILI', undefined, '/games/icons/LIVE-CASINO/JILI__European-Roulette.avif', 'european-roulette-jili', '970', true),
    g('Dragon Tiger Fortunes', 'Pragmatic Play', undefined, '/games/icons/LIVE-CASINO/Pragmatic-Play__Dragon-Tiger-Fortunes.jpg', 'dragon-tiger-fortunes', '22237', true),
    g('Baccarat 777', 'Evoplay', undefined, '/games/icons/LIVE-CASINO/Evoplay__Baccarat-777.avif', 'baccarat-777-evoplay', '1402', false),
    g('Blackjack', 'JILI', undefined, '/games/icons/LIVE-CASINO/JILI__Blackjack.avif', 'blackjack', '267', true),
    g('The Dragon Tiger', 'Pragmatic Play', undefined, '/games/icons/LIVE-CASINO/Pragmatic-Play__The-Dragon-Tiger.png', 'the-dragon-tiger', '22057', true),
    g('BlackJack Lucky Sevens', 'Evoplay', undefined, '/games/icons/LIVE-CASINO/Evoplay__BlackJack-Lucky-Sevens.avif', 'blackjack-lucky-sevens-evoplay', '1492', false),
    g('Blackjack Lucky Ladies', 'JILI', undefined, '/games/icons/LIVE-CASINO/JILI__Blackjack-Lucky-Ladies.avif', 'blackjack-lucky-ladies', '951', true),
    g('Cricket Roulette', 'JILI', undefined, '/games/icons/LIVE-CASINO/JILI__Cricket-Roulette.avif', 'cricket-roulette', '842', true),
    g('Fortune Roulette', 'JILI', undefined, '/games/icons/LIVE-CASINO/JILI__Fortune-Roulette.avif', 'fortune-roulette', '607', true),
    g('Sic Bo', 'JILI', undefined, '/games/icons/LIVE-CASINO/JILI__Sic-Bo.avif', 'sic-bo', '1017', true),
    g('Speed Baccarat', 'JILI', undefined, '/games/icons/LIVE-CASINO/JILI__Speed-Baccarat.avif', 'speed-baccarat', '727', false),
    g('Always 9 Baccarat', 'Evolution', undefined, '/games/icons/LIVE-CASINO/Evolution__Always-9-Baccarat.png', 'always-9-baccarat', '15074', false),
    g('American Roulette', 'Evolution', undefined, '/games/icons/LIVE-CASINO/Evolution__American-Roulette.png', 'american-roulette', '22858', false),
    g('Auto Lightning Roulette', 'Evolution', undefined, '/games/icons/LIVE-CASINO/Evolution__Auto-Lightning-Roulette.png', 'auto-lightning-roulette', '8190', false),
    g('Auto-Roulette', 'Evolution', undefined, '/games/icons/LIVE-CASINO/Evolution__Auto-Roulette.png', 'auto-roulette', '22854', false),
    g('Auto-Roulette VIP', 'Evolution', undefined, '/games/icons/LIVE-CASINO/Evolution__Auto-Roulette-VIP.png', 'auto-roulette-vip', '6316', false),
    g('Penalty Roulette', 'Evoplay', undefined, '/games/icons/LIVE-CASINO/Evoplay__Penalty-Roulette.jpg', 'penalty-roulette', '3404', false),
    g('2 Hand Casino Hold\'em', 'Evolution', undefined, '/games/icons/LIVE-CASINO/Evolution__2-Hand-Casino-Hold-em.png', '2-hand-casino-hold-em', '22874', false),
  ],
  slot: [
    /* the house's own slot — it runs on our engine (lib/slots.ts) and opens
       at /game/golden-ace, so it leads the rail rather than sitting behind
       tiles that are still waiting on a licence */
    g('Golden Ace', 'rr888bd', 'new', undefined, 'golden-ace', undefined, false),
    g('Beer Tycoon', 'JDB', 'hot', '/games/icons/HOT/JDB__Beer-Tycoon.avif', 'beer-tycoon', '817', true),
    g('Apollo Pays', 'Big Time Gaming', 'hot', '/games/icons/HOT/Big-Time-Gaming__Apollo-Pays.avif', 'apollo-pays', '5878', true),
    g('Advent of the Dragon', 'Live22', 'hot', '/games/icons/HOT/Live22__Advent-of-the-Dragon.png', 'advent-of-the-dragon', '12995', false),
    g('10,001 Nights Megaways', 'Red Tiger', 'hot', '/games/icons/HOT/Red-Tiger__10-001-Nights-Megaways.avif', '10-001-nights-megaways', '23700', true),
    g('Ace Round', 'Evoplay', 'hot', '/games/icons/HOT/Evoplay__Ace-Round.avif', 'ace-round-evoplay', '1242', false),
    g('Ace Round', 'Evoplay', 'hot', '/games/icons/HOT/Evoplay__Ace-Round-2.avif', 'ace-round-evoplay-2', '20722', false),
    g('Avia Fly 2', 'InOut', 'hot', '/games/icons/HOT/InOut__Avia-Fly-2.avif', 'avia-fly-2', '10071', true),
    g('Atlantis', 'Yellow Bat', 'hot', '/games/icons/HOT/Yellow-Bat__ATLANTIS.png', 'atlantis', '13277', false),
    g('Adventure Of Sinbad', 'Eazy Gaming', 'hot', '/games/icons/HOT/Eazy-Gaming__Adventure-Of-Sinbad.avif', 'adventure-of-sinbad', '5812', false),
    g('1000 Olympus Rivals', 'Amigo', 'hot', '/games/icons/HOT/Amigo__1000-Olympus-Rivals.avif', '1000-olympus-rivals', '10020', false),
    g('Big Three Dragons', 'JDB', 'hot', '/games/icons/HOT/JDB__Big-Three-Dragons.avif', 'big-three-dragons', '438', true),
    g('Beef Lightning', 'Big Time Gaming', 'hot', '/games/icons/HOT/Big-Time-Gaming__Beef-Lightning.avif', 'beef-lightning', '5885', false),
    g('Apes Squad', 'Live22', 'hot', '/games/icons/HOT/Live22__Apes-Squad.png', 'apes-squad', '12987', false),
    g('10001 Nights', 'Red Tiger', 'hot', '/games/icons/HOT/Red-Tiger__10001-Nights.avif', '10001-nights', '23607', false),
    g('AviaFly', 'InOut', 'hot', '/games/icons/HOT/InOut__AviaFly.avif', 'aviafly', '1373', true),
    g('10 Sparkling Crown', 'JILI', undefined, '/games/icons/SLOTS/JILI__10-Sparkling-Crown.avif', '10-sparkling-crown', '10035', true),
    g('Alchemy Gold', 'PG Soft', undefined, '/games/icons/SLOTS/PG-Soft__Alchemy-Gold.avif', 'alchemy-gold', '701', true),
    g('Hotline', 'Spribe', 'hot', '/games/icons/SLOTS/Spribe__Hotline.avif', 'hotline', '826', true),
    g('Chilihuahua', 'FaChai', 'hot', '/games/icons/SLOTS/FaChai__CHILIHUAHUA.avif', 'chilihuahua', '1730', true),
    g('3 Buzzing Wilds', 'Pragmatic Play', undefined, '/games/icons/SLOTS/Pragmatic-Play__3-Buzzing-Wilds.avif', '3-buzzing-wilds', '21870', true),
    g('Aero', 'Turbo Games', 'hot', '/games/icons/SLOTS/Turbo-Games__Aero.avif', 'aero', '7290', true),
    g('20 Blazing Clover', 'JILI', undefined, '/games/icons/SLOTS/JILI__20-Blazing-Clover.avif', '20-blazing-clover', '10515', true),
    g('Alibaba\'s Cave of Fortune', 'PG Soft', undefined, '/games/icons/SLOTS/PG-Soft__Alibaba-039-s-Cave-of-Fortune.avif', 'alibaba-s-cave-of-fortune', '10126', true),
    g('Trader', 'Spribe', undefined, '/games/icons/SLOTS/Spribe__Trader.avif', 'trader', '5808', true),
    g('Chinese New Year', 'FaChai', 'hot', '/games/icons/CK44/chinese-new-year.webp', 'chinese-new-year', '1739', true),
    g('3 Dancing Monkeys', 'Pragmatic Play', undefined, '/games/icons/SLOTS/Pragmatic-Play__3-Dancing-Monkeys.avif', '3-dancing-monkeys', '21896', true),
    g('Boom Boom Marmot', 'Yellow Bat', 'hot', '/games/icons/SLOTS/Yellow-Bat__BOOM-BOOM-MARMOT.png', 'boom-boom-marmot', '13248', false),
    g('Beauty SPA', 'Eazy Gaming', 'hot', '/games/icons/SLOTS/Eazy-Gaming__Beauty-SPA.avif', 'beauty-spa', '5824', false),
    g('1001 Fruit Wishes', 'Amigo', 'hot', '/games/icons/SLOTS/Amigo__1001-Fruit-Wishes.avif', '1001-fruit-wishes', '10021', false),
    g('Bubbles', 'Turbo Games', 'hot', '/games/icons/SLOTS/Turbo-Games__Bubbles.avif', 'bubbles', '7289', false),
    g('Evolution Lobby', 'Evolution', undefined, '/games/icons/SLOTS/Evolution__Evolution-Lobby.png', 'evolution-lobby', '23080', false),
    g('Gates of Olympus', 'Pragmatic Play', 'hot', '/games/icons/PRAGMATIC/Pragmatic-Play__Gates-of-Olympus.png', 'gates-of-olympus', undefined, true),
    g('Gates of Olympus 1000', 'Pragmatic Play', 'hot', '/games/icons/PRAGMATIC/Pragmatic-Play__Gates-of-Olympus-1000.png', 'gates-of-olympus-1000', undefined, true),
    g('Sweet Bonanza', 'Pragmatic Play', 'hot', '/games/icons/PRAGMATIC/Pragmatic-Play__Sweet-Bonanza.png', 'sweet-bonanza', undefined, true),
    g('Sweet Bonanza 1000', 'Pragmatic Play', 'hot', '/games/icons/PRAGMATIC/Pragmatic-Play__Sweet-Bonanza-1000.png', 'sweet-bonanza-1000', undefined, true),
    g('Sugar Rush', 'Pragmatic Play', 'hot', '/games/icons/PRAGMATIC/Pragmatic-Play__Sugar-Rush.png', 'sugar-rush', undefined, true),
    g('Starlight Princess', 'Pragmatic Play', 'hot', '/games/icons/PRAGMATIC/Pragmatic-Play__Starlight-Princess.png', 'starlight-princess', undefined, true),
    g('The Dog House', 'Pragmatic Play', 'hot', '/games/icons/PRAGMATIC/Pragmatic-Play__The-Dog-House.png', 'the-dog-house', undefined, true),
    g('Wolf Gold', 'Pragmatic Play', 'hot', '/games/icons/PRAGMATIC/Pragmatic-Play__Wolf-Gold.png', 'wolf-gold', undefined, true),
    g('Wild West Gold', 'Pragmatic Play', 'hot', '/games/icons/PRAGMATIC/Pragmatic-Play__Wild-West-Gold.png', 'wild-west-gold', undefined, true),

    /* ---- The same eighteen, listed here too: they are slots, and the Slots tab is
       where a player goes looking for them. The catalogue already carries
       Gates of Olympus in both rails for the same reason. ---- */
    g('Fruit Party', 'Pragmatic Play', 'hot', '/games/icons/PRAGMATIC/fruit-party.webp', 'fruit-party', undefined, true),
    g('Great Rhino Megaways', 'Pragmatic Play', 'hot', '/games/icons/PRAGMATIC/great-rhino-megaways.webp', 'great-rhino-megaways', undefined, true),
    g('Buffalo King Megaways', 'Pragmatic Play', 'hot', '/games/icons/PRAGMATIC/buffalo-king-megaways.webp', 'buffalo-king-megaways', undefined, true),
    g('Release the Kraken', 'Pragmatic Play', 'hot', '/games/icons/PRAGMATIC/release-the-kraken.webp', 'release-the-kraken', undefined, true),
    g('Madame Destiny', 'Pragmatic Play', 'hot', '/games/icons/PRAGMATIC/madame-destiny.webp', 'madame-destiny', undefined, true),
    g('Power of Thor Megaways', 'Pragmatic Play', 'hot', '/games/icons/PRAGMATIC/power-of-thor-megaways.webp', 'power-of-thor-megaways', undefined, true),
    g('Fire Strike', 'Pragmatic Play', 'hot', '/games/icons/PRAGMATIC/fire-strike.webp', 'fire-strike', undefined, true),
    g('Mustang Gold', 'Pragmatic Play', 'hot', '/games/icons/PRAGMATIC/mustang-gold.webp', 'mustang-gold', undefined, true),
    g('Aztec Gems', 'Pragmatic Play', 'hot', '/games/icons/PRAGMATIC/aztec-gems.webp', 'aztec-gems', undefined, true),
    g('5 Lions Megaways', 'Pragmatic Play', 'hot', '/games/icons/PRAGMATIC/5-lions-megaways.webp', '5-lions-megaways', undefined, true),
    g('Hot Fiesta', 'Pragmatic Play', 'hot', '/games/icons/PRAGMATIC/hot-fiesta.webp', 'hot-fiesta', undefined, true),
    g('Juicy Fruits', 'Pragmatic Play', 'hot', '/games/icons/PRAGMATIC/juicy-fruits.webp', 'juicy-fruits', undefined, true),
    g('Gems Bonanza', 'Pragmatic Play', 'hot', '/games/icons/PRAGMATIC/gems-bonanza.webp', 'gems-bonanza', undefined, true),
    g('The Hand of Midas', 'Pragmatic Play', 'hot', '/games/icons/PRAGMATIC/the-hand-of-midas.webp', 'the-hand-of-midas', undefined, true),
    g('Wisdom of Athena', 'Pragmatic Play', 'hot', '/games/icons/PRAGMATIC/wisdom-of-athena.webp', 'wisdom-of-athena', undefined, true),
    g('Chilli Heat', 'Pragmatic Play', 'hot', '/games/icons/PRAGMATIC/chilli-heat.webp', 'chilli-heat', undefined, true),
    g('Zeus vs Hades - Gods of War', 'Pragmatic Play', 'hot', '/games/icons/PRAGMATIC/zeus-vs-hades-gods-of-war.webp', 'zeus-vs-hades-gods-of-war', undefined, true),
    g('Curse of the Werewolf Megaways', 'Pragmatic Play', 'hot', '/games/icons/PRAGMATIC/curse-of-the-werewolf-megaways.webp', 'curse-of-the-werewolf-megaways', undefined, true),
    g('Bounty Hunter', 'Pragmatic Play', 'hot', '/games/icons/FISH/Pragmatic-Play__Bounty-Hunter.avif', 'bounty-hunter', undefined, true),
    g('Fishin\' Reels', 'Pragmatic Play', 'hot', '/games/icons/FISH/Pragmatic-Play__Fishin-Reels.avif', 'fishin-reels', undefined, true),
  ],
  poker: [
    g('American Roulette 3D', 'Evoplay', undefined, '/games/icons/POKER/Evoplay__American-Roulette-3D.avif', 'american-roulette-3d-evoplay-2', '20720', false),
    g('Roulette', 'Pragmatic Play', undefined, '/games/icons/POKER/Pragmatic-Play__Roulette.avif', 'roulette-pragmatic-play', '22167', true),
    g('Baccarat', 'Pragmatic Play', undefined, '/games/icons/POKER/Pragmatic-Play__Baccarat.avif', 'baccarat-pragmatic-play', '22120', true),
    g('Baccarat 777', 'Evoplay', undefined, '/games/icons/POKER/Evoplay__Baccarat-777.avif', 'baccarat-777-evoplay-2', '20744', false),
    g('BlackJack Lucky Sevens', 'Evoplay', undefined, '/games/icons/POKER/Evoplay__BlackJack-Lucky-Sevens.avif', 'blackjack-lucky-sevens-evoplay-2', '20719', false),
    g('Amar Akbar Anthony', 'JILI', undefined, '/games/icons/POKER/JILI__Amar-Akbar-Anthony.png', 'amar-akbar-anthony', '10517', true),
    g('Poker Kingdom Win', 'PG Soft', undefined, '/games/icons/POKER/PG-Soft__Poker-Kingdom-Win.avif', 'poker-kingdom-win', '10124', true),
    g('Hilo', 'JDB', undefined, '/games/icons/POKER/JDB__Hilo.avif', 'hilo-jdb', '734', true),
    g('Hilo', 'JILI', undefined, '/games/icons/POKER/JILI__HILO.avif', 'hilo-jili', '875', true),
    g('Hi Lo', 'Spribe', 'hot', '/games/icons/POKER/Spribe__Hi-Lo.avif', 'hi-lo', '775', true),
    g('American Blackjack', 'Pragmatic Play', undefined, '/games/icons/POKER/Pragmatic-Play__American-Blackjack.avif', 'american-blackjack', '22132', true),
    g('Crystal Poker', 'Turbo Games', undefined, '/games/icons/POKER/Turbo-Games__Crystal-Poker.avif', 'crystal-poker', '7296', true),
    g('Joker Poker', 'InOut', undefined, '/games/icons/POKER/InOut__Joker-Poker.avif', 'joker-poker', '2780', true),
    g('Caribbean Stud Poker', 'JILI', undefined, '/games/icons/POKER/JILI__Caribbean-Stud-Poker.avif', 'caribbean-stud-poker', '21', true),
    g('New Hilo', 'InOut', undefined, '/games/icons/POKER/InOut__New-Hilo.avif', 'new-hilo', '3320', true),
    g('Domino Go', 'JILI', undefined, '/games/icons/POKER/JILI__Domino-Go.avif', 'domino-go', '10498', true),
    g('Dragon Tiger', 'Pragmatic Play', undefined, '/games/icons/POKER/Pragmatic-Play__Dragon-Tiger.avif', 'dragon-tiger', '22105', true),
    g('Blackjack Lucky 7s Xmas', 'Evoplay', undefined, '/games/icons/POKER/Evoplay__Blackjack-Lucky-7s-Xmas.avif', 'blackjack-lucky-7s-xmas', '10453', false),
    g('Multihand Blackjack', 'Pragmatic Play', undefined, '/games/icons/POKER/Pragmatic-Play__Multihand-Blackjack.avif', 'multihand-blackjack', '22164', true),
    g('Lucky Roulette', 'JILI', undefined, '/games/icons/POKER/JILI__Lucky-Roulette.png', 'lucky-roulette', '17346', true),
    g('Poker King', 'JILI', undefined, '/games/icons/POKER/JILI__Poker-King.png', 'poker-king', '793', true),
    g('Pool Rummy', 'JILI', undefined, '/games/icons/POKER/JILI__Pool-Rummy.avif', 'pool-rummy', '296', true),
    g('Rummy', 'JILI', undefined, '/games/icons/POKER/JILI__Rummy.avif', 'rummy', '810', true),
    g('TeenPatti', 'JILI', undefined, '/games/icons/POKER/JILI__TeenPatti.webp', 'teenpatti', '1119', true),
    g('TeenPatti 20-20', 'JILI', undefined, '/games/icons/POKER/JILI__TeenPatti-20-20.avif', 'teenpatti-20-20', '110', false),
    g('TeenPatti Joker', 'JILI', undefined, '/games/icons/POKER/JILI__TeenPatti-Joker.avif', 'teenpatti-joker', '107', false),
    g('Thai Hilo', 'JILI', undefined, '/games/icons/POKER/JILI__Thai-Hilo.avif', 'thai-hilo', '1008', false),
    g('Video Poker', 'JILI', undefined, '/games/icons/POKER/JILI__Video-Poker.avif', 'video-poker', '183', false),
    g('European Christmas Roulette', 'Evoplay', undefined, '/games/icons/POKER/Evoplay__European-Christmas-Roulette.png', 'european-christmas-roulette', '10454', false),
    g('Evolution Poker', 'Evolution', undefined, '/games/icons/POKER/Evolution__Evolution-Poker.png', 'evolution-poker', '10486', false),
    g('French Roulette Classic', 'Evoplay', undefined, '/games/icons/POKER/Evoplay__French-Roulette-Classic.png', 'french-roulette-classic', '10418', false),
    g('Oasis Poker Classic', 'Evoplay', undefined, '/games/icons/POKER/Evoplay__Oasis-Poker-Classic.png', 'oasis-poker-classic', '10419', false),
  ],
  fish: [
    g('Bao Chuan Fishing', 'FaChai', 'hot', '/games/icons/HOT/FaChai__BAO-CHUAN-FISHING.avif', 'bao-chuan-fishing', '1413', true),
    g('All-star Fishing', 'JILI', undefined, '/games/icons/FISH/JILI__All-star-Fishing.avif', 'all-star-fishing', '728', true),
    g('Jack the Giant Hunter', 'PG Soft', undefined, '/games/icons/FISH/PG-Soft__Jack-the-Giant-Hunter.avif', 'jack-the-giant-hunter', '10116', true),
    g('Cai Shen Fishing', 'JDB', undefined, '/games/icons/FISH/JDB__Cai-Shen-Fishing.avif', 'cai-shen-fishing', '496', true),
    g('Fishtastic', 'Red Tiger', undefined, '/games/icons/FISH/Red-Tiger__Fishtastic.avif', 'fishtastic', '8286', false),
    g('Big Bass Mission Fishin\'', 'Pragmatic Play', 'hot', '/games/icons/FISH/Pragmatic-Play__Big-Bass-Mission-Fishin.avif', 'big-bass-mission-fishin', '21782', true),
    g('Fish Boom', 'InOut', undefined, '/games/icons/FISH/InOut__Fish-Boom.avif', 'fish-boom', '10066', true),
    g('Ocean Phoenix', 'Yellow Bat', undefined, '/games/icons/FISH/Yellow-Bat__OCEAN-PHOENIX.png', 'ocean-phoenix', '13268', false),
    g('Crystal Hunters', 'Amigo', undefined, '/games/icons/FISH/Amigo__Crystal-Hunters.avif', 'crystal-hunters', '9951', false),
    g('Bombing Fishing', 'JILI', undefined, '/games/icons/FISH/JILI__Bombing-Fishing.avif', 'bombing-fishing', '1041', true),
    g('Win Win Fish Prawn Crab', 'PG Soft', undefined, '/games/icons/FISH/PG-Soft__Win-Win-Fish-Prawn-Crab.avif', 'win-win-fish-prawn-crab', '711', true),
    g('Dragon Fishing', 'JDB', undefined, '/games/icons/FISH/JDB__Dragon-Fishing.avif', 'dragon-fishing', '72', true),
    g('Fa Chai Fishing', 'FaChai', undefined, '/games/icons/FISH/FaChai__FA-CHAI-FISHING.avif', 'fa-chai-fishing', '2140', true),
    g('Bounty Hunter', 'Pragmatic Play', undefined, '/games/icons/FISH/Pragmatic-Play__Bounty-Hunter.avif', 'bounty-hunter', '22193', true),
    g('Fish Road', 'InOut', undefined, '/games/icons/FISH/InOut__Fish-Road.avif', 'fish-road', '10061', true),
    g('Royal Hunter', 'Yellow Bat', undefined, '/games/icons/FISH/Yellow-Bat__ROYAL-HUNTER.png', 'royal-hunter', '13238', false),
    g('Bonus Hunter', 'JILI', undefined, '/games/icons/FISH/JILI__Bonus-Hunter.avif', 'bonus-hunter', '257', true),
    g('Dragon Fishing Ii', 'JDB', undefined, '/games/icons/FISH/JDB__Dragon-Fishing-Ii.avif', 'dragon-fishing-ii', '488', true),
    g('Fierce Fishing', 'FaChai', undefined, '/games/icons/FISH/FaChai__FIERCE-FISHING.avif', 'fierce-fishing', '2165', true),
    g('Fish Eye', 'Pragmatic Play', undefined, '/games/icons/FISH/Pragmatic-Play__Fish-Eye.avif', 'fish-eye', '21911', true),
    g('Boom Legend', 'JILI', undefined, '/games/icons/FISH/JILI__Boom-Legend.avif', 'boom-legend', '1088', true),
    g('Dragon Master', 'JDB', undefined, '/games/icons/FISH/JDB__Dragon-Master.avif', 'dragon-master', '1115', true),
    g('Monkey King Fishing', 'FaChai', undefined, '/games/icons/FISH/FaChai__MONKEY-KING-FISHING.avif', 'monkey-king-fishing', '3224', true),
    g('Fishin Reels', 'Pragmatic Play', undefined, '/games/icons/FISH/Pragmatic-Play__Fishin-Reels.avif', 'fishin-reels', '22038', true),
    g('Crazy Hunter', 'JILI', 'hot', '/games/icons/FISH/JILI__Crazy-Hunter.avif', 'crazy-hunter', '468', true),
    g('Fishing Disco', 'JDB', undefined, '/games/icons/FISH/JDB__Fishing-Disco.avif', 'fishing-disco', '1046', true),
    g('Star Hunter', 'FaChai', undefined, '/games/icons/FISH/FaChai__STAR-HUNTER.avif', 'star-hunter', '3902', true),
    g('Jackpot Hunter', 'Pragmatic Play', undefined, '/games/icons/FISH/Pragmatic-Play__Jackpot-Hunter.avif', 'jackpot-hunter', '21766', true),
    g('Crazy Hunter 2', 'JILI', 'hot', '/games/icons/FISH/JILI__Crazy-Hunter-2.avif', 'crazy-hunter-2', '467', true),
    g('Fishing Yilufa', 'JDB', undefined, '/games/icons/FISH/JDB__Fishing-Yilufa.avif', 'fishing-yilufa', '621', false),
    g('Perfect Fishing', 'Evoplay', undefined, '/games/icons/FISH/Evoplay__Perfect-Fishing.jpg', 'perfect-fishing', '3409', false),
  ],
  lottery: [
    g('Beasty Bingo', 'Yellow Bat', 'hot', '/games/icons/HOT/Yellow-Bat__BEASTY-BINGO.png', 'beasty-bingo', '13275', false),
    g('Bingo Adventure', 'JILI', undefined, '/games/icons/LOTTERY/JILI__Bingo-Adventure.avif', 'bingo-adventure', '148', true),
    g('Cai Shen Bingo', 'JDB', undefined, '/games/icons/LOTTERY/JDB__Cai-Shen-Bingo.avif', 'cai-shen-bingo', '1102', true),
    g('Keno', 'Spribe', 'hot', '/games/icons/LOTTERY/Spribe__Keno.avif', 'keno-spribe', '894', true),
    g('Keno', 'JILI', undefined, '/games/icons/LOTTERY/JILI__Keno.avif', 'keno-jili', '771', false),
    g('Adrenaline Rush: Scratch', 'Evoplay', 'hot', '/games/icons/LOTTERY/Evoplay__Adrenaline-Rush-Scratch.avif', 'adrenaline-rush-scratch', '10464', false),
    g('Sweet Keno', 'InOut', undefined, '/games/icons/LOTTERY/InOut__Sweet-Keno.avif', 'sweet-keno', '3976', true),
    g('Bingo Carnaval', 'JILI', undefined, '/games/icons/LOTTERY/JILI__Bingo-Carnaval.avif', 'bingo-carnaval', '967', true),
    g('Gold Rooster Lottery', 'JDB', undefined, '/games/icons/LOTTERY/JDB__Gold-Rooster-Lottery.avif', 'gold-rooster-lottery', '213', true),
    g('Keno 80', 'Spribe', 'hot', '/games/icons/LOTTERY/Spribe__Keno-80.avif', 'keno-80', '551', true),
    g('Book Of Keno', 'Evoplay', 'hot', '/games/icons/LOTTERY/Evoplay__Book-Of-Keno.avif', 'book-of-keno', '1554', false),
    g('Bingo Bingo', 'Yellow Bat', 'hot', '/games/icons/LOTTERY/Yellow-Bat__BINGO-BINGO.png', 'bingo-bingo', '13278', false),
    g('Calaca Bingo', 'JILI', undefined, '/games/icons/LOTTERY/JILI__Calaca-Bingo.avif', 'calaca-bingo', '824', true),
    g('Happy Lottery', 'JDB', undefined, '/games/icons/LOTTERY/JDB__Happy-Lottery.avif', 'happy-lottery', '981', true),
    g('Candy Dreams: Bingo', 'Evoplay', undefined, '/games/icons/LOTTERY/Evoplay__Candy-Dreams-Bingo.avif', 'candy-dreams-bingo', '1644', false),
    g('Bingo Bonanza', 'Yellow Bat', 'hot', '/games/icons/LOTTERY/Yellow-Bat__BINGO-BONANZA.png', 'bingo-bonanza', '13276', false),
    g('Candyland Bingo', 'JILI', undefined, '/games/icons/LOTTERY/JILI__Candyland-Bingo.avif', 'candyland-bingo', '518', true),
    g('Ez Bingo', 'Yellow Bat', undefined, '/games/icons/LOTTERY/Yellow-Bat__EZ-BINGO.png', 'ez-bingo', '13270', false),
    g('Elf Bingo', 'JILI', undefined, '/games/icons/LOTTERY/JILI__Elf-Bingo.avif', 'elf-bingo', '431', true),
    g('Heat Bingo', 'Yellow Bat', undefined, '/games/icons/LOTTERY/Yellow-Bat__HEAT-BINGO.png', 'heat-bingo', '13273', false),
    g('Fortune Bingo', 'JILI', undefined, '/games/icons/LOTTERY/JILI__Fortune-Bingo.avif', 'fortune-bingo', '216', true),
    g('Joy Bingo', 'Yellow Bat', undefined, '/games/icons/LOTTERY/Yellow-Bat__JOY-BINGO.png', 'joy-bingo', '13271', false),
    g('Fortune Gems Scratch', 'JILI', 'hot', '/games/icons/LOTTERY/JILI__Fortune-Gems-Scratch.avif', 'fortune-gems-scratch', '972', true),
    g('Lightning Bingo', 'Yellow Bat', undefined, '/games/icons/LOTTERY/Yellow-Bat__LIGHTNING-BINGO.png', 'lightning-bingo', '13272', false),
    g('Go Goal BIngo', 'JILI', undefined, '/games/icons/LOTTERY/JILI__Go-Goal-BIngo.avif', 'go-goal-bingo', '357', true),
    g('Money Bingo', 'Yellow Bat', undefined, '/games/icons/LOTTERY/Yellow-Bat__MONEY-BINGO.png', 'money-bingo', '13274', false),
    g('iRich Bingo', 'JILI', undefined, '/games/icons/LOTTERY/JILI__iRich-Bingo.avif', 'irich-bingo', '770', false),
    g('Super 30 Bingo', 'Yellow Bat', undefined, '/games/icons/LOTTERY/Yellow-Bat__SUPER-30-BINGO.png', 'super-30-bingo', '13269', false),
    g('Jackpot Bingo', 'JILI', undefined, '/games/icons/LOTTERY/JILI__Jackpot-Bingo.avif', 'jackpot-bingo', '543', false),
    g('Keno Bonus Number', 'JILI', undefined, '/games/icons/LOTTERY/JILI__Keno-Bonus-Number.avif', 'keno-bonus-number', '549', false),
    g('Football Scratch', 'Evoplay', undefined, '/games/icons/LOTTERY/Evoplay__Football-Scratch.jpg', 'football-scratch', '2253', false),
    g('Jhana of God: Scratch', 'Evoplay', undefined, '/games/icons/LOTTERY/Evoplay__Jhana-of-God-Scratch.png', 'jhana-of-god-scratch', '10431', false),
    g('Lottery Ticket', 'Evoplay', undefined, '/games/icons/LOTTERY/Evoplay__Lottery-Ticket.jpg', 'lottery-ticket', '2969', false),
    g('Scratch Match', 'Evoplay', undefined, '/games/icons/LOTTERY/Evoplay__Scratch-Match.jpg', 'scratch-match', '3748', false),
    g('Scratch Match Deluxe', 'Evoplay', undefined, '/games/icons/LOTTERY/Evoplay__Scratch-Match-Deluxe.png', 'scratch-match-deluxe', '10456', false),
  ],
  jackpot: [
    /* ---- The house's own games (hand-kept, not generated).
       They run on our engine in lib/mini-games.ts and open at /game/<id>,
       so they carry no provider code and need no aggregator. The order
       here is the order the home rail shows: Aviator, Crazy Time, then
       ours. Tiles are drawn by GameArt from the id — deliberately no
       `thumb`, since the artwork for these is ours to make. ---- */
    g('Aviator', 'Spribe', 'hot', '/games/icons/CK44/aviator.webp', 'aviator', undefined, false),
    g('Crazy Time', 'Evolution', 'hot', '/games/icons/CK44/crazy-time.webp', 'crazy-time', '22870', false),
    g('Crash', 'rr888bd', 'hot', undefined, 'crash', undefined, false),
    g('JetX', 'rr888bd', 'hot', undefined, 'jetx', undefined, false),
    g('Limbo', 'rr888bd', 'new', undefined, 'limbo', undefined, false),
    g('Dice', 'rr888bd', 'new', undefined, 'dice', undefined, false),
    g('Plinko', 'rr888bd', 'new', undefined, 'plinko', undefined, false),
    g('Coin Flip', 'rr888bd', 'new', undefined, 'coin-flip', undefined, false),
    g('Golden Ace', 'rr888bd', 'new', undefined, 'golden-ace', undefined, false),
    g('3 Charge Buffalo', 'JILI', 'hot', '/games/icons/HOT/JILI__3-Charge-Buffalo.avif', '3-charge-buffalo', '1185', true),
    g('3 Lucky Piggy', 'JILI', 'hot', '/games/icons/HOT/JILI__3-Lucky-Piggy.avif', '3-lucky-piggy', '1026', true),
    g('Crazy Hunter', 'JILI', 'hot', '/games/icons/FISH/JILI__Crazy-Hunter.avif', 'crazy-hunter', '468', true),
    g('Crazy Hunter 2', 'JILI', 'hot', '/games/icons/FISH/JILI__Crazy-Hunter-2.avif', 'crazy-hunter-2', '467', true),
    g('3 Super Ace', 'JILI', 'hot', '/games/icons/JACKPOT/JILI__3-Super-Ace.png', '3-super-ace', '17372', true),
    g('Aztec Priestess', 'JILI', 'hot', '/games/icons/JACKPOT/JILI__Aztec-Priestess.avif', 'aztec-priestess', '480', true),
    g('Book of Gold', 'JILI', 'hot', '/games/icons/JACKPOT/JILI__Book-of-Gold.avif', 'book-of-gold', '482', true),
    g('Boxing King', 'JILI', 'hot', '/games/icons/CK44/boxing-king.webp', 'boxing-king', '699', true),
    g('Boxing King Title Match', 'JILI', 'hot', '/games/icons/JACKPOT/JILI__Boxing-King-Title-Match.avif', 'boxing-king-title-match', '10505', true),
    g('Charge Buffalo', 'JILI', 'hot', '/games/icons/JACKPOT/JILI__Charge-Buffalo.avif', 'charge-buffalo', '700', true),
    g('Charge Buffalo Ascent', 'JILI', 'hot', '/games/icons/JACKPOT/JILI__Charge-Buffalo-Ascent.avif', 'charge-buffalo-ascent', '182', true),
    g('Crazy FaFaFa', 'JILI', 'hot', '/games/icons/JACKPOT/JILI__Crazy-FaFaFa.avif', 'crazy-fafafa', '773', true),
    g('Crazy777', 'JILI', 'hot', '/games/icons/JACKPOT/JILI__Crazy777.avif', 'crazy777', '642', true),
    g('Crazy777 2', 'JILI', 'hot', '/games/icons/JACKPOT/JILI__Crazy777-2.avif', 'crazy777-2', '10031', true),
    g('Dinosaur Tycoon', 'JILI', 'hot', '/games/icons/JACKPOT/JILI__Dinosaur-Tycoon.avif', 'dinosaur-tycoon', '1082', true),
    g('Dinosaur Tycoon II', 'JILI', 'hot', '/games/icons/JACKPOT/JILI__Dinosaur-Tycoon-II.avif', 'dinosaur-tycoon-ii', '869', true),
    g('Fortune Gems', 'JILI', 'hot', '/games/icons/JACKPOT/JILI__Fortune-Gems.avif', 'fortune-gems', '792', true),
  ],
};

/** Tabs in the sticky rail, in the order the reference site uses. */
export const TAB_ORDER: CategoryKey[] = [
  'hot', 'slot', 'live', 'poker', 'fish', 'sports',
];

/** Every section rendered on the home page, top to bottom — the reference
    lobby's order, with jackpot last. */
export const HOME_SECTIONS: CategoryKey[] = [
  'hot', 'slot', 'live', 'poker', 'fish', 'sports', 'lottery', 'jackpot',
];

export const PROVIDERS = [
  'AMIGO', 'BIG TIME GAMING', 'EAZY GAMING', 'EVOLUTION', 'EVOPLAY',
  'FACHAI', 'INOUT', 'JDB', 'JILI', 'LIVE22',
  'LUCKY SPORT', 'PG SOFT', 'PK44', 'PRAGMATIC PLAY', 'RED TIGER',
  'SPRIBE', 'TURBO GAMES', 'YELLOW BAT',
];

export const PAYMENT_METHODS = ['bKash', 'Nagad', 'Rocket', 'Upay', 'Bank Transfer', 'USDT'];

/* ============================================================
   Demo previews — provider fun-mode URLs, keyed by the game id
   (the slug in /casino/<id>).

   VIEW ONLY. The page frames the URL behind a blocking overlay:
   the player sees the real game render but cannot click into it.
   Nothing here touches a wallet and no session token is minted,
   so these must be the provider's own public play-money pages —
   never a launch URL lifted from another operator's session.

   A game with no entry here keeps the "aggregator not connected"
   placeholder, so this map can be filled in one game at a time.
   ============================================================ */
export const DEMOS: Record<string, string> = {
  /* Pragmatic Play — demogamesfree is their own unauthenticated demo host.
     openGame.do redirects to a fresh play-money session on every load, so the
     URL never goes stale and carries no operator token. Each symbol below was
     checked against the host: a wrong one answers "an error has occurred"
     instead of rendering, so only verified ones are listed. */
  'big-bass-bonanza': 'https://demogamesfree.pragmaticplay.net/gs2c/openGame.do?gameSymbol=vs10bbbonanza&lang=en&cur=USD',
  'big-bass-amazon-xtreme': 'https://demogamesfree.pragmaticplay.net/gs2c/openGame.do?gameSymbol=vs10bbextreme&lang=en&cur=USD',
  'fish-eye': 'https://demogamesfree.pragmaticplay.net/gs2c/openGame.do?gameSymbol=vs10fisheye&lang=en&cur=USD',
  'gates-of-olympus': 'https://demogamesfree.pragmaticplay.net/gs2c/openGame.do?gameSymbol=vs20olympgate&lang=en&cur=USD',
  'gates-of-olympus-1000': 'https://demogamesfree.pragmaticplay.net/gs2c/openGame.do?gameSymbol=vs20olympx&lang=en&cur=USD',
  'sweet-bonanza': 'https://demogamesfree.pragmaticplay.net/gs2c/openGame.do?gameSymbol=vs20fruitsw&lang=en&cur=USD',
  'sweet-bonanza-1000': 'https://demogamesfree.pragmaticplay.net/gs2c/openGame.do?gameSymbol=vs20sbxmas&lang=en&cur=USD',
  'sugar-rush': 'https://demogamesfree.pragmaticplay.net/gs2c/openGame.do?gameSymbol=vs20sugarrush&lang=en&cur=USD',
  'starlight-princess': 'https://demogamesfree.pragmaticplay.net/gs2c/openGame.do?gameSymbol=vs20starlight&lang=en&cur=USD',
  'the-dog-house': 'https://demogamesfree.pragmaticplay.net/gs2c/openGame.do?gameSymbol=vs20doghouse&lang=en&cur=USD',
  'wolf-gold': 'https://demogamesfree.pragmaticplay.net/gs2c/openGame.do?gameSymbol=vs25wolfgold&lang=en&cur=USD',
  'wild-west-gold': 'https://demogamesfree.pragmaticplay.net/gs2c/openGame.do?gameSymbol=vs40wildwest&lang=en&cur=USD',
  'fruit-party': 'https://demogamesfree.pragmaticplay.net/gs2c/openGame.do?gameSymbol=vs20fruitparty&lang=en&cur=USD',
  'great-rhino-megaways': 'https://demogamesfree.pragmaticplay.net/gs2c/openGame.do?gameSymbol=vswaysrhino&lang=en&cur=USD',
  'buffalo-king-megaways': 'https://demogamesfree.pragmaticplay.net/gs2c/openGame.do?gameSymbol=vswaysbufking&lang=en&cur=USD',
  'release-the-kraken': 'https://demogamesfree.pragmaticplay.net/gs2c/openGame.do?gameSymbol=vs20kraken&lang=en&cur=USD',
  'madame-destiny': 'https://demogamesfree.pragmaticplay.net/gs2c/openGame.do?gameSymbol=vs10madame&lang=en&cur=USD',
  'power-of-thor-megaways': 'https://demogamesfree.pragmaticplay.net/gs2c/openGame.do?gameSymbol=vswayshammthor&lang=en&cur=USD',
  'fire-strike': 'https://demogamesfree.pragmaticplay.net/gs2c/openGame.do?gameSymbol=vs10firestrike&lang=en&cur=USD',
  'mustang-gold': 'https://demogamesfree.pragmaticplay.net/gs2c/openGame.do?gameSymbol=vs25mustang&lang=en&cur=USD',
  'aztec-gems': 'https://demogamesfree.pragmaticplay.net/gs2c/openGame.do?gameSymbol=vs5aztecgems&lang=en&cur=USD',
  '5-lions-megaways': 'https://demogamesfree.pragmaticplay.net/gs2c/openGame.do?gameSymbol=vswayslions&lang=en&cur=USD',
  'hot-fiesta': 'https://demogamesfree.pragmaticplay.net/gs2c/openGame.do?gameSymbol=vs25hotfiesta&lang=en&cur=USD',
  'juicy-fruits': 'https://demogamesfree.pragmaticplay.net/gs2c/openGame.do?gameSymbol=vs50juicyfr&lang=en&cur=USD',
  'gems-bonanza': 'https://demogamesfree.pragmaticplay.net/gs2c/openGame.do?gameSymbol=vs20goldfever&lang=en&cur=USD',
  'the-hand-of-midas': 'https://demogamesfree.pragmaticplay.net/gs2c/openGame.do?gameSymbol=vs20midas&lang=en&cur=USD',
  'wisdom-of-athena': 'https://demogamesfree.pragmaticplay.net/gs2c/openGame.do?gameSymbol=vs20procount&lang=en&cur=USD',
  'chilli-heat': 'https://demogamesfree.pragmaticplay.net/gs2c/openGame.do?gameSymbol=vs25chilli&lang=en&cur=USD',
  'zeus-vs-hades-gods-of-war': 'https://demogamesfree.pragmaticplay.net/gs2c/openGame.do?gameSymbol=vs15godsofwar&lang=en&cur=USD',
  'curse-of-the-werewolf-megaways': 'https://demogamesfree.pragmaticplay.net/gs2c/openGame.do?gameSymbol=vswayswerewolf&lang=en&cur=USD',
  'bounty-hunter': 'https://demogamesfree.pragmaticplay.net/gs2c/openGame.do?gameSymbol=vs20bhunter&lang=en&cur=USD',
  'fishin-reels': 'https://demogamesfree.pragmaticplay.net/gs2c/openGame.do?gameSymbol=vs10goldfish&lang=en&cur=USD',

  /* Evolution live game shows have no fun mode at all, so there is no demo
     URL to give — a real launch URL would be one player's real-money session,
     tied to a balance and expiring in minutes. The stand-in is a short
     self-hosted gameplay clip: drop an .mp4/.webm in public/games/ and point
     the slug at it (e.g. '/games/crazy-time.mp4'). GamePreview plays a local
     video file in a muted, looping, view-only frame. YouTube is not an option
     here — it blocks embedding on gambling videos (age-gate / Error 153). */
  'crazy-time': '/games/crazy-time.mp4',

  /* Spribe's public demo host (demo.spribe.io/launch/<game>) is gone — every
     game now answers "Retry limit of client config exceeded!". Aviator does
     not need it: GameSection routes it to the in-house /game/aviator. */
};

/* ============================================================
   The free-trial library.

   lib/demo-library.ts is generated from Pragmatic Play's own game
   list (scripts/gen_trial_library.py): every game the studio
   publishes an open demo for, ~650 of them, each with its key art
   under public/games/icons/TRIAL/. They need no operator account
   and no token, so they are the games /free-trial opens today.

   Some of them are already in the catalogue above with the icon
   pack's artwork and a HOT badge. Those keep their catalogue entry
   — the library only supplies the demo URL — so a game never shows
   up twice under two ids.
   ============================================================ */
const TRIALS: Record<string, string> = Object.fromEntries(
  TRIAL_GAMES.map((g) => [g.id, trialUrl(g.symbol)]),
);

/* A self-hosted clip wins over a provider page: it always loads, never
   expires, and for the live tables it is the only thing there is. The
   generated library comes before the hand-kept map because it is read from
   each game's own page, so it is the one that stays right as the studio
   renames or re-releases a game. */
export const demoUrl = (id: string): string | undefined =>
  CLIPS[id] ?? TRIALS[id] ?? DEMOS[id];

/** The trial library as catalogue games, in the studio's A–Z order. */
const TRIAL_CATALOGUE: Game[] = TRIAL_GAMES.map((g) => ({
  id: g.id,
  name: g.name,
  provider: TRIAL_PROVIDER,
  thumb: trialArt(g),
  demo: true,
}));

/** Every trial, with the catalogue's own entry (icon-pack art, HOT badge)
    preferred wherever the two carry the same game. Studio A–Z order, which
    is what a searchable page of 650 wants. */
export function trialGames(): Game[] {
  return TRIAL_CATALOGUE.map((g) => findCatalogueGame(g.id) ?? g);
}

/** The trials worth leading a rail with — hand-kept, because A–Z opens on
    games nobody came looking for. These are the studio's own headliners, the
    ones a player already recognises from every other lobby. */
const TRIAL_FEATURED = [
  'gates-of-olympus', 'sweet-bonanza', 'sugar-rush', 'starlight-princess',
  'big-bass-bonanza', 'the-dog-house', 'wolf-gold', 'fruit-party',
  'gates-of-olympus-1000', 'sweet-bonanza-1000', 'sugar-rush-1000',
  'starlight-princess-1000', 'buffalo-king-megaways', '5-lions-megaways',
  'great-rhino-megaways', 'wild-west-gold', 'the-dog-house-megaways',
  'power-of-thor-megaways', 'gems-bonanza', 'release-the-kraken',
  'mustang-gold', 'aztec-gems',
];

/** Headliners first, then the rest of the library — for the home rail. */
export function trialRail(limit: number): Game[] {
  const byId = new Map(trialGames().map((g) => [g.id, g]));
  const out: Game[] = [];
  for (const id of TRIAL_FEATURED) {
    const g = byId.get(id);
    if (g) { out.push(g); byId.delete(id); }
  }
  for (const g of byId.values()) {
    if (out.length >= limit) break;
    out.push(g);
  }
  return out.slice(0, limit);
}

function findCatalogueGame(id: string): Game | undefined {
  for (const games of Object.values(CATALOGUE)) {
    const hit = games.find((g) => g.id === id);
    if (hit) return hit;
  }
  return undefined;
}

/** Flattened lookup — the same game sits in several categories, so the first
    match wins and every duplicate id resolves to one game. Falls through to
    the trial library, so /play/<id> opens a game that only lives there. */
export function findGame(id: string): Game | undefined {
  return findCatalogueGame(id) ?? TRIAL_CATALOGUE.find((g) => g.id === id);
}

/* ============================================================
   Which games a visitor can actually see something for.

   A game is "previewable" if it has its own working engine on the
   site (PLAYABLE) or a demo entry above (a provider fun-mode page,
   or a gameplay clip). Everything else still has a page, but it
   shows the "aggregator not connected yet" placeholder — so the
   home page floats the previewable ones up and lets the rest sink.
   ============================================================ */
/* The front of the lobby, in the order the user set: Aviator first, then the
   games a visitor can open right now and actually spin — Pragmatic's own
   demo host needs no operator account, so these are the only tiles that are
   a real game rather than a placeholder. Everything else previewable follows
   in catalogue order. Ids not in the catalogue are ignored, so this list is
   safe to prune. */
export const FEATURED_IDS = [
  'aviator', 'jetx',
  '3-buzzing-wilds', '3-dancing-monkeys',
  'big-bass-bonanza', 'bounty-hunter',
  'fish-eye', 'fishin-reels',
  'gates-of-olympus', 'gates-of-olympus-1000',
  'sweet-bonanza', 'sweet-bonanza-1000',
  'sugar-rush', 'starlight-princess',
  'big-bass-amazon-xtreme',
  'the-dog-house', 'wolf-gold', 'wild-west-gold',
  'fruit-party', 'great-rhino-megaways',
  'buffalo-king-megaways', 'release-the-kraken',
  'madame-destiny', 'power-of-thor-megaways',
  'fire-strike', 'mustang-gold',
  'aztec-gems', '5-lions-megaways',
  'hot-fiesta', 'juicy-fruits',
  'gems-bonanza', 'the-hand-of-midas',
  'wisdom-of-athena', 'chilli-heat',
  'zeus-vs-hades-gods-of-war', 'curse-of-the-werewolf-megaways',
];

const featuredRank = (id: string): number => {
  const i = FEATURED_IDS.indexOf(id);
  return i === -1 ? Number.MAX_SAFE_INTEGER : i;
};

export const PLAYABLE_IDS = [
  'aviator', 'crash', 'jetx', 'limbo', 'dice', 'plinko', 'coin-flip', 'golden-ace',
];

export const hasDemo = (id: string): boolean =>
  PLAYABLE_IDS.includes(id) || id in CLIPS || id in TRIALS || id in DEMOS;

/** Previewable, but deliberately not part of the front rail. Crazy Time has
    only a looping clip — no real table behind it — so leading the lobby with
    it oversells what a tap gets you. It still sits in Live Casino and
    Jackpot for anyone who goes looking. */
const NOT_FEATURED = new Set(['crazy-time']);

/** Unique previewable games: the featured order first, then the rest in
    home-section order (first match wins). */
export function demoGames(): Game[] {
  const seen = new Set<string>();
  const out: Game[] = [];
  for (const key of HOME_SECTIONS) {
    for (const g of CATALOGUE[key]) {
      if (hasDemo(g.id) && !NOT_FEATURED.has(g.id) && !seen.has(g.id)) {
        seen.add(g.id);
        out.push(g);
      }
    }
  }
  /* A stable sort, so anything unfeatured keeps the catalogue order it
     already had and only the named ids move to the front. */
  return out.sort((a, b) => featuredRank(a.id) - featuredRank(b.id));
}

/** Catalogue order, but every game that actually opens comes first and the
    "coming soon" tiles sink to the end. A stable partition, so within each
    half the hand-kept order is untouched — and it runs before the admin
    overrides, so a pinned game still wins. */
export function playableFirst(games: Game[]): Game[] {
  const open: Game[] = [];
  const soon: Game[] = [];
  for (const g of games) (hasDemo(g.id) ? open : soon).push(g);
  /* Within the half that opens, the featured order wins — so a category that
     holds Gates of Olympus leads with it rather than with whatever the
     generator happened to list first. */
  open.sort((a, b) => featuredRank(a.id) - featuredRank(b.id));
  return open.concat(soon);
}
