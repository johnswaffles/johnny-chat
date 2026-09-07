export const ACTIONS={
  "walk": {
    "label": "Walking",
    "group": "Movement",
    "seconds": 1.25,
    "loop": true,
    "labels": [
      "Left contact",
      "Left support",
      "Right passing",
      "Right reach",
      "Right contact",
      "Right support",
      "Left passing",
      "Left reach"
    ]
  },
  "idle": {
    "label": "Stand \u00b7 breathing",
    "group": "Movement",
    "seconds": 3.6,
    "loop": true,
    "labels": [
      "Rest",
      "Inhale",
      "Full breath",
      "Exhale"
    ]
  },
  "gather_wood": {
    "label": "Chopping wood",
    "group": "Gathering",
    "seconds": 1.25,
    "loop": true,
    "labels": [
      "raise axe over outside shoulder",
      "swing axe down toward a tree trunk outside the frame",
      "low follow-through at waist height",
      "draw axe back ready for the next swing"
    ],
    "hint": "A woodcutting axe gripped securely in both hands."
  },
  "gather_food": {
    "label": "Picking berries",
    "group": "Gathering",
    "seconds": 1.6,
    "loop": true,
    "labels": [
      "bend forward and reach right hand out",
      "pinch berries with right fingertips",
      "draw right hand back toward basket",
      "drop berries into basket and begin reaching again"
    ],
    "hint": "A small berry basket hanging from the left forearm."
  },
  "field_work": {
    "label": "Tending fields",
    "group": "Gathering",
    "seconds": 1.65,
    "loop": true,
    "labels": [
      "extend hoe forward low",
      "press blade into soil ahead",
      "pull hoe blade back toward boots with bent elbows",
      "lift blade and extend again"
    ],
    "hint": "A wooden hoe held firmly in both hands."
  },
  "gather_stone": {
    "label": "Quarrying stone",
    "group": "Gathering",
    "seconds": 1.4,
    "loop": true,
    "labels": [
      "raise pickaxe diagonally above shoulder",
      "drive pickaxe downward ahead of boots",
      "crouched low impact follow-through",
      "pull pickaxe free and begin lifting"
    ],
    "hint": "A steel pickaxe held in both hands."
  },
  "gather_gold": {
    "label": "Mining gold",
    "group": "Gathering",
    "seconds": 1.5,
    "loop": true,
    "labels": [
      "draw pick back above shoulder",
      "lean forward and drive pick into a waist-high vein outside frame",
      "hold low strike follow-through with left hand bracing",
      "withdraw pick and reset"
    ],
    "hint": "A narrow prospecting pick gripped in the right hand with a small ore pouch on the belt."
  },
  "construct": {
    "label": "Building",
    "group": "Building",
    "seconds": 1.25,
    "loop": true,
    "labels": [
      "position the peg in front at waist level",
      "raise mallet with bent elbow",
      "strike downward while left hand clears the strike",
      "lift mallet to reset"
    ],
    "hint": "A carpenters mallet in right hand and a wooden peg held low in left hand."
  },
  "repair": {
    "label": "Repairing",
    "group": "Building",
    "seconds": 1.35,
    "loop": true,
    "labels": [
      "lean forward to position board",
      "draw hammer back close to shoulder",
      "give precise short hammer tap",
      "inspect board and reset hand"
    ],
    "hint": "A small hammer in right hand and a short replacement board held by left hand."
  },
  "demolish": {
    "label": "Dismantling \u00b7 study pose",
    "group": "Building",
    "seconds": 1.5,
    "loop": true,
    "labels": [
      "plant bar ahead at waist level",
      "brace boots and lean body back pulling bar",
      "rock forward to release",
      "reposition bar ahead"
    ],
    "hint": "A long iron pry bar held in both hands."
  },
  "carry_wood": {
    "label": "Carrying timber",
    "group": "Carrying",
    "seconds": 1.5,
    "loop": true,
    "labels": [
      "left boot forward on ground right boot behind",
      "right boot lifted passing the planted left boot with LOW knee",
      "right boot forward on ground left boot behind",
      "left boot lifted passing planted right boot with LOW knee"
    ],
    "hint": "Three short rough-cut logs cradled horizontally across both forearms against the abdomen."
  },
  "carry_food": {
    "label": "Carrying food",
    "group": "Carrying",
    "seconds": 1.5,
    "loop": true,
    "labels": [
      "left boot forward on ground right boot behind",
      "right boot lifted passing planted left boot with LOW knee",
      "right boot forward on ground left boot behind",
      "left boot lifted passing planted right boot with LOW knee"
    ],
    "hint": "A wicker basket full of red apples and greens carried in both hands against the abdomen."
  },
  "carry_stone": {
    "label": "Carrying stone",
    "group": "Carrying",
    "seconds": 1.6,
    "loop": true,
    "labels": [
      "left boot forward with a heavy planted step",
      "right boot passing left close to ground",
      "right boot forward with heavy planted step",
      "left boot passing right close to ground"
    ],
    "hint": "A squat wooden hod containing three heavy gray stones supported by both hands against the abdomen."
  },
  "carry_gold": {
    "label": "Carrying gold",
    "group": "Carrying",
    "seconds": 1.5,
    "loop": true,
    "labels": [
      "left boot forward right boot behind",
      "right boot passing planted left with low knee",
      "right boot forward left boot behind",
      "left boot passing planted right with low knee"
    ],
    "hint": "A reinforced leather ore sack in both hands, open top showing gold-flecked gray ore."
  },
  "carry_supplies": {
    "label": "Carrying supplies \u00b7 study pose",
    "group": "Carrying",
    "seconds": 1.5,
    "loop": true,
    "labels": [
      "left boot forward right boot behind",
      "right boot passing planted left with low knee",
      "right boot forward left boot behind",
      "left boot passing planted right with low knee"
    ],
    "hint": "A small wooden supply crate with rope handles gripped securely in both hands."
  },
  "attack": {
    "label": "Defensive strike",
    "group": "Combat",
    "seconds": 1.25,
    "loop": true,
    "labels": [
      "Balanced guard",
      "Coil shoulders and raise the staff",
      "Strike forward with weight on the front foot",
      "Draw the staff back toward guard"
    ],
    "hint": "A stout wooden tool handle gripped in both hands as a defensive staff."
  },
  "hit": {
    "label": "Hit reaction",
    "group": "Combat",
    "seconds": 0.65,
    "loop": false,
    "labels": [
      "balanced standing",
      "sharp recoil shoulders back with bent knees",
      "twist away shielding ribs with one forearm",
      "recover upright with hands lowered"
    ],
    "hint": "Empty hands, all tools stowed on belt."
  },
  "ward_block": {
    "label": "Shield \u00b7 block impact",
    "group": "Last Light",
    "seconds": 0.85,
    "loop": false,
    "labels": [
      "brace in a staggered stance with forearms raised before face",
      "recoil a little behind raised forearms",
      "press open palms forward resolutely",
      "settle into protective ready stance"
    ],
    "hint": "Empty hands, tools stowed, NO physical shield."
  },
  "stunned": {
    "label": "Stunned \u00b7 study pose",
    "group": "Combat",
    "seconds": 2.2,
    "loop": true,
    "labels": [
      "head bowed slightly one hand at temple",
      "weight sinks onto bent left knee",
      "slow dazed tilt toward right with same feet planted",
      "steady herself returning toward first pose"
    ],
    "hint": "Empty hands, tools stowed."
  },
  "death": {
    "label": "Fall \u00b7 study pose",
    "group": "Combat",
    "seconds": 1.6,
    "loop": false,
    "labels": [
      "knees give way and shoulders sag",
      "sink onto one knee using left hand on ground",
      "roll gently onto hip and forearm",
      "lie still on side with bent knees"
    ],
    "hint": "Empty hands, tools remain strapped to belt."
  },
  "ward_raise": {
    "label": "Shield \u00b7 awakening",
    "group": "Last Light",
    "seconds": 1.7,
    "loop": false,
    "labels": [
      "near collapse on one knee with one hand over heart",
      "lift head and open palm",
      "rise to both feet with both palms opening outward",
      "stand firmly protected with palms gently lowered"
    ],
    "hint": "Empty hands, no physical shield, NO painted glow or effects."
  },
  "last_light": {
    "label": "Last Light \u00b7 release",
    "group": "Last Light",
    "seconds": 1.6,
    "loop": false,
    "labels": [
      "draw hands close to chest and look toward aggressor",
      "spread elbows as shoulders lift with resolve",
      "extend open palms toward aggressor releasing the curse",
      "lower palms and settle calmly"
    ],
    "hint": "Empty hands, no physical shield, NO painted magic effects."
  },
  "last_light_cursed": {
    "label": "Last Light \u00b7 curse reaction",
    "group": "Last Light",
    "seconds": 1.8,
    "loop": true,
    "labels": [
      "upright looking ahead",
      "flinch and glance upward toward an unseen mark above head",
      "clutch chest and draw breath with knees slightly bent",
      "stand weakened but alert"
    ],
    "hint": "Empty hands, tools stowed, NO painted rune or magical effects."
  },
  "attack_anticipation": {
    "label": "Strike \u00b7 wind-up",
    "group": "Strike phases",
    "seconds": 0.25,
    "loop": false,
    "source": "attack",
    "indices": [
      0,
      1
    ],
    "labels": [
      "Balanced guard",
      "Coil shoulders and raise the staff"
    ]
  },
  "attack_contact": {
    "label": "Strike \u00b7 contact",
    "group": "Strike phases",
    "seconds": 0.575,
    "loop": false,
    "source": "attack",
    "indices": [
      2
    ],
    "labels": [
      "Strike forward with weight on the front foot"
    ]
  },
  "attack_recovery": {
    "label": "Strike \u00b7 recovery",
    "group": "Strike phases",
    "seconds": 0.425,
    "loop": false,
    "source": "attack",
    "indices": [
      3
    ],
    "labels": [
      "retract staff into a balanced guarded stance"
    ]
  }
};
