/** Words for viz names, `<adjective>-<noun>` (from dsl's features/thea/words.py). */
const ADJECTIVES = `
able amber ancient arctic azure bold brave brisk bright calm candid civil clever cobalt cosmic
crimson crisp curious dapper deft dusty eager early electric fair fancy fervent fluffy frosty gentle
giddy golden grand happy hardy hazy humble icy idle jolly keen kind lively lucid lunar mellow merry
mighty misty modest nimble noble odd olive orange pale patient plucky polar proud quick quiet rapid
rosy royal rustic sandy scarlet serene shiny silent silver sleepy sly smooth snowy solar sonic spare
spry steady stellar stormy sturdy subtle sunny swift tidy tiny tranquil upbeat urban velvet vivid
warm wild windy wise witty young zany zesty
`.split(/\s+/).filter(Boolean);

const NOUNS = `
acorn anchor badger beacon bison breeze brook canyon cedar comet coral cosmos crane cricket delta
dune eagle ember falcon fern fjord forest fox garnet geyser glacier grove harbor hawk heron hill
island ivy jaguar kestrel lagoon lantern lark lemur lichen lotus lynx maple marsh meadow meteor
moose moss nebula newt oak ocean orbit orchid otter owl panda pebble pine planet plume pond quartz
quasar raven reef ridge river robin sage salmon sequoia shore sparrow spruce star stone summit swan
thistle tiger topaz tundra valley violet walrus willow wolf wren yak zephyr
`.split(/\s+/).filter(Boolean);

const pick = (ws: string[]) => ws[Math.floor(Math.random() * ws.length)];

/** A random `<adjective>-<noun>` not in `used`. */
export function newName(used: ReadonlySet<string>): string {
  for (let i = 0; i < 1000; i++) {
    const name = `${pick(ADJECTIVES)}-${pick(NOUNS)}`;
    if (!used.has(name)) return name;
  }
  throw new Error('no free viz name left');
}
