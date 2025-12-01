#pragma once

// Portal effect shaders adapted from Burn My Windows by Simon Schneegans
// Original: https://github.com/Schneegans/Burn-My-Windows
// License: GPL-3.0-or-later
// Converted to OpenGL ES 3.0 for Hyprland

inline const char* PORTAL_VERTEX_SHADER = R"(
#version 300 es
precision highp float;

layout(location = 0) in vec2 aPos;
layout(location = 1) in vec2 aTexCoord;

out vec2 vTexCoord;

uniform mat3 proj;

void main() {
    gl_Position = vec4(proj * vec3(aPos, 1.0), 1.0);
    vTexCoord = aTexCoord;
}
)";

inline const char* PORTAL_FRAGMENT_SHADER = R"(
#version 300 es
precision highp float;

in vec2 vTexCoord;
layout(location = 0) out vec4 FragColor;

// Uniforms
uniform float uProgress;        // Animation progress 0.0 -> 1.0
uniform float uDuration;        // Animation duration in seconds
uniform vec2 uSize;             // Window size
uniform vec2 uSeed;             // Random seed for variation
uniform vec3 uColor;            // Portal color (purple theme)
uniform float uRotationSpeed;   // Swirl rotation speed
uniform float uWhirling;        // Amount of whirl distortion
uniform sampler2D uWindowTex;   // The window being closed

// Constants for the portal effect
const float PORTAL_WOBBLE_TIME     = 0.8;
const float PORTAL_WOBBLE_STRENGTH = 1.2;
const float GLOW_EDGE_WIDTH        = 5.0;
const float WINDOW_SCALE           = 0.3;
const float WINDOW_SQUISH          = 1.0;
const float WINDOW_TILT            = -1.0;
const float PORTAL_OPEN_TIME       = 0.4;
const float PORTAL_CLOSE_TIME      = 0.4;
const float WINDOW_OPEN_TIME       = 0.35;

