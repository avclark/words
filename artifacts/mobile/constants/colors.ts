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
    tileBackground: "#E8B84B",     // wooden tile gold
    tileForeground: "#2D1A00",     // dark tile text
    tileEmpty: "#D9CCB0",          // board regular cell (cream)
    boardBackground: "#C8B98A",    // board border/background (warm tan)
    twsColor: "#DC2626",           // triple word - red
    dwsColor: "#F87171",           // double word - light red/pink
    tlsColor: "#1D4ED8",           // triple letter - dark blue
    dlsColor: "#93C5FD",           // double letter - light blue
    centerStar: "#DC2626",         // center star
    rackBackground: "#162032",     // rack - matches card navy
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
    tileEmpty: "#D9CCB0",
    boardBackground: "#C8B98A",
    twsColor: "#DC2626",
    dwsColor: "#F87171",
    tlsColor: "#1D4ED8",
    dlsColor: "#93C5FD",
    centerStar: "#DC2626",
    rackBackground: "#162032",
  },
  radius: 6,
};

export default colors;
