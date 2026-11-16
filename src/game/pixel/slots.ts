// The palette slots a player's raster is painted in (studio overhaul players-4, moved out of body.ts so
// head.ts and body.ts paint the same materials). Each slot is one material with its own three-tone
// ramp (body.ts `palette`); 0 is empty. Pure constants: no drawing here.
export const SKIN = 1;
export const JERSEY = 2;
export const TRIM = 3;
export const SHORTS = 4;
export const SOCK = 5;
export const SHOE = 6;
export const HAIR = 7;
export const HELMET = 8;
export const MASK = 9;
export const PANTS = 10;
export const EYE = 11;
export const NUM = 12;
export const NUMLINE = 13;
export const STRIPE = 14;
/** head gear: a headband, wrap or skullcap (the record's `headC`) */
export const BAND = 15;
export const SOLE = 16;
/** the skin's shadow: nose, ears, a bald man's brow */
export const SKINDARK = 17;
/** hair cut close to the scalp (buzz, fades, cornrow partings): hair mixed into the skin */
export const BUZZ = 18;
export const GLOVE = 19;
/** a goggle lens or a football visor */
export const LENS = 20;
/** goggle frames and strap */
export const FRAME = 21;
export const MOUTH = 22;
/** arm gear: sleeves, wristbands, tape (the record's `armC`) */
export const ARMGEAR = 23;
/** leg gear: knee pads and sleeves, tights, calf sleeves (the record's `legC`) */
export const LEGGEAR = 24;
export const TOWEL = 25;
/** stubble and a short beard: hair grown through the skin */
export const STUBBLE = 26;
export const SLOTS = 27;

// body parts (the raster's `part` channel): the outline pass separates parts, never materials
export const LEG_L = 1;
export const LEG_R = 2;
export const TORSO = 3;
export const ARM_L = 4;
export const ARM_R = 5;
export const HEAD = 6;
/** hair and head gear standing off the skull: one shape with the head (no line between them) */
export const HAIR_VOL = 7;
/** hair hanging below the head (locs, a flow, a ponytail, a long beard): outside the head's box */
export const HAIR_HANG = 8;