// Simplex noise implementation
vec3 mod289_3(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
vec2 mod289_2(vec2 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
vec3 permute(vec3 x) { return mod289_3(((x * 34.0) + 1.0) * x); }

float simplex2D(vec2 v) {
    const vec4 C = vec4(0.211324865405187, 0.366025403784439,
                        -0.577350269189626, 0.024390243902439);
    vec2 i  = floor(v + dot(v, C.yy));
    vec2 x0 = v - i + dot(i, C.xx);
    vec2 i1 = (x0.x > x0.y) ? vec2(1.0, 0.0) : vec2(0.0, 1.0);
    vec4 x12 = x0.xyxy + C.xxzz;
    x12.xy -= i1;
    i = mod289_2(i);
    vec3 p = permute(permute(i.y + vec3(0.0, i1.y, 1.0)) + i.x + vec3(0.0, i1.x, 1.0));
    vec3 m = max(0.5 - vec3(dot(x0, x0), dot(x12.xy, x12.xy), dot(x12.zw, x12.zw)), 0.0);
    m = m * m;
    m = m * m;
    vec3 x = 2.0 * fract(p * C.www) - 1.0;
    vec3 h = abs(x) - 0.5;
    vec3 ox = floor(x + 0.5);
    vec3 a0 = x - ox;
    m *= 1.79284291400159 - 0.85373472095314 * (a0 * a0 + h * h);
    vec3 g;
    g.x = a0.x * x0.x + h.x * x0.y;
    g.yz = a0.yz * x12.xz + h.yz * x12.yw;
    return 130.0 * dot(m, g);
}

// Easing functions
float easeInBack(float x, float s) {
    return (s + 1.0) * x * x * x - s * x * x;
}

float easeOutBack(float x, float s) {
    return 1.0 + (s + 1.0) * pow(x - 1.0, 3.0) + s * pow(x - 1.0, 2.0);
}

// Color utilities
vec3 darken(vec3 color, float amount) {
    return color * (1.0 - amount);
}

vec3 lighten(vec3 color, float amount) {
    return color + (vec3(1.0) - color) * amount;
}

vec4 alphaOver(vec4 background, vec4 foreground) {
    float alpha = foreground.a + background.a * (1.0 - foreground.a);
    vec3 color = (foreground.rgb * foreground.a + background.rgb * background.a * (1.0 - foreground.a)) / max(alpha, 0.001);
    return vec4(color, alpha);
}

// Whirl distortion - the key to the black hole effect!
vec2 whirl(vec2 coords, float warping, float rotation) {
    float dist = length(coords);
    float angle = atan(coords.y, coords.x);
    angle += rotation + warping * exp(-dist);
    return vec2(cos(angle), sin(angle)) * dist;
}

// Portal scale animation
float getPortalScale() {
    float scale = 1.0;
    float closeTime = PORTAL_CLOSE_TIME;
    float openTime = PORTAL_OPEN_TIME;

    if (uProgress < openTime) {
        scale = easeOutBack(uProgress / openTime, 1.5);
    } else if (uProgress > 1.0 - closeTime) {
        scale = easeOutBack(1.0 - (uProgress - 1.0 + closeTime) / closeTime, 1.5);
    }
    return scale;
}

// Portal wobble effect
vec2 getPortalWobble(vec2 coords) {
    float progress = uProgress / WINDOW_OPEN_TIME;
    progress = clamp(1.0 - abs((progress - 1.0) / PORTAL_WOBBLE_TIME), 0.0, 1.0);
    progress = easeInBack(progress, 1.7);
    float dist = length(coords);
    return coords * (1.0 - dist) * exp(-dist) * progress * PORTAL_WOBBLE_STRENGTH;
}

// Random displacement for organic look
vec2 getRandomDisplace(vec2 seed, float scale) {
    return vec2(simplex2D(seed * scale + uSeed) - 0.5,
                simplex2D(seed * scale + uSeed + vec2(7.89, 123.0)) - 0.5);
}

// The whirling coordinate transformation
vec2 getWhirledCoords(vec2 coords, float speedMultiplier, float warpMultiplier) {
    float rotation = uRotationSpeed * uProgress * uDuration * speedMultiplier;
    float warping = uWhirling * (6.0 + 1.5 * uProgress) * warpMultiplier;
    return whirl(coords, warping, rotation);
}

// Main portal rendering
vec4 getPortalColor() {
    vec2 coords = (vTexCoord - vec2(0.5)) * 2.0;
    coords *= 1.5;

    float scale = getPortalScale();
    coords /= max(scale * 0.5 + 0.5, 0.01);

    vec2 wobble = getPortalWobble(coords);
    float detailScale = 10000.0 / (uSize.x + uSize.y) * 0.5;

    // Layer 1: Background gradient
    vec2 layerCoords = getWhirledCoords(coords - wobble * 1.0, 0.25, 1.0);
    vec2 displace = getRandomDisplace(layerCoords, 2.1);
    layerCoords += displace * 0.1;
    float dist = length(layerCoords);
    float alpha = dist > 1.0 ? 0.0 : 1.0;
    vec4 color = vec4(mix(darken(uColor, 0.8), darken(uColor, 0.2), pow(dist, 5.0)), alpha);
    float randVal = dot(displace, displace);

    // Layer 2: First whirled band
    float noise = simplex2D(layerCoords / detailScale * 1.0 + vec2(12.3, 56.4) + uSeed);
    vec4 layer = vec4(darken(uColor, 0.3), noise > 0.6 ? alpha : 0.0);
    color = alphaOver(color, layer);

    // Layer 3: Second whirled band (faster rotation)
    layerCoords = getWhirledCoords(coords - wobble * 1.5, 0.75, 0.5);
    displace = getRandomDisplace(layerCoords, 12.2);
    layerCoords += displace * 0.1;
    noise = simplex2D(layerCoords / detailScale * 1.3 + uSeed);
    layer = vec4(uColor, noise > 0.6 ? alpha : 0.0);
    color = alphaOver(color, layer);

    color = clamp(color, 0.0, 1.0);

    // Layer 4: Glowing edge
    float edge = mix(1.0, 5.0, randVal) * GLOW_EDGE_WIDTH * detailScale - 150.0 * abs(dist - 1.0);
    layer = vec4(uColor, clamp(edge, 0.0, 1.0));
    color = alphaOver(color, layer);

    // Layer 5: Sparkles
    layerCoords = getWhirledCoords(coords - wobble * 1.8, 1.25, 0.0);
    noise = simplex2D(layerCoords / detailScale * 3.0 + uSeed);
    layer.rgb = lighten(uColor, 0.8) * clamp(pow(noise * randVal + 0.9, 50.0), 0.0, 1.0);
    color.rgb += layer.rgb;

    color.a *= pow(clamp(scale, 0.0, 1.0), 2.0);
    return clamp(color, 0.0, 1.0);
}

// Window being sucked in
vec4 getWindowColor() {
    float progress = uProgress / WINDOW_OPEN_TIME;
    progress = easeInBack(clamp(progress, 0.0, 1.0), 1.2);

    vec2 coords = vTexCoord * 2.0 - 1.0;

    // Scale down into the portal
    coords /= mix(1.0, WINDOW_SCALE, progress);

    // Squish vertically
    coords.y /= mix(1.0, (1.0 - 0.2 * WINDOW_SQUISH), progress);

    // Tilt effect
    coords.x /= mix(1.0, 1.0 - 0.1 * WINDOW_TILT * coords.y, progress);

    coords = coords * 0.5 + 0.5;

    // Check bounds
    if (coords.x < 0.0 || coords.x > 1.0 || coords.y < 0.0 || coords.y > 1.0) {
        return vec4(0.0);
    }

    // Sample window texture
    vec4 oColor = texture(uWindowTex, coords);
    oColor.a *= clamp((1.0 - progress) * 3.0, 0.0, 1.0);

    return oColor;
}

void main() {
    vec4 portal = getPortalColor();
    vec4 window = getWindowColor();
    FragColor = alphaOver(portal, window);
}
)";
