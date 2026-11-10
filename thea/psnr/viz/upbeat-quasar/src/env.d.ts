declare module '*.css';
declare module '*.csv' { const text: string; export default text; }
declare module '*.tsv' { const text: string; export default text; }
declare module '*.txt' { const text: string; export default text; }
declare module '*.md' { const text: string; export default text; }
declare module '*.geojson' { const value: unknown; export default value; }
declare module '*.svg' { const url: string; export default url; }
declare module '*.png' { const url: string; export default url; }
declare module '*.jpg' { const url: string; export default url; }
declare module '*.jpeg' { const url: string; export default url; }
declare module '*.webp' { const url: string; export default url; }
declare module '*.gif' { const url: string; export default url; }
declare module '*.avif' { const url: string; export default url; }
declare module '*.woff' { const url: string; export default url; }
declare module '*.woff2' { const url: string; export default url; }
declare module '*.ttf' { const url: string; export default url; }
declare module '*.otf' { const url: string; export default url; }
