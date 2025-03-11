
import { Toaster } from "@/components/ui/toaster";

export function App({ children }: { children: React.ReactNode }) {
  return (
    <>
      {children}
      <Toaster />
    </>
  );
}
