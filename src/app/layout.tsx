import type { ReactNode } from "react";
export const metadata = { title: "AI Job Search", description: "Private" };
export default function RootLayout({ children }: { children: ReactNode }) {
  return (<html lang="en"><body>{children}</body></html>);
}
