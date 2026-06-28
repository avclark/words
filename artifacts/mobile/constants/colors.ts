/**
 * Semantic design tokens for the mobile app.
 *
 * These tokens mirror the naming conventions used in web artifacts (index.css)
 * so that multi-artifact projects share a cohesive visual identity.
 *
 * Replace the placeholder values below with values that match the project's
 * brand. If a sibling web artifact exists, read its index.css and convert the
 * HSL values to hex so both artifacts use the same palette.
 *
 * To add dark mode, add a `dark` key with the same token names.
 * The useColors() hook will automatically pick it up.
 */

const colors = {
  light: {
    text: "#FFFFFF",
    tint: "#F5C842",
    background: "#0D1B2A",        // dark navy
    foreground: "#FFFFFF",
    card: "#162032",               // slightly lighter navy
    cardForeground: "#FFFFFF",
    primary: "#F5C842",            // gold - main CTA
    primaryForeground: "#1A1200",
    secondary: "#1E3050",          // medium navy
    secondaryForeground: "#FFFFFF",
    muted: "#1E3050",
    mutedForeground: "#8BA3BF",
    accent: "#2A9D5C",             // green - board color
    accentForeground: "#FFFFFF",
    destructive: "#E53E3E",
    destructiveForeground: "#FFFFFF",
    border: "#2A3F5C",
    input: "#1E3050",
    // Custom game-specific tokens
    tileBackground: "#E8B84B",     // wooden tile tan
    tileForeground: "#2D1A00",     // dark brown tile text
    tileEmpty: "#1A6B2A",          // board cell green
    boardBackground: "#145A20",    // board dark green
    twsColor: "#C0392B",           // triple word red
    dwsColor: "#E74C3C",           // double word pink/light red
    tlsColor: "#1A5276",           // triple letter dark blue
    dlsColor: "#2E86C1",           // double letter blue
    centerStar: "#E74C3C",         // center star red
    rackBackground: "#2D1A00",     // rack dark brown
  },
  dark: {
    text: "#FFFFFF",
    tint: "#F5C842",
    background: "#0D1B2A",
    foreground: "#FFFFFF",
    card: "#162032",
    cardForeground: "#FFFFFF",
    primary: "#F5C842",
    primaryForeground: "#1A1200",
    secondary: "#1E3050",
    secondaryForeground: "#FFFFFF",
    muted: "#1E3050",
    mutedForeground: "#8BA3BF",
    accent: "#2A9D5C",
    accentForeground: "#FFFFFF",
    destructive: "#E53E3E",
    destructiveForeground: "#FFFFFF",
    border: "#2A3F5C",
    input: "#1E3050",
    tileBackground: "#E8B84B",
    tileForeground: "#2D1A00",
    tileEmpty: "#1A6B2A",
    boardBackground: "#145A20",
    twsColor: "#C0392B",
    dwsColor: "#E74C3C",
    tlsColor: "#1A5276",
    dlsColor: "#2E86C1",
    centerStar: "#E74C3C",
    rackBackground: "#2D1A00",
  },
  radius: 6,
};

export default colors;
