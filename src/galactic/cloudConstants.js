// cloudConstants.js — numbers that the GLSL cloud field and its CPU twin must share.
//
// The GLSL text (shaders/cloudField.glsl.js) interpolates these at module load, so the GPU and the CPU twin
// cannot disagree on a hash multiplier or a luminance weight. Headless: no three.js.

// Integer hash (a "lowbias32"-style finalizer). Exact in both uint32 GLSL and JS Math.imul arithmetic.
export const HASH_MUL_A = 0x7feb352d;
export const HASH_MUL_B = 0x846ca68b;

// Noise coordinates are shifted into the positive range before flooring, so lattice indices are never
// negative (GLSL ES leaves negative int→uint conversion ill-defined on some drivers).
export const NOISE_OFFSET_MIN = 128;
export const NOISE_OFFSET_SPAN = 768;

// Rec. 709 luminance weights (linear). Colour modes preserve luminance under these weights.
export const LUMA = [0.2126, 0.7152, 0.0722];

// Loop bound for the GLSL integrator (GLSL ES needs a constant loop limit).
export const MAX_STEPS = 128;

// Approximate std-dev of the zero-mean fBm sum used below, so `sigma` in the pack is in "standard" units.
// Measured on the CPU twin (see tests/galactic-cloud-field.test.js); value noise fBm is narrower than Gaussian.
export const FBM_STD = 0.116;

// Optical-depth CDF knots: fractions of the ray's chord through the cloud's bounding sphere at which the bake
// records the cumulative dust optical depth (as a fraction of the total). Stars are dimmed by the optical depth
// up to THEIR distance, read off a piecewise-linear CDF through (0,0), these knots, and (1,1).
export const DEPTH_KNOTS = [0.2, 0.4, 0.6, 0.8];

// Sky bake atlas: the six cube faces laid out as a 3 x 2 grid of N x N cells in one 2D texture.
// Texel centres are EDGE-INCLUSIVE (texel 0 and N-1 sit exactly on the face edges), so the two faces that share
// an edge hold identical rays there and bilinear sampling is continuous across every seam and corner.
export const ATLAS_COLS = 3;
export const ATLAS_ROWS = 2;
