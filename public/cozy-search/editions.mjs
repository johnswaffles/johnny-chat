// Each line pairs a searchable answer with its clue in the field guide.
function edition(id, name, setting, note, afterword, words, mysteries) {
  const entries = (text) =>
    text
      .trim()
      .split("\n")
      .map((line) => {
        const [word, clue] = line.trim().split("|");
        return { word: word.toUpperCase(), clue };
      });
  return {
    id,
    name,
    setting,
    note,
    afterword,
    entries: entries(words),
    mysteries: entries(mysteries),
  };
}

export const editions = [
  edition(
    "headland",
    "Lantern Headland",
    "The coast",
    "The tide is turning. From the lantern room, the keeper watches the first red sail round the point.",
    "The keeper trims the wick. One by one, the boats find the harbor.",
    `
Anchor|A weight that keeps a boat put
Beacon|A light that says “this way”
Brine|What gives the sea its salt
Buoy|A marker that rides the waves
Cable|A heavy line aboard ship
Cairn|A pile of stones marking the trail
Cliff|Where the headland drops away
Coral|A reef built by tiny animals
Cove|A little shelter in the coastline
Dinghy|A small boat to row ashore
Drift|Move with the current
Dune|A hill shaped by blowing sand
Ferry|A boat with a regular crossing
Foam|White froth on a breaker
Gale|Wind strong enough to shorten sail
Gull|A bird that follows the fishing boats
Helm|Where the skipper steers
Hull|The body of a boat
Jetty|A landing that juts into the water
Keel|The spine beneath a boat
Kelp|Seaweed that grows in underwater forests
Mast|A sailboat’s tallest spar
Oyster|A shell that might hide a pearl
Pier|A walkway on pilings
Reef|A ridge just beneath the waves
Ripple|A small wrinkle on the water
Rope|What a sailor learns to splice
Shell|An empty shore snail’s keepsake
Shoal|Shallow water a skipper avoids
Swell|A long rolling wave
Tern|A fork-tailed seabird
Wreck|A ship that ended its voyage early`,
    `
Lantern|I carry a small flame behind glass.
Compass|Turn me in your palm. My needle keeps its bearing.
Harbor|Outside, whitecaps. Inside my arms, boats rest.
Tide|Twice most days, I redraw the line between land and sea.`,
  ),
  edition(
    "glasshouse",
    "The Glasshouse",
    "The garden",
    "Rain ticks on the panes. A gardener leaves the door ajar for the last moth of the evening.",
    "A pale flower opens as the lamps go out. It saved its perfume for the moths.",
    `
Aloe|A succulent with gel inside
Apricot|A velvety orange stone fruit
Aster|A starry flower of late summer
Azalea|A flowering relative of the rhododendron
Bark|A tree’s outer coat
Bean|A seed that grows in a pod
Bloom|What a flower does when it opens
Bulb|A daffodil’s underground storehouse
Cactus|A spiny resident of the dry house
Citrus|The family of lemons and limes
Clay|Soil that sticks to the spade
Dahlia|A garden flower grown from tubers
Fern|Its new frond unrolls like a fiddlehead
Fig|A sweet fruit with many tiny seeds
Frond|A fern’s leaf
Glove|What keeps thorns out of a gardener’s hand
Graft|Join a shoot to a different rootstock
Herb|A plant picked to season supper
Iris|A flower with petals called falls
Jade|A succulent named for a green stone
Leaf|A plant’s little solar panel
Lily|The flower on a fleur-de-lis
Loam|Crumbly soil prized by gardeners
Melon|A heavy fruit on a trailing vine
Mint|A fragrant herb that happily takes over
Moss|A soft green mat on damp stone
Mulch|A covering that keeps moisture in the soil
Palm|A tree with a crown of fronds
Pear|An orchard fruit with a narrow neck
Petal|One colorful piece of a blossom
Root|It drinks below the soil
Stem|What holds a bloom above its leaves`,
    `
Pollen|I dust a bee in gold and travel to the next flower.
Tendril|I reach without fingers and coil around a support.
Orchid|My family includes the flower that gives you vanilla.
Seed|A whole garden can begin with me in your palm.`,
  ),
  edition(
    "meridian",
    "Meridian Hill",
    "The observatory",
    "The dome rolls open on its track. Tonight the sky is clear all the way to the ridge.",
    "Dawn erases the faintest stars first. The night’s last observation goes into the log.",
    `
Arc|A curved stretch of a circle
Axis|The line a planet spins around
Beam|A narrow shaft of light
Chart|A map of the night sky
Clock|The instrument that times a transit
Comet|An icy traveler that grows a tail
Crater|A bowl left by an impact
Crescent|The moon when only a sliver is lit
Dawn|When the stars begin to fade
Dome|The roof that opens for the telescope
Dusk|The light between day and night
Dust|Fine grains between the stars
Earth|The planet beneath the tripod
Flare|A sudden burst from the Sun
Focus|Adjust this to sharpen the image
Galaxy|A vast family of stars
Gibbous|A moon more than half lit
Globe|A sphere you can turn on a desk
Halo|A ring of light around the moon
Lens|Curved glass that bends the light
Lunar|Pertaining to our moon
Mars|The rusty red planet
Meteor|A streak made by falling space debris
Mirror|A reflector telescope gathers light with one
Night|The dark half of the observing day
Nova|A star system’s sudden brightening
Orbit|A planet’s path around its star
Phase|One of the moon’s changing faces
Prism|Glass that fans light into colors
Saturn|A planet famed for its rings
Solar|Pertaining to the Sun
Venus|The bright planet called the evening star`,
    `
Eclipse|I happen when one body slips into another’s light.
Zenith|Look straight up. I am that point in the sky.
Aurora|Charged particles set my polar curtains glowing.
Nebula|Stars can be born in my clouds of gas and dust.`,
  ),
  edition(
    "bookshop",
    "The Lamplit Bookshop",
    "The old town",
    "A bell sounds above the door. Under the amber lamp, someone has left a book open to a favorite page.",
    "The bookseller slips a pressed leaf between the pages and turns the sign for the night.",
    `
Atlas|A whole world bound in maps
Bard|A poet with a tale to sing
Blurb|The jacket’s short pitch
Board|A stiff panel beneath a book cover
Case|A cabinet for a collection of books
Chalk|What writes the special on a slate
Chapter|A novel’s numbered division
Cloth|A woven cover material
Cover|What the old saying says you cannot judge a book by
Draft|An author’s early version
Dust|What gathers on an unopened volume
Essay|A short exploration in prose
Fable|A tale with a moral
Folio|A sheet folded once to make two leaves
Font|A set of type in one design
Genre|The shelf category of a story
Gloss|A brief explanation beside the text
Index|An alphabetical guide at the back
Jacket|A removable outer cover
Label|A small tag on the shelf edge
Leaf|A single sheet with two pages
Ledger|Where the shop records its sales
Margin|The space around a page of type
Memoir|A life remembered in prose
Novel|A long work of fiction
Page|One side of a printed leaf
Plot|The chain of events in a story
Poem|A piece that might be written in lines and stanzas
Press|A machine that puts ink to paper
Proof|A copy checked before printing
Quill|A pen once carried by a bird
Spine|The edge that faces out on the shelf`,
    `
Bookmark|Close the book and I stay behind to keep your place.
Ink|I can hold an entire story in a little black bottle.
Errata|Look for me on a slip that puts a printer’s mistakes right.
Prologue|The story proper starts just after me.`,
  ),
  edition(
    "railway",
    "Pinecrest Express",
    "The high pass",
    "Steam hangs between the pines. The night train takes the long curve onto the stone viaduct.",
    "The last carriage clears the pass. Far down the valley, a station window lights up.",
    `
Ash|What the firebox leaves behind
Axle|The rod connecting a pair of wheels
Bell|It rings as a train approaches
Bogie|A wheeled frame beneath a carriage
Boiler|Where water becomes steam
Brake|It slows the wheels
Bridge|It carries rails across a gap
Buffer|A shock absorber at a carriage end
Cabin|A snug room for the night
Cargo|Goods traveling by rail
Coal|Black fuel for the firebox
Coach|A carriage for passengers
Curve|A bend in the track
Depot|A building where trains or supplies wait
Diesel|An engine fuel named for an inventor
Fare|The price of a ride
Gauge|The distance between the rails
Grade|The slope a locomotive must climb
Guard|The crew member watching over the train
Lamp|A light in a carriage window
Lever|A handle that throws the points
Loop|A length of track for passing
Porter|The person who helps with bags
Rail|A steel runner for the wheels
Rivet|A metal pin hammered fast
Route|The course printed on the map
Sleeper|A car with beds for the night
Slope|A hillside the train traverses
Steam|What billows from the locomotive
Track|The rails and ties together
Tunnel|A shortcut through the mountain
Valve|It controls the flow in a pipe`,
    `
Whistle|My voice carries ahead of the engine through the pass.
Ticket|The conductor may punch a little hole in me.
Signal|My changing colors tell the driver when the line is clear.
Viaduct|My long row of arches carries the train across the valley.`,
  ),
  edition(
    "stillwater",
    "Stillwater Lake",
    "The north woods",
    "A canoe noses out from the reeds. Rings spread across the lake long after the paddle lifts.",
    "The canoe rests upside down on shore. Across the water, a loon calls once.",
    `
Alder|A tree fond of wet ground
Bank|The land at the water’s edge
Bass|A broad-mouthed freshwater fish
Bend|Where a stream changes direction
Birch|A tree with peeling papery bark
Brook|A little watercourse
Camp|A temporary home beneath the trees
Cedar|A fragrant evergreen
Creek|A small stream feeding the lake
Dock|Where the canoe is tied up
Echo|A call returned by the far shore
Ember|A coal still glowing at camp
Fern|A woodland plant with divided fronds
Frog|A croaker perched at the waterline
Heron|A long-legged wader waiting for a fish
Island|Dry land surrounded by water
Log|A fallen trunk floating offshore
Loon|A diving bird with a haunting call
Maple|A tree tapped for syrup
Mist|A veil of droplets above the lake
Otter|A playful swimmer with thick fur
Paddle|A canoeist’s blade
Pine|A tree with cones and needles
Pond|A lake in miniature
Reed|A slender stalk at the marsh edge
Rock|A sunning spot for a turtle
Shore|Where lake and land meet
Spruce|An evergreen with short, sharp needles
Tent|Shelter stretched over poles
Trail|A path through the woods
Trout|A speckled fish of cool waters
Wake|The trail a boat leaves on water`,
    `
Canoe|I have two pointed ends and carry a paddler between them.
Minnow|I dart in a silver school in the shallows.
Beaver|My broad tail slaps the water near the dam I built.
Firefly|On summer nights I blink a message over the reeds.`,
  ),
];
