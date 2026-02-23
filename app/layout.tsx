import type { Metadata } from "next";
// import { Inter } from "next/font/google";
import "./globals.css";
import { Providers } from "./providers";

// const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "OpenClaw MC",
  description: "Real-time agent monitoring dashboard",
  manifest: "/manifest.webmanifest",
  icons: {
    icon: "/images/logos/icon.png",
    apple: "/images/logos/icon.png",
  },
};

// Inline script to apply the theme before first paint to avoid flash
const themeInitScript = `(function(){try{var t=localStorage.getItem('theme');if(t==='light'){document.documentElement.classList.remove('dark')}else if(t==='system'){if(!window.matchMedia('(prefers-color-scheme: dark)').matches){document.documentElement.classList.remove('dark')}}else{document.documentElement.classList.add('dark')}}catch(e){document.documentElement.classList.add('dark')}if('serviceWorker' in navigator){window.addEventListener('load',function(){var isProd=${process.env.NODE_ENV === "production"};if(!isProd){navigator.serviceWorker.getRegistrations().then(function(regs){return Promise.all(regs.map(function(r){return r.unregister()}))}).then(function(){if('caches' in window){return caches.keys().then(function(keys){return Promise.all(keys.map(function(k){return caches.delete(k)}))})}}).catch(function(){});return;}navigator.serviceWorker.register('/sw.js')})}})()`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
